import { useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { CategoriaBudget, Movimento, Ricorrente } from '../../../dati/modello'
import { blobCSV, type TabellaExport } from '../../../export/csv'
import { condividiOScarica, creaPdf, scarica } from '../../../export/pdf'
import { Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro } from '../../../interfaccia/icone'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import {
  centesimiDa, leggiMovimentoVeloce, prossimeScadenze, riepilogo, spostaMese, vociDelMese, type DatiBudget, type TipoMovimento, type Voce,
} from '../logica'

const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const dataBreve = (g: string) => F.dataBreve(msGiorno(g))
const euro = (cent: number) => F.importo(cent)
const testoImporto = (cent: number) => (cent / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')

/** Dati del budget dalle collezioni, e un indicatore "pronto". */
function useDatiBudget() {
  const categorie = useCollezione('categorieBudget')
  const movimenti = useCollezione('movimenti')
  const ricorrenti = useCollezione('ricorrenti')
  const turni = useCollezione('turni')
  const tasse = useCollezione('tasse')
  const dati: DatiBudget = useMemo(() => ({
    categorie: [...(categorie ?? [])].sort((a, b) => a.ordine - b.ordine), movimenti: movimenti ?? [], ricorrenti: ricorrenti ?? [], turni: turni ?? [], tasse: tasse ?? [],
  }), [categorie, movimenti, ricorrenti, turni, tasse])
  return { dati, pronto: Boolean(categorie && movimenti && ricorrenti) }
}

/** Che cosa si sta modificando nel foglio. */
type Modifica =
  | { tipo: TipoMovimento; movimento?: Movimento; ricorrente?: Ricorrente; iniziale?: { importoCent?: number; categoriaId?: string; nota?: string } }

export function Budget({ meseParam }: { meseParam?: string | null }) {
  const { dati, pronto } = useDatiBudget()
  const oggiChiave = chiaveGiorno(oggi())
  const mese = meseParam && /^\d{4}-\d{2}$/.test(meseParam) ? meseParam : oggiChiave.slice(0, 7)
  const [testo, setTesto] = useState('')
  const [modifica, setModifica] = useState<Modifica>()
  const [esporta, setEsporta] = useState(false)
  const [tutti, setTutti] = useState(false)

  const r = riepilogo(dati, mese, oggiChiave)
  const precedente = riepilogo(dati, spostaMese(mese, -1), oggiChiave)
  const anno = Array.from({ length: Number(mese.slice(5, 7)) }, (_, i) => riepilogo(dati, `${mese.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`, oggiChiave))
    .reduce((s, x) => s + x.restoCent, 0)
  const voci = vociDelMese(dati, mese)
  const categorie = new Map(dati.categorie.map((c) => [c.id, c]))
  const scadenze = prossimeScadenze(dati, oggiChiave).slice(0, 6)
  const variazione = precedente.usciteCent ? Math.round(((r.usciteCent - precedente.usciteCent) / precedente.usciteCent) * 100) : undefined
  const massimo = Math.max(1, ...r.perCategoria.map((c) => Math.max(c.cent, c.tettoCent ?? 0)))

  function aggiungiVeloce() {
    const letto = leggiMovimentoVeloce(testo, dati.categorie)
    if (!letto.importoCent) return
    const tipo: TipoMovimento = letto.categoria?.tipo === 'entrata' ? 'entrata' : 'uscita'
    if (!letto.categoria) {
      // Senza categoria riconosciuta si apre il foglio, già compilato, per sceglierla.
      setModifica({ tipo, iniziale: { importoCent: letto.importoCent, nota: letto.nota } })
      setTesto('')
      return
    }
    setTesto('')
    void salva('movimenti', {
      tipo, importoCent: letto.importoCent, giorno: oggiChiave, categoriaId: letto.categoria.id, nota: letto.nota,
      daIncassare: tipo === 'entrata' && letto.categoria.extra ? true : undefined,
    }).then((m) => mostraAvviso(`${tipo === 'entrata' ? '+' : '−'}${euro(m.importoCent)} · ${letto.categoria!.nome}`, () => void elimina('movimenti', m.id)))
  }

  function apri(v: Voce) {
    if (v.origine === 'turno') { location.hash = `#/turni/${v.id}`; return }
    if (v.origine === 'tassa') { location.hash = '#/specializzazione/tasse'; return }
    if (v.origine === 'movimento') setModifica({ tipo: v.tipo, movimento: dati.movimenti.find((m) => m.id === v.id) })
    else setModifica({ tipo: v.tipo, ricorrente: dati.ricorrenti.find((x) => x.id === v.id) })
  }
  async function eliminaVoce(v: Voce) {
    if (v.origine === 'movimento') {
      await elimina('movimenti', v.id)
      mostraAvviso(`Eliminato: ${v.titolo}`, () => void ripristina('movimenti', v.id))
    } else if (v.origine === 'ricorrente') {
      // Una spesa fissa si toglie solo da questo mese; per toglierla del tutto si apre e si elimina.
      const x = dati.ricorrenti.find((y) => y.id === v.id)
      if (!x) return
      await salva('ricorrenti', { ...x, saltati: [...(x.saltati ?? []), mese] })
      mostraAvviso(`Tolto da questo mese: ${v.titolo}`, () => void salva('ricorrenti', x))
    }
  }
  async function incassa(v: Voce) {
    if (v.origine === 'turno') {
      const t = dati.turni?.find((x) => x.id === v.id)
      if (t) await salva('turni', { ...t, stato: 'pagato' })
    } else {
      const m = dati.movimenti.find((x) => x.id === v.id)
      if (m) await salva('movimenti', { ...m, daIncassare: undefined })
    }
    mostraAvviso(`Incassato: ${euro(v.importoCent)}`)
  }

  const elencoVoci = tutti ? voci : voci.slice(0, 8)

  return (
    <div className="schermata" style={{ maxWidth: 980 }}>
      <header className="testata-turni">
        <h1 className="titolo-grande">Budget</h1>
        <div className="riga-azioni azioni navigazione-mese" style={{ marginLeft: 'auto' }}>
          <a className="pulsante tondo" href={`#/budget?mese=${spostaMese(mese, -1)}`} aria-label="Mese precedente"><IconaIndietro dimensione={18} /></a>
          <a className="pulsante" href="#/budget" style={{ minWidth: 140, fontWeight: 600, textTransform: 'capitalize' }}>{F.mese(msGiorno(`${mese}-01`))}</a>
          <a className="pulsante tondo" href={`#/budget?mese=${spostaMese(mese, 1)}`} aria-label="Mese successivo"><IconaAvanti dimensione={18} /></a>
        </div>
      </header>

      <div className="tessere tessere-budget">
        <div className="tessera"><span className="secondario piccolo">Entrate</span><span className="valore positivo">{euro(r.entrateCent)}</span>
          <span className="secondario piccolo">{r.extraCent ? `di cui ${euro(r.extraCent)} extra` : ' '}</span></div>
        <div className="tessera"><span className="secondario piccolo">Uscite</span><span className="valore negativo">{euro(r.usciteCent)}</span>
          <span className="secondario piccolo">{variazione !== undefined ? `${variazione > 0 ? '+' : variazione < 0 ? '−' : ''}${Math.abs(variazione)}% rispetto al mese prima` : ' '}</span></div>
        <div className="tessera"><span className="secondario piccolo">Ti restano</span><span className="valore">{euro(r.restoCent)}</span>
          <span className="secondario piccolo">nell'anno: {euro(anno)}</span></div>
      </div>

      <div className="piu-meno">
        <button type="button" className="grande-piu" onClick={() => setModifica({ tipo: 'entrata' })} aria-label="Nuova entrata"><span>+</span>Entrata</button>
        <button type="button" className="grande-meno" onClick={() => setModifica({ tipo: 'uscita' })} aria-label="Nuova uscita"><span>−</span>Uscita</button>
      </div>
      <div className="aggiunta-veloce">
        <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') aggiungiVeloce() }}
          placeholder="Oppure scrivi: Spesa 45, Sostituzione 180…" aria-label="Movimento veloce" enterKeyHint="done" />
        <button type="button" className="pulsante primario" disabled={!leggiMovimentoVeloce(testo, dati.categorie).importoCent} onClick={aggiungiVeloce}>Aggiungi</button>
      </div>

      <div className="colonne">
        <div className="principale">
          <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 className="titolo-sezione">Spese per categoria</h2>
            {r.perCategoria.length === 0 && <span className="secondario piccolo">Nessuna spesa in questo mese.</span>}
            {r.perCategoria.map(({ categoria: c, cent, tettoCent }) => {
              const oltre = tettoCent !== undefined && cent > tettoCent
              const vicino = tettoCent !== undefined && !oltre && cent >= tettoCent * 0.8
              return (
                <div key={c.id} className="barra-categoria">
                  <div className="intestazione-barra">
                    <span><span className="pallino-fonte" style={{ background: c.colore }} /> {c.nome}</span>
                    <span className="numeri" style={oltre ? { color: 'var(--pericolo)', fontWeight: 700 } : undefined}>
                      {euro(cent)}{tettoCent !== undefined && <span className="secondario"> di {euro(tettoCent)}</span>}
                    </span>
                  </div>
                  <div className="barra"><i style={{
                    width: `${Math.min(100, (cent / (tettoCent ?? massimo)) * 100)}%`,
                    background: oltre ? 'var(--pericolo)' : vicino ? '#E0A030' : c.colore,
                  }} /></div>
                </div>
              )
            })}
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="titolo-sezione">Movimenti del mese</h2>
            <div className="lista">
              {voci.length === 0 && <div className="vuoto piccolo">Ancora niente: usa + o − qui sopra.</div>}
              {elencoVoci.map((v) => {
                const c = categorie.get(v.categoriaId ?? '')
                const futuro = v.giorno > oggiChiave
                return (
                  <div key={v.chiave} className={`riga riga-movimento${futuro || v.daIncassare ? ' conclusa' : ''}`}>
                    <span className="pallino-fonte" style={{ background: c?.colore ?? '#D3D1C7', width: 10, height: 10, borderRadius: 5 }} />
                    <button type="button" className="crescente" onClick={() => apri(v)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600 }}>
                        {v.titolo}
                        {v.origine === 'ricorrente' && <span className="etichetta-piccola">↻ {dati.ricorrenti.find((x) => x.id === v.id)?.frequenza === 'anno' ? 'ogni anno' : 'ogni mese'}</span>}
                      </span>
                      <span className="secondario piccolo">
                        {[dataBreve(v.giorno), c && c.nome !== v.titolo ? c.nome : '', v.origine === 'turno' ? 'dal turno' : '', v.origine === 'tassa' ? 'da Tasse' : '',
                          v.daIncassare ? 'da incassare' : '', futuro ? 'in programma' : ''].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                    <span className={`numeri importo ${v.tipo}`}>{v.tipo === 'entrata' ? '+' : '−'}{euro(v.importoCent)}</span>
                    {(v.origine === 'movimento' || v.origine === 'ricorrente') && (
                      <button type="button" className="elimina-task" aria-label={`Elimina ${v.titolo}`} onClick={() => void eliminaVoce(v)}>×</button>
                    )}
                  </div>
                )
              })}
            </div>
            {voci.length > 8 && <button type="button" className="pulsante" onClick={() => setTutti(!tutti)}>{tutti ? 'Mostra meno' : `Mostra tutti (${voci.length})`}</button>}
          </section>
        </div>

        <aside className="laterale-destra">
          <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 className="titolo-sezione">Da incassare</h2>
            {r.daIncassare.length === 0 && <span className="secondario piccolo">Niente in attesa questo mese.</span>}
            {r.daIncassare.map((v) => (
              <div key={v.chiave} className="riga-semplice">
                <button type="button" className="crescente" onClick={() => apri(v)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 600 }}>{v.titolo}</span>
                  <span className="secondario piccolo">{v.origine === 'turno' ? `turno del ${dataBreve(v.giorno)}` : dataBreve(v.giorno)}</span>
                </button>
                <span className="numeri">{euro(v.importoCent)}</span>
                <button type="button" className="pillola" onClick={() => void incassa(v)}>Incassato</button>
              </div>
            ))}
          </section>
          <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 className="titolo-sezione">Prossime scadenze</h2>
            {scadenze.length === 0 && <span className="secondario piccolo">Nessuna uscita in programma.</span>}
            {scadenze.map((s) => (
              <a key={s.chiave} className="riga-semplice" href={s.link} style={{ color: 'inherit' }}>
                <span className="crescente"><span style={{ fontWeight: 600 }}>{s.titolo}</span><span className="secondario piccolo">{F.dataEstesa(msGiorno(s.giorno))}</span></span>
                <span className="numeri">{euro(s.importoCent)}</span>
              </a>
            ))}
          </section>
          <div className="riga-azioni">
            <button type="button" className="pulsante" onClick={() => setEsporta(true)}>Esporta l'anno</button>
            <a className="pulsante" href="#/budget/categorie">Categorie e tetti</a>
          </div>
        </aside>
      </div>

      {modifica && pronto && <FormMovimento key={modifica.movimento?.id ?? modifica.ricorrente?.id ?? modifica.tipo} m={modifica} categorie={dati.categorie} onChiudi={() => setModifica(undefined)} />}
      {esporta && <EsportaAnno anno={mese.slice(0, 4)} dati={dati} onChiudi={() => setEsporta(false)} />}
    </div>
  )
}

/* Foglio per una entrata o uscita (anche fissa, che si ripete) */

function FormMovimento({ m, categorie, onChiudi }: { m: Modifica; categorie: CategoriaBudget[]; onChiudi: () => void }) {
  const r = m.ricorrente, mov = m.movimento
  const [tipo, setTipo] = useState<TipoMovimento>(m.tipo)
  const delTipo = categorie.filter((c) => c.tipo === tipo)
  const [b, setB] = useState({
    importo: testoImporto(mov?.importoCent ?? r?.importoCent ?? m.iniziale?.importoCent ?? 0).replace(/^0$/, ''),
    categoriaId: mov?.categoriaId ?? r?.categoriaId ?? m.iniziale?.categoriaId ?? '',
    giorno: mov?.giorno ?? r?.inizio ?? chiaveGiorno(oggi()),
    nota: mov?.nota ?? r?.descrizione ?? m.iniziale?.nota ?? '',
    ripeti: (r?.frequenza ?? 'no') as 'no' | 'mese' | 'anno',
    daIncassare: Boolean(mov?.daIncassare),
  })
  const importoCent = centesimiDa(b.importo)
  const categoria = categorie.find((c) => c.id === b.categoriaId && c.tipo === tipo)
  const valido = !!importoCent && !!categoria && !!giornoDaChiave(b.giorno)

  function scegliCategoria(c: CategoriaBudget) {
    // Le entrate da lavoro extra partono "da incassare" (si cambia con l'interruttore).
    setB({ ...b, categoriaId: c.id, daIncassare: !mov && tipo === 'entrata' ? Boolean(c.extra) : b.daIncassare })
  }

  async function conferma() {
    if (!valido) return
    const comuni = { tipo, importoCent: importoCent!, categoriaId: categoria!.id }
    if (b.ripeti !== 'no') {
      await salva('ricorrenti', { ...r, ...comuni, descrizione: b.nota.trim() || categoria!.nome, frequenza: b.ripeti, inizio: b.giorno })
      if (mov) await elimina('movimenti', mov.id)
    } else {
      await salva('movimenti', { ...mov, ...comuni, giorno: b.giorno, nota: b.nota.trim() || undefined, daIncassare: tipo === 'entrata' && b.daIncassare ? true : undefined })
      if (r) await elimina('ricorrenti', r.id)
    }
    onChiudi()
  }

  return (
    <Foglio aperto titolo={mov || r ? (tipo === 'entrata' ? 'Entrata' : 'Uscita') : tipo === 'entrata' ? 'Nuova entrata' : 'Nuova uscita'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <div className="segmenti" role="radiogroup" aria-label="Tipo">
          {(['entrata', 'uscita'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} className={tipo === t ? 'attivo' : ''} onClick={() => { setTipo(t); setB({ ...b, categoriaId: '' }) }}>
              {t === 'entrata' ? '+ Entrata' : '− Uscita'}
            </button>
          ))}
        </div>
        <label className={`campo-importo ${tipo}`}>
          <span>{tipo === 'entrata' ? '+' : '−'}</span>
          <input inputMode="decimal" autoFocus={!mov && !r} value={b.importo} placeholder="0" aria-label="Importo in euro" onChange={(e) => setB({ ...b, importo: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') void conferma() }} />
          <span>€</span>
        </label>
        <div className="campo">
          <span>Categoria</span>
          <div className="riga-azioni" role="group" aria-label="Categoria">
            {delTipo.map((c) => (
              <button key={c.id} type="button" className="pillola categoria-scelta" aria-pressed={b.categoriaId === c.id} onClick={() => scegliCategoria(c)}
                style={b.categoriaId === c.id ? { background: c.colore, borderColor: c.colore, color: '#1f1f1f', fontWeight: 700 } : undefined}>
                <span className="pallino-fonte" style={{ background: c.colore }} />{c.nome}
              </button>
            ))}
            <a className="pillola" href="#/budget/categorie" onClick={onChiudi}>+ Nuova categoria</a>
          </div>
        </div>
        <div className="campi-affiancati">
          <Campo etichetta={b.ripeti === 'no' ? 'Giorno' : 'Dal giorno'}><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
          <Campo etichetta="Si ripete">
            <select value={b.ripeti} onChange={(e) => setB({ ...b, ripeti: e.target.value as 'no' | 'mese' | 'anno' })}>
              <option value="no">No</option><option value="mese">Ogni mese</option><option value="anno">Ogni anno</option>
            </select>
          </Campo>
        </div>
        {tipo === 'entrata' && b.ripeti === 'no' && (
          <label className="interruttore">
            <span>Da incassare (non ancora ricevuta)</span>
            <input type="checkbox" checked={b.daIncassare} onChange={(e) => setB({ ...b, daIncassare: e.target.checked })} />
          </label>
        )}
        <Campo etichetta={b.ripeti === 'no' ? 'Nota (facoltativa)' : 'Nome (es. Affitto, Stipendio)'}><input value={b.nota} onChange={(e) => setB({ ...b, nota: e.target.value })} /></Campo>
        <NotaPrivacy />
        {(mov || r) && (
          <button type="button" className="pulsante pericolo" onClick={() => void (async () => {
            if (mov) { await elimina('movimenti', mov.id); mostraAvviso('Movimento eliminato', () => void ripristina('movimenti', mov.id)) }
            if (r) { await elimina('ricorrenti', r.id); mostraAvviso(`Eliminato in tutti i mesi: ${r.descrizione}`, () => void ripristina('ricorrenti', r.id)) }
            onChiudi()
          })()}>
            {r ? 'Elimina in tutti i mesi' : 'Elimina'}
          </button>
        )}
      </div>
    </Foglio>
  )
}

/* Esportazione dell'anno */

function EsportaAnno({ anno, dati, onChiudi }: { anno: string; dati: DatiBudget; onChiudi: () => void }) {
  const [stato, setStato] = useState<string>()
  const categorie = new Map(dati.categorie.map((c) => [c.id, c.nome]))
  const voci = Array.from({ length: 12 }, (_, i) => vociDelMese(dati, `${anno}-${String(i + 1).padStart(2, '0')}`)).flat()
    .filter((v) => !v.daIncassare && v.giorno <= chiaveGiorno(oggi()))
    .sort((a, b) => a.giorno.localeCompare(b.giorno))
  const entrate = voci.filter((v) => v.tipo === 'entrata').reduce((s, v) => s + v.importoCent, 0)
  const uscite = voci.filter((v) => v.tipo === 'uscita').reduce((s, v) => s + v.importoCent, 0)

  function csv() {
    const tabella: TabellaExport = {
      titolo: `Budget ${anno}`,
      intestazioni: ['Data', 'Tipo', 'Categoria', 'Descrizione', 'Importo'],
      righe: voci.map((v) => [
        { tipo: 'data', istante: msGiorno(v.giorno) }, { tipo: 'testo', valore: v.tipo === 'entrata' ? 'Entrata' : 'Uscita' },
        { tipo: 'testo', valore: categorie.get(v.categoriaId ?? '') ?? '' }, { tipo: 'testo', valore: v.titolo },
        { tipo: 'importo', centesimi: v.tipo === 'entrata' ? v.importoCent : -v.importoCent },
      ]),
    }
    scarica(blobCSV(tabella), `Budget ${anno}.csv`)
    onChiudi()
  }
  async function pdf() {
    setStato('Preparo il PDF…')
    const blob = await creaPdf({
      titolo: `Budget ${anno}`, sottotitolo: 'Entrate e uscite registrate',
      riepilogo: [{ etichetta: 'entrate', valore: euro(entrate) }, { etichetta: 'uscite', valore: euro(uscite) }, { etichetta: 'saldo', valore: euro(entrate - uscite) }],
      intestazioni: ['Data', 'Categoria', 'Descrizione', 'Importo'],
      righe: voci.map((v) => ({ celle: [dataBreve(v.giorno), categorie.get(v.categoriaId ?? '') ?? '', v.titolo, `${v.tipo === 'entrata' ? '+' : '−'}${euro(v.importoCent)}`] })),
      colonneDestra: [3], colonneGrassetto: [3],
      totaleTabella: ['Saldo', '', '', euro(entrate - uscite)],
      piede: `Agenda · creato ${F.dataEstesa(Date.now())}`,
    })
    await condividiOScarica(blob, `Budget ${anno}.pdf`, `Budget ${anno}`)
    onChiudi()
  }
  return (
    <Foglio aperto titolo={`Esporta il ${anno}`} onChiudi={onChiudi}>
      <p className="secondario" style={{ margin: 0 }}>{voci.length} movimenti registrati finora (esclusi quelli da incassare).</p>
      {stato && <span className="secondario">{stato}</span>}
      <div className="scelte-rapide">
        <button type="button" className="scelta-rapida" onClick={csv}><span className="nome"><strong>Excel (CSV)</strong><br /><span className="orario">tutti i movimenti, per il commercialista</span></span></button>
        <button type="button" className="scelta-rapida" onClick={() => void pdf()}><span className="nome"><strong>PDF</strong><br /><span className="orario">riepilogo e elenco</span></span></button>
      </div>
    </Foglio>
  )
}

/* Categorie e tetti */

const COLORI = ['#1D9E75', '#5DCAA5', '#97C459', '#85B7EB', '#378ADD', '#AFA9EC', '#7F77DD', '#ED93B1', '#F0997B', '#FAC775', '#E0A030', '#B4B2A9']

export function CategorieBudget() {
  const categorie = useCollezione('categorieBudget')
  const [nuova, setNuova] = useState({ nome: '', tipo: 'uscita' as TipoMovimento, colore: COLORI[5]! })
  const elenco = [...(categorie ?? [])].sort((a, b) => a.ordine - b.ordine)

  async function aggiungi() {
    if (!nuova.nome.trim()) return
    await salva('categorieBudget', { nome: nuova.nome.trim(), tipo: nuova.tipo, colore: nuova.colore, ordine: (elenco.at(-1)?.ordine ?? 0) + 1 })
    setNuova({ ...nuova, nome: '' })
  }

  const gruppo = (tipo: TipoMovimento) => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 className="titolo-sezione">{tipo === 'entrata' ? 'Entrate' : 'Uscite'}</h2>
      <div className="lista">
        {elenco.filter((c) => c.tipo === tipo).map((c) => (
          <div key={c.id} className="riga riga-categoria" style={{ cursor: 'default' }}>
            <input type="color" value={c.colore} aria-label={`Colore di ${c.nome}`} onChange={(e) => void salva('categorieBudget', { ...c, colore: e.target.value })} className="scelta-colore" />
            <input value={c.nome} aria-label="Nome" onChange={(e) => void salva('categorieBudget', { ...c, nome: e.target.value })} className="campo-in-riga" style={{ fontWeight: 600 }} />
            {tipo === 'uscita' ? (
              <label className="tetto">
                <span className="secondario piccolo">tetto</span>
                <input inputMode="decimal" placeholder="—" defaultValue={c.tettoCent ? testoImporto(c.tettoCent) : ''} aria-label={`Tetto mensile di ${c.nome}`}
                  onBlur={(e) => void salva('categorieBudget', { ...c, tettoCent: centesimiDa(e.target.value) })} />
                <span className="secondario piccolo">€</span>
              </label>
            ) : (
              <label className="secondario piccolo" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={Boolean(c.extra)} onChange={(e) => void salva('categorieBudget', { ...c, extra: e.target.checked || undefined })} /> lavoro extra
              </label>
            )}
            <button type="button" className="elimina-task" aria-label={`Elimina ${c.nome}`}
              onClick={() => void elimina('categorieBudget', c.id).then(() => mostraAvviso(`Eliminata: ${c.nome}`, () => void ripristina('categorieBudget', c.id)))}>×</button>
          </div>
        ))}
      </div>
    </section>
  )

  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header>
        <a href="#/budget" className="piccolo">‹ Budget</a>
        <h1 className="titolo-grande">Categorie e tetti</h1>
      </header>
      <section className="scheda modulo">
        <h2 className="titolo-sezione">Nuova categoria</h2>
        <div className="segmenti" role="radiogroup" aria-label="Tipo">
          {(['uscita', 'entrata'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={nuova.tipo === t} className={nuova.tipo === t ? 'attivo' : ''} onClick={() => setNuova({ ...nuova, tipo: t })}>
              {t === 'entrata' ? 'Entrata' : 'Uscita'}
            </button>
          ))}
        </div>
        <div className="riga-azioni">
          {COLORI.map((c) => (
            <button key={c} type="button" className="campione-colore" aria-label={`Colore ${c}`} aria-pressed={nuova.colore === c} onClick={() => setNuova({ ...nuova, colore: c })} style={{ background: c }} />
          ))}
        </div>
        <div className="aggiunta-veloce">
          <input value={nuova.nome} placeholder="Nome (es. Palestra, Regali, Viaggi)" onChange={(e) => setNuova({ ...nuova, nome: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void aggiungi() }} />
          <button type="button" className="pulsante primario" disabled={!nuova.nome.trim()} onClick={() => void aggiungi()}>Aggiungi</button>
        </div>
      </section>
      {gruppo('uscita')}
      {gruppo('entrata')}
      <span className="secondario piccolo">
        Il tetto è quanto vuoi spendere al mese per quella categoria: la barra diventa gialla quando ti avvicini e rossa quando lo superi.
        Le entrate "lavoro extra" partono come "da incassare". Eliminando una categoria i movimenti restano.
      </span>
    </div>
  )
}


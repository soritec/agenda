import { useEffect, useMemo, useRef, useState } from 'react'
import { PROFILO_PRINCIPALE, profiloAttivo } from '../../../dati/profili'
import { cambioDaTesto, cambioDelGiorno, converti, testoCambio } from '../cambio'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { CategoriaBudget, Movimento, ObiettivoRisparmio, Ricorrente } from '../../../dati/modello'
import { blobCSV, type TabellaExport } from '../../../export/csv'
import { condividiOScarica, creaPdf, scarica } from '../../../export/pdf'
import { Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro, IconaSalvadanaio } from '../../../interfaccia/icone'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import {
  CATEGORIA_RISPARMI, centesimiDa, leggiMovimentoVeloce, statoRisparmi, type TipoVoce, prossimeScadenze, riepilogo, spostaMese, vociDelMese, type DatiBudget, type TipoMovimento, type Voce,
} from '../logica'

const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const dataBreve = (g: string) => F.dataBreve(msGiorno(g))
const euro = (cent: number) => F.importo(cent)
const COLORE_RISPARMI = '#4A8FD0'
const segno = (t: TipoVoce) => (t === 'entrata' ? '+' : t === 'uscita' ? '−' : t === 'risparmio' ? '→ ' : '← ')
const testoImporto = (cent: number) => (cent / 100).toFixed(2).replace('.', ',').replace(/,00$/, '')

/** Dati del budget dalle collezioni, e un indicatore "pronto". */
function useDatiBudget() {
  const categorie = useCollezione('categorieBudget')
  const movimenti = useCollezione('movimenti')
  const ricorrenti = useCollezione('ricorrenti')
  const turni = useCollezione('turni')
  const tasse = useCollezione('tasse')
  const obiettivi = useCollezione('obiettiviRisparmio')
  const dati: DatiBudget = useMemo(() => ({
    categorie: [...(categorie ?? [])].sort((a, b) => a.ordine - b.ordine), movimenti: movimenti ?? [], ricorrenti: ricorrenti ?? [], turni: turni ?? [], tasse: tasse ?? [],
    obiettivi: [...(obiettivi ?? [])].sort((a, b) => a.creatoIl - b.creatoIl),
  }), [categorie, movimenti, ricorrenti, turni, tasse, obiettivi])
  return { dati, pronto: Boolean(categorie && movimenti && ricorrenti) }
}

/** Che cosa si sta modificando nel foglio. */
type Modifica =
  | { tipo: TipoVoce; movimento?: Movimento; ricorrente?: Ricorrente; iniziale?: { importoCent?: number; categoriaId?: string; nota?: string } }

export function Budget({ meseParam }: { meseParam?: string | null }) {
  const { dati, pronto } = useDatiBudget()
  const oggiChiave = chiaveGiorno(oggi())
  const mese = meseParam && /^\d{4}-\d{2}$/.test(meseParam) ? meseParam : oggiChiave.slice(0, 7)
  const [testo, setTesto] = useState('')
  const [modifica, setModifica] = useState<Modifica>()
  const [esporta, setEsporta] = useState(false)
  const [tutti, setTutti] = useState(false)
  const [filtro, setFiltro] = useState<'tutti' | 'entrata' | 'uscita' | 'risparmi'>('tutti')
  const [obiettivoAperto, setObiettivoAperto] = useState<{ o?: ObiettivoRisparmio }>()

  const r = riepilogo(dati, mese, oggiChiave)
  const precedente = riepilogo(dati, spostaMese(mese, -1), oggiChiave)
  const anno = Array.from({ length: Number(mese.slice(5, 7)) }, (_, i) => riepilogo(dati, `${mese.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`, oggiChiave))
    .reduce((s, x) => s + x.restoCent, 0)
  const voci = vociDelMese(dati, mese)
  const categorie = new Map(dati.categorie.map((c) => [c.id, c]))
  const scadenze = prossimeScadenze(dati, oggiChiave).slice(0, 6)
  const variazione = precedente.usciteCent ? Math.round(((r.usciteCent - precedente.usciteCent) / precedente.usciteCent) * 100) : undefined
  const risparmi = statoRisparmi(dati, oggiChiave)
  const vociRisparmio = voci.filter((v) => v.tipo === 'risparmio' || v.tipo === 'prelievo')
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

  const vociFiltrate = filtro === 'tutti' ? voci : voci.filter((v) => (filtro === 'risparmi' ? v.tipo === 'risparmio' || v.tipo === 'prelievo' : v.tipo === filtro))
  const elencoVoci = tutti ? vociFiltrate : vociFiltrate.slice(0, 8)
  /** "1500,00 € cambiati" per gli importi scritti in un'altra valuta. */
  const originaleDi = (v: { origine: string; id: string }) => {
    const x = v.origine === 'movimento' ? dati.movimenti.find((m) => m.id === v.id) : v.origine === 'ricorrente' ? dati.ricorrenti.find((m) => m.id === v.id) : undefined
    return x?.valutaOriginale && x.importoOriginaleCent ? `${F.importoIn(x.importoOriginaleCent, x.valutaOriginale)} cambiati` : ''
  }

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
          <span className="secondario piccolo">{r.risparmiatoCent > 0 ? `esclusi i ${euro(r.risparmiatoCent)} messi da parte` : r.risparmiatoCent < 0 ? `con ${euro(-r.risparmiatoCent)} ripresi dai risparmi` : `nell'anno: ${euro(anno)}`}</span></div>
        <div className="tessera tessera-risparmi"><span className="piccolo"><IconaSalvadanaio dimensione={15} /> Risparmi</span><span className="valore">{euro(risparmi.totaleCent)}</span>
          <span className="piccolo">{r.risparmiatoCent ? `${r.risparmiatoCent > 0 ? '+' : '−'}${euro(Math.abs(r.risparmiatoCent))} questo mese` : 'non contano in "Ti restano"'}</span></div>
      </div>

      <div className="piu-meno">
        <button type="button" className="grande-piu" onClick={() => setModifica({ tipo: 'entrata' })} aria-label="Nuova entrata"><span>+</span>Entrata</button>
        <button type="button" className="grande-meno" onClick={() => setModifica({ tipo: 'uscita' })} aria-label="Nuova uscita"><span>−</span>Uscita</button>
        <button type="button" className="grande-risparmio" onClick={() => setModifica({ tipo: 'risparmio' })} aria-label="Metti da parte"><IconaSalvadanaio dimensione={18} />Metti da parte</button>
      </div>
      <div className="aggiunta-veloce">
        <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') aggiungiVeloce() }}
          placeholder={`Oppure scrivi: Spesa 45, ${profiloAttivo() === PROFILO_PRINCIPALE ? 'Sostituzione 180' : 'Trasporti 12'}…`} aria-label="Movimento veloce" enterKeyHint="done" />
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
            <div className="intestazione-movimenti">
              <h2 className="titolo-sezione">Movimenti del mese</h2>
              <div className="segmenti compatti" role="radiogroup" aria-label="Mostra">
                {([['tutti', 'Tutti'], ['entrata', 'Entrate'], ['uscita', 'Uscite'], ['risparmi', 'Risparmi']] as const).map(([k, t]) => (
                  <button key={k} type="button" role="radio" aria-checked={filtro === k} className={filtro === k ? 'attivo' : ''} onClick={() => setFiltro(k)}>{t}</button>
                ))}
              </div>
            </div>
            <div className="lista">
              {voci.length === 0 && <div className="vuoto piccolo">Ancora niente: usa + o − qui sopra.</div>}
              {voci.length > 0 && vociFiltrate.length === 0 && <div className="vuoto piccolo">Nessun movimento di questo tipo nel mese.</div>}
              {elencoVoci.map((v) => {
                const c = categorie.get(v.categoriaId ?? '')
                const futuro = v.giorno > oggiChiave
                return (
                  <div key={v.chiave} className={`riga riga-movimento${futuro || v.daIncassare ? ' conclusa' : ''}`}>
                    <span className="pallino-fonte" style={{ background: v.tipo === 'risparmio' || v.tipo === 'prelievo' ? COLORE_RISPARMI : c?.colore ?? '#D3D1C7', width: 10, height: 10, borderRadius: 5 }} />
                    <button type="button" className="crescente" onClick={() => apri(v)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600 }}>
                        {v.titolo}
                        {v.origine === 'ricorrente' && <span className="etichetta-piccola">↻ {dati.ricorrenti.find((x) => x.id === v.id)?.frequenza === 'anno' ? 'ogni anno' : 'ogni mese'}</span>}
                      </span>
                      <span className="secondario piccolo">
                        {[dataBreve(v.giorno), c && c.nome !== v.titolo ? c.nome : '', v.origine === 'turno' ? 'dal turno' : '', v.origine === 'tassa' ? 'da Tasse' : '', originaleDi(v),
                          v.daIncassare ? 'da incassare' : '', futuro ? 'in programma' : ''].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                    <span className={`numeri importo ${v.tipo}`}>{segno(v.tipo)}{euro(v.importoCent)}</span>
                    {(v.origine === 'movimento' || v.origine === 'ricorrente') && (
                      <button type="button" className="elimina-task" aria-label={`Elimina ${v.titolo}`} onClick={() => void eliminaVoce(v)}>×</button>
                    )}
                  </div>
                )
              })}
            </div>
            {vociFiltrate.length > 8 && <button type="button" className="pulsante" onClick={() => setTutti(!tutti)}>{tutti ? 'Mostra meno' : `Mostra tutti (${vociFiltrate.length})`}</button>}
          </section>
        </div>

        <aside className="laterale-destra">
          <section className="scheda scheda-risparmi" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 className="titolo-sezione" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconaSalvadanaio dimensione={20} /> Risparmi</h2>
            <span className="secondario piccolo">Soldi messi da parte: non contano in "Ti restano".</span>
            {vociRisparmio.map((v) => (
              <div key={v.chiave} className="riga-semplice">
                <button type="button" className="crescente" onClick={() => apri(v)} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 600 }}>{v.titolo}</span>
                  <span className="secondario piccolo">{[dataBreve(v.giorno), v.origine === 'ricorrente' ? '↻ ogni mese' : '', dati.obiettivi?.find((o) => o.id === v.obiettivoId)?.nome].filter(Boolean).join(' · ')}</span>
                </button>
                <span className={`numeri importo ${v.tipo}`}>{segno(v.tipo)}{euro(v.importoCent)}</span>
              </div>
            ))}
            <div className="riga-azioni">
              <button type="button" className="pillola" onClick={() => setModifica({ tipo: 'prelievo' })}>Riprendi dai risparmi</button>
            </div>
            <h3 className="sottotitolo-risparmi">Obiettivi</h3>
            {risparmi.obiettivi.map(({ obiettivo: o, raccoltoCent, alMeseCent }) => (
              <button key={o.id} type="button" className="obiettivo" onClick={() => setObiettivoAperto({ o })}>
                <span className="intestazione-barra"><span style={{ fontWeight: 600 }}>{o.nome}</span><span className="numeri">{euro(raccoltoCent)} / {euro(o.importoCent)}</span></span>
                <span className="barra"><i style={{ width: `${Math.min(100, Math.max(0, (raccoltoCent / o.importoCent) * 100))}%` }} /></span>
                <span className="secondario piccolo">
                  {raccoltoCent >= o.importoCent ? 'Raggiunto!' : [o.entro ? `entro ${F.mese(msGiorno(`${o.entro}-01`))}` : '', alMeseCent ? `${euro(alMeseCent)} al mese` : ''].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
            <div className="riga-azioni"><button type="button" className="pillola" onClick={() => setObiettivoAperto({})}>+ Obiettivo</button></div>
          </section>
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

      {modifica && pronto && (modifica.tipo === 'risparmio' || modifica.tipo === 'prelievo'
        ? <FormRisparmio key={modifica.movimento?.id ?? modifica.ricorrente?.id ?? modifica.tipo} m={modifica} obiettivi={dati.obiettivi ?? []} onChiudi={() => setModifica(undefined)} onNuovoObiettivo={() => { setModifica(undefined); setObiettivoAperto({}) }} />
        : <FormMovimento key={modifica.movimento?.id ?? modifica.ricorrente?.id ?? modifica.tipo} m={{ ...modifica, tipo: modifica.tipo as TipoMovimento }} categorie={dati.categorie} onChiudi={() => setModifica(undefined)} />)}
      {obiettivoAperto && <FormObiettivo key={obiettivoAperto.o?.id ?? 'nuovo'} o={obiettivoAperto.o} onChiudi={() => setObiettivoAperto(undefined)} />}
      {esporta && <EsportaAnno anno={mese.slice(0, 4)} dati={dati} onChiudi={() => setEsporta(false)} />}
    </div>
  )
}

/* Foglio per una entrata o uscita (anche fissa, che si ripete) */

function FormMovimento({ m, categorie, onChiudi }: { m: Modifica & { tipo: TipoMovimento }; categorie: CategoriaBudget[]; onChiudi: () => void }) {
  const r = m.ricorrente, mov = m.movimento
  const [tipo, setTipo] = useState<TipoMovimento>(m.tipo)
  // Sul profilo in sterline si può scrivere un importo in euro (es. la paghetta), convertito con il cambio del giorno.
  const valutaProfilo = F.valuta()
  const altraValuta = valutaProfilo === 'GBP' ? 'EUR' : 'GBP'
  const sceltaValuta = valutaProfilo === 'GBP'
  const originale = mov ?? r
  const [valutaMov, setValutaMov] = useState<string>(originale?.valutaOriginale ?? valutaProfilo)
  const [cambioTesto, setCambioTesto] = useState(testoCambio(originale?.cambio))
  const [cercaCambio, setCercaCambio] = useState(false)
  const delTipo = categorie.filter((c) => c.tipo === tipo)
  const [b, setB] = useState({
    importo: testoImporto(originale?.importoOriginaleCent ?? mov?.importoCent ?? r?.importoCent ?? m.iniziale?.importoCent ?? 0).replace(/^0$/, ''),
    categoriaId: mov?.categoriaId ?? r?.categoriaId ?? m.iniziale?.categoriaId ?? '',
    giorno: mov?.giorno ?? r?.inizio ?? chiaveGiorno(oggi()),
    nota: mov?.nota ?? r?.descrizione ?? m.iniziale?.nota ?? '',
    ripeti: (r?.frequenza ?? 'no') as 'no' | 'mese' | 'anno',
    daIncassare: Boolean(mov?.daIncassare),
  })
  const inAltraValuta = valutaMov !== valutaProfilo
  const scritto = centesimiDa(b.importo)
  const cambio = inAltraValuta ? cambioDaTesto(cambioTesto) : 1
  const importoCent = scritto && cambio ? converti(scritto, cambio) : undefined
  const categoria = categorie.find((c) => c.id === b.categoriaId && c.tipo === tipo)
  const valido = !!importoCent && !!categoria && !!giornoDaChiave(b.giorno)

  // Il cambio del giorno si cerca da solo quando si sceglie l'altra valuta o si cambia giorno (se non scritto a mano).
  const giornoCambio = useRef<string>(originale?.cambio ? b.giorno : '')
  useEffect(() => {
    if (!inAltraValuta || giornoCambio.current === b.giorno || !giornoDaChiave(b.giorno)) return
    giornoCambio.current = b.giorno
    setCercaCambio(true)
    void cambioDelGiorno(valutaMov, valutaProfilo, b.giorno, chiaveGiorno(oggi())).then((c) => { if (c) setCambioTesto(testoCambio(c)); setCercaCambio(false) })
  }, [inAltraValuta, b.giorno, valutaMov, valutaProfilo])

  function scegliCategoria(c: CategoriaBudget) {
    // Le entrate da lavoro extra partono "da incassare" (si cambia con l'interruttore).
    setB({ ...b, categoriaId: c.id, daIncassare: !mov && tipo === 'entrata' ? Boolean(c.extra) : b.daIncassare })
  }

  async function conferma() {
    if (!valido) return
    const comuni = {
      tipo, importoCent: importoCent!, categoriaId: categoria!.id,
      valutaOriginale: inAltraValuta ? valutaMov : undefined, importoOriginaleCent: inAltraValuta ? scritto : undefined, cambio: inAltraValuta ? cambio : undefined,
    }
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
        {sceltaValuta && (
          <div className="segmenti compatti" role="radiogroup" aria-label="Valuta" style={{ alignSelf: 'flex-start' }}>
            {[valutaProfilo, altraValuta].map((v) => (
              <button key={v} type="button" role="radio" aria-checked={valutaMov === v} className={valutaMov === v ? 'attivo' : ''}
                onClick={() => { setValutaMov(v); giornoCambio.current = '' }}>{v === 'EUR' ? '€ Euro' : '£ Sterline'}</button>
            ))}
          </div>
        )}
        <label className={`campo-importo ${tipo}`}>
          <span>{tipo === 'entrata' ? '+' : '−'}</span>
          <input inputMode="decimal" autoFocus={!mov && !r} value={b.importo} placeholder="0" aria-label="Importo" onChange={(e) => setB({ ...b, importo: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') void conferma() }} />
          <span>{F.simboloDi(valutaMov)}</span>
        </label>
        {inAltraValuta && (
          <div className="riga-cambio">
            <span>1 {F.simboloDi(valutaMov)} =</span>
            <input inputMode="decimal" value={cambioTesto} placeholder={cercaCambio ? '…' : '0,86'} aria-label="Cambio" onChange={(e) => { setCambioTesto(e.target.value); giornoCambio.current = b.giorno }} />
            <span>{F.simboloValuta()}</span>
            <span className="secondario piccolo">
              {cercaCambio ? 'cerco il cambio del giorno…' : importoCent ? `≈ ${F.importo(importoCent)}` : cambio ? '' : 'senza rete: scrivi il cambio'}
            </span>
          </div>
        )}
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
        { tipo: 'data', istante: msGiorno(v.giorno) }, { tipo: 'testo', valore: { entrata: 'Entrata', uscita: 'Uscita', risparmio: 'Messo da parte', prelievo: 'Ripreso dai risparmi' }[v.tipo] },
        { tipo: 'testo', valore: categorie.get(v.categoriaId ?? '') ?? '' }, { tipo: 'testo', valore: v.titolo },
        { tipo: 'importo', centesimi: v.tipo === 'entrata' || v.tipo === 'prelievo' ? v.importoCent : -v.importoCent },
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
      righe: voci.map((v) => ({ celle: [dataBreve(v.giorno), categorie.get(v.categoriaId ?? '') ?? '', v.titolo, `${segno(v.tipo)}${euro(v.importoCent)}`] })),
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
                <span className="secondario piccolo">{F.simboloValuta()}</span>
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


/* Risparmi: metti da parte o riprendi */

function FormRisparmio({ m, obiettivi, onChiudi, onNuovoObiettivo }: { m: Modifica; obiettivi: ObiettivoRisparmio[]; onChiudi: () => void; onNuovoObiettivo: () => void }) {
  const r = m.ricorrente, mov = m.movimento
  const [tipo, setTipo] = useState<'risparmio' | 'prelievo'>(m.tipo === 'prelievo' ? 'prelievo' : 'risparmio')
  const [b, setB] = useState({
    importo: testoImporto(mov?.importoCent ?? r?.importoCent ?? 0).replace(/^0$/, ''),
    obiettivoId: mov?.obiettivoId ?? r?.obiettivoId ?? '',
    giorno: mov?.giorno ?? r?.inizio ?? chiaveGiorno(oggi()),
    nota: mov?.nota ?? r?.descrizione ?? '',
    ripeti: (r?.frequenza ?? 'no') as 'no' | 'mese' | 'anno',
  })
  const importoCent = centesimiDa(b.importo)
  const valido = !!importoCent && !!giornoDaChiave(b.giorno)
  async function conferma() {
    if (!valido) return
    const comuni = { tipo, importoCent: importoCent!, categoriaId: CATEGORIA_RISPARMI, obiettivoId: b.obiettivoId || undefined }
    if (b.ripeti !== 'no' && tipo === 'risparmio') {
      await salva('ricorrenti', { ...r, ...comuni, descrizione: b.nota.trim(), frequenza: b.ripeti, inizio: b.giorno })
      if (mov) await elimina('movimenti', mov.id)
    } else {
      await salva('movimenti', { ...mov, ...comuni, giorno: b.giorno, nota: b.nota.trim() || undefined })
      if (r) await elimina('ricorrenti', r.id)
    }
    onChiudi()
  }
  return (
    <Foglio aperto titolo={tipo === 'risparmio' ? 'Metti da parte' : 'Riprendi dai risparmi'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <div className="segmenti" role="radiogroup" aria-label="Tipo">
          {(['risparmio', 'prelievo'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={tipo === t} className={tipo === t ? 'attivo' : ''} onClick={() => setTipo(t)}>
              {t === 'risparmio' ? 'Metti da parte' : 'Riprendi'}
            </button>
          ))}
        </div>
        <label className={`campo-importo ${tipo}`}>
          <IconaSalvadanaio dimensione={30} />
          <input inputMode="decimal" autoFocus={!mov && !r} value={b.importo} placeholder="0" aria-label="Importo in euro" onChange={(e) => setB({ ...b, importo: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') void conferma() }} />
          <span>{F.simboloValuta()}</span>
        </label>
        <div className="campo">
          <span>{tipo === 'risparmio' ? 'Per un obiettivo (facoltativo)' : 'Da quale obiettivo (facoltativo)'}</span>
          <div className="riga-azioni" role="group" aria-label="Obiettivo">
            <button type="button" className="pillola" aria-pressed={!b.obiettivoId} onClick={() => setB({ ...b, obiettivoId: '' })}
              style={!b.obiettivoId ? { background: '#DCEAF7', borderColor: COLORE_RISPARMI, fontWeight: 700 } : undefined}>Nessuno</button>
            {obiettivi.map((o) => (
              <button key={o.id} type="button" className="pillola" aria-pressed={b.obiettivoId === o.id} onClick={() => setB({ ...b, obiettivoId: o.id })}
                style={b.obiettivoId === o.id ? { background: '#DCEAF7', borderColor: COLORE_RISPARMI, fontWeight: 700 } : undefined}>{o.nome}</button>
            ))}
            <button type="button" className="pillola" onClick={onNuovoObiettivo}>+ Nuovo obiettivo</button>
          </div>
        </div>
        <div className="campi-affiancati">
          <Campo etichetta={b.ripeti === 'no' ? 'Giorno' : 'Dal giorno'}><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
          {tipo === 'risparmio' && (
            <Campo etichetta="Si ripete">
              <select value={b.ripeti} onChange={(e) => setB({ ...b, ripeti: e.target.value as 'no' | 'mese' | 'anno' })}>
                <option value="no">No</option><option value="mese">Ogni mese</option><option value="anno">Ogni anno</option>
              </select>
            </Campo>
          )}
        </div>
        <Campo etichetta="Nota (facoltativa)"><input value={b.nota} placeholder={tipo === 'prelievo' ? 'es. per l\'auto' : ''} onChange={(e) => setB({ ...b, nota: e.target.value })} /></Campo>
        {(mov || r) && (
          <button type="button" className="pulsante pericolo" onClick={() => void (async () => {
            if (mov) { await elimina('movimenti', mov.id); mostraAvviso('Eliminato', () => void ripristina('movimenti', mov.id)) }
            if (r) { await elimina('ricorrenti', r.id); mostraAvviso('Eliminato in tutti i mesi', () => void ripristina('ricorrenti', r.id)) }
            onChiudi()
          })()}>{r ? 'Elimina in tutti i mesi' : 'Elimina'}</button>
        )}
      </div>
    </Foglio>
  )
}

function FormObiettivo({ o, onChiudi }: { o?: ObiettivoRisparmio; onChiudi: () => void }) {
  const [nome, setNome] = useState(o?.nome ?? '')
  const [importo, setImporto] = useState(o ? testoImporto(o.importoCent) : '')
  const [entro, setEntro] = useState(o?.entro ?? '')
  const importoCent = centesimiDa(importo)
  const valido = nome.trim() !== '' && !!importoCent
  async function conferma() {
    if (!valido) return
    await salva('obiettiviRisparmio', { ...o, nome: nome.trim(), importoCent: importoCent!, entro: /^\d{4}-\d{2}$/.test(entro) ? entro : undefined })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={o ? 'Obiettivo' : 'Nuovo obiettivo'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={nome} autoFocus={!o} placeholder="es. Vacanza estate, Fondo emergenze" onChange={(e) => setNome(e.target.value)} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta={`Quanto (${F.simboloValuta()})`}><input inputMode="decimal" value={importo} placeholder="es. 2000" onChange={(e) => setImporto(e.target.value)} /></Campo>
          <Campo etichetta="Entro (facoltativo)"><input type="month" value={entro} onChange={(e) => setEntro(e.target.value)} /></Campo>
        </div>
        <span className="secondario piccolo">Quando metti da parte dei soldi, scegli questo obiettivo: la barra mostra a che punto sei e quanto serve al mese.</span>
        {o && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('obiettiviRisparmio', o.id).then(() => { onChiudi(); mostraAvviso(`Eliminato: ${o.nome}`, () => void ripristina('obiettiviRisparmio', o.id)) })}>
            Elimina l'obiettivo (i soldi restano nei risparmi)
          </button>
        )}
      </div>
    </Foglio>
  )
}

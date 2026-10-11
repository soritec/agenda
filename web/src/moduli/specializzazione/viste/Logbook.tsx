import { useEffect, useMemo, useRef, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elenca, elimina, nuovoId, ripristina, salva } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Procedura, TipoProcedura } from '../../../dati/modello'
import { blobCSV, type TabellaExport } from '../../../export/csv'
import { condividiOScarica, creaPdf, scarica, type RigaPdf } from '../../../export/pdf'
import { Allegati } from '../../../interfaccia/Allegati'
import { EtichetteAllegati } from '../../../interfaccia/Visualizzatore'
import { Avviso, Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { chiaveGiorno, giornoDaChiave, oggi, perId } from '../../turni/supporto'
import {
  ANNI_PREDEFINITI, annoDiCorso, conteggi, nelFiltro, RUOLI, ruoloDa, settimaneValide, TITOLI_RUOLO, type FiltroCategoria, type Ruolo,
} from '../logica'

export const AVVISO_REFERTO = 'Allega solo documenti senza dati che identificano la paziente (nome, codice fiscale, data di nascita, indirizzo): oscurali prima.'
const CATEGORIE: { id: FiltroCategoria; titolo: string }[] = [
  { id: 'tutte', titolo: 'Tutte' }, { id: 'chirurgiche', titolo: 'Chirurgiche' }, { id: 'nonChirurgiche', titolo: 'Non chirurgiche' },
]

const dataBreve = (giorno: string) => {
  const g = giornoDaChiave(giorno)
  return g ? F.dataBreve(istante(g.anno, g.mese, g.giorno, 12)) : giorno
}

interface RigaTabella { id: string; nome: string; primo: number; secondo: number; osservatore: number; totale: number; chirurgica: boolean }

export function Logbook({ apriNuova }: { apriNuova: boolean }) {
  const procedure = useCollezione('procedure')
  const tipi = useCollezione('tipiProcedura')
  const impostazioni = useImpostazioni()
  const [anno, setAnno] = useState<number>()
  const [categoria, setCategoria] = useState<FiltroCategoria>('tutte')
  const [modifica, setModifica] = useState<{ record?: Procedura } | undefined>(apriNuova ? {} : undefined)
  const [esporta, setEsporta] = useState(false)
  const [mostrate, setMostrate] = useState(30)

  const anni = impostazioni?.anniSpecializzazione ?? ANNI_PREDEFINITI
  const mappaTipi = useMemo(() => perId(tipi), [tipi])
  const nellaCategoria = useMemo(() => (procedure ?? []).filter((p) => nelFiltro(mappaTipi.get(p.tipoId), categoria)), [procedure, mappaTipi, categoria])
  const c = useMemo(() => conteggi(nellaCategoria, anno), [nellaCategoria, anno])
  const righe: RigaTabella[] = useMemo(() => [...c.perTipo.entries()]
    .map(([id, r]) => ({ id, nome: mappaTipi.get(id)?.nome ?? '—', ...r, totale: r.primo + r.secondo + r.osservatore, chirurgica: Boolean(mappaTipi.get(id)?.chirurgica) }))
    .sort((a, b) => b.totale - a.totale || a.nome.localeCompare(b.nome)), [c, mappaTipi])
  const gruppi = categoria === 'tutte'
    ? [{ titolo: 'Chirurgiche', righe: righe.filter((r) => r.chirurgica) }, { titolo: 'Non chirurgiche', righe: righe.filter((r) => !r.chirurgica) }].filter((g) => g.righe.length)
    : [{ titolo: '', righe }]
  const elenco = useMemo(() => [...nellaCategoria]
    .filter((p) => anno === undefined || p.annoCorso === anno)
    .sort((a, b) => b.giorno.localeCompare(a.giorno) || b.creatoIl - a.creatoIl), [nellaCategoria, anno])

  const descrizioneFiltro = [anno ? `${anno}° anno` : 'Tutti gli anni', categoria === 'tutte' ? '' : CATEGORIE.find((x) => x.id === categoria)!.titolo.toLowerCase()].filter(Boolean).join(' · ')

  async function esportaPdf(azione: 'scarica' | 'condividi') {
    const somma = (rr: RigaTabella[], k: 'primo' | 'secondo' | 'osservatore' | 'totale') => rr.reduce((s, r) => s + r[k], 0)
    const righePdf: RigaPdf[] = gruppi.flatMap((g) => [
      ...(g.titolo ? [{ celle: [g.titolo, String(somma(g.righe, 'primo')), String(somma(g.righe, 'secondo')), String(somma(g.righe, 'osservatore')), String(somma(g.righe, 'totale'))], colore: [233, 228, 220] as [number, number, number] }] : []),
      ...g.righe.map((r) => ({ celle: [r.nome, String(r.primo), String(r.secondo), String(r.osservatore), String(r.totale)] })),
    ])
    const blob = await creaPdf({
      titolo: 'Logbook della specializzazione',
      sottotitolo: `${descrizioneFiltro} · aggiornato ${F.dataEstesa(Date.now())}`,
      riepilogo: [
        { etichetta: 'procedure', valore: String(c.totale) },
        ...RUOLI.map((r) => ({ etichetta: TITOLI_RUOLO[r].toLowerCase(), valore: String(c.perRuolo[r]) })),
      ],
      intestazioni: ['Procedura', '1° operatore', '2° operatore', 'Osservatore', 'Totale'],
      righe: righePdf,
      colonneGrassetto: [0, 4], colonnaColore: 0, colonneDestra: [1, 2, 3, 4],
      totaleTabella: ['Totale', String(c.perRuolo.primo), String(c.perRuolo.secondo), String(c.perRuolo.osservatore), String(c.totale)],
      piede: 'Agenda · logbook con soli dati anonimi',
    })
    const nome = `Logbook ${descrizioneFiltro}.pdf`
    if (azione === 'scarica') scarica(blob, nome)
    else await condividiOScarica(blob, nome, 'Logbook')
  }

  function esportaCsv() {
    const tabella: TabellaExport = {
      titolo: 'Logbook',
      intestazioni: ['Data', 'Procedura', 'Categoria', 'Ruolo', 'Anno di corso', 'Età', 'Settimane', 'Esito', 'Note'],
      righe: elenco.map((p) => [
        { tipo: 'testo', valore: p.giorno.split('-').reverse().join('/') },
        { tipo: 'testo', valore: mappaTipi.get(p.tipoId)?.nome ?? '' },
        { tipo: 'testo', valore: mappaTipi.get(p.tipoId)?.chirurgica ? 'Chirurgica' : 'Non chirurgica' },
        { tipo: 'testo', valore: TITOLI_RUOLO[ruoloDa(p.ruolo)] },
        { tipo: 'intero', valore: p.annoCorso },
        p.eta !== undefined ? { tipo: 'intero', valore: p.eta } : { tipo: 'vuota' },
        { tipo: 'testo', valore: p.settimane ?? '' },
        { tipo: 'testo', valore: p.esito ?? '' },
        { tipo: 'testo', valore: p.note ?? '' },
      ]),
    }
    scarica(blobCSV(tabella), `Logbook ${descrizioneFiltro}.csv`)
  }

  const pillola = (attiva: boolean) => (attiva ? { background: 'var(--primario)', color: 'var(--primario-testo)', borderColor: 'transparent' } : undefined)

  return (
    <div className="schermata">
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">Logbook</h1>
        </div>
        <div className="riga-azioni">
          <button type="button" className="pulsante" onClick={() => setEsporta(true)}>Esporta</button>
          <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ Procedura</button>
        </div>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div role="group" aria-label="Categoria" className="riga-azioni">
          {CATEGORIE.map((x) => (
            <button key={x.id} type="button" className="pillola" aria-pressed={categoria === x.id} onClick={() => setCategoria(x.id)} style={pillola(categoria === x.id)}>{x.titolo}</button>
          ))}
        </div>
        <div role="group" aria-label="Anno di corso" className="riga-azioni">
          {[undefined, ...Array.from({ length: anni }, (_, i) => i + 1)].map((a) => (
            <button key={a ?? 'tutti'} type="button" className="pillola" aria-pressed={anno === a} onClick={() => setAnno(a)} style={pillola(anno === a)}>
              {a ? `${a}°${c.perAnno.get(a) ? ` · ${c.perAnno.get(a)}` : ''}` : 'Tutti gli anni'}
            </button>
          ))}
        </div>
      </div>

      <div className="tessere">
        <div className="tessera"><span className="valore">{c.totale}</span><span className="secondario piccolo">procedure</span></div>
        {RUOLI.map((r) => (
          <div key={r} className="tessera"><span className="valore">{c.perRuolo[r]}</span><span className="secondario piccolo">{TITOLI_RUOLO[r].toLowerCase()}</span></div>
        ))}
      </div>

      <section style={{ overflowX: 'auto' }}>
        <table className="tabella-stampa tabella-logbook">
          <thead>
            <tr><th>Procedura</th><th className="num">1° op.</th><th className="num">2° op.</th><th className="num">Oss.</th><th className="num">Tot.</th></tr>
          </thead>
          <tbody>
            {righe.length === 0 && <tr><td colSpan={5} className="secondario">Nessuna procedura con questi filtri.</td></tr>}
            {gruppi.map((g) => [
              g.titolo && (
                <tr key={`g-${g.titolo}`} className="riga-gruppo">
                  <td colSpan={4}>{g.titolo}</td>
                  <td className="num">{g.righe.reduce((s, r) => s + r.totale, 0)}</td>
                </tr>
              ),
              ...g.righe.map((r) => (
                <tr key={r.id}>
                  <td><a href={`#/specializzazione/procedura/${r.id}`} style={{ fontWeight: 600, color: 'var(--testo)' }}>{r.nome}</a></td>
                  <td className="num">{r.primo || ''}</td>
                  <td className="num">{r.secondo || ''}</td>
                  <td className="num">{r.osservatore || ''}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.totale}</td>
                </tr>
              )),
            ])}
          </tbody>
        </table>
        <span className="secondario piccolo">Tocca il nome di una procedura per link, appunti e allegati.</span>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Ultime registrate</h2>
        <div className="lista">
          {elenco.length === 0 && <div className="vuoto">Ancora niente qui.</div>}
          {elenco.slice(0, mostrate).map((p) => (
            <div key={p.id} className="riga" style={{ cursor: 'default', alignItems: 'flex-start' }}>
              <span className="secondario piccolo numeri" style={{ width: 64, flexShrink: 0, paddingTop: 2 }}>{dataBreve(p.giorno)}</span>
              <span className="crescente">
                <button type="button" onClick={() => setModifica({ record: p })}
                  style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 500 }}>{mappaTipi.get(p.tipoId)?.nome ?? '—'}</span>
                  <span className="secondario piccolo">
                    {[TITOLI_RUOLO[ruoloDa(p.ruolo)], `${p.annoCorso}° anno`, p.eta !== undefined ? `${p.eta} anni` : '', p.settimane ? `${p.settimane} sett.` : '', p.esito ?? ''].filter(Boolean).join(' · ')}
                  </span>
                </button>
                <EtichetteAllegati collegatoA={`procedura:${p.id}`} />
              </span>
              <button type="button" className="elimina-riga" aria-label="Elimina"
                onClick={() => void elimina('procedure', p.id).then(() => mostraAvviso('Procedura eliminata', () => void ripristina('procedure', p.id)))}>×</button>
            </div>
          ))}
        </div>
        {elenco.length > mostrate && <button type="button" className="pulsante" onClick={() => setMostrate((n) => n + 50)}>Mostra altre</button>}
      </section>

      <Foglio aperto={esporta} titolo="Esporta il logbook" onChiudi={() => setEsporta(false)}>
        <p className="secondario" style={{ margin: 0 }}>Con i filtri attuali: {descrizioneFiltro}.</p>
        <div className="scelte-rapide">
          <button type="button" className="scelta-rapida" onClick={() => { setEsporta(false); void esportaPdf('scarica') }}><span className="nome"><strong>PDF</strong><br /><span className="orario">riepilogo per il libretto</span></span></button>
          <button type="button" className="scelta-rapida" onClick={() => { setEsporta(false); esportaCsv() }}><span className="nome"><strong>Excel (CSV)</strong><br /><span className="orario">elenco di tutte le procedure</span></span></button>
          {'share' in navigator && (
            <button type="button" className="scelta-rapida" onClick={() => { setEsporta(false); void esportaPdf('condividi') }}><span className="nome"><strong>Condividi PDF</strong><br /><span className="orario">Mail, WhatsApp, File…</span></span></button>
          )}
        </div>
      </Foglio>

      {modifica && (
        <FormProcedura record={modifica.record} inizio={impostazioni?.inizioSpecializzazione} anni={anni} onChiudi={() => setModifica(undefined)} />
      )}
    </div>
  )
}

function FormProcedura({ record, inizio, anni, onChiudi }: { record?: Procedura; inizio?: string; anni: number; onChiudi: () => void }) {
  const tipi = useCollezione('tipiProcedura')
  // L'id esiste già prima del salvataggio, così si possono allegare file anche a una procedura nuova.
  const id = useRef(record?.id ?? nuovoId()).current
  const [giorno, setGiorno] = useState(record?.giorno ?? chiaveGiorno(oggi()))
  const [tipoId, setTipoId] = useState(record?.tipoId ?? '')
  const [ruolo, setRuolo] = useState<Ruolo>(record ? ruoloDa(record.ruolo) : 'primo')
  const annoAutomatico = annoDiCorso(inizio, giorno, anni)
  const [annoScelto, setAnnoScelto] = useState<number | undefined>(record?.annoCorso)
  const [eta, setEta] = useState(record?.eta?.toString() ?? '')
  const [settimane, setSettimane] = useState(record?.settimane ?? '')
  const [esito, setEsito] = useState(record?.esito ?? '')
  const [note, setNote] = useState(record?.note ?? '')
  const [filtro, setFiltro] = useState('')

  useEffect(() => { if (!record) setAnnoScelto(undefined) }, [giorno, record])
  const annoCorso = annoScelto ?? annoAutomatico ?? 1
  const etaNumero = eta.trim() === '' ? undefined : Number(eta)
  const etaValida = etaNumero === undefined || (Number.isInteger(etaNumero) && etaNumero >= 10 && etaNumero <= 70)
  const settimaneOk = settimane.trim() === '' || settimaneValide(settimane)
  const valido = !!giornoDaChiave(giorno) && tipoId !== '' && etaValida && settimaneOk

  const ordinati = [...(tipi ?? [])].sort((a, b) => a.ordine - b.ordine)
    .filter((t) => !filtro.trim() || t.nome.toLowerCase().includes(filtro.trim().toLowerCase()))
  const gruppiTipi: { titolo: string; tipi: TipoProcedura[] }[] = [
    { titolo: 'Chirurgiche', tipi: ordinati.filter((t) => t.chirurgica) },
    { titolo: 'Non chirurgiche', tipi: ordinati.filter((t) => !t.chirurgica) },
  ].filter((g) => g.tipi.length)

  async function conferma() {
    if (!valido) return
    await salva('procedure', {
      ...record, id, giorno, tipoId, ruolo, annoCorso,
      eta: etaNumero, settimane: settimane.trim().replace(/\s+/g, '') || undefined, esito: esito.trim() || undefined, note: note.trim() || undefined,
    })
    onChiudi()
    if (!record) mostraAvviso('Procedura aggiunta al logbook')
  }

  async function annulla() {
    // Procedura nuova non salvata: si tolgono gli allegati aggiunti nel frattempo.
    if (!record) for (const a of (await elenca('allegati')).filter((x) => x.collegatoA === `procedura:${id}`)) await elimina('allegati', a.id)
    onChiudi()
  }

  return (
    <Foglio aperto titolo={record ? 'Procedura' : 'Nuova procedura'} onChiudi={() => void annulla()}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <div className="campi-affiancati">
          <Campo etichetta="Data"><input type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} /></Campo>
          <Campo etichetta={annoAutomatico ? 'Anno di corso (automatico)' : 'Anno di corso'}>
            <select value={annoCorso} onChange={(e) => setAnnoScelto(Number(e.target.value))}>
              {Array.from({ length: anni }, (_, i) => i + 1).map((a) => <option key={a} value={a}>{a}° anno</option>)}
            </select>
          </Campo>
        </div>

        <div className="campo">
          <span>Procedura</span>
          {(tipi ?? []).length > 10 && (
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Cerca…"
              style={{ minHeight: 38, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--linea-forte)', background: 'var(--superficie)' }} />
          )}
          {gruppiTipi.map((g) => (
            <div key={g.titolo} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span className="secondario piccolo">{g.titolo}</span>
              <div className="scelte-rapide">
                {g.tipi.map((t) => (
                  <button key={t.id} type="button" className="scelta-rapida" aria-pressed={tipoId === t.id} onClick={() => setTipoId(t.id)}
                    style={tipoId === t.id ? { borderColor: 'var(--primario)', borderWidth: 2, background: 'var(--accento-tenue)', fontWeight: 600 } : undefined}>
                    <span className="nome">{t.nome}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <a href="#/specializzazione/impostazioni" className="piccolo" onClick={onChiudi}>Modifica l'elenco delle procedure</a>
        </div>

        <div className="campo">
          <span>Ruolo</span>
          <div role="group" aria-label="Ruolo" className="riga-azioni">
            {RUOLI.map((r) => (
              <button key={r} type="button" className="pillola" aria-pressed={ruolo === r} onClick={() => setRuolo(r)}
                style={ruolo === r ? { background: 'var(--primario)', color: 'var(--primario-testo)', borderColor: 'transparent', height: 36 } : { height: 36 }}>
                {TITOLI_RUOLO[r]}
              </button>
            ))}
          </div>
        </div>

        <details open={Boolean(record?.eta || record?.settimane || record?.esito || record?.note)}>
          <summary style={{ cursor: 'pointer', color: 'var(--accento)' }}>Dati anonimi facoltativi</summary>
          <div className="modulo" style={{ marginTop: 10 }}>
            <div className="campi-affiancati">
              <Campo etichetta="Età della paziente"><input inputMode="numeric" value={eta} placeholder="es. 32" onChange={(e) => setEta(e.target.value)} /></Campo>
              <Campo etichetta="Settimane"><input value={settimane} placeholder="es. 39+2" onChange={(e) => setSettimane(e.target.value)} /></Campo>
            </div>
            {!etaValida && <Avviso>Scrivi l'età in anni (solo il numero).</Avviso>}
            {!settimaneOk && <Avviso>Scrivi le settimane come 39+2 oppure 39.</Avviso>}
            <Campo etichetta="Esito"><input value={esito} placeholder="es. regolare" onChange={(e) => setEsito(e.target.value)} /></Campo>
            <Campo etichetta="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Campo>
            <NotaPrivacy />
          </div>
        </details>

        <div className="campo">
          <span>Allegati (es. referto dell'intervento)</span>
          <Allegati collegatoA={`procedura:${id}`} avvisoPrivacy={AVVISO_REFERTO} />
        </div>

        {record && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('procedure', record.id).then(() => { onChiudi(); mostraAvviso('Procedura eliminata', () => void ripristina('procedure', record.id)) })}>
            Elimina
          </button>
        )}
      </div>
    </Foglio>
  )
}

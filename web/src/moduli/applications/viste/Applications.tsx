import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva, salvaImpostazioni } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Application } from '../../../dati/modello'
import { Avviso, Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { IconaLink, IconaPiu, IconaScintille } from '../../../interfaccia/icone'
import { leggiChiave, valutaStudio } from '../../studio/ai'
import { centesimiDaTesto, chiaveGiorno, giornoDaChiave, oggi, testoDaCentesimi } from '../../turni/supporto'
import {
  CATEGORIE_VOTO, cambiaPassi, COLORI_STUDIO, coloreVoto, fase, leggiValutazioni, linkStudio, ordinaApplications, PASSI_PREDEFINITI, PORTALI,
  PROGRAMMI, programmaDa, prossimaScadenza, TITOLI_PROGRAMMA, toccaPasso, VOTI, type Programma,
} from '../logica'

const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const dataBreve = (g: string) => F.dataBreve(msGiorno(g))
const orario = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
const giorniTra = (da: string, a: string) => Math.round((msGiorno(a) - msGiorno(da)) / 86_400_000)
const sterline = (cent: number) => F.importoIn(cent, 'GBP').replace(/,00(?=\s|$)/, '')

/** Application agli studi legali, con la barra dei passi a pallini e le valutazioni degli studi. */
export function Applications() {
  const applications = useCollezione('applications')
  const impostazioni = useImpostazioni()
  const [filtro, setFiltro] = useState<'tutte' | Programma>('tutte')
  const [aperta, setAperta] = useState<{ a?: Application }>()
  const oggiChiave = chiaveGiorno(oggi())
  const passiPredefiniti = impostazioni?.passiApplication?.length ? impostazioni.passiApplication : PASSI_PREDEFINITI
  const tutte = applications ?? []
  const elenco = ordinaApplications(tutte.filter((a) => filtro === 'tutte' || programmaDa(a.programma) === filtro))
  const programmiUsati = PROGRAMMI.filter((p) => tutte.some((a) => programmaDa(a.programma) === p))
  const conta = (f: ReturnType<typeof fase>) => tutte.filter((a) => fase(a) === f).length

  return (
    <div className="schermata applications" style={{ maxWidth: 900 }}>
      <header className="intestazione">
        <div>
          <div className="sopratitolo">{tutte.length ? `${conta('daScrivere')} da scrivere · ${conta('inCorso')} in corso · ${conta('offerta')} ${conta('offerta') === 1 ? 'offerta' : 'offerte'}` : 'Vacation scheme e training contract'}</div>
          <h1 className="titolo-grande">Applications</h1>
        </div>
        <button type="button" className="pulsante primario" onClick={() => setAperta({})}>+ Application</button>
      </header>

      {programmiUsati.length > 1 && (
        <div className="filtri-agenda">
          {(['tutte', ...programmiUsati] as const).map((p) => (
            <button key={p} type="button" className={`pillola${filtro === p ? ' filtro-attivo' : ''}`} onClick={() => setFiltro(p)}>{p === 'tutte' ? 'Tutte' : TITOLI_PROGRAMMA[p]}</button>
          ))}
        </div>
      )}

      <div className="lista">
        {tutte.length === 0 && <div className="vuoto">Aggiungi la prima application: studio, programma e deadline. La deadline compare anche in Agenda.</div>}
        {elenco.map((a) => <SchedaApplication key={a.id} a={a} oggiChiave={oggiChiave} passiPredefiniti={passiPredefiniti} onApri={() => setAperta({ a })} />)}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Valuta gli studi legali</h2>
        <div className="riga-azioni" style={{ gap: 6 }}>
          {PORTALI.map((p) => <a key={p.url} className="pillola" href={p.url} target="_blank" rel="noreferrer"><IconaLink dimensione={14} /> {p.titolo}</a>)}
        </div>
      </section>

      {aperta && <FormApplication a={aperta.a} passiPredefiniti={passiPredefiniti} numero={tutte.length} onChiudi={() => setAperta(undefined)} />}
    </div>
  )
}

function SchedaApplication({ a, oggiChiave, passiPredefiniti, onApri }: { a: Application; oggiChiave: string; passiPredefiniti: string[]; onApri: () => void }) {
  const [modificaPassi, setModificaPassi] = useState(false)
  const [voti, setVoti] = useState(false)
  const f = fase(a)
  const prossima = prossimaScadenza(a)
  const mancano = prossima ? giorniTra(oggiChiave, prossima.giorno) : undefined
  const link = linkStudio(a.studio)

  return (
    <div className={`riga application${f === 'nonPassata' ? ' conclusa' : ''}`} style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 0 }}>
      <div className="testa-application">
        <button type="button" className="nome-studio" style={{ color: a.colore }} onClick={onApri}>{a.studio}</button>
        <span className="etichetta-programma">{TITOLI_PROGRAMMA[programmaDa(a.programma)]}{a.dettaglio ? ` · ${a.dettaglio}` : ''}</span>
        {f === 'offerta' && <span className="etichetta-programma esito-offerta">Offerta</span>}
        {f === 'nonPassata' && <span className="etichetta-programma esito-no">Non passata</span>}
        <span className="crescente" />
        <button type="button" className="pillola piccola" onClick={() => setModificaPassi(!modificaPassi)}>{modificaPassi ? 'Fatto' : 'Modifica i passi'}</button>
        <button type="button" className="elimina-task" aria-label={`Elimina ${a.studio}`}
          onClick={() => void elimina('applications', a.id).then(() => mostraAvviso(`Eliminata: ${a.studio}`, () => void ripristina('applications', a.id)))}>×</button>
      </div>
      {(prossima || a.rolling) && (
        <span className={`scadenza-application${mancano !== undefined && mancano < 0 ? ' passata' : ''}`}>
          {prossima
            ? `${prossima.cosa === 'deadline' ? 'Deadline' : prossima.cosa} ${dataBreve(prossima.giorno)}${prossima.minuto !== undefined ? `, ${orario(prossima.minuto)}` : ''} · ${mancano === 0 ? 'oggi' : mancano === 1 ? 'domani' : mancano! > 1 ? `tra ${mancano} giorni` : 'passata'}`
            : 'Rolling: meglio inviarla presto'}
        </span>
      )}

      <Pallini a={a} />
      {modificaPassi && <ModificaPassi a={a} passiPredefiniti={passiPredefiniti} />}

      <div className="piede-application">
        <button type="button" className={`apri-valutazioni${voti ? ' aperto' : ''}`} aria-expanded={voti} onClick={() => setVoti(!voti)}>
          Valutazioni{a.tcCent ? ` · TC ${sterline(a.tcCent)}` : ''}{a.nqCent ? ` · NQ ${sterline(a.nqCent)}` : ''}
        </button>
        <span className="riga-azioni" style={{ gap: 4 }}>
          <a className="pillola piccola" href={link.legalCheek} target="_blank" rel="noreferrer">Legal Cheek</a>
          <a className="pillola piccola" href={link.chambers} target="_blank" rel="noreferrer">Chambers</a>
          <a className="pillola piccola" href={link.glassdoor} target="_blank" rel="noreferrer">Glassdoor</a>
        </span>
      </div>
      {voti && <Valutazioni a={a} />}
    </div>
  )
}

/** Barra dei passi: un tocco riempie il pallino (e quelli prima); ritoccando l'ultimo pieno si svuota. */
function Pallini({ a }: { a: Application }) {
  return (
    <div className="pallini-application" role="group" aria-label="Passi della selezione">
      {a.passi.map((p, i) => {
        const stato = a.nonPassata && i === a.fatti ? ' no' : i < a.fatti ? ' fatto' : i === a.fatti ? ' prossimo' : ''
        const data = a.datePassi?.[p]
        return (
          <button key={`${p}-${i}`} type="button" className={`passo-application${stato}`} aria-pressed={i < a.fatti} aria-label={p}
            onClick={() => void salva('applications', { ...a, fatti: toccaPasso(a.fatti, i), nonPassata: undefined })}>
            <span className="pallino" />
            <span className="nome-passo">{p}</span>
            {data && <span className="data-passo">{dataBreve(data.giorno)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function ModificaPassi({ a, passiPredefiniti }: { a: Application; passiPredefiniti: string[] }) {
  const [nuovo, setNuovo] = useState('')
  const [dopo, setDopo] = useState(String(a.passi.length - 2))
  const salvaPassi = (passi: string[]) => salva('applications', { ...a, ...cambiaPassi(a, passi) })
  function aggiungi() {
    const nome = nuovo.trim()
    if (!nome || a.passi.includes(nome)) return
    const i = Math.min(a.passi.length, Number(dopo) + 1)
    void salvaPassi([...a.passi.slice(0, i), nome, ...a.passi.slice(i)])
    setNuovo('')
  }
  return (
    <div className="modifica-passi">
      {a.passi.map((p, i) => (
        <div key={`${p}-${i}`} className="riga-passo">
          <input defaultValue={p} aria-label="Nome del passo"
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== p && !a.passi.includes(v)) void salvaPassi(a.passi.map((x, j) => (j === i ? v : x))) }} />
          <button type="button" className="elimina-task" aria-label={`Togli ${p}`}
            onClick={() => { const prima = a; void salvaPassi(a.passi.filter((_, j) => j !== i)).then(() => mostraAvviso(`Tolto: ${p}`, () => void salva('applications', prima))) }}>×</button>
        </div>
      ))}
      <div className="aggiunta-veloce">
        <input value={nuovo} placeholder="Nuovo passo (es. Partner interview)" onChange={(e) => setNuovo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') aggiungi() }} />
        <select value={dopo} onChange={(e) => setDopo(e.target.value)} aria-label="Dove metterlo" className="data-piccola">
          <option value="-1">all'inizio</option>
          {a.passi.map((p, i) => <option key={`${p}-${i}`} value={i}>dopo {p}</option>)}
        </select>
        <button type="button" className="pulsante primario" disabled={!nuovo.trim()} onClick={aggiungi}>Aggiungi</button>
      </div>
      <div className="riga-azioni" style={{ gap: 8 }}>
        <button type="button" className="link piccolo" onClick={() => void salvaImpostazioni({ passiApplication: a.passi }).then(() => mostraAvviso('Passi salvati per le nuove application'))}>
          Usa questi passi per le nuove application
        </button>
        {a.passi.join('|') !== passiPredefiniti.join('|') && (
          <button type="button" className="link piccolo" onClick={() => void salvaPassi(passiPredefiniti)}>Rimetti i passi predefiniti</button>
        )}
      </div>
    </div>
  )
}

function Valutazioni({ a }: { a: Application }) {
  const [cerco, setCerco] = useState(false)
  const [errore, setErrore] = useState<string>()
  async function cercaConGemini() {
    setCerco(true); setErrore(undefined)
    try {
      const v = leggiValutazioni(await valutaStudio(a.studio, CATEGORIE_VOTO))
      if (!v || (!Object.keys(v.voti).length && !v.tcCent && !v.nqCent)) throw new Error('Gemini non ha trovato valutazioni per questo studio: controlla il nome o inseriscile a mano.')
      await salva('applications', { ...a, voti: { ...a.voti, ...v.voti }, tcCent: v.tcCent ?? a.tcCent, nqCent: v.nqCent ?? a.nqCent, votiIl: chiaveGiorno(oggi()), votiDaGemini: true })
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Qualcosa non ha funzionato.') }
    setCerco(false)
  }
  const prossimoVoto = (v?: string) => (v ? (VOTI.indexOf(v) + 1 < VOTI.length ? VOTI[VOTI.indexOf(v) + 1] : undefined) : VOTI[0])
  return (
    <div className="valutazioni-application">
      <div className="riga-azioni" style={{ justifyContent: 'space-between' }}>
        <span className="secondario piccolo">
          {a.votiIl ? `${a.votiDaGemini ? 'Trovate da Gemini' : 'Aggiornate'} il ${dataBreve(a.votiIl)}${a.votiDaGemini ? ' · da verificare' : ''}` : 'Tocca un voto per cambiarlo (A*, A, B, C, D, vuoto).'}
        </span>
        {leggiChiave()
          ? <button type="button" className="pillola" disabled={cerco} onClick={() => void cercaConGemini()}><IconaScintille dimensione={14} /> {cerco ? 'Cerco…' : 'Cerca con Gemini'}</button>
          : <a className="pillola" href="#/studio">Collega Gemini in Studio</a>}
      </div>
      {errore && <Avviso>{errore}</Avviso>}
      <div className="griglia-voti">
        {CATEGORIE_VOTO.map((c) => {
          const v = a.voti?.[c]
          const [sfondo, testo] = coloreVoto(v)
          return (
            <button key={c} type="button" className="voce-voto" onClick={() => {
              const nuovi = { ...a.voti }
              const p = prossimoVoto(v)
              if (p) nuovi[c] = p; else delete nuovi[c]
              void salva('applications', { ...a, voti: nuovi, votiIl: chiaveGiorno(oggi()), votiDaGemini: undefined })
            }}>
              <span>{c}</span>
              <span className="voto" style={{ background: sfondo, color: testo }}>{v ?? '–'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FormApplication({ a, passiPredefiniti, numero, onChiudi }: { a?: Application; passiPredefiniti: string[]; numero: number; onChiudi: () => void }) {
  const passi = a?.passi ?? passiPredefiniti
  const [b, setB] = useState({
    studio: a?.studio ?? '', programma: programmaDa(a?.programma ?? 'vacation'), dettaglio: a?.dettaglio ?? '', deadline: a?.deadline ?? '', rolling: Boolean(a?.rolling),
    colore: a?.colore ?? COLORI_STUDIO[numero % COLORI_STUDIO.length]!, note: a?.note ?? '', link: a?.link ?? '', nonPassata: Boolean(a?.nonPassata),
    tc: testoDaCentesimi(a?.tcCent), nq: testoDaCentesimi(a?.nqCent),
    date: Object.fromEntries(passi.map((p) => { const d = a?.datePassi?.[p]; return [p, d ? `${d.giorno}${d.minuto !== undefined ? `T${orario(d.minuto).padStart(5, '0')}` : ''}` : ''] })) as Record<string, string>,
  })
  const tc = b.tc.trim() ? centesimiDaTesto(b.tc) : undefined
  const nq = b.nq.trim() ? centesimiDaTesto(b.nq) : undefined
  const valido = b.studio.trim() !== '' && tc !== null && nq !== null
  async function conferma() {
    if (!valido) return
    const datePassi: Application['datePassi'] = {}
    for (const [p, v] of Object.entries(b.date)) {
      const m = v.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?/)
      if (m) datePassi[p] = { giorno: m[1]!, minuto: m[2] ? Number(m[2]) * 60 + Number(m[3]) : undefined }
    }
    await salva('applications', {
      ...a, studio: b.studio.trim(), programma: b.programma, dettaglio: b.dettaglio.trim() || undefined, deadline: b.rolling ? undefined : b.deadline || undefined,
      rolling: b.rolling || undefined, passi, fatti: a?.fatti ?? 0, nonPassata: b.nonPassata || undefined, datePassi: Object.keys(datePassi).length ? datePassi : undefined,
      colore: b.colore, note: b.note.trim() || undefined, link: b.link.trim() || undefined, tcCent: tc ?? undefined, nqCent: nq ?? undefined,
    })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={a ? a.studio : 'Nuova application'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Studio legale"><input value={b.studio} autoFocus={!a} placeholder="es. Clifford Chance" onChange={(e) => setB({ ...b, studio: e.target.value })} /></Campo>
        <div className="riga-azioni" role="radiogroup" aria-label="Programma">
          {PROGRAMMI.map((p) => (
            <button key={p} type="button" role="radio" aria-checked={b.programma === p} className={`pillola${b.programma === p ? ' filtro-attivo' : ''}`} onClick={() => setB({ ...b, programma: p })}>{TITOLI_PROGRAMMA[p]}</button>
          ))}
        </div>
        <div className="campi-affiancati">
          <Campo etichetta="Dettaglio (facoltativo)"><input value={b.dettaglio} placeholder="es. Winter, 2028 start" onChange={(e) => setB({ ...b, dettaglio: e.target.value })} /></Campo>
          {!b.rolling && <Campo etichetta="Deadline"><input type="date" value={b.deadline} onChange={(e) => setB({ ...b, deadline: e.target.value })} /></Campo>}
        </div>
        <label className="interruttore">
          <span>Rolling (valutano man mano che arrivano)</span>
          <input type="checkbox" checked={b.rolling} onChange={(e) => setB({ ...b, rolling: e.target.checked })} />
        </label>
        <span className="secondario piccolo">Date dei passi (facoltative): compaiono in Agenda e sotto i pallini.</span>
        <div className="date-passi">
          {passi.map((p) => (
            <Campo key={p} etichetta={p}><input type="datetime-local" value={b.date[p] && !b.date[p]!.includes('T') ? `${b.date[p]}T09:00` : b.date[p] ?? ''} onChange={(e) => setB({ ...b, date: { ...b.date, [p]: e.target.value } })} /></Campo>
          ))}
        </div>
        <div className="campi-affiancati">
          <Campo etichetta="Stipendio trainee (£)"><input inputMode="decimal" value={b.tc} placeholder="es. 56000" onChange={(e) => setB({ ...b, tc: e.target.value })} /></Campo>
          <Campo etichetta="Stipendio NQ (£)"><input inputMode="decimal" value={b.nq} placeholder="es. 150000" onChange={(e) => setB({ ...b, nq: e.target.value })} /></Campo>
        </div>
        {(tc === null || nq === null) && <Avviso>Scrivi gli stipendi come 56000.</Avviso>}
        <Campo etichetta="Link (portale dell'application, facoltativo)"><input value={b.link} inputMode="url" placeholder="https://…" onChange={(e) => setB({ ...b, link: e.target.value })} /></Campo>
        <Campo etichetta="Note"><textarea value={b.note} placeholder="domande dell'application, cosa preparare…" onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <NotaPrivacy />
        {a && (
          <label className="interruttore">
            <span>Non passata{a.passi[a.fatti] ? ` (a ${a.passi[a.fatti]})` : ''}</span>
            <input type="checkbox" checked={b.nonPassata} onChange={(e) => setB({ ...b, nonPassata: e.target.checked })} />
          </label>
        )}
        <span className="secondario piccolo">Colore del nome</span>
        <div className="riga-azioni">
          {COLORI_STUDIO.map((c) => <button key={c} type="button" className="campione-colore" aria-label={`Colore ${c}`} aria-pressed={b.colore === c} style={{ background: c }} onClick={() => setB({ ...b, colore: c })} />)}
        </div>
        {a?.link && <a className="pillola" href={a.link} target="_blank" rel="noreferrer" style={{ alignSelf: 'flex-start' }}><IconaLink dimensione={14} /> Apri il portale</a>}
        {a && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('applications', a.id).then(() => { onChiudi(); mostraAvviso(`Eliminata: ${a.studio}`, () => void ripristina('applications', a.id)) })}>Elimina</button>
        )}
        {!a && <span className="secondario piccolo"><IconaPiu dimensione={12} /> I passi partono da: {passi.join(', ')}. Si cambiano dalla scheda con "Modifica i passi".</span>}
      </div>
    </Foglio>
  )
}

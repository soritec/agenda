import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, nuovoId, ripristina, salva, salvaImpostazioni } from '../../../dati/archivio'
import { contenutoAllegato } from '../../../dati/allegati'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Appunto, ArgomentoStudio, Flashcard, Risorsa } from '../../../dati/modello'
import { condividiOScarica, creaPdfTesto } from '../../../export/pdf'
import { Allegati } from '../../../interfaccia/Allegati'
import { EtichetteAllegati } from '../../../interfaccia/Visualizzatore'
import { Avviso, Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import { AZIONI_AI, elabora, leggiChiave, salvaChiave, type AzioneAI } from '../ai'
import {
  cercaGoogle, cercaPubMed, daRipassare, leggiFlashcardDaTesto, minutiSettimana, rispondi, SITI_STUDIO, STATI_LETTURA, statoLetturaDa, TIPI_RISORSA,
  tipoRisorsaDa, TITOLI_STATO_LETTURA, TITOLI_TIPO_RISORSA, type TipoRisorsa,
} from '../logica'
import { ascoltaTimer, avvia, controlla, ferma, leggiTimer, metti_in_pausa, rimanente, scegliArgomento, scegliDurate } from '../timer'

const SCHEDE = ['libreria', 'daLeggere', 'appunti', 'flashcard'] as const
type Scheda = (typeof SCHEDE)[number]
const TITOLI_SCHEDA: Record<Scheda, string> = { libreria: 'Libreria', daLeggere: 'Da leggere', appunti: 'Appunti', flashcard: 'Flashcard' }
const COLORI_TIPO: Record<TipoRisorsa, [string, string]> = {
  lineaGuida: ['#E1F2EA', '#1C7A5C'], articolo: ['#F8E6DF', '#A4472A'], libro: ['#ECEAFB', '#534AB7'], video: ['#E3EEF9', '#2D6AA6'], sito: ['#EEECE8', '#6B6862'],
}
const ICONE_TIPO: Record<TipoRisorsa, string> = { lineaGuida: '§', articolo: '¶', libro: '📖', video: '▶', sito: '🔗' }
const durataTesto = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`)
const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }

export function Studio({ scheda: schedaParam }: { scheda?: string | null }) {
  const argomenti = useCollezione('argomentiStudio')
  const risorse = useCollezione('risorse')
  const appunti = useCollezione('appunti')
  const flashcard = useCollezione('flashcard')
  const sessioni = useCollezione('sessioniStudio')
  const impostazioni = useImpostazioni()
  const oggiChiave = chiaveGiorno(oggi())
  const scheda: Scheda = (SCHEDE as readonly string[]).includes(schedaParam ?? '') ? (schedaParam as Scheda) : 'libreria'
  const [argomento, setArgomento] = useState<string>('tutti')
  const [cerca, setCerca] = useState('')
  const elencoArgomenti = useMemo(() => [...(argomenti ?? [])].sort((a, b) => a.ordine - b.ordine), [argomenti])
  const nomeArgomento = (id?: string) => elencoArgomenti.find((a) => a.id === id)?.nome
  const minuti = minutiSettimana(sessioni ?? [], oggiChiave)
  const obiettivo = impostazioni?.obiettivoStudioMinuti ?? 360

  const filtro = (x: { argomentoId?: string; titolo: string; testo?: string; note?: string }) =>
    (argomento === 'tutti' || x.argomentoId === argomento)
    && (!cerca.trim() || `${x.titolo} ${x.testo ?? ''} ${x.note ?? ''}`.toLowerCase().includes(cerca.trim().toLowerCase()))

  return (
    <div className="schermata" style={{ maxWidth: 1080 }}>
      <header className="testata-turni">
        <h1 className="titolo-grande">Studio e risorse</h1>
        <div className="azioni studio-settimana">
          <span className="secondario piccolo">Questa settimana</span>
          <strong>{durataTesto(minuti)}</strong>
          <span className="barra-mini"><i style={{ width: `${Math.min(100, (minuti / obiettivo) * 100)}%` }} /></span>
          <ObiettivoStudio minuti={obiettivo} />
        </div>
      </header>

      <div className="colonne colonne-studio">
        <div className="principale">
          <CollegamentiRapidi />
          <AssistenteAI argomenti={elencoArgomenti} risorse={risorse ?? []} />

          <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="segmenti" role="tablist">
              {SCHEDE.map((k) => {
                const n = k === 'daLeggere' ? (risorse ?? []).filter((r) => statoLetturaDa(r.stato) === 'daLeggere').length
                  : k === 'flashcard' ? daRipassare(flashcard ?? [], oggiChiave).length : 0
                return <a key={k} role="tab" aria-selected={scheda === k} className={scheda === k ? 'attivo' : ''} href={`#/studio?scheda=${k}`}>{TITOLI_SCHEDA[k]}{n ? ` · ${n}` : ''}</a>
              })}
            </div>
            <div className="riga-azioni" style={{ gap: 6 }}>
              <input className="cerca-studio" value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca tra risorse e appunti…" aria-label="Cerca" />
            </div>
            <div className="filtri-agenda">
              {[{ id: 'tutti', nome: 'Tutti' }, ...elencoArgomenti].map((a) => (
                <button key={a.id} type="button" className={`pillola${argomento === a.id ? ' filtro-attivo' : ''}`} onClick={() => setArgomento(a.id)}>{a.nome}</button>
              ))}
              <NuovoArgomento ordine={(elencoArgomenti.at(-1)?.ordine ?? 0) + 1} />
            </div>

            {(scheda === 'libreria' || scheda === 'daLeggere') && (
              <Libreria risorse={(risorse ?? []).filter((r) => filtro(r) && (scheda === 'libreria' || statoLetturaDa(r.stato) === 'daLeggere'))}
                argomenti={elencoArgomenti} nomeArgomento={nomeArgomento} argomentoScelto={argomento === 'tutti' ? undefined : argomento} />
            )}
            {scheda === 'appunti' && (
              <Appunti appunti={(appunti ?? []).filter((a) => filtro({ ...a, testo: a.testo }))} argomenti={elencoArgomenti} nomeArgomento={nomeArgomento}
                argomentoScelto={argomento === 'tutti' ? undefined : argomento} />
            )}
            {scheda === 'flashcard' && (
              <Flashcards carte={(flashcard ?? []).filter((c) => argomento === 'tutti' || c.argomentoId === argomento)} argomenti={elencoArgomenti}
                nomeArgomento={nomeArgomento} argomentoScelto={argomento === 'tutti' ? undefined : argomento} oggiChiave={oggiChiave} />
            )}
          </section>
        </div>

        <aside className="laterale-destra">
          <Timer argomenti={elencoArgomenti} />
          <InPreparazione oggiChiave={oggiChiave} />
        </aside>
      </div>
    </div>
  )
}

function ObiettivoStudio({ minuti }: { minuti: number }) {
  const [apri, setApri] = useState(false)
  const [ore, setOre] = useState(String(minuti / 60))
  return (
    <>
      <button type="button" className="link piccolo" onClick={() => setApri(true)}>di {durataTesto(minuti)}</button>
      {apri && (
        <Foglio aperto titolo="Obiettivo settimanale" onChiudi={() => setApri(false)}
          azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} onClick={() => {
            const n = Number(ore.replace(',', '.'))
            if (n > 0) void salvaImpostazioni({ obiettivoStudioMinuti: Math.round(n * 60) })
            setApri(false)
          }}>Salva</button>}>
          <Campo etichetta="Ore di studio a settimana"><input inputMode="decimal" value={ore} onChange={(e) => setOre(e.target.value)} /></Campo>
        </Foglio>
      )}
    </>
  )
}

/* Timer con anello */

const STUDIO = [30, 60, 90, 120]
const PAUSE = [5, 10, 20, 30]

function Timer({ argomenti }: { argomenti: ArgomentoStudio[] }) {
  const s = useSyncExternalStore(ascoltaTimer, leggiTimer)
  const [adesso, setAdesso] = useState(Date.now())
  const [altro, setAltro] = useState(false)
  const [minutiAltro, setMinutiAltro] = useState('')
  useEffect(() => {
    const t = setInterval(() => { setAdesso(Date.now()); void controlla() }, 500)
    return () => clearInterval(t)
  }, [])
  const { ms, frazione } = rimanente(s, adesso)
  const mm = Math.floor(ms / 60_000), ss = Math.floor((ms % 60_000) / 1000)
  const R = 72, C = 2 * Math.PI * R
  const corre = s.fase !== 'fermo' && s.fineIl !== undefined
  const colore = s.fase === 'pausa' ? '#E0A030' : '#1D9E75'
  return (
    <section className="scheda timer-studio">
      <h2 className="titolo-sezione">Timer di studio</h2>
      <svg width="190" height="190" viewBox="0 0 190 190" role="img" aria-label={`${mm} minuti e ${ss} secondi rimasti`}>
        <circle cx="95" cy="95" r={R} fill="none" stroke="var(--linea)" strokeWidth="11" />
        <circle cx="95" cy="95" r={R} fill="none" stroke={colore} strokeWidth="11" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frazione)} transform="rotate(-90 95 95)" style={{ transition: 'stroke-dashoffset 0.5s linear' }} />
        <text x="95" y="96" textAnchor="middle" className="tempo-timer">{String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}</text>
        <text x="95" y="120" textAnchor="middle" className="fase-timer">
          {s.fase === 'fermo' ? 'pronto' : s.fase === 'pausa' ? 'pausa' : `studio · ${s.ciclo}° ciclo`}{s.fase !== 'fermo' && !corre ? ' (fermo)' : ''}
        </text>
      </svg>
      <div className="riga-azioni centrata">
        <span className="secondario piccolo">Studio</span>
        {STUDIO.map((m) => (
          <button key={m} type="button" className={`pillola${s.durataStudio === m ? ' filtro-attivo' : ''}`} disabled={s.fase !== 'fermo'} onClick={() => scegliDurate(m, s.durataPausa)}>{m}</button>
        ))}
        <button type="button" className={`pillola${!STUDIO.includes(s.durataStudio) ? ' filtro-attivo' : ''}`} disabled={s.fase !== 'fermo'} onClick={() => setAltro(true)}>
          {STUDIO.includes(s.durataStudio) ? 'altro' : `${s.durataStudio}`}
        </button>
        <span className="secondario piccolo">min</span>
      </div>
      {altro && (
        <div className="riga-azioni centrata">
          <input inputMode="numeric" value={minutiAltro} placeholder="minuti" aria-label="Minuti di studio" className="data-piccola" style={{ width: 90 }}
            onChange={(e) => setMinutiAltro(e.target.value)} />
          <button type="button" className="pulsante piccolo" onClick={() => { const n = Number(minutiAltro); if (n >= 1 && n <= 600) scegliDurate(Math.round(n), s.durataPausa); setAltro(false) }}>Ok</button>
        </div>
      )}
      <div className="riga-azioni centrata">
        <span className="secondario piccolo">Pausa</span>
        {PAUSE.map((m) => (
          <button key={m} type="button" className={`pillola${s.durataPausa === m ? ' filtro-attivo' : ''}`} disabled={s.fase !== 'fermo'} onClick={() => scegliDurate(s.durataStudio, m)}>{m}</button>
        ))}
        <span className="secondario piccolo">min</span>
      </div>
      <div className="riga-azioni centrata" style={{ marginTop: 4 }}>
        {corre
          ? <button type="button" className="pulsante" onClick={metti_in_pausa}>❚❚ Pausa</button>
          : <button type="button" className="pulsante primario" onClick={avvia}>▶ {s.fase === 'fermo' ? 'Inizia' : 'Riprendi'}</button>}
        {s.fase !== 'fermo' && <button type="button" className="pulsante" onClick={() => void ferma()}>■ Stop</button>}
      </div>
      <label className="secondario piccolo" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        Argomento
        <select value={s.argomentoId ?? ''} onChange={(e) => scegliArgomento(e.target.value || undefined)} className="data-piccola">
          <option value="">—</option>
          {argomenti.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </label>
      <span className="secondario piccolo" style={{ textAlign: 'center' }}>Il tempo di studio si somma alla settimana. Il timer continua anche se cambi pagina.</span>
    </section>
  )
}

/* Collegamenti rapidi */

function CollegamentiRapidi() {
  const [q, setQ] = useState('')
  return (
    <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 className="titolo-sezione">Collegamenti rapidi</h2>
      <div className="collegamenti-rapidi">
        <a href="https://drive.google.com" target="_blank" rel="noreferrer"><span style={{ color: '#1C7A5C' }}>▲</span> Google Drive</a>
        <a href="https://www.google.com" target="_blank" rel="noreferrer"><span style={{ color: '#2D6AA6', fontWeight: 800 }}>G</span> Google</a>
        <a href="https://pubmed.ncbi.nlm.nih.gov" target="_blank" rel="noreferrer"><span style={{ color: '#A4472A', fontWeight: 800 }}>P</span> PubMed</a>
      </div>
      <div className="aggiunta-veloce">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca subito (es. PPROM linee guida)" aria-label="Cerca su Google o PubMed"
          onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) window.open(cercaGoogle(q), '_blank', 'noopener') }} />
        <a className={`pulsante${q.trim() ? '' : ' disattivo'}`} href={q.trim() ? cercaGoogle(q) : undefined} target="_blank" rel="noreferrer">Google</a>
        <a className={`pulsante${q.trim() ? '' : ' disattivo'}`} href={q.trim() ? cercaPubMed(q) : undefined} target="_blank" rel="noreferrer">PubMed</a>
      </div>
    </section>
  )
}

/* Assistente AI */

function AssistenteAI({ argomenti, risorse }: { argomenti: ArgomentoStudio[]; risorse: Risorsa[] }) {
  const allegati = useCollezione('allegati')
  const [chiave, setChiave] = useState(leggiChiave())
  const [modificaChiave, setModificaChiave] = useState(false)
  const [testo, setTesto] = useState('')
  const [pdf, setPdf] = useState<{ nome: string; blob?: Blob; allegatoId?: string }>()
  const [risultato, setRisultato] = useState<{ azione: AzioneAI; testo: string }>()
  const [inCorso, setInCorso] = useState<AzioneAI>()
  const [errore, setErrore] = useState<string>()
  const [argomentoSalva, setArgomentoSalva] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const pdfLibreria = (allegati ?? []).filter((a) => a.tipoMime === 'application/pdf' && a.collegatoA.startsWith('risorsa:'))
  const nomeRisorsa = (collegatoA: string) => risorse.find((r) => `risorsa:${r.id}` === collegatoA)?.titolo

  async function esegui(azione: AzioneAI) {
    setErrore(undefined)
    setInCorso(azione)
    try {
      let blob = pdf?.blob
      if (!blob && pdf?.allegatoId) {
        const a = allegati?.find((x) => x.id === pdf.allegatoId)
        if (a) blob = await contenutoAllegato(a)
      }
      setRisultato({ azione, testo: await elabora(azione, testo, blob) })
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Qualcosa non ha funzionato.')
    } finally {
      setInCorso(undefined)
    }
  }
  async function salvaAppunto() {
    if (!risultato) return
    await salva('appunti', { titolo: `${AZIONI_AI[risultato.azione].titolo}${pdf ? ` · ${pdf.nome}` : ''}`, testo: risultato.testo, argomentoId: argomentoSalva || undefined })
    mostraAvviso('Salvato negli appunti')
  }
  async function salvaFlashcard() {
    if (!risultato) return
    const carte = leggiFlashcardDaTesto(risultato.testo)
    for (const c of carte) await salva('flashcard', { ...c, argomentoId: argomentoSalva || undefined, scatola: 1, prossima: chiaveGiorno(oggi()) })
    mostraAvviso(`${carte.length} flashcard aggiunte`)
  }

  if (!chiave || modificaChiave) {
    return (
      <section className="scheda modulo">
        <h2 className="titolo-sezione">✦ Assistente AI</h2>
        <p className="secondario piccolo" style={{ margin: 0 }}>
          Per riassumere e rielaborare testi l'app usa Claude di Anthropic. Serve la tua chiave personale: creala su
          {' '}<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a> e incollala qui.
          Resta solo su questo dispositivo. Il testo che scegli viene inviato ad Anthropic; si paga a consumo (pochi centesimi a riassunto).
        </p>
        <ChiaveAI onSalva={(k) => { salvaChiave(k); setChiave(k); setModificaChiave(false) }} onAnnulla={chiave ? () => setModificaChiave(false) : undefined} />
      </section>
    )
  }

  return (
    <section className="scheda modulo">
      <div className="intestazione" style={{ alignItems: 'center' }}>
        <h2 className="titolo-sezione">✦ Assistente AI</h2>
        <button type="button" className="link piccolo" onClick={() => setModificaChiave(true)}>Chiave</button>
      </div>
      <textarea value={testo} onChange={(e) => setTesto(e.target.value)} rows={4} placeholder="Incolla qui un testo, oppure scegli un PDF…" />
      <div className="riga-azioni">
        <button type="button" className="pillola" onClick={() => file.current?.click()}>📎 PDF dal dispositivo</button>
        {pdfLibreria.length > 0 && (
          <select className="data-piccola" value={pdf?.allegatoId ?? ''} aria-label="PDF della libreria"
            onChange={(e) => { const a = pdfLibreria.find((x) => x.id === e.target.value); setPdf(a ? { nome: a.nome, allegatoId: a.id } : undefined) }}>
            <option value="">PDF della libreria…</option>
            {pdfLibreria.map((a) => <option key={a.id} value={a.id}>{nomeRisorsa(a.collegatoA) ?? a.nome}</option>)}
          </select>
        )}
        {pdf && <span className="pillola piccola">{pdf.nome} <button type="button" className="link" onClick={() => setPdf(undefined)} aria-label="Togli il PDF">×</button></span>}
        <input ref={file} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setPdf({ nome: f.name, blob: f }); e.target.value = '' }} />
      </div>
      <div className="riga-azioni">
        {(Object.keys(AZIONI_AI) as AzioneAI[]).map((a) => (
          <button key={a} type="button" className="pillola" disabled={!!inCorso || (!testo.trim() && !pdf)} onClick={() => void esegui(a)}>
            {inCorso === a ? 'Sto scrivendo…' : AZIONI_AI[a].titolo}
          </button>
        ))}
      </div>
      <NotaPrivacy />
      {errore && <Avviso>{errore}</Avviso>}
      {risultato && (
        <div className="risultato-ai">
          <div className="testo-ai">{risultato.testo}</div>
          <div className="riga-azioni">
            <select className="data-piccola" value={argomentoSalva} onChange={(e) => setArgomentoSalva(e.target.value)} aria-label="Argomento">
              <option value="">Argomento…</option>
              {argomenti.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            {risultato.azione === 'flashcard'
              ? <button type="button" className="pulsante primario piccolo" onClick={() => void salvaFlashcard()}>Aggiungi alle flashcard</button>
              : <button type="button" className="pulsante primario piccolo" onClick={() => void salvaAppunto()}>Salva negli appunti</button>}
            <button type="button" className="pulsante piccolo" onClick={() => void navigator.clipboard?.writeText(risultato.testo).then(() => mostraAvviso('Copiato'))}>Copia</button>
          </div>
        </div>
      )}
    </section>
  )
}

function ChiaveAI({ onSalva, onAnnulla }: { onSalva: (k: string) => void; onAnnulla?: () => void }) {
  const [k, setK] = useState('')
  return (
    <div className="aggiunta-veloce">
      <input type="password" autoComplete="off" value={k} onChange={(e) => setK(e.target.value)} placeholder="sk-ant-…" aria-label="Chiave Anthropic" />
      <button type="button" className="pulsante primario" disabled={!k.trim().startsWith('sk-')} onClick={() => onSalva(k.trim())}>Salva</button>
      {onAnnulla && <button type="button" className="pulsante" onClick={onAnnulla}>Annulla</button>}
      {onAnnulla && <button type="button" className="pulsante pericolo" onClick={() => onSalva('')}>Togli</button>}
    </div>
  )
}

/* Argomenti */

function NuovoArgomento({ ordine }: { ordine: number }) {
  const [apri, setApri] = useState(false)
  const [nome, setNome] = useState('')
  if (!apri) return <button type="button" className="pillola" onClick={() => setApri(true)}>+ argomento</button>
  return (
    <span className="riga-azioni" style={{ gap: 4 }}>
      <input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nuovo argomento" className="data-piccola"
        onKeyDown={(e) => { if (e.key === 'Enter' && nome.trim()) { void salva('argomentiStudio', { nome: nome.trim(), ordine }); setNome(''); setApri(false) } if (e.key === 'Escape') setApri(false) }} />
      <button type="button" className="pillola" disabled={!nome.trim()} onClick={() => { void salva('argomentiStudio', { nome: nome.trim(), ordine }); setNome(''); setApri(false) }}>Aggiungi</button>
    </span>
  )
}

/* Libreria */

function Libreria({ risorse, argomenti, nomeArgomento, argomentoScelto }: { risorse: Risorsa[]; argomenti: ArgomentoStudio[]; nomeArgomento: (id?: string) => string | undefined; argomentoScelto?: string }) {
  const [modifica, setModifica] = useState<{ r?: Risorsa; iniziale?: Partial<Risorsa> }>()
  const ordinate = [...risorse].sort((a, b) => Number(Boolean(b.preferito)) - Number(Boolean(a.preferito)) || STATI_LETTURA.indexOf(statoLetturaDa(a.stato)) - STATI_LETTURA.indexOf(statoLetturaDa(b.stato)) || b.creatoIl - a.creatoIl)
  return (
    <>
      <div className="lista">
        {ordinate.length === 0 && <div className="vuoto piccolo">Niente qui. Aggiungi una linea guida, un articolo o un video.</div>}
        {ordinate.map((r) => {
          const tipo = tipoRisorsaDa(r.tipo), stato = statoLetturaDa(r.stato)
          return (
            <div key={r.id} className="riga riga-risorsa" style={{ cursor: 'default' }}>
              <span className="icona-sezione quadratino" style={{ background: COLORI_TIPO[tipo][0], color: COLORI_TIPO[tipo][1], fontWeight: 800 }}>{ICONE_TIPO[tipo]}</span>
              <button type="button" className="crescente" onClick={() => setModifica({ r })} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                <span style={{ fontWeight: 600 }}>{r.preferito && <span style={{ color: '#E0A030' }}>★ </span>}{r.titolo}</span>
                <span className="secondario piccolo">{[TITOLI_TIPO_RISORSA[tipo], nomeArgomento(r.argomentoId)].filter(Boolean).join(' · ')}</span>
                {stato === 'inLettura' && r.progresso !== undefined && <span className="barra-mini" style={{ width: '100%' }}><i style={{ width: `${r.progresso}%`, background: '#7F77DD' }} /></span>}
                <EtichetteAllegati collegatoA={`risorsa:${r.id}`} />
              </button>
              {r.url && <a className="pillola piccola" href={r.url} target="_blank" rel="noreferrer">Apri</a>}
              <button type="button" className={`pillola piccola stato-${stato}`} title="Cambia stato"
                onClick={() => void salva('risorse', { ...r, stato: STATI_LETTURA[(STATI_LETTURA.indexOf(stato) + 1) % 3]! })}>
                {stato === 'letto' ? 'Letto ✓' : TITOLI_STATO_LETTURA[stato]}
              </button>
              <button type="button" className="elimina-task" aria-label={`Elimina ${r.titolo}`}
                onClick={() => void elimina('risorse', r.id).then(() => mostraAvviso(`Eliminato: ${r.titolo}`, () => void ripristina('risorse', r.id)))}>×</button>
            </div>
          )
        })}
      </div>
      <div className="riga-azioni">
        <button type="button" className="pulsante primario" onClick={() => setModifica({ iniziale: { argomentoId: argomentoScelto } })}>+ Risorsa</button>
        <span className="secondario piccolo">Siti utili:</span>
        {SITI_STUDIO.map((s) => (
          <button key={s.url} type="button" className="pillola piccola" onClick={() => setModifica({ iniziale: { titolo: s.titolo, url: s.url, tipo: 'sito', stato: 'letto', argomentoId: argomentoScelto } })}>+ {s.titolo}</button>
        ))}
      </div>
      {modifica && <FormRisorsa r={modifica.r} iniziale={modifica.iniziale} argomenti={argomenti} onChiudi={() => setModifica(undefined)} />}
    </>
  )
}

function FormRisorsa({ r, iniziale, argomenti, onChiudi }: { r?: Risorsa; iniziale?: Partial<Risorsa>; argomenti: ArgomentoStudio[]; onChiudi: () => void }) {
  const id = useRef(r?.id ?? nuovoId()).current
  const base = r ?? iniziale ?? {}
  const [b, setB] = useState({
    titolo: base.titolo ?? '', tipo: tipoRisorsaDa(base.tipo ?? 'lineaGuida'), url: base.url ?? '', argomentoId: base.argomentoId ?? '',
    stato: statoLetturaDa(base.stato ?? 'daLeggere'), progresso: String(base.progresso ?? ''), preferito: Boolean(base.preferito), note: base.note ?? '',
  })
  const url = b.url.trim() && !/^https?:\/\//.test(b.url.trim()) ? `https://${b.url.trim()}` : b.url.trim()
  const valido = b.titolo.trim() !== ''
  async function conferma() {
    if (!valido) return
    const p = Number(b.progresso)
    await salva('risorse', {
      ...r, id, titolo: b.titolo.trim(), tipo: b.tipo, url: url || undefined, argomentoId: b.argomentoId || undefined, stato: b.stato,
      progresso: b.stato === 'inLettura' && p >= 0 && p <= 100 && b.progresso !== '' ? p : undefined, preferito: b.preferito || undefined, note: b.note.trim() || undefined,
    })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={r ? 'Risorsa' : 'Nuova risorsa'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Titolo"><input value={b.titolo} autoFocus={!r} placeholder="es. RCOG GTG 52 – Emorragia post-partum" onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="riga-azioni" role="group" aria-label="Tipo">
          {TIPI_RISORSA.map((t) => (
            <button key={t} type="button" className={`pillola${b.tipo === t ? ' filtro-attivo' : ''}`} onClick={() => setB({ ...b, tipo: t })}>{TITOLI_TIPO_RISORSA[t]}</button>
          ))}
        </div>
        <Campo etichetta="Link (facoltativo)"><input value={b.url} inputMode="url" autoCapitalize="off" placeholder="Incolla il link" onChange={(e) => setB({ ...b, url: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Argomento">
            <select value={b.argomentoId} onChange={(e) => setB({ ...b, argomentoId: e.target.value })}>
              <option value="">—</option>
              {argomenti.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Stato">
            <select value={b.stato} onChange={(e) => setB({ ...b, stato: statoLetturaDa(e.target.value) })}>
              {STATI_LETTURA.map((s) => <option key={s} value={s}>{TITOLI_STATO_LETTURA[s]}</option>)}
            </select>
          </Campo>
          {b.stato === 'inLettura' && <Campo etichetta="A che punto (%)"><input inputMode="numeric" value={b.progresso} onChange={(e) => setB({ ...b, progresso: e.target.value })} /></Campo>}
        </div>
        <label className="interruttore"><span>★ Preferito</span><input type="checkbox" checked={b.preferito} onChange={(e) => setB({ ...b, preferito: e.target.checked })} /></label>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <div className="campo"><span>PDF e documenti</span><Allegati collegatoA={`risorsa:${id}`} avvisoPrivacy="Linee guida, articoli, slide. Niente dati delle pazienti." /></div>
        <NotaPrivacy />
      </div>
    </Foglio>
  )
}

/* Appunti */

function Appunti({ appunti, argomenti, nomeArgomento, argomentoScelto }: { appunti: Appunto[]; argomenti: ArgomentoStudio[]; nomeArgomento: (id?: string) => string | undefined; argomentoScelto?: string }) {
  const [modifica, setModifica] = useState<{ a?: Appunto }>()
  const ordinati = [...appunti].sort((a, b) => b.modificatoIl - a.modificatoIl)
  async function esporta() {
    const titolo = argomentoScelto ? `Appunti · ${nomeArgomento(argomentoScelto)}` : 'Appunti'
    const blob = await creaPdfTesto(titolo, `${ordinati.length} appunti · ${F.dataEstesa(Date.now())}`,
      [...ordinati].sort((a, b) => (nomeArgomento(a.argomentoId) ?? '').localeCompare(nomeArgomento(b.argomentoId) ?? '') || a.creatoIl - b.creatoIl)
        .map((a) => ({ titolo: argomentoScelto ? a.titolo : `${a.titolo}${nomeArgomento(a.argomentoId) ? ` (${nomeArgomento(a.argomentoId)})` : ''}`, testo: a.testo })))
    await condividiOScarica(blob, `${titolo}.pdf`, titolo)
  }
  return (
    <>
      <div className="lista">
        {ordinati.length === 0 && <div className="vuoto piccolo">Nessun appunto. Scrivine uno o salva un riassunto dell'assistente.</div>}
        {ordinati.map((a) => (
          <div key={a.id} className="riga" style={{ cursor: 'default', alignItems: 'flex-start' }}>
            <button type="button" className="crescente" onClick={() => setModifica({ a })} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
              <span style={{ fontWeight: 600 }}>{a.titolo}</span>
              <span className="secondario piccolo">{[nomeArgomento(a.argomentoId), F.dataBreve(a.modificatoIl)].filter(Boolean).join(' · ')}</span>
              <span className="piccolo anteprima-appunto">{a.testo.slice(0, 160)}{a.testo.length > 160 ? '…' : ''}</span>
            </button>
            <button type="button" className="elimina-task" aria-label={`Elimina ${a.titolo}`}
              onClick={() => void elimina('appunti', a.id).then(() => mostraAvviso(`Eliminato: ${a.titolo}`, () => void ripristina('appunti', a.id)))}>×</button>
          </div>
        ))}
      </div>
      <div className="riga-azioni">
        <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ Appunto</button>
        <button type="button" className="pulsante" disabled={!ordinati.length} onClick={() => void esporta()}>Esporta in PDF{argomentoScelto ? ` (${nomeArgomento(argomentoScelto)})` : ''}</button>
      </div>
      {modifica && <FormAppunto a={modifica.a} argomentoIniziale={argomentoScelto} argomenti={argomenti} onChiudi={() => setModifica(undefined)} />}
    </>
  )
}

function FormAppunto({ a, argomentoIniziale, argomenti, onChiudi }: { a?: Appunto; argomentoIniziale?: string; argomenti: ArgomentoStudio[]; onChiudi: () => void }) {
  const [titolo, setTitolo] = useState(a?.titolo ?? '')
  const [testo, setTesto] = useState(a?.testo ?? '')
  const [argomentoId, setArgomentoId] = useState(a?.argomentoId ?? argomentoIniziale ?? '')
  const valido = titolo.trim() !== '' || testo.trim() !== ''
  async function conferma() {
    if (!valido) return
    await salva('appunti', { ...a, titolo: titolo.trim() || testo.trim().split('\n')[0]!.slice(0, 60), testo, argomentoId: argomentoId || undefined })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={a ? 'Appunto' : 'Nuovo appunto'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <div className="campi-affiancati">
          <Campo etichetta="Titolo"><input value={titolo} autoFocus={!a} onChange={(e) => setTitolo(e.target.value)} /></Campo>
          <Campo etichetta="Argomento">
            <select value={argomentoId} onChange={(e) => setArgomentoId(e.target.value)}>
              <option value="">—</option>
              {argomenti.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </Campo>
        </div>
        <textarea className="appunti" value={testo} onChange={(e) => setTesto(e.target.value)} placeholder="Scrivi qui…" />
        <NotaPrivacy />
      </div>
    </Foglio>
  )
}

/* Flashcard */

function Flashcards({ carte, argomenti, nomeArgomento, argomentoScelto, oggiChiave }: {
  carte: Flashcard[]; argomenti: ArgomentoStudio[]; nomeArgomento: (id?: string) => string | undefined; argomentoScelto?: string; oggiChiave: string
}) {
  const [ripasso, setRipasso] = useState(false)
  const [girata, setGirata] = useState(false)
  const [nuova, setNuova] = useState<{ c?: Flashcard }>()
  const dovute = daRipassare(carte, oggiChiave).sort((a, b) => a.scatola - b.scatola || a.creatoIl - b.creatoIl)
  const attuale = dovute[0]
  async function rispondiCarta(giusta: boolean) {
    if (!attuale) return
    await salva('flashcard', { ...attuale, ...rispondi(attuale, giusta, oggiChiave) })
    setGirata(false)
  }
  return (
    <>
      {ripasso && attuale ? (
        <div className="carta-ripasso">
          <span className="secondario piccolo">{dovute.length} da ripassare oggi · {nomeArgomento(attuale.argomentoId) ?? 'senza argomento'} · scatola {attuale.scatola}</span>
          <button type="button" className="faccia" onClick={() => setGirata(!girata)}>
            <span className="secondario piccolo">{girata ? 'Risposta' : 'Domanda'}</span>
            <span className="testo-carta">{girata ? attuale.risposta : attuale.domanda}</span>
            {!girata && <span className="secondario piccolo">Tocca per vedere la risposta</span>}
          </button>
          {girata && (
            <div className="piu-meno" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button type="button" className="grande-meno" onClick={() => void rispondiCarta(false)}>Non la sapevo</button>
              <button type="button" className="grande-piu" onClick={() => void rispondiCarta(true)}>La sapevo</button>
            </div>
          )}
          <button type="button" className="link piccolo" onClick={() => { setRipasso(false); setGirata(false) }}>Esci dal ripasso</button>
        </div>
      ) : (
        <div className="scheda" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span className="crescente" style={{ flex: 1 }}>
            <strong>{dovute.length ? `${dovute.length} flashcard da ripassare oggi` : ripasso ? 'Ripasso finito per oggi!' : 'Niente da ripassare oggi'}</strong>
            <span className="secondario piccolo">Quelle che sai ritornano sempre più tardi (1, 2, 4, 8, 16 giorni); quelle che sbagli tornano domani.</span>
          </span>
          {dovute.length > 0 && <button type="button" className="pulsante primario" onClick={() => setRipasso(true)}>Ripassa</button>}
        </div>
      )}
      <div className="lista">
        {carte.length === 0 && <div className="vuoto piccolo">Nessuna flashcard. Creale a mano o con l'assistente AI.</div>}
        {[...carte].sort((a, b) => a.prossima.localeCompare(b.prossima)).map((c) => (
          <div key={c.id} className="riga" style={{ cursor: 'default' }}>
            <button type="button" className="crescente" onClick={() => setNuova({ c })} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
              <span style={{ fontWeight: 600 }}>{c.domanda}</span>
              <span className="secondario piccolo">{[nomeArgomento(c.argomentoId), `scatola ${c.scatola}`, c.prossima <= oggiChiave ? 'da ripassare' : `prossima ${F.dataBreve(msGiorno(c.prossima))}`].filter(Boolean).join(' · ')}</span>
            </button>
            <button type="button" className="elimina-task" aria-label="Elimina"
              onClick={() => void elimina('flashcard', c.id).then(() => mostraAvviso('Flashcard eliminata', () => void ripristina('flashcard', c.id)))}>×</button>
          </div>
        ))}
      </div>
      <div className="riga-azioni"><button type="button" className="pulsante primario" onClick={() => setNuova({})}>+ Flashcard</button></div>
      {nuova && <FormFlashcard c={nuova.c} argomentoIniziale={argomentoScelto} argomenti={argomenti} onChiudi={() => setNuova(undefined)} />}
    </>
  )
}

function FormFlashcard({ c, argomentoIniziale, argomenti, onChiudi }: { c?: Flashcard; argomentoIniziale?: string; argomenti: ArgomentoStudio[]; onChiudi: () => void }) {
  const [domanda, setDomanda] = useState(c?.domanda ?? '')
  const [risposta, setRisposta] = useState(c?.risposta ?? '')
  const [argomentoId, setArgomentoId] = useState(c?.argomentoId ?? argomentoIniziale ?? '')
  const valido = domanda.trim() !== '' && risposta.trim() !== ''
  async function conferma(eAltra = false) {
    if (!valido) return
    await salva('flashcard', { ...c, domanda: domanda.trim(), risposta: risposta.trim(), argomentoId: argomentoId || undefined, scatola: c?.scatola ?? 1, prossima: c?.prossima ?? chiaveGiorno(oggi()) })
    if (eAltra) { setDomanda(''); setRisposta('') } else onChiudi()
  }
  return (
    <Foglio aperto titolo={c ? 'Flashcard' : 'Nuova flashcard'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Domanda"><textarea rows={2} value={domanda} autoFocus onChange={(e) => setDomanda(e.target.value)} /></Campo>
        <Campo etichetta="Risposta"><textarea rows={3} value={risposta} onChange={(e) => setRisposta(e.target.value)} /></Campo>
        <Campo etichetta="Argomento">
          <select value={argomentoId} onChange={(e) => setArgomentoId(e.target.value)}>
            <option value="">—</option>
            {argomenti.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </Campo>
        {!c && <button type="button" className="pulsante" disabled={!valido} onClick={() => void conferma(true)}>Salva e scrivine un'altra</button>}
      </div>
    </Foglio>
  )
}

/* In preparazione: argomenti da ripassare per il prossimo esame */

function InPreparazione({ oggiChiave }: { oggiChiave: string }) {
  const esami = useCollezione('esami')
  const [nuovo, setNuovo] = useState('')
  const prossimo = (esami ?? []).filter((e) => e.tipo === 'esame' && !e.completato && e.giorno >= oggiChiave).sort((a, b) => a.giorno.localeCompare(b.giorno))[0]
  if (!esami) return null
  if (!prossimo) {
    return (
      <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h2 className="titolo-sezione">In preparazione</h2>
        <span className="secondario piccolo">Nessun esame in programma. <a href="#/specializzazione/esami">Aggiungilo in Specializzazione</a>.</span>
      </section>
    )
  }
  const argomenti = prossimo.argomenti ?? []
  const giorni = Math.round((msGiorno(prossimo.giorno) - msGiorno(oggiChiave)) / 86_400_000)
  const salvaArgomenti = (nuovi: { testo: string; fatto?: boolean }[]) => salva('esami', { ...prossimo, argomenti: nuovi.length ? nuovi : undefined })
  return (
    <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 className="titolo-sezione">In preparazione</h2>
      <strong>{prossimo.titolo}</strong>
      <span className="secondario piccolo">{F.dataEstesa(msGiorno(prossimo.giorno))} · {giorni === 0 ? 'oggi' : giorni === 1 ? 'domani' : `tra ${giorni} giorni`}</span>
      {argomenti.map((a, i) => (
        <label key={i} className="riga-semplice" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={Boolean(a.fatto)} style={{ width: 18, height: 18, accentColor: 'var(--primario)' }}
            onChange={(e) => void salvaArgomenti(argomenti.map((x, j) => (j === i ? { ...x, fatto: e.target.checked || undefined } : x)))} />
          <span className="crescente" style={{ textDecoration: a.fatto ? 'line-through' : undefined, opacity: a.fatto ? 0.6 : 1 }}>{a.testo}</span>
          <button type="button" className="elimina-task" aria-label={`Togli ${a.testo}`} onClick={(e) => { e.preventDefault(); void salvaArgomenti(argomenti.filter((_, j) => j !== i)) }}>×</button>
        </label>
      ))}
      <input className="data-piccola" value={nuovo} placeholder="+ argomento da ripassare (Invio)" onChange={(e) => setNuovo(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && nuovo.trim()) { void salvaArgomenti([...argomenti, { testo: nuovo.trim() }]); setNuovo('') } }} />
      {argomenti.length > 0 && <span className="secondario piccolo">{argomenti.filter((a) => a.fatto).length} di {argomenti.length} argomenti ripassati</span>}
    </section>
  )
}

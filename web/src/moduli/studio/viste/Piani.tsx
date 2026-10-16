import { useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, nuovoId, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { ArgomentoPiano, PianoStudio, Risorsa, SessionePiano } from '../../../dati/modello'
import { blobCSV } from '../../../export/csv'
import { creaIcs } from '../../../export/ics'
import { condividiOScarica, creaPdf, scarica } from '../../../export/pdf'
import { Avviso, Campo, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { useTrascinamento } from '../../../interfaccia/trascina'
import { IconaCalendario, IconaClip } from '../../../interfaccia/icone'
import { impegniTra } from '../../agenda/impegni'
import { chiaveGiorno, giornoDaChiave, oggi, perId } from '../../turni/supporto'
import { estraiArgomenti, generaFlashcard, leggiChiave, organizzaConAI } from '../ai'
import {
  argomentoFinito, COLORI_PIANO, dividiPagine, giorniDelPiano, giornoSettimana, leggiPianoAI, pagineDi, piuGiorni, ripassiPer, riepilogoSessioni, riprogramma,
} from '../piani'
import { avviaSessione } from '../timer'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const ms = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const durata = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`)
const lunedi = (g: string) => piuGiorni(g, 1 - giornoSettimana(g))
const pagine = (s: Pick<SessionePiano, 'paginaDa' | 'paginaA'>) => (s.paginaDa !== undefined ? `p. ${s.paginaDa}–${s.paginaA}` : '')

/** Per ogni giorno, il motivo per cui probabilmente non si riesce a studiare (turno, ferie, congresso, impegno lungo). */
function useGiorniOccupati(da: string, a: string): Map<string, string> {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const giornate = useCollezione('ferie')
  const eventi = useCollezione('eventi')
  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  return useMemo(() => {
    const m = new Map<string, string>()
    for (const i of impegniTra({ turni, modelli: mappaModelli, giornate, eventi }, da, a)) {
      const lungo = i.fonte === 'turno' || i.fonte === 'giornata' || (i.fonte === 'evento' && (i.minutoInizio === undefined || (i.minutoFine ?? 0) - i.minutoInizio >= 240))
      if (!lungo || i.titolo === 'Riposo') continue
      const testo = i.minutoInizio !== undefined ? `${i.titolo} ${Math.floor(i.minutoInizio / 60)}–${Math.floor((i.minutoFine ?? i.minutoInizio) / 60)}` : i.titolo
      m.set(i.giorno, m.has(i.giorno) ? `${m.get(i.giorno)}, ${testo}` : testo)
    }
    return m
  }, [turni, mappaModelli, giornate, eventi, da, a])
}

/* Sezione dei piani nella pagina Studio */

export function PianiStudio({ risorse }: { risorse: Risorsa[] }) {
  const piani = useCollezione('pianiStudio')
  const sessioni = useCollezione('sessioniPiano')
  const oggiChiave = chiaveGiorno(oggi())
  const [scelto, setScelto] = useState<string>()
  const [modifica, setModifica] = useState<{ p?: PianoStudio }>()
  const [vista, setVista] = useState<'settimana' | 'argomenti'>('settimana')
  const [settimana, setSettimana] = useState(lunedi(oggiChiave))
  const [aperta, setAperta] = useState<string>()
  const [esporta, setEsporta] = useState(false)
  const [nuovaSessione, setNuovaSessione] = useState<string>()
  const elenco = [...(piani ?? [])].sort((a, b) => a.fine.localeCompare(b.fine))
  const piano = elenco.find((p) => p.id === scelto) ?? elenco.find((p) => p.fine >= oggiChiave) ?? elenco[0]
  const delPiano = (sessioni ?? []).filter((s) => s.pianoId === piano?.id)
  const giorniSettimana = Array.from({ length: 7 }, (_, i) => piuGiorni(settimana, i))
  const occupati = useGiorniOccupati(piano ? (piano.inizio < settimana ? piano.inizio : settimana) : settimana, piano ? (piano.fine > giorniSettimana[6]! ? piano.fine : giorniSettimana[6]!) : giorniSettimana[6]!)
  const pressione = useTrascinamento<SessionePiano>((s, dove) => {
    if (s.giorno === dove.giorno) return
    void salva('sessioniPiano', { ...s, giorno: dove.giorno, tieni: undefined }).then(() => mostraAvviso(`Spostata a ${F.dataEstesa(ms(dove.giorno))}`, () => void salva('sessioniPiano', s)))
  })

  if (!piani || !sessioni) return null

  const totale = riepilogoSessioni(delPiano)
  const questaSettimana = riepilogoSessioni(delPiano.filter((s) => s.giorno >= settimana && s.giorno <= giorniSettimana[6]!))
  const mancate = delPiano.filter((s) => !s.fatta && s.giorno < oggiChiave && s.tipo !== 'ripasso').length
  const sessioneAperta = (sessioni ?? []).find((s) => s.id === aperta)

  /** Elimina il piano con tutte le sue sessioni (con "Annulla"). */
  async function eliminaPiano(p: PianoStudio) {
    const sue = (sessioni ?? []).filter((s) => s.pianoId === p.id)
    await elimina('pianiStudio', p.id)
    for (const s of sue) await elimina('sessioniPiano', s.id)
    if (scelto === p.id) setScelto(undefined)
    mostraAvviso(`Piano eliminato: ${p.nome}`, () => void (async () => {
      await ripristina('pianiStudio', p.id)
      for (const s of sue) await ripristina('sessioniPiano', s.id)
    })())
  }
  async function sposta(s: SessionePiano) {
    if (!piano) return
    const giorni = giorniDelPiano(piano).filter((g) => g > s.giorno && g >= oggiChiave && !occupati.has(g))
    const giorno = giorni[0]
    if (!giorno) { mostraAvviso('Non c’è un giorno libero prima della fine del piano'); return }
    await salva('sessioniPiano', { ...s, giorno, tieni: undefined })
    mostraAvviso(`Spostata a ${F.dataEstesa(ms(giorno))}`, () => void salva('sessioniPiano', s))
  }
  async function riprogrammaTutto() {
    if (!piano) return
    const spostamenti = riprogramma(delPiano, piano, oggiChiave, (g) => occupati.has(g))
    const prima = delPiano.filter((s) => spostamenti.some((x) => x.id === s.id))
    for (const x of spostamenti) { const s = delPiano.find((y) => y.id === x.id)!; await salva('sessioniPiano', { ...s, giorno: x.giorno, tieni: undefined }) }
    mostraAvviso(spostamenti.length ? `${spostamenti.length} sessioni riprogrammate` : 'Niente da recuperare', spostamenti.length ? () => void Promise.all(prima.map((s) => salva('sessioniPiano', s))) : undefined)
  }

  return (
    <section className="scheda sezione-piani">
      <h2 className="titolo-sezione titolo-con-icona"><span className="icona-sezione quadratino" style={{ color: '#1C7A5C', background: '#E1F2EA' }}><IconaCalendario dimensione={18} /></span>Piani di studio</h2>
      <div className="schede-piani">
        {elenco.map((p) => {
          const r = riepilogoSessioni((sessioni ?? []).filter((s) => s.pianoId === p.id))
          const perc = r.paginePreviste ? Math.round((r.pagineFatte / r.paginePreviste) * 100) : r.sessioni ? Math.round((r.fatte / r.sessioni) * 100) : 0
          const attivo = p.id === piano?.id
          return (
            <div key={p.id} className="contenitore-piano">
              <button type="button" className={`scheda-piano${attivo ? ' attivo' : ''}`} style={attivo ? { borderColor: p.colore, background: `${p.colore}1f` } : undefined} onClick={() => setScelto(p.id)}>
                <strong style={{ color: attivo ? p.colore : undefined }}>{p.nome}</strong>
                <span className="secondario piccolo">{p.fine >= '2099' ? 'senza scadenza' : `entro ${F.dataBreve(ms(p.fine))}`} · {perc}%</span>
                <span className="barra-mini" style={{ width: '100%' }}><i style={{ width: `${perc}%`, background: p.colore }} /></span>
              </button>
              <button type="button" className="elimina-piano" aria-label={`Elimina il piano ${p.nome}`} title="Elimina il piano" onClick={() => void eliminaPiano(p)}>×</button>
            </div>
          )
        })}
        <button type="button" className="scheda-piano nuovo" onClick={() => setModifica({})}>+ Nuovo piano</button>
      </div>

      {!piano && <span className="secondario piccolo">Crea un piano: scegli le date e i giorni in cui studi. Poi aggiungi le sessioni giorno per giorno, oppure inserisci gli argomenti con le pagine e l'app li divide nei giorni (o lo fa Gemini).</span>}
      {piano && (
        <>
          <div className="riepilogo-piano">
            <span><strong>{totale.pagineFatte}</strong> di {totale.paginePreviste} pagine</span>
            <span><strong>{durata(questaSettimana.minutiFatti)}</strong> di {durata(questaSettimana.minutiPrevisti)} questa settimana</span>
            <span><strong>{questaSettimana.fatte}</strong> di {questaSettimana.sessioni} sessioni</span>
            {mancate > 0 && <span style={{ color: '#A0661A', fontWeight: 600 }}>{mancate} da recuperare</span>}
          </div>
          <div className="riga-azioni">
            <div className="segmenti" style={{ flex: '0 1 260px' }}>
              <button type="button" className={vista === 'settimana' ? 'attivo' : ''} onClick={() => setVista('settimana')}>Settimana</button>
              <button type="button" className={vista === 'argomenti' ? 'attivo' : ''} onClick={() => setVista('argomenti')}>Argomenti</button>
            </div>
            <button type="button" className="pillola" onClick={() => void riprogrammaTutto()}>↻ Riprogramma</button>
            <button type="button" className="pillola" onClick={() => setEsporta(true)}>Esporta</button>
            <button type="button" className="pillola" onClick={() => setModifica({ p: piano })}>Modifica</button>
          </div>

          {vista === 'settimana' && (
            <>
              <div className="riga-azioni centrata">
                <button type="button" className="pulsante tondo" aria-label="Settimana precedente" onClick={() => setSettimana(piuGiorni(settimana, -7))}>‹</button>
                <button type="button" className="pulsante" onClick={() => setSettimana(lunedi(oggiChiave))}>{F.dataBreve(ms(settimana))} – {F.dataBreve(ms(giorniSettimana[6]!))}</button>
                <button type="button" className="pulsante tondo" aria-label="Settimana successiva" onClick={() => setSettimana(piuGiorni(settimana, 7))}>›</button>
              </div>
              <div className="settimana-piano">
                {giorniSettimana.map((g, i) => {
                  const delGiorno = delPiano.filter((s) => s.giorno === g).sort((a, b) => a.tipo.localeCompare(b.tipo))
                  const occ = occupati.get(g)
                  const fuori = g < piano.inizio || g > piano.fine
                  return (
                    <div key={g} data-giorno={g} className={`giorno-piano${g === oggiChiave ? ' oggi' : ''}${fuori ? ' fuori' : ''}`}>
                      <span className="secondario piccolo nome-giorno-piano">{GIORNI[i]} {Number(g.slice(8, 10))}</span>
                      {g === piano.fine && <span className="blocco-piano esame">{piano.nome}: esame/scadenza</span>}
                      {!fuori && g < piano.fine && piano.giorniSettimana.includes(giornoSettimana(g)) && (
                        <button type="button" className="piu-sessione" onClick={() => setNuovaSessione(g)}>+ sessione</button>
                      )}
                      {delGiorno.map((s) => (
                        <div key={s.id} className="rimovibile" {...pressione.gestori(s.id, s)}>
                          <button type="button" className={`blocco-piano ${s.tipo}${s.fatta ? ' fatta' : ''}`}
                            style={s.tipo === 'studio' ? { background: `${piano.colore}24`, color: 'var(--testo)', borderLeft: `3px solid ${piano.colore}` } : { borderColor: piano.colore }}
                            onClick={() => { if (!pressione.eraPressione()) setAperta(s.id) }}>
                            <strong>{s.fatta ? '✓ ' : ''}{s.titolo}</strong>
                            <span>{[pagine(s), durata(s.minuti)].filter(Boolean).join(' · ')}</span>
                          </button>
                          {occ && !s.tieni && !s.fatta && g >= oggiChiave && (
                            <span className="avviso-occupato">⚠ {occ}: forse non riesci.{' '}
                              <button type="button" className="link" onClick={() => void sposta(s)}>Sposta</button> ·{' '}
                              <button type="button" className="link" onClick={() => void salva('sessioniPiano', { ...s, tieni: true })}>Tieni</button>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
              <span className="secondario piccolo">Tocca una sessione per avviare il timer o segnarla fatta; tienila premuta e trascinala in un altro giorno. Tratteggiati = ripassi.</span>
            </>
          )}
          {vista === 'argomenti' && <ElencoArgomenti piano={piano} sessioni={delPiano} risorse={risorse} />}
        </>
      )}

      {sessioneAperta && piano && <SchedaSessione s={sessioneAperta} piano={piano} sessioni={delPiano} risorse={risorse} onChiudi={() => setAperta(undefined)} />}
      {modifica && <FormPiano p={modifica.p} risorse={risorse} sessioni={(sessioni ?? []).filter((s) => s.pianoId === modifica.p?.id)} occupati={occupati}
        onChiudi={(id) => { setModifica(undefined); if (id) setScelto(id) }} />}
      {nuovaSessione && piano && <FormSessione piano={piano} giorno={nuovaSessione} onChiudi={() => setNuovaSessione(undefined)} />}
      {esporta && piano && <EsportaPiano piano={piano} sessioni={delPiano} onChiudi={() => setEsporta(false)} />}
    </section>
  )
}

function ElencoArgomenti({ piano, sessioni, risorse }: { piano: PianoStudio; sessioni: SessionePiano[]; risorse: Risorsa[] }) {
  return (
    <div className="lista">
      {piano.argomenti.map((a) => {
        const sue = sessioni.filter((s) => s.argomentoId === a.id && s.tipo === 'studio')
        const fatte = sue.filter((s) => s.fatta).length
        const fonte = risorse.find((r) => r.id === a.risorsaId)?.titolo ?? a.fonte
        return (
          <div key={a.id} className="riga" style={{ cursor: 'default' }}>
            <span className="crescente">
              <span style={{ fontWeight: 600 }}>{argomentoFinito(sessioni, a.id) ? '✓ ' : ''}{a.nome}</span>
              <span className="secondario piccolo">{[fonte, pagineDi(a) ? `p. ${a.paginaDa}–${a.paginaA}` : '', `${fatte}/${sue.length} sessioni`].filter(Boolean).join(' · ')}</span>
              <span className="barra-mini" style={{ width: '100%' }}><i style={{ width: `${sue.length ? (fatte / sue.length) * 100 : 0}%`, background: piano.colore }} /></span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* Sessione aggiunta a mano in un giorno */

function FormSessione({ piano, giorno, onChiudi, primaDiSalvare, intestazione }: { piano: PianoStudio; giorno: string; onChiudi: () => void; primaDiSalvare?: () => Promise<unknown>; intestazione?: React.ReactNode }) {
  const [b, setB] = useState({ argomentoId: '', titolo: '', tipo: 'studio' as 'studio' | 'ripasso', da: '', a: '', minuti: Math.min(piano.minutiAlGiorno, 60) })
  const argomento = piano.argomenti.find((x) => x.id === b.argomentoId)
  const titolo = argomento?.nome ?? b.titolo.trim()
  const n = (t: string) => (t.trim() === '' || !Number.isFinite(Number(t)) ? undefined : Math.round(Number(t)))
  const valido = titolo !== ''
  async function conferma() {
    if (!valido) return
    await primaDiSalvare?.()
    await salva('sessioniPiano', {
      pianoId: piano.id, giorno, tipo: b.tipo, argomentoId: argomento?.id, titolo: b.tipo === 'ripasso' ? `Ripasso: ${titolo}` : titolo,
      paginaDa: n(b.da), paginaA: n(b.a) ?? n(b.da), minuti: b.minuti,
    })
    onChiudi()
  }
  return (
    <Foglio aperto titolo="Nuova sessione" onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        {intestazione ?? <span className="secondario">{F.dataEstesa(ms(giorno))} · {piano.nome}</span>}
        <div className="segmenti">
          <button type="button" className={b.tipo === 'studio' ? 'attivo' : ''} onClick={() => setB({ ...b, tipo: 'studio' })}>Studio</button>
          <button type="button" className={b.tipo === 'ripasso' ? 'attivo' : ''} onClick={() => setB({ ...b, tipo: 'ripasso' })}>Ripasso</button>
        </div>
        {piano.argomenti.length > 0 && (
          <Campo etichetta="Argomento del piano">
            <select value={b.argomentoId} onChange={(e) => setB({ ...b, argomentoId: e.target.value })}>
              <option value="">— scrivo io —</option>
              {piano.argomenti.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </Campo>
        )}
        {!argomento && <Campo etichetta="Cosa studi"><input value={b.titolo} autoFocus placeholder="es. Preeclampsia (Williams cap. 40)" onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>}
        <div className="campi-affiancati">
          <Campo etichetta="Da pagina"><input inputMode="numeric" value={b.da} onChange={(e) => setB({ ...b, da: e.target.value })} /></Campo>
          <Campo etichetta="A pagina"><input inputMode="numeric" value={b.a} onChange={(e) => setB({ ...b, a: e.target.value })} /></Campo>
          <Campo etichetta="Minuti">
            <input type="number" inputMode="numeric" min={5} max={720} step={5} value={b.minuti} onChange={(e) => setB({ ...b, minuti: Math.max(5, Math.min(720, Math.round(Number(e.target.value) || 0))) })} />
          </Campo>
        </div>
      </div>
    </Foglio>
  )
}

/* Scheda di una sessione */

function SchedaSessione({ s, piano, sessioni, risorse, onChiudi }: { s: SessionePiano; piano: PianoStudio; sessioni: SessionePiano[]; risorse: Risorsa[]; onChiudi: () => void }) {
  const allegati = useCollezione('allegati')
  const [paginaA, setPaginaA] = useState(String(s.paginaA ?? ''))
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string>()
  const argomento = piano.argomenti.find((a) => a.id === s.argomentoId)
  const risorsa = risorse.find((r) => r.id === argomento?.risorsaId)
  const finito = s.argomentoId ? argomentoFinito(sessioni.map((x) => (x.id === s.id ? { ...x, fatta: true } : x)), s.argomentoId) : false

  async function fatta(si: boolean) {
    const n = Number(paginaA)
    await salva('sessioniPiano', { ...s, fatta: si || undefined, paginaA: si && s.paginaDa !== undefined && n >= s.paginaDa ? n : s.paginaA })
    if (!si || !finito) onChiudi()
  }
  async function flashcard() {
    if (!risorsa) return
    setInCorso(true)
    setErrore(undefined)
    try {
      const pdf = await Promise.all((allegati ?? []).filter((a) => a.collegatoA === `risorsa:${risorsa.id}` && a.tipoMime === 'application/pdf')
        .map(async (a) => ({ nome: a.nome, blob: await (await import('../../../dati/allegati')).contenutoAllegato(a) })))
      const carte = await generaFlashcard({ testo: `Fonte: ${risorsa.titolo}. Argomento: ${argomento?.nome}${argomento && pagineDi(argomento) ? `, pagine ${argomento.paginaDa}–${argomento.paginaA}` : ''}`, pdf }, 10)
      for (const c of carte) await salva('flashcard', { domanda: c.domanda, risposta: c.risposta, argomentoId: risorsa.argomentoId, scatola: 1, prossima: chiaveGiorno(oggi()) })
      mostraAvviso(`${carte.length} flashcard create`)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Qualcosa non ha funzionato.')
    } finally {
      setInCorso(false)
    }
  }

  return (
    <Foglio aperto titolo={s.tipo === 'studio' ? 'Sessione di studio' : 'Ripasso'} onChiudi={onChiudi}>
      <div className="modulo">
        <strong style={{ fontSize: 17 }}>{s.titolo}</strong>
        <span className="secondario">{[F.dataEstesa(ms(s.giorno)), piano.nome, risorsa?.titolo ?? argomento?.fonte, pagine(s), durata(s.minuti)].filter(Boolean).join(' · ')}</span>
        {s.minutiFatti ? <span className="secondario piccolo">Studiato finora con il timer: {durata(s.minutiFatti)}</span> : null}
        <div className="campi-affiancati">
          <Campo etichetta="Minuti previsti">
            <input type="number" inputMode="numeric" min={5} max={720} step={5} defaultValue={s.minuti}
              onBlur={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 5 && n <= 720 && n !== s.minuti) void salva('sessioniPiano', { ...s, minuti: n }) }} />
          </Campo>
          <Campo etichetta="Minuti studiati (a mano)">
            <input type="number" inputMode="numeric" min={0} max={720} step={5} defaultValue={s.minutiFatti ?? ''} placeholder="0"
              onBlur={(e) => { const v = e.target.value.trim(); const n = v === '' ? undefined : Math.round(Number(v)); if (n === undefined || (n >= 0 && n <= 720)) if (n !== s.minutiFatti) void salva('sessioniPiano', { ...s, minutiFatti: n || undefined }) }} />
          </Campo>
        </div>
        <button type="button" className="pulsante primario" onClick={() => { avviaSessione(s.id, s.titolo, s.minuti); onChiudi(); mostraAvviso('Timer avviato') }}>▶ Avvia il timer</button>
        {s.paginaDa !== undefined && !s.fatta && (
          <Campo etichetta={`Fino a che pagina hai studiato? (da ${s.paginaDa})`}><input inputMode="numeric" value={paginaA} onChange={(e) => setPaginaA(e.target.value)} /></Campo>
        )}
        <button type="button" className="pulsante" onClick={() => void fatta(!s.fatta)}>{s.fatta ? 'Segna come da fare' : '✓ Fatto'}</button>
        {(finito || (s.fatta && s.argomentoId && argomentoFinito(sessioni, s.argomentoId))) && risorsa && (
          <div className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>Argomento finito</strong>
            <span className="secondario piccolo">Ripassalo con le domande create da Gemini sulla sua fonte ({risorsa.titolo}).</span>
            <div className="riga-azioni">
              <a className="pulsante" href={`#/studio?scheda=quiz&risorse=${risorsa.id}`} onClick={onChiudi}>✦ Crea quiz</a>
              <button type="button" className="pulsante" disabled={inCorso || !leggiChiave()} onClick={() => void flashcard()}>{inCorso ? 'Gemini sta scrivendo…' : '✦ Crea flashcard'}</button>
            </div>
            {errore && <Avviso>{errore}</Avviso>}
          </div>
        )}
        <button type="button" className="pulsante pericolo" onClick={() => void elimina('sessioniPiano', s.id).then(() => { onChiudi(); mostraAvviso('Sessione eliminata', () => void ripristina('sessioniPiano', s.id)) })}>Elimina la sessione</button>
      </div>
    </Foglio>
  )
}

/* Creare o modificare un piano */

function FormPiano({ p, risorse, sessioni, occupati, onChiudi }: {
  p?: PianoStudio; risorse: Risorsa[]; sessioni: SessionePiano[]; occupati: Map<string, string>; onChiudi: (id?: string) => void
}) {
  const esami = useCollezione('esami')
  const oggiChiave = chiaveGiorno(oggi())
  const prossimiEsami = (esami ?? []).filter((e) => e.tipo === 'esame' && e.giorno > oggiChiave).sort((a, b) => a.giorno.localeCompare(b.giorno))
  const id = useMemo(() => p?.id ?? nuovoId(), [p])
  const [b, setB] = useState({
    nome: p?.nome ?? '', colore: p?.colore ?? COLORI_PIANO[0]!, inizio: p?.inizio ?? oggiChiave, fine: p?.fine ?? piuGiorni(oggiChiave, 14),
    esameId: p?.esameId ?? '', minuti: p?.minutiAlGiorno ?? 120, giorni: p?.giorniSettimana ?? [1, 2, 3, 4, 5, 6], ripassi: p?.ripassi ?? true, syllabus: p?.syllabus ?? '',
  })
  const [argomenti, setArgomenti] = useState<ArgomentoPiano[]>(p?.argomenti ?? [])
  const [nuovo, setNuovo] = useState('')
  const [inCorso, setInCorso] = useState<string>()
  const [errore, setErrore] = useState<string>()
  const [pdfSyllabus, setPdfSyllabus] = useState<File>()
  // Gli argomenti servono solo per dividere le pagine: il calendario si può creare anche vuoto.
  const valido = b.nome.trim() !== '' && !!giornoDaChiave(b.inizio) && !!giornoDaChiave(b.fine) && b.fine > b.inizio && b.giorni.length > 0
  const conArgomenti = valido && argomenti.length > 0
  const pianoCorrente = (): PianoStudio => ({
    ...(p ?? { creatoIl: 0, modificatoIl: 0 }), id, nome: b.nome.trim(), colore: b.colore, inizio: b.inizio, fine: b.fine, esameId: b.esameId || undefined,
    minutiAlGiorno: b.minuti, giorniSettimana: [...b.giorni].sort(), ripassi: b.ripassi || undefined, syllabus: b.syllabus.trim() || undefined, argomenti,
  })

  async function estrai() {
    setErrore(undefined)
    setInCorso('estrai')
    try {
      const nomi = await estraiArgomenti({ testo: b.syllabus, pdf: pdfSyllabus ? [{ nome: pdfSyllabus.name, blob: pdfSyllabus }] : [] })
      setArgomenti([...argomenti, ...nomi.filter((x) => !argomenti.some((a) => a.nome.toLowerCase() === x.nome.toLowerCase())).map((x) => ({ id: nuovoId(), ...x }))])
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Qualcosa non ha funzionato.') } finally { setInCorso(undefined) }
  }
  /** Salva il piano e rifà le sessioni non ancora fatte (quelle fatte restano). */
  async function crea(modo: 'dividi' | 'ai') {
    if (!valido) return
    setErrore(undefined)
    setInCorso(modo)
    try {
      const piano = pianoCorrente()
      const daOggi = p ? oggiChiave : undefined
      let nuove
      if (modo === 'dividi') nuove = dividiPagine(piano, id, daOggi)
      else {
        const giorni = giorniDelPiano(piano).filter((g) => !daOggi || g >= daOggi)
        const testo = await organizzaConAI({
          argomenti: argomenti.map((a) => ({ nome: a.nome, fonte: risorse.find((r) => r.id === a.risorsaId)?.titolo ?? a.fonte, paginaDa: a.paginaDa, paginaA: a.paginaA })),
          giorni: giorni.map((g) => ({ giorno: g, occupato: occupati.get(g) })), minutiAlGiorno: b.minuti, fine: b.fine,
        })
        nuove = leggiPianoAI(testo, piano, id)
        if (!nuove.length) throw new Error('Gemini non ha creato un piano valido: riprova o usa "Dividi le pagine".')
      }
      if (b.ripassi && nuove.length) nuove = [...nuove, ...ripassiPer(nuove, b.fine, new Map(argomenti.map((a) => [a.id, a.nome])))]
      await salva('pianiStudio', piano)
      for (const s of sessioni.filter((x) => !x.fatta)) await elimina('sessioniPiano', s.id)
      for (const s of nuove) await salva('sessioniPiano', s)
      mostraAvviso(`${nuove.length} sessioni in calendario`)
      onChiudi(id)
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Qualcosa non ha funzionato.') } finally { setInCorso(undefined) }
  }
  async function soloSalva() {
    if (!valido) return
    await salva('pianiStudio', pianoCorrente())
    onChiudi(id)
  }
  const aggiorna = (i: number, x: Partial<ArgomentoPiano>) => setArgomenti(argomenti.map((a, j) => (j === i ? { ...a, ...x } : a)))
  const numero = (t: string) => (t.trim() === '' ? undefined : Number.isFinite(Number(t)) ? Math.max(0, Math.round(Number(t))) : undefined)

  return (
    <Foglio aperto titolo={p ? 'Modifica il piano' : 'Nuovo piano'} onChiudi={() => onChiudi()}
      azione={p ? <button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void soloSalva()}>Salva</button> : undefined}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={b.nome} autoFocus={!p} placeholder="es. Esame di fine anno" onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
        <div className="riga-azioni">
          {COLORI_PIANO.map((c) => <button key={c} type="button" className="campione-colore" aria-label={`Colore ${c}`} aria-pressed={b.colore === c} style={{ background: c }} onClick={() => setB({ ...b, colore: c })} />)}
        </div>
        {prossimiEsami.length > 0 && (
          <Campo etichetta="Collegato a un esame (facoltativo)">
            <select value={b.esameId} onChange={(e) => { const es = prossimiEsami.find((x) => x.id === e.target.value); setB({ ...b, esameId: e.target.value, fine: es?.giorno ?? b.fine, nome: b.nome || es?.titolo || '' }) }}>
              <option value="">—</option>
              {prossimiEsami.map((e) => <option key={e.id} value={e.id}>{e.titolo} · {F.dataBreve(ms(e.giorno))}</option>)}
            </select>
          </Campo>
        )}
        <div className="campi-affiancati">
          <Campo etichetta="Dal"><input type="date" value={b.inizio} onChange={(e) => setB({ ...b, inizio: e.target.value })} /></Campo>
          <Campo etichetta="Esame o scadenza"><input type="date" value={b.fine} onChange={(e) => setB({ ...b, fine: e.target.value })} /></Campo>
          <Campo etichetta="Al giorno">
            <select value={b.minuti} onChange={(e) => setB({ ...b, minuti: Number(e.target.value) })}>
              {[30, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480, 540, 600].map((m) => <option key={m} value={m}>{durata(m)}</option>)}
            </select>
          </Campo>
        </div>
        <div className="campo">
          <span>Giorni in cui studi</span>
          <div className="riga-azioni">
            {GIORNI.map((g, i) => (
              <button key={g} type="button" className={`pillola${b.giorni.includes(i + 1) ? ' filtro-attivo' : ''}`}
                onClick={() => setB({ ...b, giorni: b.giorni.includes(i + 1) ? b.giorni.filter((x) => x !== i + 1) : [...b.giorni, i + 1] })}>{g}</button>
            ))}
          </div>
        </div>
        <label className="interruttore"><span>Ripassi automatici (dopo 1, 7, 30 giorni)</span><input type="checkbox" checked={b.ripassi} onChange={(e) => setB({ ...b, ripassi: e.target.checked })} /></label>

        <div className="campo">
          <span>Syllabus (facoltativo)</span>
          <textarea rows={3} value={b.syllabus} placeholder="Incolla il programma, oppure allega il PDF" onChange={(e) => setB({ ...b, syllabus: e.target.value })} />
          <div className="riga-azioni">
            <label className="pillola" style={{ position: 'relative', cursor: 'pointer' }}><IconaClip dimensione={14} /> {pdfSyllabus ? pdfSyllabus.name : 'PDF del syllabus'}
              <input type="file" accept="application/pdf" className="file-nascosto" onChange={(e) => setPdfSyllabus(e.target.files?.[0])} />
            </label>
            <button type="button" className="pillola" disabled={!leggiChiave() || (!b.syllabus.trim() && !pdfSyllabus) || !!inCorso} onClick={() => void estrai()}>
              {inCorso === 'estrai' ? 'Gemini sta leggendo…' : '✦ Estrai argomenti e readings con Gemini'}
            </button>
          </div>
        </div>

        <div className="campo">
          <span>Argomenti, fonti e pagine</span>
          {argomenti.map((a, i) => (
            <div key={a.id} className="riga-argomento-piano">
              <input value={a.nome} aria-label="Argomento" onChange={(e) => aggiorna(i, { nome: e.target.value })} className="nome" />
              <select value={a.risorsaId ?? ''} aria-label="Fonte dalla libreria" onChange={(e) => aggiorna(i, { risorsaId: e.target.value || undefined })}>
                <option value="">fonte…</option>
                {risorse.map((r) => <option key={r.id} value={r.id}>{r.titolo}</option>)}
              </select>
              {!a.risorsaId && <input value={a.fonte ?? ''} placeholder="o scrivi (es. Williams cap. 40)" aria-label="Fonte" onChange={(e) => aggiorna(i, { fonte: e.target.value || undefined })} />}
              <span className="pagine">
                p. <input inputMode="numeric" value={a.paginaDa ?? ''} aria-label="Da pagina" onChange={(e) => aggiorna(i, { paginaDa: numero(e.target.value) })} />
                – <input inputMode="numeric" value={a.paginaA ?? ''} aria-label="A pagina" onChange={(e) => aggiorna(i, { paginaA: numero(e.target.value) })} />
              </span>
              <span className="pagine" title="Minuti al giorno solo per questo: si studia ogni giorno insieme agli altri">
                <input inputMode="numeric" value={a.minutiAlGiorno ?? ''} placeholder="—" aria-label="Minuti al giorno per questo argomento" onChange={(e) => aggiorna(i, { minutiAlGiorno: numero(e.target.value) })} /> min/giorno
              </span>
              <button type="button" className="elimina-task" aria-label={`Togli ${a.nome}`} onClick={() => setArgomenti(argomenti.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <input value={nuovo} placeholder="+ argomento (Invio)" onChange={(e) => setNuovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nuovo.trim()) { setArgomenti([...argomenti, { id: nuovoId(), nome: nuovo.trim() }]); setNuovo('') } }} />
        </div>

        {errore && <Avviso>{errore}</Avviso>}
        {p && <span className="secondario piccolo">Rifacendo il calendario, le sessioni già fatte restano; le altre vengono ridistribuite da oggi.</span>}
        {!p && (
          <button type="button" className="pulsante primario" disabled={!valido || !!inCorso} onClick={() => void soloSalva()}>
            Crea il calendario{argomenti.length ? ' (sessioni a mano)' : ''}
          </button>
        )}
        <span className="secondario piccolo">
          {argomenti.length ? 'Oppure fai riempire il calendario con gli argomenti:' : 'Puoi aggiungere le sessioni giorno per giorno. Se inserisci gli argomenti con le pagine, l’app può anche dividerle nei giorni:'}
        </span>
        <div className="due-pulsanti">
          <button type="button" className="pulsante" disabled={!conArgomenti || !!inCorso} onClick={() => void crea('dividi')}>{inCorso === 'dividi' ? '…' : p ? 'Rifai: dividi le pagine' : 'Dividi le pagine'}</button>
          <button type="button" className="pulsante pulsante-gemini" disabled={!conArgomenti || !!inCorso || !leggiChiave()} title={leggiChiave() ? '' : 'Inserisci prima la chiave Gemini'} onClick={() => void crea('ai')}>
            {inCorso === 'ai' ? 'Gemini sta organizzando…' : '✦ Organizza con Gemini'}
          </button>
        </div>
        {!valido && <span className="secondario piccolo">Servono nome, date e almeno un giorno della settimana.</span>}
        {p && (
          <button type="button" className="pulsante pericolo" onClick={() => void (async () => {
            await elimina('pianiStudio', p.id)
            for (const s of sessioni) await elimina('sessioniPiano', s.id)
            onChiudi()
            mostraAvviso(`Eliminato: ${p.nome}`, () => void (async () => { await ripristina('pianiStudio', p.id); for (const s of sessioni) await ripristina('sessioniPiano', s.id) })())
          })()}>Elimina il piano</button>
        )}
      </div>
    </Foglio>
  )
}

/* Esportazione */

function EsportaPiano({ piano, sessioni, onChiudi }: { piano: PianoStudio; sessioni: SessionePiano[]; onChiudi: () => void }) {
  const ordinate = [...sessioni].sort((a, b) => a.giorno.localeCompare(b.giorno))
  const tipo = (s: SessionePiano) => (s.tipo === 'studio' ? 'Studio' : s.tipo === 'ripasso' ? 'Ripasso' : 'Ripasso generale')
  async function pdf() {
    const r = riepilogoSessioni(sessioni)
    const blob = await creaPdf({
      titolo: piano.nome, sottotitolo: `Dal ${F.dataEstesa(ms(piano.inizio))} al ${F.dataEstesa(ms(piano.fine))}`,
      riepilogo: [{ etichetta: 'sessioni', valore: String(r.sessioni) }, { etichetta: 'pagine', valore: String(r.paginePreviste) }, { etichetta: 'ore', valore: durata(r.minutiPrevisti) }, { etichetta: 'fatte', valore: `${r.fatte}` }],
      intestazioni: ['Giorno', 'Tipo', 'Argomento', 'Pagine', 'Tempo', 'Fatto'],
      righe: ordinate.map((s) => ({ celle: [F.dataBreve(ms(s.giorno)), tipo(s), s.titolo, pagine(s), durata(s.minuti), s.fatta ? '✓' : ''] })),
      colonneGrassetto: [2], piede: `Agenda · creato ${F.dataEstesa(Date.now())}`,
    })
    await condividiOScarica(blob, `${piano.nome}.pdf`, piano.nome)
    onChiudi()
  }
  function csv() {
    scarica(blobCSV({
      titolo: piano.nome, intestazioni: ['Data', 'Tipo', 'Argomento', 'Da pagina', 'A pagina', 'Minuti', 'Fatto'],
      righe: ordinate.map((s) => [
        { tipo: 'data', istante: ms(s.giorno) }, { tipo: 'testo', valore: tipo(s) }, { tipo: 'testo', valore: s.titolo },
        s.paginaDa !== undefined ? { tipo: 'intero', valore: s.paginaDa } : { tipo: 'vuota' }, s.paginaA !== undefined ? { tipo: 'intero', valore: s.paginaA } : { tipo: 'vuota' },
        { tipo: 'intero', valore: s.minuti }, { tipo: 'testo', valore: s.fatta ? 'sì' : '' },
      ]),
    }), `${piano.nome}.csv`)
    onChiudi()
  }
  async function ics() {
    const eventi = ordinate.map((s) => {
      const g = giornoDaChiave(s.giorno)!
      return { uid: `piano-${s.id}@agenda`, titolo: `${tipo(s)}: ${s.titolo}`, inizio: istante(g.anno, g.mese, g.giorno), fine: istante(g.anno, g.mese, g.giorno + 1), tuttoIlGiorno: true, note: [pagine(s), durata(s.minuti)].filter(Boolean).join(' · '), modificatoIl: s.modificatoIl }
    })
    await condividiOScarica(new Blob([creaIcs(eventi, piano.nome)], { type: 'text/calendar' }), `${piano.nome}.ics`, piano.nome)
    onChiudi()
  }
  return (
    <Foglio aperto titolo="Esporta il piano" onChiudi={onChiudi}>
      <div className="scelte-rapide">
        <button type="button" className="scelta-rapida" onClick={() => void pdf()}><span className="nome"><strong>PDF</strong><br /><span className="orario">calendario delle sessioni</span></span></button>
        <button type="button" className="scelta-rapida" onClick={csv}><span className="nome"><strong>Excel (CSV)</strong><br /><span className="orario">tutte le sessioni</span></span></button>
        <button type="button" className="scelta-rapida" onClick={() => void ics()}><span className="nome"><strong>Calendario Apple</strong><br /><span className="orario">una voce per sessione</span></span></button>
      </div>
    </Foglio>
  )
}

/* Oggi nei piani (colonna di destra) */

export function OggiNeiPiani() {
  const piani = useCollezione('pianiStudio')
  const sessioni = useCollezione('sessioniPiano')
  const oggiChiave = chiaveGiorno(oggi())
  const colori = new Map((piani ?? []).map((p) => [p.id, p]))
  const diOggi = (sessioni ?? []).filter((s) => s.giorno === oggiChiave && colori.has(s.pianoId))
  if (!piani?.length) return null
  return (
    <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <h2 className="titolo-sezione">Oggi nei piani</h2>
      {diOggi.length === 0 && <span className="secondario piccolo">Niente in programma oggi.</span>}
      {diOggi.map((s) => (
        <div key={s.id} className={`riga-semplice${s.fatta ? ' conclusa' : ''}`}>
          <span className="pallino-fonte" style={{ background: colori.get(s.pianoId)!.colore, width: 10, height: 10, borderRadius: 5 }} />
          <span className="crescente">
            <span style={{ fontWeight: 600, textDecoration: s.fatta ? 'line-through' : undefined }}>{s.titolo}</span>
            <span className="secondario piccolo">{[pagine(s), durata(s.minuti)].filter(Boolean).join(' · ')}</span>
          </span>
          {!s.fatta && <button type="button" className="pillola" aria-label={`Avvia il timer per ${s.titolo}`} onClick={() => { avviaSessione(s.id, s.titolo, s.minuti); mostraAvviso('Timer avviato') }}>▶</button>}
          <button type="button" className="pillola" aria-label={s.fatta ? 'Segna da fare' : 'Segna fatto'} onClick={() => void salva('sessioniPiano', { ...s, fatta: !s.fatta || undefined })}>{s.fatta ? '↺' : '✓'}</button>
        </div>
      ))}
    </section>
  )
}

/** Piano usato per le sessioni aggiunte dall'Agenda senza un piano (id fisso: niente doppioni tra dispositivi). */
const PIANO_LIBERO = 'studio-libero'

/** Nuova sessione di studio dall'Agenda: si sceglie il piano (o "Studio libero") e si compila come in Studio. */
export function NuovaSessioneDaAgenda({ giorno, onChiudi }: { giorno: string; onChiudi: () => void }) {
  const piani = useCollezione('pianiStudio')
  const attivi = (piani ?? []).filter((p) => p.fine >= giorno || p.id === PIANO_LIBERO).sort((a, b) => a.fine.localeCompare(b.fine))
  const [pianoId, setPianoId] = useState<string>()
  if (!piani) return null
  const scelto = attivi.find((p) => p.id === (pianoId ?? attivi.find((x) => x.id !== PIANO_LIBERO)?.id ?? PIANO_LIBERO))
  const libero: PianoStudio = scelto ?? { id: PIANO_LIBERO, nome: 'Studio libero', colore: '#3E7C77', inizio: giorno, fine: '2099-12-31', minutiAlGiorno: 60, giorniSettimana: [1, 2, 3, 4, 5, 6, 7], argomenti: [], creatoIl: 0, modificatoIl: 0 }
  const piano = scelto ?? libero
  return (
    <FormSessione key={piano.id} piano={piano} giorno={giorno} onChiudi={onChiudi}
      primaDiSalvare={piano.id === PIANO_LIBERO && !piani.some((p) => p.id === PIANO_LIBERO) ? () => salva('pianiStudio', { ...libero, creatoIl: undefined, modificatoIl: undefined } as unknown as PianoStudio) : undefined}
      intestazione={(
        <>
          <span className="secondario">{F.dataEstesa(ms(giorno))}</span>
          <Campo etichetta="Piano di studio">
            <select value={piano.id} onChange={(e) => setPianoId(e.target.value)}>
              {attivi.filter((p) => p.id !== PIANO_LIBERO).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              <option value={PIANO_LIBERO}>Studio libero (senza piano)</option>
            </select>
          </Campo>
        </>
      )} />
  )
}

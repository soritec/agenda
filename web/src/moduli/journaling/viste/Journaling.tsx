import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { aggiungiAllegato, contenutoAllegato, eliminaAllegato } from '../../../dati/allegati'
import { useCollezione } from '../../../dati/hooks'
import type { Allegato, PaginaDiario, Taccuino } from '../../../dati/modello'
import { condividiOScarica, creaPdfTaccuino } from '../../../export/pdf'
import { Avviso, Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import {
  IconaAereo, IconaCasa, IconaCerca, IconaCitazione, IconaCuore, IconaElenco, IconaEtichetta, IconaFiore, IconaFoglia, IconaFoto, IconaLibro,
  IconaLucchetto, IconaLuna, IconaMusica, IconaScarica, IconaSole, IconaSpecializzazione, IconaSpunta, IconaStella, IconaStoria, IconaTazza,
} from '../../../interfaccia/icone'
import { mostraAllegato } from '../../../interfaccia/Visualizzatore'
import { HabitTracker } from '../../abitudini/viste/HabitTracker'
import { vai } from '../../../interfaccia/navigazione'
import { celleMese, chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import {
  cerca, COLORI_TACCUINO, COLORI_UMORE, impronta, MODELLI, nuovoSale, testoSemplice, testoSu, TITOLI_TRAMA, TITOLI_UMORE, TRAME, UMORI, umoreDa, umoriDelMese, unAnnoFa, type Trama,
} from '../logica'

type I = (p: { dimensione?: number }) => ReactNode
const ICONE: Record<string, I> = {
  foglia: IconaFoglia, fonendoscopio: IconaSpecializzazione, stella: IconaStella, aereo: IconaAereo, cuore: IconaCuore, libro: IconaLibro,
  sole: IconaSole, luna: IconaLuna, casa: IconaCasa, tazza: IconaTazza, fiore: IconaFiore, musica: IconaMusica,
}
const Icona = ({ nome, dimensione = 20 }: { nome: string; dimensione?: number }) => { const C = ICONE[nome] ?? IconaFoglia; return <C dimensione={dimensione} /> }
const ms = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }

/** Taccuini aperti con il codice in questa sessione (si richiudono ricaricando l'app). */
const sbloccati = new Set<string>()

/** Copertina: colore, icona, trama o foto. */
function Copertina({ t, foto, piccola, children }: { t: Taccuino; foto?: string; piccola?: boolean; children?: ReactNode }) {
  const colore = testoSu(t.colore)
  const trama: Record<Trama, string | undefined> = {
    nessuna: undefined,
    righe: 'repeating-linear-gradient(0deg, transparent 0 13px, rgba(0,0,0,0.09) 13px 14px)',
    puntini: 'radial-gradient(rgba(0,0,0,0.16) 1px, transparent 1.6px)',
    quadretti: 'linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)',
  }
  const tr = trama[(t.trama as Trama) ?? 'nessuna']
  return (
    <div className={`copertina${piccola ? ' piccola' : ''}`} style={foto
      ? { backgroundColor: t.colore, backgroundImage: `linear-gradient(rgba(0,0,0,0.05), rgba(0,0,0,0.45)), url(${foto})`, backgroundSize: 'cover', backgroundPosition: 'center', color: '#fff' }
      : { backgroundColor: t.colore, backgroundImage: tr, backgroundSize: t.trama === 'puntini' ? '10px 10px' : t.trama === 'quadretti' ? '12px 12px' : undefined, color: colore }}>
      {children}
    </div>
  )
}

/** URL dell'immagine di copertina (allegato "copertina:<id>"). */
function useFotoCopertine(taccuini: Taccuino[] | undefined, allegati: Allegato[] | undefined) {
  const [url, setUrl] = useState<Map<string, string>>(new Map())
  const chiave = (allegati ?? []).filter((a) => a.collegatoA.startsWith('copertina:')).map((a) => a.id).join(',')
  useEffect(() => {
    let attivo = true
    const creati: string[] = []
    void (async () => {
      const m = new Map<string, string>()
      for (const t of taccuini ?? []) {
        const a = (allegati ?? []).filter((x) => x.collegatoA === `copertina:${t.id}`).sort((x, y) => y.creatoIl - x.creatoIl)[0]
        if (!a) continue
        try { const u = URL.createObjectURL(await contenutoAllegato(a)); creati.push(u); m.set(t.id, u) } catch { /* foto non disponibile */ }
      }
      if (attivo) setUrl(m)
    })()
    return () => { attivo = false; creati.forEach((u) => URL.revokeObjectURL(u)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taccuini?.length, chiave])
  return url
}

/* Pagina principale: scaffale, umore, un anno fa, ricerca */

export function Journaling({ taccuinoId, paginaId, scheda: schedaParam, meseHabit }: { taccuinoId?: string; paginaId?: string | null; scheda?: string | null; meseHabit?: string | null }) {
  const scheda = schedaParam === 'taccuini' || schedaParam === 'habit' ? schedaParam : 'tutto'
  const taccuini = useCollezione('taccuini')
  const pagine = useCollezione('pagineDiario')
  const allegati = useCollezione('allegati')
  const umoriSegnati = useCollezione('umoriGiorno')
  const [giornoUmore, setGiornoUmore] = useState<string>()
  const foto = useFotoCopertine(taccuini, allegati)
  const [q, setQ] = useState('')
  const [modifica, setModifica] = useState<{ t?: Taccuino }>()
  const [daSbloccare, setDaSbloccare] = useState<Taccuino>()
  const [, aggiorna] = useState(0)
  const oggiChiave = chiaveGiorno(oggi())
  const [mese, setMese] = useState(oggiChiave.slice(0, 7))
  const elenco = [...(taccuini ?? [])].sort((a, b) => a.ordine - b.ordine)
  const aperto = (t: Taccuino) => !t.lucchetto || sbloccati.has(t.id)
  const visibili = (pagine ?? []).filter((p) => { const t = elenco.find((x) => x.id === p.taccuinoId); return t && aperto(t) })
  const taccuino = elenco.find((t) => t.id === taccuinoId)

  function apri(t: Taccuino) {
    if (aperto(t)) vai(`#/journaling/${t.id}`)
    else setDaSbloccare(t)
  }

  if (taccuino) {
    if (!aperto(taccuino)) return <Sblocca t={taccuino} onFatto={() => aggiorna((n) => n + 1)} onChiudi={() => vai('#/journaling')} pagina />
    return <VistaTaccuino t={taccuino} pagine={(pagine ?? []).filter((p) => p.taccuinoId === taccuino.id)} paginaId={paginaId ?? undefined} foto={foto.get(taccuino.id)}
      onModifica={() => setModifica({ t: taccuino })} modifica={modifica} chiudiModifica={() => setModifica(undefined)} />
  }

  const risultati = cerca(visibili, q)
  const umori = umoriDelMese(visibili, mese, umoriSegnati ?? [])
  const ricordi = unAnnoFa(visibili, oggiChiave)
  const [anno, m] = mese.split('-').map(Number) as [number, number]

  return (
    <div className="schermata" style={{ maxWidth: 1000 }}>
      <header className="intestazione" style={{ alignItems: 'center' }}>
        <h1 className="titolo-grande">Journaling e habit tracker</h1>
        <label className="cerca-diario">
          <IconaCerca dimensione={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca nei taccuini" aria-label="Cerca nei taccuini" />
        </label>
      </header>

      <div className="segmenti" role="tablist" style={{ maxWidth: 440 }}>
        {([['tutto', 'Tutto'], ['taccuini', 'Taccuini'], ['habit', 'Habit tracker']] as const).map(([k, t]) => (
          <a key={k} role="tab" aria-selected={scheda === k} className={scheda === k ? 'attivo' : ''} href={`#/journaling?scheda=${k}`}>{t}</a>
        ))}
      </div>

      {scheda === 'habit' && !q.trim() && <HabitTracker meseParam={meseHabit} base="#/journaling?scheda=habit" />}
      {scheda === 'habit' && !q.trim() ? null : q.trim() ? (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione">{risultati.length ? `${risultati.length} ${risultati.length === 1 ? 'pagina trovata' : 'pagine trovate'}` : 'Nessuna pagina trovata'}</h2>
          <div className="lista">
            {risultati.map((p) => (
              <a key={p.id} className="riga" href={`#/journaling/${p.taccuinoId}?pagina=${p.id}`}>
                <span className="crescente">
                  <span style={{ fontWeight: 600 }}>{p.titolo || 'Senza titolo'}</span>
                  <span className="secondario piccolo">{[F.dataEstesa(ms(p.giorno)), elenco.find((t) => t.id === p.taccuinoId)?.nome].filter(Boolean).join(' · ')}</span>
                  <span className="piccolo anteprima-appunto">{testoSemplice(p.testo).slice(0, 140)}</span>
                </span>
              </a>
            ))}
          </div>
          {elenco.some((t) => !aperto(t)) && <span className="secondario piccolo">I taccuini con il lucchetto non sono compresi finché non li apri.</span>}
        </section>
      ) : (
        <>
          <section className="sezione-taccuini">
            {scheda === 'tutto' && (
              <div className="testa-scheda-compatta">
                <h2 className="titolo-sezione">I miei taccuini</h2>
                <a href="#/journaling?scheda=taccuini" className="piccolo">Vedi tutti ›</a>
              </div>
            )}
            <div className={`scaffale${scheda === 'tutto' ? ' in-riga' : ''}`}>
              {elenco.map((t) => (
                <button key={t.id} type="button" className="libro" onClick={() => apri(t)} aria-label={`Apri ${t.nome}`}>
                  <Copertina t={t} foto={foto.get(t.id)}>
                    <span className="icona-copertina"><Icona nome={t.icona} dimensione={20} /></span>
                    <span className="nome-copertina">{t.nome}</span>
                    <span className="info-copertina">{t.lucchetto && <IconaLucchetto dimensione={13} />} {(() => { const n = (pagine ?? []).filter((p) => p.taccuinoId === t.id).length; return `${n} ${n === 1 ? 'pagina' : 'pagine'}` })()}</span>
                  </Copertina>
                </button>
              ))}
              <button type="button" className="libro nuovo" onClick={() => setModifica({})}>+ Nuovo<br />taccuino</button>
            </div>
          </section>

          {scheda === 'tutto' ? (
            <div className="journal-griglia">
              <section className="scheda colonna-habit"><HabitTracker meseParam={meseHabit} base="#/journaling?scheda=tutto" /></section>
              <div className="colonna-diario">
            <section className="scheda scheda-umore">
              <div className="testa-scheda-compatta">
                <h2 className="titolo-sezione">Umore di {F.mese(istante(anno, m, 1))}</h2>
                <span className="riga-azioni">
                  <button type="button" className="freccia-piccola" aria-label="Mese precedente" onClick={() => setMese(new Date(Date.UTC(anno, m - 2, 1)).toISOString().slice(0, 7))}>‹</button>
                  <button type="button" className="freccia-piccola" aria-label="Mese successivo" onClick={() => setMese(new Date(Date.UTC(anno, m, 1)).toISOString().slice(0, 7))}>›</button>
                </span>
              </div>
              <div className="calendario-umore">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((g, i) => <span key={i} className="secondario piccolo">{g}</span>)}
                {celleMese(anno, m).map((g, i) => {
                  if (!g) return <span key={i} />
                  const k = chiaveGiorno(g), u = umori.get(k)
                  const futuro = k > oggiChiave
                  return (
                    <button key={k} type="button" disabled={futuro} className={`giorno-umore${k === oggiChiave ? ' oggi' : ''}${giornoUmore === k ? ' scelto' : ''}`}
                      style={u ? { background: COLORI_UMORE[u] } : undefined} title={u ? TITOLI_UMORE[u] : futuro ? undefined : 'Segna l’umore'}
                      onClick={() => setGiornoUmore(giornoUmore === k ? undefined : k)}>{g.giorno}</button>
                  )
                })}
              </div>
              {giornoUmore ? (
                <div className="scegli-umore">
                  <span className="secondario piccolo">{giornoUmore === oggiChiave ? 'Oggi' : F.dataBreve(ms(giornoUmore))}:</span>
                  {UMORI.map((u) => (
                    <button key={u} type="button" className="pillola piccola" style={{ background: COLORI_UMORE[u], borderColor: COLORI_UMORE[u], color: '#2A2622', fontWeight: umori.get(giornoUmore) === u ? 800 : 500 }}
                      onClick={() => { void salva('umoriGiorno', { id: giornoUmore, giorno: giornoUmore, umore: u }); setGiornoUmore(undefined) }}>{TITOLI_UMORE[u]}</button>
                  ))}
                  {(umoriSegnati ?? []).some((x) => x.id === giornoUmore) && (
                    <button type="button" className="link piccolo" onClick={() => { void elimina('umoriGiorno', giornoUmore); setGiornoUmore(undefined) }}>Togli</button>
                  )}
                </div>
              ) : (
                <div className="legenda">{UMORI.map((u) => <span key={u}><span className="pallino-fonte" style={{ background: COLORI_UMORE[u] }} />{TITOLI_UMORE[u]}</span>)}<span className="secondario">· tocca un giorno per segnarlo</span></div>
              )}
            </section>
            <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="titolo-sezione titolo-con-icona"><IconaStoria dimensione={18} /> Un anno fa</h2>
              {ricordi.length === 0 && <span className="secondario piccolo">Il {F.dataEstesa(ms(`${Number(oggiChiave.slice(0, 4)) - 1}${oggiChiave.slice(4)}`))} non avevi scritto niente. Quando succederà, lo ritroverai qui.</span>}
              {ricordi.map((p) => (
                <a key={p.id} href={`#/journaling/${p.taccuinoId}?pagina=${p.id}`} className="ricordo">
                  <span className="secondario piccolo">{elenco.find((t) => t.id === p.taccuinoId)?.nome}</span>
                  <strong>{p.titolo || 'Senza titolo'}</strong>
                  <span className="testo-diario-anteprima">{testoSemplice(p.testo).slice(0, 180)}</span>
                </a>
              ))}
            </section>
              </div>
            </div>
          ) : (
            <div className="riga-diario">
            <section className="scheda scheda-umore">
              <div className="testa-scheda-compatta">
                <h2 className="titolo-sezione">Umore di {F.mese(istante(anno, m, 1))}</h2>
                <span className="riga-azioni">
                  <button type="button" className="freccia-piccola" aria-label="Mese precedente" onClick={() => setMese(new Date(Date.UTC(anno, m - 2, 1)).toISOString().slice(0, 7))}>‹</button>
                  <button type="button" className="freccia-piccola" aria-label="Mese successivo" onClick={() => setMese(new Date(Date.UTC(anno, m, 1)).toISOString().slice(0, 7))}>›</button>
                </span>
              </div>
              <div className="calendario-umore">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((g, i) => <span key={i} className="secondario piccolo">{g}</span>)}
                {celleMese(anno, m).map((g, i) => {
                  if (!g) return <span key={i} />
                  const k = chiaveGiorno(g), u = umori.get(k)
                  const futuro = k > oggiChiave
                  return (
                    <button key={k} type="button" disabled={futuro} className={`giorno-umore${k === oggiChiave ? ' oggi' : ''}${giornoUmore === k ? ' scelto' : ''}`}
                      style={u ? { background: COLORI_UMORE[u] } : undefined} title={u ? TITOLI_UMORE[u] : futuro ? undefined : 'Segna l’umore'}
                      onClick={() => setGiornoUmore(giornoUmore === k ? undefined : k)}>{g.giorno}</button>
                  )
                })}
              </div>
              {giornoUmore ? (
                <div className="scegli-umore">
                  <span className="secondario piccolo">{giornoUmore === oggiChiave ? 'Oggi' : F.dataBreve(ms(giornoUmore))}:</span>
                  {UMORI.map((u) => (
                    <button key={u} type="button" className="pillola piccola" style={{ background: COLORI_UMORE[u], borderColor: COLORI_UMORE[u], color: '#2A2622', fontWeight: umori.get(giornoUmore) === u ? 800 : 500 }}
                      onClick={() => { void salva('umoriGiorno', { id: giornoUmore, giorno: giornoUmore, umore: u }); setGiornoUmore(undefined) }}>{TITOLI_UMORE[u]}</button>
                  ))}
                  {(umoriSegnati ?? []).some((x) => x.id === giornoUmore) && (
                    <button type="button" className="link piccolo" onClick={() => { void elimina('umoriGiorno', giornoUmore); setGiornoUmore(undefined) }}>Togli</button>
                  )}
                </div>
              ) : (
                <div className="legenda">{UMORI.map((u) => <span key={u}><span className="pallino-fonte" style={{ background: COLORI_UMORE[u] }} />{TITOLI_UMORE[u]}</span>)}<span className="secondario">· tocca un giorno per segnarlo</span></div>
              )}
            </section>
            <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="titolo-sezione titolo-con-icona"><IconaStoria dimensione={18} /> Un anno fa</h2>
              {ricordi.length === 0 && <span className="secondario piccolo">Il {F.dataEstesa(ms(`${Number(oggiChiave.slice(0, 4)) - 1}${oggiChiave.slice(4)}`))} non avevi scritto niente. Quando succederà, lo ritroverai qui.</span>}
              {ricordi.map((p) => (
                <a key={p.id} href={`#/journaling/${p.taccuinoId}?pagina=${p.id}`} className="ricordo">
                  <span className="secondario piccolo">{elenco.find((t) => t.id === p.taccuinoId)?.nome}</span>
                  <strong>{p.titolo || 'Senza titolo'}</strong>
                  <span className="testo-diario-anteprima">{testoSemplice(p.testo).slice(0, 180)}</span>
                </a>
              ))}
            </section>
            </div>
          )}
        </>
      )}

      {modifica && <FormTaccuino t={modifica.t} ordine={(elenco.at(-1)?.ordine ?? 0) + 1} onChiudi={(id) => { setModifica(undefined); if (id) vai(`#/journaling/${id}`) }} />}
      {daSbloccare && <Sblocca t={daSbloccare} onFatto={() => { const id = daSbloccare.id; setDaSbloccare(undefined); vai(`#/journaling/${id}`) }} onChiudi={() => setDaSbloccare(undefined)} />}
    </div>
  )
}

/* Lucchetto */

function Sblocca({ t, onFatto, onChiudi, pagina }: { t: Taccuino; onFatto: () => void; onChiudi: () => void; pagina?: boolean }) {
  const [codice, setCodice] = useState('')
  const [errore, setErrore] = useState(false)
  async function prova() {
    if (!t.lucchetto) return
    if (await impronta(codice, t.lucchetto.sale) === t.lucchetto.impronta) { sbloccati.add(t.id); onFatto() } else { setErrore(true); setCodice('') }
  }
  const contenuto = (
    <div className="modulo" style={{ alignItems: 'center', textAlign: 'center' }}>
      <IconaLucchetto dimensione={30} />
      <strong>{t.nome}</strong>
      <span className="secondario piccolo">Inserisci il codice per aprire il taccuino.</span>
      <input type="password" inputMode="numeric" autoFocus value={codice} onChange={(e) => { setCodice(e.target.value); setErrore(false) }} className="codice-lucchetto"
        onKeyDown={(e) => { if (e.key === 'Enter') void prova() }} aria-label="Codice" />
      {errore && <Avviso>Codice sbagliato.</Avviso>}
      <button type="button" className="pulsante primario" disabled={!codice} onClick={() => void prova()}>Apri</button>
    </div>
  )
  if (pagina) return <div className="schermata" style={{ maxWidth: 420 }}><a href="#/journaling" className="piccolo">‹ Journaling</a>{contenuto}</div>
  return <Foglio aperto titolo="Taccuino chiuso" onChiudi={onChiudi}>{contenuto}</Foglio>
}

/* Creare o modificare un taccuino */

function FormTaccuino({ t, ordine, onChiudi }: { t?: Taccuino; ordine: number; onChiudi: (id?: string) => void }) {
  const allegati = useCollezione('allegati')
  const [b, setB] = useState({ nome: t?.nome ?? '', colore: t?.colore ?? COLORI_TACCUINO[0]!, icona: t?.icona ?? 'foglia', trama: (t?.trama ?? 'nessuna') as Trama })
  const [codice, setCodice] = useState('')
  const [togliLucchetto, setTogliLucchetto] = useState(false)
  const [foto, setFoto] = useState<File>()
  const fotoEsistente = (allegati ?? []).filter((a) => t && a.collegatoA === `copertina:${t.id}`)
  const [togliFoto, setTogliFoto] = useState(false)
  const anteprima = useMemo(() => (foto ? URL.createObjectURL(foto) : undefined), [foto])
  const codiceValido = codice === '' || /^\d{4,8}$/.test(codice)
  const valido = b.nome.trim() !== '' && codiceValido

  async function conferma() {
    if (!valido) return
    const lucchetto = codice ? { sale: nuovoSale(), impronta: '' } : togliLucchetto ? undefined : t?.lucchetto
    if (codice && lucchetto) lucchetto.impronta = await impronta(codice, lucchetto.sale)
    const salvato = await salva('taccuini', { ...t, nome: b.nome.trim(), colore: b.colore, icona: b.icona, trama: b.trama === 'nessuna' ? undefined : b.trama, lucchetto, ordine: t?.ordine ?? ordine })
    if (codice) sbloccati.add(salvato.id)
    if (foto || togliFoto) for (const a of fotoEsistente) await eliminaAllegato(a)
    if (foto) await aggiungiAllegato(foto, `copertina:${salvato.id}`)
    onChiudi(t ? undefined : salvato.id)
  }
  const prova: Taccuino = { id: 'anteprima', creatoIl: 0, modificatoIl: 0, nome: b.nome || 'Nome', colore: b.colore, icona: b.icona, trama: b.trama, ordine: 0 }
  return (
    <Foglio aperto titolo={t ? 'Modifica il taccuino' : 'Nuovo taccuino'} onChiudi={() => onChiudi()}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <div className="anteprima-copertina">
          <Copertina t={prova} foto={togliFoto ? undefined : anteprima}>
            <span className="icona-copertina"><Icona nome={b.icona} dimensione={22} /></span>
            <span className="nome-copertina">{b.nome || 'Nome del taccuino'}</span>
          </Copertina>
        </div>
        <Campo etichetta="Nome"><input value={b.nome} autoFocus={!t} placeholder="es. Diario, Riflessioni dal reparto, Viaggi" onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
        <div className="campo"><span>Colore</span>
          <div className="riga-azioni">{COLORI_TACCUINO.map((c) => <button key={c} type="button" className="campione-colore" aria-label={`Colore ${c}`} aria-pressed={b.colore === c} style={{ background: c }} onClick={() => setB((x) => ({ ...x, colore: c }))} />)}</div>
        </div>
        <div className="campo"><span>Icona</span>
          <div className="riga-azioni">{Object.keys(ICONE).map((n) => (
            <button key={n} type="button" className={`scelta-icona${b.icona === n ? ' scelta' : ''}`} aria-label={n} aria-pressed={b.icona === n} onClick={() => setB((x) => ({ ...x, icona: n }))}><Icona nome={n} dimensione={20} /></button>
          ))}</div>
        </div>
        <div className="campo"><span>Trama</span>
          <div className="riga-azioni">{TRAME.map((x) => <button key={x} type="button" className={`pillola${b.trama === x ? ' filtro-attivo' : ''}`} onClick={() => setB((y) => ({ ...y, trama: x }))}>{TITOLI_TRAMA[x]}</button>)}</div>
        </div>
        <div className="campo"><span>Foto di copertina (facoltativa)</span>
          <div className="riga-azioni">
            <label className="pillola" style={{ position: 'relative', cursor: 'pointer' }}><IconaFoto dimensione={14} /> {foto ? foto.name : 'Scegli una foto'}
              <input type="file" accept="image/*" className="file-nascosto" onChange={(e) => { setFoto(e.target.files?.[0]); setTogliFoto(false) }} />
            </label>
            {(foto || fotoEsistente.length > 0) && !togliFoto && <button type="button" className="pillola" onClick={() => { setFoto(undefined); setTogliFoto(true) }}>Togli la foto</button>}
          </div>
        </div>
        <div className="campo"><span>{t?.lucchetto ? 'Lucchetto attivo: nuovo codice (facoltativo)' : 'Lucchetto (facoltativo): codice di 4–8 cifre'}</span>
          <input type="password" inputMode="numeric" autoComplete="new-password" value={codice} onChange={(e) => setCodice(e.target.value)} placeholder="lascia vuoto per nessun lucchetto" />
          {!codiceValido && <Avviso>Il codice deve avere da 4 a 8 cifre.</Avviso>}
          {t?.lucchetto && <label className="interruttore"><span>Togli il lucchetto</span><input type="checkbox" checked={togliLucchetto} onChange={(e) => setTogliLucchetto(e.target.checked)} /></label>}
          <span className="secondario piccolo">Il lucchetto nasconde il taccuino a chi usa il tuo telefono o il Mac. I dati sono comunque cifrati quando si sincronizzano.</span>
        </div>
        {t && (
          <button type="button" className="pulsante pericolo" onClick={() => void (async () => {
            if (!window.confirm(`Eliminare "${t.nome}" e tutte le sue pagine?`)) return
            await elimina('taccuini', t.id)
            vai('#/journaling')
            onChiudi()
            mostraAvviso(`Eliminato: ${t.nome}`, () => void ripristina('taccuini', t.id))
          })()}>Elimina il taccuino</button>
        )}
      </div>
    </Foglio>
  )
}

/* Dentro un taccuino */

function VistaTaccuino({ t, pagine, paginaId, foto, onModifica, modifica, chiudiModifica }: {
  t: Taccuino; pagine: PaginaDiario[]; paginaId?: string; foto?: string; onModifica: () => void; modifica?: { t?: Taccuino }; chiudiModifica: () => void
}) {
  const ordinate = [...pagine].sort((a, b) => b.giorno.localeCompare(a.giorno) || b.creatoIl - a.creatoIl)
  const pagina = ordinate.find((p) => p.id === paginaId)
  const [modelli, setModelli] = useState(false)
  const [esporta, setEsporta] = useState(false)
  async function nuova(modello: (typeof MODELLI)[number]) {
    setModelli(false)
    const p = await salva('pagineDiario', { taccuinoId: t.id, giorno: chiaveGiorno(oggi()), titolo: modello.id === 'libera' ? '' : modello.titolo, testo: modello.testo })
    vai(`#/journaling/${t.id}?pagina=${p.id}`)
  }
  return (
    <div className="schermata" style={{ maxWidth: 1100 }}>
      <header className="intestazione" style={{ alignItems: 'center' }}>
        <div>
          <a href="#/journaling" className="piccolo">‹ Journaling</a>
          <h1 className="titolo-grande titolo-con-icona"><Copertina t={t} foto={foto} piccola><Icona nome={t.icona} dimensione={16} /></Copertina>{t.nome}</h1>
        </div>
        <div className="riga-azioni">
          <button type="button" className="pulsante" onClick={onModifica}>Modifica copertina</button>
          <button type="button" className="pulsante" onClick={() => setEsporta(true)} disabled={!pagine.length}><IconaScarica dimensione={16} /> Esporta</button>
        </div>
      </header>
      <div className={`diario${pagina ? ' con-pagina' : ''}`}>
        <aside className="elenco-pagine">
          <div className="riga-azioni">
            <button type="button" className="pulsante primario" onClick={() => void nuova(MODELLI[0]!)}>+ Nuova pagina</button>
            <button type="button" className="pulsante" onClick={() => setModelli(true)}>Da modello</button>
          </div>
          <div className="lista">
            {ordinate.length === 0 && <div className="vuoto piccolo">Ancora nessuna pagina.</div>}
            {ordinate.map((p) => {
              const u = umoreDa(p.umore)
              return (
                <a key={p.id} href={`#/journaling/${t.id}?pagina=${p.id}`} className={`riga${p.id === paginaId ? ' pagina-scelta' : ''}`}>
                  {u && <span className="pallino-fonte" style={{ background: COLORI_UMORE[u], width: 10, height: 10, borderRadius: 5 }} />}
                  <span className="crescente">
                    <span style={{ fontWeight: 600 }}>{p.titolo || 'Senza titolo'}</span>
                    <span className="secondario piccolo">{F.dataBreve(ms(p.giorno))}{u ? ` · ${TITOLI_UMORE[u].toLowerCase()}` : ''}</span>
                  </span>
                  <button type="button" className="elimina-task" aria-label={`Elimina ${p.titolo || 'la pagina'}`}
                    onClick={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      void elimina('pagineDiario', p.id).then(() => {
                        if (p.id === paginaId) vai(`#/journaling/${t.id}`)
                        mostraAvviso(`Eliminata: ${p.titolo || 'pagina'}`, () => void ripristina('pagineDiario', p.id))
                      })
                    }}>×</button>
                </a>
              )
            })}
          </div>
        </aside>
        <section className="pagina-aperta">
          {pagina && <a href={`#/journaling/${t.id}`} className="piccolo solo-telefono">‹ Tutte le pagine</a>}
          {pagina ? <EditorPagina key={pagina.id} p={pagina} t={t} /> : <div className="vuoto secondario">Scegli una pagina o scrivine una nuova.</div>}
        </section>
      </div>
      {modelli && (
        <Foglio aperto titolo="Nuova pagina da modello" onChiudi={() => setModelli(false)}>
          <div className="scelte-rapide">
            {MODELLI.map((m) => <button key={m.id} type="button" className="scelta-rapida" onClick={() => void nuova(m)}><span className="nome"><strong>{m.titolo}</strong></span></button>)}
          </div>
        </Foglio>
      )}
      {esporta && <EsportaTaccuino t={t} pagine={ordinate} paginaAperta={pagina} onChiudi={() => setEsporta(false)} />}
      {modifica && <FormTaccuino t={modifica.t} ordine={t.ordine} onChiudi={chiudiModifica} />}
    </div>
  )
}

/** Tiene solo la formattazione ammessa (niente script, stili o link). */
function ripulisci(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const ammessi = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE'])
  const visita = (n: Element) => {
    for (const figlio of [...n.children]) {
      if (!ammessi.has(figlio.tagName)) { figlio.replaceWith(...figlio.childNodes); continue }
      for (const a of [...figlio.attributes]) {
        const ok = a.name === 'class' && ((figlio.tagName === 'UL' && a.value === 'lista-spunta') || (figlio.tagName === 'LI' && a.value === 'fatto'))
        if (!ok) figlio.removeAttribute(a.name)
      }
      visita(figlio)
    }
  }
  const radice = doc.body.firstElementChild!
  visita(radice)
  return radice.innerHTML
}

function EditorPagina({ p, t }: { p: PaginaDiario; t: Taccuino }) {
  const [titolo, setTitolo] = useState(p.titolo)
  const [giorno, setGiorno] = useState(p.giorno)
  const [umore, setUmore] = useState(umoreDa(p.umore))
  const [etichette, setEtichette] = useState(p.etichette ?? [])
  const [nuovaEtichetta, setNuovaEtichetta] = useState('')
  const testo = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ultimo = useRef(p)

  useEffect(() => { if (testo.current) testo.current.innerHTML = ripulisci(p.testo) }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const salvaOra = (extra: Partial<PaginaDiario> = {}) => {
    clearTimeout(timer.current)
    const nuovo = { ...ultimo.current, titolo, giorno, umore, etichette: etichette.length ? etichette : undefined, testo: ripulisci(testo.current?.innerHTML ?? ''), ...extra }
    ultimo.current = nuovo
    void salva('pagineDiario', nuovo)
  }
  const salvaPresto = () => { clearTimeout(timer.current); timer.current = setTimeout(() => salvaOra(), 700) }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => { if (titolo !== p.titolo || giorno !== p.giorno) salvaPresto() }, [titolo, giorno]) // eslint-disable-line react-hooks/exhaustive-deps

  function comando(c: string, valore?: string) {
    testo.current?.focus()
    document.execCommand(c, false, valore)
    salvaPresto()
  }
  function listaSpunta() {
    testo.current?.focus()
    document.execCommand('insertUnorderedList')
    const sel = window.getSelection()?.anchorNode
    const ul = (sel instanceof Element ? sel : sel?.parentElement)?.closest('ul')
    if (ul) ul.className = ul.className === 'lista-spunta' ? '' : 'lista-spunta'
    salvaPresto()
  }
  function clic(e: React.MouseEvent) {
    // Un clic sul quadratino di una lista lo spunta.
    const li = (e.target as HTMLElement).closest('ul.lista-spunta > li') as HTMLElement | null
    if (!li) return
    if (e.clientX - li.getBoundingClientRect().left < 26) { li.classList.toggle('fatto'); if (!li.className) li.removeAttribute('class'); salvaPresto() }
  }
  async function eliminaPagina() {
    clearTimeout(timer.current)
    await elimina('pagineDiario', p.id)
    vai(`#/journaling/${t.id}`)
    mostraAvviso('Pagina eliminata', () => void ripristina('pagineDiario', p.id))
  }

  return (
    <div className="editor-diario">
      <div className="riga-azioni" style={{ justifyContent: 'space-between' }}>
        <input type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} className="data-piccola" aria-label="Giorno" />
        <span className="riga-azioni">
          {UMORI.map((u) => (
            <button key={u} type="button" className="pillola umore" aria-pressed={umore === u}
              style={umore === u ? { background: COLORI_UMORE[u], borderColor: COLORI_UMORE[u], color: '#2A2622', fontWeight: 700 } : undefined}
              onClick={() => { const n = umore === u ? undefined : u; setUmore(n); salvaOra({ umore: n }) }}>{TITOLI_UMORE[u]}</button>
          ))}
        </span>
      </div>
      <input className="titolo-pagina" value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Titolo" aria-label="Titolo" />
      <div className="barra-strumenti" role="toolbar" aria-label="Formattazione" onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button')) e.preventDefault() }}>
        <button type="button" onClick={() => comando('bold')} aria-label="Grassetto"><b>G</b></button>
        <button type="button" onClick={() => comando('italic')} aria-label="Corsivo"><i>C</i></button>
        <button type="button" onClick={() => comando('formatBlock', 'h3')} aria-label="Titoletto">Titoletto</button>
        <button type="button" onClick={() => comando('insertUnorderedList')} aria-label="Elenco"><IconaElenco dimensione={16} /></button>
        <button type="button" onClick={listaSpunta} aria-label="Lista da spuntare"><IconaSpunta dimensione={16} /></button>
        <button type="button" onClick={() => comando('formatBlock', 'blockquote')} aria-label="Citazione"><IconaCitazione dimensione={16} /></button>
        <button type="button" onClick={() => comando('formatBlock', 'p')} aria-label="Testo normale">Testo</button>
      </div>
      <div ref={testo} className="testo-diario" contentEditable suppressContentEditableWarning onInput={salvaPresto} onBlur={() => salvaOra()} onClick={clic}
        data-vuoto="Scrivi qui…" role="textbox" aria-multiline="true" aria-label="Testo della pagina" />
      <Galleria collegatoA={`pagina:${p.id}`} />
      <div className="riga-azioni etichette-diario">
        <IconaEtichetta dimensione={16} />
        {etichette.map((e) => (
          <span key={e} className="pillola piccola">#{e} <button type="button" className="link" aria-label={`Togli ${e}`} onClick={() => { const n = etichette.filter((x) => x !== e); setEtichette(n); salvaOra({ etichette: n.length ? n : undefined }) }}>×</button></span>
        ))}
        <input value={nuovaEtichetta} placeholder="+ etichetta" className="data-piccola" style={{ width: 120 }} onChange={(e) => setNuovaEtichetta(e.target.value.replace(/\s+/g, '-'))}
          onKeyDown={(e) => { if (e.key === 'Enter' && nuovaEtichetta.trim()) { const n = [...new Set([...etichette, nuovaEtichetta.trim().replace(/^#/, '')])]; setEtichette(n); setNuovaEtichetta(''); salvaOra({ etichette: n }) } }} />
      </div>
      {t.icona === 'fonendoscopio' || /reparto|turn|ospedal/i.test(t.nome) ? <NotaPrivacy /> : <span className="secondario piccolo">Si salva da solo mentre scrivi.</span>}
      <button type="button" className="pulsante pericolo" style={{ alignSelf: 'flex-start' }} onClick={() => void eliminaPagina()}>Elimina la pagina</button>
    </div>
  )
}

/** Foto della pagina, come miniature (si aprono nel visore). */
function Galleria({ collegatoA }: { collegatoA: string }) {
  const allegati = useCollezione('allegati')
  const foto = (allegati ?? []).filter((a) => a.collegatoA === collegatoA)
  const [url, setUrl] = useState<Map<string, string>>(new Map())
  const [errore, setErrore] = useState<string>()
  const chiave = foto.map((f) => f.id).join(',')
  useEffect(() => {
    let attivo = true
    const creati: string[] = []
    void (async () => {
      const m = new Map<string, string>()
      for (const f of foto) { try { const u = URL.createObjectURL(await contenutoAllegato(f)); creati.push(u); m.set(f.id, u) } catch { /* non disponibile */ } }
      if (attivo) setUrl(m)
    })()
    return () => { attivo = false; creati.forEach((u) => URL.revokeObjectURL(u)) }
  }, [chiave]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="galleria">
      {foto.map((f) => (
        <div key={f.id} className="miniatura rimovibile">
          <button type="button" onClick={() => mostraAllegato(f)} aria-label={`Apri ${f.nome}`}>{url.get(f.id) ? <img src={url.get(f.id)} alt={f.nome} /> : <IconaFoto dimensione={20} />}</button>
          <button type="button" className="x-elimina" style={{ display: 'flex' }} aria-label={`Togli ${f.nome}`} onClick={() => void eliminaAllegato(f).then((annulla) => mostraAvviso('Foto tolta', () => void annulla()))}>×</button>
        </div>
      ))}
      <label className="miniatura aggiungi-foto">
        <IconaFoto dimensione={20} /><span className="piccolo">Foto</span>
        <input type="file" accept="image/*" multiple className="file-nascosto" onChange={(e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          void (async () => { for (const f of files) { try { await aggiungiAllegato(f, collegatoA) } catch (x) { setErrore(x instanceof Error ? x.message : 'Foto non aggiunta') } } })()
        }} />
      </label>
      {errore && <Avviso>{errore}</Avviso>}
    </div>
  )
}

/* Esportazione */

function EsportaTaccuino({ t, pagine, paginaAperta, onChiudi }: { t: Taccuino; pagine: PaginaDiario[]; paginaAperta?: PaginaDiario; onChiudi: () => void }) {
  const allegati = useCollezione('allegati')
  const [stato, setStato] = useState<string>()
  async function esporta(quali: PaginaDiario[], nome: string) {
    setStato('Preparo il PDF…')
    const dati = []
    for (const p of [...quali].sort((a, b) => a.giorno.localeCompare(b.giorno))) {
      const foto: Blob[] = []
      for (const a of (allegati ?? []).filter((x) => x.collegatoA === `pagina:${p.id}` && x.tipoMime.startsWith('image/'))) { try { foto.push(await contenutoAllegato(a)) } catch { /* salta */ } }
      const u = umoreDa(p.umore)
      dati.push({ titolo: p.titolo, data: F.dataEstesa(ms(p.giorno)), umore: u ? `umore: ${TITOLI_UMORE[u].toLowerCase()}` : undefined, testo: testoSemplice(p.testo), etichette: p.etichette, foto })
    }
    const blob = await creaPdfTaccuino({ nome: t.nome, colore: t.colore, testoCopertina: testoSu(t.colore) }, dati)
    await condividiOScarica(blob, `${nome}.pdf`, nome)
    onChiudi()
  }
  return (
    <Foglio aperto titolo="Esporta" onChiudi={onChiudi}>
      {stato && <span className="secondario">{stato}</span>}
      <div className="scelte-rapide">
        <button type="button" className="scelta-rapida" onClick={() => void esporta(pagine, t.nome)}><span className="nome"><strong>Tutto il taccuino</strong><br /><span className="orario">PDF con copertina · {pagine.length} pagine</span></span></button>
        {paginaAperta && <button type="button" className="scelta-rapida" onClick={() => void esporta([paginaAperta], paginaAperta.titolo || 'Pagina')}><span className="nome"><strong>Solo questa pagina</strong><br /><span className="orario">{paginaAperta.titolo || 'Senza titolo'}</span></span></button>}
      </div>
    </Foglio>
  )
}

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { aggiungiGiorni, componenti, giornoDi, istante } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Evento } from '../../../dati/modello'
import { creaIcs, type EventoIcs } from '../../../export/ics'
import { condividiOScarica } from '../../../export/pdf'
import { Avviso, Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro, IconaPiu } from '../../../interfaccia/icone'
import { vai } from '../../../interfaccia/navigazione'
import { FormAttivita } from '../../specializzazione/viste/Esami'
import { celleMese, chiaveGiorno, giornoDaChiave, minutiDaOrario, oggi, orarioDaMinuti, perId } from '../../turni/supporto'
import {
  blocchiPerGiorno, CATEGORIE_EVENTO, categoriaDa, FONTI, giorniTra, impegniTra, lunediDi, perGiorno, spostaGiorni, testoOrario,
  TITOLI_CATEGORIA, TITOLI_FONTE, TITOLO_VOCE, type CategoriaEvento, type Fonte, type Impegno,
} from '../impegni'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const CHIAVE_FILTRI = 'agenda.fontiNascoste'
const CHIAVE_VISTA = 'agenda.vista'
export const VISTE = ['mese', 'dueSettimane', 'settimana'] as const
export type Vista = (typeof VISTE)[number]
const TITOLI_VISTA: Record<Vista, string> = { mese: 'Mese', dueSettimane: '2 settimane', settimana: 'Settimana' }

function leggi<T>(chiave: string, ripiego: T): T {
  try {
    const v = localStorage.getItem(chiave)
    return v ? (JSON.parse(v) as T) : ripiego
  } catch {
    return ripiego
  }
}
function scrivi(chiave: string, valore: unknown) {
  try { localStorage.setItem(chiave, JSON.stringify(valore)) } catch { /* solo comodità */ }
}

const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const dataEstesa = (g: string) => F.dataEstesa(msGiorno(g))
const dataBreve = (g: string) => F.dataBreve(msGiorno(g))
const nomeMese = (g: string) => F.mese(msGiorno(g))
const numeroGiorno = (g: string) => Number(g.slice(8, 10))

/** Indirizzo dell'agenda con vista e periodo. */
export const linkAgenda = (vista: Vista, giorno: string) => `#/agenda?vista=${vista}&giorno=${giorno}`

/** Che cosa aggiungere e quando (dal "+"). */
interface Aggiunta { giorno: string; minuto?: number; cosa?: 'evento' | 'esame' | 'lezione' }

/** Tutti gli impegni in un solo calendario, a mese, due settimane o settimana. */
export function Agenda({ vistaParam, giornoParam, eventoAperto }: { vistaParam?: string | null; giornoParam?: string | null; eventoAperto?: string }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const assegnazioni = useCollezione('assegnazioni')
  const giornate = useCollezione('ferie')
  const eventi = useCollezione('eventi')
  const esami = useCollezione('esami')
  const tasse = useCollezione('tasse')
  const impostazioni = useImpostazioni()
  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])

  const oggiChiave = chiaveGiorno(oggi())
  const vista: Vista = (VISTE as readonly string[]).includes(vistaParam ?? '') ? (vistaParam as Vista) : leggi<Vista>(CHIAVE_VISTA, 'mese')
  const riferimento = giornoParam && giornoDaChiave(giornoParam) ? giornoParam : oggiChiave
  useEffect(() => scrivi(CHIAVE_VISTA, vista), [vista])

  const [nascoste, setNascoste] = useState(() => new Set(leggi<Fonte[]>(CHIAVE_FILTRI, [])))
  const [scelto, setScelto] = useState(riferimento)
  const [aggiunta, setAggiunta] = useState<Aggiunta>()
  const [eventoInModifica, setEventoInModifica] = useState<string | undefined>(eventoAperto)
  const [esporta, setEsporta] = useState(false)

  // Periodo mostrato
  const meseInizio = `${riferimento.slice(0, 7)}-01`
  const [da, a] = vista === 'mese'
    ? [meseInizio, spostaGiorni(spostaGiorni(meseInizio, 31).slice(0, 7) + '-01', -1)]
    : [lunediDi(riferimento), spostaGiorni(lunediDi(riferimento), vista === 'settimana' ? 6 : 13)]
  const passo = (verso: 1 | -1) => vista === 'mese'
    ? (() => { const c = giornoDaChiave(meseInizio)!; const m = c.mese + verso; return chiaveGiorno({ anno: c.anno + (m > 12 ? 1 : m < 1 ? -1 : 0), mese: ((m + 11) % 12) + 1, giorno: 1 }) })()
    : spostaGiorni(da, verso * (vista === 'settimana' ? 7 : 14))
  const etichetta = vista === 'mese' ? nomeMese(meseInizio)
    : da.slice(0, 7) === a.slice(0, 7) ? `${numeroGiorno(da)} – ${numeroGiorno(a)} ${nomeMese(a)}`
    : `${dataBreve(da)} – ${dataBreve(a)} ${a.slice(0, 4)}`

  const dati = { turni, modelli: mappaModelli, sedi: mappaSedi, assegnazioni, giornate, eventi, esami, tasse }
  // Dal giorno prima, per le notti che continuano nel primo giorno mostrato.
  const tutti = useMemo(() => impegniTra(dati, spostaGiorni(da, -1), vista === 'mese' ? spostaGiorni(a, 30) : a),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [turni, mappaModelli, mappaSedi, assegnazioni, giornate, eventi, esami, tasse, da, a, vista])
  const visibili = tutti.filter((i) => !nascoste.has(i.fonte))
  const sabatoFestivo = impostazioni?.sabatoFestivo ?? true
  const festivo = (g: string) => eFestivo(msGiorno(g), { sabatoFestivo })

  function cambiaFiltro(f: Fonte) {
    const n = new Set(nascoste)
    if (n.has(f)) n.delete(f); else n.add(f)
    setNascoste(n)
    scrivi(CHIAVE_FILTRI, [...n])
  }
  /** Gli impegni dell'agenda si aprono qui; il resto porta alla sua sezione. */
  function apri(i: Impegno, e?: MouseEvent) {
    if (i.fonte !== 'evento') return
    e?.preventDefault()
    setEventoInModifica(i.id)
  }
  const evento = eventi?.find((e) => e.id === eventoInModifica)
  const chiudiEvento = () => {
    setEventoInModifica(undefined)
    if (eventoAperto) vai(linkAgenda(vista, riferimento))
  }
  const comuni = { visibili, oggiChiave, festivo, apri, aggiungi: (giorno: string, minuto?: number) => setAggiunta({ giorno, minuto }) }

  return (
    <div className="schermata">
      <header className="testata-turni">
        <h1 className="titolo-grande">Agenda</h1>
        <div className="segmenti scelta-vista" role="radiogroup" aria-label="Vista">
          {VISTE.map((v) => (
            <a key={v} role="radio" aria-checked={vista === v} className={vista === v ? 'attivo' : ''} href={linkAgenda(v, riferimento)}>{TITOLI_VISTA[v]}</a>
          ))}
        </div>
        <div className="riga-azioni azioni">
          <button type="button" className="pulsante" onClick={() => setEsporta(true)}>Calendario Apple</button>
          <button type="button" className="pulsante tondo primario" aria-label="Aggiungi" onClick={() => setAggiunta({ giorno: vista === 'mese' ? scelto : riferimento })}><IconaPiu dimensione={18} /></button>
        </div>
      </header>
      <div className="riga-azioni navigazione-mese">
        <a className="pulsante tondo" href={linkAgenda(vista, passo(-1))} aria-label="Precedente"><IconaIndietro dimensione={18} /></a>
        <a className="pulsante" href={linkAgenda(vista, oggiChiave)} onClick={() => setScelto(oggiChiave)} title="Torna a oggi"
          style={{ minWidth: 170, fontWeight: 600, textTransform: 'capitalize' }}>{etichetta}</a>
        <a className="pulsante tondo" href={linkAgenda(vista, passo(1))} aria-label="Successivo"><IconaAvanti dimensione={18} /></a>
      </div>

      <div className="filtri-agenda" role="group" aria-label="Cosa mostrare">
        {FONTI.map((f) => (
          <button key={f} type="button" className={`pillola${nascoste.has(f) ? ' spenta' : ''}`} aria-pressed={!nascoste.has(f)} onClick={() => cambiaFiltro(f)}>
            <span className={`pallino-fonte f-${f}`} />{TITOLI_FONTE[f]}
          </button>
        ))}
      </div>

      {vista === 'mese' && <VistaMese {...comuni} meseInizio={meseInizio} scelto={scelto.startsWith(meseInizio.slice(0, 7)) ? scelto : meseInizio} onScegli={setScelto} />}
      {vista === 'dueSettimane' && <VistaDueSettimane {...comuni} giorni={giorniTra(da, a)} />}
      {vista === 'settimana' && <VistaSettimana {...comuni} giorni={giorniTra(da, a)} />}

      {aggiunta && !aggiunta.cosa && <SceltaAggiunta aggiunta={aggiunta} onScegli={(cosa) => setAggiunta({ ...aggiunta, cosa })} onChiudi={() => setAggiunta(undefined)} />}
      {aggiunta?.cosa === 'evento' && <FormEvento giorno={aggiunta.giorno} minuto={aggiunta.minuto} onChiudi={() => setAggiunta(undefined)} />}
      {(aggiunta?.cosa === 'esame' || aggiunta?.cosa === 'lezione') && <FormAttivita tipo={aggiunta.cosa} giorno={aggiunta.giorno} onChiudi={() => setAggiunta(undefined)} />}
      {evento && <FormEvento key={evento.id} record={evento} giorno={evento.giorno} onChiudi={chiudiEvento} />}
      {esporta && <EsportaCalendario anno={Number(riferimento.slice(0, 4))} mese={Number(riferimento.slice(5, 7))} dati={dati} nascoste={nascoste} onChiudi={() => setEsporta(false)} />}
    </div>
  )
}

interface PropsVista {
  visibili: Impegno[]
  oggiChiave: string
  festivo: (g: string) => boolean
  apri: (i: Impegno, e?: MouseEvent) => void
  aggiungi: (giorno: string, minuto?: number) => void
}

/** Il "+" chiede che cosa aggiungere; i turni si inseriscono nella loro sezione. */
function SceltaAggiunta({ aggiunta, onScegli, onChiudi }: { aggiunta: Aggiunta; onScegli: (c: 'evento' | 'esame' | 'lezione') => void; onChiudi: () => void }) {
  const voce = (titolo: string, dettaglio: string, azione: () => void, colore: string) => (
    <button type="button" className="scelta-rapida" onClick={azione}>
      <span className={`pallino-fonte ${colore}`} style={{ width: 10, height: 10, borderRadius: 5 }} />
      <span className="nome"><strong>{titolo}</strong><br /><span className="orario">{dettaglio}</span></span>
    </button>
  )
  return (
    <Foglio aperto titolo="Aggiungi" onChiudi={onChiudi}>
      <p className="secondario" style={{ margin: 0, textTransform: 'capitalize' }}>
        {dataEstesa(aggiunta.giorno)}{aggiunta.minuto !== undefined ? ` · ${orarioDaMinuti(aggiunta.minuto)}` : ''}
      </p>
      <div className="scelte-rapide">
        {voce('Impegno', 'visita, riunione, appuntamento…', () => onScegli('evento'), 'f-evento')}
        {voce('Turno', 'guardia, reparto, sala…', () => vai(`#/turni/nuovi?mese=${aggiunta.giorno.slice(0, 7)}&giorni=${aggiunta.giorno}`), 'f-turno')}
        {voce('Ferie o riposo', 'dal calendario dei turni', () => vai(`#/turni?mese=${aggiunta.giorno.slice(0, 7)}`), 'f-giornata')}
        {voce('Esame', 'della specializzazione', () => onScegli('esame'), 'f-esame')}
        {voce('Lezione', 'della specializzazione', () => onScegli('lezione'), 'f-lezione')}
      </div>
    </Foglio>
  )
}

/* Vista mese: griglia con i nomi (pallini su iPhone) e l'elenco del giorno scelto. */

function VistaMese({ visibili, oggiChiave, festivo, apri, aggiungi, meseInizio, scelto, onScegli }: PropsVista & { meseInizio: string; scelto: string; onScegli: (g: string) => void }) {
  const c = giornoDaChiave(meseInizio)!
  const mappa = perGiorno(visibili)
  const delGiorno = mappa.get(scelto) ?? []
  const prossimi = visibili.filter((i) => i.giorno > scelto).slice(0, 12)
  return (
    <div className="colonne">
      <div className="principale">
        <section className="mese grande agenda" aria-label="Calendario del mese: tocca un giorno per vedere i suoi impegni">
          <div className="giorni-settimana">{GIORNI.map((g) => <span key={g}>{g}</span>)}</div>
          <div className="griglia">
            {celleMese(c.anno, c.mese).map((g, i) => {
              if (!g) return <span key={`v${i}`} />
              const k = chiaveGiorno(g)
              const voci = mappa.get(k) ?? []
              const classi = ['cella', festivo(k) && 'festivo', k === oggiChiave && 'oggi', k === scelto && 'selezionato'].filter(Boolean).join(' ')
              return (
                <div key={k} className={classi}>
                  <button type="button" className="aggiungi" onClick={() => onScegli(k)} onDoubleClick={() => aggiungi(k)}
                    aria-label={`${dataEstesa(k)}: ${voci.length ? `${voci.length} impegni` : 'nessun impegno'}`} />
                  <span className="numero">{g.giorno}</span>
                  <button type="button" className="piu-giorno" aria-label={`Aggiungi il ${dataEstesa(k)}`} onClick={() => aggiungi(k)}>+</button>
                  <span className="voci">
                    {voci.slice(0, 3).map((v) => <span key={v.chiave} className={`${classeVoce(v)}${v.concluso ? ' conclusa' : ''}`}>{v.titolo}</span>)}
                    {voci.length > 3 && <span className="altre">+{voci.length - 3}</span>}
                  </span>
                  <span className="puntini" aria-hidden="true">{voci.slice(0, 4).map((v) => <span key={v.chiave} className={`pallino-fonte f-${v.fonte}`} />)}</span>
                </div>
              )
            })}
          </div>
        </section>
        <span className="secondario piccolo">Tocca un giorno per vedere i suoi impegni. Con il + aggiungi impegni, turni, esami e lezioni.</span>
      </div>
      <aside className="laterale-destra">
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="intestazione" style={{ alignItems: 'center' }}>
            <h2 className="titolo-sezione" style={{ textTransform: 'capitalize' }}>{scelto === oggiChiave ? 'Oggi' : dataEstesa(scelto)}</h2>
            <button type="button" className="pulsante piccolo" onClick={() => aggiungi(scelto)}>+ Aggiungi</button>
          </div>
          <ElencoImpegni voci={delGiorno} vuoto="Niente in programma" onApri={apri} />
        </section>
        {prossimi.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="titolo-sezione">Nei giorni dopo</h2>
            <ElencoImpegni voci={prossimi} conData onApri={apri} />
          </section>
        )}
      </aside>
    </div>
  )
}

/* Vista due settimane: ogni giorno con tutti gli impegni scritti per esteso (su iPhone diventa un elenco). */

function VistaDueSettimane({ visibili, oggiChiave, festivo, apri, aggiungi, giorni }: PropsVista & { giorni: string[] }) {
  const mappa = perGiorno(visibili)
  return (
    <section className="due-settimane" aria-label="Due settimane">
      <div className="giorni-settimana">{GIORNI.map((g) => <span key={g}>{g}</span>)}</div>
      <div className="griglia">
        {giorni.map((g) => {
          const voci = mappa.get(g) ?? []
          return (
            <div key={g} className={['giorno-esteso', festivo(g) && 'festivo', g === oggiChiave && 'oggi'].filter(Boolean).join(' ')}>
              <div className="testa-giorno">
                <span className="numero">{numeroGiorno(g)}</span>
                <span className="nome-giorno">{F.dataEstesa(msGiorno(g)).split(' ')[0]}{numeroGiorno(g) === 1 ? ` · ${nomeMese(g).split(' ')[0]}` : ''}</span>
                <button type="button" className="piu-giorno" aria-label={`Aggiungi il ${dataEstesa(g)}`} onClick={() => aggiungi(g)}>+</button>
              </div>
              {voci.map((v) => (
                <a key={v.chiave} href={v.link} onClick={(e) => apri(v, e)} className={`voce-estesa ${classeVoce(v)}${v.concluso ? ' conclusa' : ''}`}>
                  {v.minutoInizio !== undefined && <span className="ora numeri">{testoOrario(v)}</span>}
                  <span className="titolo">{v.titolo}</span>
                  {v.dettaglio && <span className="dettaglio">{v.dettaglio}</span>}
                </a>
              ))}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* Vista settimana: colonne per giorno e righe per ora, con gli impegni scritti per esteso. */

const ALTEZZA_ORA = 48

function VistaSettimana({ visibili, oggiChiave, festivo, apri, aggiungi, giorni }: PropsVista & { giorni: string[] }) {
  const blocchi = blocchiPerGiorno(visibili, giorni)
  const tuttoIlGiorno = perGiorno(visibili.filter((i) => i.minutoInizio === undefined))
  // Fascia oraria: almeno 7–22, allargata se serve (le notti che continuano dal giorno prima non la allargano).
  const propri = [...blocchi.values()].flat().filter((b) => !b.continuaPrima)
  const oraDa = Math.min(7, ...propri.map((b) => Math.floor(b.da / 60)))
  const oraA = Math.max(22, ...propri.map((b) => Math.ceil(b.a / 60)))
  const ore = Array.from({ length: oraA - oraDa }, (_, i) => oraDa + i)
  const altezza = ore.length * ALTEZZA_ORA
  const y = (minuti: number) => ((Math.min(Math.max(minuti, oraDa * 60), oraA * 60) - oraDa * 60) / 60) * ALTEZZA_ORA
  const [adesso, setAdesso] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setAdesso(Date.now()), 60_000); return () => clearInterval(t) }, [])
  const minutoAdesso = (() => { const c = giornoDi(adesso); return Math.round((adesso - istante(c.anno, c.mese, c.giorno)) / 60_000) })()
  const contenitore = useRef<HTMLDivElement>(null)

  // Su iPhone si parte dalla colonna di oggi.
  useEffect(() => {
    const i = giorni.indexOf(oggiChiave)
    const el = contenitore.current
    if (el && i > 0 && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.querySelectorAll('.colonna-giorno')[i] as HTMLElement | undefined)?.offsetLeft ?? 0
  }, [giorni, oggiChiave])

  function clicVuoto(g: string, e: MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const r = e.currentTarget.getBoundingClientRect()
    const minuto = oraDa * 60 + Math.floor(((e.clientY - r.top) / ALTEZZA_ORA) * 2) * 30
    aggiungi(g, Math.min(minuto, 23 * 60 + 30))
  }

  return (
    <div className="settimana-scorri" ref={contenitore}>
      <div className="settimana" style={{ gridTemplateColumns: `44px repeat(${giorni.length}, minmax(var(--colonna-giorno), 1fr))` }}>
        <div className="angolo" />
        {giorni.map((g) => (
          <div key={g} className={`testa-colonna${g === oggiChiave ? ' oggi' : ''}${festivo(g) ? ' festivo' : ''}`}>
            <span className="secondario piccolo">{GIORNI[componenti(msGiorno(g)).giornoSettimana - 1]}</span>
            <span className="numero">{numeroGiorno(g)}</span>
            <button type="button" className="piu-giorno" aria-label={`Aggiungi il ${dataEstesa(g)}`} onClick={() => aggiungi(g)}>+</button>
          </div>
        ))}
        <div className="etichetta-ore secondario piccolo">giorno</div>
        {giorni.map((g) => (
          <div key={g} className="riga-giornata">
            {(tuttoIlGiorno.get(g) ?? []).map((v) => (
              <a key={v.chiave} href={v.link} onClick={(e) => apri(v, e)} className={`${classeVoce(v)}${v.concluso ? ' conclusa' : ''}`} title={v.titolo}>{v.titolo}</a>
            ))}
            {(blocchi.get(g) ?? []).filter((b) => b.continuaPrima && b.a <= oraDa * 60).map((b) => (
              <a key={`c${b.impegno.chiave}`} href={b.impegno.link} onClick={(e) => apri(b.impegno, e)} className={classeVoce(b.impegno)}>
                {b.impegno.titolo} fino alle {orarioDaMinuti(b.a)}
              </a>
            ))}
          </div>
        ))}
        <div className="colonna-ore" style={{ height: altezza }}>
          {ore.map((h, i) => i > 0 && <span key={h} style={{ top: i * ALTEZZA_ORA }}>{h}:00</span>)}
        </div>
        {giorni.map((g) => (
          <div key={g} className={`colonna-giorno${festivo(g) ? ' festivo' : ''}`} style={{ height: altezza, backgroundSize: `100% ${ALTEZZA_ORA}px` }}
            onClick={(e) => clicVuoto(g, e)} title="Clic su un orario libero per aggiungere">
            {g === oggiChiave && minutoAdesso >= oraDa * 60 && minutoAdesso <= oraA * 60 && <span className="linea-adesso" style={{ top: y(minutoAdesso) }} />}
            {(blocchi.get(g) ?? []).filter((b) => !(b.continuaPrima && b.a <= oraDa * 60)).map((b) => {
              const alto = Math.max(y(b.a) - y(b.da), 22)
              const v = b.impegno
              return (
                <a key={`${v.chiave}-${b.da}`} href={v.link} onClick={(e) => apri(v, e)}
                  className={`blocco ${classeVoce(v)}${v.concluso ? ' conclusa' : ''}`}
                  style={{ top: y(b.da), height: alto - 2, left: `calc(${(b.corsia / b.corsie) * 100}% + 2px)`, width: `calc(${100 / b.corsie}% - 4px)` }}>
                  <span className="titolo">{v.titolo}</span>
                  {alto > 30 && (
                    <span className="ora numeri">
                      {b.continuaPrima ? `fino alle ${orarioDaMinuti(b.a)}` : b.continuaDopo ? `dalle ${orarioDaMinuti(b.da)}` : testoOrario(v)}
                    </span>
                  )}
                  {alto > 54 && v.dettaglio && <span className="dettaglio">{v.dettaglio}</span>}
                </a>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Classi di colore della voce: i turni riusano i colori della sigla. */
const classeVoce = (i: Impegno) => (i.fonte === 'turno' ? `voce sigla ${i.colore}` : `voce ${i.colore}`)

/** Elenco di impegni (usato anche nella pagina Oggi). */
export function ElencoImpegni({ voci, conData, vuoto, onApri }: { voci: Impegno[]; conData?: boolean; vuoto?: string; onApri?: (i: Impegno, e: MouseEvent) => void }) {
  return (
    <div className="lista">
      {voci.length === 0 && vuoto && <div className="vuoto piccolo">{vuoto}</div>}
      {voci.map((v) => (
        <a key={v.chiave} className={`riga riga-impegno${v.concluso ? ' conclusa' : ''}`} href={v.link} onClick={(e) => onApri?.(v, e)}>
          <span className="orario-impegno numeri">
            {conData && <span style={{ display: 'block', fontWeight: 600, color: 'var(--testo)' }}>{dataBreve(v.giorno)}</span>}
            {v.minutoInizio === undefined ? (conData ? '' : 'giornata') : testoOrario(v).replace('–', '\n')}
          </span>
          <span className={`pallino-fonte f-${v.fonte}`} style={{ width: 4, height: 'auto', alignSelf: 'stretch', borderRadius: 2 }} />
          <span className="crescente">
            <span style={{ fontWeight: 600 }}>{v.titolo}</span>
            <span className="secondario piccolo">{[v.fonte === 'evento' ? '' : TITOLO_VOCE[v.fonte], v.dettaglio].filter(Boolean).join(' · ')}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

/* Modulo per aggiungere o modificare un impegno */

function FormEvento({ record, giorno, minuto, onChiudi }: { record?: Evento; giorno: string; minuto?: number; onChiudi: () => void }) {
  const [b, setB] = useState({
    titolo: record?.titolo ?? '',
    giorno: record?.giorno ?? giorno,
    giornoFine: record?.giornoFine ?? '',
    tuttoIlGiorno: record?.tuttoIlGiorno ?? false,
    inizio: orarioDaMinuti(record?.minutoInizio ?? minuto ?? 9 * 60),
    fine: orarioDaMinuti(record?.minutoFine ?? Math.min((minuto ?? 9 * 60) + 60, 23 * 60 + 59)),
    luogo: record?.luogo ?? '',
    categoria: record ? categoriaDa(record.categoria) : ('personale' as CategoriaEvento),
    note: record?.note ?? '',
  })
  const [piuGiorni, setPiuGiorni] = useState(Boolean(record?.giornoFine))
  const mInizio = minutiDaOrario(b.inizio), mFine = minutiDaOrario(b.fine)
  const fineValida = !piuGiorni || (!!giornoDaChiave(b.giornoFine) && b.giornoFine >= b.giorno)
  const orariValidi = b.tuttoIlGiorno || piuGiorni || (mInizio !== undefined && (b.fine.trim() === '' || mFine !== undefined))
  const valido = b.titolo.trim() !== '' && !!giornoDaChiave(b.giorno) && fineValida && orariValidi

  async function conferma() {
    if (!valido) return
    const senzaOrari = b.tuttoIlGiorno || piuGiorni
    await salva('eventi', {
      ...record, titolo: b.titolo.trim(), giorno: b.giorno, categoria: b.categoria,
      giornoFine: piuGiorni && b.giornoFine > b.giorno ? b.giornoFine : undefined,
      tuttoIlGiorno: senzaOrari || undefined,
      minutoInizio: senzaOrari ? undefined : mInizio, minutoFine: senzaOrari ? undefined : mFine,
      luogo: b.luogo.trim() || undefined, note: b.note.trim() || undefined,
    })
    onChiudi()
    if (!record) mostraAvviso(`Aggiunto: ${b.titolo.trim()}`)
  }

  return (
    <Foglio aperto titolo={record ? 'Impegno' : 'Nuovo impegno'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Titolo"><input value={b.titolo} placeholder="es. Riunione di reparto, dentista…" onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="campo">
          <span>Tipo</span>
          <div className="riga-azioni" role="group" aria-label="Tipo di impegno">
            {CATEGORIE_EVENTO.map((c) => (
              <button key={c} type="button" className={`pillola voce-scelta c-${c}`} aria-pressed={b.categoria === c} onClick={() => setB({ ...b, categoria: c })}>{TITOLI_CATEGORIA[c]}</button>
            ))}
          </div>
        </div>
        <div className="campi-affiancati">
          <Campo etichetta={piuGiorni ? 'Dal' : 'Giorno'}><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
          {piuGiorni && <Campo etichetta="Al"><input type="date" value={b.giornoFine} min={b.giorno} onChange={(e) => setB({ ...b, giornoFine: e.target.value })} /></Campo>}
        </div>
        <label className="interruttore">
          <span>Più giorni (es. congresso, viaggio)</span>
          <input type="checkbox" checked={piuGiorni} onChange={(e) => { setPiuGiorni(e.target.checked); if (e.target.checked && !b.giornoFine) setB({ ...b, giornoFine: b.giorno }) }} />
        </label>
        {!piuGiorni && (
          <label className="interruttore">
            <span>Tutto il giorno</span>
            <input type="checkbox" checked={b.tuttoIlGiorno} onChange={(e) => setB({ ...b, tuttoIlGiorno: e.target.checked })} />
          </label>
        )}
        {!piuGiorni && !b.tuttoIlGiorno && (
          <div className="campi-affiancati">
            <Campo etichetta="Dalle"><input type="time" value={b.inizio} onChange={(e) => setB({ ...b, inizio: e.target.value })} /></Campo>
            <Campo etichetta="Alle (facoltativo)"><input type="time" value={b.fine} onChange={(e) => setB({ ...b, fine: e.target.value })} /></Campo>
          </div>
        )}
        {piuGiorni && !fineValida && <Avviso>L'ultimo giorno deve essere uguale o dopo il primo.</Avviso>}
        <Campo etichetta="Luogo (facoltativo)"><input value={b.luogo} onChange={(e) => setB({ ...b, luogo: e.target.value })} /></Campo>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <NotaPrivacy />
        {record && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('eventi', record.id).then(() => { onChiudi(); mostraAvviso(`Eliminato: ${record.titolo}`, () => void ripristina('eventi', record.id)) })}>
            Elimina
          </button>
        )}
      </div>
    </Foglio>
  )
}

/* Esportazione nel Calendario di Apple (file .ics) */

function EsportaCalendario({ anno, mese, dati, nascoste, onChiudi }: {
  anno: number; mese: number; dati: Parameters<typeof impegniTra>[0]; nascoste: Set<Fonte>; onChiudi: () => void
}) {
  const [errore, setErrore] = useState<string>()
  const nomeMese = F.mese(istante(anno, mese, 1))

  async function esporta(periodo: 'mese' | 'futuro') {
    const meseQui = `${anno}-${String(mese).padStart(2, '0')}`
    const da = periodo === 'mese' ? `${meseQui}-01` : chiaveGiorno(oggi())
    const a = periodo === 'mese' ? `${meseQui}-31` : chiaveGiorno(aggiungiGiorni(oggi(), 400))
    const voci = impegniTra(dati, da, a).filter((i) => !nascoste.has(i.fonte))
    const turni = perId(dati.turni)
    const eventiIcs: EventoIcs[] = voci.map((v) => {
      const g = giornoDaChiave(v.giorno)!
      const t = v.fonte === 'turno' ? turni.get(v.id) : undefined
      const domani = aggiungiGiorni(g, 1)
      const tutto = v.minutoInizio === undefined
      const inizio = t && !tutto ? t.inizio : istante(g.anno, g.mese, g.giorno, tutto ? 0 : Math.floor(v.minutoInizio! / 60), tutto ? 0 : v.minutoInizio! % 60)
      let fine = t && !tutto ? t.fine : tutto ? istante(domani.anno, domani.mese, domani.giorno) : inizio + 60 * 60_000
      if (!t && !tutto && v.minutoFine !== undefined) {
        fine = istante(g.anno, g.mese, g.giorno, Math.floor(v.minutoFine / 60), v.minutoFine % 60)
        if (fine <= inizio) fine += 24 * 60 * 60_000
      }
      return {
        uid: `${v.chiave.replace(/:/g, '-')}@agenda`, titolo: v.titolo,
        inizio, fine, tuttoIlGiorno: tutto, note: v.dettaglio, modificatoIl: v.modificatoIl,
      }
    })
    if (!eventiIcs.length) {
      setErrore('Non c’è niente da esportare in questo periodo.')
      return
    }
    const blob = new Blob([creaIcs(eventiIcs, 'Agenda')], { type: 'text/calendar' })
    await condividiOScarica(blob, periodo === 'mese' ? `Agenda ${nomeMese}.ics` : 'Agenda da oggi.ics', 'Agenda')
    onChiudi()
  }

  return (
    <Foglio aperto titolo="Calendario Apple" onChiudi={onChiudi}>
      <p className="secondario" style={{ margin: 0 }}>
        Crea un file da aprire con il Calendario: gli impegni vengono aggiunti (se li esporti di nuovo, il Calendario aggiorna quelli che ha già).
        Esporta solo ciò che è acceso nei filtri.
      </p>
      {errore && <Avviso>{errore}</Avviso>}
      <div className="scelte-rapide">
        <button type="button" className="scelta-rapida" onClick={() => void esporta('mese')}><span className="nome"><strong style={{ textTransform: 'capitalize' }}>{nomeMese}</strong><br /><span className="orario">solo questo mese</span></span></button>
        <button type="button" className="scelta-rapida" onClick={() => void esporta('futuro')}><span className="nome"><strong>Da oggi in poi</strong><br /><span className="orario">tutto ciò che è in programma</span></span></button>
      </div>
    </Foglio>
  )
}


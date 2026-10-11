import { useRef, useState } from 'react'
import { componenti, istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Attivita } from '../../../dati/modello'
import { Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { vai } from '../../../interfaccia/navigazione'
import { usePressioneLunga } from '../../../interfaccia/pressione'
import { chiaveGiorno, giornoDaChiave, minutiDaOrario, oggi, orarioDaMinuti } from '../../turni/supporto'
import {
  AREE, areaDa, completa, leggiTestoVeloce, perScheda, piuGiorni, PRIORITA, prioritaDa, RIPETIZIONI, ripetizioneDa, SCHEDE, TITOLI_AREA,
  TITOLI_PRIORITA, TITOLI_RIPETIZIONE, TITOLI_SCHEDA, type Area, type Priorita, type Ripetizione, type Scheda,
} from '../logica'

const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const orario = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
const inizioDi = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno) }

function quando(t: Attivita, oggiChiave: string): string {
  if (!t.scadenza) return ''
  const giorno = t.scadenza === oggiChiave ? 'oggi' : t.scadenza === piuGiorni(oggiChiave, 1) ? 'domani' : F.dataBreve(msGiorno(t.scadenza))
  return t.minuto !== undefined ? `${giorno} alle ${orario(t.minuto)}` : giorno
}

/** Titolo del giorno nei Programmati: "Domani", "Dopodomani", "venerdì 16 ottobre". */
function titoloGiorno(g: string, oggiChiave: string): string {
  if (g === piuGiorni(oggiChiave, 1)) return 'Domani'
  if (g === piuGiorni(oggiChiave, 2)) return 'Dopodomani'
  return F.dataEstesa(msGiorno(g))
}

/** Completa o riapre un task; se si ripete, crea subito il prossimo. */
export async function segnaFatto(t: Attivita) {
  const { aggiornato, prossimo } = completa(t, Date.now())
  await salva('attivita', aggiornato)
  const nuovo = prossimo ? await salva('attivita', prossimo) : undefined
  if (aggiornato.completataIl && nuovo?.scadenza) {
    mostraAvviso(`Prossimo: ${F.dataBreve(msGiorno(nuovo.scadenza))}`, () => void (async () => {
      await salva('attivita', { ...aggiornato, completataIl: undefined })
      await elimina('attivita', nuovo.id)
    })())
  }
}

/** Spostamenti offerti da "Più tardi" e dal menu rapido. */
type Spostamento = { titolo: string; giorno: (oggiChiave: string) => string | undefined }
const SPOSTAMENTI: Spostamento[] = [
  { titolo: 'Domani', giorno: (o) => piuGiorni(o, 1) },
  { titolo: 'Dopodomani', giorno: (o) => piuGiorni(o, 2) },
]

/** Una riga: cerchio da spuntare, titolo, eventuale barra rossa della priorità alta. */
function RigaTask({ t, oggiChiave, mostraGiorno, gestori, eraPressione }: {
  t: Attivita; oggiChiave: string; mostraGiorno?: boolean
  gestori?: ReturnType<typeof usePressioneLunga>['gestori']; eraPressione?: () => boolean
}) {
  const ritardo = !t.completataIl && t.scadenza && t.scadenza < oggiChiave
  const passiFatti = t.passi?.filter((p) => p.fatto).length ?? 0
  const dettagli = [
    ritardo ? `in ritardo · era per ${quando(t, oggiChiave)}` : mostraGiorno ? quando(t, oggiChiave) : t.minuto !== undefined ? orario(t.minuto) : '',
    ripetizioneDa(t.ripeti) !== 'mai' ? `↻ ${TITOLI_RIPETIZIONE[ripetizioneDa(t.ripeti)].toLowerCase()}` : '',
    t.passi?.length ? `${passiFatti}/${t.passi.length} passi` : '',
  ].filter(Boolean)
  return (
    <div className={`riga riga-task${t.completataIl ? ' conclusa' : ''}`} {...(gestori ? gestori(t.id) : {})}>
      {prioritaDa(t.priorita) === 'alta' && !t.completataIl && <span className="barra-priorita" aria-label="Priorità alta" />}
      <button type="button" className={`spunta${t.completataIl ? ' fatta' : ''}`}
        aria-label={t.completataIl ? `Riapri ${t.titolo}` : `Segna fatto ${t.titolo}`} onClick={() => void segnaFatto(t)}>
        {t.completataIl ? '✓' : ''}
      </button>
      <a className="crescente" href={`#/task/${t.id}`} style={{ color: 'inherit' }} onClick={(e) => { if (eraPressione?.()) e.preventDefault() }}>
        <span style={{ fontWeight: 600, textDecoration: t.completataIl ? 'line-through' : undefined }}>{t.titolo}</span>
        {dettagli.length > 0 && (
          <span className="secondario piccolo" style={ritardo ? { color: 'var(--pericolo)', fontWeight: 600 } : undefined}>{dettagli.join(' · ')}</span>
        )}
      </a>
    </div>
  )
}

/** Riga in fondo all'elenco: si scrive e Invio aggiunge; "Più tardi" sceglie un altro giorno. */
function NuovoTask({ giornoPredefinito, oggiChiave }: { giornoPredefinito: string | undefined; oggiChiave: string }) {
  const [testo, setTesto] = useState('')
  const [giorno, setGiorno] = useState<string | null>(null) // null = quello della scheda
  const [menu, setMenu] = useState(false)
  const [scegli, setScegli] = useState(piuGiorni(oggiChiave, 3))
  const campo = useRef<HTMLInputElement>(null)
  const giornoScelto = giorno === null ? giornoPredefinito : giorno || undefined

  async function aggiungi(giornoForzato?: string | '') {
    const letto = leggiTestoVeloce(testo, oggiChiave, componenti(Date.now()).giornoSettimana)
    if (!letto.titolo) return
    const scadenza = letto.scadenza ?? (giornoForzato !== undefined ? giornoForzato || undefined : giornoScelto)
    setTesto('')
    setGiorno(null)
    setMenu(false)
    await salva('attivita', { titolo: letto.titolo, scadenza, minuto: scadenza ? letto.minuto : undefined, priorita: letto.priorita ?? 'media', area: 'personale' })
    if (scadenza !== giornoPredefinito) mostraAvviso(scadenza ? `Programmato per ${titoloGiorno(scadenza, oggiChiave).toLowerCase()}` : 'Aggiunto ai task senza data')
  }
  /** Con il testo già scritto aggiunge subito; altrimenti ricorda il giorno per il prossimo Invio. */
  function scegliGiorno(g: string | '') {
    if (testo.trim()) void aggiungi(g)
    else { setGiorno(g); setMenu(false); campo.current?.focus() }
  }

  return (
    <>
      <div className="riga riga-nuovo-task">
        <span className="spunta" style={{ borderStyle: 'dashed', cursor: 'default' }} aria-hidden="true" />
        <input ref={campo} className="campo-in-riga" value={testo} placeholder="Nuovo task…" aria-label="Nuovo task" enterKeyHint="done"
          onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void aggiungi() }} />
        {giorno !== null && (
          <button type="button" className="pillola piccola" onClick={() => setGiorno(null)} title="Togli">
            {giorno ? titoloGiorno(giorno, oggiChiave) : 'Senza data'} ×
          </button>
        )}
        <button type="button" className="pulsante piu-tardi" aria-expanded={menu} onClick={() => setMenu(!menu)}>Più tardi</button>
      </div>
      {menu && (
        <div className="menu-piu-tardi">
          {SPOSTAMENTI.map((s) => <button key={s.titolo} type="button" onClick={() => scegliGiorno(s.giorno(oggiChiave)!)}>{s.titolo}</button>)}
          <div className="scegli-giorno">
            <input type="date" value={scegli} min={oggiChiave} aria-label="Scegli un giorno" onChange={(e) => setScegli(e.target.value)} />
            <button type="button" className="pulsante primario" disabled={!giornoDaChiave(scegli)} onClick={() => scegliGiorno(scegli)}>Scegli</button>
          </div>
          <button type="button" onClick={() => scegliGiorno('')}>Senza data</button>
        </div>
      )}
    </>
  )
}

/** Menu che si apre tenendo premuto un task (o con il clic destro): priorità, sposta, apri, elimina. */
function MenuRapido({ t, oggiChiave, onChiudi }: { t: Attivita; oggiChiave: string; onChiudi: () => void }) {
  const [scegli, setScegli] = useState(t.scadenza && t.scadenza > oggiChiave ? t.scadenza : piuGiorni(oggiChiave, 3))
  async function sposta(giorno: string | undefined) {
    await salva('attivita', { ...t, scadenza: giorno, minuto: giorno ? t.minuto : undefined, ripeti: giorno ? t.ripeti : undefined })
    onChiudi()
    mostraAvviso(giorno ? `Spostato a ${titoloGiorno(giorno, oggiChiave).toLowerCase()}` : 'Spostato in Senza data', () => void salva('attivita', t))
  }
  return (
    <Foglio aperto titolo="Task" onChiudi={onChiudi}>
      <div className="modulo">
        <strong style={{ fontSize: 17 }}>{t.titolo}</strong>
        <div className="campo">
          <span>Priorità</span>
          <div className="riga-azioni" role="group" aria-label="Priorità">
            {PRIORITA.map((p) => (
              <button key={p} type="button" className={`pillola priorita-scelta p-${p}`} aria-pressed={prioritaDa(t.priorita) === p}
                onClick={() => void salva('attivita', { ...t, priorita: p }).then(onChiudi)}>{TITOLI_PRIORITA[p]}</button>
            ))}
          </div>
        </div>
        <div className="lista menu-azioni">
          {t.scadenza !== oggiChiave && <button type="button" className="riga" onClick={() => void sposta(oggiChiave)}>Sposta a oggi</button>}
          {SPOSTAMENTI.map((s) => s.giorno(oggiChiave) !== t.scadenza && (
            <button key={s.titolo} type="button" className="riga" onClick={() => void sposta(s.giorno(oggiChiave))}>Sposta a {s.titolo.toLowerCase()}</button>
          ))}
          <div className="riga" style={{ cursor: 'default' }}>
            <span className="crescente">Altro giorno</span>
            <input type="date" value={scegli} aria-label="Giorno" onChange={(e) => setScegli(e.target.value)} className="data-piccola" />
            <button type="button" className="pulsante piccolo" disabled={!giornoDaChiave(scegli)} onClick={() => void sposta(scegli)}>Sposta</button>
          </div>
          {t.scadenza && <button type="button" className="riga" onClick={() => void sposta(undefined)}>Togli la data</button>}
          <a className="riga" href={`#/task/${t.id}`} onClick={onChiudi}>Apri la scheda</a>
          <button type="button" className="riga" style={{ color: 'var(--pericolo)' }}
            onClick={() => void elimina('attivita', t.id).then(() => { onChiudi(); mostraAvviso(`Eliminato: ${t.titolo}`, () => void ripristina('attivita', t.id)) })}>
            Elimina
          </button>
        </div>
      </div>
    </Foglio>
  )
}

export function Task({ apertoId, giorno, minuto, scheda: schedaParam }: { apertoId?: string; giorno?: string | null; minuto?: string | null; scheda?: string | null }) {
  const tutti = useCollezione('attivita')
  const oggiChiave = chiaveGiorno(oggi())
  const scheda: Scheda = (SCHEDE as readonly string[]).includes(schedaParam ?? '') ? (schedaParam as Scheda) : 'oggi'
  const pressione = usePressioneLunga()
  const [menuPer, setMenuPer] = useState<string>()

  const s = perScheda(tutti ?? [], oggiChiave, inizioDi(oggiChiave))
  const inModifica = apertoId && apertoId !== 'nuovo' ? tutti?.find((t) => t.id === apertoId) : undefined
  const perMenu = tutti?.find((t) => t.id === menuPer)
  // La pressione prolungata apre il menu rapido (al posto della ×).
  const gestori = (id: string) => {
    const g = pressione.gestori(id)
    return {
      ...g,
      onPointerDown: () => { g.onPointerDown(); clearTimeout(attesa.current); attesa.current = setTimeout(() => setMenuPer(id), 460) },
      onPointerUp: () => { g.onPointerUp(); clearTimeout(attesa.current) },
      onPointerLeave: () => { g.onPointerLeave(); clearTimeout(attesa.current) },
      onPointerCancel: () => { g.onPointerCancel(); clearTimeout(attesa.current) },
      onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); setMenuPer(id) },
    }
  }
  const attesa = useRef<ReturnType<typeof setTimeout>>(undefined)
  const riga = (t: Attivita, mostraGiorno = false) => (
    <RigaTask key={t.id} t={t} oggiChiave={oggiChiave} mostraGiorno={mostraGiorno} gestori={gestori} eraPressione={pressione.eraPressione} />
  )
  const predefinito = scheda === 'oggi' ? oggiChiave : scheda === 'programmati' ? piuGiorni(oggiChiave, 1) : undefined

  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header>
        <h1 className="titolo-grande">Task</h1>
      </header>
      <div className="segmenti" role="tablist" aria-label="Schede">
        {SCHEDE.map((k) => (
          <a key={k} role="tab" aria-selected={scheda === k} className={scheda === k ? 'attivo' : ''} href={`#/task?scheda=${k}`}>
            {TITOLI_SCHEDA[k]}{s.conteggi[k] ? ` · ${s.conteggi[k]}` : ''}
          </a>
        ))}
      </div>

      {scheda === 'oggi' && (
        <div className="lista">
          {s.oggi.inRitardo.map((t) => riga(t))}
          {s.oggi.aperti.map((t) => riga(t))}
          {s.oggi.fatti.map((t) => riga(t))}
          <NuovoTask key="oggi" giornoPredefinito={predefinito} oggiChiave={oggiChiave} />
        </div>
      )}
      {scheda === 'programmati' && (
        <>
          {[...s.programmati].map(([g, elenco]) => (
            <section key={g} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <h2 className="titolo-sezione" style={{ textTransform: 'capitalize', fontSize: 15 }}>{titoloGiorno(g, oggiChiave)}</h2>
              <div className="lista">{elenco.map((t) => riga(t))}</div>
            </section>
          ))}
          {s.programmati.size === 0 && <div className="vuoto secondario">Niente in programma nei prossimi giorni.</div>}
          <div className="lista"><NuovoTask key="programmati" giornoPredefinito={predefinito} oggiChiave={oggiChiave} /></div>
        </>
      )}
      {scheda === 'senzaData' && (
        <div className="lista">
          {s.senzaData.map((t) => riga(t))}
          <NuovoTask key="senzaData" giornoPredefinito={predefinito} oggiChiave={oggiChiave} />
        </div>
      )}
      <span className="secondario piccolo">
        Scrivi e premi Invio: il task va {scheda === 'oggi' ? 'su oggi' : scheda === 'programmati' ? 'su domani' : 'senza data'}. "Più tardi" per un altro giorno.
        Tieni premuto un task (sul Mac clic destro) per priorità, spostarlo o eliminarlo.
      </span>

      {perMenu && <MenuRapido key={perMenu.id} t={perMenu} oggiChiave={oggiChiave} onChiudi={() => { setMenuPer(undefined); pressione.setAttivo(undefined) }} />}
      {(apertoId === 'nuovo' || inModifica) && (
        <FormTask key={apertoId} record={inModifica} giorno={giorno ?? undefined} minuto={minuto ? Number(minuto) : undefined}
          onChiudi={() => (history.length > 1 ? history.back() : vai('#/task'))} />
      )}
    </div>
  )
}

function FormTask({ record, giorno, minuto, area, onChiudi }: { record?: Attivita; giorno?: string; minuto?: number; area?: Area; onChiudi: () => void }) {
  const parametroArea = new URLSearchParams(location.hash.split('?')[1] ?? '').get('area')
  const [b, setB] = useState({
    titolo: record?.titolo ?? '',
    area: record ? areaDa(record.area) : area ?? (parametroArea ? areaDa(parametroArea) : 'personale'),
    scadenza: record?.scadenza ?? giorno ?? '',
    ora: record?.minuto !== undefined ? orarioDaMinuti(record.minuto) : minuto !== undefined ? orarioDaMinuti(minuto) : '',
    priorita: record ? prioritaDa(record.priorita) : ('media' as Priorita),
    ripeti: ripetizioneDa(record?.ripeti),
    passi: record?.passi ?? [],
    note: record?.note ?? '',
  })
  const [nuovoPasso, setNuovoPasso] = useState('')
  const oraValida = b.ora === '' || minutiDaOrario(b.ora) !== undefined
  const valido = b.titolo.trim() !== '' && (b.scadenza === '' || !!giornoDaChiave(b.scadenza)) && oraValida

  async function conferma() {
    if (!valido) return
    const passi = [...b.passi, ...(nuovoPasso.trim() ? [{ testo: nuovoPasso.trim() }] : [])]
    await salva('attivita', {
      ...record, titolo: b.titolo.trim(), area: b.area, priorita: b.priorita,
      scadenza: b.scadenza || undefined, minuto: b.scadenza && b.ora ? minutiDaOrario(b.ora) : undefined,
      ripeti: b.scadenza && b.ripeti !== 'mai' ? b.ripeti : undefined,
      passi: passi.length ? passi : undefined, note: b.note.trim() || undefined,
    })
    onChiudi()
  }
  const oggiChiave = chiaveGiorno(oggi())
  const scorciatoie: [string, string][] = [['Oggi', oggiChiave], ['Domani', piuGiorni(oggiChiave, 1)], ['Tra una settimana', piuGiorni(oggiChiave, 7)]]

  return (
    <Foglio aperto titolo={record ? 'Task' : 'Nuovo task'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Cosa devi fare"><input value={b.titolo} autoFocus={!record} placeholder="es. Preparare le slide per il journal club" onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="campo">
          <span>Area</span>
          <div className="riga-azioni" role="group" aria-label="Area">
            {AREE.map((a) => (
              <button key={a} type="button" className={`pillola voce-scelta etichetta-area a-${a}`} aria-pressed={b.area === a} onClick={() => setB({ ...b, area: a })}>{TITOLI_AREA[a]}</button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span>Entro quando</span>
          <div className="riga-azioni">
            {scorciatoie.map(([t, g]) => (
              <button key={t} type="button" className="pillola" aria-pressed={b.scadenza === g} onClick={() => setB({ ...b, scadenza: g })}
                style={b.scadenza === g ? { background: 'var(--primario)', color: 'var(--primario-testo)', borderColor: 'transparent' } : undefined}>{t}</button>
            ))}
            {b.scadenza && <button type="button" className="pillola" onClick={() => setB({ ...b, scadenza: '', ora: '', ripeti: 'mai' })}>Senza data</button>}
          </div>
          <div className="campi-affiancati" style={{ marginTop: 6 }}>
            <input type="date" value={b.scadenza} aria-label="Data" onChange={(e) => setB({ ...b, scadenza: e.target.value })} />
            {b.scadenza && <input type="time" value={b.ora} aria-label="Ora (facoltativa)" onChange={(e) => setB({ ...b, ora: e.target.value })} />}
          </div>
        </div>
        {b.scadenza && (
          <Campo etichetta="Si ripete">
            <select value={b.ripeti} onChange={(e) => setB({ ...b, ripeti: e.target.value as Ripetizione })}>
              {RIPETIZIONI.map((r) => <option key={r} value={r}>{TITOLI_RIPETIZIONE[r]}</option>)}
            </select>
          </Campo>
        )}
        <div className="campo">
          <span>Priorità</span>
          <div className="riga-azioni" role="group" aria-label="Priorità">
            {PRIORITA.map((p) => (
              <button key={p} type="button" className={`pillola priorita-scelta p-${p}`} aria-pressed={b.priorita === p} onClick={() => setB({ ...b, priorita: p })}>{TITOLI_PRIORITA[p]}</button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span>Passi (facoltativi)</span>
          {b.passi.length > 0 && (
            <div className="lista">
              {b.passi.map((p, i) => (
                <div key={i} className="riga" style={{ cursor: 'default', padding: '8px 0' }}>
                  <input type="checkbox" checked={Boolean(p.fatto)} aria-label="Fatto"
                    onChange={(e) => setB({ ...b, passi: b.passi.map((x, j) => (j === i ? { ...x, fatto: e.target.checked || undefined } : x)) })}
                    style={{ width: 20, height: 20, accentColor: 'var(--primario)' }} />
                  <span className="crescente" style={{ textDecoration: p.fatto ? 'line-through' : undefined }}>{p.testo}</span>
                  <button type="button" className="elimina-riga" aria-label={`Togli ${p.testo}`} onClick={() => setB({ ...b, passi: b.passi.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
            </div>
          )}
          <input value={nuovoPasso} placeholder="Aggiungi un passo e premi Invio" enterKeyHint="enter"
            onChange={(e) => setNuovoPasso(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nuovoPasso.trim()) { e.preventDefault(); setB({ ...b, passi: [...b.passi, { testo: nuovoPasso.trim() }] }); setNuovoPasso('') } }} />
        </div>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <NotaPrivacy />
        {record && (
          <div className="riga-azioni">
            <button type="button" className="pulsante" onClick={() => void segnaFatto(record).then(onChiudi)}>{record.completataIl ? 'Riapri' : 'Segna come fatto'}</button>
            <button type="button" className="pulsante pericolo"
              onClick={() => void elimina('attivita', record.id).then(() => { onChiudi(); mostraAvviso(`Eliminato: ${record.titolo}`, () => void ripristina('attivita', record.id)) })}>
              Elimina
            </button>
          </div>
        )}
      </div>
    </Foglio>
  )
}

/**
 * I task di oggi (e quelli rimasti indietro) con il cerchio da spuntare, per la pagina Oggi.
 * Quelli fatti oggi restano visibili, in trasparenza.
 */
export function TaskDiOggi() {
  const tutti = useCollezione('attivita')
  const oggiChiave = chiaveGiorno(oggi())
  const [testo, setTesto] = useState('')
  const inizioOggi = istante(Number(oggiChiave.slice(0, 4)), Number(oggiChiave.slice(5, 7)), Number(oggiChiave.slice(8, 10)))
  const elenco = (tutti ?? []).filter((t) => t.scadenza && (
    t.completataIl ? t.scadenza <= oggiChiave && t.completataIl >= inizioOggi : t.scadenza <= oggiChiave))
  const ordine = (a: Attivita, b: Attivita) =>
    Number(Boolean(a.completataIl)) - Number(Boolean(b.completataIl))
    || PRIORITA.indexOf(prioritaDa(a.priorita)) - PRIORITA.indexOf(prioritaDa(b.priorita))
    || (a.minuto ?? 9999) - (b.minuto ?? 9999) || a.creatoIl - b.creatoIl
  elenco.sort(ordine)
  const fatti = elenco.filter((t) => t.completataIl).length

  async function aggiungi() {
    const letto = leggiTestoVeloce(testo, oggiChiave, componenti(Date.now()).giornoSettimana)
    if (!letto.titolo) return
    setTesto('')
    await salva('attivita', { titolo: letto.titolo, scadenza: letto.scadenza ?? oggiChiave, minuto: letto.minuto, priorita: letto.priorita ?? 'media', area: 'personale' })
  }

  if (!tutti) return null
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="intestazione" style={{ alignItems: 'baseline' }}>
        <h2 className="titolo-sezione">Task di oggi {elenco.length > 0 && <span className="secondario piccolo" style={{ fontWeight: 400 }}>{fatti}/{elenco.length} fatti</span>}</h2>
        <a href="#/task" className="piccolo">Tutti i task ›</a>
      </div>
      <div className="lista">
        {elenco.map((t) => (
          <div key={t.id} className={`riga riga-task${t.completataIl ? ' conclusa' : ''}`}>
            {prioritaDa(t.priorita) === 'alta' && !t.completataIl && <span className="barra-priorita" aria-label="Priorità alta" />}
            <button type="button" className={`spunta${t.completataIl ? ' fatta' : ''}`}
              aria-label={t.completataIl ? `Riapri ${t.titolo}` : `Segna fatto ${t.titolo}`} onClick={() => void segnaFatto(t)}>{t.completataIl ? '✓' : ''}</button>
            <a className="crescente" href={`#/task/${t.id}`} style={{ color: 'inherit' }}>
              <span style={{ fontWeight: 600, textDecoration: t.completataIl ? 'line-through' : undefined }}>
                {t.titolo}
              </span>
              {(t.minuto !== undefined || (t.scadenza! < oggiChiave && !t.completataIl)) && (
                <span className="secondario piccolo" style={t.scadenza! < oggiChiave && !t.completataIl ? { color: 'var(--pericolo)', fontWeight: 600 } : undefined}>
                  {t.scadenza! < oggiChiave && !t.completataIl ? `in ritardo · era per ${quando(t, oggiChiave)}` : `alle ${orario(t.minuto!)}`}
                </span>
              )}
            </a>
          </div>
        ))}
        <div className="riga" style={{ cursor: 'default' }}>
          <span className="spunta" style={{ borderStyle: 'dashed', cursor: 'default' }} aria-hidden="true" />
          <input className="campo-in-riga" value={testo} placeholder="Aggiungi un task per oggi" aria-label="Nuovo task per oggi" enterKeyHint="done"
            onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void aggiungi() }} />
        </div>
      </div>
    </section>
  )
}

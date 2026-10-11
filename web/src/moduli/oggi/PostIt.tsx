import { useEffect, useRef, useState, type PointerEvent as PE, type ReactNode } from 'react'
import { elimina, ripristina, salva } from '../../dati/archivio'
import { useCollezione } from '../../dati/hooks'
import type { PostIt } from '../../dati/modello'
import { mostraAvviso } from '../../interfaccia/componenti'
import { IconaArchivia, IconaPostIt } from '../../interfaccia/icone'
import { SEZIONI } from '../../interfaccia/Guscio'

/** Colori dei post-it, tenui come il resto dell'app. */
export const COLORI_POSTIT = ['#F4E6B4', '#F2D6C8', '#DAE7D3', '#D7E3EF', '#E5DDEF', '#ECE5DA']

/**
 * Bacheca dei post-it sopra la pagina Oggi: si spostano trascinandoli dalla striscia in alto,
 * restano dove li lasci (anche sugli altri dispositivi). La posizione orizzontale è in percentuale della larghezza.
 */
export function BachecaPostIt({ pagina, children }: { pagina: string; children: ReactNode }) {
  const postit = useCollezione('postit')
  const contenitore = useRef<HTMLDivElement>(null)
  const tutti = postit ?? []
  const elenco = tutti.filter((p) => (p.pagina ?? 'oggi') === pagina && !p.archiviato).sort((a, b) => a.z - b.z)
  const zMax = Math.max(0, ...tutti.map((p) => p.z))

  async function nuovo() {
    const n = elenco.length
    const y = (contenitore.current ? Math.max(0, -contenitore.current.getBoundingClientRect().top) : 0) + 90 + (n % 5) * 24
    await salva('postit', { pagina, testo: '', colore: COLORI_POSTIT[n % COLORI_POSTIT.length]!, x: 55 + (n % 3) * 4, y, z: zMax + 1 })
  }

  return (
    <div className="bacheca" ref={contenitore}>
      {children}
      {pagina !== 'postit' && (
        <button type="button" className="pulsante-postit" onClick={() => void nuovo()} aria-label="Nuovo post-it su questa pagina"><IconaPostIt dimensione={18} /> Post-it</button>
      )}
      {elenco.map((p) => <Foglietto key={p.id} p={p} contenitore={contenitore} zMax={zMax} />)}
    </div>
  )
}

function Foglietto({ p, contenitore, zMax }: { p: PostIt; contenitore: React.RefObject<HTMLDivElement | null>; zMax: number }) {
  const [pos, setPos] = useState({ x: p.x, y: p.y })
  const [testo, setTesto] = useState(p.testo)
  const [colori, setColori] = useState(false)
  const trascina = useRef<{ dx: number; dy: number } | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // Ultimi valori: ogni salvataggio scrive insieme posizione e testo, così uno non annulla l'altro.
  const ultimo = useRef({ pos, testo })
  ultimo.current = { pos, testo }
  const salvaTutto = (extra: Partial<PostIt> = {}) => salva('postit', { ...p, x: Math.round(ultimo.current.pos.x * 10) / 10, y: Math.round(ultimo.current.pos.y), testo: ultimo.current.testo, ...extra })
  useEffect(() => { if (!trascina.current) setPos({ x: p.x, y: p.y }) }, [p.x, p.y])
  useEffect(() => () => clearTimeout(timer.current), [])

  function giu(e: PE) {
    const box = contenitore.current?.getBoundingClientRect()
    if (!box) return
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* puntatore non catturabile: si trascina lo stesso */ }
    trascina.current = { dx: e.clientX - (box.left + (pos.x / 100) * box.width), dy: e.clientY - (box.top + pos.y) }
    if (p.z < zMax) void salvaTutto({ z: zMax + 1 })
  }
  function muovi(e: PE) {
    const box = contenitore.current?.getBoundingClientRect()
    if (!trascina.current || !box) return
    const larghezza = 180
    const x = Math.min(Math.max(0, ((e.clientX - trascina.current.dx - box.left) / box.width) * 100), Math.max(0, 100 - (larghezza / box.width) * 100))
    const y = Math.max(0, e.clientY - trascina.current.dy - box.top)
    setPos({ x, y })
    ultimo.current = { ...ultimo.current, pos: { x, y } }
  }
  function su() {
    if (!trascina.current) return
    trascina.current = undefined
    clearTimeout(timer.current)
    void salvaTutto({ z: Math.max(p.z, zMax) })
  }
  function scrivi(v: string) {
    setTesto(v)
    ultimo.current = { ...ultimo.current, testo: v }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => void salvaTutto(), 600)
  }

  return (
    <div className="postit" style={{ left: `${pos.x}%`, top: pos.y, zIndex: 5 + p.z, background: p.colore }}>
      <div className="maniglia-postit" onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerCancel={su} title="Trascina per spostare">
        <button type="button" className="colori-postit" aria-label="Cambia colore" onPointerDown={(e) => e.stopPropagation()} onClick={() => setColori(!colori)}>●</button>
        <span className="presa" aria-hidden="true">⋮⋮</span>
        <button type="button" className="archivia-postit" aria-label="Archivia il post-it" title="Archivia" onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void salvaTutto({ archiviato: true }).then(() => mostraAvviso('Post-it archiviato', () => void salvaTutto({ archiviato: undefined })))}><IconaArchivia dimensione={14} /></button>
        <button type="button" className="chiudi-postit" aria-label="Elimina il post-it" onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void elimina('postit', p.id).then(() => mostraAvviso('Post-it eliminato', () => void ripristina('postit', p.id)))}>×</button>
      </div>
      {colori && (
        <div className="scelta-colori-postit">
          {COLORI_POSTIT.map((c) => (
            <button key={c} type="button" aria-label={`Colore ${c}`} style={{ background: c }} className={c === p.colore ? 'scelto' : ''}
              onClick={() => { setColori(false); void salvaTutto({ colore: c }) }} />
          ))}
        </div>
      )}
      <textarea value={testo} onChange={(e) => scrivi(e.target.value)} placeholder="Scrivi qui…" aria-label="Testo del post-it" />
    </div>
  )
}

const nomePagina = (id?: string) => SEZIONI.find((x) => x.id === (id ?? 'oggi'))?.titolo ?? 'Oggi'

/** Raccolta di tutti i post-it: attivi (divisi per pagina) e archiviati. */
export function RaccoltaPostIt() {
  const postit = useCollezione('postit')
  const [scheda, setScheda] = useState<'attivi' | 'archiviati'>('attivi')
  const elenco = (postit ?? []).filter((p) => (scheda === 'archiviati' ? p.archiviato : !p.archiviato)).sort((a, b) => b.modificatoIl - a.modificatoIl)
  const pagine = [...new Set(elenco.map((p) => p.pagina ?? 'oggi'))]
  const conta = (archiviati: boolean) => (postit ?? []).filter((p) => Boolean(p.archiviato) === archiviati).length
  return (
    <div className="schermata" style={{ maxWidth: 1000 }}>
      <header><h1 className="titolo-grande">Raccolta post-it</h1></header>
      <div className="segmenti" style={{ maxWidth: 360 }}>
        <button type="button" className={scheda === 'attivi' ? 'attivo' : ''} onClick={() => setScheda('attivi')}>Attivi · {conta(false)}</button>
        <button type="button" className={scheda === 'archiviati' ? 'attivo' : ''} onClick={() => setScheda('archiviati')}>Archiviati · {conta(true)}</button>
      </div>
      {elenco.length === 0 && (
        <div className="vuoto secondario">
          {scheda === 'attivi' ? 'Nessun post-it. Usa il pulsante "Post-it" in basso a destra in qualunque pagina.' : 'Nessun post-it archiviato. Archivia un post-it dalla sua striscia per toglierlo dalla pagina senza perderlo.'}
        </div>
      )}
      {pagine.map((pg) => (
        <section key={pg} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione">{nomePagina(pg)}</h2>
          <div className="raccolta-postit">
            {elenco.filter((p) => (p.pagina ?? 'oggi') === pg).map((p) => <CartaPostIt key={p.id} p={p} />)}
          </div>
        </section>
      ))}
    </div>
  )
}

function CartaPostIt({ p }: { p: PostIt }) {
  const [testo, setTesto] = useState(p.testo)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return (
    <div className="carta-postit" style={{ background: p.colore }}>
      <textarea value={testo} aria-label="Testo del post-it" placeholder="Vuoto"
        onChange={(e) => { const v = e.target.value; setTesto(v); clearTimeout(timer.current); timer.current = setTimeout(() => void salva('postit', { ...p, testo: v }), 600) }} />
      <div className="azioni-carta-postit">
        <span className="piccolo">{new Date(p.modificatoIl).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short' })}</span>
        <span className="riga-azioni" style={{ gap: 2 }}>
          {!p.archiviato && <a className="pillola piccola" href={`#/${p.pagina ?? 'oggi'}`}>Vai</a>}
          <button type="button" className="pillola piccola" onClick={() => void salva('postit', { ...p, testo, archiviato: p.archiviato ? undefined : true })}>
            {p.archiviato ? 'Rimetti' : 'Archivia'}
          </button>
          <button type="button" className="elimina-task" aria-label="Elimina il post-it"
            onClick={() => void elimina('postit', p.id).then(() => mostraAvviso('Post-it eliminato', () => void ripristina('postit', p.id)))}>×</button>
        </span>
      </div>
    </div>
  )
}

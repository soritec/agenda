import { useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { IconaAvviso } from './icone'
import { profiloPrincipale } from '../dati/profili'

/** Finestra modale: dal basso su iPhone, al centro su Mac. Esc o "Annulla" la chiudono. */
export function Foglio({ aperto, titolo, onChiudi, azione, children }: {
  aperto: boolean
  titolo: string
  onChiudi: () => void
  azione?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aperto && !d.open) d.showModal()
    if (!aperto && d.open) d.close()
  }, [aperto])
  return (
    <dialog ref={ref} className="foglio" onClose={onChiudi} aria-label={titolo}
      // Un clic fuori dal foglio (sullo sfondo scuro) lo chiude.
      onClick={(e) => { if (e.target === e.currentTarget) onChiudi() }}>
      {aperto && (
        <>
          <div className="testata">
            <button type="button" className="link" style={{ justifySelf: 'start', fontSize: 17 }} onClick={onChiudi}>Annulla</button>
            <h2>{titolo}</h2>
            <div style={{ justifySelf: 'end' }}>{azione}</div>
          </div>
          <div className="corpo">{children}</div>
        </>
      )}
    </dialog>
  )
}

export function Campo({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return (
    <label className="campo">
      <span>{etichetta}</span>
      {children}
    </label>
  )
}

/** Avviso obbligatorio sotto ogni campo di testo libero (spec: niente dati dei pazienti). */
export function NotaPrivacy() {
  return <span className="nota-privacy">{profiloPrincipale() ? 'Non scrivere dati che identificano pazienti (nome, codice fiscale, data di nascita, indirizzo).' : 'Non scrivere dati sensibili di altre persone.'}</span>
}

export function Avviso({ children }: { children: ReactNode }) {
  return (
    <div className="avviso" role="status">
      <span style={{ flexShrink: 0, marginTop: 1 }}><IconaAvviso dimensione={16} /></span>
      <span>{children}</span>
    </div>
  )
}

/* Avviso temporaneo con "Annulla" (es. dopo aver eliminato un turno). */
type Messaggio = { testo: string; annulla?: () => void; id: number }
let messaggio: Messaggio | undefined
const ascoltatoriToast = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | undefined

export function mostraAvviso(testo: string, annulla?: () => void) {
  messaggio = { testo, annulla, id: Date.now() }
  ascoltatoriToast.forEach((a) => a())
  clearTimeout(timer)
  timer = setTimeout(() => {
    messaggio = undefined
    ascoltatoriToast.forEach((a) => a())
  }, 6000)
}

function chiudiAvviso() {
  clearTimeout(timer)
  messaggio = undefined
  ascoltatoriToast.forEach((a) => a())
}

export function Toast() {
  const m = useSyncExternalStore(
    (a) => { ascoltatoriToast.add(a); return () => ascoltatoriToast.delete(a) },
    () => messaggio,
  )
  if (!m) return null
  return (
    <div className="toast" role="status">
      <span>{m.testo}</span>
      {m.annulla && <button type="button" onClick={() => { m.annulla!(); chiudiAvviso() }}>Annulla</button>}
    </div>
  )
}

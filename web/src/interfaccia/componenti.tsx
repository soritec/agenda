import { useEffect, useRef, type ReactNode } from 'react'
import { IconaAvviso } from './icone'

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
    <dialog ref={ref} className="foglio" onClose={onChiudi} aria-label={titolo}>
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
  return <span className="nota-privacy">Non scrivere dati che identificano pazienti (nome, codice fiscale, data di nascita, indirizzo).</span>
}

export function Avviso({ children }: { children: ReactNode }) {
  return (
    <div className="avviso" role="status">
      <span style={{ flexShrink: 0, marginTop: 1 }}><IconaAvviso dimensione={16} /></span>
      <span>{children}</span>
    </div>
  )
}

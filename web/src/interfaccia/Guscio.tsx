import { useEffect, useRef, type ReactNode } from 'react'
import { Toast } from './componenti'
import { BachecaPostIt } from '../moduli/oggi/PostIt'
import { Visualizzatore } from './Visualizzatore'
import { useStatoSincronizzazione } from '../dati/sincronizzazione'
import { coloreStato, testoStato } from './Impostazioni'
import { IconaAgenda, IconaBudget, IconaCerca, IconaImpostazioni, IconaJournaling, IconaOggi, IconaSpecializzazione, IconaStudio, IconaTask, IconaTurni, IconaPostIt } from './icone'

export const SEZIONI = [
  { id: 'oggi', titolo: 'Oggi', Icona: IconaOggi },
  { id: 'agenda', titolo: 'Agenda', Icona: IconaAgenda },
  { id: 'turni', titolo: 'Turni', Icona: IconaTurni },
  { id: 'task', titolo: 'Task', Icona: IconaTask },
  { id: 'specializzazione', titolo: 'Specializzazione', Icona: IconaSpecializzazione },
  { id: 'studio', titolo: 'Studio e risorse', Icona: IconaStudio },
  { id: 'budget', titolo: 'Budget', Icona: IconaBudget },
  { id: 'journaling', titolo: 'Journaling e habit tracker', Icona: IconaJournaling },
  { id: 'postit', titolo: 'Raccolta post-it', Icona: IconaPostIt },
  { id: 'cerca', titolo: 'Cerca', Icona: IconaCerca },
] as const satisfies readonly { id: string; titolo: string; Icona: (p: { dimensione?: number }) => ReactNode }[]

export type Sezione = (typeof SEZIONI)[number]['id']
/** Titoli brevi per la barra in basso dell'iPhone. */
const TITOLI_BREVI: Partial<Record<Sezione, string>> = { specializzazione: 'Specializz.', studio: 'Studio', journaling: 'Journaling', postit: 'Post-it' }

/** Barra laterale sul Mac (schermi larghi), barra in basso su iPhone. */
export function Guscio({ attiva, children }: { attiva: Sezione | 'impostazioni'; children: ReactNode }) {
  const stato = useStatoSincronizzazione()
  const barra = useRef<HTMLElement>(null)
  // Sull'iPhone la barra in basso scorre: si porta in vista la sezione attiva quando cambia.
  useEffect(() => {
    barra.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [attiva])
  return (
    <div className="guscio">
      <nav className="laterale" aria-label="Sezioni">
        {SEZIONI.map(({ id, titolo, Icona }) => (
          <a key={id} href={`#/${id}`} aria-current={id === attiva ? 'page' : undefined}>
            <Icona dimensione={17} />
            {titolo}
          </a>
        ))}
        <span style={{ flex: 1 }} />
        <a href="#/impostazioni" aria-current={attiva === 'impostazioni' ? 'page' : undefined} title={testoStato(stato)}>
          <IconaImpostazioni dimensione={17} />
          <span style={{ flex: 1 }}>Impostazioni</span>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: coloreStato(stato) }} aria-label={testoStato(stato)} />
        </a>
      </nav>
      <main className="contenuto">{attiva === 'impostazioni' ? children : <BachecaPostIt pagina={attiva}>{children}</BachecaPostIt>}</main>
      <Toast />
      <Visualizzatore />
      <nav className="barra-schede" aria-label="Sezioni" ref={barra}>
        {SEZIONI.map(({ id, titolo, Icona }) => (
          <a key={id} href={`#/${id}`} aria-current={id === attiva ? 'page' : undefined}>
            <Icona dimensione={24} />
            <span>{TITOLI_BREVI[id] ?? titolo}</span>
          </a>
        ))}
        <a href="#/impostazioni" aria-current={attiva === 'impostazioni' ? 'page' : undefined}>
          <IconaImpostazioni dimensione={24} />
          <span>Impostazioni</span>
        </a>
      </nav>
    </div>
  )
}

/** Sezione non ancora costruita. */
export function InArrivo({ titolo }: { titolo: string }) {
  return (
    <div className="schermata">
      <h1 className="titolo-grande">{titolo}</h1>
      <p className="secondario">Questa sezione arriverà nei prossimi passi.</p>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Toast } from './componenti'
import { IconaAgenda, IconaCerca, IconaModuli, IconaOggi, IconaTurni } from './icone'

export type Sezione = 'oggi' | 'agenda' | 'turni' | 'moduli' | 'cerca'

const SEZIONI: { id: Sezione; titolo: string; Icona: (p: { dimensione?: number }) => ReactNode }[] = [
  { id: 'oggi', titolo: 'Oggi', Icona: IconaOggi },
  { id: 'agenda', titolo: 'Agenda', Icona: IconaAgenda },
  { id: 'turni', titolo: 'Turni', Icona: IconaTurni },
  { id: 'moduli', titolo: 'Moduli', Icona: IconaModuli },
  { id: 'cerca', titolo: 'Cerca', Icona: IconaCerca },
]

/** Barra laterale sul Mac (schermi larghi), barra in basso su iPhone. */
export function Guscio({ attiva, children }: { attiva: Sezione; children: ReactNode }) {
  return (
    <div className="guscio">
      <nav className="laterale" aria-label="Sezioni">
        {SEZIONI.map(({ id, titolo, Icona }) => (
          <a key={id} href={`#/${id}`} aria-current={id === attiva ? 'page' : undefined}>
            <Icona dimensione={17} />
            {titolo}
          </a>
        ))}
      </nav>
      <main className="contenuto">{children}</main>
      <Toast />
      <nav className="barra-schede" aria-label="Sezioni">
        {SEZIONI.map(({ id, titolo, Icona }) => (
          <a key={id} href={`#/${id}`} aria-current={id === attiva ? 'page' : undefined}>
            <Icona dimensione={24} />
            {titolo}
          </a>
        ))}
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

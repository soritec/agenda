import { useEffect, useRef, type ReactNode } from 'react'
import { Toast } from './componenti'
import { BachecaPostIt } from '../moduli/oggi/PostIt'
import { Visualizzatore } from './Visualizzatore'
import { useStatoSincronizzazione } from '../dati/sincronizzazione'
import { coloreStato, testoStato } from './Impostazioni'
import { IconaAgenda, IconaBudget, IconaCerca, IconaImpostazioni, IconaJournaling, IconaOggi, IconaSpecializzazione, IconaStudio, IconaTask, IconaTurni, IconaPostIt, IconaChat, IconaCasa, IconaValigetta, IconaGiornale, IconaSegnalibro } from './icone'
import { Avatar, useProfili } from './profili'
import { useCondivisi } from '../dati/condiviso'
import { cambiaProfilo, MODULI_SU_SCELTA, profiloAttivo } from '../dati/profili'
import { useImpostazioni } from '../dati/hooks'
import { aggiornaApp, useVersioneNuova } from './versione'
import { ricordaValuta } from '../nucleo/formati'

export const SEZIONI = [
  { id: 'oggi', titolo: 'Oggi', Icona: IconaOggi },
  { id: 'agenda', titolo: 'Agenda', Icona: IconaAgenda },
  { id: 'turni', titolo: 'Turni', Icona: IconaTurni },
  { id: 'task', titolo: 'Task', Icona: IconaTask },
  { id: 'specializzazione', titolo: 'Specializzazione', Icona: IconaSpecializzazione },
  { id: 'studio', titolo: 'Studio e risorse', Icona: IconaStudio },
  { id: 'budget', titolo: 'Budget', Icona: IconaBudget },
  { id: 'casa', titolo: 'Casa', Icona: IconaCasa },
  { id: 'applications', titolo: 'Applications', Icona: IconaValigetta },
  { id: 'commercial', titolo: 'Commercial awareness', Icona: IconaGiornale },
  { id: 'salvati', titolo: 'Salvati', Icona: IconaSegnalibro },
  { id: 'journaling', titolo: 'Journaling e habit tracker', Icona: IconaJournaling },
  { id: 'postit', titolo: 'Raccolta post-it', Icona: IconaPostIt },
  { id: 'chat', titolo: 'Chat', Icona: IconaChat },
  { id: 'cerca', titolo: 'Cerca', Icona: IconaCerca },
] as const satisfies readonly { id: string; titolo: string; Icona: (p: { dimensione?: number }) => ReactNode }[]

export type Sezione = (typeof SEZIONI)[number]['id']
/** Titoli brevi per la barra in basso dell'iPhone. */
const TITOLI_BREVI: Partial<Record<Sezione, string>> = { specializzazione: 'Specializz.', studio: 'Studio', journaling: 'Journaling', postit: 'Post-it', commercial: 'News' }

/** Barra laterale sul Mac (schermi larghi), barra in basso su iPhone. */
export function Guscio({ attiva, children }: { attiva: Sezione | 'impostazioni'; children: ReactNode }) {
  const stato = useStatoSincronizzazione()
  const barra = useRef<HTMLElement>(null)
  const { profili, attivo } = useProfili()
  const messaggi = useCondivisi('messaggi')
  const promemoria = useCondivisi('promemoria')
  const nonLetti = (messaggi ?? []).filter((m) => m.a === attivo.id && !m.letto).length
    + (promemoria ?? []).filter((p) => p.a === attivo.id && !p.fatto && !p.vistoIl).length
  // Solo le sezioni scelte per questo profilo (la chat c'è se ci sono almeno due profili).
  const sezioni = SEZIONI.filter((s) => (s.id === 'oggi' || (attivo.moduli ? attivo.moduli.includes(s.id) : !MODULI_SU_SCELTA.includes(s.id))) && (s.id !== 'chat' || profili.length > 1))
  // Valuta del profilo: se sul dispositivo era diversa (es. scelta su un altro dispositivo), si ridisegna tutto.
  const impostazioni = useImpostazioni()
  useEffect(() => {
    if (impostazioni && ricordaValuta(impostazioni.valuta, profiloAttivo())) location.reload()
  }, [impostazioni])
  const badge = (id: string) => (id === 'chat' && nonLetti > 0 ? <span className="badge-menu">{nonLetti}</span> : null)
  // Sull'iPhone la barra in basso scorre: si porta in vista la sezione attiva quando cambia.
  useEffect(() => {
    barra.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [attiva])
  const versioneNuova = useVersioneNuova()
  return (
    <div className="guscio">
      {versioneNuova && (
        <div className="avviso-versione" role="status">
          <span>È disponibile una versione nuova dell'app.</span>
          <button type="button" className="pulsante primario piccolo" onClick={() => aggiornaApp(versioneNuova)}>Aggiorna</button>
        </div>
      )}
      <nav className="laterale" aria-label="Sezioni">
        {profili.length > 1 && (
          <div className="scelta-profilo">
            {profili.map((p) => (
              <button key={p.id} type="button" className={p.id === attivo.id ? 'attivo' : ''} title={p.id === attivo.id ? p.nome : `Passa a ${p.nome}`}
                onClick={() => { if (p.id !== attivo.id) cambiaProfilo(p.id) }}>
                <Avatar p={p} dimensione={24} /><span>{p.nome}</span>
              </button>
            ))}
          </div>
        )}
        {sezioni.map(({ id, titolo, Icona }) => (
          <a key={id} href={`#/${id}`} aria-current={id === attiva ? 'page' : undefined}>
            <Icona dimensione={17} />
            <span style={{ flex: 1 }}>{titolo}</span>
            {badge(id)}
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
        {sezioni.map(({ id, titolo, Icona }) => (
          <a key={id} href={`#/${id}`} aria-current={id === attiva ? 'page' : undefined}>
            <Icona dimensione={24} />
            <span>{TITOLI_BREVI[id] ?? titolo}</span>
            {badge(id)}
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

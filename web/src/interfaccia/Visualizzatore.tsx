import { useEffect, useState, useSyncExternalStore } from 'react'
import { apriInNuovaFinestra, contenutoAllegato } from '../dati/allegati'
import { useCollezione } from '../dati/hooks'
import type { Allegato } from '../dati/modello'
import { condividiOScarica, scarica } from '../export/pdf'
import { Avviso, Foglio } from './componenti'

/* Visore degli allegati dentro l'app: PDF, immagini e testo si vedono subito, il resto si condivide o scarica. */

let aperto: Allegato | undefined
const ascoltatori = new Set<() => void>()
export function mostraAllegato(a: Allegato | undefined) {
  aperto = a
  ascoltatori.forEach((x) => x())
}

export function Visualizzatore() {
  const a = useSyncExternalStore((x) => { ascoltatori.add(x); return () => ascoltatori.delete(x) }, () => aperto)
  const [contenuto, setContenuto] = useState<{ url: string; blob: Blob; testo?: string }>()
  const [errore, setErrore] = useState<string>()

  useEffect(() => {
    setContenuto(undefined)
    setErrore(undefined)
    if (!a) return
    let url: string | undefined
    let attivo = true
    void contenutoAllegato(a)
      .then(async (blob) => {
        if (!attivo) return
        url = URL.createObjectURL(blob)
        setContenuto({ url, blob, testo: a.tipoMime.startsWith('text/') ? await blob.text() : undefined })
      })
      .catch((e: unknown) => attivo && setErrore(e instanceof Error ? e.message : 'Non riesco ad aprire il file.'))
    return () => {
      attivo = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [a])

  if (!a) return null
  const pdf = a.tipoMime === 'application/pdf'
  const immagine = a.tipoMime.startsWith('image/')
  return (
    <Foglio aperto titolo={a.nome} onChiudi={() => mostraAllegato(undefined)}>
      {errore && <Avviso>{errore}</Avviso>}
      {!errore && !contenuto && <span className="secondario">Apro il file…</span>}
      {contenuto && pdf && <iframe title={a.nome} src={contenuto.url} className="anteprima-file" />}
      {contenuto && immagine && <img src={contenuto.url} alt={a.nome} style={{ maxWidth: '100%', borderRadius: 10 }} />}
      {contenuto?.testo !== undefined && <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{contenuto.testo}</pre>}
      {contenuto && !pdf && !immagine && contenuto.testo === undefined && <span className="secondario">Questo tipo di file non si può mostrare qui: aprilo o condividilo.</span>}
      {contenuto && (
        <div className="riga-azioni">
          <button type="button" className="pulsante" onClick={() => void apriInNuovaFinestra(a)}>Apri a parte</button>
          {'share' in navigator
            ? <button type="button" className="pulsante" onClick={() => void condividiOScarica(contenuto.blob, a.nome, a.nome)}>Condividi o salva</button>
            : <button type="button" className="pulsante" onClick={() => scarica(contenuto.blob, a.nome)}>Scarica</button>}
        </div>
      )}
    </Foglio>
  )
}

/** Allegati di un elemento come piccole etichette cliccabili (es. nella riga di una procedura). */
export function EtichetteAllegati({ collegatoA }: { collegatoA: string }) {
  const tutti = useCollezione('allegati')
  const allegati = (tutti ?? []).filter((x) => x.collegatoA === collegatoA)
  if (!allegati.length) return null
  return (
    <span className="etichette-allegati">
      {allegati.map((x) => (
        <button key={x.id} type="button" className="etichetta-allegato" title={`Apri ${x.nome}`}
          onClick={(e) => { e.stopPropagation(); mostraAllegato(x) }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-2.9-2.9l7.8-7.8" />
          </svg>
          <span>{x.nome}</span>
        </button>
      ))}
    </span>
  )
}

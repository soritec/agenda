import { useState } from 'react'
import { salvaImpostazioni } from '../../../dati/archivio'
import { useImpostazioni } from '../../../dati/hooks'
import { Foglio, NotaPrivacy } from '../../../interfaccia/componenti'
import type { GenereScuola } from '../../turni/scuola'

const NOMI: Record<GenereScuola, string> = { journal: 'Journal club', goi: 'GOI', lezione: 'Lezioni', riunione: 'Riunioni' }
export const INDICAZIONI_PREDEFINITE: Record<GenereScuola, string> = {
  journal: 'Mercoledì alle 7, 3° piano settore A. La presenza è obbligatoria. Uno o due specializzandi, con uno strutturato di riferimento, presentano un argomento di ginecologia.',
  goi: 'Giovedì alle 13, 3° piano settore A: riunione multidisciplinare con oncologi e radiologi. È obbligatoria per chi è di turno AON il giovedì pomeriggio, caldamente consigliata a tutti gli altri. Al I anno il turno GOI del mercoledì pomeriggio serve a preparare i casi del giorno dopo con lo specializzando senior.',
  lezione: 'Lunedì dalle 16 alle 17:30. La lezione è obbligatoria.',
  riunione: 'Riunione di ostetricia il lunedì dalle 14 alle 16.',
}

/** Riquadro "Dove, come e quando": si legge come nei turni e si può modificare. */
export function DoveComeQuando({ titolo = 'Dove, come e quando', testo, spiegazione, onSalva }: { titolo?: string; testo: string; spiegazione?: string; onSalva: (testo: string) => Promise<unknown> }) {
  const [bozza, setBozza] = useState<string>()
  if (bozza === undefined) {
    return (
      <div className="info-turno">
        <strong>{titolo}</strong>
        {testo && <span style={{ whiteSpace: 'pre-line' }}>{testo}</span>}
        <button type="button" className="link piccolo" style={{ alignSelf: 'flex-start' }} onClick={() => setBozza(testo)}>{testo ? 'Modifica' : 'Aggiungi'}</button>
      </div>
    )
  }
  return (
    <div className="info-turno">
      <strong>{titolo}</strong>
      <textarea rows={5} value={bozza} aria-label={titolo} autoFocus onChange={(e) => setBozza(e.target.value)} />
      {spiegazione && <span className="secondario piccolo">{spiegazione}</span>}
      <NotaPrivacy />
      <div className="riga-azioni">
        <button type="button" className="pulsante primario" onClick={() => void onSalva(bozza.trim()).then(() => setBozza(undefined))}>Salva</button>
        <button type="button" className="pulsante" onClick={() => setBozza(undefined)}>Annulla</button>
      </div>
    </div>
  )
}

function RiquadroScuola({ genere, titolo }: { genere: GenereScuola; titolo?: string }) {
  const impostazioni = useImpostazioni()
  const salvate = impostazioni?.indicazioniScuola
  return (
    <DoveComeQuando titolo={titolo} testo={salvate?.[genere] ?? INDICAZIONI_PREDEFINITE[genere]}
      onSalva={(testo) => salvaImpostazioni({ indicazioniScuola: { ...salvate, [genere]: testo } })} />
  )
}

/** Tendina con le regole della scuola nelle pagine di journal club, riunioni e lezioni. */
export function Indicazioni({ generi }: { generi: GenereScuola[] }) {
  return (
    <details className="tendina-indicazioni">
      <summary>Dove, come e quando</summary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {generi.map((g) => <RiquadroScuola key={g} genere={g} titolo={NOMI[g]} />)}
      </div>
    </details>
  )
}

/** Si apre toccando journal club, GOI, lezioni e riunioni in Turni e in Agenda. */
export function SchedaScuola({ voce, onChiudi }: { voce: { titolo: string; genere: GenereScuola; link: string }; onChiudi: () => void }) {
  return (
    <Foglio aperto titolo={voce.titolo} onChiudi={onChiudi}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RiquadroScuola genere={voce.genere} />
        {voce.link !== '#/agenda' && <a className="pulsante" href={voce.link} onClick={onChiudi}>Apri la scheda</a>}
      </div>
    </Foglio>
  )
}

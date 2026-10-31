import { useState } from 'react'
import { aggiungiAllegato, DIMENSIONE_MASSIMA } from '../../../dati/allegati'
import { nuovoId, salva } from '../../../dati/archivio'
import { Avviso } from '../../../interfaccia/componenti'

/**
 * I file del diario sono risorse della Libreria di Studio: un solo file, visibile in entrambi i posti,
 * e utilizzabile anche per quiz, flashcard e piani di studio.
 */
export async function salvaFileDiario(file: File[], etichettaGiorno: string): Promise<string[]> {
  const id: string[] = []
  for (const f of file) {
    const risorsa = nuovoId()
    await aggiungiAllegato(f, `risorsa:${risorsa}`)
    await salva('risorse', { id: risorsa, titolo: f.name.replace(/\.[^.]+$/, ''), tipo: 'articolo', stato: 'daLeggere', note: `Dal diario dei turni, ${etichettaGiorno}` })
    id.push(risorsa)
  }
  return id
}

/** Scelta dei file da allegare: si salvano insieme al resto, toccando Salva. */
export function CampoFileDiario({ file, onCambia }: { file: File[]; onCambia: (f: File[]) => void }) {
  const [errore, setErrore] = useState<string>()
  function aggiungi(scelti: FileList) {
    const elenco = Array.from(scelti)
    const troppoGrandi = elenco.filter((f) => f.size > DIMENSIONE_MASSIMA)
    setErrore(troppoGrandi.length ? `Più grande di 20 MB: ${troppoGrandi.map((f) => f.name).join(', ')}` : undefined)
    onCambia([...file, ...elenco.filter((f) => f.size <= DIMENSIONE_MASSIMA)])
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label className="pulsante" style={{ cursor: 'pointer', position: 'relative' }}>
          + Allega file
          <input type="file" multiple className="file-nascosto" onChange={(e) => { const c = e.currentTarget; if (c.files?.length) aggiungi(c.files); c.value = '' }} />
        </label>
        <span className="secondario piccolo">Li ritrovi anche in Studio e risorse.</span>
      </div>
      {file.map((f, i) => (
        <span key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="crescente piccolo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
          <button type="button" className="elimina-riga" aria-label={`Togli ${f.name}`} onClick={() => onCambia(file.filter((_, j) => j !== i))}>×</button>
        </span>
      ))}
      {errore && <Avviso>{errore}</Avviso>}
    </div>
  )
}

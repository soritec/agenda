import { useRef, useState } from 'react'
import { aggiungiAllegato, eliminaAllegato } from '../dati/allegati'
import { mostraAllegato } from './Visualizzatore'
import { useCollezione } from '../dati/hooks'
import { Avviso, mostraAvviso } from './componenti'

function dimensione(byte: number): string {
  if (byte < 1024) return `${byte} B`
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`
  return `${(byte / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Elenco degli allegati collegati a un elemento, con aggiunta, apertura ed eliminazione. */
export function Allegati({ collegatoA, avvisoPrivacy }: { collegatoA: string; avvisoPrivacy?: string }) {
  const tutti = useCollezione('allegati')
  const input = useRef<HTMLInputElement>(null)
  const [errore, setErrore] = useState<string>()
  const allegati = (tutti ?? []).filter((a) => a.collegatoA === collegatoA).sort((a, b) => a.creatoIl - b.creatoIl)

  async function aggiungi(files: FileList) {
    setErrore(undefined)
    for (const f of Array.from(files)) {
      try {
        await aggiungiAllegato(f, collegatoA)
      } catch (e) {
        setErrore(e instanceof Error ? e.message : 'Allegato non aggiunto.')
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {allegati.length > 0 && (
        <div className="lista">
          {allegati.map((a) => (
            <div key={a.id} className="riga" style={{ cursor: 'default' }}>
              <button type="button" onClick={() => mostraAllegato(a)}
                style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</span>
                <span className="secondario piccolo">{dimensione(a.dimensione)}</span>
              </button>
              <button type="button" className="elimina-riga" aria-label={`Elimina ${a.nome}`}
                onClick={() => void eliminaAllegato(a).then((annulla) => mostraAvviso(`Eliminato: ${a.nome}`, () => void annulla()))}>×</button>
            </div>
          ))}
        </div>
      )}
      {avvisoPrivacy && <span className="nota-privacy">{avvisoPrivacy}</span>}
      {errore && <Avviso>{errore}</Avviso>}
      <button type="button" className="pulsante" style={{ alignSelf: 'flex-start' }} onClick={() => input.current?.click()}>+ Allega file</button>
      <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files) void aggiungi(e.target.files); e.target.value = '' }} />
    </div>
  )
}

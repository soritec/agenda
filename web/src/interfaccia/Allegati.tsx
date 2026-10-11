import { useState } from 'react'
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
  const [errore, setErrore] = useState<string>()
  const [inCorso, setInCorso] = useState(0)
  const allegati = (tutti ?? []).filter((a) => a.collegatoA === collegatoA).sort((a, b) => a.creatoIl - b.creatoIl)

  async function aggiungi(files: FileList) {
    setErrore(undefined)
    const elenco = Array.from(files)
    setInCorso(elenco.length)
    for (const f of elenco) {
      try {
        await aggiungiAllegato(f, collegatoA)
      } catch (e) {
        setErrore(`${f.name}: non sono riuscita ad allegarlo (${e instanceof Error ? e.message : 'errore sconosciuto'}).`)
      }
      setInCorso((n) => n - 1)
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
      {inCorso > 0 && <span className="secondario piccolo">Allego {inCorso === 1 ? 'il file' : `${inCorso} file`}…</span>}
      {/* Etichetta con dentro il campo file (non un clic simulato): è il modo più affidabile su Safari e iPhone. */}
      <label className="pulsante" style={{ alignSelf: 'flex-start', cursor: 'pointer', position: 'relative' }}>
        + Allega file
        <input type="file" multiple className="file-nascosto"
          onChange={(e) => { const campo = e.currentTarget, f = campo.files; if (f?.length) void aggiungi(f).finally(() => { campo.value = '' }) }} />
      </label>
    </div>
  )
}

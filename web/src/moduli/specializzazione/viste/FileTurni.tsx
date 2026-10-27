import { useState } from 'react'
import * as F from '../../../nucleo/formati'
import { aggiungiAllegato, eliminaAllegato } from '../../../dati/allegati'
import { useCollezione } from '../../../dati/hooks'
import { Avviso, mostraAvviso } from '../../../interfaccia/componenti'
import { mostraAllegato } from '../../../interfaccia/Visualizzatore'
import type { Allegato } from '../../../dati/modello'
import { ImportaTurni } from '../../turni/viste/ImportaTurni'

/** Collegamento degli allegati di questa pagina. */
export const FILE_TURNI = 'file-turni'

/** Archivio dei file dei turni e delle guardie che arrivano ogni mese (PDF o foto), dal più recente. */
export function FileTurni() {
  const allegati = useCollezione('allegati')
  const [errore, setErrore] = useState<string>()
  const [inCorso, setInCorso] = useState(0)
  const [daLeggere, setDaLeggere] = useState<Allegato>()
  const elenco = (allegati ?? []).filter((a) => a.collegatoA === FILE_TURNI).sort((a, b) => b.creatoIl - a.creatoIl)

  async function aggiungi(files: FileList) {
    setErrore(undefined)
    const tutti = Array.from(files)
    setInCorso(tutti.length)
    for (const f of tutti) {
      try {
        const a = await aggiungiAllegato(f, FILE_TURNI)
        if (tutti.length === 1 && a.tipoMime === 'application/pdf') setDaLeggere(a)
      } catch (e) { setErrore(`${f.name}: non sono riuscita a caricarlo (${e instanceof Error ? e.message : 'errore sconosciuto'}).`) }
      setInCorso((n) => n - 1)
    }
  }

  return (
    <div className="schermata" style={{ maxWidth: 760 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">File dei turni</h1>
        </div>
        <label className="pulsante primario" style={{ cursor: 'pointer', position: 'relative' }}>
          + Carica file
          <input type="file" multiple accept="application/pdf,image/*" className="file-nascosto"
            onChange={(e) => { const campo = e.currentTarget, f = campo.files; if (f?.length) void aggiungi(f).finally(() => { campo.value = '' }) }} />
        </label>
      </header>
      <span className="secondario piccolo">Qui tieni i file dei turni e delle guardie che arrivano ogni mese. Si vedono su tutti i tuoi dispositivi. Con "Inserisci i miei turni" l'app cerca il tuo nome nel PDF e ti mostra i turni trovati: li controlli e poi li aggiungi al calendario.</span>
      {errore && <Avviso>{errore}</Avviso>}
      {inCorso > 0 && <span className="secondario piccolo">Carico {inCorso === 1 ? 'il file' : `${inCorso} file`}…</span>}
      <div className="lista">
        {elenco.length === 0 && <div className="vuoto">Nessun file. Carica il PDF dei turni appena arriva per mail.</div>}
        {elenco.map((a) => (
          <div key={a.id} className="riga" style={{ cursor: 'default' }}>
            <button type="button" className="crescente" onClick={() => mostraAllegato(a)}
              style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</span>
              <span className="secondario piccolo">caricato il {F.dataBreve(a.creatoIl)}</span>
            </button>
            {a.tipoMime === 'application/pdf' && <button type="button" className="pulsante" onClick={() => setDaLeggere(a)}>Inserisci i miei turni</button>}
            <button type="button" className="elimina-riga" aria-label={`Elimina ${a.nome}`}
              onClick={() => void eliminaAllegato(a).then((annulla) => mostraAvviso(`Eliminato: ${a.nome}`, () => void annulla()))}>×</button>
          </div>
        ))}
      </div>
      <ImportaTurni allegato={daLeggere} onChiudi={() => setDaLeggere(undefined)} />
    </div>
  )
}

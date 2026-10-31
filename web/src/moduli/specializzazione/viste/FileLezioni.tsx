import { useState } from 'react'
import * as F from '../../../nucleo/formati'
import { aggiungiAllegato, eliminaAllegato } from '../../../dati/allegati'
import { salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Allegato } from '../../../dati/modello'
import { Avviso, mostraAvviso } from '../../../interfaccia/componenti'
import { mostraAllegato } from '../../../interfaccia/Visualizzatore'
import { filePerMese } from '../../turni/fileTurni'
import { eProgrammaLeggibile } from '../leggiProgramma'
import { ConfermaProgramma } from './ConfermaProgramma'
import { titoloMese } from './FileTurni'

/** Programmi di lezioni e riunioni che arrivano ogni mese, divisi per mese come i file dei turni. */
export function FileLezioni({ tipo }: { tipo: 'lezione' | 'riunione' }) {
  const collegamento = tipo === 'lezione' ? 'file-lezioni' : 'file-riunioni'
  const [daLeggere, setDaLeggere] = useState<Allegato>()
  const allegati = useCollezione('allegati')
  const [errore, setErrore] = useState<string>()
  const [inCorso, setInCorso] = useState(0)
  const [rinomina, setRinomina] = useState<{ id: string; nome: string }>()
  const gruppi = filePerMese(allegati ?? [], collegamento)

  async function aggiungi(files: FileList) {
    setErrore(undefined)
    const elenco = Array.from(files)
    setInCorso(elenco.length)
    const problemi: string[] = []
    for (const f of elenco) {
      try {
        const a = await aggiungiAllegato(f, collegamento)
        if (elenco.length === 1 && eProgrammaLeggibile(a)) setDaLeggere(a)
      } catch (e) { problemi.push(`${f.name}: ${e instanceof Error ? e.message : 'errore sconosciuto'}`) }
      setInCorso((n) => n - 1)
    }
    if (problemi.length) setErrore(problemi.join('\n'))
  }

  async function salvaNome(a: Allegato) {
    const nome = rinomina?.nome.trim()
    setRinomina(undefined)
    if (nome && nome !== a.nome) await salva('allegati', { ...a, nome })
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="intestazione" style={{ alignItems: 'center' }}>
        <h2 className="titolo-sezione">File delle {tipo === 'lezione' ? 'lezioni' : 'riunioni'}</h2>
        <label className="pulsante" style={{ cursor: 'pointer', position: 'relative' }}>
          + Carica file
          <input type="file" multiple className="file-nascosto"
            onChange={(e) => { const campo = e.currentTarget, f = campo.files; if (f?.length) void aggiungi(f).finally(() => { campo.value = '' }) }} />
        </label>
      </div>
      {errore && <Avviso><span style={{ whiteSpace: 'pre-line' }}>{errore}</span></Avviso>}
      {inCorso > 0 && <span className="secondario piccolo">Carico {inCorso === 1 ? 'il file' : `${inCorso} file`}…</span>}
      {gruppi.length === 0 && inCorso === 0 && <div className="vuoto">Nessun file. Carica il programma appena arriva per mail.</div>}
      {gruppi.map((g) => (
        <div key={g.mese}>
          <div className="gruppo-titolo" style={{ textTransform: 'capitalize' }}>{titoloMese(g.mese)}</div>
          <div className="lista">
            {g.file.map((a) => (
              <div key={a.id} className="riga" style={{ cursor: 'default' }}>
                {rinomina?.id === a.id ? (
                  <form className="crescente" style={{ display: 'flex', gap: 8 }} onSubmit={(e) => { e.preventDefault(); void salvaNome(a) }}>
                    <input className="crescente" autoFocus value={rinomina.nome} aria-label="Nuovo nome del file"
                      onChange={(e) => setRinomina({ id: a.id, nome: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') setRinomina(undefined) }} />
                    <button type="submit" className="pulsante primario">Salva</button>
                  </form>
                ) : (
                  <>
                    <button type="button" className="crescente" onClick={() => mostraAllegato(a)}
                      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer', minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</span>
                      <span className="secondario piccolo">caricato il {F.dataBreve(a.creatoIl)}</span>
                    </button>
                    <button type="button" className="link piccolo" onClick={() => setRinomina({ id: a.id, nome: a.nome })}>Rinomina</button>
                    {eProgrammaLeggibile(a) && <button type="button" className="pulsante" onClick={() => setDaLeggere(a)}>Inserisci le date</button>}
                  </>
                )}
                <button type="button" className="elimina-riga" aria-label={`Elimina ${a.nome}`}
                  onClick={() => void eliminaAllegato(a).then((annulla) => mostraAvviso(`Eliminato: ${a.nome}`, () => void annulla()))}>×</button>
              </div>
            ))}
          </div>
        </div>
      ))}
      <ConfermaProgramma allegato={daLeggere} tipo={tipo} onChiudi={() => setDaLeggere(undefined)} />
    </section>
  )
}

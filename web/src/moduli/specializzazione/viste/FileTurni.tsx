import { useState } from 'react'
import * as F from '../../../nucleo/formati'
import { istante } from '../../../nucleo/calendario'
import { aggiungiAllegato, eliminaAllegato } from '../../../dati/allegati'
import { salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Allegato } from '../../../dati/modello'
import { Avviso, mostraAvviso } from '../../../interfaccia/componenti'
import { mostraAllegato } from '../../../interfaccia/Visualizzatore'
import { FILE_TURNI, fileTurniPerMese } from '../../turni/fileTurni'
import { ImportaTurni } from '../../turni/viste/ImportaTurni'

/** Nome del mese da "2026-11". */
export const titoloMese = (m: string) => { const [a, n] = m.split('-').map(Number); return F.mese(istante(a!, n!, 1, 12)) }

/** Archivio dei file dei turni e delle guardie che arrivano ogni mese (PDF o foto), diviso per mese. */
export function FileTurni() {
  const allegati = useCollezione('allegati')
  const [errore, setErrore] = useState<string>()
  const [inCorso, setInCorso] = useState(0)
  const [daLeggere, setDaLeggere] = useState<Allegato[]>([])
  const [rinomina, setRinomina] = useState<{ id: string; nome: string }>()
  const gruppi = fileTurniPerMese(allegati ?? [])

  async function aggiungi(files: FileList) {
    setErrore(undefined)
    const tutti = Array.from(files)
    setInCorso(tutti.length)
    for (const f of tutti) {
      try {
        const a = await aggiungiAllegato(f, FILE_TURNI)
        if (tutti.length === 1 && a.tipoMime === 'application/pdf') setDaLeggere([a])
      } catch (e) { setErrore(`${f.name}: non sono riuscita a caricarlo (${e instanceof Error ? e.message : 'errore sconosciuto'}).`) }
      setInCorso((n) => n - 1)
    }
  }

  async function salvaNome(a: Allegato) {
    const nome = rinomina?.nome.trim()
    setRinomina(undefined)
    if (nome && nome !== a.nome) await salva('allegati', { ...a, nome })
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
      <span className="secondario piccolo">Qui tieni i file dei turni e delle guardie che arrivano ogni mese, divisi per mese (quello scritto nel nome del file). Con "Inserisci i miei turni" l'app cerca il tuo nome nel PDF e ti mostra i turni trovati: li controlli e poi li aggiungi al calendario.</span>
      {errore && <Avviso>{errore}</Avviso>}
      {inCorso > 0 && <span className="secondario piccolo">Carico {inCorso === 1 ? 'il file' : `${inCorso} file`}…</span>}
      {gruppi.length === 0 && <div className="vuoto">Nessun file. Carica il PDF dei turni appena arriva per mail.</div>}
      {gruppi.map((g) => (
        <section key={g.mese}>
          <h2 className="titolo-sezione" style={{ marginBottom: 8, textTransform: 'capitalize' }}>{titoloMese(g.mese)}</h2>
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
                      style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nome}</span>
                      <span className="secondario piccolo">caricato il {F.dataBreve(a.creatoIl)}</span>
                    </button>
                    <button type="button" className="link piccolo" onClick={() => setRinomina({ id: a.id, nome: a.nome })}>Rinomina</button>
                    {a.tipoMime === 'application/pdf' && <button type="button" className="pulsante" onClick={() => setDaLeggere([a])}>Inserisci i miei turni</button>}
                  </>
                )}
                <button type="button" className="elimina-riga" aria-label={`Elimina ${a.nome}`}
                  onClick={() => void eliminaAllegato(a).then((annulla) => mostraAvviso(`Eliminato: ${a.nome}`, () => void annulla()))}>×</button>
              </div>
            ))}
          </div>
        </section>
      ))}
      <ImportaTurni allegati={daLeggere} onChiudi={() => setDaLeggere([])} />
    </div>
  )
}

import { useState } from 'react'
import * as F from '../../../nucleo/formati'
import { aggiungiAllegato, eliminaAllegato } from '../../../dati/allegati'
import { salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Allegato } from '../../../dati/modello'
import { Avviso, mostraAvviso } from '../../../interfaccia/componenti'
import { mostraAllegato } from '../../../interfaccia/Visualizzatore'
import { CARTELLE_UTILI, cartellaDi, collegamentoCartella, fileUtili, type CartellaUtile } from '../fileUtili'

/** Archivio di istruzioni, protocolli, moduli e altri file della scuola, di qualsiasi tipo. */
export function FileUtili() {
  const allegati = useCollezione('allegati')
  const [cartella, setCartella] = useState<CartellaUtile>('istruzioni')
  const [cerca, setCerca] = useState('')
  const [errore, setErrore] = useState<string>()
  const [inCorso, setInCorso] = useState(0)
  const [rinomina, setRinomina] = useState<{ id: string; nome: string }>()
  const cercato = cerca.trim().toLowerCase()
  const tutti = fileUtili(allegati ?? [])
  const trovati = tutti.filter((a) => !cercato || a.nome.toLowerCase().includes(cercato))

  async function aggiungi(files: FileList) {
    setErrore(undefined)
    const elenco = Array.from(files)
    setInCorso(elenco.length)
    const problemi: string[] = []
    for (const f of elenco) {
      try { await aggiungiAllegato(f, collegamentoCartella(cartella)) } catch (e) { problemi.push(`${f.name}: ${e instanceof Error ? e.message : 'errore sconosciuto'}`) }
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
    <div className="schermata" style={{ maxWidth: 760 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">File utili</h1>
        </div>
        <label className="pulsante primario" style={{ cursor: 'pointer', position: 'relative' }}>
          + Carica file
          <input type="file" multiple className="file-nascosto"
            onChange={(e) => { const campo = e.currentTarget, f = campo.files; if (f?.length) void aggiungi(f).finally(() => { campo.value = '' }) }} />
        </label>
      </header>
      <span className="secondario piccolo">Istruzioni, protocolli, moduli e presentazioni: puoi caricare più file insieme, di ogni tipo, fino a 20 MB l'uno. Solo documenti senza dati delle pazienti.</span>
      <div className="campo">
        <label htmlFor="cartella-utile">I nuovi file vanno in</label>
        <select id="cartella-utile" value={cartella} onChange={(e) => setCartella(e.target.value as CartellaUtile)}>
          {CARTELLE_UTILI.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      {tutti.length > 3 && <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca per nome" aria-label="Cerca per nome" />}
      {errore && <Avviso><span style={{ whiteSpace: 'pre-line' }}>{errore}</span></Avviso>}
      {inCorso > 0 && <span className="secondario piccolo">Carico {inCorso === 1 ? 'il file' : `${inCorso} file`}…</span>}
      {tutti.length === 0 && <div className="vuoto">Nessun file. Carica le istruzioni della scuola e gli allegati delle mail.</div>}
      {tutti.length > 0 && trovati.length === 0 && <div className="vuoto">Nessun file con questo nome.</div>}
      {[{ id: 'importanti', nome: 'Importanti', file: trovati.filter((a) => a.importante) },
        ...CARTELLE_UTILI.map((c) => ({ ...c, file: trovati.filter((a) => !a.importante && cartellaDi(a) === c.id) }))].map(({ file, ...c }) => {
        if (!file.length) return null
        return (
          <section key={c.id}>
            <h2 className="titolo-sezione" style={{ marginBottom: 8 }}>{c.nome}</h2>
            <div className="lista">
              {file.map((a) => (
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
                      <select value={cartellaDi(a)} aria-label={`Sposta ${a.nome}`} style={{ maxWidth: 120 }}
                        onChange={(e) => void salva('allegati', { ...a, collegatoA: collegamentoCartella(e.target.value as CartellaUtile) })}>
                        {CARTELLE_UTILI.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                      </select>
                      <button type="button" className="link piccolo" onClick={() => setRinomina({ id: a.id, nome: a.nome })}>Rinomina</button>
                    </>
                  )}
                  <button type="button" className={`stella${a.importante ? ' attiva' : ''}`} aria-pressed={!!a.importante}
                    aria-label={a.importante ? `Togli ${a.nome} dagli importanti` : `Segna ${a.nome} come importante`}
                    onClick={() => void salva('allegati', { ...a, importante: !a.importante })}>
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" /></svg>
                  </button>
                  <button type="button" className="elimina-riga" aria-label={`Elimina ${a.nome}`}
                    onClick={() => void eliminaAllegato(a).then((annulla) => mostraAvviso(`Eliminato: ${a.nome}`, () => void annulla()))}>×</button>
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

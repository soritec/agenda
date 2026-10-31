import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import { Avviso, mostraAvviso } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro } from '../../../interfaccia/icone'
import { contaComeFerie, FERIE_ANNUE, ferieUsate } from '../../turni/ferie'
import { giornoDaChiave, oggi } from '../../turni/supporto'
import { tipoGiornataDa } from '../../turni/tipi'

/** Storico delle ferie per anno: i giorni usati sui 30 disponibili, mese per mese. */
export function StoricoFerie() {
  const giornate = useCollezione('ferie')
  const [anno, setAnno] = useState(oggi().anno)
  const [nuovo, setNuovo] = useState('')
  const [errore, setErrore] = useState<string>()
  const delAnno = (giornate ?? []).filter((f) => tipoGiornataDa(f.tipo) === 'ferie' && f.giorno.startsWith(`${anno}-`)).sort((a, b) => a.giorno.localeCompare(b.giorno))
  const usate = ferieUsate(delAnno, anno)
  const mesi = [...new Set(delAnno.map((f) => f.giorno.slice(0, 7)))]
  const ms = (giorno: string) => { const g = giornoDaChiave(giorno)!; return istante(g.anno, g.mese, g.giorno, 12) }

  async function aggiungi() {
    setErrore(undefined)
    if (!nuovo) { setErrore('Scegli un giorno.'); return }
    if ((giornate ?? []).some((f) => f.giorno === nuovo)) { setErrore('Quel giorno ha già una giornata segnata nel calendario dei turni.'); return }
    await salva('ferie', { giorno: nuovo, tipo: 'ferie' })
    setAnno(Number(nuovo.slice(0, 4)))
    setNuovo('')
  }

  return (
    <div className="schermata" style={{ maxWidth: 640 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">Storico ferie</h1>
        </div>
        <div className="riga-azioni">
          <button type="button" className="pulsante tondo" aria-label="Anno precedente" onClick={() => setAnno(anno - 1)}><IconaIndietro dimensione={18} /></button>
          <span className="numeri" style={{ fontWeight: 600 }}>{anno}</span>
          <button type="button" className="pulsante tondo" aria-label="Anno successivo" onClick={() => setAnno(anno + 1)}><IconaAvanti dimensione={18} /></button>
        </div>
      </header>
      <div className="tessere">
        <div className="tessera"><span className="valore">{usate}</span><span className="secondario piccolo">giorni usati su {FERIE_ANNUE}</span></div>
        <div className="tessera"><span className="valore">{Math.max(0, FERIE_ANNUE - usate)}</span><span className="secondario piccolo">giorni rimasti</span></div>
      </div>
      <span className="secondario piccolo">Contano solo i giorni dal lunedì al venerdì non festivi. Weekend e festivi restano nell'elenco, ma non scalano.</span>
      <form className="campo" onSubmit={(e) => { e.preventDefault(); void aggiungi() }}>
        <label htmlFor="nuova-ferie">Aggiungi un giorno di ferie</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="nuova-ferie" type="date" className="crescente" value={nuovo} onChange={(e) => { setNuovo(e.target.value); setErrore(undefined) }} />
          <button type="submit" className="pulsante primario">Aggiungi</button>
        </div>
      </form>
      {errore && <Avviso>{errore}</Avviso>}
      {delAnno.length === 0 && <div className="vuoto">Nessun giorno di ferie nel {anno}.</div>}
      {mesi.map((m) => (
        <section key={m}>
          <h2 className="titolo-sezione" style={{ marginBottom: 8, textTransform: 'capitalize' }}>{F.mese(ms(`${m}-01`))}</h2>
          <div className="lista">
            {delAnno.filter((f) => f.giorno.startsWith(m)).map((f) => (
              <div key={f.id} className="riga" style={{ cursor: 'default' }}>
                <span className="crescente" style={{ fontWeight: 600 }}>{F.dataEstesa(ms(f.giorno))}</span>
                {!contaComeFerie(f.giorno) && <span className="secondario piccolo">non conta</span>}
                <button type="button" className="elimina-riga" aria-label={`Elimina ${F.dataBreve(ms(f.giorno))}`} onClick={() => void elimina('ferie', f.id).then(() => mostraAvviso('Giorno di ferie tolto', () => void ripristina('ferie', f.id)))}>×</button>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { giornoDi, stessoGiorno } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { salva, salvaImpostazioni } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Turno } from '../../../dati/modello'
import { mostraAvviso } from '../../../interfaccia/componenti'
import { consultoriDaScegliere, giornoDellaSettimana, leggiSediConsultorio, rigaSedeConsultorio } from '../consultorio'
import { intervallo } from '../orari'
import { minutiDaOrario, oggi, orarioDaMinuti, perId } from '../supporto'

const rimandati = new Set<string>()
const NUOVA = 'nuova'

/** In cima a Oggi, dal giorno prima: chiede in quale sede si farà il consultorio e con quali orari. */
export function BannerConsultorio() {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const impostazioni = useImpostazioni()
  const [, aggiorna] = useState(0)
  const mappa = useMemo(() => perId(modelli), [modelli])
  const turno = consultoriDaScegliere(turni ?? [], mappa, oggi(), impostazioni?.consultoriNonChiesti).find((t) => !rimandati.has(t.id))
  if (!impostazioni || !turno) return null
  return <Riquadro key={turno.id} turno={turno} onRimanda={() => { rimandati.add(turno.id); aggiorna((n) => n + 1) }} />
}

function Riquadro({ turno, onRimanda }: { turno: Turno; onRimanda: () => void }) {
  const impostazioni = useImpostazioni()
  const sedi = useCollezione('sedi')
  const [scelta, setScelta] = useState('')
  const [nome, setNome] = useState('')
  const [da, setDa] = useState('')
  const [a, setA] = useState('')
  const [errore, setErrore] = useState<string>()
  const giornoSett = giornoDellaSettimana(turno.inizio)
  const opzioni = leggiSediConsultorio(impostazioni?.sediConsultorio).filter((s) => s.giorno === giornoSett)
  const giorno = giornoDi(turno.inizio)
  const domani = !stessoGiorno(giorno, oggi())

  function scegli(v: string) {
    setScelta(v); setErrore(undefined)
    const o = opzioni[Number(v)]
    if (v === NUOVA || !o) return
    setDa(o.inizio !== undefined ? orarioDaMinuti(o.inizio) : '')
    setA(o.fine !== undefined ? orarioDaMinuti(o.fine) : '')
  }

  async function conferma() {
    const nomeSede = scelta === NUOVA ? nome.trim() : opzioni[Number(scelta)]?.nome
    if (!nomeSede) { setErrore('Scegli la sede, oppure tocca Più tardi.'); return }
    if (Boolean(da) !== Boolean(a)) { setErrore('Scrivi sia l\'inizio sia la fine, oppure lasciali vuoti.'); return }
    const sede = (sedi ?? []).find((s) => s.nome.toLowerCase() === nomeSede.toLowerCase()) ?? await salva('sedi', { nome: nomeSede })
    const mi = minutiDaOrario(da), mf = minutiDaOrario(a)
    await salva('turni', { ...turno, sedeId: sede.id, ...(mi !== undefined && mf !== undefined ? { ...intervallo(giorno, mi, mf), tuttoIlGiorno: undefined } : {}) })
    if (scelta === NUOVA) await salvaImpostazioni({ sediConsultorio: [impostazioni?.sediConsultorio?.trim(), rigaSedeConsultorio(giornoSett, nomeSede, da, a)].filter(Boolean).join('\n') })
    mostraAvviso(`Consultorio: ${nomeSede}`, () => void salva('turni', turno))
  }

  async function nonChiedere() {
    const prima = impostazioni?.consultoriNonChiesti ?? []
    await salvaImpostazioni({ consultoriNonChiesti: [...prima, turno.id] })
    mostraAvviso('Non te lo chiedo più per questo turno', () => void salvaImpostazioni({ consultoriNonChiesti: prima }))
  }

  return (
    <section className="banner-orari" aria-label="Sede del consultorio">
      <div className="banner-orari-testa">
        <div>
          <h2 className="titolo-sezione">{domani ? 'Domani' : 'Oggi'} hai il consultorio: dove lo farai?</h2>
          <span className="secondario piccolo" style={{ textTransform: 'capitalize' }}>{F.dataEstesa(turno.inizio)}</span>
        </div>
        <button type="button" className="elimina-riga" aria-label="Non chiedere per questo turno" onClick={() => void nonChiedere()}>×</button>
      </div>
      <select value={scelta} aria-label="Sede" onChange={(e) => scegli(e.target.value)}>
        <option value="">Scegli la sede</option>
        {opzioni.map((o, i) => (
          <option key={i} value={i}>{[o.nome, o.inizio !== undefined && o.fine !== undefined ? `${orarioDaMinuti(o.inizio)}–${orarioDaMinuti(o.fine)}` : '', o.nota].filter(Boolean).join(' · ')}</option>
        ))}
        <option value={NUOVA}>Aggiungi una sede</option>
      </select>
      {scelta === NUOVA && <input value={nome} placeholder="Nome della sede" aria-label="Nome della nuova sede" onChange={(e) => { setNome(e.target.value); setErrore(undefined) }} />}
      <div className="banner-orari-riga" style={{ borderTop: 'none' }}>
        <label>dalle <input type="time" value={da} onChange={(e) => setDa(e.target.value)} /></label>
        <label>alle <input type="time" value={a} onChange={(e) => setA(e.target.value)} /></label>
      </div>
      {errore && <span className="errore-orari piccolo">{errore}</span>}
      <div className="banner-orari-piede">
        <span />
        <div className="riga-azioni">
          <button type="button" className="pulsante" onClick={onRimanda}>Più tardi</button>
          <button type="button" className="pulsante primario" onClick={() => void conferma()}>Salva</button>
        </div>
      </div>
    </section>
  )
}

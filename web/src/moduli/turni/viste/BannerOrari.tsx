import { useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { salvaImpostazioni, salvaTanti } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Turno } from '../../../dati/modello'
import { mostraAvviso } from '../../../interfaccia/componenti'
import { intervallo } from '../orari'
import { giorniDaCompilare } from '../orariDaScrivere'
import { chiaveGiorno, giornoDaChiave, minutiDaOrario, oggi, perId, titoloTurno } from '../supporto'

/** "Più tardi" vale finché l'app resta aperta: alla prossima apertura il banner ricompare. */
const rimandati = new Set<string>()

/** In cima a Oggi: chiede a che ora si è lavorato nei giorni passati con turni senza orari. */
export function BannerOrari() {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const impostazioni = useImpostazioni()
  const [, aggiorna] = useState(0)
  const mappa = useMemo(() => perId(modelli), [modelli])
  const g0 = oggi()
  const giorni = useMemo(() => giorniDaCompilare(turni ?? [], g0, impostazioni?.orariNonChiesti), [turni, impostazioni?.orariNonChiesti, chiaveGiorno(g0)]) // eslint-disable-line react-hooks/exhaustive-deps
  const daFare = giorni.filter((d) => !rimandati.has(d.giorno))
  const primo = daFare[0]
  if (!impostazioni || !primo) return null
  return <RiquadroGiorno key={primo.giorno} giorno={primo.giorno} turni={primo.turni} altri={daFare.length - 1} nomi={(t) => titoloTurno(t, mappa)}
    nonChiesti={impostazioni.orariNonChiesti ?? []} onRimanda={() => { for (const d of daFare) rimandati.add(d.giorno); aggiorna((n) => n + 1) }} />
}

function RiquadroGiorno({ giorno, turni, altri, nomi, nonChiesti, onRimanda }: {
  giorno: string; turni: Turno[]; altri: number; nomi: (t: Turno) => string; nonChiesti: string[]; onRimanda: () => void
}) {
  const [orari, setOrari] = useState<Record<string, { da: string; a: string }>>({})
  const [errore, setErrore] = useState<string>()
  const g = giornoDaChiave(giorno)!
  const valore = (id: string) => orari[id] ?? { da: '', a: '' }
  const cambia = (id: string, m: Partial<{ da: string; a: string }>) => { setErrore(undefined); setOrari({ ...orari, [id]: { ...valore(id), ...m } }) }
  const completi = turni.flatMap((t) => {
    const da = minutiDaOrario(valore(t.id).da), a = minutiDaOrario(valore(t.id).a)
    return da !== undefined && a !== undefined ? [{ t, ...intervallo(g, da, a) }] : []
  })
  const minutiTotali = completi.reduce((n, c) => n + Math.round((c.fine - c.inizio) / 60_000), 0)

  async function salvaOrari() {
    if (turni.some((t) => Boolean(valore(t.id).da) !== Boolean(valore(t.id).a))) { setErrore('Scrivi sia l\'inizio sia la fine.'); return }
    if (completi.length === 0) { setErrore('Scrivi almeno un turno, oppure tocca Più tardi.'); return }
    await salvaTanti('turni', completi.map(({ t, inizio, fine }) => ({ ...t, inizio, fine, tuttoIlGiorno: undefined })))
    mostraAvviso(`Salvate ${F.durata(minutiTotali)}`, () => void salvaTanti('turni', completi.map((c) => c.t)))
  }

  async function nonChiedere() {
    await salvaImpostazioni({ orariNonChiesti: [...nonChiesti, giorno] })
    mostraAvviso('Non te lo chiedo più per questo giorno', () => void salvaImpostazioni({ orariNonChiesti: nonChiesti }))
  }

  return (
    <section className="banner-orari" aria-label="Orari dei turni passati">
      <div className="banner-orari-testa">
        <div>
          <h2 className="titolo-sezione">A che ora hai lavorato?</h2>
          <span className="secondario piccolo" style={{ textTransform: 'capitalize' }}>{F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12))}{altri > 0 ? ` · ${altri === 1 ? 'manca un altro giorno' : `mancano altri ${altri} giorni`}` : ''}</span>
        </div>
        <button type="button" className="elimina-riga" aria-label="Non chiedere per questo giorno" onClick={() => void nonChiedere()}>×</button>
      </div>
      {turni.map((t) => (
        <div key={t.id} className="banner-orari-riga">
          <span className="crescente" style={{ fontWeight: 600 }}>{nomi(t)}</span>
          <label>dalle <input type="time" value={valore(t.id).da} onChange={(e) => cambia(t.id, { da: e.target.value })} /></label>
          <label>alle <input type="time" value={valore(t.id).a} onChange={(e) => cambia(t.id, { a: e.target.value })} /></label>
        </div>
      ))}
      {errore && <span className="errore-orari piccolo">{errore}</span>}
      <div className="banner-orari-piede">
        <span className="secondario piccolo numeri">{minutiTotali > 0 ? `Totale ${F.durata(minutiTotali)}` : ''}</span>
        <div className="riga-azioni">
          <button type="button" className="pulsante" onClick={onRimanda}>Più tardi</button>
          <button type="button" className="pulsante primario" onClick={() => void salvaOrari()}>Salva</button>
        </div>
      </div>
    </section>
  )
}

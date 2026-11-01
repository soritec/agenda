import { useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, salva, salvaImpostazioni, salvaTanti } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { DiarioTurno, Turno } from '../../../dati/modello'
import { mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { CampoFileDiario, salvaFileDiario } from '../../specializzazione/viste/CampoFileDiario'
import { intervallo } from '../orari'
import { IconaAvanti, IconaSpunta } from '../../../interfaccia/icone'
import { giornoDaChiudere, giorniDaCompilare, nascondiNotteDiIeri } from '../orariDaScrivere'
import { chiaveGiorno, giornoDaChiave, minutiDaOrario, oggi, perId, titoloTurno } from '../supporto'

/** "Più tardi" vale finché l'app resta aperta: alla prossima apertura il banner ricompare. */
const rimandati = new Set<string>()

/** In cima a Oggi: dopo il turno chiede gli orari e, se si vuole, cosa si è imparato e cosa approfondire. */
export function BannerOrari() {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const diario = useCollezione('diarioTurni')
  const impostazioni = useImpostazioni()
  const [, aggiorna] = useState(0)
  const mappa = useMemo(() => perId(modelli), [modelli])
  const g0 = oggi()
  const giorni = useMemo(() => giorniDaCompilare(turni ?? [], g0, impostazioni?.orariNonChiesti, (diario ?? []).map((d) => d.giorno)),
    [turni, diario, impostazioni?.orariNonChiesti, chiaveGiorno(g0)]) // eslint-disable-line react-hooks/exhaustive-deps
  const daFare = giorni.filter((d) => !rimandati.has(d.giorno) && !nascondiNotteDiIeri(d, Date.now()))
  const primo = daFare[0]
  if (!impostazioni || !diario || !primo) return null
  return <RiquadroGiorno key={primo.giorno} giorno={primo.giorno} turni={primo.turni} guardie={primo.guardie} altri={daFare.length - 1} nomi={(t) => titoloTurno(t, mappa)}
    voce={diario.find((d) => d.giorno === primo.giorno)} nonChiesti={impostazioni.orariNonChiesti ?? []}
    onRimanda={() => { for (const d of daFare) rimandati.add(d.giorno); aggiorna((n) => n + 1) }} />
}

/** Sotto i turni di oggi: apre subito il banner, senza aspettare domani. */
export function FineTurnoOggi() {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const diario = useCollezione('diarioTurni')
  const impostazioni = useImpostazioni()
  const [aperto, setAperto] = useState(false)
  const mappa = useMemo(() => perId(modelli), [modelli])
  if (!impostazioni || !diario) return null
  const oggiDaChiudere = giornoDaChiudere(turni ?? [], Date.now(), impostazioni.orariNonChiesti, diario.map((d) => d.giorno))
  if (!oggiDaChiudere) return null
  if (!aperto) {
    return (
      <button type="button" className="fine-turno" onClick={() => setAperto(true)}>
        <IconaSpunta dimensione={18} /><span className="crescente">Hai finito il turno? Scrivi com'è andato</span><IconaAvanti dimensione={16} />
      </button>
    )
  }
  return <RiquadroGiorno key={oggiDaChiudere.giorno} giorno={oggiDaChiudere.giorno} turni={oggiDaChiudere.turni} guardie={oggiDaChiudere.guardie} altri={0} nomi={(t) => titoloTurno(t, mappa)}
    voce={diario.find((d) => d.giorno === oggiDaChiudere.giorno)} nonChiesti={impostazioni.orariNonChiesti ?? []} onRimanda={() => setAperto(false)} />
}

function RiquadroGiorno({ giorno, turni, guardie, altri, nomi, voce, nonChiesti, onRimanda }: {
  giorno: string; turni: Turno[]; guardie: Turno[]; altri: number; nomi: (t: Turno) => string; voce?: DiarioTurno; nonChiesti: string[]; onRimanda: () => void
}) {
  const [orari, setOrari] = useState<Record<string, { da: string; a: string }>>({})
  const [imparato, setImparato] = useState(voce?.imparato ?? '')
  const [approfondire, setApprofondire] = useState(voce?.approfondire ?? '')
  const [comeTask, setComeTask] = useState(true)
  const [file, setFile] = useState<File[]>([])
  const [errore, setErrore] = useState<string>()
  const g = giornoDaChiave(giorno)!
  const valore = (id: string) => orari[id] ?? { da: '', a: '' }
  const cambia = (id: string, m: Partial<{ da: string; a: string }>) => { setErrore(undefined); setOrari({ ...orari, [id]: { ...valore(id), ...m } }) }
  const completi = turni.flatMap((t) => {
    const da = minutiDaOrario(valore(t.id).da), a = minutiDaOrario(valore(t.id).a)
    return da !== undefined && a !== undefined ? [{ t, ...intervallo(g, da, a) }] : []
  })
  const minutiTotali = completi.reduce((n, c) => n + Math.round((c.fine - c.inizio) / 60_000), 0)
  const nomiGuardie = guardie.map(nomi).join(', ')

  async function salvaTutto() {
    const testoImparato = imparato.trim(), testoApprofondire = approfondire.trim()
    if (turni.some((t) => Boolean(valore(t.id).da) !== Boolean(valore(t.id).a))) { setErrore('Scrivi sia l\'inizio sia la fine.'); return }
    if (completi.length === 0 && !testoImparato && !testoApprofondire && file.length === 0) { setErrore('Scrivi almeno una cosa, oppure tocca Più tardi.'); return }
    if (completi.length) await salvaTanti('turni', completi.map(({ t, inizio, fine }) => ({ ...t, inizio, fine, tuttoIlGiorno: undefined })))
    let nuoveRisorse: string[]
    try { nuoveRisorse = await salvaFileDiario(file, F.dataBreve(istante(g.anno, g.mese, g.giorno, 12))) } catch (e) {
      setErrore(`Non sono riuscita a caricare un file: ${e instanceof Error ? e.message : 'errore sconosciuto'}.`)
      return
    }
    // Il riquadro può restare aperto se un turno è ancora senza orari: i file non vanno caricati due volte.
    setFile([])
    const risorse = [...(voce?.risorse ?? []), ...nuoveRisorse]
    const nuovaVoce = await salva('diarioTurni', {
      ...voce, id: giorno, giorno, turni: [...turni, ...guardie].map(nomi).join(', '), imparato: testoImparato || undefined, approfondire: testoApprofondire || undefined,
      risorse: risorse.length ? risorse : undefined,
    })
    const task = testoApprofondire && comeTask && testoApprofondire !== voce?.approfondire
      ? await salva('attivita', { titolo: `Approfondire: ${testoApprofondire}`, priorita: 'nessuna', area: 'specializzazione' }) : undefined
    mostraAvviso('Salvato', () => void (async () => {
      if (completi.length) await salvaTanti('turni', completi.map((c) => c.t))
      if (voce) await salva('diarioTurni', voce); else await elimina('diarioTurni', nuovaVoce.id)
      if (task) await elimina('attivita', task.id)
      await Promise.all(nuoveRisorse.map((id) => elimina('risorse', id)))
    })())
  }

  async function nonChiedere() {
    await salvaImpostazioni({ orariNonChiesti: [...nonChiesti, giorno] })
    mostraAvviso('Non te lo chiedo più per questo giorno', () => void salvaImpostazioni({ orariNonChiesti: nonChiesti }))
  }

  return (
    <section className="banner-orari" aria-label="Com'è andato il turno">
      <div className="banner-orari-testa">
        <div>
          <h2 className="titolo-sezione">Com'è andato il turno?</h2>
          <span className="secondario piccolo">
            <span style={{ textTransform: 'capitalize' }}>{F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12))}</span>
            {nomiGuardie ? ` · ${nomiGuardie}` : ''}{altri > 0 ? ` · ${altri === 1 ? 'manca un altro giorno' : `mancano altri ${altri} giorni`}` : ''}
          </span>
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
      <label className="appunto imparato">
        <span>Cosa ho imparato</span>
        <textarea rows={2} value={imparato} onChange={(e) => { setImparato(e.target.value); setErrore(undefined) }} />
      </label>
      <label className="appunto approfondire">
        <span>Cosa devo approfondire</span>
        <textarea rows={2} value={approfondire} onChange={(e) => { setApprofondire(e.target.value); setErrore(undefined) }} />
      </label>
      <CampoFileDiario file={file} onCambia={(f) => { setFile(f); setErrore(undefined) }} />
      {approfondire.trim() && (
        <label className="secondario piccolo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={comeTask} onChange={(e) => setComeTask(e.target.checked)} /> Aggiungilo ai task
        </label>
      )}
      <NotaPrivacy />
      {errore && <span className="errore-orari piccolo">{errore}</span>}
      <div className="banner-orari-piede">
        <span className="secondario piccolo numeri">{minutiTotali > 0 ? `Totale ${F.durata(minutiTotali)}` : ''}</span>
        <div className="riga-azioni">
          <button type="button" className="pulsante" onClick={onRimanda}>Più tardi</button>
          <button type="button" className="pulsante primario" onClick={() => void salvaTutto()}>Salva</button>
        </div>
      </div>
    </section>
  )
}

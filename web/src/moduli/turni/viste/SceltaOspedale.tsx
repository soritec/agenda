import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import { Campo, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { parametroMese } from '../../../interfaccia/navigazione'
import { assegnazioneDelMese, ultimoMese } from '../assegnazioni'

const NUOVA = '__nuova__'
const nomeMese = (chiave: string) => {
  const [a, m] = chiave.split('-').map(Number)
  return F.mese(istante(a!, m!, 1))
}

/** Ospedale di assegnazione da questo mese per N mesi: la sede vale per tutti i turni del periodo senza sede propria. */
export function SceltaOspedale({ anno, mese, onChiudi }: { anno: number; mese: number; onChiudi: () => void }) {
  const sedi = useCollezione('sedi')
  const assegnazioni = useCollezione('assegnazioni')
  const qui = parametroMese(anno, mese)
  const inCorso = assegnazioni ? assegnazioneDelMese(assegnazioni, anno, mese) : undefined
  const daQuestoMese = assegnazioni?.find((a) => a.meseInizio === qui)
  const [sedeId, setSedeId] = useState<string>(daQuestoMese?.sedeId ?? inCorso?.periodo.sedeId ?? '')
  const [nomeNuova, setNomeNuova] = useState('')
  const [mesi, setMesi] = useState(String(daQuestoMese?.mesi ?? 6))
  const numeroMesi = Number(mesi)
  const valido = Number.isInteger(numeroMesi) && numeroMesi >= 1 && numeroMesi <= 72 && (sedeId === NUOVA ? nomeNuova.trim() !== '' : sedeId !== '')

  async function conferma() {
    if (!valido) return
    let id = sedeId
    if (sedeId === NUOVA) id = (await salva('sedi', { nome: nomeNuova.trim() })).id
    await salva('assegnazioni', daQuestoMese ? { ...daQuestoMese, sedeId: id, mesi: numeroMesi } : { meseInizio: qui, mesi: numeroMesi, sedeId: id })
    onChiudi()
  }

  async function togli() {
    if (!daQuestoMese) return
    await elimina('assegnazioni', daQuestoMese.id)
    onChiudi()
    mostraAvviso('Ospedale tolto da questo periodo', () => void ripristina('assegnazioni', daQuestoMese.id))
  }

  const nomeSede = (id: string) => sedi?.find((s) => s.id === id)?.nome ?? '—'
  const ordinati = [...(assegnazioni ?? [])].sort((a, b) => a.meseInizio.localeCompare(b.meseInizio))

  return (
    <Foglio aperto titolo="Ospedale di assegnazione" onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        {inCorso && !daQuestoMese && (
          <p className="secondario" style={{ margin: 0 }}>
            Ora sei a <strong>{nomeSede(inCorso.periodo.sedeId)}</strong> (da {nomeMese(inCorso.periodo.meseInizio)} a {nomeMese(ultimoMese(inCorso.periodo))}).
            Se scegli un altro ospedale qui, vale da {nomeMese(qui)} in poi.
          </p>
        )}
        <Campo etichetta={`Ospedale da ${nomeMese(qui)}`}>
          <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
            <option value="">Scegli…</option>
            {(sedi ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            <option value={NUOVA}>+ Nuovo ospedale…</option>
          </select>
        </Campo>
        {sedeId === NUOVA && (
          <Campo etichetta="Nome del nuovo ospedale">
            <input value={nomeNuova} placeholder="es. Ospedale di …" onChange={(e) => setNomeNuova(e.target.value)} />
          </Campo>
        )}
        <Campo etichetta="Per quanti mesi">
          <input inputMode="numeric" value={mesi} onChange={(e) => setMesi(e.target.value)} />
        </Campo>
        <div className="riga-azioni">
          {[6, 12, 18].map((n) => (
            <button key={n} type="button" className="pillola" aria-pressed={numeroMesi === n} onClick={() => setMesi(String(n))}
              style={numeroMesi === n ? { borderColor: 'var(--primario)', color: 'var(--primario)', fontWeight: 700 } : undefined}>{n} mesi</button>
          ))}
        </div>
        {valido && (
          <span className="secondario piccolo">
            Da {nomeMese(qui)} a {nomeMese(ultimoMese({ meseInizio: qui, mesi: numeroMesi, sedeId }))}: i turni senza sede saranno segnati qui.
            Puoi sempre cambiare la sede di un singolo turno.
          </span>
        )}
        {daQuestoMese && <button type="button" className="pulsante pericolo" onClick={() => void togli()}>Togli questo periodo</button>}

        {ordinati.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="secondario piccolo">Periodi salvati</span>
            <div className="lista">
              {ordinati.map((a) => (
                <div key={a.id} className="riga" style={{ cursor: 'default' }}>
                  <span className="crescente">
                    <span style={{ fontWeight: 500 }}>{nomeSede(a.sedeId)}</span>
                    <span className="secondario piccolo">{nomeMese(a.meseInizio)} – {nomeMese(ultimoMese(a))} · {a.mesi} mesi</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Foglio>
  )
}

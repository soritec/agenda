import { useMemo } from 'react'
import { intervalloMese, istante } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { blobCSV, type TabellaExport } from '../../../export/csv'
import { IconaAvanti, IconaIndietro } from '../../../interfaccia/icone'
import { parametroMese } from '../../../interfaccia/navigazione'
import { calcolaRiepilogo } from '../riepilogo'
import { minuti, TITOLI_TIPO_TURNO, tipoTurnoDa, type TipoTurno } from '../tipi'
import { datiConSede, datiDa, perId, sedeEffettiva, titoloTurno } from '../supporto'

const TITOLI_STATO = { pianificato: 'Pianificato', svolto: 'Svolto', pagato: 'Pagato' } as const

export function RiepilogoTurni({ anno, mese }: { anno: number; mese: number }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const assegnazioni = useCollezione('assegnazioni')
  const impostazioni = useImpostazioni()
  const mappaSedi = useMemo(() => perId(sedi), [sedi])
  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const sabatoFestivo = impostazioni?.sabatoFestivo
  const riepilogo = useMemo(
    () => (impostazioni && turni ? calcolaRiepilogo(turni.map((t) => datiConSede(t, assegnazioni)), anno, mese, { sabatoFestivo }) : undefined),
    [impostazioni, sabatoFestivo, turni, assegnazioni, anno, mese],
  )

  if (!riepilogo || !turni) return null

  const nomeMese = F.mese(istante(anno, mese, 1))
  const precedente = mese === 1 ? parametroMese(anno - 1, 12) : parametroMese(anno, mese - 1)
  const successivo = mese === 12 ? parametroMese(anno + 1, 1) : parametroMese(anno, mese + 1)
  const perSede = [...riepilogo.minutiPerSede.entries()].sort((a, b) => b[1] - a[1])
  const massimo = Math.max(1, ...perSede.map(([, m]) => m))
  const perTipo = [...riepilogo.minutiPerTipo.entries()].sort((a, b) => b[1] - a[1]) as [TipoTurno, number][]

  function esportaCSV() {
    if (!turni) return
    const { inizio, fine } = intervalloMese(anno, mese)
    const delMese = turni.filter((t) => t.inizio >= inizio && t.inizio < fine).sort((a, b) => a.inizio - b.inizio)
    const tabella: TabellaExport = {
      titolo: `Turni ${nomeMese}`,
      intestazioni: ['Data', 'Inizio', 'Fine', 'Ore', 'Turno', 'Tipo', 'Sede', 'Stato', 'Festivo', 'Compenso €', 'Note'],
      righe: delMese.map((t) => {
        const idSede = sedeEffettiva(t, assegnazioni)
        const sede = idSede ? mappaSedi.get(idSede) : undefined
        return [
          { tipo: 'data', istante: t.inizio },
          { tipo: 'ora', istante: t.inizio },
          { tipo: 'ora', istante: t.fine },
          { tipo: 'ore', minuti: minuti(datiDa(t)) },
          { tipo: 'testo', valore: titoloTurno(t, mappaModelli) },
          { tipo: 'testo', valore: TITOLI_TIPO_TURNO[tipoTurnoDa(t.tipo)] },
          { tipo: 'testo', valore: sede?.nome ?? '' },
          { tipo: 'testo', valore: TITOLI_STATO[t.stato] },
          { tipo: 'testo', valore: eFestivo(t.inizio, { sabatoFestivo }) ? 'sì' : 'no' },
          t.compensoCent !== undefined ? { tipo: 'importo', centesimi: t.compensoCent } : { tipo: 'vuota' },
          { tipo: 'testo', valore: t.note ?? '' },
        ]
      }),
    }
    const url = URL.createObjectURL(blobCSV(tabella))
    const a = document.createElement('a')
    a.href = url
    a.download = `Turni ${nomeMese}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <div className="schermata" style={{ maxWidth: 820 }}>
      <header className="intestazione">
        <div>
          <a href={`#/turni?mese=${parametroMese(anno, mese)}`} className="piccolo">‹ Turni</a>
          <h1 className="titolo-grande" style={{ textTransform: 'capitalize' }}>{nomeMese}</h1>
        </div>
        <div className="riga-azioni">
          <a className="pulsante tondo" href={`#/turni/riepilogo?mese=${precedente}`} aria-label="Mese precedente"><IconaIndietro dimensione={18} /></a>
          <a className="pulsante tondo" href={`#/turni/riepilogo?mese=${successivo}`} aria-label="Mese successivo"><IconaAvanti dimensione={18} /></a>
        </div>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span className="numeri" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.03em' }}>{F.durata(riepilogo.minutiTotali)}</span>
          <span className="secondario">lavorate</span>
        </div>
        <div className="tessere">
          <div className="tessera"><span className="valore">{riepilogo.numeroTurni}</span><span className="secondario piccolo">turni</span></div>
          <div className="tessera"><span className="valore">{riepilogo.notti}</span><span className="secondario piccolo">notti</span></div>
          <div className="tessera"><span className="valore">{riepilogo.turniFestivi}</span><span className="secondario piccolo">festivi</span></div>
          <div className="tessera"><span className="valore">{F.durata(riepilogo.minutiInGiorniFestivi)}</span><span className="secondario piccolo">in giorni festivi</span></div>
        </div>
        <span className="secondario piccolo">
          Sabato {impostazioni?.sabatoFestivo ? 'contato come festivo' : 'contato come feriale'} · <a href="#/turni/impostazioni">Cambia</a>
        </span>
      </section>

      <section className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="titolo-sezione">Per sede</h2>
        {perSede.length === 0 && <span className="secondario">Nessun turno in questo mese.</span>}
        {perSede.map(([id, m]) => (
          <div key={id ?? 'nessuna'} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{(id && mappaSedi.get(id)?.nome) || 'Senza sede'}</span>
              <span className="secondario numeri">{F.durata(m)}</span>
            </div>
            <div className="barra"><div style={{ width: `${Math.round((m / massimo) * 100)}%` }} /></div>
          </div>
        ))}
      </section>

      {perTipo.length > 0 && (
        <section>
          <h2 className="titolo-sezione" style={{ marginBottom: 8 }}>Per tipo</h2>
          <div className="lista">
            {perTipo.map(([tipo, m]) => (
              <div key={tipo} className="riga" style={{ cursor: 'default' }}>
                <span className="crescente">{TITOLI_TIPO_TURNO[tipo]}</span>
                <span className="secondario numeri">{riepilogo.turniPerTipo.get(tipo)} · {F.durata(m)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {riepilogo.compensoCent > 0 && (
        <section className="scheda">
          <div className="secondario piccolo">Compensi inseriti da te</div>
          <div className="numeri" style={{ fontSize: 22, fontWeight: 600 }}>{F.importo(riepilogo.compensoCent)}</div>
        </section>
      )}

      <div className="riga-azioni">
        <button type="button" className="pulsante" onClick={esportaCSV}>Esporta per Excel (CSV)</button>
      </div>
    </div>
  )
}

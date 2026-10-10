import { useMemo } from 'react'
import { aggiungiGiorni, inizioGiorno } from './nucleo/calendario'
import * as F from './nucleo/formati'
import { useCollezione, useImpostazioni } from './dati/hooks'
import { Guscio, InArrivo, type Sezione } from './interfaccia/Guscio'
import { meseDaParametro, useRotta } from './interfaccia/navigazione'
import { DettaglioTurno } from './moduli/turni/viste/DettaglioTurno'
import { ImpostazioniTurni } from './moduli/turni/viste/ImpostazioniTurni'
import { NuoviTurni } from './moduli/turni/viste/NuoviTurni'
import { RiepilogoTurni } from './moduli/turni/viste/RiepilogoTurni'
import { VistaTurni } from './moduli/turni/viste/VistaTurni'
import { datiDa, eNotte, oggi, perId, siglaTurno, titoloTurno } from './moduli/turni/supporto'
import { minuti } from './moduli/turni/tipi'

export function App() {
  const { percorso, parametri } = useRotta()
  const [sezione = 'oggi', sotto] = percorso
  const g0 = oggi()
  const { anno, mese } = meseDaParametro(parametri.get('mese'), { anno: g0.anno, mese: g0.mese })

  let pagina
  if (sezione === 'turni') {
    if (sotto === 'nuovi') pagina = <NuoviTurni anno={anno} mese={mese} giorniIniziali={parametri.get('giorni')?.split(',') ?? []} />
    else if (sotto === 'riepilogo') pagina = <RiepilogoTurni anno={anno} mese={mese} />
    else if (sotto === 'impostazioni') pagina = <ImpostazioniTurni />
    else if (sotto) pagina = <DettaglioTurno key={sotto} id={sotto} />
    else pagina = <VistaTurni anno={anno} mese={mese} />
  } else if (sezione === 'agenda') pagina = <InArrivo titolo="Agenda" />
  else if (sezione === 'moduli') pagina = <InArrivo titolo="Moduli" />
  else if (sezione === 'cerca') pagina = <InArrivo titolo="Cerca" />
  else pagina = <Oggi />

  const attiva = (['oggi', 'agenda', 'turni', 'moduli', 'cerca'].includes(sezione) ? sezione : 'oggi') as Sezione
  return <Guscio attiva={attiva}>{pagina}</Guscio>
}

/** Prima versione di "Oggi": i turni di oggi e domani. Eventi e task arriveranno con i loro moduli. */
function Oggi() {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  useImpostazioni()
  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])
  const g0 = oggi()
  const da = inizioGiorno(g0), a = inizioGiorno(aggiungiGiorni(g0, 2))
  const vicini = (turni ?? []).filter((t) => t.fine > Date.now() && t.inizio < a && t.fine > da).sort((x, y) => x.inizio - y.inizio)
  const prossimo = vicini[0]
  const sede = prossimo?.sedeId ? mappaSedi.get(prossimo.sedeId) : undefined
  const partenza = prossimo && sede?.minutiViaggio ? prossimo.inizio - sede.minutiViaggio * 60_000 : undefined

  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header>
        <div className="sopratitolo">{F.dataEstesa(Date.now())}</div>
        <h1 className="titolo-grande">Oggi</h1>
      </header>
      {prossimo ? (
        <a className="scheda" href={`#/turni/${prossimo.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--testo)' }}>
          <span className="secondario piccolo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--area-lavoro)' }} />
            Prossimo turno · {F.dataBreve(prossimo.inizio)}
          </span>
          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 22, fontWeight: 600 }}>{titoloTurno(prossimo, mappaModelli)}</span>
            <span className="secondario numeri">{F.durata(minuti(datiDa(prossimo)))}</span>
          </span>
          <span className="secondario numeri">{F.ora(prossimo.inizio)} – {F.ora(prossimo.fine)}{sede ? ` · ${sede.nome}` : ''}</span>
          {partenza && <span style={{ color: 'var(--accento)', fontWeight: 500, borderTop: '1px solid var(--linea)', paddingTop: 10 }}>Parti alle {F.ora(partenza)} · {sede!.minutiViaggio} min di viaggio</span>}
        </a>
      ) : (
        <div className="scheda secondario">Nessun turno oggi e domani. <a href="#/turni">Vai ai turni</a></div>
      )}
      {vicini.length > 1 && (
        <div className="lista">
          {vicini.slice(1).map((t) => (
            <a key={t.id} className="riga" href={`#/turni/${t.id}`}>
              <span className={`sigla${eNotte(t.tipo) ? ' notte' : ''}`}>{siglaTurno(t, mappaModelli)}</span>
              <span className="crescente">
                <span style={{ fontWeight: 500 }}>{titoloTurno(t, mappaModelli)}</span>
                <span className="secondario piccolo numeri">{F.dataBreve(t.inizio)} · {F.ora(t.inizio)} – {F.ora(t.fine)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
      <p className="secondario piccolo">Eventi, task e promemoria compariranno qui quando arriveranno i rispettivi moduli.</p>
    </div>
  )
}

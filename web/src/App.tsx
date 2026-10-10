import { useMemo } from 'react'
import { aggiungiGiorni, inizioGiorno } from './nucleo/calendario'
import * as F from './nucleo/formati'
import { useCollezione } from './dati/hooks'
import { Guscio, InArrivo, type Sezione } from './interfaccia/Guscio'
import { meseDaParametro, useRotta } from './interfaccia/navigazione'
import { DettaglioTurno } from './moduli/turni/viste/DettaglioTurno'
import { ImpostazioniTurni } from './moduli/turni/viste/ImpostazioniTurni'
import { NuoviTurni } from './moduli/turni/viste/NuoviTurni'
import { RiepilogoTurni } from './moduli/turni/viste/RiepilogoTurni'
import { VistaTurni } from './moduli/turni/viste/VistaTurni'
import { classeSigla, datiDa, oggi, perId, siglaTurno, titoloTurno } from './moduli/turni/supporto'
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

/** "Oggi": le attività di oggi in evidenza, quelle di domani più piccole e richiudibili. Per ora sono i turni; eventi e task arriveranno con i loro moduli. */
function Oggi() {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])
  const g0 = oggi()
  const inizioOggi = inizioGiorno(g0), inizioDomani = inizioGiorno(aggiungiGiorni(g0, 1)), inizioDopodomani = inizioGiorno(aggiungiGiorni(g0, 2))
  const ordinati = [...(turni ?? [])].sort((x, y) => x.inizio - y.inizio)
  // Oggi: turni che iniziano oggi o sono ancora in corso (es. la notte iniziata ieri sera).
  const diOggi = ordinati.filter((t) => t.inizio < inizioDomani && t.fine > inizioOggi)
  const diDomani = ordinati.filter((t) => t.inizio >= inizioDomani && t.inizio < inizioDopodomani)

  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header>
        <div className="sopratitolo">{F.dataEstesa(Date.now())}</div>
        <h1 className="titolo-grande">Oggi</h1>
      </header>

      {diOggi.length === 0 && <div className="scheda secondario">Nessuna attività oggi. <a href="#/turni">Vai ai turni</a></div>}
      {diOggi.map((t) => {
        const sede = t.sedeId ? mappaSedi.get(t.sedeId) : undefined
        const partenza = sede?.minutiViaggio && t.inizio > Date.now() ? t.inizio - sede.minutiViaggio * 60_000 : undefined
        return (
          <a key={t.id} className="scheda" href={`#/turni/${t.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--testo)' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={classeSigla(t.tipo)}>{siglaTurno(t, mappaModelli)}</span>
                <span style={{ fontSize: 22, fontWeight: 600 }}>{titoloTurno(t, mappaModelli)}</span>
              </span>
              <span className="secondario numeri">{F.durata(minuti(datiDa(t)))}</span>
            </span>
            <span className="secondario numeri">{F.ora(t.inizio)} – {F.ora(t.fine)}{sede ? ` · ${sede.nome}` : ''}</span>
            {t.note && <span className="piccolo" style={{ whiteSpace: 'pre-wrap' }}>{t.note}</span>}
            {partenza && <span style={{ color: 'var(--accento)', fontWeight: 500, borderTop: '1px solid var(--linea)', paddingTop: 10 }}>Parti alle {F.ora(partenza)} · {sede!.minutiViaggio} min di viaggio</span>}
          </a>
        )
      })}

      <details className="domani" open={diOggi.length === 0}>
        <summary className="titolo-sezione" style={{ cursor: 'pointer' }}>
          Domani <span className="secondario piccolo" style={{ fontWeight: 400 }}>· {diDomani.length === 0 ? 'nessuna attività' : diDomani.length === 1 ? '1 attività' : `${diDomani.length} attività`}</span>
        </summary>
        <div className="lista" style={{ marginTop: 8 }}>
          {diDomani.length === 0 && <div className="vuoto piccolo">Niente in programma</div>}
          {diDomani.map((t) => (
            <a key={t.id} className="riga piccolo" href={`#/turni/${t.id}`}>
              <span className={classeSigla(t.tipo)}>{siglaTurno(t, mappaModelli)}</span>
              <span className="crescente">
                <span style={{ fontWeight: 500 }}>{titoloTurno(t, mappaModelli)}</span>
                <span className="secondario numeri">{F.ora(t.inizio)} – {F.ora(t.fine)}{t.sedeId && mappaSedi.get(t.sedeId) ? ` · ${mappaSedi.get(t.sedeId)!.nome}` : ''}</span>
              </span>
            </a>
          ))}
        </div>
      </details>
      <p className="secondario piccolo">Eventi, task e promemoria compariranno qui quando arriveranno i rispettivi moduli.</p>
    </div>
  )
}

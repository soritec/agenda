import { useMemo } from 'react'
import { aggiungiGiorni, inizioGiorno } from './nucleo/calendario'
import * as F from './nucleo/formati'
import { linkGoogleMaps } from './nucleo/viaggio'
import { useCollezione } from './dati/hooks'
import { Guscio, InArrivo, SEZIONI, type Sezione } from './interfaccia/Guscio'
import { meseDaParametro, useRotta } from './interfaccia/navigazione'
import { DettaglioTurno } from './moduli/turni/viste/DettaglioTurno'
import { ImpostazioniTurni } from './moduli/turni/viste/ImpostazioniTurni'
import { NuoviTurni } from './moduli/turni/viste/NuoviTurni'
import { RiepilogoTurni } from './moduli/turni/viste/RiepilogoTurni'
import { StampaTurni } from './moduli/turni/viste/StampaTurni'
import { Impostazioni } from './interfaccia/Impostazioni'
import { SezioneInArrivo, Specializzazione } from './moduli/specializzazione/viste/Specializzazione'
import { Agenda, ElencoImpegni } from './moduli/agenda/viste/Agenda'
import { Task, TaskDiOggi } from './moduli/task/viste/Task'
import { Calcolatori } from './moduli/calcolatori/Calcolatori'
import { Logbook } from './moduli/specializzazione/viste/Logbook'
import { EsamiOLezioni } from './moduli/specializzazione/viste/Esami'
import { Tasse } from './moduli/specializzazione/viste/Tasse'
import { SchedaProcedura } from './moduli/specializzazione/viste/SchedaProcedura'
import { ImpostazioniSpecializzazione } from './moduli/specializzazione/viste/ImpostazioniSpecializzazione'
import { IconaImpostazioni } from './interfaccia/icone'
import { VistaTurni } from './moduli/turni/viste/VistaTurni'
import { impegniTra } from './moduli/agenda/impegni'
import { chiaveGiorno, classeSigla, datiDa, oggi, perId, sedeEffettiva, siglaTurno, titoloTurno } from './moduli/turni/supporto'
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
    else if (sotto === 'stampa') pagina = <StampaTurni anno={anno} mese={mese} />
    else if (sotto) pagina = <DettaglioTurno key={sotto} id={sotto} />
    else pagina = <VistaTurni anno={anno} mese={mese} />
  } else if (sezione === 'agenda') {
    pagina = <Agenda key={sotto === 'evento' ? percorso[2] : 'agenda'} vistaParam={parametri.get('vista')} giornoParam={parametri.get('giorno')} eventoAperto={sotto === 'evento' ? percorso[2] : undefined} />
  } else if (sezione === 'specializzazione') {
    if (sotto === 'logbook') pagina = <Logbook key={parametri.get('nuova') ?? ''} apriNuova={parametri.get('nuova') === '1'} />
    else if (sotto === 'esami') pagina = <EsamiOLezioni key="esame" tipo="esame" />
    else if (sotto === 'lezioni') pagina = <EsamiOLezioni key="lezione" tipo="lezione" />
    else if (sotto === 'tasse') pagina = <Tasse />
    else if (sotto === 'procedura' && percorso[2]) pagina = <SchedaProcedura id={percorso[2]} />
    else if (sotto === 'calcolatori') pagina = <Calcolatori key={percorso[2] ?? ''} id={percorso[2]} />
    else if (sotto === 'ricerca') pagina = <SezioneInArrivo titolo="Ricerca" testo="Questa sezione la sviluppiamo più avanti: dimmi tu cosa ti serve (progetti, articoli, scadenze, dati raccolti…)." />
    else if (sotto === 'impostazioni') pagina = <ImpostazioniSpecializzazione />
    else pagina = <Specializzazione />
  } else if (sezione === 'task') pagina = <Task key={parametri.get('scheda') ?? 'oggi'} apertoId={sotto} giorno={parametri.get('giorno')} minuto={parametri.get('minuto')} scheda={parametri.get('scheda')} />
  else if (sezione === 'studio') pagina = <InArrivo titolo="Studio e risorse" />
  else if (sezione === 'budget') pagina = <InArrivo titolo="Budget" />
  else if (sezione === 'journaling') pagina = <InArrivo titolo="Journaling" />
  else if (sezione === 'cerca') pagina = <InArrivo titolo="Cerca" />
  else if (sezione === 'impostazioni') pagina = <Impostazioni />
  else pagina = <Oggi />

  const attiva = (sezione === 'impostazioni' || SEZIONI.some((x) => x.id === sezione) ? sezione : 'oggi') as Sezione | 'impostazioni'
  return <Guscio attiva={attiva}>{pagina}</Guscio>
}

/** "Oggi": le attività di oggi in evidenza, quelle di domani più piccole e richiudibili. */
function Oggi() {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const assegnazioni = useCollezione('assegnazioni')
  const giornate = useCollezione('ferie')
  const eventi = useCollezione('eventi')
  const esami = useCollezione('esami')
  const tasse = useCollezione('tasse')
  const attivita = useCollezione('attivita')
  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])
  const g0 = oggi()
  // Gli altri impegni dell'agenda (i turni hanno le loro schede qui sotto).
  const altri = impegniTra({ giornate, eventi, esami, tasse, attivita }, chiaveGiorno(g0), chiaveGiorno(aggiungiGiorni(g0, 1)))
  // I task di oggi hanno un riquadro a parte, con il cerchio da spuntare.
  const altriOggi = altri.filter((i) => i.giorno === chiaveGiorno(g0) && i.fonte !== 'task')
  const altriDomani = altri.filter((i) => i.giorno !== chiaveGiorno(g0))
  const inizioOggi = inizioGiorno(g0), inizioDomani = inizioGiorno(aggiungiGiorni(g0, 1)), inizioDopodomani = inizioGiorno(aggiungiGiorni(g0, 2))
  const ordinati = [...(turni ?? [])].sort((x, y) => x.inizio - y.inizio)
  // Oggi: turni che iniziano oggi o sono ancora in corso (es. la notte iniziata ieri sera).
  const diOggi = ordinati.filter((t) => t.inizio < inizioDomani && t.fine > inizioOggi)
  const diDomani = ordinati.filter((t) => t.inizio >= inizioDomani && t.inizio < inizioDopodomani)

  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header className="intestazione">
        <div>
          <div className="sopratitolo">{F.dataEstesa(Date.now())}</div>
          <h1 className="titolo-grande">Oggi</h1>
        </div>
        <a className="pulsante tondo" href="#/impostazioni" aria-label="Impostazioni, sincronizzazione e backup"><IconaImpostazioni dimensione={18} /></a>
      </header>

      {diOggi.length === 0 && altriOggi.length === 0 && <div className="scheda secondario">Nessuna attività oggi. <a href="#/agenda">Vai all'agenda</a></div>}
      {altriOggi.length > 0 && <ElencoImpegni voci={altriOggi} />}
      {diOggi.map((t) => {
        const sede = mappaSedi.get(sedeEffettiva(t, assegnazioni) ?? '')
        const partenza = sede?.minutiViaggio && !t.tuttoIlGiorno && t.inizio > Date.now() ? t.inizio - sede.minutiViaggio * 60_000 : undefined
        return (
          <div key={t.id} className="scheda scheda-turno">
            <a href={`#/turni/${t.id}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--testo)' }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={classeSigla(t.tipo)}>{siglaTurno(t, mappaModelli)}</span>
                  <span className="titolo">{titoloTurno(t, mappaModelli)}</span>
                </span>
                {minuti(datiDa(t)) > 0 && <span className="secondario piccolo numeri">{F.durata(minuti(datiDa(t)))}</span>}
              </span>
              <span className="secondario piccolo numeri">{t.tuttoIlGiorno ? 'Tutto il giorno' : `${F.ora(t.inizio)} – ${F.ora(t.fine)}`}{sede ? ` · ${sede.nome}` : ''}</span>
              {t.note && <span className="piccolo" style={{ whiteSpace: 'pre-wrap' }}>{t.note}</span>}
            </a>
            {(partenza || sede?.indirizzo) && (
              <span className="piccolo" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: '1px solid var(--linea)', paddingTop: 8 }}>
                {partenza ? <span style={{ color: 'var(--accento)', fontWeight: 500 }}>Parti alle {F.ora(partenza)} · {sede!.minutiViaggio} min</span> : <span />}
                {sede?.indirizzo && <a href={linkGoogleMaps(sede.indirizzo)} target="_blank" rel="noreferrer">Percorso con traffico ›</a>}
              </span>
            )}
          </div>
        )
      })}

      <TaskDiOggi />

      <details className="domani" open={diOggi.length === 0 && altriOggi.length === 0}>
        <summary className="titolo-sezione" style={{ cursor: 'pointer' }}>
          Domani <span className="secondario piccolo" style={{ fontWeight: 400 }}>· {diDomani.length + altriDomani.length === 0 ? 'nessuna attività' : diDomani.length + altriDomani.length === 1 ? '1 attività' : `${diDomani.length + altriDomani.length} attività`}</span>
        </summary>
        <div className="lista" style={{ marginTop: 8 }}>
          {diDomani.length + altriDomani.length === 0 && <div className="vuoto piccolo">Niente in programma</div>}
          {diDomani.map((t) => (
            <a key={t.id} className="riga piccolo" href={`#/turni/${t.id}`}>
              <span className={classeSigla(t.tipo)}>{siglaTurno(t, mappaModelli)}</span>
              <span className="crescente">
                <span style={{ fontWeight: 500 }}>{titoloTurno(t, mappaModelli)}</span>
                <span className="secondario numeri">{t.tuttoIlGiorno ? 'Tutto il giorno' : `${F.ora(t.inizio)} – ${F.ora(t.fine)}`}{mappaSedi.get(sedeEffettiva(t, assegnazioni) ?? '') ? ` · ${mappaSedi.get(sedeEffettiva(t, assegnazioni) ?? '')!.nome}` : ''}</span>
              </span>
            </a>
          ))}
        </div>
        {altriDomani.length > 0 && <div style={{ marginTop: 8 }}><ElencoImpegni voci={altriDomani} /></div>}
      </details>
    </div>
  )
}


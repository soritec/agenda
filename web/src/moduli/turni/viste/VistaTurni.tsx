import { useMemo, useRef, useState } from 'react'
import { intervalloMese, istante, stessoGiorno } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva, salvaTanti } from '../../../dati/archivio'
import { CATALOGO_SCUOLA } from '../catalogoScuola'
import { eliminaTurno as eliminaTurnoConSmonto } from '../smonto'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { GiornoRapido } from './GiornoRapido'
import { SceltaOspedale } from './SceltaOspedale'
import { assegnazioneDelMese } from '../assegnazioni'
import { IconaAvanti, IconaImpostazioni, IconaIndietro, IconaPiu } from '../../../interfaccia/icone'
import { parametroMese } from '../../../interfaccia/navigazione'
import { sovrapposizioni } from '../controlli'
import { calcolaRiepilogo } from '../riepilogo'
import { AREE_ROTAZIONE, areaDelMese, MESI_PER_ROTAZIONE, TITOLI_AREA, type AreaRotazione } from '../rotazione'
import { ETICHETTE_GIORNATA, minuti, TIPI_GIORNATA, tipoGiornataDa, tipoTurnoDa, TITOLI_GIORNATA, TITOLI_TIPO_TURNO, type TipoTurno } from '../tipi'
import { celleMese, chiaveGiorno, classeSigla, datiConSede, datiDa, larghezzaTurno, sedeEffettiva, oggi, orarioCompatto, perId, siglaTurno, titoloTurno, turniPerGiorno } from '../supporto'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export function VistaTurni({ anno, mese }: { anno: number; mese: number }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const periodi = useCollezione('periodiRotazione')
  const assegnazioni = useCollezione('assegnazioni')
  const ferie = useCollezione('ferie')
  const impostazioni = useImpostazioni()
  const [sceltaArea, setSceltaArea] = useState(false)
  const [sceltaOspedale, setSceltaOspedale] = useState(false)
  // Giorno in cui l'utente ha tenuto premuto un turno: mostra le × per eliminare.
  const [inModifica, setInModifica] = useState<string>()
  const [giornoAperto, setGiornoAperto] = useState<string>()
  const pressione = useRef<{ timer?: ReturnType<typeof setTimeout>; scattata: boolean }>({ scattata: false })
  const ferieDelGiorno = useMemo(() => new Map((ferie ?? []).map((f) => [f.giorno, f])), [ferie])

  function iniziaPressione(giorno: string) {
    pressione.current.scattata = false
    clearTimeout(pressione.current.timer)
    pressione.current.timer = setTimeout(() => {
      pressione.current.scattata = true
      setInModifica(giorno)
      navigator.vibrate?.(15)
    }, 500)
  }
  function fermaPressione() {
    clearTimeout(pressione.current.timer)
  }
  async function eliminaGiornata(id: string, nome: string) {
    await elimina('ferie', id)
    setInModifica(undefined)
    mostraAvviso(`Tolto: ${nome}`, () => void ripristina('ferie', id))
  }
  async function eliminaTurno(id: string, nome: string) {
    const annulla = await eliminaTurnoConSmonto(id)
    setInModifica(undefined)
    mostraAvviso(`Eliminato: ${nome}`, () => void annulla())
  }

  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])
  const perGiorno = useMemo(() => turniPerGiorno(turni ?? []), [turni])
  const sabatoFestivo = impostazioni?.sabatoFestivo
  const riepilogo = useMemo(
    () => (turni && impostazioni ? calcolaRiepilogo(turni.map((t) => datiConSede(t, assegnazioni)), anno, mese, { sabatoFestivo }) : undefined),
    [turni, assegnazioni, impostazioni, sabatoFestivo, anno, mese],
  )
  const delMese = useMemo(() => {
    const { inizio, fine } = intervalloMese(anno, mese)
    return (turni ?? []).filter((t) => t.inizio >= inizio && t.inizio < fine)
  }, [turni, anno, mese])
  const numeroSovrapposizioni = useMemo(() => sovrapposizioni(delMese.map(datiDa)).length, [delMese])
  const tipiDelMese = useMemo(() => [...new Set(delMese.map((t) => tipoTurnoDa(t.tipo)))] as TipoTurno[], [delMese])
  const prossimi = useMemo(() => {
    const ora = Date.now()
    return (turni ?? []).filter((t) => t.fine > ora).sort((a, b) => a.inizio - b.inizio).slice(0, 5)
  }, [turni])

  const qui = parametroMese(anno, mese)
  const giornateMese = TIPI_GIORNATA.map((tipo) => ({
    tipo, numero: (ferie ?? []).filter((f) => f.giorno.startsWith(qui) && tipoGiornataDa(f.tipo) === tipo).length,
  })).filter((x) => x.numero > 0)
  const area = periodi ? areaDelMese(periodi, anno, mese) : undefined
  const ancoraDelMese = periodi?.find((p) => p.meseInizio === qui)
  const ospedale = assegnazioni ? assegnazioneDelMese(assegnazioni, anno, mese) : undefined
  const precedente = mese === 1 ? parametroMese(anno - 1, 12) : parametroMese(anno, mese - 1)
  const successivo = mese === 12 ? parametroMese(anno + 1, 1) : parametroMese(anno, mese + 1)
  const g0 = oggi()

  async function scegliArea(a: AreaRotazione) {
    await salva('periodiRotazione', ancoraDelMese ? { ...ancoraDelMese, area: a } : { meseInizio: qui, area: a })
    setSceltaArea(false)
  }

  return (
    <div className="schermata">
      <header className="intestazione">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="sopratitolo">{F.mese(istante(anno, mese, 1))}</span>
            {periodi && (
              <button type="button" className={`pillola${area ? ` ${area.area}` : ''}`} onClick={() => setSceltaArea(true)}>
                {area ? `${TITOLI_AREA[area.area]} · mese ${area.meseDellaRotazione} di ${MESI_PER_ROTAZIONE}` : 'Scegli l’area di rotazione'}
              </button>
            )}
            {assegnazioni && (
              <button type="button" className={`pillola${ospedale ? ' ospedale' : ''}`} onClick={() => setSceltaOspedale(true)}>
                {ospedale && mappaSedi.get(ospedale.periodo.sedeId)
                  ? `${mappaSedi.get(ospedale.periodo.sedeId)!.nome} · mese ${ospedale.meseDelPeriodo} di ${ospedale.periodo.mesi}`
                  : 'Scegli l’ospedale'}
              </button>
            )}
          </div>
          <h1 className="titolo-grande">Turni</h1>
        </div>
        <div className="riga-azioni">
          <a className="pulsante tondo" href={`#/turni?mese=${precedente}`} aria-label="Mese precedente"><IconaIndietro dimensione={18} /></a>
          <a className="pulsante" href={`#/turni?mese=${parametroMese(g0.anno, g0.mese)}`}>Oggi</a>
          <a className="pulsante tondo" href={`#/turni?mese=${successivo}`} aria-label="Mese successivo"><IconaAvanti dimensione={18} /></a>
          <a className="pulsante" href={`#/turni/stampa?mese=${qui}`}>Stampa · PDF</a>
          <a className="pulsante tondo" href="#/turni/impostazioni" aria-label="Turni tipo, sedi e regole"><IconaImpostazioni dimensione={18} /></a>
          <a className="pulsante tondo primario" href={`#/turni/nuovi?mese=${qui}`} aria-label="Aggiungi turni"><IconaPiu dimensione={18} /></a>
        </div>
      </header>

      {modelli && modelli.length === 0 && (
        <div className="scheda">
          <div className="titolo-sezione">Per iniziare, carica i turni tipo</div>
          <p className="secondario">Con un tocco aggiungo le sigle della scuola (G, N, R, P, DSO, E, Sop…). Poi puoi modificarle o aggiungerne altre.</p>
          <div className="riga-azioni">
            <button type="button" className="pulsante primario" onClick={() => void salvaTanti('modelliTurno', CATALOGO_SCUOLA.map((v, i) => ({
              nome: v.nome, sigla: v.sigla, tipo: v.tipo, ordine: i,
              minutoInizio: v.orari[0], minutoFine: v.orari[1],
            })))}>Carica le sigle della scuola</button>
            <a className="pulsante" href="#/turni/impostazioni">Crea a mano</a>
          </div>
        </div>
      )}

      <div className="colonne">
        <div className="principale">
          <section className="mese grande" aria-label="Calendario del mese: tocca un giorno per aggiungere un turno">
            <div className="giorni-settimana">{GIORNI.map((g) => <span key={g}>{g}</span>)}</div>
            <div className="griglia">
              {celleMese(anno, mese).map((g, i) => {
                if (!g) return <span key={`v${i}`} />
                const k = chiaveGiorno(g)
                const delGiorno = perGiorno.get(k) ?? []
                const festivo = eFestivo(istante(g.anno, g.mese, g.giorno, 12), { sabatoFestivo })
                const classi = ['cella', festivo && 'festivo', stessoGiorno(g, g0) && 'oggi'].filter(Boolean).join(' ')
                const ferieGiorno = ferieDelGiorno.get(k)
                const modifica = inModifica === k
                return (
                  <div key={k} className={`${classi}${ferieGiorno ? ` g-${tipoGiornataDa(ferieGiorno.tipo)}` : ''}`}>
                    <button type="button" className="aggiungi"
                      onClick={() => (inModifica ? setInModifica(undefined) : setGiornoAperto(k))}
                      aria-label={`Apri ${F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12))}: aggiungi turni o giornate`} />
                    <span className="numero">{g.giorno}</span>
                    <span className="sigle">
                      {ferieGiorno && (
                        <span className="riga-turno">
                          <button type="button" className={`etichetta-giornata g-${tipoGiornataDa(ferieGiorno.tipo)}`}
                            onPointerDown={() => iniziaPressione(k)} onPointerUp={fermaPressione} onPointerLeave={fermaPressione}
                            onContextMenu={(e) => { e.preventDefault(); setInModifica(k) }}
                            onClick={() => { if (pressione.current.scattata || modifica) { pressione.current.scattata = false; return } setGiornoAperto(k) }}
                            aria-label={`${TITOLI_GIORNATA[tipoGiornataDa(ferieGiorno.tipo)]}. Tieni premuto per togliere`}>
                            {ETICHETTE_GIORNATA[tipoGiornataDa(ferieGiorno.tipo)]}
                          </button>
                          {modifica && (
                            <button type="button" className="elimina" aria-label={`Togli ${TITOLI_GIORNATA[tipoGiornataDa(ferieGiorno.tipo)]}`}
                              onClick={() => void eliminaGiornata(ferieGiorno.id, TITOLI_GIORNATA[tipoGiornataDa(ferieGiorno.tipo)])}>×</button>
                          )}
                        </span>
                      )}
                      {delGiorno.map((t) => {
                        const nome = titoloTurno(t, mappaModelli)
                        return (
                          <span key={t.id} className="turno-mini">
                            <span className="riga-turno">
                              <a className={`${classeSigla(t.tipo)} barra-turno`} style={{ width: larghezzaTurno(t) }} href={`#/turni/${t.id}`}
                                data-nota={modifica ? undefined : t.note || undefined}
                                onPointerDown={() => iniziaPressione(k)} onPointerUp={fermaPressione} onPointerLeave={fermaPressione}
                                onContextMenu={(e) => { e.preventDefault(); setInModifica(k) }}
                                onClick={(e) => { if (pressione.current.scattata || modifica) { e.preventDefault(); pressione.current.scattata = false } }}
                                aria-label={`${nome}, ${t.tuttoIlGiorno ? 'tutto il giorno' : `${F.ora(t.inizio)}–${F.ora(t.fine)}`}${t.note ? `. Nota: ${t.note}` : ''}. Tieni premuto per eliminare`}>
                                {siglaTurno(t, mappaModelli)}
                                {t.note && !modifica && <span className="ha-nota" />}
                              </a>
                              {modifica && (
                                <button type="button" className="elimina" aria-label={`Elimina ${nome}`} onClick={() => void eliminaTurno(t.id, nome)}>×</button>
                              )}
                            </span>
                            {!modifica && orarioCompatto(t) && <span className="orario-mini">{orarioCompatto(t)}</span>}
                          </span>
                        )
                      })}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
          <span className="secondario piccolo non-stampare">Tocca un giorno per aggiungere turni, ferie, riposo… Tieni premuto un turno per eliminarlo.</span>
          {tipiDelMese.length > 0 && (
            <div className="legenda">
              {tipiDelMese.filter((t) => TITOLI_TIPO_TURNO[t]).map((t) => (
                <span key={t}><span className={classeSigla(t)} style={{ minWidth: 14, height: 12 }} />{TITOLI_TIPO_TURNO[t]}</span>
              ))}
            </div>
          )}
        </div>

        <aside className="laterale-destra">
          {riepilogo && (
            <a className="striscia" href={`#/turni/riepilogo?mese=${qui}`}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="secondario piccolo">Questo mese</span>
                <span className="numeri" style={{ fontWeight: 600 }}>
                  {F.durata(riepilogo.minutiTotali)} · {riepilogo.numeroTurni} turni · {riepilogo.notti} notti · {riepilogo.turniFestivi} festivi
                  {giornateMese.map((x) => ` · ${x.numero} ${TITOLI_GIORNATA[x.tipo].toLowerCase()}`).join('')}
                </span>
              </span>
              <IconaAvanti dimensione={16} />
            </a>
          )}
          {numeroSovrapposizioni > 0 && (
            <div className="avviso">
              {numeroSovrapposizioni === 1 ? 'Due turni si sovrappongono' : `${numeroSovrapposizioni} sovrapposizioni tra turni`} in questo mese.
            </div>
          )}
          <section>
            <h2 className="titolo-sezione" style={{ marginBottom: 8 }}>Prossimi</h2>
            <div className="lista">
              {prossimi.length === 0 && <div className="vuoto">Nessun turno in programma</div>}
              {prossimi.map((t) => (
                <a key={t.id} className="riga" href={`#/turni/${t.id}`}>
                  <span className="numeri" style={{ width: 56, textAlign: 'center', lineHeight: 1.15 }}>
                    <span className="secondario piccolo" style={{ display: 'block', textTransform: 'uppercase' }}>{F.dataBreve(t.inizio).split(' ')[0]}</span>
                    <span style={{ fontSize: 20, fontWeight: 600 }}>{F.dataBreve(t.inizio).split(' ')[1]}</span>
                  </span>
                  <span className="crescente">
                    <span style={{ fontWeight: 500 }}>{titoloTurno(t, mappaModelli)}</span>
                    <span className="secondario piccolo numeri">
                      {t.tuttoIlGiorno ? 'Tutto il giorno' : `${F.ora(t.inizio)} – ${F.ora(t.fine)}`}{mappaSedi.get(sedeEffettiva(t, assegnazioni) ?? '') ? ` · ${mappaSedi.get(sedeEffettiva(t, assegnazioni) ?? '')!.nome}` : ''}
                    </span>
                  </span>
                  {minuti(datiDa(t)) > 0 && <span className="secondario piccolo numeri">{F.durata(minuti(datiDa(t)))}</span>}
                </a>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {sceltaOspedale && <SceltaOspedale anno={anno} mese={mese} onChiudi={() => setSceltaOspedale(false)} />}
      {giornoAperto && <GiornoRapido giorno={giornoAperto} onCambia={setGiornoAperto} onChiudi={() => setGiornoAperto(undefined)} />}

      <Foglio aperto={sceltaArea} titolo="Area di rotazione" onChiudi={() => setSceltaArea(false)}>
        <p className="secondario" style={{ margin: 0 }}>
          Scegli l'area di {F.mese(istante(anno, mese, 1))}. Da questo mese contano {MESI_PER_ROTAZIONE} mesi di quell'area, poi l'app alterna da sola Ginecologia e Ostetricia ogni {MESI_PER_ROTAZIONE} mesi.
        </p>
        <div className="scelte">
          {AREE_ROTAZIONE.map((a) => (
            <button key={a} type="button" className="scelta" aria-pressed={area?.area === a && area.scelto} onClick={() => void scegliArea(a)}>
              <span style={{ fontWeight: 600 }}>{TITOLI_AREA[a]}</span>
              <span className="secondario piccolo">da {F.mese(istante(anno, mese, 1))}</span>
            </button>
          ))}
        </div>
        {ancoraDelMese && (
          <button type="button" className="pulsante pericolo" onClick={() => void elimina('periodiRotazione', ancoraDelMese.id).then(() => setSceltaArea(false))}>
            Togli la scelta fatta per questo mese
          </button>
        )}
      </Foglio>
    </div>
  )
}

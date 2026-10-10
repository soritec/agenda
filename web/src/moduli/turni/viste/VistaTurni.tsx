import { useMemo, useState } from 'react'
import { intervalloMese, istante, stessoGiorno } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { elimina, salva } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { Foglio } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaImpostazioni, IconaIndietro, IconaPiu } from '../../../interfaccia/icone'
import { parametroMese } from '../../../interfaccia/navigazione'
import { sovrapposizioni } from '../controlli'
import { calcolaRiepilogo } from '../riepilogo'
import { AREE_ROTAZIONE, areaDelMese, MESI_PER_ROTAZIONE, TITOLI_AREA, type AreaRotazione } from '../rotazione'
import { minuti, tipoTurnoDa, TITOLI_TIPO_TURNO, type TipoTurno } from '../tipi'
import { celleMese, chiaveGiorno, classeSigla, datiDa, oggi, perId, siglaTurno, titoloTurno, turniPerGiorno } from '../supporto'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export function VistaTurni({ anno, mese }: { anno: number; mese: number }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const periodi = useCollezione('periodiRotazione')
  const impostazioni = useImpostazioni()
  const [sceltaArea, setSceltaArea] = useState(false)

  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])
  const perGiorno = useMemo(() => turniPerGiorno(turni ?? []), [turni])
  const sabatoFestivo = impostazioni?.sabatoFestivo
  const riepilogo = useMemo(
    () => (turni && impostazioni ? calcolaRiepilogo(turni.map(datiDa), anno, mese, { sabatoFestivo }) : undefined),
    [turni, impostazioni, sabatoFestivo, anno, mese],
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
  const area = periodi ? areaDelMese(periodi, anno, mese) : undefined
  const ancoraDelMese = periodi?.find((p) => p.meseInizio === qui)
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
          </div>
          <h1 className="titolo-grande">Turni</h1>
        </div>
        <div className="riga-azioni">
          <a className="pulsante tondo" href={`#/turni?mese=${precedente}`} aria-label="Mese precedente"><IconaIndietro dimensione={18} /></a>
          <a className="pulsante" href={`#/turni?mese=${parametroMese(g0.anno, g0.mese)}`}>Oggi</a>
          <a className="pulsante tondo" href={`#/turni?mese=${successivo}`} aria-label="Mese successivo"><IconaAvanti dimensione={18} /></a>
          <a className="pulsante tondo" href="#/turni/impostazioni" aria-label="Turni tipo, sedi e regole"><IconaImpostazioni dimensione={18} /></a>
          <a className="pulsante tondo primario" href={`#/turni/nuovi?mese=${qui}`} aria-label="Aggiungi turni"><IconaPiu dimensione={18} /></a>
        </div>
      </header>

      {modelli && modelli.length === 0 && (
        <div className="scheda">
          <div className="titolo-sezione">Per iniziare, crea i tuoi turni tipo</div>
          <p className="secondario">Per esempio "Notte, 20:00–08:00". Poi inserire un turno richiede due tocchi.</p>
          <a className="pulsante primario" href="#/turni/impostazioni">Crea turni tipo</a>
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
                return (
                  <div key={k} className={classi}>
                    <a className="aggiungi" href={`#/turni/nuovi?mese=${qui}&giorni=${k}`}
                      aria-label={`Aggiungi un turno ${F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12))}`} />
                    <span className="numero">{g.giorno}</span>
                    <span className="sigle">
                      {delGiorno.map((t) => (
                        <a key={t.id} className={classeSigla(t.tipo)} href={`#/turni/${t.id}`} data-nota={t.note || undefined}
                          aria-label={`${titoloTurno(t, mappaModelli)}, ${F.ora(t.inizio)}–${F.ora(t.fine)}${t.note ? `. Nota: ${t.note}` : ''}`}>
                          {siglaTurno(t, mappaModelli)}
                          {t.note && <span className="ha-nota" />}
                        </a>
                      ))}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
          {tipiDelMese.length > 0 && (
            <div className="legenda">
              {tipiDelMese.map((t) => (
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
                      {F.ora(t.inizio)} – {F.ora(t.fine)}{t.sedeId && mappaSedi.get(t.sedeId) ? ` · ${mappaSedi.get(t.sedeId)!.nome}` : ''}
                    </span>
                  </span>
                  <span className="secondario piccolo numeri">{F.durata(minuti(datiDa(t)))}</span>
                </a>
              ))}
            </div>
          </section>
        </aside>
      </div>

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

import { useMemo, useState } from 'react'
import { intervalloMese, istante, stessoGiorno, type GiornoCivile } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { Foglio } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaImpostazioni, IconaIndietro, IconaPiu } from '../../../interfaccia/icone'
import { parametroMese } from '../../../interfaccia/navigazione'
import { riposiInsufficienti, sovrapposizioni } from '../controlli'
import { calcolaRiepilogo } from '../riepilogo'
import { minuti } from '../tipi'
import { celleMese, chiaveGiorno, datiDa, eNotte, oggi, perId, regole, siglaTurno, titoloTurno, turniPerGiorno } from '../supporto'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export function VistaTurni({ anno, mese }: { anno: number; mese: number }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const impostazioni = useImpostazioni()
  const [giornoAperto, setGiornoAperto] = useState<GiornoCivile>()

  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])
  const perGiorno = useMemo(() => turniPerGiorno(turni ?? []), [turni])
  const r = useMemo(() => (impostazioni ? regole(impostazioni, sedi) : undefined), [impostazioni, sedi])
  const riepilogo = useMemo(
    () => (r ? calcolaRiepilogo((turni ?? []).map(datiDa), anno, mese, r.riepilogo) : undefined),
    [turni, r, anno, mese],
  )
  const numeroAvvisi = useMemo(() => {
    if (!r || !turni) return 0
    const { inizio, fine } = intervalloMese(anno, mese)
    const delMese = turni.filter((t) => t.inizio >= inizio - 86_400_000 && t.inizio < fine).map(datiDa)
    return sovrapposizioni(delMese).length + riposiInsufficienti(delMese, r.riposoMinimo, r.esclusiDalRiposo).length
  }, [turni, r, anno, mese])

  const prossimi = useMemo(() => {
    const ora = Date.now()
    return (turni ?? []).filter((t) => t.fine > ora).sort((a, b) => a.inizio - b.inizio).slice(0, 5)
  }, [turni])

  const precedente = mese === 1 ? parametroMese(anno - 1, 12) : parametroMese(anno, mese - 1)
  const successivo = mese === 12 ? parametroMese(anno + 1, 1) : parametroMese(anno, mese + 1)
  const qui = parametroMese(anno, mese)
  const g0 = oggi()
  const turniGiornoAperto = giornoAperto ? perGiorno.get(chiaveGiorno(giornoAperto)) ?? [] : []

  return (
    <div className="schermata">
      <header className="intestazione">
        <div>
          <div className="sopratitolo">{F.mese(istante(anno, mese, 1))}</div>
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
          <section className="mese grande" aria-label="Calendario del mese">
            <div className="giorni-settimana">{GIORNI.map((g) => <span key={g}>{g}</span>)}</div>
            <div className="griglia">
              {celleMese(anno, mese).map((g, i) => {
                if (!g) return <span key={`v${i}`} />
                const delGiorno = perGiorno.get(chiaveGiorno(g)) ?? []
                const festivo = eFestivo(istante(g.anno, g.mese, g.giorno, 12), { sabatoFestivo: impostazioni?.sabatoFestivo })
                const classi = ['cella', festivo && 'festivo', stessoGiorno(g, g0) && 'oggi'].filter(Boolean).join(' ')
                return (
                  <button key={chiaveGiorno(g)} type="button" className={classi} onClick={() => setGiornoAperto(g)}
                    aria-label={`${F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12))}${delGiorno.length ? `, ${delGiorno.length} turni` : ''}`}>
                    <span className="numero">{g.giorno}</span>
                    <span className="sigle">
                      {delGiorno.map((t) => (
                        <span key={t.id} className={`sigla${eNotte(t.tipo) ? ' notte' : ''}`}>{siglaTurno(t, mappaModelli)}</span>
                      ))}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
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
          {numeroAvvisi > 0 && (
            <div className="avviso">
              {numeroAvvisi === 1 ? '1 avviso' : `${numeroAvvisi} avvisi`} di sovrapposizione o riposo breve in questo mese. Apri il giorno per vedere i dettagli.
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

      <Foglio
        aperto={giornoAperto !== undefined}
        titolo={giornoAperto ? F.dataEstesa(istante(giornoAperto.anno, giornoAperto.mese, giornoAperto.giorno, 12)) : ''}
        onChiudi={() => setGiornoAperto(undefined)}
      >
        <div className="lista">
          {turniGiornoAperto.length === 0 && <div className="vuoto">Nessun turno</div>}
          {turniGiornoAperto.map((t) => (
            <a key={t.id} className="riga" href={`#/turni/${t.id}`} onClick={() => setGiornoAperto(undefined)}>
              <span className={`sigla${eNotte(t.tipo) ? ' notte' : ''}`}>{siglaTurno(t, mappaModelli)}</span>
              <span className="crescente">
                <span style={{ fontWeight: 500 }}>{titoloTurno(t, mappaModelli)}</span>
                <span className="secondario piccolo numeri">{F.ora(t.inizio)} – {F.ora(t.fine)} · {F.durata(minuti(datiDa(t)))}</span>
              </span>
              <IconaAvanti dimensione={14} />
            </a>
          ))}
        </div>
        {giornoAperto && (
          <a className="pulsante primario largo" href={`#/turni/nuovi?mese=${qui}&giorni=${chiaveGiorno(giornoAperto)}`} onClick={() => setGiornoAperto(undefined)}>
            Aggiungi un turno in questo giorno
          </a>
        )}
      </Foglio>
    </div>
  )
}

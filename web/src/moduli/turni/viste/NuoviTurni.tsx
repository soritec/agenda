import { useMemo, useState } from 'react'
import { istante, stessoGiorno, type GiornoCivile } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { salvaTanti } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { Avviso, Campo } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro } from '../../../interfaccia/icone'
import { parametroMese, vai } from '../../../interfaccia/navigazione'
import { avvisi as calcolaAvvisi } from '../controlli'
import { intervallo } from '../orari'
import { minuti, TIPI_TURNO, TITOLI_TIPO_TURNO, tipoTurnoDa, type DatiTurno, type TipoTurno } from '../tipi'
import {
  celleMese, chiaveGiorno, classeSigla, datiDa, giornoDaChiave, minutiDaOrario, minutiDaOreScritte, oggi, orarioDaMinuti, perId, siglaTurno, titoloTurno, turniPerGiorno,
} from '../supporto'

const GIORNI = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const PERSONALIZZATO = 'personalizzato'

export function NuoviTurni({ anno: annoIniziale, mese: meseIniziale, giorniIniziali }: { anno: number; mese: number; giorniIniziali: string[] }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const impostazioni = useImpostazioni()

  const [vista, setVista] = useState({ anno: annoIniziale, mese: meseIniziale })
  const [giorni, setGiorni] = useState<string[]>(giorniIniziali.filter((k) => giornoDaChiave(k)))
  const [scelta, setScelta] = useState<string>()
  const [personale, setPersonale] = useState({ tipo: 'reparto' as TipoTurno, inizio: '08:00', fine: '16:00', sedeId: '' })
  const [oreScritte, setOreScritte] = useState('')
  const [salvataggio, setSalvataggio] = useState(false)

  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const perGiorno = useMemo(() => turniPerGiorno(turni ?? []), [turni])
  const elencoModelli = useMemo(() => [...(modelli ?? [])].sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome)), [modelli])
  const tipiDisponibili = TIPI_TURNO

  // Orari e dati del turno scelto (turno tipo o personalizzato).
  const modello = scelta && scelta !== PERSONALIZZATO ? mappaModelli.get(scelta) : undefined
  const orari = modello
    ? { inizio: modello.minutoInizio, fine: modello.minutoFine }
    : scelta === PERSONALIZZATO
      ? { inizio: minutiDaOrario(personale.inizio), fine: minutiDaOrario(personale.fine) }
      : undefined
  const minutiManuali = minutiDaOreScritte(oreScritte)
  const minutoInizio = orari?.inizio
  const minutoFine = orari?.fine

  const nuovi: DatiTurno[] = useMemo(() => {
    if (minutoInizio === undefined || minutoFine === undefined) return []
    const tipo = modello ? tipoTurnoDa(modello.tipo) : personale.tipo
    return giorni
      .map(giornoDaChiave)
      .filter((g): g is GiornoCivile => g !== undefined)
      .sort((a, b) => istante(a.anno, a.mese, a.giorno) - istante(b.anno, b.mese, b.giorno))
      .map((g) => ({
        id: `nuovo-${chiaveGiorno(g)}`,
        ...intervallo(g, minutoInizio, minutoFine),
        tipo,
        sedeId: modello?.sedeId ?? (personale.sedeId || undefined),
        minutiManuali: minutiManuali ?? undefined,
      }))
  }, [giorni, minutoInizio, minutoFine, modello, personale, minutiManuali])

  const messaggi = useMemo(() => {
    if (nuovi.length === 0) return []
    const esistenti = (turni ?? []).map(datiDa)
    const perIdEsistenti = perId(turni)
    const descrivi = (id: string) => {
      const e = perIdEsistenti.get(id)
      if (e) return `${titoloTurno(e, mappaModelli)} di ${F.dataBreve(e.inizio)}`
      const n = nuovi.find((x) => x.id === id)
      return n ? `il nuovo turno di ${F.dataBreve(n.inizio)}` : 'un altro turno'
    }
    const visti = new Set<string>()
    const testi: string[] = []
    for (const n of nuovi) {
      const altri = [...esistenti, ...nuovi.filter((x) => x.id !== n.id)]
      for (const a of calcolaAvvisi(n, altri)) {
        const coppia = [n.id, a.con].sort().join('|') + a.tipo
        if (visti.has(coppia)) continue
        visti.add(coppia)
        testi.push(`Il turno di ${F.dataBreve(n.inizio)} si sovrappone a ${descrivi(a.con)}.`)
      }
    }
    return testi
  }, [nuovi, turni, mappaModelli])

  function cambiaGiorno(g: GiornoCivile) {
    const k = chiaveGiorno(g)
    setGiorni((attuali) => (attuali.includes(k) ? attuali.filter((x) => x !== k) : [...attuali, k]))
  }

  function spostaMese(delta: number) {
    setVista(({ anno, mese }) => {
      const m = mese + delta
      return m < 1 ? { anno: anno - 1, mese: 12 } : m > 12 ? { anno: anno + 1, mese: 1 } : { anno, mese: m }
    })
  }

  async function salvaTurni() {
    if (nuovi.length === 0 || salvataggio) return
    setSalvataggio(true)
    await salvaTanti('turni', nuovi.map((n) => ({
      inizio: n.inizio, fine: n.fine, tipo: n.tipo, stato: 'pianificato' as const,
      sedeId: n.sedeId, modelloId: modello?.id, minutiManuali: n.minutiManuali, origine: 'manuale' as const,
    })))
    vai(`/turni?mese=${parametroMese(annoIniziale, meseIniziale)}`)
  }

  const g0 = oggi()
  const totaleMinuti = nuovi.reduce((s, n) => s + minuti(n), 0)

  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header className="intestazione">
        <div>
          <a href={`#/turni?mese=${parametroMese(annoIniziale, meseIniziale)}`} className="piccolo">‹ Turni</a>
          <h1 className="titolo-grande">Nuovi turni</h1>
        </div>
      </header>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="intestazione" style={{ alignItems: 'center' }}>
          <h2 className="sopratitolo">1 · Giorni</h2>
          <div className="riga-azioni">
            <button type="button" className="pulsante tondo" onClick={() => spostaMese(-1)} aria-label="Mese precedente"><IconaIndietro dimensione={16} /></button>
            <span style={{ minWidth: 120, textAlign: 'center', fontWeight: 600 }}>{F.mese(istante(vista.anno, vista.mese, 1))}</span>
            <button type="button" className="pulsante tondo" onClick={() => spostaMese(1)} aria-label="Mese successivo"><IconaAvanti dimensione={16} /></button>
          </div>
        </div>
        <div className="mese">
          <div className="giorni-settimana">{GIORNI.map((g, i) => <span key={i}>{g}</span>)}</div>
          <div className="griglia">
            {celleMese(vista.anno, vista.mese).map((g, i) => {
              if (!g) return <span key={`v${i}`} />
              const k = chiaveGiorno(g)
              const scelto = giorni.includes(k)
              const esistenti = perGiorno.get(k) ?? []
              const festivo = eFestivo(istante(g.anno, g.mese, g.giorno, 12), { sabatoFestivo: impostazioni?.sabatoFestivo })
              const classi = ['cella', festivo && 'festivo', stessoGiorno(g, g0) && !scelto && 'oggi', scelto && 'scelto'].filter(Boolean).join(' ')
              return (
                <button key={k} type="button" className={classi} aria-pressed={scelto} onClick={() => cambiaGiorno(g)}
                  aria-label={`${F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12))}${esistenti.length ? ', ha già un turno' : ''}`}>
                  <span className="numero">{g.giorno}</span>
                  <span className="sigle">
                    {esistenti.map((t) => <span key={t.id} className={classeSigla(t.tipo)} style={{ opacity: 0.55 }}>{siglaTurno(t, mappaModelli)}</span>)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <span className="secondario piccolo">{giorni.length === 0 ? 'Tocca uno o più giorni.' : giorni.length === 1 ? '1 giorno scelto' : `${giorni.length} giorni scelti`}</span>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="sopratitolo">2 · Turno</h2>
        <div className="scelte">
          {elencoModelli.map((m) => (
            <button key={m.id} type="button" className="scelta" aria-pressed={scelta === m.id} onClick={() => setScelta(m.id)}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{m.nome}</span>
                <span className={classeSigla(m.tipo)}>{m.sigla}</span>
              </span>
              <span className="secondario piccolo numeri">{orarioDaMinuti(m.minutoInizio)} – {orarioDaMinuti(m.minutoFine)}</span>
            </button>
          ))}
          <button type="button" className="scelta" aria-pressed={scelta === PERSONALIZZATO} onClick={() => setScelta(PERSONALIZZATO)}>
            <span style={{ fontWeight: 600 }}>Orario personalizzato</span>
            <span className="secondario piccolo">Scegli tu tipo e orari</span>
          </button>
        </div>
        {elencoModelli.length === 0 && <span className="secondario piccolo">Puoi creare turni tipo da <a href="#/turni/impostazioni">Turni tipo e sedi</a>.</span>}
        {scelta === PERSONALIZZATO && (
          <div className="scheda modulo">
            <div className="campi-affiancati">
              <Campo etichetta="Tipo">
                <select value={personale.tipo} onChange={(e) => setPersonale({ ...personale, tipo: e.target.value as TipoTurno })}>
                  {tipiDisponibili.map((t) => <option key={t} value={t}>{TITOLI_TIPO_TURNO[t]}</option>)}
                </select>
              </Campo>
              <Campo etichetta="Inizio"><input type="time" value={personale.inizio} onChange={(e) => setPersonale({ ...personale, inizio: e.target.value })} /></Campo>
              <Campo etichetta="Fine"><input type="time" value={personale.fine} onChange={(e) => setPersonale({ ...personale, fine: e.target.value })} /></Campo>
            </div>
            <div className="campi-affiancati">
              <Campo etichetta="Sede">
                <select value={personale.sedeId} onChange={(e) => setPersonale({ ...personale, sedeId: e.target.value })}>
                  <option value="">—</option>
                  {(sedi ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </Campo>
            </div>
          </div>
        )}
      </section>

      <Campo etichetta="Ore per turno (facoltativo: lascia vuoto per calcolarle dagli orari)">
        <input inputMode="decimal" placeholder={nuovi[0] ? `${F.durata(minuti({ ...nuovi[0], minutiManuali: undefined }))} dagli orari` : 'es. 7,5'}
          value={oreScritte} onChange={(e) => setOreScritte(e.target.value)} />
      </Campo>
      {minutiManuali === null && <Avviso>Scrivi le ore come 7,5 oppure 7:30.</Avviso>}

      {messaggi.map((m) => <Avviso key={m}>{m}</Avviso>)}

      <button type="button" className="pulsante primario largo" disabled={nuovi.length === 0 || minutiManuali === null || salvataggio} onClick={salvaTurni}>
        {nuovi.length === 0 ? 'Scegli i giorni e il turno' : `Aggiungi ${nuovi.length === 1 ? '1 turno' : `${nuovi.length} turni`} · ${F.durata(totaleMinuti)}`}
      </button>
    </div>
  )
}

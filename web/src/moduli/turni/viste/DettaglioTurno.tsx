import { useEffect, useMemo, useState } from 'react'
import { componenti, giornoDi } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { salva } from '../../../dati/archivio'
import { aggiungiSmonti, eliminaTurno as eliminaTurnoConSmonto } from '../smonto'
import { useCollezione } from '../../../dati/hooks'
import type { Turno } from '../../../dati/modello'
import { Avviso, Campo, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { parametroMese, vai } from '../../../interfaccia/navigazione'
import { avvisi as calcolaAvvisi } from '../controlli'
import { intervallo, intervalloTuttoIlGiorno } from '../orari'
import { minuti, STATI_TURNO, TIPI_TURNO, TITOLI_TIPO_TURNO, tipoTurnoDa } from '../tipi'
import {
  centesimiDaTesto, chiaveGiorno, datiDa, giornoDaChiave, minutiDaOrario, minutiDaOreScritte, oreScritteDaMinuti, orarioDaMinuti, perId,
  sedeEffettiva, testoDaCentesimi, titoloTurno,
} from '../supporto'

const TITOLI_STATO = { pianificato: 'Pianificato', svolto: 'Svolto', pagato: 'Pagato' } as const

interface Bozza {
  giorno: string
  inizio: string
  fine: string
  tuttoIlGiorno: boolean
  tipo: string
  stato: Turno['stato']
  sedeId: string
  ore: string
  compenso: string
  note: string
}

function bozzaDa(t: Turno): Bozza {
  const ci = componenti(t.inizio), cf = componenti(t.fine)
  return {
    giorno: chiaveGiorno(giornoDi(t.inizio)),
    inizio: orarioDaMinuti(ci.ora * 60 + ci.minuto),
    fine: orarioDaMinuti(cf.ora * 60 + cf.minuto),
    tuttoIlGiorno: Boolean(t.tuttoIlGiorno),
    tipo: t.tipo, stato: t.stato, sedeId: t.sedeId ?? '',
    ore: oreScritteDaMinuti(t.minutiManuali), compenso: testoDaCentesimi(t.compensoCent), note: t.note ?? '',
  }
}

export function DettaglioTurno({ id }: { id: string }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const assegnazioni = useCollezione('assegnazioni')
  const turno = turni?.find((t) => t.id === id)
  const [bozza, setBozza] = useState<Bozza>()

  useEffect(() => {
    if (turno && !bozza) setBozza(bozzaDa(turno))
  }, [turno, bozza])

  const mappaModelli = useMemo(() => perId(modelli), [modelli])

  // Valori interpretati dalla bozza; `null` = scritto male.
  const giorno = bozza ? giornoDaChiave(bozza.giorno) : undefined
  const mi = bozza ? minutiDaOrario(bozza.inizio) : undefined
  const mf = bozza ? minutiDaOrario(bozza.fine) : undefined
  const minutiManuali = bozza ? minutiDaOreScritte(bozza.ore) : undefined
  const compensoCent = bozza ? centesimiDaTesto(bozza.compenso) : undefined
  const orari = giorno && bozza?.tuttoIlGiorno
    ? intervalloTuttoIlGiorno(giorno)
    : giorno && mi !== undefined && mf !== undefined ? intervallo(giorno, mi, mf) : undefined
  const valido = orari !== undefined && minutiManuali !== null && compensoCent !== null
  const oi = orari?.inizio, of = orari?.fine

  const messaggi = useMemo(() => {
    if (!turno || !bozza) return []
    if (oi === undefined || of === undefined) return []
    const attuale = { ...datiDa(turno), inizio: oi, fine: of, tipo: tipoTurnoDa(bozza.tipo), tuttoIlGiorno: bozza.tuttoIlGiorno }
    const altri = (turni ?? []).filter((t) => t.id !== turno.id)
    const mappa = perId(altri)
    return calcolaAvvisi(attuale, altri.map(datiDa)).map((a) => {
      const altro = mappa.get(a.con)
      return `Si sovrappone a ${altro ? `${titoloTurno(altro, mappaModelli)} di ${F.dataBreve(altro.inizio)}` : 'un altro turno'}.`
    })
  }, [turno, bozza, oi, of, turni, mappaModelli])

  if (turni && !turno) {
    return (
      <div className="schermata">
        <h1 className="titolo-grande">Turno non trovato</h1>
        <a href="#/turni">Torna ai turni</a>
      </div>
    )
  }
  if (!turno || !bozza) return null

  const mese = componenti(turno.inizio)
  const indietro = `/turni?mese=${parametroMese(mese.anno, mese.mese)}`
  const tipiDisponibili = TIPI_TURNO
  const aggiorna = (modifiche: Partial<Bozza>) => setBozza({ ...bozza, ...modifiche })

  async function conferma() {
    if (!turno || !bozza || !orari || !valido) return
    const salvato = await salva('turni', {
      ...turno, ...orari, tuttoIlGiorno: bozza.tuttoIlGiorno || undefined, tipo: bozza.tipo, stato: bozza.stato,
      sedeId: bozza.sedeId || undefined,
      minutiManuali: minutiManuali ?? undefined, compensoCent: compensoCent ?? undefined, note: bozza.note.trim() || undefined,
    })
    await aggiungiSmonti([salvato])
    vai(indietro)
  }

  async function eliminaTurno() {
    if (!turno) return
    const annulla = await eliminaTurnoConSmonto(turno.id)
    vai(indietro)
    mostraAvviso('Turno eliminato', () => void annulla())
  }

  const minutiOrari = orari && !bozza.tuttoIlGiorno ? minuti({ ...datiDa(turno), ...orari, tuttoIlGiorno: false, minutiManuali: undefined }) : undefined

  return (
    <div className="schermata" style={{ maxWidth: 640 }}>
      <header>
        <a href={`#${indietro}`} className="piccolo">‹ Turni</a>
        <h1 className="titolo-grande">{titoloTurno(turno, mappaModelli)}</h1>
        <div className="secondario">{F.dataEstesa(turno.inizio)}</div>
      </header>
      {turno.modelloId && mappaModelli.get(turno.modelloId)?.info && (
        <div className="info-turno"><strong>Dove e quando</strong><span>{mappaModelli.get(turno.modelloId)!.info}</span></div>
      )}

      <div className="scheda modulo">
        <div className="campi-affiancati">
          <Campo etichetta="Giorno"><input type="date" value={bozza.giorno} onChange={(e) => aggiorna({ giorno: e.target.value })} /></Campo>
          {!bozza.tuttoIlGiorno && <Campo etichetta="Inizio"><input type="time" value={bozza.inizio} onChange={(e) => aggiorna({ inizio: e.target.value })} /></Campo>}
          {!bozza.tuttoIlGiorno && <Campo etichetta="Fine"><input type="time" value={bozza.fine} onChange={(e) => aggiorna({ fine: e.target.value })} /></Campo>}
        </div>
        <label className="interruttore" style={{ borderBottom: 'none', padding: '2px 0' }}>
          <span>Tutto il giorno (senza orari)</span>
          <input type="checkbox" checked={bozza.tuttoIlGiorno} onChange={(e) => aggiorna({ tuttoIlGiorno: e.target.checked })} />
        </label>
        {!bozza.tuttoIlGiorno && orari && mf !== undefined && mi !== undefined && mf <= mi && <span className="secondario piccolo">Finisce il giorno dopo, {F.dataBreve(orari.fine)}.</span>}
        <div className="campi-affiancati">
          <Campo etichetta="Tipo">
            <select value={tipoTurnoDa(bozza.tipo)} onChange={(e) => aggiorna({ tipo: e.target.value })}>
              {tipiDisponibili.map((t) => <option key={t} value={t}>{TITOLI_TIPO_TURNO[t]}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Stato">
            <select value={bozza.stato} onChange={(e) => aggiorna({ stato: e.target.value as Turno['stato'] })}>
              {STATI_TURNO.map((s) => <option key={s} value={s}>{TITOLI_STATO[s]}</option>)}
            </select>
          </Campo>
        </div>
        <div className="campi-affiancati">
          <Campo etichetta="Sede">
            <select value={bozza.sedeId} onChange={(e) => aggiorna({ sedeId: e.target.value })}>
              <option value="">{(() => {
                const auto = (sedi ?? []).find((s) => s.id === sedeEffettiva({ inizio: turno.inizio }, assegnazioni))
                return auto ? `Automatica: ${auto.nome}` : '—'
              })()}</option>
              {(sedi ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Campo>
        </div>
        <div className="campi-affiancati">
          <Campo etichetta="Ore (a mano, facoltativo)">
            <input inputMode="decimal" placeholder={minutiOrari !== undefined ? `${F.durata(minutiOrari)} dagli orari` : ''} value={bozza.ore} onChange={(e) => aggiorna({ ore: e.target.value })} />
          </Campo>
          <Campo etichetta="Compenso in € (facoltativo)">
            <input inputMode="decimal" placeholder="—" value={bozza.compenso} onChange={(e) => aggiorna({ compenso: e.target.value })} />
          </Campo>
        </div>
        {minutiManuali === null && <Avviso>Scrivi le ore come 7,5 oppure 7:30.</Avviso>}
        {compensoCent === null && <Avviso>Scrivi il compenso come 120 oppure 120,50.</Avviso>}
        <Campo etichetta="Note">
          <textarea value={bozza.note} onChange={(e) => aggiorna({ note: e.target.value })} />
        </Campo>
        <NotaPrivacy />
      </div>

      {messaggi.map((m) => <Avviso key={m}>{m}</Avviso>)}

      <div className="riga-azioni">
        <button type="button" className="pulsante primario" disabled={!valido} onClick={conferma}>Salva</button>
        <a className="pulsante" href={`#${indietro}`}>Annulla</a>
        <span style={{ flex: 1 }} />
        <button type="button" className="pulsante pericolo" onClick={eliminaTurno}>Elimina</button>
      </div>
    </div>
  )
}

import { useEffect, useState, type ReactNode } from 'react'
import { elimina, salva, salvaImpostazioni } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { ModelloTurno, Sede } from '../../../dati/modello'
import { geocodifica, linkGoogleMaps, percorsoInAuto, posizioneAttuale, type Coordinate } from '../../../nucleo/viaggio'
import { Avviso, Campo, Foglio } from '../../../interfaccia/componenti'
import { IconaAvanti } from '../../../interfaccia/icone'
import { TIPI_TURNO, TITOLI_TIPO_TURNO, tipoTurnoDa } from '../tipi'
import { classeSigla, minutiDaOrario, orarioDaMinuti, perId } from '../supporto'

type Modifica = { tipo: 'modello'; record?: ModelloTurno } | { tipo: 'sede'; record?: Sede }

function Sezione({ titolo, onAggiungi, children }: { titolo: string; onAggiungi?: () => void; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="intestazione" style={{ alignItems: 'center' }}>
        <h2 className="titolo-sezione">{titolo}</h2>
        {onAggiungi && <button type="button" className="link" onClick={onAggiungi}>Aggiungi</button>}
      </div>
      {children}
    </section>
  )
}

export function ImpostazioniTurni() {
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const impostazioni = useImpostazioni()
  const [modifica, setModifica] = useState<Modifica>()
  const [casa, setCasa] = useState<string>()
  const mappaSedi = perId(sedi)
  const elencoModelli = [...(modelli ?? [])].sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome))

  useEffect(() => {
    if (impostazioni && casa === undefined) setCasa(impostazioni.indirizzoCasa ?? '')
  }, [impostazioni, casa])

  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header>
        <a href="#/turni" className="piccolo">‹ Turni</a>
        <h1 className="titolo-grande">Turni tipo e sedi</h1>
      </header>

      <Sezione titolo="Turni tipo" onAggiungi={() => setModifica({ tipo: 'modello' })}>
        <div className="lista">
          {elencoModelli.length === 0 && <div className="vuoto">Nessun turno tipo. Aggiungine uno, per esempio "Notte 20–08".</div>}
          {elencoModelli.map((m) => (
            <button key={m.id} type="button" className="riga" onClick={() => setModifica({ tipo: 'modello', record: m })}>
              <span className={classeSigla(m.tipo)}>{m.sigla}</span>
              <span className="crescente">
                <span style={{ fontWeight: 500 }}>{m.nome}</span>
                <span className="secondario piccolo numeri">
                  {orarioDaMinuti(m.minutoInizio)} – {orarioDaMinuti(m.minutoFine)} · {TITOLI_TIPO_TURNO[tipoTurnoDa(m.tipo)]}
                  {m.sedeId && mappaSedi.get(m.sedeId) ? ` · ${mappaSedi.get(m.sedeId)!.nome}` : ''}
                </span>
              </span>
              <IconaAvanti dimensione={14} />
            </button>
          ))}
        </div>
      </Sezione>

      <Sezione titolo="Casa">
        <div className="scheda modulo">
          <Campo etichetta="Indirizzo di casa (punto di partenza per i tempi di viaggio)">
            <input value={casa ?? ''} placeholder="Via, numero, città" autoComplete="street-address"
              onChange={(e) => setCasa(e.target.value)}
              onBlur={() => casa !== undefined && casa.trim() !== (impostazioni?.indirizzoCasa ?? '') && void salvaImpostazioni({ indirizzoCasa: casa.trim() || undefined })} />
          </Campo>
        </div>
      </Sezione>

      <Sezione titolo="Sedi" onAggiungi={() => setModifica({ tipo: 'sede' })}>
        <div className="lista">
          {(sedi ?? []).length === 0 && <div className="vuoto">Nessuna sede.</div>}
          {(sedi ?? []).map((s) => (
            <button key={s.id} type="button" className="riga" onClick={() => setModifica({ tipo: 'sede', record: s })}>
              <span className="crescente">
                <span style={{ fontWeight: 500 }}>{s.nome}</span>
                <span className="secondario piccolo">
                  {[s.indirizzo, s.minutiViaggio ? `${s.minutiViaggio} min da casa` : ''].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <IconaAvanti dimensione={14} />
            </button>
          ))}
        </div>
      </Sezione>

      {impostazioni && (
        <Sezione titolo="Regole di conteggio">
          <div className="scheda" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <label className="interruttore" style={{ borderBottom: 'none' }}>
              <span>Il sabato è festivo</span>
              <input type="checkbox" checked={impostazioni.sabatoFestivo} onChange={(e) => salvaImpostazioni({ sabatoFestivo: e.target.checked })} />
            </label>
          </div>
        </Sezione>
      )}

      {modifica?.tipo === 'modello' && (
        <FormModello record={modifica.record} sedi={sedi ?? []} ordine={elencoModelli.length} onChiudi={() => setModifica(undefined)} />
      )}
      {modifica?.tipo === 'sede' && (
        <FormSede record={modifica.record} indirizzoCasa={impostazioni?.indirizzoCasa} onChiudi={() => setModifica(undefined)} />
      )}
    </div>
  )
}

function PulsanteElimina({ onElimina }: { onElimina: () => void }) {
  return <button type="button" className="pulsante pericolo" onClick={() => window.confirm('Eliminare?') && onElimina()}>Elimina</button>
}

function FormModello({ record, sedi, ordine, onChiudi }: { record?: ModelloTurno; sedi: Sede[]; ordine: number; onChiudi: () => void }) {
  const [b, setB] = useState({
    nome: record?.nome ?? '', sigla: record?.sigla ?? '', tipo: tipoTurnoDa(record?.tipo ?? 'reparto'),
    inizio: orarioDaMinuti(record?.minutoInizio ?? 8 * 60), fine: orarioDaMinuti(record?.minutoFine ?? 16 * 60),
    sedeId: record?.sedeId ?? '',
  })
  const mi = minutiDaOrario(b.inizio), mf = minutiDaOrario(b.fine)
  const valido = b.nome.trim() !== '' && mi !== undefined && mf !== undefined

  async function conferma() {
    if (!valido || mi === undefined || mf === undefined) return
    await salva('modelliTurno', {
      ...record, nome: b.nome.trim(), sigla: (b.sigla.trim() || b.nome.trim().charAt(0)).toUpperCase().slice(0, 2),
      tipo: b.tipo, minutoInizio: mi, minutoFine: mf, sedeId: b.sedeId || undefined, ordine: record?.ordine ?? ordine,
    })
    onChiudi()
  }

  return (
    <Foglio aperto titolo={record ? 'Turno tipo' : 'Nuovo turno tipo'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={conferma}>Salva</button>}>
      <div className="modulo">
        <div className="campi-affiancati">
          <Campo etichetta="Nome"><input value={b.nome} placeholder="es. Notte" onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
          <Campo etichetta="Sigla (1–2 lettere)"><input value={b.sigla} maxLength={2} placeholder="N" onChange={(e) => setB({ ...b, sigla: e.target.value })} /></Campo>
        </div>
        <Campo etichetta="Tipo">
          <select value={b.tipo} onChange={(e) => setB({ ...b, tipo: tipoTurnoDa(e.target.value) })}>
            {TIPI_TURNO.map((t) => <option key={t} value={t}>{TITOLI_TIPO_TURNO[t]}</option>)}
          </select>
        </Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Inizio"><input type="time" value={b.inizio} onChange={(e) => setB({ ...b, inizio: e.target.value })} /></Campo>
          <Campo etichetta="Fine"><input type="time" value={b.fine} onChange={(e) => setB({ ...b, fine: e.target.value })} /></Campo>
        </div>
        {mi !== undefined && mf !== undefined && mf <= mi && <span className="secondario piccolo">Finisce il giorno dopo.</span>}
        <Campo etichetta="Sede">
          <select value={b.sedeId} onChange={(e) => setB({ ...b, sedeId: e.target.value })}>
            <option value="">—</option>
            {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </Campo>
        {record && <PulsanteElimina onElimina={() => void elimina('modelliTurno', record.id).then(onChiudi)} />}
      </div>
    </Foglio>
  )
}

function FormSede({ record, indirizzoCasa, onChiudi }: { record?: Sede; indirizzoCasa?: string; onChiudi: () => void }) {
  const [b, setB] = useState({ nome: record?.nome ?? '', indirizzo: record?.indirizzo ?? '', viaggio: record?.minutiViaggio?.toString() ?? '' })
  const [calcolo, setCalcolo] = useState<{ stato: 'fermo' | 'in corso' | 'fatto' | 'errore'; testo?: string }>({ stato: 'fermo' })
  const viaggio = b.viaggio.trim() === '' ? undefined : Number(b.viaggio)
  const valido = b.nome.trim() !== '' && (viaggio === undefined || (Number.isInteger(viaggio) && viaggio >= 0))

  async function calcola(partenza: 'casa' | 'qui') {
    setCalcolo({ stato: 'in corso' })
    try {
      let da: Coordinate | undefined
      if (partenza === 'qui') da = await posizioneAttuale()
      else if (indirizzoCasa) da = await geocodifica(indirizzoCasa)
      if (!da) throw new Error(partenza === 'casa' ? 'Indirizzo di casa non trovato' : 'Posizione non disponibile')
      const a = await geocodifica(b.indirizzo)
      if (!a) throw new Error('Indirizzo della sede non trovato: prova ad aggiungere la città')
      const percorso = await percorsoInAuto(da, a)
      if (!percorso) throw new Error('Percorso non trovato')
      setB((attuale) => ({ ...attuale, viaggio: String(percorso.minuti) }))
      setCalcolo({ stato: 'fatto', testo: `${percorso.minuti} min in auto, ${percorso.km.toString().replace('.', ',')} km ${partenza === 'casa' ? 'da casa' : 'da dove sei ora'} (senza traffico).` })
    } catch (e) {
      setCalcolo({ stato: 'errore', testo: e instanceof Error ? e.message : 'Calcolo non riuscito' })
    }
  }

  async function conferma() {
    if (!valido) return
    await salva('sedi', { ...record, nome: b.nome.trim(), indirizzo: b.indirizzo.trim() || undefined, minutiViaggio: viaggio })
    onChiudi()
  }

  const haIndirizzo = b.indirizzo.trim() !== ''
  return (
    <Foglio aperto titolo={record ? 'Sede' : 'Nuova sede'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={conferma}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={b.nome} placeholder="es. Ospedale" onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
        <Campo etichetta="Indirizzo"><input value={b.indirizzo} placeholder="Via, numero, città" onChange={(e) => setB({ ...b, indirizzo: e.target.value })} /></Campo>
        <div className="riga-azioni">
          <button type="button" className="pulsante" disabled={!haIndirizzo || !indirizzoCasa || calcolo.stato === 'in corso'} onClick={() => void calcola('casa')}>
            Calcola da casa
          </button>
          <button type="button" className="pulsante" disabled={!haIndirizzo || calcolo.stato === 'in corso'} onClick={() => void calcola('qui')}>
            Calcola da dove sono
          </button>
          {haIndirizzo && (
            <a className="pulsante" href={linkGoogleMaps(b.indirizzo, indirizzoCasa)} target="_blank" rel="noreferrer">Apri in Google Maps</a>
          )}
        </div>
        {!indirizzoCasa && <span className="secondario piccolo">Per calcolare da casa, inserisci prima l'indirizzo di casa nella pagina precedente.</span>}
        {calcolo.stato === 'in corso' && <span className="secondario piccolo">Calcolo in corso…</span>}
        {calcolo.stato === 'fatto' && <span className="secondario piccolo">{calcolo.testo}</span>}
        {calcolo.stato === 'errore' && <Avviso>{calcolo.testo}</Avviso>}
        <Campo etichetta="Minuti di viaggio (calcolati o scritti a mano)">
          <input inputMode="numeric" value={b.viaggio} placeholder="es. 35" onChange={(e) => setB({ ...b, viaggio: e.target.value })} />
        </Campo>
        <span className="nota-privacy">Il calcolo usa OpenStreetMap: gli indirizzi vengono inviati a quel servizio solo quando premi "Calcola".</span>
        {record && <PulsanteElimina onElimina={() => void elimina('sedi', record.id).then(onChiudi)} />}
      </div>
    </Foglio>
  )
}

import { useState, type ReactNode } from 'react'
import { elimina, salva, salvaImpostazioni } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Ente, ModelloTurno, Sede } from '../../../dati/modello'
import { Campo, Foglio } from '../../../interfaccia/componenti'
import { IconaAvanti } from '../../../interfaccia/icone'
import { TIPI_OPZIONALI, TIPI_RAPPORTO, TIPI_TURNO, TITOLI_TIPO_TURNO, tipoTurnoDa, type TipoRapporto } from '../tipi'
import { eNotte, minutiDaOrario, orarioDaMinuti, perId } from '../supporto'

const TITOLI_RAPPORTO: Record<TipoRapporto, string> = { dipendente: 'Dipendente', convenzionato: 'Convenzionato', liberaProfessione: 'Libera professione' }
const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

type Modifica =
  | { tipo: 'modello'; record?: ModelloTurno }
  | { tipo: 'sede'; record?: Sede }
  | { tipo: 'ente'; record?: Ente }

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
  const enti = useCollezione('enti')
  const impostazioni = useImpostazioni()
  const [modifica, setModifica] = useState<Modifica>()
  const mappaSedi = perId(sedi)
  const elencoModelli = [...(modelli ?? [])].sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome))

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
              <span className={`sigla${eNotte(m.tipo) ? ' notte' : ''}`}>{m.sigla}</span>
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

      <Sezione titolo="Sedi" onAggiungi={() => setModifica({ tipo: 'sede' })}>
        <div className="lista">
          {(sedi ?? []).length === 0 && <div className="vuoto">Nessuna sede.</div>}
          {(sedi ?? []).map((s) => (
            <button key={s.id} type="button" className="riga" onClick={() => setModifica({ tipo: 'sede', record: s })}>
              <span className="crescente">
                <span style={{ fontWeight: 500 }}>{s.nome}</span>
                <span className="secondario piccolo">
                  {[s.minutiViaggio ? `${s.minutiViaggio} min di viaggio` : '', s.patrono ? `patrono ${s.patrono.giorno} ${MESI[s.patrono.mese - 1]}` : ''].filter(Boolean).join(' · ') || '—'}
                </span>
              </span>
              <IconaAvanti dimensione={14} />
            </button>
          ))}
        </div>
      </Sezione>

      <Sezione titolo="Enti" onAggiungi={() => setModifica({ tipo: 'ente' })}>
        <div className="lista">
          {(enti ?? []).length === 0 && <div className="vuoto">Nessun ente.</div>}
          {(enti ?? []).map((e) => (
            <button key={e.id} type="button" className="riga" onClick={() => setModifica({ tipo: 'ente', record: e })}>
              <span className="crescente">
                <span style={{ fontWeight: 500 }}>{e.nome}</span>
                <span className="secondario piccolo">{TITOLI_RAPPORTO[e.tipoRapporto]}</span>
              </span>
              <IconaAvanti dimensione={14} />
            </button>
          ))}
        </div>
      </Sezione>

      {impostazioni && (
        <Sezione titolo="Regole di conteggio">
          <div className="scheda" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <label className="interruttore">
              <span>Il sabato è festivo</span>
              <input type="checkbox" checked={impostazioni.sabatoFestivo} onChange={(e) => salvaImpostazioni({ sabatoFestivo: e.target.checked })} />
            </label>
            <label className="interruttore">
              <span>Riposo minimo tra due turni (ore)</span>
              <input type="number" min={0} max={24} step={0.5} style={{ width: 80, height: 36, borderRadius: 8, border: '1px solid var(--linea-forte)', padding: '0 8px', background: 'var(--superficie)' }}
                value={impostazioni.riposoMinimoMinuti / 60}
                onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v >= 0 && v <= 24) void salvaImpostazioni({ riposoMinimoMinuti: Math.round(v * 60) }) }} />
            </label>
            <label className="interruttore">
              <span>Usa la reperibilità</span>
              <input type="checkbox" checked={impostazioni.usaReperibilita} onChange={(e) => salvaImpostazioni({ usaReperibilita: e.target.checked })} />
            </label>
            {impostazioni.usaReperibilita && (
              <label className="interruttore" style={{ borderBottom: 'none' }}>
                <span>La reperibilità conta come lavoro (ore del mese e riposo)</span>
                <input type="checkbox" checked={impostazioni.reperibilitaContaComeLavoro} onChange={(e) => salvaImpostazioni({ reperibilitaContaComeLavoro: e.target.checked })} />
              </label>
            )}
          </div>
        </Sezione>
      )}

      {modifica?.tipo === 'modello' && (
        <FormModello record={modifica.record} sedi={sedi ?? []} enti={enti ?? []} usaReperibilita={impostazioni?.usaReperibilita ?? false}
          ordine={elencoModelli.length} onChiudi={() => setModifica(undefined)} />
      )}
      {modifica?.tipo === 'sede' && <FormSede record={modifica.record} enti={enti ?? []} onChiudi={() => setModifica(undefined)} />}
      {modifica?.tipo === 'ente' && <FormEnte record={modifica.record} onChiudi={() => setModifica(undefined)} />}
    </div>
  )
}

function PulsanteElimina({ onElimina }: { onElimina: () => void }) {
  return <button type="button" className="pulsante pericolo" onClick={() => window.confirm('Eliminare?') && onElimina()}>Elimina</button>
}

function FormModello({ record, sedi, enti, usaReperibilita, ordine, onChiudi }: {
  record?: ModelloTurno; sedi: Sede[]; enti: Ente[]; usaReperibilita: boolean; ordine: number; onChiudi: () => void
}) {
  const [b, setB] = useState({
    nome: record?.nome ?? '', sigla: record?.sigla ?? '', tipo: tipoTurnoDa(record?.tipo ?? 'reparto'),
    inizio: orarioDaMinuti(record?.minutoInizio ?? 8 * 60), fine: orarioDaMinuti(record?.minutoFine ?? 16 * 60),
    sedeId: record?.sedeId ?? '', enteId: record?.enteId ?? '',
  })
  const mi = minutiDaOrario(b.inizio), mf = minutiDaOrario(b.fine)
  const valido = b.nome.trim() !== '' && mi !== undefined && mf !== undefined
  const tipi = TIPI_TURNO.filter((t) => usaReperibilita || !TIPI_OPZIONALI.has(t) || t === b.tipo)

  async function conferma() {
    if (!valido || mi === undefined || mf === undefined) return
    await salva('modelliTurno', {
      ...record, nome: b.nome.trim(), sigla: (b.sigla.trim() || b.nome.trim().charAt(0)).toUpperCase().slice(0, 2),
      tipo: b.tipo, minutoInizio: mi, minutoFine: mf, sedeId: b.sedeId || undefined, enteId: b.enteId || undefined,
      ordine: record?.ordine ?? ordine,
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
            {tipi.map((t) => <option key={t} value={t}>{TITOLI_TIPO_TURNO[t]}</option>)}
          </select>
        </Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Inizio"><input type="time" value={b.inizio} onChange={(e) => setB({ ...b, inizio: e.target.value })} /></Campo>
          <Campo etichetta="Fine"><input type="time" value={b.fine} onChange={(e) => setB({ ...b, fine: e.target.value })} /></Campo>
        </div>
        {mi !== undefined && mf !== undefined && mf <= mi && <span className="secondario piccolo">Finisce il giorno dopo.</span>}
        <div className="campi-affiancati">
          <Campo etichetta="Sede">
            <select value={b.sedeId} onChange={(e) => setB({ ...b, sedeId: e.target.value })}>
              <option value="">—</option>
              {sedi.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Ente">
            <select value={b.enteId} onChange={(e) => setB({ ...b, enteId: e.target.value })}>
              <option value="">—</option>
              {enti.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Campo>
        </div>
        {record && <PulsanteElimina onElimina={() => void elimina('modelliTurno', record.id).then(onChiudi)} />}
      </div>
    </Foglio>
  )
}

function FormSede({ record, enti, onChiudi }: { record?: Sede; enti: Ente[]; onChiudi: () => void }) {
  const [b, setB] = useState({
    nome: record?.nome ?? '', indirizzo: record?.indirizzo ?? '', viaggio: record?.minutiViaggio?.toString() ?? '',
    enteId: record?.enteId ?? '', patronoGiorno: record?.patrono?.giorno.toString() ?? '', patronoMese: record?.patrono?.mese.toString() ?? '',
  })
  const viaggio = b.viaggio.trim() === '' ? undefined : Number(b.viaggio)
  const pg = Number(b.patronoGiorno), pm = Number(b.patronoMese)
  const patrono = b.patronoGiorno && b.patronoMese && pg >= 1 && pg <= 31 && pm >= 1 && pm <= 12 ? { giorno: pg, mese: pm } : undefined
  const valido = b.nome.trim() !== '' && (viaggio === undefined || (Number.isInteger(viaggio) && viaggio >= 0))

  async function conferma() {
    if (!valido) return
    await salva('sedi', {
      ...record, nome: b.nome.trim(), indirizzo: b.indirizzo.trim() || undefined, minutiViaggio: viaggio,
      enteId: b.enteId || undefined, patrono,
    })
    onChiudi()
  }

  return (
    <Foglio aperto titolo={record ? 'Sede' : 'Nuova sede'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={conferma}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={b.nome} placeholder="es. Ospedale" onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
        <Campo etichetta="Indirizzo (facoltativo)"><input value={b.indirizzo} onChange={(e) => setB({ ...b, indirizzo: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Minuti di viaggio"><input inputMode="numeric" value={b.viaggio} placeholder="es. 35" onChange={(e) => setB({ ...b, viaggio: e.target.value })} /></Campo>
          <Campo etichetta="Ente">
            <select value={b.enteId} onChange={(e) => setB({ ...b, enteId: e.target.value })}>
              <option value="">—</option>
              {enti.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Campo>
        </div>
        <div className="campi-affiancati">
          <Campo etichetta="Santo patrono: giorno"><input inputMode="numeric" value={b.patronoGiorno} placeholder="es. 24" onChange={(e) => setB({ ...b, patronoGiorno: e.target.value })} /></Campo>
          <Campo etichetta="mese">
            <select value={b.patronoMese} onChange={(e) => setB({ ...b, patronoMese: e.target.value })}>
              <option value="">—</option>
              {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Campo>
        </div>
        <span className="secondario piccolo">Il giorno del santo patrono della città conta come festivo per i turni in questa sede.</span>
        {record && <PulsanteElimina onElimina={() => void elimina('sedi', record.id).then(onChiudi)} />}
      </div>
    </Foglio>
  )
}

function FormEnte({ record, onChiudi }: { record?: Ente; onChiudi: () => void }) {
  const [b, setB] = useState({ nome: record?.nome ?? '', tipoRapporto: record?.tipoRapporto ?? ('dipendente' as TipoRapporto) })
  const valido = b.nome.trim() !== ''
  async function conferma() {
    if (!valido) return
    await salva('enti', { ...record, nome: b.nome.trim(), tipoRapporto: b.tipoRapporto })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={record ? 'Ente' : 'Nuovo ente'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={conferma}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={b.nome} placeholder="es. Azienda ospedaliera" onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
        <Campo etichetta="Rapporto">
          <select value={b.tipoRapporto} onChange={(e) => setB({ ...b, tipoRapporto: e.target.value as TipoRapporto })}>
            {TIPI_RAPPORTO.map((t) => <option key={t} value={t}>{TITOLI_RAPPORTO[t]}</option>)}
          </select>
        </Campo>
        {record && <PulsanteElimina onElimina={() => void elimina('enti', record.id).then(onChiudi)} />}
      </div>
    </Foglio>
  )
}

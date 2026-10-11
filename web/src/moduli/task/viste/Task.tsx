import { useState } from 'react'
import { componenti, istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Attivita } from '../../../dati/modello'
import { Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { IconaPiu } from '../../../interfaccia/icone'
import { vai } from '../../../interfaccia/navigazione'
import { usePressioneLunga } from '../../../interfaccia/pressione'
import { chiaveGiorno, giornoDaChiave, minutiDaOrario, oggi, orarioDaMinuti } from '../../turni/supporto'
import {
  AREE, areaDa, completa, leggiTestoVeloce, piuGiorni, raggruppa, RIPETIZIONI, ripetizioneDa, TITOLI_AREA, TITOLI_GRUPPO, TITOLI_RIPETIZIONE,
  type Area, type Gruppo, type Ripetizione,
} from '../logica'

const GRUPPI_APERTI: Gruppo[] = ['inRitardo', 'oggi', 'domani', 'prossimi', 'senzaData']

const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const orario = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

function quando(t: Attivita, oggiChiave: string): string {
  if (!t.scadenza) return ''
  const giorno = t.scadenza === oggiChiave ? 'oggi' : t.scadenza === piuGiorni(oggiChiave, 1) ? 'domani' : F.dataBreve(msGiorno(t.scadenza))
  return t.minuto !== undefined ? `${giorno} alle ${orario(t.minuto)}` : giorno
}

/** Completa o riapre un task; se si ripete, crea subito il prossimo. */
export async function segnaFatto(t: Attivita) {
  const { aggiornato, prossimo } = completa(t, Date.now())
  await salva('attivita', aggiornato)
  const nuovo = prossimo ? await salva('attivita', prossimo) : undefined
  if (aggiornato.completataIl) {
    mostraAvviso(`Fatto: ${t.titolo}${nuovo?.scadenza ? ` · prossimo ${F.dataBreve(msGiorno(nuovo.scadenza))}` : ''}`, () => void (async () => {
      await salva('attivita', { ...aggiornato, completataIl: undefined })
      if (nuovo) await elimina('attivita', nuovo.id)
    })())
  }
}

export function Task({ apertoId, giorno, minuto }: { apertoId?: string; giorno?: string | null; minuto?: string | null }) {
  const tutti = useCollezione('attivita')
  const oggiChiave = chiaveGiorno(oggi())
  const [filtro, setFiltro] = useState<Area | 'tutte'>('tutte')
  const [testo, setTesto] = useState('')
  const pressione = usePressioneLunga()

  const nelFiltro = (tutti ?? []).filter((t) => filtro === 'tutte' || areaDa(t.area) === filtro)
  const gruppi = raggruppa(nelFiltro, oggiChiave)
  const aperti = (tutti ?? []).filter((t) => !t.completataIl)
  const veloce = testo.trim() ? leggiTestoVeloce(testo, oggiChiave, componenti(Date.now()).giornoSettimana) : undefined
  const inModifica = apertoId && apertoId !== 'nuovo' ? tutti?.find((t) => t.id === apertoId) : undefined

  async function aggiungiVeloce() {
    if (!veloce?.titolo) return
    // Si svuota subito il campo, così si può scrivere il task successivo senza aspettare.
    setTesto('')
    await salva('attivita', { titolo: veloce.titolo, scadenza: veloce.scadenza, minuto: veloce.minuto, priorita: veloce.priorita, area: filtro === 'tutte' ? 'personale' : filtro })
  }
  async function eliminaTask(t: Attivita) {
    pressione.setAttivo(undefined)
    await elimina('attivita', t.id)
    mostraAvviso(`Eliminato: ${t.titolo}`, () => void ripristina('attivita', t.id))
  }

  const riga = (t: Attivita) => {
    const passiFatti = t.passi?.filter((p) => p.fatto).length ?? 0
    const ritardo = !t.completataIl && t.scadenza && t.scadenza < oggiChiave
    return (
      <div key={t.id} className={`riga riga-task rimovibile${t.completataIl ? ' conclusa' : ''}`} {...pressione.gestori(t.id)}>
        <button type="button" className={`spunta${t.completataIl ? ' fatta' : ''}${t.priorita === 'alta' ? ' alta' : ''}`}
          aria-label={t.completataIl ? `Riapri ${t.titolo}` : `Segna fatto ${t.titolo}`} onClick={() => void segnaFatto(t)}>
          {t.completataIl ? '✓' : ''}
        </button>
        <a className="crescente" href={`#/task/${t.id}`} style={{ color: 'inherit' }}
          onClick={(e) => { if (pressione.eraPressione() || pressione.attivo === t.id) e.preventDefault() }}>
          <span style={{ fontWeight: 600, textDecoration: t.completataIl ? 'line-through' : undefined }}>
            {t.priorita === 'alta' && !t.completataIl && <span className="bandierina" aria-label="Priorità alta">!</span>}{t.titolo}
          </span>
          <span className="secondario piccolo meta-task">
            {t.scadenza && <span style={ritardo ? { color: 'var(--pericolo)', fontWeight: 600 } : undefined}>{quando(t, oggiChiave)}</span>}
            {ripetizioneDa(t.ripeti) !== 'mai' && <span title={TITOLI_RIPETIZIONE[ripetizioneDa(t.ripeti)]}>↻ {TITOLI_RIPETIZIONE[ripetizioneDa(t.ripeti)].toLowerCase()}</span>}
            {t.passi?.length ? <span>{passiFatti}/{t.passi.length} passi</span> : null}
            {filtro === 'tutte' && <span className={`etichetta-area a-${areaDa(t.area)}`}>{TITOLI_AREA[areaDa(t.area)]}</span>}
          </span>
        </a>
        <button type="button" className="x-elimina in-riga" aria-label={`Elimina ${t.titolo}`} onPointerDown={(e) => e.stopPropagation()} onClick={() => void eliminaTask(t)}>×</button>
      </div>
    )
  }

  return (
    <div className="schermata" style={{ maxWidth: 760 }}>
      <header className="intestazione">
        <div>
          <h1 className="titolo-grande">Task</h1>
          <span className="secondario piccolo">{aperti.length === 0 ? 'Niente da fare' : `${aperti.length} da fare${gruppi.inRitardo.length && filtro === 'tutte' ? ` · ${gruppi.inRitardo.length} in ritardo` : ''}`}</span>
        </div>
        <a className="pulsante tondo primario" href={`#/task/nuovo${filtro !== 'tutte' ? `?area=${filtro}` : ''}`} aria-label="Nuovo task"><IconaPiu dimensione={18} /></a>
      </header>

      <div className="aggiunta-veloce">
        <input value={testo} onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void aggiungiVeloce() }}
          placeholder="Scrivi e premi Invio (es. Chiamare segreteria domani 9:30)" aria-label="Nuovo task veloce" enterKeyHint="done" />
        <button type="button" className="pulsante primario" disabled={!veloce?.titolo} onClick={() => void aggiungiVeloce()}>Aggiungi</button>
      </div>
      {veloce?.titolo && (veloce.scadenza || veloce.priorita === 'alta') && (
        <span className="secondario piccolo" style={{ marginTop: -8 }}>
          → {veloce.scadenza ? quando({ ...veloce, id: '', creatoIl: 0, modificatoIl: 0, area: '' }, oggiChiave) : 'senza data'}{veloce.priorita === 'alta' ? ' · priorità alta' : ''}
        </span>
      )}

      <div className="filtri-agenda" role="group" aria-label="Area">
        {(['tutte', ...AREE] as const).map((a) => {
          const n = a === 'tutte' ? aperti.length : aperti.filter((t) => areaDa(t.area) === a).length
          return (
            <button key={a} type="button" className={`pillola${filtro === a ? ' filtro-attivo' : ''}`} aria-pressed={filtro === a} onClick={() => setFiltro(a)}>
              {a === 'tutte' ? 'Tutte' : TITOLI_AREA[a]}{n ? <span className="numeri secondario"> {n}</span> : null}
            </button>
          )
        })}
      </div>

      {tutti && GRUPPI_APERTI.every((g) => gruppi[g].length === 0) && (
        <div className="scheda secondario">Niente da fare qui. Scrivi un task sopra oppure tocca +.</div>
      )}
      {GRUPPI_APERTI.filter((g) => gruppi[g].length).map((g) => (
        <section key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione" style={g === 'inRitardo' ? { color: 'var(--pericolo)' } : undefined}>
            {TITOLI_GRUPPO[g]} <span className="secondario piccolo" style={{ fontWeight: 400 }}>{gruppi[g].length}</span>
          </h2>
          <div className="lista">{gruppi[g].map(riga)}</div>
        </section>
      ))}
      {gruppi.completati.length > 0 && (
        <details>
          <summary className="titolo-sezione" style={{ cursor: 'pointer' }}>
            {TITOLI_GRUPPO.completati} <span className="secondario piccolo" style={{ fontWeight: 400 }}>{gruppi.completati.length}</span>
          </summary>
          <div className="lista" style={{ marginTop: 8 }}>{gruppi.completati.slice(0, 50).map(riga)}</div>
        </details>
      )}
      <span className="secondario piccolo">Tocca il cerchio quando hai finito. Tieni premuto un task per eliminarlo. I task con una data compaiono anche in Agenda e in Oggi.</span>

      {(apertoId === 'nuovo' || inModifica) && (
        <FormTask key={apertoId} record={inModifica} giorno={giorno ?? undefined} minuto={minuto ? Number(minuto) : undefined}
          area={filtro === 'tutte' ? undefined : filtro} onChiudi={() => (history.length > 1 ? history.back() : vai('#/task'))} />
      )}
    </div>
  )
}

function FormTask({ record, giorno, minuto, area, onChiudi }: { record?: Attivita; giorno?: string; minuto?: number; area?: Area; onChiudi: () => void }) {
  const parametroArea = new URLSearchParams(location.hash.split('?')[1] ?? '').get('area')
  const [b, setB] = useState({
    titolo: record?.titolo ?? '',
    area: record ? areaDa(record.area) : area ?? (parametroArea ? areaDa(parametroArea) : 'personale'),
    scadenza: record?.scadenza ?? giorno ?? '',
    ora: record?.minuto !== undefined ? orarioDaMinuti(record.minuto) : minuto !== undefined ? orarioDaMinuti(minuto) : '',
    alta: record?.priorita === 'alta',
    ripeti: ripetizioneDa(record?.ripeti),
    passi: record?.passi ?? [],
    note: record?.note ?? '',
  })
  const [nuovoPasso, setNuovoPasso] = useState('')
  const oraValida = b.ora === '' || minutiDaOrario(b.ora) !== undefined
  const valido = b.titolo.trim() !== '' && (b.scadenza === '' || !!giornoDaChiave(b.scadenza)) && oraValida

  async function conferma() {
    if (!valido) return
    const passi = [...b.passi, ...(nuovoPasso.trim() ? [{ testo: nuovoPasso.trim() }] : [])]
    await salva('attivita', {
      ...record, titolo: b.titolo.trim(), area: b.area, priorita: b.alta ? 'alta' : 'normale',
      scadenza: b.scadenza || undefined, minuto: b.scadenza && b.ora ? minutiDaOrario(b.ora) : undefined,
      ripeti: b.scadenza && b.ripeti !== 'mai' ? b.ripeti : undefined,
      passi: passi.length ? passi : undefined, note: b.note.trim() || undefined,
    })
    onChiudi()
  }
  const oggiChiave = chiaveGiorno(oggi())
  const scorciatoie: [string, string][] = [['Oggi', oggiChiave], ['Domani', piuGiorni(oggiChiave, 1)], ['Tra una settimana', piuGiorni(oggiChiave, 7)]]

  return (
    <Foglio aperto titolo={record ? 'Task' : 'Nuovo task'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Cosa devi fare"><input value={b.titolo} autoFocus={!record} placeholder="es. Preparare le slide per il journal club" onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="campo">
          <span>Area</span>
          <div className="riga-azioni" role="group" aria-label="Area">
            {AREE.map((a) => (
              <button key={a} type="button" className={`pillola voce-scelta etichetta-area a-${a}`} aria-pressed={b.area === a} onClick={() => setB({ ...b, area: a })}>{TITOLI_AREA[a]}</button>
            ))}
          </div>
        </div>
        <div className="campo">
          <span>Entro quando</span>
          <div className="riga-azioni">
            {scorciatoie.map(([t, g]) => (
              <button key={t} type="button" className="pillola" aria-pressed={b.scadenza === g} onClick={() => setB({ ...b, scadenza: g })}
                style={b.scadenza === g ? { background: 'var(--primario)', color: 'var(--primario-testo)', borderColor: 'transparent' } : undefined}>{t}</button>
            ))}
            {b.scadenza && <button type="button" className="pillola" onClick={() => setB({ ...b, scadenza: '', ora: '', ripeti: 'mai' })}>Senza data</button>}
          </div>
          <div className="campi-affiancati" style={{ marginTop: 6 }}>
            <input type="date" value={b.scadenza} aria-label="Data" onChange={(e) => setB({ ...b, scadenza: e.target.value })} />
            {b.scadenza && <input type="time" value={b.ora} aria-label="Ora (facoltativa)" onChange={(e) => setB({ ...b, ora: e.target.value })} />}
          </div>
        </div>
        {b.scadenza && (
          <Campo etichetta="Si ripete">
            <select value={b.ripeti} onChange={(e) => setB({ ...b, ripeti: e.target.value as Ripetizione })}>
              {RIPETIZIONI.map((r) => <option key={r} value={r}>{TITOLI_RIPETIZIONE[r]}</option>)}
            </select>
          </Campo>
        )}
        <label className="interruttore">
          <span>Priorità alta</span>
          <input type="checkbox" checked={b.alta} onChange={(e) => setB({ ...b, alta: e.target.checked })} />
        </label>
        <div className="campo">
          <span>Passi (facoltativi)</span>
          {b.passi.length > 0 && (
            <div className="lista">
              {b.passi.map((p, i) => (
                <div key={i} className="riga" style={{ cursor: 'default', padding: '8px 0' }}>
                  <input type="checkbox" checked={Boolean(p.fatto)} aria-label="Fatto"
                    onChange={(e) => setB({ ...b, passi: b.passi.map((x, j) => (j === i ? { ...x, fatto: e.target.checked || undefined } : x)) })}
                    style={{ width: 20, height: 20, accentColor: 'var(--primario)' }} />
                  <span className="crescente" style={{ textDecoration: p.fatto ? 'line-through' : undefined }}>{p.testo}</span>
                  <button type="button" className="elimina-riga" aria-label={`Togli ${p.testo}`} onClick={() => setB({ ...b, passi: b.passi.filter((_, j) => j !== i) })}>×</button>
                </div>
              ))}
            </div>
          )}
          <input value={nuovoPasso} placeholder="Aggiungi un passo e premi Invio" enterKeyHint="enter"
            onChange={(e) => setNuovoPasso(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && nuovoPasso.trim()) { e.preventDefault(); setB({ ...b, passi: [...b.passi, { testo: nuovoPasso.trim() }] }); setNuovoPasso('') } }} />
        </div>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <NotaPrivacy />
        {record && (
          <div className="riga-azioni">
            <button type="button" className="pulsante" onClick={() => void segnaFatto(record).then(onChiudi)}>{record.completataIl ? 'Riapri' : 'Segna come fatto'}</button>
            <button type="button" className="pulsante pericolo"
              onClick={() => void elimina('attivita', record.id).then(() => { onChiudi(); mostraAvviso(`Eliminato: ${record.titolo}`, () => void ripristina('attivita', record.id)) })}>
              Elimina
            </button>
          </div>
        )}
      </div>
    </Foglio>
  )
}

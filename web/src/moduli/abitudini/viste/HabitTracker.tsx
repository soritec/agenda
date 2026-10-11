import { useMemo, useState } from 'react'
import { giornoDi, istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Abitudine, SegnoAbitudine } from '../../../dati/modello'
import { Campo, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro } from '../../../interfaccia/icone'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import { tipoGiornataDa, tipoTurnoDa } from '../../turni/tipi'
import { COLORI_ABITUDINE, idSegno, percentualeMese, piuGiorni, serieGiornaliera, serieSettimanale, volteNellaSettimana } from '../logica'

const ms = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }

/** Giorni di guardia e di smonto: lì un'abitudine saltata non rompe la serie. */
function useGiorniProtetti(): Set<string> {
  const turni = useCollezione('turni')
  const giornate = useCollezione('ferie')
  return useMemo(() => {
    const s = new Set<string>()
    for (const t of turni ?? []) {
      const tipo = tipoTurnoDa(t.tipo)
      if (tipo === 'guardiaNotturna' || tipo === 'guardiaDiurna') s.add(chiaveGiorno(giornoDi(t.inizio)))
    }
    for (const g of giornate ?? []) if (tipoGiornataDa(g.tipo) === 'smontoNotte') s.add(g.giorno)
    return s
  }, [turni, giornate])
}

function useDati() {
  const abitudini = useCollezione('abitudini')
  const segni = useCollezione('segniAbitudine')
  const elenco = useMemo(() => [...(abitudini ?? [])].sort((a, b) => a.ordine - b.ordine), [abitudini])
  const fatti = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const s of segni ?? []) { if (!m.has(s.abitudineId)) m.set(s.abitudineId, new Set()); m.get(s.abitudineId)!.add(s.giorno) }
    return m
  }, [segni])
  return { elenco, fatti, segni: segni ?? [], pronto: Boolean(abitudini && segni) }
}

async function cambia(a: Abitudine, giorno: string, segni: SegnoAbitudine[]) {
  const id = idSegno(a.id, giorno)
  if (segni.some((s) => s.id === id)) await elimina('segniAbitudine', id)
  else await salva('segniAbitudine', { id, abitudineId: a.id, giorno })
}

/** Pallino di un'abitudine in un giorno: pieno se fatta. */
function Pallino({ a, fatto, onClick, disabilitato, grande }: { a: Abitudine; fatto: boolean; onClick?: () => void; disabilitato?: boolean; grande?: boolean }) {
  return (
    <button type="button" className={`pallino-abitudine${grande ? ' grande' : ''}`} disabled={disabilitato} onClick={onClick}
      aria-pressed={fatto} aria-label={`${a.nome}: ${fatto ? 'fatto' : 'non fatto'}`}
      style={{ borderColor: disabilitato ? 'var(--linea-forte)' : a.colore, background: fatto ? a.colore : 'transparent' }} />
  )
}

/** Le abitudini di oggi da toccare (anche nella pagina Oggi). */
export function AbitudiniDiOggi({ titolo = true }: { titolo?: boolean }) {
  const { elenco, fatti, segni, pronto } = useDati()
  const protetti = useGiorniProtetti()
  const g = chiaveGiorno(oggi())
  if (!pronto || !elenco.length) return null
  const fatteOggi = elenco.filter((a) => fatti.get(a.id)?.has(g)).length
  return (
    <section className="scheda abitudini-oggi">
      {titolo && <div className="intestazione" style={{ alignItems: 'baseline' }}><h2 className="titolo-sezione">Abitudini di oggi <span className="secondario piccolo" style={{ fontWeight: 400 }}>{fatteOggi} di {elenco.length}</span></h2><a href="#/habit" className="piccolo">Habit tracker ›</a></div>}
      <div className="chip-abitudini">
        {elenco.map((a) => {
          const f = fatti.get(a.id) ?? new Set<string>()
          const serie = a.volteSettimana ? serieSettimanale(f, g, a.volteSettimana) : serieGiornaliera(f, g, protetti)
          return (
            <button key={a.id} type="button" className="chip-abitudine" onClick={() => void cambia(a, g, segni)} aria-pressed={f.has(g)}>
              <span className="pallino-abitudine" style={{ borderColor: a.colore, background: f.has(g) ? a.colore : 'transparent' }} />
              <span>{a.nome}</span>
              <span className="secondario piccolo">{a.volteSettimana ? `${volteNellaSettimana(f, g)}/${a.volteSettimana} sett.` : serie ? `serie ${serie}` : ''}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function HabitTracker({ meseParam }: { meseParam?: string | null }) {
  const { elenco, fatti, segni, pronto } = useDati()
  const protetti = useGiorniProtetti()
  const oggiChiave = chiaveGiorno(oggi())
  const mese = meseParam && /^\d{4}-\d{2}$/.test(meseParam) ? meseParam : oggiChiave.slice(0, 7)
  const [modifica, setModifica] = useState<{ a?: Abitudine }>()
  const giorni: string[] = []
  for (let g = `${mese}-01`; g.startsWith(mese); g = piuGiorni(g, 1)) giorni.push(g)
  const [anno, m] = mese.split('-').map(Number) as [number, number]
  const precedente = new Date(Date.UTC(anno, m - 2, 1)).toISOString().slice(0, 7)
  const successivo = new Date(Date.UTC(anno, m, 1)).toISOString().slice(0, 7)

  const righe = elenco.map((a) => {
    const f = fatti.get(a.id) ?? new Set<string>()
    const serie = a.volteSettimana ? serieSettimanale(f, oggiChiave, a.volteSettimana) : serieGiornaliera(f, oggiChiave, protetti)
    return { a, f, serie, perc: percentualeMese(a, f, mese, oggiChiave, protetti) }
  })
  const migliore = [...righe].sort((x, y) => y.serie - x.serie)[0]
  const percMedia = righe.filter((r) => r.perc !== undefined).length ? Math.round(righe.reduce((t, r) => t + (r.perc ?? 0), 0) / righe.filter((r) => r.perc !== undefined).length) : undefined

  async function eliminaAbitudine(a: Abitudine) {
    await elimina('abitudini', a.id)
    mostraAvviso(`Eliminata: ${a.nome}`, () => void ripristina('abitudini', a.id))
  }

  return (
    <div className="schermata" style={{ maxWidth: 1100 }}>
      <header className="testata-turni">
        <h1 className="titolo-grande">Habit tracker</h1>
        <div className="riga-azioni azioni">
          <a className="pulsante tondo" href={`#/habit?mese=${precedente}`} aria-label="Mese precedente"><IconaIndietro dimensione={18} /></a>
          <a className="pulsante" href="#/habit" style={{ minWidth: 140, fontWeight: 600, textTransform: 'capitalize' }}>{F.mese(istante(anno, m, 1))}</a>
          <a className="pulsante tondo" href={`#/habit?mese=${successivo}`} aria-label="Mese successivo"><IconaAvanti dimensione={18} /></a>
          <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ Abitudine</button>
        </div>
      </header>

      <AbitudiniDiOggi titolo={false} />

      {pronto && elenco.length === 0 && (
        <div className="scheda secondario">Aggiungi la prima abitudine con "+ Abitudine": dai tu il nome (es. Palestra, Meditazione, Journaling, Niente caffè dopo le 16).</div>
      )}

      {elenco.length > 0 && (
        <section className="scheda griglia-abitudini-scorri">
          <table className="griglia-abitudini">
            <thead>
              <tr>
                <th className="nome-abitudine" />
                {giorni.map((g) => (
                  <th key={g} className={`${g === oggiChiave ? 'oggi' : ''}${protetti.has(g) ? ' protetto' : ''}`}>
                    <span className="secondario">{['L', 'M', 'M', 'G', 'V', 'S', 'D'][(new Date(ms(g)).getUTCDay() + 6) % 7]}</span><br />{Number(g.slice(8, 10))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {righe.map(({ a, f, serie, perc }) => (
                <tr key={a.id}>
                  <td className="nome-abitudine">
                    <span className="riga-nome-abitudine">
                      <button type="button" className="link-abitudine" onClick={() => setModifica({ a })}>
                        <span className="pallino-fonte" style={{ background: a.colore }} />
                        <span>{a.nome}</span>
                      </button>
                      <button type="button" className="elimina-task" aria-label={`Elimina ${a.nome}`} onClick={() => void eliminaAbitudine(a)}>×</button>
                    </span>
                    <span className="secondario piccolo">
                      {[a.tipo === 'evitare' ? 'da evitare' : '', a.volteSettimana ? `${a.volteSettimana}/sett.` : '', `serie ${serie}${a.volteSettimana ? ' sett.' : ''}`, perc !== undefined ? `${perc}% nel mese` : ''].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  {giorni.map((g) => (
                    <td key={g} className={`${g === oggiChiave ? 'oggi' : ''}${protetti.has(g) ? ' protetto' : ''}`}>
                      <Pallino a={a} fatto={f.has(g)} disabilitato={g > oggiChiave} onClick={() => void cambia(a, g, segni)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <span className="secondario piccolo">Pallino pieno = fatto (per le abitudini da evitare: ci sei riuscita). In grigio i giorni di guardia e di smonto: se salti, la serie non si rompe.</span>
        </section>
      )}

      {righe.length > 0 && (
        <div className="tessere">
          <div className="tessera"><span className="secondario piccolo">Serie migliore ora</span><span className="valore" style={{ fontSize: 18 }}>{migliore?.serie ? `${migliore.a.nome} · ${migliore.serie}${migliore.a.volteSettimana ? ' sett.' : ' giorni'}` : '—'}</span></div>
          <div className="tessera"><span className="secondario piccolo">Questo mese</span><span className="valore" style={{ fontSize: 18 }}>{percMedia !== undefined ? `${percMedia}% fatto` : '—'}</span></div>
          {righe.filter((r) => r.a.volteSettimana).slice(0, 2).map((r) => (
            <div key={r.a.id} className="tessera"><span className="secondario piccolo">{r.a.nome}</span><span className="valore" style={{ fontSize: 18 }}>{volteNellaSettimana(r.f, oggiChiave)} di {r.a.volteSettimana} a settimana</span></div>
          ))}
        </div>
      )}

      {modifica && <FormAbitudine a={modifica.a} ordine={(elenco.at(-1)?.ordine ?? 0) + 1} usati={elenco.map((x) => x.colore)} onChiudi={() => setModifica(undefined)} />}
    </div>
  )
}

function FormAbitudine({ a, ordine, usati, onChiudi }: { a?: Abitudine; ordine: number; usati: string[]; onChiudi: () => void }) {
  const [b, setB] = useState({
    nome: a?.nome ?? '', colore: a?.colore ?? COLORI_ABITUDINE.find((c) => !usati.includes(c)) ?? COLORI_ABITUDINE[0]!,
    tipo: (a?.tipo === 'evitare' ? 'evitare' : 'fare') as 'fare' | 'evitare', volte: a?.volteSettimana ?? 0,
  })
  const valido = b.nome.trim() !== ''
  async function conferma() {
    if (!valido) return
    await salva('abitudini', { ...a, nome: b.nome.trim(), colore: b.colore, tipo: b.tipo, volteSettimana: b.volte || undefined, ordine: a?.ordine ?? ordine })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={a ? 'Abitudine' : 'Nuova abitudine'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={b.nome} autoFocus={!a} placeholder="es. Palestra, Meditazione, Niente caffè dopo le 16" onChange={(e) => setB((x) => ({ ...x, nome: e.target.value }))} /></Campo>
        <div className="segmenti">
          <button type="button" className={b.tipo === 'fare' ? 'attivo' : ''} onClick={() => setB((x) => ({ ...x, tipo: 'fare' }))}>Da fare</button>
          <button type="button" className={b.tipo === 'evitare' ? 'attivo' : ''} onClick={() => setB((x) => ({ ...x, tipo: 'evitare' }))}>Da evitare</button>
        </div>
        {b.tipo === 'evitare' && <span className="secondario piccolo">Riempi il pallino nei giorni in cui ci sei riuscita.</span>}
        <div className="campo"><span>Quanto spesso</span>
          <div className="riga-azioni">
            <button type="button" className={`pillola${b.volte === 0 ? ' filtro-attivo' : ''}`} onClick={() => setB((x) => ({ ...x, volte: 0 }))}>Ogni giorno</button>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <button key={n} type="button" className={`pillola${b.volte === n ? ' filtro-attivo' : ''}`} onClick={() => setB((x) => ({ ...x, volte: n }))}>{n} a settimana</button>
            ))}
          </div>
        </div>
        <div className="campo"><span>Colore</span>
          <div className="riga-azioni">{COLORI_ABITUDINE.map((c) => <button key={c} type="button" className="campione-colore" aria-label={`Colore ${c}`} aria-pressed={b.colore === c} style={{ background: c }} onClick={() => setB((x) => ({ ...x, colore: c }))} />)}</div>
        </div>
        {a && (
          <button type="button" className="pulsante pericolo" onClick={() => void elimina('abitudini', a.id).then(() => { onChiudi(); mostraAvviso(`Eliminata: ${a.nome}`, () => void ripristina('abitudini', a.id)) })}>Elimina l'abitudine</button>
        )}
      </div>
    </Foglio>
  )
}

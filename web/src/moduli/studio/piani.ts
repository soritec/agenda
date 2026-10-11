import type { ArgomentoPiano, PianoStudio, SessionePiano } from '../../dati/modello'
import { chiaveGiorno, giornoDaChiave } from '../turni/supporto'

/** Ritmo di partenza per stimare il tempo: pagine all'ora. */
export const PAGINE_ORA = 20
export const COLORI_PIANO = ['#1D9E75', '#7F77DD', '#E0873A', '#378ADD', '#D4537E', '#8C7B5A']

export const piuGiorni = (giorno: string, n: number) => {
  const g = giornoDaChiave(giorno)!
  const d = new Date(Date.UTC(g.anno, g.mese - 1, g.giorno + n))
  return chiaveGiorno({ anno: d.getUTCFullYear(), mese: d.getUTCMonth() + 1, giorno: d.getUTCDate() })
}
export const giornoSettimana = (giorno: string) => { const g = giornoDaChiave(giorno)!; return ((new Date(Date.UTC(g.anno, g.mese - 1, g.giorno)).getUTCDay() + 6) % 7) + 1 }
export const pagineDi = (a: Pick<ArgomentoPiano, 'paginaDa' | 'paginaA'>) => (a.paginaDa !== undefined && a.paginaA !== undefined && a.paginaA >= a.paginaDa ? a.paginaA - a.paginaDa + 1 : 0)

/** Giorni di studio del piano: dall'inizio al giorno prima della fine, solo nei giorni della settimana scelti. */
export function giorniDelPiano(p: Pick<PianoStudio, 'inizio' | 'fine' | 'giorniSettimana'>): string[] {
  const giorni: string[] = []
  for (let g = p.inizio; g < p.fine && giorni.length < 800; g = piuGiorni(g, 1)) if (p.giorniSettimana.includes(giornoSettimana(g))) giorni.push(g)
  return giorni
}

type Nuova = Omit<SessionePiano, 'id' | 'creatoIl' | 'modificatoIl'>

/**
 * Divide le pagine degli argomenti nei giorni disponibili, in ordine, con circa lo stesso carico ogni giorno.
 * Se ci sono almeno 4 giorni, l'ultimo resta per il ripasso generale. Argomenti senza pagine: una sessione intera.
 */
export function dividiPagine(p: Pick<PianoStudio, 'inizio' | 'fine' | 'giorniSettimana' | 'minutiAlGiorno' | 'argomenti'>, pianoId: string, oggi?: string): Nuova[] {
  let giorni = giorniDelPiano(p).filter((g) => !oggi || g >= oggi)
  if (!giorni.length) return []
  const ripassoFinale = giorni.length >= 4 ? giorni.at(-1)! : undefined
  if (ripassoFinale) giorni = giorni.slice(0, -1)
  // Ogni argomento senza pagine vale come 2 ore di lavoro.
  const unita = p.argomenti.map((a) => ({ a, pagine: pagineDi(a), carico: pagineDi(a) || 2 * PAGINE_ORA }))
  const totale = unita.reduce((s, u) => s + u.carico, 0)
  const perGiorno = Math.max(1, Math.ceil(totale / giorni.length))
  const out: Nuova[] = []
  let gi = 0, spazio = perGiorno
  for (const u of unita) {
    let resta = u.carico
    let pagina = u.a.paginaDa ?? 0
    while (resta > 0 && gi < giorni.length) {
      const pezzo = gi === giorni.length - 1 ? resta : Math.min(resta, spazio)
      const conPagine = u.pagine > 0
      out.push({
        pianoId, giorno: giorni[gi]!, tipo: 'studio', argomentoId: u.a.id, titolo: u.a.nome,
        paginaDa: conPagine ? pagina : undefined, paginaA: conPagine ? pagina + pezzo - 1 : undefined,
        minuti: Math.max(15, Math.round((pezzo / PAGINE_ORA) * 60 / 5) * 5),
      })
      pagina += pezzo
      resta -= pezzo
      spazio -= pezzo
      if (spazio <= 0) { gi++; spazio = perGiorno }
    }
  }
  if (ripassoFinale) out.push({ pianoId, giorno: ripassoFinale, tipo: 'ripassoGenerale', titolo: 'Ripasso generale', minuti: p.minutiAlGiorno })
  return out
}

/** Ripassi brevi dopo 1, 7 e 30 giorni dall'ultima sessione di ogni argomento (solo prima della fine del piano). */
export function ripassiPer(sessioni: Nuova[], fine: string, nomi: Map<string, string>): Nuova[] {
  const ultimo = new Map<string, string>()
  for (const s of sessioni) if (s.tipo === 'studio' && s.argomentoId && (ultimo.get(s.argomentoId) ?? '') < s.giorno) ultimo.set(s.argomentoId, s.giorno)
  const out: Nuova[] = []
  for (const [id, giorno] of ultimo) {
    for (const n of [1, 7, 30]) {
      const g = piuGiorni(giorno, n)
      if (g < fine) out.push({ pianoId: sessioni[0]!.pianoId, giorno: g, tipo: 'ripasso', argomentoId: id, titolo: `Ripasso: ${nomi.get(id) ?? ''}`, minuti: 15 })
    }
  }
  return out
}

/**
 * Sessioni non fatte rimaste nei giorni passati: vanno nei giorni di studio da oggi in poi,
 * una alla volta nel giorno con meno minuti già previsti (evitando i giorni occupati se possibile).
 */
export function riprogramma(sessioni: SessionePiano[], p: Pick<PianoStudio, 'inizio' | 'fine' | 'giorniSettimana'>, oggi: string, occupato: (g: string) => boolean): { id: string; giorno: string }[] {
  const giorni = giorniDelPiano(p).filter((g) => g >= oggi)
  if (!giorni.length) return []
  const liberi = giorni.filter((g) => !occupato(g))
  const usabili = liberi.length ? liberi : giorni
  const carico = new Map(usabili.map((g) => [g, 0]))
  for (const s of sessioni) if (!s.fatta && carico.has(s.giorno)) carico.set(s.giorno, carico.get(s.giorno)! + s.minuti)
  const mancate = sessioni.filter((s) => !s.fatta && s.giorno < oggi && s.tipo !== 'ripasso').sort((a, b) => a.giorno.localeCompare(b.giorno))
  return mancate.map((s) => {
    const giorno = [...carico].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0]![0]
    carico.set(giorno, carico.get(giorno)! + s.minuti)
    return { id: s.id, giorno }
  })
}

/** Riepilogo di un insieme di sessioni (es. la settimana o tutto il piano). */
export function riepilogoSessioni(sessioni: SessionePiano[]) {
  const studio = sessioni.filter((s) => s.tipo === 'studio')
  const pagine = (l: SessionePiano[]) => l.reduce((t, s) => t + (s.paginaDa !== undefined && s.paginaA !== undefined ? s.paginaA - s.paginaDa + 1 : 0), 0)
  return {
    minutiPrevisti: sessioni.reduce((t, s) => t + s.minuti, 0),
    minutiFatti: sessioni.filter((s) => s.fatta).reduce((t, s) => t + (s.minutiFatti ?? s.minuti), 0),
    paginePreviste: pagine(studio),
    pagineFatte: pagine(studio.filter((s) => s.fatta)),
    sessioni: sessioni.length,
    fatte: sessioni.filter((s) => s.fatta).length,
  }
}

/** Argomento finito: tutte le sue sessioni di studio sono fatte. */
export const argomentoFinito = (sessioni: SessionePiano[], argomentoId: string) => {
  const sue = sessioni.filter((s) => s.argomentoId === argomentoId && s.tipo === 'studio')
  return sue.length > 0 && sue.every((s) => s.fatta)
}

/** Valida le sessioni proposte da Gemini: solo giorni del piano e argomenti esistenti. */
export function leggiPianoAI(testo: string, p: Pick<PianoStudio, 'inizio' | 'fine' | 'giorniSettimana' | 'argomenti'>, pianoId: string): Nuova[] {
  let dati: unknown
  try { dati = JSON.parse(testo.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { return [] }
  const elenco = (Array.isArray(dati) ? dati : (dati as { sessioni?: unknown[] })?.sessioni ?? []) as Record<string, unknown>[]
  const giorni = new Set(giorniDelPiano(p))
  const perNome = new Map(p.argomenti.map((a) => [a.nome.toLowerCase(), a]))
  return elenco.flatMap((x): Nuova[] => {
    const giorno = String(x.giorno ?? '')
    if (!giorni.has(giorno)) return []
    const tipo = x.tipo === 'ripassoGenerale' || x.tipo === 'ripasso' ? String(x.tipo) : 'studio'
    const arg = perNome.get(String(x.argomento ?? '').toLowerCase())
    if (tipo === 'studio' && !arg) return []
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : undefined)
    return [{
      pianoId, giorno, tipo, argomentoId: arg?.id, titolo: tipo === 'ripassoGenerale' ? 'Ripasso generale' : arg ? (tipo === 'ripasso' ? `Ripasso: ${arg.nome}` : arg.nome) : 'Ripasso',
      paginaDa: num(x.paginaDa), paginaA: num(x.paginaA), minuti: Math.max(10, num(x.minuti) ?? 60),
    }]
  })
}

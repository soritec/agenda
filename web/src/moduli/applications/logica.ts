import type { Application } from '../../dati/modello'

/** Application agli studi legali: passi della selezione, scadenze, valutazioni degli studi. */

export const PASSI_PREDEFINITI = ['Inviata', 'Online test', 'Video interview', 'Assessment centre', 'Offerta']

export const PROGRAMMI = ['vacation', 'tc', 'insight', 'workshop', 'altro'] as const
export type Programma = (typeof PROGRAMMI)[number]
export const TITOLI_PROGRAMMA: Record<Programma, string> = { vacation: 'Vacation scheme', tc: 'Training contract', insight: 'Insight / open day', workshop: 'Workshop', altro: 'Altro' }
export const programmaDa = (p?: string): Programma => ((PROGRAMMI as readonly string[]).includes(p ?? '') ? (p as Programma) : 'altro')

/** Categorie di valutazione, come nelle classifiche degli studenti (es. Legal Cheek). */
export const CATEGORIE_VOTO = ['Training', 'Quality of work', 'Work/life balance', 'Peer support', 'Partner approachability', 'Perks', 'Office', 'Social life']
export const VOTI = ['A*', 'A', 'B', 'C', 'D']
/** Colori dei voti (sfondo, testo): buoni in verde salvia, medi in sabbia, bassi in mattone. */
export const coloreVoto = (v?: string): [string, string] =>
  v === 'A*' || v === 'A' ? ['#DCEBD9', '#33553A'] : v === 'B' ? ['#F6EEDF', '#6B5317'] : v ? ['#F0D8CC', '#7A3E28'] : ['transparent', 'var(--testo-2)']

export const COLORI_STUDIO = ['#2F4560', '#2E6B66', '#5A3E57', '#6B5317', '#7A3E28', '#45456A', '#33553A']

/**
 * Tocco su un pallino: si riempie insieme a quelli prima; ritoccando l'ultimo pieno si svuota.
 * Restituisce il nuovo numero di passi fatti.
 */
export function toccaPasso(fatti: number, indice: number): number {
  return indice + 1 === fatti ? indice : indice + 1
}

export type Fase = 'daScrivere' | 'inCorso' | 'offerta' | 'nonPassata'
export function fase(a: Pick<Application, 'fatti' | 'passi' | 'nonPassata'>): Fase {
  if (a.nonPassata) return 'nonPassata'
  if (a.passi.length > 0 && a.fatti >= a.passi.length) return 'offerta'
  return a.fatti === 0 ? 'daScrivere' : 'inCorso'
}

/** Prossima data da tenere d'occhio: la deadline se non è ancora inviata, altrimenti la data del passo successivo. */
export function prossimaScadenza(a: Application): { cosa: string; giorno: string; minuto?: number } | undefined {
  if (a.nonPassata || fase(a) === 'offerta') return undefined
  if (a.fatti === 0) return a.deadline ? { cosa: 'deadline', giorno: a.deadline } : undefined
  const passo = a.passi[a.fatti]
  const d = passo ? a.datePassi?.[passo] : undefined
  return d && passo ? { cosa: passo, ...d } : undefined
}

/** In alto le application ancora aperte (per scadenza più vicina), poi le offerte, in fondo le non passate. */
export function ordinaApplications(elenco: Application[]): Application[] {
  const peso: Record<Fase, number> = { daScrivere: 0, inCorso: 0, offerta: 1, nonPassata: 2 }
  return [...elenco].sort((a, b) => peso[fase(a)] - peso[fase(b)]
    || (prossimaScadenza(a)?.giorno ?? '9999').localeCompare(prossimaScadenza(b)?.giorno ?? '9999')
    || a.studio.localeCompare(b.studio))
}

/** Cambia i passi tenendo i passi fatti per nome (se un passo fatto viene tolto, i fatti diminuiscono). */
export function cambiaPassi(a: Pick<Application, 'passi' | 'fatti'>, nuovi: string[]): { passi: string[]; fatti: number } {
  const fattiPrima = new Set(a.passi.slice(0, a.fatti))
  let fatti = 0
  while (fatti < nuovi.length && fattiPrima.has(nuovi[fatti]!)) fatti++
  return { passi: nuovi, fatti }
}

const cercaSu = (sito: string, q: string) => `https://www.google.com/search?q=${encodeURIComponent(`${q} site:${sito}`)}`
export const linkStudio = (studio: string) => ({
  legalCheek: cercaSu('legalcheek.com', studio),
  chambers: cercaSu('chambersstudent.co.uk', studio),
  glassdoor: cercaSu('glassdoor.co.uk', `${studio} trainee solicitor`),
  rollOnFriday: cercaSu('rollonfriday.com', studio),
})
export const PORTALI = [
  { titolo: 'Legal Cheek Firms Most List', url: 'https://www.legalcheek.com/the-legal-cheek-firms-most-list/' },
  { titolo: 'Chambers Student', url: 'https://www.chambersstudent.co.uk' },
  { titolo: 'RollOnFriday', url: 'https://www.rollonfriday.com' },
  { titolo: 'Glassdoor', url: 'https://www.glassdoor.co.uk' },
]

/** Legge la risposta di Gemini con le valutazioni (JSON, anche dentro ```), scartando i voti non validi. */
export function leggiValutazioni(testo: string): { voti: Record<string, string>; tcCent?: number; nqCent?: number } | undefined {
  const pezzo = testo.match(/\{[\s\S]*\}/)?.[0]
  if (!pezzo) return undefined
  let dati: { voti?: Record<string, unknown>; tc?: unknown; nq?: unknown }
  try { dati = JSON.parse(pezzo) as typeof dati } catch { return undefined }
  const voti: Record<string, string> = {}
  for (const c of CATEGORIE_VOTO) {
    const v = String(dati.voti?.[c] ?? '').trim().toUpperCase().replace('STAR', '*')
    if (VOTI.includes(v)) voti[c] = v
  }
  const sterline = (x: unknown) => { const n = Number(String(x ?? '').replace(/[£,\s]/g, '')); return Number.isFinite(n) && n > 1000 ? Math.round(n * 100) : undefined }
  return { voti, tcCent: sterline(dati.tc), nqCent: sterline(dati.nq) }
}

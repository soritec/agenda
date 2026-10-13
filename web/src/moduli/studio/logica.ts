import { profiloPrincipale } from '../../dati/profili'
import type { Flashcard, SessioneStudio } from '../../dati/modello'
import { giornoDaChiave, chiaveGiorno } from '../turni/supporto'

export const ARGOMENTI_PREDEFINITI = ['Ostetricia', 'Ginecologia', 'Ecografia', 'Oncologia ginecologica', 'PMA e infertilità', 'Uroginecologia', 'Endocrinologia ginecologica', 'Altro']
export const idArgomento = (nome: string) => `argomento-${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`

export const TIPI_RISORSA = ['lineaGuida', 'articolo', 'libro', 'video', 'sito'] as const
export type TipoRisorsa = (typeof TIPI_RISORSA)[number]
export const TITOLI_TIPO_RISORSA: Record<TipoRisorsa, string> = { lineaGuida: profiloPrincipale() ? 'Linea guida' : 'Normativa', articolo: 'Articolo', libro: 'Libro', video: 'Video', sito: 'Sito' }
export const tipoRisorsaDa = (t: string): TipoRisorsa => ((TIPI_RISORSA as readonly string[]).includes(t) ? (t as TipoRisorsa) : 'articolo')

export const STATI_LETTURA = ['daLeggere', 'inLettura', 'letto'] as const
export type StatoLettura = (typeof STATI_LETTURA)[number]
export const TITOLI_STATO_LETTURA: Record<StatoLettura, string> = { daLeggere: 'Da leggere', inLettura: 'In lettura', letto: 'Letto' }
export const statoLetturaDa = (s: string): StatoLettura => ((STATI_LETTURA as readonly string[]).includes(s) ? (s as StatoLettura) : 'daLeggere')

/** Siti utili da aggiungere con un tocco. */
export const SITI_STUDIO = profiloPrincipale() ? [
  { titolo: 'SIGO', url: 'https://www.sigo.it' },
  { titolo: 'AOGOI', url: 'https://www.aogoi.it' },
  { titolo: 'ACOG', url: 'https://www.acog.org/clinical' },
  { titolo: 'RCOG Green-top', url: 'https://www.rcog.org.uk/guidance/browse-all-guidance/green-top-guidelines/' },
  { titolo: 'ISUOG', url: 'https://www.isuog.org/clinical-resources/isuog-guidelines.html' },
  { titolo: 'FIGO', url: 'https://www.figo.org' },
  { titolo: 'NICE', url: 'https://www.nice.org.uk/guidance' },
  { titolo: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov' },
] : [
  { titolo: 'BAILII', url: 'https://www.bailii.org' },
  { titolo: 'legislation.gov.uk', url: 'https://www.legislation.gov.uk' },
  { titolo: 'UK Supreme Court', url: 'https://www.supremecourt.uk/decided-cases' },
  { titolo: 'National Archives (sentenze)', url: 'https://caselaw.nationalarchives.gov.uk' },
  { titolo: 'Westlaw', url: 'https://uk.westlaw.com' },
  { titolo: 'LexisNexis', url: 'https://www.lexisnexis.co.uk' },
  { titolo: 'Google Scholar', url: 'https://scholar.google.com' },
  { titolo: 'EUR-Lex', url: 'https://eur-lex.europa.eu' },
]

export const cercaGoogle = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`
export const cercaScholar = (q: string) => `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}`
export const cercaPubMed = (q: string) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`

const piuGiorni = (giorno: string, n: number) => {
  const g = giornoDaChiave(giorno)!
  const d = new Date(Date.UTC(g.anno, g.mese - 1, g.giorno + n))
  return chiaveGiorno({ anno: d.getUTCFullYear(), mese: d.getUTCMonth() + 1, giorno: d.getUTCDate() })
}

/* Flashcard: 5 scatole. Giusta → scatola successiva (ritorna tra 1, 2, 4, 8, 16 giorni); sbagliata → scatola 1, domani. */
export const GIORNI_SCATOLA = [1, 2, 4, 8, 16] as const
export function rispondi(card: Pick<Flashcard, 'scatola'>, giusta: boolean, oggi: string): { scatola: number; prossima: string } {
  const scatola = giusta ? Math.min(5, card.scatola + 1) : 1
  return { scatola, prossima: piuGiorni(oggi, GIORNI_SCATOLA[scatola - 1]!) }
}
export const daRipassare = (cards: Flashcard[], oggi: string) => cards.filter((c) => c.prossima <= oggi)

/* Tempo di studio */

/** Lunedì della settimana del giorno dato. */
export function lunedi(giorno: string): string {
  const g = giornoDaChiave(giorno)!
  const dow = (new Date(Date.UTC(g.anno, g.mese - 1, g.giorno)).getUTCDay() + 6) % 7
  return piuGiorni(giorno, -dow)
}
export function minutiSettimana(sessioni: SessioneStudio[], oggi: string): number {
  const da = lunedi(oggi), a = piuGiorni(da, 6)
  return sessioni.filter((s) => s.giorno >= da && s.giorno <= a).reduce((t, s) => t + s.minuti, 0)
}
export function minutiPerArgomento(sessioni: SessioneStudio[], oggi: string): Map<string, number> {
  const da = lunedi(oggi)
  const m = new Map<string, number>()
  for (const s of sessioni) if (s.giorno >= da) m.set(s.argomentoId ?? '', (m.get(s.argomentoId ?? '') ?? 0) + s.minuti)
  return m
}

/* Corsi ECM */
export const creditiAnno = (corsi: { giorno: string; crediti?: number }[], anno: string) =>
  corsi.filter((c) => c.giorno.startsWith(anno)).reduce((t, c) => t + (c.crediti ?? 0), 0)

/** Testo delle flashcard create dall'AI: righe "D: … / R: …" → coppie domanda/risposta. */
export function leggiFlashcardDaTesto(testo: string): { domanda: string; risposta: string }[] {
  const out: { domanda: string; risposta: string }[] = []
  let domanda: string | undefined
  for (const riga of testo.split(/\r?\n/)) {
    const d = riga.match(/^\s*(?:\d+[.)]\s*)?(?:D|Domanda)\s*[:.]\s*(.+)$/i)
    const r = riga.match(/^\s*(?:R|Risposta)\s*[:.]\s*(.+)$/i)
    if (d) domanda = d[1]!.trim()
    else if (r && domanda) { out.push({ domanda, risposta: r[1]!.trim() }); domanda = undefined }
  }
  return out
}

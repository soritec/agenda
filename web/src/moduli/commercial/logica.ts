import type { Application, Notizia } from '../../dati/modello'
import { lunediDi, spostaGiorni } from '../agenda/impegni'

/** Commercial awareness: notizie per tema, divise per settimana. Testi in inglese, tranne la politica italiana. */

export const TEMI = ['geo', 'deal', 'mkt', 'reg', 'tech', 'life', 'ene', 'ita', 'law'] as const
export type Tema = (typeof TEMI)[number]
/** Nome, colore del testo, sfondo tenue. */
export const DATI_TEMA: Record<Tema, { nome: string; colore: string; sfondo: string }> = {
  geo: { nome: 'Geopolitics', colore: '#2F4560', sfondo: '#D8E2EE' },
  deal: { nome: 'Deals & M&A', colore: '#21524E', sfondo: '#D6EAE8' },
  mkt: { nome: 'Markets & economy', colore: '#6B5317', sfondo: '#F6EEDF' },
  reg: { nome: 'Regulation & policy', colore: '#5A3E57', sfondo: '#EADFE6' },
  tech: { nome: 'Tech & AI', colore: '#45456A', sfondo: '#E6E6F1' },
  life: { nome: 'Life sciences & healthcare', colore: '#2E5E4E', sfondo: '#E3EFEA' },
  ene: { nome: 'Energy & ESG', colore: '#33553A', sfondo: '#DCEBD9' },
  ita: { nome: 'Politica italiana', colore: '#6E3B2E', sfondo: '#EFE3DE' },
  law: { nome: 'Legal industry', colore: '#7A3E28', sfondo: '#F0D8CC' },
}
export const temaDa = (t?: string): Tema => ((TEMI as readonly string[]).includes(t ?? '') ? (t as Tema) : 'mkt')

/** Settimana (dal lunedì alla domenica) che contiene il giorno. */
export const settimanaDi = (giorno: string) => { const da = lunediDi(giorno); return { da, a: spostaGiorni(da, 6) } }

export const delPeriodo = (notizie: Notizia[], da: string, a: string) => notizie.filter((n) => n.giorno >= da && n.giorno <= a)

/** Storia della settimana: quella scelta, altrimenti nessuna. */
export const storiaDellaSettimana = (notizie: Notizia[]) => notizie.find((n) => n.storiaSettimana)

/** Studi legali citati nella notizia a cui è stata mandata un'application. */
export function studiConApplication(n: Pick<Notizia, 'studi' | 'titolo' | 'riassunto'>, applications: Pick<Application, 'studio'>[]): string[] {
  const testo = `${n.titolo} ${n.riassunto ?? ''} ${(n.studi ?? []).join(' ')}`.toLowerCase()
  return [...new Set(applications.map((a) => a.studio).filter((s) => s.trim().length > 2 && testo.includes(s.toLowerCase())))]
}

const json = (testo: string): unknown => {
  const pezzo = testo.match(/[[{][\s\S]*[\]}]/)?.[0]
  if (!pezzo) return undefined
  try { return JSON.parse(pezzo) } catch { return undefined }
}
const stringhe = (x: unknown) => (Array.isArray(x) ? x.map(String).map((s) => s.trim()).filter(Boolean) : undefined)
const testo = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim() : undefined)

/** Notizie trovate da Gemini (array JSON), scartando quelle senza titolo o senza giorno valido. */
export function leggiNotizie(risposta: string, oggi: string): Omit<Notizia, 'id' | 'creatoIl' | 'modificatoIl'>[] {
  const dati = json(risposta)
  const elenco = Array.isArray(dati) ? dati : (dati as { notizie?: unknown[]; stories?: unknown[] })?.stories ?? (dati as { notizie?: unknown[] })?.notizie ?? []
  return elenco.flatMap((x) => {
    const d = x as Record<string, unknown>
    const titolo = testo(d.title ?? d.titolo)
    if (!titolo) return []
    const giorno = typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date <= oggi ? d.date : oggi
    const url = testo(d.url)
    return [{
      titolo, tema: temaDa(testo(d.topic ?? d.tema)), fonte: testo(d.source ?? d.fonte), url: url && /^https?:\/\//.test(url) ? url : undefined,
      giorno, riassunto: testo(d.summary ?? d.riassunto), cifre: stringhe(d.figures ?? d.cifre)?.slice(0, 5), studi: stringhe(d.firms ?? d.studi), daGemini: true,
    }]
  })
}

/** Note di Gemini su una notizia: perché conta, cosa dire al colloquio, practice areas, studi. */
export function leggiSpiegazione(risposta: string): Pick<Notizia, 'perche' | 'colloquio' | 'aree' | 'studi'> | undefined {
  const d = json(risposta) as Record<string, unknown> | undefined
  if (!d || Array.isArray(d)) return undefined
  const r = { perche: testo(d.why ?? d.perche), colloquio: testo(d.interview ?? d.colloquio), aree: stringhe(d.practiceAreas ?? d.aree), studi: stringhe(d.firms ?? d.studi) }
  return r.perche || r.colloquio ? r : undefined
}

/** Toglie i doppioni (stesso titolo, senza maiuscole e punteggiatura) rispetto alle notizie già salvate. */
export function nuoveSoltanto<T extends { titolo: string }>(trovate: T[], esistenti: { titolo: string }[]): T[] {
  const chiave = (t: string) => t.toLowerCase().replace(/[^a-z0-9à-ù]+/g, ' ').trim()
  const viste = new Set(esistenti.map((n) => chiave(n.titolo)))
  return trovate.filter((n) => { const k = chiave(n.titolo); if (viste.has(k)) return false; viste.add(k); return true })
}

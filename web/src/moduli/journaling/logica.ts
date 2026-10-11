import type { PaginaDiario } from '../../dati/modello'

export const UMORI = ['bene', 'cosi', 'pesante'] as const
export type Umore = (typeof UMORI)[number]
export const TITOLI_UMORE: Record<Umore, string> = { bene: 'Bene', cosi: 'Così così', pesante: 'Pesante' }
/** Colori tenui della palette dell'app. */
export const COLORI_UMORE: Record<Umore, string> = { bene: '#9CCBB0', cosi: '#E9CF95', pesante: '#E2A891' }
export const umoreDa = (u?: string): Umore | undefined => ((UMORI as readonly string[]).includes(u ?? '') ? (u as Umore) : undefined)

export const COLORI_TACCUINO = ['#DCEBD9', '#D8E2EE', '#F0D8CC', '#EADFE6', '#F6EEDF', '#D6EAE8', '#E6E6F1', '#ECEAE6', '#3E7C77', '#2F4560', '#8A4F45', '#5A3E57']
export const TRAME = ['nessuna', 'righe', 'puntini', 'quadretti'] as const
export type Trama = (typeof TRAME)[number]
export const TITOLI_TRAMA: Record<Trama, string> = { nessuna: 'Liscia', righe: 'Righe', puntini: 'Puntini', quadretti: 'Quadretti' }

/** Colore del testo leggibile sulla copertina (chiaro sulle copertine scure). */
export function testoSu(colore: string): string {
  const m = colore.match(/^#([0-9a-f]{6})$/i)
  if (!m) return '#1F1F1F'
  const n = parseInt(m[1]!, 16)
  const l = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return l < 0.55 ? '#FFFFFF' : '#2A2622'
}

/** Modelli di pagina (testo HTML di partenza). */
export const MODELLI: { id: string; titolo: string; testo: string }[] = [
  { id: 'libera', titolo: 'Pagina libera', testo: '' },
  { id: 'belle', titolo: '3 cose belle di oggi', testo: '<h3>3 cose belle di oggi</h3><ul class="lista-spunta"><li></li><li></li><li></li></ul><h3>Una cosa che ho imparato</h3><p><br></p>' },
  { id: 'turno', titolo: 'Dopo un turno difficile', testo: '<h3>Cosa è successo</h3><p><br></p><h3>Come mi sono sentita</h3><p><br></p><h3>Cosa ho fatto bene</h3><p><br></p><h3>Cosa farei diversamente</h3><p><br></p><h3>Di cosa ho bisogno adesso</h3><p><br></p>' },
  { id: 'obiettivi', titolo: 'Obiettivi del mese', testo: '<h3>Obiettivi del mese</h3><ul class="lista-spunta"><li></li><li></li><li></li></ul><h3>Perché sono importanti</h3><p><br></p>' },
]

/** Testo semplice da HTML (per ricerca, anteprime, PDF): elenchi con •, liste da spuntare con ☐/☑. */
export function testoSemplice(html: string): string {
  const decodifica = (t: string) => t.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  const liste: boolean[] = []
  let out = ''
  for (const m of html.matchAll(/<(\/?)([a-z0-9]+)([^>]*)>|([^<]+)/gi)) {
    if (m[4] !== undefined) { out += decodifica(m[4]); continue }
    const chiude = m[1] === '/', tag = m[2]!.toLowerCase(), attr = m[3] ?? ''
    if (tag === 'ul' || tag === 'ol') { if (chiude) liste.pop(); else liste.push(/lista-spunta/.test(attr)); out += '\n' }
    else if (tag === 'li' && !chiude) out += `\n${liste.at(-1) ? (/fatto/.test(attr) ? '☑ ' : '☐ ') : '• '}`
    else if (tag === 'br') out += '\n'
    else if (chiude && ['p', 'div', 'h3', 'blockquote'].includes(tag)) out += '\n'
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Umore di ogni giorno del mese: quello segnato per ultimo (dal calendario o in una pagina scritta quel giorno). */
export function umoriDelMese(pagine: Pick<PaginaDiario, 'giorno' | 'umore' | 'modificatoIl'>[], mese: string, segnati: Pick<PaginaDiario, 'giorno' | 'umore' | 'modificatoIl'>[] = []): Map<string, Umore> {
  const m = new Map<string, { u: Umore; t: number }>()
  for (const p of [...pagine, ...segnati]) {
    const u = umoreDa(p.umore)
    if (!u || !p.giorno.startsWith(mese)) continue
    const prima = m.get(p.giorno)
    if (!prima || p.modificatoIl > prima.t) m.set(p.giorno, { u, t: p.modificatoIl })
  }
  return new Map([...m].map(([g, x]) => [g, x.u]))
}

/** Pagine scritte lo stesso giorno di un anno fa. */
export const unAnnoFa = (pagine: PaginaDiario[], oggi: string) => {
  const g = `${Number(oggi.slice(0, 4)) - 1}${oggi.slice(4)}`
  return pagine.filter((p) => p.giorno === g)
}

/** Ricerca in titolo, testo ed etichette (senza distinguere maiuscole e accenti). */
export function cerca(pagine: PaginaDiario[], q: string): PaginaDiario[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const parole = norm(q).split(/\s+/).filter(Boolean)
  if (!parole.length) return []
  return pagine.filter((p) => {
    const t = norm(`${p.titolo} ${testoSemplice(p.testo)} ${(p.etichette ?? []).join(' ')}`)
    return parole.every((w) => t.includes(w))
  }).sort((a, b) => b.giorno.localeCompare(a.giorno))
}

/** Impronta del codice del lucchetto (SHA-256 di sale + codice). */
export async function impronta(codice: string, sale: string): Promise<string> {
  const byte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sale}:${codice}`))
  return [...new Uint8Array(byte)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
export const nuovoSale = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')

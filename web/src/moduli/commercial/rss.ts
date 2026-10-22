/**
 * Notizie automatiche dai feed RSS dei giornali (senza intelligenza artificiale).
 * Lo script `scripts/notizie.ts` le raccoglie ogni giorno durante la pubblicazione e scrive `notizie.json`;
 * qui c'è solo la logica pura: lettura del feed, pulizia del testo e scelta del tema. Nessuna dipendenza.
 */

export interface NotiziaFeed {
  /** Stabile: ricavato dal link (così segnalibri e note restano collegati). */
  id: string
  titolo: string
  tema: string
  fonte: string
  url: string
  giorno: string
  riassunto?: string
  /** Scritte da Claude (riassunto lungo e note per i colloqui). */
  perche?: string
  colloquio?: string
  cifre?: string[]
  aree?: string[]
  studi?: string[]
  storiaSettimana?: boolean
}

/** Giornali letti, con il tema di partenza (le parole chiave possono cambiarlo). */
/** `soloSePertinenti`: feed generici (mondo, salute) da cui si tengono solo le notizie che toccano uno dei temi. */
export const FEED: { fonte: string; url: string; tema: string; soloSePertinenti?: boolean }[] = [
  { fonte: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', tema: 'mkt' },
  { fonte: 'BBC Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', tema: 'tech' },
  { fonte: 'BBC Health', url: 'https://feeds.bbci.co.uk/news/health/rss.xml', tema: 'life', soloSePertinenti: true },
  { fonte: 'The Guardian', url: 'https://www.theguardian.com/uk/business/rss', tema: 'mkt' },
  { fonte: 'The Guardian', url: 'https://www.theguardian.com/world/rss', tema: 'geo', soloSePertinenti: true },
  { fonte: 'The Guardian', url: 'https://www.theguardian.com/law/rss', tema: 'reg' },
  { fonte: 'The Guardian', url: 'https://www.theguardian.com/environment/energy/rss', tema: 'ene' },
  { fonte: 'City AM', url: 'https://www.cityam.com/feed/', tema: 'mkt' },
  { fonte: 'Legal Cheek', url: 'https://www.legalcheek.com/feed/', tema: 'law' },
  { fonte: 'ANSA', url: 'https://www.ansa.it/sito/notizie/politica/politica_rss.xml', tema: 'ita' },
  { fonte: 'Il Post', url: 'https://www.ilpost.it/politica/feed/', tema: 'ita' },
  { fonte: 'Il Sole 24 Ore', url: 'https://www.ilsole24ore.com/rss/italia.xml', tema: 'ita' },
]

const ENTITA: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', pound: '£', euro: '€' }

export function testoPulito(html: string): string {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (t, n: string) => ENTITA[n.toLowerCase()] ?? t)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Al massimo `frasi` frasi e circa 420 caratteri, senza "Continue reading…". */
export function riassuntoBreve(testo: string, frasi = 3): string | undefined {
  const t = testo
    .replace(/\b(Get our breaking news email|Sign up (to|for) our|Continue reading|Read more|Leggi tutto|The post .* appeared first on .*)\b.*$/i, '')
    .trim()
  if (!t) return undefined
  const pezzi = t.match(/[^.!?]+[.!?]+["”’)]?/g) ?? [t]
  let out = ''
  for (const p of pezzi.slice(0, frasi)) {
    if ((out + p).length > 420 && out) break
    out += p
  }
  return (out || t.slice(0, 420)).trim()
}

const campo = (item: string, nome: string) => item.match(new RegExp(`<${nome}[^>]*>([\\s\\S]*?)</${nome}>`, 'i'))?.[1]

/** Giorno "2026-10-21" dalla data del feed (in ora italiana). */
export function giornoDa(data?: string): string | undefined {
  const ms = data ? Date.parse(data.trim()) : NaN
  if (!Number.isFinite(ms)) return undefined
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms)
}

/** Identificativo stabile e corto dal link. */
export function idDa(url: string): string {
  let h = 5381
  for (const c of url) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0
  return `feed-${h.toString(36)}`
}

/** Regole per il tema, in ordine di priorità (la prima che corrisponde vince). */
const REGOLE: [string, RegExp][] = [
  ['law', /\b(law firms?|solicitors?|barristers?|trainees?|training contracts?|magic circle|legal (sector|industry))\b/i],
  ['deal', /\b(mergers?|acquisitions?|acquires?|acquired|takeovers?|buyouts?|bid for|private equity|ipo|flotation|deal (worth|valued)|agrees? to buy|snapped up)\b/i],
  ['reg', /\b(regulators?|fca|cma|ofcom|ofgem|watchdogs?|legislation|consultation|competition and markets|class action|lawsuits?|supreme court|high court|fined?)\b/i],
  ['life', /\b(nhs|pharma\w*|drugs?|biotech\w*|vaccines?|hospitals?|clinical|medicines?|patients?|digital health)\b/i],
  ['ene', /\b(energy|oil|gas|renewables?|wind farms?|solar|climate|net zero|esg|emissions|nuclear)\b/i],
  ['tech', /\b(ai|artificial intelligence|chips?|semiconductors?|software|cyber\w*|openai|nvidia|start-?ups?|crypto\w*)\b/i],
  ['geo', /\b(tariffs?|sanctions?|war|ukraine|russia|china|nato|gaza|israel|iran|elections?|trade war|g7|g20)\b/i],
  ['mkt', /\b(interest rates?|inflation|bank of england|ftse|stock markets?|shares|sterling|pound|gdp|recession|economy|budget|treasury|chancellor)\b/i],
]

export function temaDaTesto(testo: string, predefinito: string): string {
  if (predefinito === 'ita' || predefinito === 'law') return predefinito
  return REGOLE.find(([, re]) => re.test(testo))?.[0] ?? predefinito
}

/** Notizie di un feed RSS. */
export function leggiFeed(xml: string, feed: { fonte: string; tema: string; soloSePertinenti?: boolean }): NotiziaFeed[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []
  return items.flatMap((item) => {
    const titolo = testoPulito(campo(item, 'title') ?? '')
    const url = testoPulito(campo(item, 'link') ?? '') || testoPulito(campo(item, 'guid') ?? '')
    const giorno = giornoDa(campo(item, 'pubDate') ?? campo(item, 'dc:date'))
    if (!titolo || !/^https?:\/\//.test(url) || !giorno) return []
    const riassunto = riassuntoBreve(testoPulito(campo(item, 'description') ?? ''))
    if (feed.soloSePertinenti && !REGOLE.some(([, re]) => re.test(`${titolo} ${riassunto ?? ''}`))) return []
    return [{ id: idDa(url), titolo, tema: temaDaTesto(`${titolo} ${riassunto ?? ''}`, feed.tema), fonte: feed.fonte, url, giorno, riassunto: riassunto !== titolo ? riassunto : undefined }]
  })
}

/** Unisce, toglie i doppioni (stesso link o stesso titolo), tiene gli ultimi `giorni` giorni e al massimo `perTema` notizie per tema al giorno. */
export function scegliNotizie(tutte: NotiziaFeed[], oggi: string, giorni = 14, perTema = 4): NotiziaFeed[] {
  const limite = new Date(Date.parse(`${oggi}T12:00:00Z`) - giorni * 86_400_000).toISOString().slice(0, 10)
  const visti = new Set<string>()
  const conta = new Map<string, number>()
  return [...tutte].sort((a, b) => b.giorno.localeCompare(a.giorno)).filter((n) => {
    const chiave = n.titolo.toLowerCase().replace(/[^a-z0-9à-ù]+/g, ' ').trim()
    if (n.giorno < limite || n.giorno > oggi || visti.has(n.id) || visti.has(chiave)) return false
    visti.add(n.id); visti.add(chiave)
    const k = `${n.tema}:${n.giorno}`
    conta.set(k, (conta.get(k) ?? 0) + 1)
    return conta.get(k)! <= perTema
  })
}

import { giorniNelMese } from '../../nucleo/calendario'
import { meseDelNome, normalizza } from '../turni/importaPdf'

/**
 * Lettura dei programmi di lezioni e riunioni: tabelle con data, argomento ed eventualmente sede e responsabile.
 * Logica pura: l'utente conferma sempre prima che le voci vengano salvate.
 */
export interface VoceProgramma { giorno: string; titolo: string; sede?: string; responsabile?: string; minuto?: number }

const DATA = /(?:^|[^\d/])(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?(?![\d/])/
const ORA = /\b(?:ore\s*|h\s*)?(\d{1,2})[:.](\d{2})\b/
const MESI_TESTO = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const DATA_TESTO = new RegExp(`\\b(\\d{1,2})\\s+(${MESI_TESTO.join('|')})[a-z]*\\.?(?:\\s+(\\d{4}))?`)
const COLONNE = {
  data: /^(data|giorno|quando)/, titolo: /^(argomento|titolo|tema|lezione|riunione|contenuto)/,
  sede: /^(sede|aula|luogo|dove)/, responsabile: /^(responsabil|relator|docent|a cura)/,
}

function colonneDa(riga: string[]) {
  const trova = (r: RegExp) => { const i = riga.findIndex((c) => r.test(normalizza(c))); return i < 0 ? undefined : i }
  const c = { data: trova(COLONNE.data), titolo: trova(COLONNE.titolo), sede: trova(COLONNE.sede), responsabile: trova(COLONNE.responsabile) }
  return c.data !== undefined && c.titolo !== undefined ? c : undefined
}

function dataDa(testo: string, annoPredefinito: number): { anno: number; mese: number; giorno: number; resto: string } | undefined {
  const t = normalizza(testo)
  const m = t.match(DATA)
  const n = t.match(DATA_TESTO)
  const giorno = Number(m?.[1] ?? n?.[1]), mese = m ? Number(m[2]) : n ? MESI_TESTO.indexOf(n[2]!) + 1 : 0
  const a = m?.[3] ?? n?.[3]
  const anno = a ? (a.length === 2 ? 2000 + Number(a) : Number(a)) : annoPredefinito
  if (!mese || mese > 12 || !giorno || giorno > giorniNelMese(anno, mese)) return undefined
  return { anno, mese, giorno, resto: t.replace(m?.[0] ?? n?.[0] ?? '', ' ') }
}

/** Voci del programma trovate nelle righe. L'anno viene dal testo, dal nome del file o da `annoPredefinito`. */
export function leggiProgramma(righe: string[][], nomeFile: string, annoPredefinito: number): VoceProgramma[] {
  const interoTesto = righe.flat().join(' ')
  const anno = Number((meseDelNome(interoTesto) ?? meseDelNome(nomeFile))?.slice(0, 4)) || annoPredefinito
  const voci: VoceProgramma[] = []
  let colonne: ReturnType<typeof colonneDa>
  for (const riga of righe) {
    const celle = riga.map((c) => c.replace(/\s+/g, ' ').trim())
    const intestazione = colonneDa(celle)
    if (intestazione) { colonne = intestazione; continue }
    const posData = colonne?.data ?? celle.findIndex((c) => dataDa(c, anno))
    const data = posData >= 0 && celle[posData] ? dataDa(celle[posData]!, anno) : undefined
    if (!data) continue
    const ora = data.resto.match(ORA)
    const altre = celle.filter((c, i) => i !== posData && c)
    const titolo = (colonne ? celle[colonne.titolo!] : [...altre].sort((a, b) => b.length - a.length)[0]) ?? ''
    if (!titolo) continue
    const cella = (i?: number) => (i !== undefined && celle[i]) || undefined
    voci.push({
      giorno: `${data.anno}-${String(data.mese).padStart(2, '0')}-${String(data.giorno).padStart(2, '0')}`, titolo,
      sede: cella(colonne?.sede), responsabile: cella(colonne?.responsabile),
      ...(ora ? { minuto: Number(ora[1]) * 60 + Number(ora[2]) } : {}),
    })
  }
  return voci
}

const ENTITA: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const testoXml = (xml: string) => [...xml.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]!).join('')
  .replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITA[e]!)

/** Righe di un documento Word: il testo fuori dalle tabelle in una cella sola, poi una riga per ogni riga di tabella. */
export function righeDaDocx(xml: string): string[][] {
  const [prima, ...tabella] = xml.split(/<w:tr[ >]/)
  const righe = tabella.map((r) => r.split('</w:tr>')[0]!.split(/<w:tc[ >]/).slice(1).map((c) => c.split(/<\/w:p>/).map(testoXml).filter(Boolean).join(' ')))
  return [[testoXml(prima ?? '')], ...righe]
}

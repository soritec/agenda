import type { Abitudine } from '../../dati/modello'
import { chiaveGiorno, giornoDaChiave } from '../turni/supporto'

/** Colori neutri della palette (tenui, mai accesi). */
export const COLORI_ABITUDINE = ['#6F8F80', '#7D8DA0', '#A38B6B', '#94808E', '#8B8A76', '#A67F6D', '#6F7F86', '#8A84A0']

export const piuGiorni = (giorno: string, n: number) => {
  const g = giornoDaChiave(giorno)!
  const d = new Date(Date.UTC(g.anno, g.mese - 1, g.giorno + n))
  return chiaveGiorno({ anno: d.getUTCFullYear(), mese: d.getUTCMonth() + 1, giorno: d.getUTCDate() })
}
export const lunediDi = (giorno: string) => { const g = giornoDaChiave(giorno)!; const dow = (new Date(Date.UTC(g.anno, g.mese - 1, g.giorno)).getUTCDay() + 6) % 7; return piuGiorni(giorno, -dow) }
export const idSegno = (abitudineId: string, giorno: string) => `${abitudineId}:${giorno}`

/**
 * Serie: giorni di fila in cui l'abitudine è stata fatta, contando all'indietro da oggi
 * (se oggi non è ancora segnata, da ieri). I giorni protetti (guardia, smonto) non rompono la serie e non contano.
 */
export function serieGiornaliera(fatti: Set<string>, oggi: string, protetti: Set<string>): number {
  let g = fatti.has(oggi) ? oggi : piuGiorni(oggi, -1)
  let n = 0
  for (let i = 0; i < 3660; i++) {
    if (fatti.has(g)) n++
    else if (!protetti.has(g)) break
    g = piuGiorni(g, -1)
  }
  return n
}

/** Volte nella settimana del giorno dato. */
export function volteNellaSettimana(fatti: Set<string>, giorno: string): number {
  const l = lunediDi(giorno)
  let n = 0
  for (let i = 0; i < 7; i++) if (fatti.has(piuGiorni(l, i))) n++
  return n
}

/** Serie in settimane per le abitudini "n volte a settimana": settimane di fila con l'obiettivo raggiunto (quella in corso conta solo se già raggiunto). */
export function serieSettimanale(fatti: Set<string>, oggi: string, volte: number): number {
  let l = lunediDi(oggi)
  let n = volteNellaSettimana(fatti, l) >= volte ? 1 : 0
  l = piuGiorni(l, -7)
  for (let i = 0; i < 520 && volteNellaSettimana(fatti, l) >= volte; i++) { n++; l = piuGiorni(l, -7) }
  return n
}

/** Percentuale del mese fino a oggi: giorni fatti / giorni utili (esclusi i protetti); per le settimanali, rispetto all'obiettivo. */
export function percentualeMese(a: Pick<Abitudine, 'volteSettimana'>, fatti: Set<string>, mese: string, oggi: string, protetti: Set<string>): number | undefined {
  const giorni: string[] = []
  for (let g = `${mese}-01`; g.startsWith(mese) && g <= oggi; g = piuGiorni(g, 1)) giorni.push(g)
  if (!giorni.length) return undefined
  const fattiMese = giorni.filter((g) => fatti.has(g)).length
  if (a.volteSettimana) {
    const atteso = Math.max(1, Math.round((giorni.length / 7) * a.volteSettimana))
    return Math.min(100, Math.round((fattiMese / atteso) * 100))
  }
  const utili = giorni.filter((g) => !protetti.has(g) || fatti.has(g)).length
  return utili ? Math.round((fattiMese / utili) * 100) : undefined
}

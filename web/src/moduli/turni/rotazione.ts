/**
 * Rotazione della specializzazione: ogni anno 6 mesi in Ginecologia e 6 in Ostetricia.
 * L'utente indica l'area di un mese (un'"ancora"): da quel mese partono 6 mesi di quell'area,
 * poi l'area si alterna ogni 6 mesi, in avanti e all'indietro, finché un'altra ancora non la cambia.
 */

export const AREE_ROTAZIONE = ['ginecologia', 'ostetricia'] as const
export type AreaRotazione = (typeof AREE_ROTAZIONE)[number]
export const TITOLI_AREA: Record<AreaRotazione, string> = { ginecologia: 'Ginecologia', ostetricia: 'Ostetricia' }
export const MESI_PER_ROTAZIONE = 6

export interface Ancora {
  /** "2026-10" */
  meseInizio: string
  area: AreaRotazione
}

export interface AreaDelMese {
  area: AreaRotazione
  /** 1–6: mese della rotazione in corso. */
  meseDellaRotazione: number
  /** Vero se il mese è proprio quello in cui l'utente ha scelto l'area. */
  scelto: boolean
}

const indice = (anno: number, mese: number) => anno * 12 + (mese - 1)

function indiceDa(meseInizio: string): number | undefined {
  const m = meseInizio.match(/^(\d{4})-(\d{2})$/)
  return m ? indice(Number(m[1]), Number(m[2])) : undefined
}

const altra = (a: AreaRotazione): AreaRotazione => (a === 'ginecologia' ? 'ostetricia' : 'ginecologia')

export function areaDelMese(ancore: Ancora[], anno: number, mese: number): AreaDelMese | undefined {
  const valide = ancore
    .map((a) => ({ ...a, i: indiceDa(a.meseInizio) }))
    .filter((a): a is Ancora & { i: number } => a.i !== undefined)
    .sort((a, b) => a.i - b.i)
  if (valide.length === 0) return undefined
  const obiettivo = indice(anno, mese)
  // L'ancora più recente non successiva al mese; prima della prima ancora si estende all'indietro.
  const ancora = [...valide].reverse().find((a) => a.i <= obiettivo) ?? valide[0]!
  const differenza = obiettivo - ancora.i
  const blocco = Math.floor(differenza / MESI_PER_ROTAZIONE)
  return {
    area: blocco % 2 === 0 ? ancora.area : altra(ancora.area),
    meseDellaRotazione: (((differenza % MESI_PER_ROTAZIONE) + MESI_PER_ROTAZIONE) % MESI_PER_ROTAZIONE) + 1,
    scelto: differenza === 0,
  }
}

/**
 * Ospedale di assegnazione: da un mese, per un certo numero di mesi, i turni senza sede propria
 * si considerano in quella sede. Se due periodi si sovrappongono vale quello iniziato più tardi.
 */
export interface PeriodoAssegnazione {
  meseInizio: string
  mesi: number
  sedeId: string
}

const indice = (anno: number, mese: number) => anno * 12 + (mese - 1)

export function indiceMese(meseInizio: string): number | undefined {
  const m = meseInizio.match(/^(\d{4})-(\d{2})$/)
  return m ? indice(Number(m[1]), Number(m[2])) : undefined
}

export interface AssegnazioneDelMese<T extends PeriodoAssegnazione> {
  periodo: T
  /** 1…mesi */
  meseDelPeriodo: number
}

export function assegnazioneDelMese<T extends PeriodoAssegnazione>(periodi: T[], anno: number, mese: number): AssegnazioneDelMese<T> | undefined {
  const obiettivo = indice(anno, mese)
  let migliore: { periodo: T; inizio: number } | undefined
  for (const p of periodi) {
    const inizio = indiceMese(p.meseInizio)
    if (inizio === undefined || p.mesi < 1) continue
    if (obiettivo >= inizio && obiettivo < inizio + p.mesi && (!migliore || inizio > migliore.inizio)) migliore = { periodo: p, inizio }
  }
  return migliore ? { periodo: migliore.periodo, meseDelPeriodo: obiettivo - migliore.inizio + 1 } : undefined
}

/** "2027-03" = ultimo mese del periodo. */
export function ultimoMese(p: PeriodoAssegnazione): string {
  const i = (indiceMese(p.meseInizio) ?? 0) + p.mesi - 1
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

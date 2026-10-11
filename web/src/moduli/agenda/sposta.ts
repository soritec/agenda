import { componenti, istante } from '../../nucleo/calendario'
import type { Turno } from '../../dati/modello'
import { giornoDaChiave } from '../turni/supporto'

/** Dove è stato lasciato un elemento trascinato: un giorno e, nella griglia oraria, un minuto. */
export interface Destinazione {
  giorno: string
  minuto?: number
}

/** Giorni da `da` ad `a` sul calendario (negativo se `a` viene prima). */
export function differenzaGiorni(da: string, a: string): number {
  const x = giornoDaChiave(da)!, y = giornoDaChiave(a)!
  return Math.round((Date.UTC(y.anno, y.mese - 1, y.giorno) - Date.UTC(x.anno, x.mese - 1, x.giorno)) / 86_400_000)
}

/** Giorno + n giorni. */
export function piuGiorniData(giorno: string, n: number): string {
  const g = giornoDaChiave(giorno)!
  const d = new Date(Date.UTC(g.anno, g.mese - 1, g.giorno + n))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * Turno spostato: nel nuovo giorno alla stessa ora (o all'ora della griglia), con la stessa durata.
 * L'ora resta quella italiana anche al cambio dell'ora legale; i turni di tutto il giorno restano da mezzanotte a mezzanotte.
 */
export function turnoSpostato(t: Turno, dest: Destinazione): Pick<Turno, 'inizio' | 'fine'> {
  const g = giornoDaChiave(dest.giorno)!
  if (t.tuttoIlGiorno) return { inizio: istante(g.anno, g.mese, g.giorno), fine: istante(g.anno, g.mese, g.giorno + 1) }
  const c = componenti(t.inizio)
  const minuto = dest.minuto ?? c.ora * 60 + c.minuto
  const inizio = istante(g.anno, g.mese, g.giorno, Math.floor(minuto / 60), minuto % 60)
  // La durata si misura in ore "da orologio": una notte 20–8 resta 20–8 anche quando cambia l'ora.
  const f = componenti(t.fine)
  const giorniDopo = differenzaGiorni(`${c.anno}-${String(c.mese).padStart(2, '0')}-${String(c.giorno).padStart(2, '0')}`, `${f.anno}-${String(f.mese).padStart(2, '0')}-${String(f.giorno).padStart(2, '0')}`)
  if (dest.minuto === undefined) {
    const fineG = giornoDaChiave(piuGiorniData(dest.giorno, giorniDopo))!
    return { inizio, fine: istante(fineG.anno, fineG.mese, fineG.giorno, f.ora, f.minuto) }
  }
  return { inizio, fine: inizio + (t.fine - t.inizio) }
}

import { aggiungiGiorni, inizioGiorno, istante, type GiornoCivile } from '../../nucleo/calendario'

export const MINUTI_IN_UN_GIORNO = 24 * 60

/**
 * Inizio e fine di un turno che comincia nel giorno indicato, dati gli orari di un modello
 * (minuti dalla mezzanotte). Se la fine non è dopo l'inizio il turno finisce il giorno dopo;
 * orari uguali = turno di 24 ore.
 */
export function intervallo(giorno: GiornoCivile, minutoInizio: number, minutoFine: number): { inizio: number; fine: number } {
  for (const m of [minutoInizio, minutoFine]) {
    if (!Number.isInteger(m) || m < 0 || m >= MINUTI_IN_UN_GIORNO) throw new RangeError(`Orario non valido: ${m}`)
  }
  const giornoFine = minutoFine <= minutoInizio ? aggiungiGiorni(giorno, 1) : giorno
  return {
    inizio: istante(giorno.anno, giorno.mese, giorno.giorno, Math.floor(minutoInizio / 60), minutoInizio % 60),
    fine: istante(giornoFine.anno, giornoFine.mese, giornoFine.giorno, Math.floor(minutoFine / 60), minutoFine % 60),
  }
}

/** Turno "tutto il giorno": da mezzanotte a mezzanotte (in ora italiana). */
export function intervalloTuttoIlGiorno(giorno: GiornoCivile): { inizio: number; fine: number } {
  return { inizio: inizioGiorno(giorno), fine: inizioGiorno(aggiungiGiorni(giorno, 1)) }
}

/** Un intervallo per ogni giorno selezionato (inserimento multiplo), senza doppioni e in ordine. */
export function intervalli(giorni: GiornoCivile[], minutoInizio: number, minutoFine: number) {
  const chiave = (g: GiornoCivile) => g.anno * 10_000 + g.mese * 100 + g.giorno
  const distinti = new Map(giorni.map((g) => [chiave(g), g]))
  return [...distinti.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, g]) => intervallo(g, minutoInizio, minutoFine))
}

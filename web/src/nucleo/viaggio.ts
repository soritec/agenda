/**
 * Mappe: link a Google Maps con il percorso in auto (il traffico in tempo reale lo mostra Google Maps).
 * Il calcolo automatico dei tempi con il traffico richiederebbe una chiave a pagamento di Google.
 */

/** Indirizzo della pagina di Google Maps con il percorso in auto (senza origine = dalla posizione attuale). */
export function linkGoogleMaps(destinazione: string, origine?: string): string {
  const p = new URLSearchParams({ api: '1', destination: destinazione, travelmode: 'driving' })
  if (origine) p.set('origin', origine)
  return `https://www.google.com/maps/dir/?${p}`
}

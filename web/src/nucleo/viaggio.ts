/**
 * Tempi di viaggio e mappe.
 * - Calcolo automatico: OpenStreetMap (Nominatim per trovare l'indirizzo, OSRM per il percorso in auto).
 *   È gratuito e senza chiavi; Google calcola i tempi solo con una chiave a pagamento.
 *   Il tempo è senza traffico: è una stima.
 * - Navigazione: link a Google Maps, che si apre nell'app Maps del telefono.
 */

export interface Coordinate {
  lat: number
  lon: number
}

export interface Percorso {
  minuti: number
  km: number
}

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const OSRM = 'https://router.project-osrm.org/route/v1/driving'

/** Indirizzo della pagina di Google Maps con il percorso in auto (senza origine = dalla posizione attuale). */
export function linkGoogleMaps(destinazione: string, origine?: string): string {
  const p = new URLSearchParams({ api: '1', destination: destinazione, travelmode: 'driving' })
  if (origine) p.set('origin', origine)
  return `https://www.google.com/maps/dir/?${p}`
}

export function leggiGeocodifica(risposta: unknown): Coordinate | undefined {
  const primo = Array.isArray(risposta) ? (risposta[0] as { lat?: string; lon?: string } | undefined) : undefined
  const lat = Number(primo?.lat), lon = Number(primo?.lon)
  return Number.isFinite(lat) && Number.isFinite(lon) && primo ? { lat, lon } : undefined
}

export function leggiPercorso(risposta: unknown): Percorso | undefined {
  const r = (risposta as { routes?: { duration?: number; distance?: number }[] } | undefined)?.routes?.[0]
  if (r?.duration === undefined || r.distance === undefined) return undefined
  return { minuti: Math.max(1, Math.round(r.duration / 60)), km: Math.round(r.distance / 100) / 10 }
}

export async function geocodifica(indirizzo: string): Promise<Coordinate | undefined> {
  const p = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'it', 'accept-language': 'it', q: indirizzo })
  const risposta = await fetch(`${NOMINATIM}?${p}`)
  if (!risposta.ok) throw new Error('Servizio mappe non disponibile')
  return leggiGeocodifica(await risposta.json())
}

export async function percorsoInAuto(da: Coordinate, a: Coordinate): Promise<Percorso | undefined> {
  const risposta = await fetch(`${OSRM}/${da.lon},${da.lat};${a.lon},${a.lat}?overview=false`)
  if (!risposta.ok) throw new Error('Servizio percorsi non disponibile')
  return leggiPercorso(await risposta.json())
}

export function posizioneAttuale(): Promise<Coordinate> {
  return new Promise((ok, errore) => {
    if (!navigator.geolocation) return errore(new Error('Posizione non disponibile su questo dispositivo'))
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => errore(new Error('Permesso per la posizione negato')),
      { enableHighAccuracy: false, timeout: 15_000 },
    )
  })
}

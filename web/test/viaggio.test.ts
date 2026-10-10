import { describe, expect, test } from 'vitest'
import { leggiGeocodifica, leggiPercorso, linkGoogleMaps } from '../src/nucleo/viaggio'

describe('Viaggio e mappe', () => {
  test('link a Google Maps', () => {
    expect(linkGoogleMaps('Via Roma 1, Milano')).toBe('https://www.google.com/maps/dir/?api=1&destination=Via+Roma+1%2C+Milano&travelmode=driving')
    expect(linkGoogleMaps('Ospedale', 'Casa 2')).toContain('&origin=Casa+2')
  })
  test('risposte dei servizi', () => {
    expect(leggiGeocodifica([{ lat: '45.58', lon: '9.27' }])).toEqual({ lat: 45.58, lon: 9.27 })
    expect(leggiGeocodifica([])).toBeUndefined()
    expect(leggiPercorso({ routes: [{ duration: 1530, distance: 23_456 }] })).toEqual({ minuti: 26, km: 23.5 })
    expect(leggiPercorso({ routes: [] })).toBeUndefined()
  })
})

import { describe, expect, test } from 'vitest'
import { linkGoogleMaps } from '../src/nucleo/viaggio'

describe('Mappe', () => {
  test('link a Google Maps', () => {
    expect(linkGoogleMaps('Via Roma 1, Milano')).toBe('https://www.google.com/maps/dir/?api=1&destination=Via+Roma+1%2C+Milano&travelmode=driving')
    expect(linkGoogleMaps('Ospedale', 'Casa 2')).toContain('&origin=Casa+2')
  })
})

import { describe, expect, test } from 'vitest'
import { istante } from '../src/nucleo/calendario'
import { creaIcs, escapeIcs, piega } from '../src/export/ics'

describe('File calendario (.ics)', () => {
  const adesso = Date.UTC(2026, 9, 11, 10, 0, 0)
  const ics = creaIcs([
    { uid: 'n1@agenda', titolo: 'N · Guardia notte', inizio: istante(2026, 10, 21, 20), fine: istante(2026, 10, 22, 8), luogo: 'Ospedale A', modificatoIl: adesso },
    { uid: 'f1@agenda', titolo: 'Ferie', inizio: istante(2026, 10, 24), fine: istante(2026, 10, 25), tuttoIlGiorno: true },
  ], 'Turni', adesso)

  test('struttura e orari in UTC', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('DTSTART:20261021T180000Z') // 20:00 ora italiana (legale) = 18:00 UTC
    expect(ics).toContain('DTEND:20261022T060000Z')
    expect(ics).toContain('UID:n1@agenda')
    expect(ics).toContain('LOCATION:Ospedale A')
    expect(ics).toContain('X-WR-CALNAME:Turni')
  })
  test('giornate intere', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20261024')
    expect(ics).toContain('DTEND;VALUE=DATE:20261025')
  })
  test('caratteri speciali e righe lunghe', () => {
    expect(escapeIcs('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne')
    const lunga = `DESCRIPTION:${'à'.repeat(60)}`
    const piegata = piega(lunga)
    expect(piegata.split('\r\n ').every((p) => new TextEncoder().encode(p).length <= 75)).toBe(true)
    expect(piegata.replace(/\r\n /g, '')).toBe(lunga)
  })
})

import { describe, expect, test } from 'vitest'
import { istante } from '../src/nucleo/calendario'
import { blobCSV, testoCSV, valoreCSV, type TabellaExport } from '../src/export/csv'

describe('CSV', () => {
  const d = istante(2026, 10, 5, 8, 30)
  test('valori', () => {
    expect(valoreCSV({ tipo: 'data', istante: d })).toBe('05/10/2026')
    expect(valoreCSV({ tipo: 'ora', istante: d })).toBe('08:30')
    expect(valoreCSV({ tipo: 'dataOra', istante: d })).toBe('05/10/2026 08:30')
    expect(valoreCSV({ tipo: 'importo', centesimi: 123_450 })).toBe('1234,50')
    expect(valoreCSV({ tipo: 'importo', centesimi: 5 })).toBe('0,05')
    expect(valoreCSV({ tipo: 'importo', centesimi: -1250 })).toBe('-12,50')
    expect(valoreCSV({ tipo: 'ore', minuti: 450 })).toBe('7,5')
    expect(valoreCSV({ tipo: 'ore', minuti: 480 })).toBe('8')
    expect(valoreCSV({ tipo: 'ore', minuti: 600 })).toBe('10')
    expect(valoreCSV({ tipo: 'ore', minuti: 445 })).toBe('7,42')
    expect(valoreCSV({ tipo: 'intero', valore: 3 })).toBe('3')
    expect(valoreCSV({ tipo: 'vuota' })).toBe('')
  })

  test('testo', () => {
    expect(valoreCSV({ tipo: 'testo', valore: 'Sede; Pad. A' })).toBe('"Sede; Pad. A"')
    expect(valoreCSV({ tipo: 'testo', valore: 'detto "Nord"' })).toBe('"detto ""Nord"""')
    expect(valoreCSV({ tipo: 'testo', valore: 'riga\nnuova' })).toBe('"riga\nnuova"')
    expect(valoreCSV({ tipo: 'testo', valore: '=SOMMA(A1)' })).toBe("'=SOMMA(A1)")
    expect(valoreCSV({ tipo: 'testo', valore: 'Reperibilità' })).toBe('Reperibilità')
  })

  test('file completo con BOM', async () => {
    const t: TabellaExport = {
      titolo: 'Turni',
      intestazioni: ['Data', 'Sede', 'Ore'],
      righe: [[{ tipo: 'data', istante: istante(2026, 10, 12) }, { tipo: 'testo', valore: 'Sede A' }, { tipo: 'ore', minuti: 720 }]],
    }
    expect(testoCSV(t)).toBe('Data;Sede;Ore\r\n12/10/2026;Sede A;12\r\n')
    const byte = new Uint8Array(await blobCSV(t).arrayBuffer())
    expect([...byte.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })
})

import { describe, expect, test } from 'vitest'
import { annoDiCorso, conteggi, settimaneValide, TIPI_PROCEDURA_PREDEFINITI } from '../src/moduli/specializzazione/logica'

describe('Specializzazione', () => {
  test('anno di corso dalla data di inizio', () => {
    expect(annoDiCorso('2024-11', '2024-11-03')).toBe(1)
    expect(annoDiCorso('2024-11', '2025-10-31')).toBe(1)
    expect(annoDiCorso('2024-11', '2025-11-01')).toBe(2)
    expect(annoDiCorso('2024-11', '2026-10-10')).toBe(2)
    expect(annoDiCorso('2024-11', '2031-01-01')).toBe(5)
    expect(annoDiCorso('2024-11', '2024-10-01')).toBeUndefined()
    expect(annoDiCorso(undefined, '2026-10-10')).toBeUndefined()
  })

  test('contatori per tipo, ruolo e anno', () => {
    const p = [
      { tipoId: 'tc', ruolo: 'primo', annoCorso: 2 },
      { tipoId: 'tc', ruolo: 'secondo', annoCorso: 2 },
      { tipoId: 'tc', ruolo: 'secondo', annoCorso: 1 },
      { tipoId: 'ps', ruolo: 'osservatore', annoCorso: 1 },
    ]
    const tutti = conteggi(p)
    expect(tutti.totale).toBe(4)
    expect(tutti.perTipo.get('tc')).toEqual({ primo: 1, secondo: 2, osservatore: 0 })
    expect(tutti.perRuolo).toEqual({ primo: 1, secondo: 2, osservatore: 1 })
    expect([...tutti.perAnno.entries()].sort()).toEqual([[1, 2], [2, 2]])
    const secondo = conteggi(p, 2)
    expect(secondo.totale).toBe(2)
    expect(secondo.perTipo.get('ps')).toBeUndefined()
  })

  test('settimane gestazionali', () => {
    expect(settimaneValide('39+2')).toBe(true)
    expect(settimaneValide('12')).toBe(true)
    expect(settimaneValide('39+7')).toBe(false)
    expect(settimaneValide('abc')).toBe(false)
    expect(TIPI_PROCEDURA_PREDEFINITI).toContain('Taglio cesareo')
  })
})

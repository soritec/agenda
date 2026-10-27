import { describe, expect, test } from 'vitest'
import { CATALOGO_SCUOLA, infoMancanti, vociMancanti } from '../src/moduli/turni/catalogoScuola'

describe('Catalogo delle sigle (ginecologia e ostetricia)', () => {
  test('sigle uniche, anche senza maiuscole', () => {
    const sigle = CATALOGO_SCUOLA.map((v) => v.sigla.toLowerCase())
    expect(new Set(sigle).size).toBe(sigle.length)
  })
  test('informazioni solo a chi non le ha, e sigle nuove da aggiungere', () => {
    const modelli = [{ sigla: 'Sop', info: undefined }, { sigla: 'cds', info: 'mia nota' }, { sigla: 'XYZ' }]
    expect(infoMancanti(modelli).map((m) => m.sigla)).toEqual(['Sop'])
    expect(vociMancanti([{ sigla: 'G' }, { sigla: 'aub' }]).some((v) => v.sigla === 'AUB')).toBe(false)
    expect(vociMancanti([]).some((v) => v.sigla === 'VACCINI')).toBe(true)
  })
})

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

describe('testi superati del catalogo', () => {
  test('aggiorna solo i testi vecchi, non quelli scritti a mano', async () => {
    const { INFO_PRIMA, infoSuperate, CATALOGO_SCUOLA } = await import('../src/moduli/turni/catalogoScuola')
    const vecchio = { sigla: 'Rg', info: INFO_PRIMA.Rg![0] }
    const mio = { sigla: 'Rg', info: 'scritto da me' }
    expect(infoSuperate([vecchio, mio])).toEqual([{ sigla: 'Rg', info: CATALOGO_SCUOLA.find((v) => v.sigla === 'Rg')!.info }])
  })
})

describe('orari dei reparti', () => {
  test('cambia solo i reparti con l orario predefinito di prima', async () => {
    const { orariRepartiSuperati } = await import('../src/moduli/turni/catalogoScuola')
    const r = orariRepartiSuperati([
      { sigla: 'Rg', minutoInizio: 480, minutoFine: 1080 },
      { sigla: 'R', minutoInizio: 480, minutoFine: 1080 },
      { sigla: 'R', minutoInizio: 420, minutoFine: 1080 },
      { sigla: 'F', minutoInizio: 480, minutoFine: 1080 },
    ])
    expect(r).toEqual([{ sigla: 'Rg', minutoInizio: 420, minutoFine: 1140 }, { sigla: 'R', minutoInizio: 465, minutoFine: 1080 }])
  })
})

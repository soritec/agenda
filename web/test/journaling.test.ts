import { describe, expect, test } from 'vitest'
import { cerca, impronta, nuovoSale, testoSemplice, testoSu, umoriDelMese, unAnnoFa } from '../src/moduli/journaling/logica'

const b = { creatoIl: 0, taccuinoId: 't' }
const p = (id: string, giorno: string, extra: Record<string, unknown> = {}) => ({ ...b, id, giorno, titolo: id, testo: '', modificatoIl: 1, ...extra })

describe('Journaling', () => {
  test('testo semplice da HTML', () => {
    expect(testoSemplice('<h3>Titolo</h3><p>Ciao <b>tu</b> &amp; io</p><ul class="lista-spunta"><li class="fatto">uno</li><li>due</li></ul><ul><li>a</li></ul>'))
      .toBe('Titolo\nCiao tu & io\n\n☑ uno\n☐ due\n\n• a')
  })

  test('umore del mese, un anno fa, ricerca', () => {
    const pagine = [
      p('a', '2026-10-03', { umore: 'bene', modificatoIl: 1 }), p('b', '2026-10-03', { umore: 'pesante', modificatoIl: 5 }),
      p('c', '2026-09-30', { umore: 'cosi' }), p('d', '2025-10-11', { titolo: 'Primo giorno', testo: '<p>Specializzazione iniziata</p>', etichette: ['università'] }),
    ]
    expect([...umoriDelMese(pagine, '2026-10')]).toEqual([['2026-10-03', 'pesante']])
    expect(unAnnoFa(pagine, '2026-10-11').map((x) => x.id)).toEqual(['d'])
    expect(cerca(pagine, 'specializzazione UNIVERSITA').map((x) => x.id)).toEqual(['d'])
    expect(cerca(pagine, '   ')).toEqual([])
  })

  test('lucchetto e colori di copertina', async () => {
    const sale = nuovoSale()
    expect(sale).toHaveLength(32)
    expect(await impronta('1234', sale)).toBe(await impronta('1234', sale))
    expect(await impronta('1234', sale)).not.toBe(await impronta('1235', sale))
    expect(testoSu('#2F4560')).toBe('#FFFFFF')
    expect(testoSu('#F6EEDF')).toBe('#2A2622')
  })
})

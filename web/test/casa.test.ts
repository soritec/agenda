import { describe, expect, test } from 'vitest'
import type { Bolletta, Candidata, PagamentoCasa, Stanza } from '../src/dati/modello'
import { bolletteDelMese, contiMese, fineMese, giornoDopo, giorniMancanti, idPagamento, occupante, ordinaCandidate, passaggioDiStanza, quotaPropria } from '../src/moduli/casa/logica'
import { impegniTra } from '../src/moduli/agenda/impegni'
import { istante } from '../src/nucleo/calendario'

const b = { creatoIl: 0, modificatoIl: 0 }
const stanza = (id: string, x: Partial<Stanza> = {}): Stanza => ({ ...b, id, nome: id, affittoCent: 0, colore: '#000', ordine: 0, ...x })
const mia = stanza('io', { propria: true, nome: '' })
const s1 = stanza('A', { affittoCent: 85000 })
const s2 = stanza('B', { affittoCent: 90000 })

describe('Casa', () => {
  test('la propria stanza paga il resto dell\'affitto', () => {
    expect(quotaPropria({ affittoTotaleCent: 255000 }, [mia, s1, s2])).toBe(80000)
  })

  test('bills del mese con importo diverso solo per quel mese', () => {
    const bills: Bolletta[] = [
      { ...b, id: 'w', nome: 'Water', importoCent: 3900, giorno: 20, colore: '', icona: 'acqua', ordine: 1 },
      { ...b, id: 'e', nome: 'Electricity', importoCent: 7000, giorno: 5, colore: '', icona: 'luce', ordine: 0 },
    ]
    const p: PagamentoCasa = { ...b, id: idPagamento('bolletta', 'e', '2026-10'), tipo: 'bolletta', riferimentoId: 'e', mese: '2026-10', importoCent: 7800, fatto: true }
    const ottobre = bolletteDelMese(bills, new Map([[p.id, p]]), '2026-10')
    expect(ottobre.map((x) => [x.b.nome, x.importoCent, x.pagata])).toEqual([['Electricity', 7800, true], ['Water', 3900, false]])
    expect(bolletteDelMese(bills, new Map([[p.id, p]]), '2026-11')[0]!.importoCent).toBe(7000)
  })

  test('conguaglio rispetto ai 150 a testa', () => {
    // 405 di bills in 3 = 135 a testa: avanzano 15 da restituire a ognuna.
    expect(contiMese([{ importoCent: 40500 }], [mia, s1, s2], 15000)).toEqual({ totaleCent: 40500, persone: 3, quotaCent: 13500, versatoCent: 15000, differenzaCent: 1500 })
    // 480 in 3 = 160: ognuna deve ancora 10.
    expect(contiMese([{ importoCent: 48000 }], [mia, s1, s2], 15000).differenzaCent).toBe(-1000)
  })

  test('partenze e arrivi', () => {
    expect(fineMese('2026-02')).toBe('2026-02-28')
    expect(giornoDopo('2026-11-30')).toBe('2026-12-01')
    expect(giorniMancanti('2026-10-13', '2026-11-30')).toBe(48)
    const conProssima = stanza('B', { nome: 'Vecchia', esceIl: '2026-11-30', prossima: { nome: 'Nuova', dal: '2026-12-01' } })
    expect(occupante(conProssima, '2026-11-30')).toBe('Vecchia')
    expect(occupante(conProssima, '2026-12-31')).toBe('Nuova')
    expect(passaggioDiStanza(conProssima, '2026-11-30')).toBeUndefined()
    const dopo = passaggioDiStanza(conProssima, '2026-12-01')!
    expect([dopo.nome, dopo.dal, dopo.esceIl, dopo.prossima]).toEqual(['Nuova', '2026-12-01', undefined, undefined])
  })

  test('candidate in ordine e viewing in agenda', () => {
    const c = (id: string, valutazione: string, viewing?: number): Candidata => ({ ...b, id, nome: id, valutazione, stato: 'fissata', viewing })
    const v = istante(2026, 10, 16, 18, 30)
    expect(ordinaCandidate([c('no', 'no'), c('forse', 'forse'), c('buono', 'buono')]).map((x) => x.id)).toEqual(['buono', 'forse', 'no'])
    const impegni = impegniTra({ candidate: [c('Sofia', 'buono', v), c('Mia', 'no', v)], stanze: [stanza('B', { nome: 'Priya', esceIl: '2026-10-30' })] }, '2026-10-01', '2026-10-31')
    expect(impegni.map((i) => [i.giorno, i.titolo, i.minutoInizio])).toEqual([['2026-10-16', 'Viewing: Sofia', 1110], ['2026-10-30', 'Se ne va Priya', undefined]])
  })
})

describe('Cambio euro/sterline', () => {
  test('converte e legge il cambio scritto a mano', async () => {
    const { converti, cambioDaTesto, testoCambio } = await import('../src/moduli/budget/cambio')
    expect(converti(150000, 0.8446)).toBe(126690)
    expect(cambioDaTesto('0,86')).toBe(0.86)
    expect(cambioDaTesto('x')).toBeUndefined()
    expect(testoCambio(0.84463)).toBe('0,8446')
  })
})

describe('Casa nel Budget', () => {
  test('affitto, bills, quote delle coinquiline e conguaglio', async () => {
    const { vociCasaDelMese } = await import('../src/moduli/casa/logica')
    const casa = { ...b, id: 'casa', affittoTotaleCent: 255000, quotaBolletteCent: 15000, giornoAffitto: 1 }
    const bollette: Bolletta[] = [{ ...b, id: 'w', nome: 'Water', importoCent: 40500, giorno: 20, colore: '', icona: 'acqua', ordine: 0 }]
    const pagamenti: PagamentoCasa[] = [{ ...b, id: idPagamento('affitto', 'A', '2026-10'), tipo: 'affitto', riferimentoId: 'A', mese: '2026-10', fatto: true }]
    const voci = vociCasaDelMese({ casa, stanze: [mia, s1, s2], bollette, pagamenti }, '2026-10', { uscita: 'u', entrata: 'e' })
    expect(voci.map((v) => [v.tipo, v.titolo, v.importoCent, v.giorno, Boolean(v.daIncassare)])).toEqual([
      ['uscita', 'Affitto', 255000, '2026-10-01', false],
      ['uscita', 'Water', 40500, '2026-10-20', false],
      ['entrata', 'Affitto e bills da A', 100000, '2026-10-01', false],
      ['uscita', 'Conguaglio bills a A', 1500, '2026-10-31', false],
      ['entrata', 'Affitto e bills da B', 105000, '2026-10-01', true],
      ['uscita', 'Conguaglio bills a B', 1500, '2026-10-31', false],
    ])
  })
})

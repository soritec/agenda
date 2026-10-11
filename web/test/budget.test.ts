import { describe, expect, test } from 'vitest'
import { istante } from '../src/nucleo/calendario'
import type { CategoriaBudget, Movimento, Ricorrente, Tassa, Turno } from '../src/dati/modello'
import {
  CATEGORIE_PREDEFINITE, centesimiDa, giornoNelMese, idPredefinita, leggiMovimentoVeloce, prossimeScadenze, riepilogo, spostaMese, vociDelMese,
} from '../src/moduli/budget/logica'

const b = { creatoIl: 0, modificatoIl: 0 }
const categorie: CategoriaBudget[] = CATEGORIE_PREDEFINITE.map((c, i) => ({ ...b, ...c, id: idPredefinita(c.nome), ordine: i }))
const id = (nome: string) => idPredefinita(nome)

describe('Budget', () => {
  test('importi scritti a mano', () => {
    expect(centesimiDa('45')).toBe(4500)
    expect(centesimiDa('45,5')).toBe(4550)
    expect(centesimiDa('1.234,56')).toBe(123456)
    expect(centesimiDa('1.200')).toBe(120000)
    expect(centesimiDa('12.5')).toBe(1250)
    expect(centesimiDa('0')).toBeUndefined()
    expect(centesimiDa('abc')).toBeUndefined()
  })

  test('aggiunta veloce', () => {
    expect(leggiMovimentoVeloce('Spesa 45', categorie)).toMatchObject({ importoCent: 4500, categoria: { nome: 'Spesa' } })
    expect(leggiMovimentoVeloce('Sostituzione 180', categorie)).toMatchObject({ importoCent: 18000, categoria: { nome: 'Sostituzioni MMG' } })
    expect(leggiMovimentoVeloce('32,90 farmacia', categorie)).toEqual({ importoCent: 3290, categoria: undefined, nota: 'farmacia' })
    expect(leggiMovimentoVeloce('Libri Williams 120', categorie)).toMatchObject({ importoCent: 12000, categoria: { nome: 'Libri' }, nota: 'Williams' })
    expect(idPredefinita('Ordine e ENPAM')).toBe('predefinita-ordine-e-enpam')
  })

  test('ricorrenti mensili e annuali', () => {
    const affitto: Ricorrente = { ...b, id: 'r1', tipo: 'uscita', importoCent: 60000, categoriaId: id('Casa'), descrizione: 'Affitto', frequenza: 'mese', inizio: '2026-01-31', saltati: ['2026-03'] }
    expect(giornoNelMese(affitto, '2026-02')).toBe('2026-02-28')
    expect(giornoNelMese(affitto, '2026-03')).toBeUndefined()
    expect(giornoNelMese(affitto, '2025-12')).toBeUndefined()
    const ordine: Ricorrente = { ...affitto, id: 'r2', frequenza: 'anno', inizio: '2026-01-31', fine: '2027-12', saltati: undefined }
    expect(giornoNelMese(ordine, '2027-01')).toBe('2027-01-31')
    expect(giornoNelMese(ordine, '2027-02')).toBeUndefined()
    expect(giornoNelMese(ordine, '2028-01')).toBeUndefined()
    expect(spostaMese('2026-12', 1)).toBe('2027-01')
    expect(spostaMese('2026-01', -1)).toBe('2025-12')
  })

  test('riepilogo del mese con turni, tasse, da incassare e tetti', () => {
    const movimenti: Movimento[] = [
      { ...b, id: 'm1', tipo: 'uscita', importoCent: 4500, giorno: '2026-10-05', categoriaId: id('Spesa') },
      { ...b, id: 'm2', tipo: 'uscita', importoCent: 20000, giorno: '2026-10-08', categoriaId: id('Svago') },
      { ...b, id: 'm3', tipo: 'entrata', importoCent: 7000, giorno: '2026-10-03', categoriaId: id('Libera professione'), daIncassare: true },
      { ...b, id: 'm4', tipo: 'uscita', importoCent: 9900, giorno: '2026-10-25', categoriaId: id('Abbonamenti') },
    ]
    const ricorrenti: Ricorrente[] = [{ ...b, id: 'r1', tipo: 'entrata', importoCent: 165000, categoriaId: id('Stipendio'), descrizione: 'Stipendio', frequenza: 'mese', inizio: '2026-01-10' }]
    const turni: Turno[] = [
      { ...b, id: 't1', inizio: istante(2026, 10, 10, 8), fine: istante(2026, 10, 10, 20), tipo: 'sostituzioneMMG', stato: 'pagato', compensoCent: 18000, origine: 'manuale' },
      { ...b, id: 't2', inizio: istante(2026, 10, 14, 8), fine: istante(2026, 10, 14, 20), tipo: 'sostituzioneMMG', stato: 'svolto', compensoCent: 18000, origine: 'manuale' },
    ]
    const tasse: Tassa[] = [{ ...b, id: 'k1', descrizione: 'Prima rata', importoCent: 78000, scadenza: '2026-10-31', stato: 'pagato', pagatoIl: '2026-10-02' }]
    const cat = categorie.map((c) => (c.nome === 'Svago' ? { ...c, tettoCent: 15000 } : c.nome === 'Salute' ? { ...c, tettoCent: 5000 } : c))
    const r = riepilogo({ categorie: cat, movimenti, ricorrenti, turni, tasse }, '2026-10', '2026-10-15')
    expect(r.entrateCent).toBe(165000 + 18000)
    expect(r.extraCent).toBe(18000)
    expect(r.usciteCent).toBe(4500 + 20000 + 78000)
    expect(r.restoCent).toBe(183000 - 102500)
    expect(r.daIncassare.map((v) => v.chiave).sort()).toEqual(['m:m3', 't:t2'])
    expect(r.perCategoria.map((c) => [c.categoria.nome, c.cent, c.tettoCent])).toEqual([
      ['Tasse universitarie', 78000, undefined], ['Svago', 20000, 15000], ['Spesa', 4500, undefined], ['Salute', 0, 5000],
    ])
    expect(vociDelMese({ categorie: cat, movimenti, ricorrenti }, '2026-10').map((v) => v.chiave)).toContain('r:r1:2026-10')
  })

  test('prossime scadenze', () => {
    const ricorrenti: Ricorrente[] = [{ ...b, id: 'r1', tipo: 'uscita', importoCent: 17000, categoriaId: id('Ordine e ENPAM'), descrizione: 'Ordine dei medici', frequenza: 'anno', inizio: '2026-01-31' }]
    const movimenti: Movimento[] = [{ ...b, id: 'm1', tipo: 'uscita', importoCent: 32000, giorno: '2026-12-15', categoriaId: id('Assicurazione professionale'), nota: 'Assicurazione' }]
    const tasse: Tassa[] = [{ ...b, id: 'k1', descrizione: 'Seconda rata', importoCent: 78000, scadenza: '2026-10-31', stato: 'daPagare' }]
    const s = prossimeScadenze({ categorie, movimenti, ricorrenti, tasse }, '2026-10-11')
    expect(s.map((x) => [x.giorno, x.titolo])).toEqual([['2026-10-31', 'Seconda rata'], ['2026-12-15', 'Assicurazione'], ['2027-01-31', 'Ordine dei medici']])
  })
})

describe('Risparmi', () => {
  test('esclusi da "Ti restano", con totale e obiettivi', async () => {
    const { statoRisparmi } = await import('../src/moduli/budget/logica')
    const movimenti: Movimento[] = [
      { ...b, id: 'e', tipo: 'entrata', importoCent: 200000, giorno: '2026-10-02', categoriaId: id('Stipendio') },
      { ...b, id: 'u', tipo: 'uscita', importoCent: 50000, giorno: '2026-10-03', categoriaId: id('Casa') },
      { ...b, id: 'p', tipo: 'prelievo', importoCent: 40000, giorno: '2026-09-20', categoriaId: 'risparmi' },
      { ...b, id: 'v', tipo: 'risparmio', importoCent: 120000, giorno: '2026-08-01', categoriaId: 'risparmi', obiettivoId: 'o1' },
    ]
    const ricorrenti: Ricorrente[] = [{ ...b, id: 'r', tipo: 'risparmio', importoCent: 20000, categoriaId: 'risparmi', descrizione: '', frequenza: 'mese', inizio: '2026-09-01' }]
    const d = { categorie, movimenti, ricorrenti, obiettivi: [{ ...b, id: 'o1', nome: 'Vacanza', importoCent: 200000, entro: '2027-06' }] }
    const r = riepilogo(d, '2026-10', '2026-10-11')
    expect(r.risparmiatoCent).toBe(20000)
    expect(r.entrateCent - r.usciteCent).toBe(150000)
    expect(r.restoCent).toBe(130000)
    const s = statoRisparmi(d, '2026-10-11')
    expect(s.totaleCent).toBe(120000 + 20000 + 20000 - 40000)
    expect(s.obiettivi[0]).toMatchObject({ raccoltoCent: 120000, mancanoCent: 80000, alMeseCent: 8900 })
    expect(vociDelMese(d, '2026-10').find((v) => v.id === 'r')?.titolo).toBe('Messo da parte')
  })
})

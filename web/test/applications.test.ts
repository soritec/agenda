import { describe, expect, test } from 'vitest'
import type { Application } from '../src/dati/modello'
import { cambiaPassi, fase, leggiValutazioni, ordinaApplications, prossimaScadenza, toccaPasso } from '../src/moduli/applications/logica'
import { impegniTra } from '../src/moduli/agenda/impegni'

const b = { creatoIl: 0, modificatoIl: 0 }
const app = (id: string, x: Partial<Application> = {}): Application => ({ ...b, id, studio: id, programma: 'vacation', passi: ['Inviata', 'Online test', 'Assessment centre', 'Offerta'], fatti: 0, colore: '#000', ...x })

describe('Applications', () => {
  test('un tocco riempie il pallino e quelli prima; ritoccando l\'ultimo si svuota', () => {
    expect(toccaPasso(0, 2)).toBe(3)
    expect(toccaPasso(3, 2)).toBe(2)
    expect(toccaPasso(3, 0)).toBe(1)
  })

  test('fasi, scadenze e ordine', () => {
    expect(fase(app('a'))).toBe('daScrivere')
    expect(fase(app('a', { fatti: 4 }))).toBe('offerta')
    expect(fase(app('a', { fatti: 1, nonPassata: true }))).toBe('nonPassata')
    const ac = app('C', { fatti: 2, datePassi: { 'Assessment centre': { giorno: '2026-10-28', minuto: 570 } } })
    expect(prossimaScadenza(ac)).toEqual({ cosa: 'Assessment centre', giorno: '2026-10-28', minuto: 570 })
    expect(prossimaScadenza(app('R', { rolling: true }))).toBeUndefined()
    const elenco = [app('no', { fatti: 1, nonPassata: true }), app('off', { fatti: 4 }), ac, app('L', { deadline: '2026-10-16' })]
    expect(ordinaApplications(elenco).map((a) => a.id)).toEqual(['L', 'C', 'off', 'no'])
  })

  test('cambiare i passi tiene quelli già fatti', () => {
    const a = app('a', { fatti: 2 })
    expect(cambiaPassi(a, ['Inviata', 'Online test', 'Video interview', 'Assessment centre', 'Offerta'])).toEqual({ passi: ['Inviata', 'Online test', 'Video interview', 'Assessment centre', 'Offerta'], fatti: 2 })
    expect(cambiaPassi(a, ['Inviata', 'Assessment centre', 'Offerta']).fatti).toBe(1)
  })

  test('valutazioni lette dalla risposta di Gemini', () => {
    const t = 'Ecco:\n```json\n{"voti":{"Training":"A*","Perks":"b","Office":"Z"},"tc":"£56,000","nq":150000}\n```'
    expect(leggiValutazioni(t)).toEqual({ voti: { Training: 'A*', Perks: 'B' }, tcCent: 5600000, nqCent: 15000000 })
    expect(leggiValutazioni('niente')).toBeUndefined()
  })

  test('deadline e date dei passi in agenda', () => {
    const a = app('Freshfields', { deadline: '2026-10-16', datePassi: { 'Assessment centre': { giorno: '2026-10-28', minuto: 570 } } })
    expect(impegniTra({ applications: [a] }, '2026-10-01', '2026-10-31').map((i) => [i.giorno, i.titolo, i.minutoInizio]))
      .toEqual([['2026-10-16', 'Deadline: Freshfields', undefined], ['2026-10-28', 'Freshfields: Assessment centre', 570]])
  })
})

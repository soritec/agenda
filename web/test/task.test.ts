import { describe, expect, test } from 'vitest'
import type { Attivita } from '../src/dati/modello'
import { completa, leggiTestoVeloce, prioritaDa, piuGiorni, prossimaScadenza, raggruppa } from '../src/moduli/task/logica'

const base = (id: string, extra: Partial<Attivita> = {}): Attivita => ({ id, creatoIl: 1, modificatoIl: 1, titolo: id, priorita: 'normale', area: 'altro', ...extra })

describe('Task', () => {
  test('scadenze che si ripetono', () => {
    expect(prossimaScadenza('2026-10-31', 'giorno')).toBe('2026-11-01')
    expect(prossimaScadenza('2026-10-25', 'settimana')).toBe('2026-11-01')
    expect(prossimaScadenza('2027-01-31', 'mese')).toBe('2027-02-28')
    expect(prossimaScadenza('2026-12-15', 'mese')).toBe('2027-01-15')
    expect(prossimaScadenza('2028-02-29', 'anno')).toBe('2029-02-28')
    expect(prossimaScadenza('2026-10-10', 'mai')).toBeUndefined()
    expect(piuGiorni('2026-03-28', 2)).toBe('2026-03-30')
  })

  test('completare crea la successiva se si ripete; riaprire la toglie solo dai completati', () => {
    const t = base('rata', { scadenza: '2026-10-10', ripeti: 'mese', passi: [{ testo: 'bonifico', fatto: true }] })
    const r = completa(t, 500)
    expect(r.aggiornato.completataIl).toBe(500)
    expect(r.prossimo).toMatchObject({ titolo: 'rata', scadenza: '2026-11-10', passi: [{ testo: 'bonifico' }] })
    expect(r.prossimo).not.toHaveProperty('id')
    expect(completa(r.aggiornato, 600)).toEqual({ aggiornato: { ...t, completataIl: undefined } })
    expect(completa(base('x'), 1).prossimo).toBeUndefined()
  })

  test('gruppi e ordine', () => {
    const g = raggruppa([
      base('vecchio', { scadenza: '2026-10-01' }), base('oggi-normale', { scadenza: '2026-10-11', minuto: 600 }),
      base('oggi-alta', { scadenza: '2026-10-11', priorita: 'alta' }), base('oggi-bassa', { scadenza: '2026-10-11', priorita: 'bassa' }), base('domani', { scadenza: '2026-10-12' }),
      base('poi', { scadenza: '2026-11-01' }), base('libero'), base('fatto', { completataIl: 5 }),
    ], '2026-10-11')
    expect(g.inRitardo.map((t) => t.id)).toEqual(['vecchio'])
    expect(g.oggi.map((t) => t.id)).toEqual(['oggi-alta', 'oggi-bassa', 'oggi-normale'])
    expect(g.domani.map((t) => t.id)).toEqual(['domani'])
    expect(g.prossimi.map((t) => t.id)).toEqual(['poi'])
    expect(g.senzaData.map((t) => t.id)).toEqual(['libero'])
    expect(g.completati.map((t) => t.id)).toEqual(['fatto'])
  })

  test('inserimento veloce', () => {
    // 11 ottobre 2026 è domenica (7)
    expect(leggiTestoVeloce('Chiamare segreteria domani 9:30 !', '2026-10-11', 7)).toEqual({ titolo: 'Chiamare segreteria', scadenza: '2026-10-12', minuto: 570, priorita: 'alta' })
    expect(leggiTestoVeloce('Pagare la rata venerdì', '2026-10-11', 7)).toMatchObject({ titolo: 'Pagare la rata', scadenza: '2026-10-16' })
    expect(leggiTestoVeloce('Riunione domenica', '2026-10-11', 7).scadenza).toBe('2026-10-18')
    expect(leggiTestoVeloce('Ricetta alle 18', '2026-10-11', 7)).toMatchObject({ titolo: 'Ricetta', scadenza: undefined, minuto: 1080 })
    expect(leggiTestoVeloce('Leggere linee guida', '2026-10-11', 7)).toEqual({ titolo: 'Leggere linee guida', priorita: undefined, scadenza: undefined, minuto: undefined })
    expect(prioritaDa('normale')).toBe('nessuna')
  })
})


describe('Schede dei task', () => {
  test('oggi, programmati e senza data, con i fatti in fondo', async () => {
    const { perScheda } = await import('../src/moduli/task/logica')
    const inizio = 1_000_000_000
    const r = perScheda([
      base('ritardo', { scadenza: '2026-10-09' }),
      base('oggi-b', { scadenza: '2026-10-11', priorita: 'bassa' }), base('oggi-a', { scadenza: '2026-10-11', priorita: 'alta' }),
      base('fatto-oggi', { scadenza: '2026-10-11', completataIl: inizio + 5 }), base('fatto-ieri', { scadenza: '2026-10-10', completataIl: inizio - 5 }),
      base('dom-fatto', { scadenza: '2026-10-12', completataIl: inizio + 1 }), base('dom', { scadenza: '2026-10-12' }), base('ven', { scadenza: '2026-10-16' }),
      base('libero'), base('libero-fatto', { completataIl: inizio - 86_400_000 }), base('libero-vecchio', { completataIl: inizio - 30 * 86_400_000 }),
    ], '2026-10-11', inizio)
    expect(r.oggi.inRitardo.map((t) => t.id)).toEqual(['ritardo'])
    expect(r.oggi.aperti.map((t) => t.id)).toEqual(['oggi-a', 'oggi-b'])
    expect(r.oggi.fatti.map((t) => t.id)).toEqual(['fatto-oggi'])
    expect([...r.programmati].map(([g, l]) => [g, l.map((t) => t.id)])).toEqual([['2026-10-12', ['dom', 'dom-fatto']], ['2026-10-16', ['ven']]])
    expect(r.senzaData.map((t) => t.id)).toEqual(['libero', 'libero-fatto'])
    expect(r.conteggi).toEqual({ oggi: 3, programmati: 2, senzaData: 1 })
  })
})

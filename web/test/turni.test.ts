import { describe, expect, test } from 'vitest'
import { istante } from '../src/nucleo/calendario'
import { avvisi, sovrapposizioni } from '../src/moduli/turni/controlli'
import { intervalli, intervallo } from '../src/moduli/turni/orari'
import { calcolaRiepilogo } from '../src/moduli/turni/riepilogo'
import { areaDelMese } from '../src/moduli/turni/rotazione'
import { CATALOGO_SCUOLA, correzioniCatalogoV1, vociMancanti } from '../src/moduli/turni/catalogoScuola'
import { assegnazioneDelMese, ultimoMese } from '../src/moduli/turni/assegnazioni'
import { minuti, minutiDaOrari, tipoTurnoDa, TIPI_TURNO, type DatiTurno, type TipoTurno } from '../src/moduli/turni/tipi'

const d = (g: number, m: number, h = 0, min = 0, anno = 2026) => istante(anno, m, g, h, min)
let contatore = 0
function turno(inizio: number, fine: number, tipo: TipoTurno = 'ambulatorio', extra: Partial<DatiTurno> = {}): DatiTurno {
  return { id: `t${++contatore}`, inizio, fine, tipo, ...extra }
}

describe('Valori salvati', () => {
  test('ripiego per valori sconosciuti o non più usati', () => {
    expect(tipoTurnoDa('guardiaNotturna')).toBe('guardiaNotturna')
    expect(tipoTurnoDa('tipoDiUnaVersioneFutura')).toBe('ambulatorio')
    expect(tipoTurnoDa('reperibilita')).toBe('ambulatorio')
    expect(TIPI_TURNO).not.toContain('reperibilita')
  })
})

describe('Orari dai turni tipo', () => {
  const g = (giorno: number, mese = 10) => ({ anno: 2026, mese, giorno })
  test('turno nella giornata', () => {
    expect(intervallo(g(12), 8 * 60, 14 * 60)).toEqual({ inizio: d(12, 10, 8), fine: d(12, 10, 14) })
  })
  test('notte, fino a mezzanotte, 24 ore', () => {
    expect(intervallo(g(12), 20 * 60, 8 * 60).fine).toBe(d(13, 10, 8))
    expect(intervallo(g(12), 16 * 60, 0).fine).toBe(d(13, 10))
    const v = intervallo(g(12), 8 * 60, 8 * 60)
    expect(v.fine - v.inizio).toBe(24 * 3_600_000)
  })
  test('ora legale: 11 ore a marzo, 13 a ottobre', () => {
    const marzo = intervallo(g(28, 3), 20 * 60, 8 * 60)
    expect(minuti(turno(marzo.inizio, marzo.fine))).toBe(11 * 60)
    const ottobre = intervallo(g(24), 20 * 60, 8 * 60)
    expect(minuti(turno(ottobre.inizio, ottobre.fine))).toBe(13 * 60)
  })
  test('inserimento multiplo senza doppioni e in ordine', () => {
    const v = intervalli([g(15), g(13), g(15)], 8 * 60, 14 * 60)
    expect(v.map((x) => x.inizio)).toEqual([d(13, 10, 8), d(15, 10, 8)])
  })
  test('orari non validi', () => {
    expect(() => intervallo(g(1), -1, 60)).toThrow(RangeError)
    expect(() => intervallo(g(1), 0, 1440)).toThrow(RangeError)
  })
})

describe('Ore inserite a mano', () => {
  test('sostituiscono quelle calcolate, anche nel riepilogo', () => {
    const t = turno(d(12, 10, 8), d(12, 10, 14), 'ambulatorio', { minutiManuali: 450 })
    expect(minutiDaOrari(t)).toBe(360)
    expect(minuti(t)).toBe(450)
    const domenica = turno(d(11, 10, 8), d(11, 10, 20), 'guardiaDiurna', { minutiManuali: 600 })
    const r = calcolaRiepilogo([t, domenica], 2026, 10)
    expect(r.minutiTotali).toBe(450 + 600)
    expect(r.minutiInGiorniFestivi).toBe(600)
  })
})

describe('Sovrapposizioni', () => {
  const a = turno(d(12, 10, 8), d(12, 10, 14))
  const b = turno(d(12, 10, 13), d(12, 10, 18))
  const c = turno(d(12, 10, 18), d(12, 10, 20)) // tocca b all'estremo: non è sovrapposizione
  const lungo = turno(d(12, 10, 7), d(12, 10, 22))
  test('coppie', () => {
    expect(sovrapposizioni([c, b, a])).toEqual([{ primo: a.id, secondo: b.id }])
    expect(sovrapposizioni([a, b, c, lungo])).toHaveLength(4)
  })
  test('avvisi per un turno', () => {
    expect(avvisi(c, [a, b])).toEqual([])
    expect(avvisi(b, [a])).toEqual([{ tipo: 'sovrapposizione', con: a.id }])
  })
  test('turni ravvicinati senza sovrapposizione non danno avvisi', () => {
    const notte = turno(d(12, 10, 20), d(13, 10, 8), 'guardiaNotturna')
    const mattina = turno(d(13, 10, 8), d(13, 10, 14))
    expect(avvisi(mattina, [notte])).toEqual([])
  })
})

describe('Riepilogo mensile', () => {
  const sedeA = 'sedeA', sedeB = 'sedeB'
  const turni = [
    // Notte da sabato 31 ottobre a domenica 1° novembre (Ognissanti): conta in ottobre.
    turno(d(31, 10, 20), d(1, 11, 8), 'guardiaNotturna', { sedeId: sedeA }),
    turno(d(12, 10, 8), d(12, 10, 14), 'ambulatorio', { sedeId: sedeB, compensoCent: 30_000 }),
    turno(d(11, 10, 8), d(11, 10, 20), 'guardiaDiurna', { sedeId: sedeA }),
    turno(d(13, 10, 8), d(13, 10, 14), 'festivo', { sedeId: sedeB, compensoCent: 36_000 }),
    turno(d(30, 9, 20), d(1, 10, 8), 'guardiaNotturna', { sedeId: sedeA }), // settembre
    turno(d(1, 11, 8), d(1, 11, 14), 'ambulatorio', { sedeId: sedeB }), // novembre
  ]

  test('totali con sabato festivo', () => {
    const r = calcolaRiepilogo(turni, 2026, 10, { sabatoFestivo: true })
    expect(r.numeroTurni).toBe(4)
    expect(r.minutiTotali).toBe((12 + 6 + 12 + 6) * 60)
    expect(r.minutiPerSede.get(sedeA)).toBe(24 * 60)
    expect(r.notti).toBe(1)
    expect(r.guardieGiorno).toBe(1)
    expect(r.turniPerTipo.get('guardiaNotturna')).toBe(1)
    expect(r.turniFestivi).toBe(3)
    expect(r.minutiInGiorniFestivi).toBe((4 + 8 + 12) * 60)
    expect(r.compensoCent).toBe(66_000)
  })

  test('sabato feriale', () => {
    const r = calcolaRiepilogo(turni, 2026, 10, { sabatoFestivo: false })
    expect(r.turniFestivi).toBe(2)
    expect(r.minutiInGiorniFestivi).toBe((8 + 12) * 60)
  })
})

describe('Rotazione Ginecologia / Ostetricia', () => {
  test('senza scelte non c’è area', () => {
    expect(areaDelMese([], 2026, 10)).toBeUndefined()
  })
  test('6 mesi dall’ancora, poi alterna in avanti e all’indietro', () => {
    const ancore = [{ meseInizio: '2026-10', area: 'ostetricia' as const }]
    expect(areaDelMese(ancore, 2026, 10)).toEqual({ area: 'ostetricia', meseDellaRotazione: 1, scelto: true })
    expect(areaDelMese(ancore, 2027, 3)).toEqual({ area: 'ostetricia', meseDellaRotazione: 6, scelto: false })
    expect(areaDelMese(ancore, 2027, 4)?.area).toBe('ginecologia')
    expect(areaDelMese(ancore, 2027, 10)?.area).toBe('ostetricia')
    expect(areaDelMese(ancore, 2026, 9)).toEqual({ area: 'ginecologia', meseDellaRotazione: 6, scelto: false })
    expect(areaDelMese(ancore, 2026, 4)).toEqual({ area: 'ginecologia', meseDellaRotazione: 1, scelto: false })
  })
  test('una nuova scelta vale da quel mese in poi', () => {
    const ancore = [
      { meseInizio: '2026-10', area: 'ostetricia' as const },
      { meseInizio: '2027-02', area: 'ginecologia' as const },
    ]
    expect(areaDelMese(ancore, 2027, 1)?.area).toBe('ostetricia')
    expect(areaDelMese(ancore, 2027, 2)).toEqual({ area: 'ginecologia', meseDellaRotazione: 1, scelto: true })
    expect(areaDelMese(ancore, 2027, 8)?.area).toBe('ostetricia')
  })
})

describe('Turni tutto il giorno', () => {
  test('ore solo se inserite a mano, nessuna sovrapposizione', () => {
    const giorno = turno(d(12, 10), d(13, 10), 'ambulatorio', { tuttoIlGiorno: true })
    expect(minuti(giorno)).toBe(0)
    expect(minuti({ ...giorno, minutiManuali: 300 })).toBe(300)
    const notte = turno(d(12, 10, 20), d(13, 10, 8), 'guardiaNotturna')
    expect(avvisi(notte, [giorno])).toEqual([])
    const r = calcolaRiepilogo([giorno, notte], 2026, 10)
    expect(r.numeroTurni).toBe(2)
    expect(r.minutiTotali).toBe(12 * 60)
  })
})

describe('Sigle della scuola', () => {
  test('catalogo completo e senza doppioni', () => {
    expect(CATALOGO_SCUOLA).toHaveLength(56)
    expect(new Set(CATALOGO_SCUOLA.map((v) => v.sigla.toLowerCase())).size).toBe(56)
    expect(CATALOGO_SCUOLA.every((v) => TIPI_TURNO.includes(v.tipo))).toBe(true)
  })
  test('aggiunge solo le sigle mancanti', () => {
    expect(vociMancanti([{ sigla: 'N' }, { sigla: 'e pom' }]).map((v) => v.sigla)).not.toContain('E pom')
    expect(vociMancanti([{ sigla: 'N' }])).toHaveLength(55)
  })
})

describe('Orari predefiniti delle sigle', () => {
  test('ambulatori 8–18, sala operatoria 7–18, Tronco senza tipo', () => {
    const v = (s: string) => CATALOGO_SCUOLA.find((x) => x.sigla === s)!
    expect(v('Agiap').orari).toEqual([480, 1080])
    expect(v('Sop').orari).toEqual([420, 1080])
    expect(v('Tro').tipo).toBe('altro')
  })
  test('correzione dei turni tipo caricati con la prima versione, solo se non modificati', () => {
    const vecchi = [
      { sigla: 'CDS', nome: 'Amb. Colposcopia', tipo: 'ambulatorio', tuttoIlGiorno: true },
      { sigla: 'Tro', nome: 'Tronco', tipo: 'salaOperatoria', tuttoIlGiorno: true },
      { sigla: 'E', nome: 'Ecografie (rinominato)', tipo: 'ecografia', tuttoIlGiorno: true },
      { sigla: 'N', nome: 'Guardia notte', tipo: 'guardiaNotturna' },
    ]
    const c = correzioniCatalogoV1(vecchi)
    expect(c.map((x) => [x.sigla, x.tipo, x.minutoInizio, x.minutoFine])).toEqual([['CDS', 'ambulatorio', 480, 1080], ['Tro', 'altro', 480, 1080]])
  })
})

describe('Ospedale di assegnazione', () => {
  const periodi = [
    { meseInizio: '2026-10', mesi: 18, sedeId: 'sedeA' },
    { meseInizio: '2028-04', mesi: 12, sedeId: 'sedeB' },
    { meseInizio: '2027-02', mesi: 1, sedeId: 'sedeC' },
  ]
  test('periodo e mese del periodo', () => {
    expect(assegnazioneDelMese(periodi, 2026, 9)).toBeUndefined()
    expect(assegnazioneDelMese(periodi, 2026, 10)).toMatchObject({ periodo: { sedeId: 'sedeA' }, meseDelPeriodo: 1 })
    expect(assegnazioneDelMese(periodi, 2028, 3)).toMatchObject({ periodo: { sedeId: 'sedeA' }, meseDelPeriodo: 18 })
    expect(assegnazioneDelMese(periodi, 2028, 4)?.periodo.sedeId).toBe('sedeB')
  })
  test('un periodo iniziato dopo prevale', () => {
    expect(assegnazioneDelMese(periodi, 2027, 2)?.periodo.sedeId).toBe('sedeC')
    expect(assegnazioneDelMese(periodi, 2027, 3)?.periodo.sedeId).toBe('sedeA')
  })
  test('ultimo mese', () => {
    expect(ultimoMese({ meseInizio: '2026-10', mesi: 18, sedeId: 'x' })).toBe('2028-03')
  })
})


describe('Smonto notte automatico', () => {
  test('il giorno in cui finisce la notte', async () => {
    const { giornoSmonto, smontiDaCreare } = await import('../src/moduli/turni/smonto')
    expect(giornoSmonto({ inizio: d(21, 10, 20), fine: d(22, 10, 8) })).toBe('2026-10-22')
    expect(giornoSmonto({ inizio: d(31, 10, 20), fine: d(1, 11, 8) })).toBe('2026-11-01')
    expect(giornoSmonto({ inizio: d(21, 10, 16), fine: d(22, 10) })).toBe('2026-10-22')
    const turni = [
      { id: 'n1', tipo: 'guardiaNotturna', inizio: d(21, 10, 20), fine: d(22, 10, 8) },
      { id: 'n2', tipo: 'guardiaNotturna', inizio: d(23, 10, 20), fine: d(24, 10, 8) },
      { id: 'r1', tipo: 'reparto', inizio: d(25, 10, 8), fine: d(25, 10, 18) },
    ]
    expect(smontiDaCreare(turni, [{ giorno: '2026-10-24' }])).toEqual([{ giorno: '2026-10-22', tipo: 'smontoNotte', turnoId: 'n1' }])
  })
})

describe('ferie usate', () => {
  test('contano solo lunedì-venerdì non festivi', async () => {
    const { ferieUsate } = await import('../src/moduli/turni/ferie')
    const f = (giorno: string, tipo = 'ferie') => ({ giorno, tipo })
    // 3/11 martedì sì; 7 e 8/11 weekend no; 8/12 festivo no; riposo no; altro anno no.
    expect(ferieUsate([f('2026-11-03'), f('2026-11-07'), f('2026-11-08'), f('2026-12-08'), f('2026-11-04', 'riposo'), f('2027-01-04')], 2026)).toBe(1)
  })
})

describe('informazioni dalle istruzioni della scuola', () => {
  test('cambia solo i pezzi superati', async () => {
    const { testiAggiornati } = await import('../src/moduli/turni/catalogoScuola')
    expect(testiAggiornati([{ info: 'Mia nota. Reparto: 7° piano, settore B. Arrivare alle 7 (dipende da me)' }, { info: 'Mia nota' }]))
      .toEqual([{ info: 'Mia nota. Reparto: 3° piano, settore A. Inizio tra le 7 e le 7:30 (dipende da me)' }])
  })
})

describe('turni senza orari predefiniti', () => {
  const modello = { id: 'm', minutoInizio: 480, minutoFine: 1080 }
  const g = { anno: 2026, mese: 11, giorno: 3 }

  test('le guardie restano con gli orari, gli altri turni tipo diventano tutto il giorno', async () => {
    const { modelliSenzaOrari } = await import('../src/moduli/turni/senzaOrari')
    expect(modelliSenzaOrari([{ tipo: 'guardiaNotturna' }, { tipo: 'reparto' }, { tipo: 'altro', tuttoIlGiorno: true }])).toEqual([{ tipo: 'reparto', tuttoIlGiorno: true }])
  })

  test('cambia solo i turni futuri con l orario predefinito', async () => {
    const { turniFuturiSenzaOrari } = await import('../src/moduli/turni/senzaOrari')
    const { intervallo } = await import('../src/moduli/turni/orari')
    const base: { tipo: string; modelloId: string; inizio: number; fine: number; tuttoIlGiorno?: boolean; minutiManuali?: number } = { tipo: 'reparto', modelloId: 'm', ...intervallo(g, 480, 1080) }
    const adesso = base.inizio - 1000
    const [cambiato] = turniFuturiSenzaOrari([base], [modello], adesso)
    expect(cambiato?.tuttoIlGiorno).toBe(true)
    expect(cambiato!.fine - cambiato!.inizio).toBe(86_400_000)
    expect(turniFuturiSenzaOrari([base], [modello], base.inizio + 1)).toEqual([])
    expect(turniFuturiSenzaOrari([{ ...base, minutiManuali: 300 }, { ...base, ...intervallo(g, 480, 1200) }, { ...base, tipo: 'guardiaDiurna' }], [modello], adesso)).toEqual([])
  })
})

describe('banner degli orari', () => {
  const g = (giorno: number, altro: object = {}) => ({ inizio: istante(2026, 11, giorno, 0), tipo: 'ambulatorio', tuttoIlGiorno: true as boolean | undefined, ...altro })
  const oggi = { anno: 2026, mese: 11, giorno: 5 }

  test('giorni passati senza orari, dal più recente, senza guardie né oggi', async () => {
    const { giorniDaCompilare } = await import('../src/moduli/turni/orariDaScrivere')
    const r = giorniDaCompilare([
      g(2), g(3), g(3), g(5), g(4, { tipo: 'guardiaDiurna', tuttoIlGiorno: undefined }), g(4, { minutiManuali: 300 }), g(1, { tuttoIlGiorno: undefined }),
    ], oggi)
    expect(r.map((x) => [x.giorno, x.turni.length])).toEqual([['2026-11-03', 2], ['2026-11-02', 1]])
  })

  test('con la × il giorno non viene più chiesto', async () => {
    const { giorniDaCompilare } = await import('../src/moduli/turni/orariDaScrivere')
    expect(giorniDaCompilare([g(2)], oggi, ['2026-11-02'])).toEqual([])
  })
})

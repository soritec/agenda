import 'fake-indexeddb/auto'
import { describe, expect, test, vi } from 'vitest'
import { creditiAnno, daRipassare, idArgomento, leggiFlashcardDaTesto, lunedi, minutiSettimana, rispondi } from '../src/moduli/studio/logica'

const b = { creatoIl: 0, modificatoIl: 0 }

describe('Studio', () => {
  test('flashcard a scatole', () => {
    expect(rispondi({ scatola: 1 }, true, '2026-10-11')).toEqual({ scatola: 2, prossima: '2026-10-13' })
    expect(rispondi({ scatola: 5 }, true, '2026-10-11')).toEqual({ scatola: 5, prossima: '2026-10-27' })
    expect(rispondi({ scatola: 4 }, false, '2026-10-11')).toEqual({ scatola: 1, prossima: '2026-10-12' })
    const cards = [{ ...b, id: '1', domanda: 'a', risposta: 'b', scatola: 1, prossima: '2026-10-11' }, { ...b, id: '2', domanda: 'c', risposta: 'd', scatola: 2, prossima: '2026-10-12' }]
    expect(daRipassare(cards, '2026-10-11').map((c) => c.id)).toEqual(['1'])
  })

  test('tempo della settimana (da lunedì)', () => {
    expect(lunedi('2026-10-11')).toBe('2026-10-05')
    expect(lunedi('2026-10-12')).toBe('2026-10-12')
    const s = [{ ...b, id: '1', giorno: '2026-10-04', minuti: 60 }, { ...b, id: '2', giorno: '2026-10-05', minuti: 30 }, { ...b, id: '3', giorno: '2026-10-11', minuti: 45 }]
    expect(minutiSettimana(s, '2026-10-11')).toBe(75)
  })

  test('crediti ECM dell’anno, id argomenti, flashcard dal testo', () => {
    expect(creditiAnno([{ giorno: '2026-03-01', crediti: 12 }, { giorno: '2025-12-01', crediti: 8 }, { giorno: '2026-09-01' }], '2026')).toBe(12)
    expect(idArgomento('PMA e infertilità')).toBe('argomento-pma-e-infertilita')
    expect(leggiFlashcardDaTesto('1. D: Cos’è la PPROM?\nR: Rottura prematura pretermine delle membrane\n\nD: Soglia AFI oligoidramnios?\nR: < 5 cm')).toEqual([
      { domanda: 'Cos’è la PPROM?', risposta: 'Rottura prematura pretermine delle membrane' },
      { domanda: 'Soglia AFI oligoidramnios?', risposta: '< 5 cm' },
    ])
  })
})

describe('Timer di studio', () => {
  test('passa da studio a pausa e registra il tempo', async () => {
    const T = await import('../src/moduli/studio/timer')
    const { elenca } = await import('../src/dati/archivio')
    T.scegliDurate(30, 10)
    T.avvia()
    const inizio = T.leggiTimer().fineIl! - 30 * 60_000
    expect(T.rimanente(T.leggiTimer(), inizio + 15 * 60_000).frazione).toBeCloseTo(0.5)
    await T.controlla(inizio + 31 * 60_000)
    // A fine sessione la pausa è pronta ma non parte da sola.
    expect(T.leggiTimer()).toMatchObject({ fase: 'pausa', ciclo: 1, inAttesa: true, fineIl: undefined })
    await T.controlla(inizio + 41 * 60_000)
    expect(T.leggiTimer()).toMatchObject({ fase: 'pausa', inAttesa: true })
    T.avvia()
    expect(T.leggiTimer().fineIl).toBeDefined()
    await T.ferma()
    const sessioni = await elenca('sessioniStudio')
    // Fermando durante la pausa non si aggiungono minuti di studio.
    expect(sessioni.map((s) => s.minuti)).toEqual([30])
    expect(T.leggiTimer().fase).toBe('fermo')
  })
})

describe('Quiz di Gemini', () => {
  test('legge le domande valide e scarta le altre', async () => {
    const { leggiQuiz } = await import('../src/moduli/studio/ai')
    const json = JSON.stringify([
      { domanda: 'AFI oligoidramnios?', opzioni: ['< 2', '< 5', '< 8', '< 10'], corretta: 1, spiegazione: 'ACOG', fonte: 'Linee guida' },
      { domanda: 'senza opzioni', corretta: 0 },
      { domanda: 'indice fuori', opzioni: ['a', 'b'], corretta: 3 },
    ])
    expect(leggiQuiz(json)).toEqual([{ domanda: 'AFI oligoidramnios?', opzioni: ['< 2', '< 5', '< 8', '< 10'], corretta: 1, spiegazione: 'ACOG', fonte: 'Linee guida' }])
    expect(leggiQuiz('```json\n{"domande":[{"domanda":"x","opzioni":["a","b"],"corretta":0}]}\n```')).toHaveLength(1)
    expect(leggiQuiz('non è json')).toEqual([])
  })

  test('con Google sovraccarico (503) riprova e passa a un altro modello', async () => {
    vi.useFakeTimers()
    const memoria = new Map<string, string>([['agenda.chiaveGemini', 'chiave-finta']])
    vi.stubGlobal('localStorage', { getItem: (k: string) => memoria.get(k) ?? null, setItem: () => {}, removeItem: () => {} })
    const chiamate: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      chiamate.push(url)
      if (url.includes('gemini-2.5-flash-lite:')) return new Response('overloaded', { status: 503 })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Riassunto' }] } }] }), { status: 200 })
    })
    const { elabora } = await import('../src/moduli/studio/ai')
    const risultato = elabora('riassumi', { testo: 'materiale' })
    await vi.runAllTimersAsync()
    expect(await risultato).toBe('Riassunto')
    expect(chiamate.filter((u) => u.includes('gemini-2.5-flash-lite:'))).toHaveLength(3)
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('limite gratuito: messaggio del giorno o del minuto', async () => {
    const { leggiErroreGoogle, testoLimite } = await import('../src/moduli/studio/ai')
    const giorno = JSON.stringify({ error: { message: 'Quota exceeded', details: [{ '@type': 'QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }, { '@type': 'RetryInfo', retryDelay: '37s' }] } })
    expect(leggiErroreGoogle(giorno)).toMatchObject({ giornaliero: true, secondi: 37 })
    expect(testoLimite({ giornaliero: true })).toContain('domani')
    expect(testoLimite({ giornaliero: false, secondi: 37 })).toContain('tra 37 secondi')
  })
})

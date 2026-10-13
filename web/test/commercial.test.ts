import { describe, expect, test } from 'vitest'
import { leggiNotizie, leggiSpiegazione, nuoveSoltanto, settimanaDi, studiConApplication } from '../src/moduli/commercial/logica'

describe('Commercial awareness', () => {
  test('settimana dal lunedì alla domenica', () => {
    expect(settimanaDi('2026-10-14')).toEqual({ da: '2026-10-12', a: '2026-10-18' })
  })

  test('notizie lette dalla risposta di Gemini', () => {
    const r = 'Here you go:\n```json\n[{"topic":"deal","title":"Retail merger","source":"FT","url":"https://ft.com/x","date":"2026-10-15","summary":"Long summary.","figures":["£4bn"],"firms":["Linklaters"]},'
      + '{"topic":"ita","title":"Legge di bilancio","date":"2099-01-01"},{"title":""},{"topic":"boh","title":"Altro","url":"javascript:x"}]\n```'
    const n = leggiNotizie(r, '2026-10-16')
    expect(n.map((x) => [x.tema, x.titolo, x.giorno, x.url])).toEqual([
      ['deal', 'Retail merger', '2026-10-15', 'https://ft.com/x'], ['ita', 'Legge di bilancio', '2026-10-16', undefined], ['mkt', 'Altro', '2026-10-16', undefined],
    ])
    expect(n[0]).toMatchObject({ fonte: 'FT', riassunto: 'Long summary.', cifre: ['£4bn'], studi: ['Linklaters'], daGemini: true })
  })

  test('niente doppioni e studi con application', () => {
    expect(nuoveSoltanto([{ titolo: 'Retail merger!' }, { titolo: 'New story' }, { titolo: 'new story' }], [{ titolo: 'retail merger' }]).map((x) => x.titolo)).toEqual(['New story'])
    expect(studiConApplication({ titolo: 'Deal advised by Linklaters', studi: [] }, [{ studio: 'Linklaters' }, { studio: 'Freshfields' }])).toEqual(['Linklaters'])
    expect(leggiSpiegazione('{"why":"Matters","interview":"Say this","practiceAreas":["M&A"]}')).toEqual({ perche: 'Matters', colloquio: 'Say this', aree: ['M&A'], studi: undefined })
  })
})

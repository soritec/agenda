import { describe, expect, test } from 'vitest'
import { giornoDa, idDa, leggiFeed, riassuntoBreve, scegliNotizie, temaDaTesto, testoPulito } from '../src/moduli/commercial/rss'
import { unisciConFeed } from '../src/moduli/commercial/logica'

const xml = `<rss><channel>
<item><title><![CDATA[Supermarket giant agrees £4bn takeover]]></title><link>https://ex.com/a</link><pubDate>Wed, 21 Oct 2026 22:30:00 GMT</pubDate>
<description><![CDATA[<p>The deal values the group at &pound;4bn. Shareholders will vote in December. Analysts expect the CMA to look at it. A fourth sentence.</p> Continue reading...]]></description></item>
<item><title>Senza link</title><pubDate>Wed, 21 Oct 2026 10:00:00 GMT</pubDate></item>
</channel></rss>`

describe('Notizie dai giornali (RSS)', () => {
  test('legge il feed, pulisce il testo e sceglie il tema', () => {
    const n = leggiFeed(xml, { fonte: 'BBC Business', tema: 'mkt' })
    expect(n).toHaveLength(1)
    // 22:30 GMT del 21 = 00:30 del 22 in Italia.
    expect(n[0]).toMatchObject({ titolo: 'Supermarket giant agrees £4bn takeover', tema: 'deal', fonte: 'BBC Business', url: 'https://ex.com/a', giorno: '2026-10-22', id: idDa('https://ex.com/a') })
    expect(n[0]!.riassunto).toBe('The deal values the group at £4bn. Shareholders will vote in December. Analysts expect the CMA to look at it.')
  })

  test('temi, testo e date', () => {
    expect(temaDaTesto('Magic circle firm raises trainee pay', 'mkt')).toBe('law')
    expect(temaDaTesto('NHS signs AI deal', 'tech')).toBe('life')
    expect(temaDaTesto('Qualsiasi cosa', 'ita')).toBe('ita')
    expect(testoPulito('a &amp; b &#8217; <b>c</b>')).toBe('a & b ’ c')
    expect(riassuntoBreve('')).toBeUndefined()
    expect(giornoDa('non una data')).toBeUndefined()
  })

  test('niente doppioni, solo i giorni recenti, massimo per tema', () => {
    const base = { tema: 'mkt', fonte: 'X', url: 'https://x' }
    const tutte = [
      { ...base, id: '1', titolo: 'Rates cut', giorno: '2026-10-22' }, { ...base, id: '2', titolo: 'Rates cut!', giorno: '2026-10-22' },
      { ...base, id: '3', titolo: 'Old', giorno: '2026-09-01' }, { ...base, id: '4', titolo: 'Other', giorno: '2026-10-21' },
    ]
    expect(scegliNotizie(tutte, '2026-10-22').map((n) => n.id)).toEqual(['1', '4'])
  })

  test('le notizie salvate o nascoste vincono su quelle automatiche', () => {
    const f = (id: string) => ({ id, titolo: id, tema: 'mkt', giorno: '2026-10-22' })
    const salvate = [{ ...f('a'), salvata: true, creatoIl: 1, modificatoIl: 1 }, { ...f('b'), nascosta: true, creatoIl: 1, modificatoIl: 1 }]
    expect(unisciConFeed(salvate, [f('a'), f('b'), f('c')]).map((n) => [n.id, Boolean(n.daFeed)])).toEqual([['a', false], ['c', true]])
  })
})

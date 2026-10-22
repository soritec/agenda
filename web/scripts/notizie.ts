/**
 * Raccoglie le notizie dai feed RSS dei giornali e scrive public/notizie.json (letto dalla sezione Commercial awareness).
 * Gira durante la pubblicazione (ogni giorno, vedi .github/workflows/pubblica.yml). Se un giornale non risponde, si salta.
 */
import { writeFileSync } from 'node:fs'
import { FEED, leggiFeed, scegliNotizie, type NotiziaFeed } from '../src/moduli/commercial/rss.ts'

const oggi = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(Date.now())
const tutte: NotiziaFeed[] = []
for (const feed of FEED) {
  try {
    const r = await fetch(feed.url, { headers: { 'user-agent': 'Mozilla/5.0 (agenda; notizie)' }, signal: AbortSignal.timeout(20_000) })
    if (!r.ok) { console.warn(`${feed.url}: ${r.status}`); continue }
    const lette = leggiFeed(await r.text(), feed)
    console.log(`${feed.fonte} (${feed.tema}): ${lette.length}`)
    tutte.push(...lette)
  } catch (e) { console.warn(`${feed.url}: ${(e as Error).message}`) }
}
const notizie = scegliNotizie(tutte, oggi)
writeFileSync(new URL('../public/notizie.json', import.meta.url), JSON.stringify({ aggiornato: new Date().toISOString(), notizie }))
console.log(`Scritte ${notizie.length} notizie`)

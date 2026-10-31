/** Calendario del journal club letto da una foto: l'utente conferma sempre prima del salvataggio. */
export interface VoceCalendarioJournal { giorno: string; titolo: string; senzaJournal: boolean }

/** Mercoledì in cui il journal club non si tiene. */
const NIENTE_JOURNAL = /riunione strutturati|pausa|sospes|vacanz/i

/** "28/10" → l'anno è quello che porta la data più vicina a oggi ("2026-10-31"). */
export function giornoDaTabella(testo: string, oggi: string): string | undefined {
  const m = testo.trim().match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/)
  if (!m) return undefined
  const giorno = Number(m[1]), mese = Number(m[2])
  if (giorno < 1 || giorno > 31 || mese < 1 || mese > 12) return undefined
  const fine = `${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
  if (m[3]) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${fine}`
  const anno = Number(oggi.slice(0, 4))
  const distanza = (a: number) => Math.abs(Date.UTC(a, mese - 1, giorno) - Date.parse(`${oggi}T00:00:00Z`))
  return `${[anno - 1, anno, anno + 1].sort((a, b) => distanza(a) - distanza(b))[0]}-${fine}`
}

/** Risposta di Gemini (array JSON di {data, titolo}) → voci in ordine di data, senza doppioni. */
export function leggiCalendarioJournal(testo: string, oggi: string): VoceCalendarioJournal[] {
  let dati: unknown
  try { dati = JSON.parse(testo.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { return [] }
  const visti = new Set<string>()
  return (Array.isArray(dati) ? dati : []).flatMap((x): VoceCalendarioJournal[] => {
    const d = x as Record<string, unknown>
    const giorno = typeof d.data === 'string' ? giornoDaTabella(d.data, oggi) : undefined
    const titolo = typeof d.titolo === 'string' ? d.titolo.trim() : ''
    if (!giorno || !titolo || visti.has(giorno)) return []
    visti.add(giorno)
    return [{ giorno, titolo, senzaJournal: NIENTE_JOURNAL.test(titolo) }]
  }).sort((a, b) => a.giorno.localeCompare(b.giorno))
}

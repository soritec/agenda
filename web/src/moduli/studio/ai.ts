/**
 * Assistente AI (Claude di Anthropic) per riassumere e rielaborare testi.
 * La chiave resta solo su questo dispositivo e la inserisce l'utente; il testo scelto viene inviato ad Anthropic.
 */
const CHIAVE = 'agenda.chiaveAnthropic'
const MODELLO = 'claude-sonnet-5-5'

export const leggiChiave = () => { try { return localStorage.getItem(CHIAVE) ?? '' } catch { return '' } }
export const salvaChiave = (k: string) => { try { if (k) localStorage.setItem(CHIAVE, k); else localStorage.removeItem(CHIAVE) } catch { /* niente */ } }

export const AZIONI_AI = {
  riassumi: { titolo: 'Riassumi', istruzione: 'Fai un riassunto chiaro e fedele del testo, in italiano, per una specializzanda in ginecologia e ostetricia che ripassa. Usa paragrafi brevi; metti in evidenza definizioni, numeri e raccomandazioni.' },
  schema: { titolo: 'Schema a punti', istruzione: 'Trasforma il testo in uno schema a punti gerarchico in italiano (titoli brevi, sotto-punti), utile per ripassare. Mantieni valori numerici, soglie e livelli di raccomandazione.' },
  semplifica: { titolo: 'Semplifica', istruzione: 'Riscrivi il testo in italiano in modo più semplice e scorrevole, senza perdere informazioni cliniche importanti.' },
  domande: { titolo: "Domande d'esame", istruzione: "Scrivi in italiano 8 domande d'esame di specializzazione sul testo, ognuna seguita dalla risposta sintetica. Formato: \"D: …\" e sulla riga sotto \"R: …\"." },
  flashcard: { titolo: 'Flashcard', istruzione: 'Crea in italiano 10 flashcard sui concetti chiave del testo. Formato rigoroso, una per coppia di righe: "D: domanda" e sotto "R: risposta breve". Nient\'altro.' },
  traduci: { titolo: 'Traduci in italiano', istruzione: 'Traduci il testo in italiano medico corretto, mantenendo la struttura.' },
} as const
export type AzioneAI = keyof typeof AZIONI_AI

const base64 = async (b: Blob) => {
  const byte = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000))
  return btoa(s)
}

export async function elabora(azione: AzioneAI, testo: string, pdf?: Blob): Promise<string> {
  const chiave = leggiChiave()
  if (!chiave) throw new Error('Inserisci prima la tua chiave Anthropic.')
  const contenuto: unknown[] = []
  if (pdf) contenuto.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await base64(pdf) } })
  contenuto.push({ type: 'text', text: `${AZIONI_AI[azione].istruzione}\n\nRegola: non riportare mai dati che identificano pazienti.${testo.trim() ? `\n\nTesto:\n${testo}` : ''}` })
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': chiave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: MODELLO, max_tokens: 3000, messages: [{ role: 'user', content: contenuto }] }),
  })
  if (r.status === 401) throw new Error('La chiave non è valida: controllala nelle impostazioni dell\'assistente.')
  if (r.status === 429) throw new Error('Troppe richieste o credito esaurito: riprova tra poco o controlla il tuo account Anthropic.')
  if (!r.ok) throw new Error(`Errore dell'assistente (${r.status}).`)
  const dati = (await r.json()) as { content?: { type: string; text?: string }[] }
  return (dati.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n').trim()
}

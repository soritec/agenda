import { profiloPrincipale } from '../../dati/profili'
/**
 * Assistente Gemini (Google) per riassumere e rielaborare testi e per creare quiz e flashcard dalle fonti.
 * La chiave è gratuita (aistudio.google.com), resta solo su questo dispositivo e la inserisce l'utente.
 * Nella versione gratuita Google può usare i testi inviati: solo materiale di studio, mai dati personali o delle pazienti.
 */
const CHIAVE = 'agenda.chiaveGemini'
const MODELLI = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-2.0-flash']
const attendi = (ms: number) => new Promise((r) => setTimeout(r, ms))
const API = 'https://generativelanguage.googleapis.com/v1beta'

/** Versioni "flash" che la chiave può usare davvero (Google cambia spesso i nomi): prima quelle preferite, poi le altre. */
let modelliTrovati: { chiave: string; elenco: Promise<string[]> } | undefined
function modelliDisponibili(chiave: string): Promise<string[]> {
  if (modelliTrovati?.chiave !== chiave) modelliTrovati = { chiave, elenco: (async () => {
    try {
      const r = await fetch(`${API}/models?pageSize=200`, { headers: { 'x-goog-api-key': chiave } })
      if (!r.ok) return MODELLI
      const dati = (await r.json()) as { models?: { name?: string; supportedGenerationMethods?: string[] }[] }
      const nomi = (dati.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => (m.name ?? '').replace(/^models\//, ''))
        .filter((n) => /flash/.test(n) && !/image|tts|audio|live|embed|preview|exp/.test(n))
      if (!nomi.length) return MODELLI
      return [...MODELLI.filter((m) => nomi.includes(m)), ...nomi.filter((n) => !MODELLI.includes(n))]
    } catch { return MODELLI }
  })() }
  return modelliTrovati.elenco
}

/** Messaggio di Google, se c'è (per capire cosa non va). */
async function messaggioGoogle(r: Response): Promise<string> {
  try { return ((JSON.parse(await r.text()) as { error?: { message?: string } }).error?.message ?? '').slice(0, 200) } catch { return '' }
}

export const leggiChiave = () => { try { return localStorage.getItem(CHIAVE) ?? '' } catch { return '' } }
export const salvaChiave = (k: string) => { try { if (k) localStorage.setItem(CHIAVE, k); else localStorage.removeItem(CHIAVE) } catch { /* niente */ } }

/**
 * Per chi studia: il profilo principale è una specializzanda in ginecologia e ostetricia; gli altri profili
 * studiano giurisprudenza in inglese (testi e termini giuridici inglesi restano in inglese).
 */
const MEDICO = profiloPrincipale()
const CHI = MEDICO ? 'una specializzanda in ginecologia e ostetricia' : 'una studentessa di un master in giurisprudenza (LLM) in Inghilterra'
const ESAME = MEDICO ? "d'esame di specializzazione in ginecologia e ostetricia" : "d'esame del master in giurisprudenza (diritto inglese)"
const TERMINI = MEDICO ? '' : ' Lascia in inglese i termini giuridici, i nomi dei casi e delle leggi.'

export const AZIONI_AI = MEDICO ? {
  riassumi: { titolo: 'Riassumi', istruzione: 'Fai un riassunto chiaro e fedele del materiale, in italiano, per una specializzanda in ginecologia e ostetricia che ripassa. Paragrafi brevi; metti in evidenza definizioni, numeri e raccomandazioni.' },
  schema: { titolo: 'Schema a punti', istruzione: 'Trasforma il materiale in uno schema a punti gerarchico in italiano (titoli brevi, sotto-punti), utile per ripassare. Mantieni valori numerici, soglie e livelli di raccomandazione.' },
  semplifica: { titolo: 'Semplifica', istruzione: 'Riscrivi il materiale in italiano in modo più semplice e scorrevole, senza perdere informazioni cliniche importanti.' },
  domande: { titolo: "Domande d'esame", istruzione: "Scrivi in italiano 8 domande d'esame di specializzazione sul materiale, ognuna seguita dalla risposta sintetica. Formato: \"D: …\" e sulla riga sotto \"R: …\"." },
  flashcard: { titolo: 'Flashcard', istruzione: 'Crea in italiano 10 flashcard sui concetti chiave. Formato rigoroso, una per coppia di righe: "D: domanda" e sotto "R: risposta breve". Nient\'altro.' },
  traduci: { titolo: 'Traduci in italiano', istruzione: 'Traduci il materiale in italiano medico corretto, mantenendo la struttura.' },
} as const : {
  riassumi: { titolo: 'Riassumi', istruzione: `Fai un riassunto chiaro e fedele del materiale, in italiano, per ${CHI} che ripassa. Paragrafi brevi; metti in evidenza principi, casi (con il loro nome), norme e argomentazioni.${TERMINI}` },
  schema: { titolo: 'Schema a punti', istruzione: `Trasforma il materiale in uno schema a punti gerarchico in italiano (titoli brevi, sotto-punti), utile per ripassare: regola, eccezioni, casi principali, critiche.${TERMINI}` },
  semplifica: { titolo: 'Semplifica', istruzione: `Riscrivi il materiale in italiano in modo più semplice e scorrevole, senza perdere passaggi giuridici importanti.${TERMINI}` },
  domande: { titolo: "Domande d'esame", istruzione: `Scrivi 8 domande ${ESAME} sul materiale (anche problem question brevi), ognuna seguita dalla risposta sintetica con i casi pertinenti. Formato: "D: …" e sulla riga sotto "R: …".${TERMINI}` },
  flashcard: { titolo: 'Flashcard', istruzione: `Crea in italiano 10 flashcard sui concetti chiave (principi, casi e cosa hanno stabilito, norme). Formato rigoroso, una per coppia di righe: "D: domanda" e sotto "R: risposta breve". Nient'altro.${TERMINI}` },
  traduci: { titolo: 'Traduci in italiano', istruzione: 'Traduci il materiale in italiano giuridico corretto, mantenendo la struttura; tra parentesi lascia il termine inglese originale dei concetti tecnici.' },
} as const
export type AzioneAI = keyof typeof AZIONI_AI

/** Materiale da inviare: testi (titoli, note, link, testo incollato) e PDF. */
export interface Materiale { testo: string; pdf?: { nome: string; blob: Blob }[] }

const base64 = async (b: Blob) => {
  const byte = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000))
  return btoa(s)
}

async function chiama(istruzione: string, m: Materiale, json: boolean): Promise<string> {
  const chiave = leggiChiave()
  if (!chiave) throw new Error('Inserisci prima la tua chiave Gemini.')
  const parti: unknown[] = []
  for (const p of m.pdf ?? []) parti.push({ inline_data: { mime_type: 'application/pdf', data: await base64(p.blob) } })
  parti.push({ text: `${istruzione}\n\nRegola: non riportare mai dati che identificano persone o pazienti.${m.testo.trim() ? `\n\nMateriale:\n${m.testo}` : ''}` })
  const corpo = JSON.stringify({ contents: [{ role: 'user', parts: parti }], generationConfig: json ? { responseMimeType: 'application/json' } : undefined })
  let ultimo = 0
  let ultimoMessaggio = ''
  const modelli = await modelliDisponibili(chiave)
  for (const modello of modelli) {
    // 503/500 = Google è sovraccarico (capita spesso con la versione gratuita): si riprova poco dopo, poi si passa al modello successivo.
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      if (tentativo) await attendi(1500 * tentativo)
      const r = await fetch(`${API}/models/${modello}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': chiave }, body: corpo,
      })
      ultimo = r.status
      if (r.status === 404) break // modello non disponibile: si prova il successivo
      if (r.status === 400 || r.status === 403) {
        const t = await messaggioGoogle(r)
        if (/API key|API_KEY|permission/i.test(t)) throw new Error('La chiave non è valida: controllala.')
        throw new Error(`Gemini non è riuscito a leggere il materiale (forse un PDF troppo grande).${t ? ` Google dice: "${t}"` : ''}`)
      }
      if (!r.ok) ultimoMessaggio = await messaggioGoogle(r)
      if (r.status === 429) break // limite di questo modello: ogni modello ha il suo, si prova il successivo
      if (r.status >= 500) continue
      if (!r.ok) throw new Error(`Errore di Gemini (${r.status}).${ultimoMessaggio ? ` Google dice: "${ultimoMessaggio}"` : ''}`)
      const dati = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const testo = (dati.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
      if (!testo) throw new Error('Gemini non ha risposto: riprova.')
      return testo
    }
  }
  if (ultimo === 429) throw new Error(`Hai raggiunto il limite gratuito di Gemini per ora: riprova più tardi.${ultimoMessaggio ? ` Google dice: "${ultimoMessaggio}"` : ''}`)
  if (ultimo >= 500) throw new Error(`Gemini è sovraccarico in questo momento (succede con la versione gratuita): riprova tra qualche minuto.${ultimoMessaggio ? ` Google dice: "${ultimoMessaggio}"` : ''}`)
  throw new Error(`Gemini non è disponibile (${ultimo}).${ultimoMessaggio ? ` Google dice: "${ultimoMessaggio}"` : ''}`)
}

export const elabora = (azione: AzioneAI, m: Materiale) => chiama(AZIONI_AI[azione].istruzione, m, false)

export interface DomandaQuiz { domanda: string; opzioni: string[]; corretta: number; spiegazione?: string; fonte?: string }

/** Legge le domande del quiz dalla risposta JSON di Gemini, scartando quelle non valide. */
export function leggiQuiz(testo: string): DomandaQuiz[] {
  let dati: unknown
  try { dati = JSON.parse(testo.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { return [] }
  const elenco = Array.isArray(dati) ? dati : (dati as { domande?: unknown[] })?.domande ?? []
  return elenco.flatMap((d): DomandaQuiz[] => {
    const x = d as Partial<DomandaQuiz>
    if (typeof x.domanda !== 'string' || !Array.isArray(x.opzioni) || x.opzioni.length < 2 || typeof x.corretta !== 'number') return []
    const opzioni = x.opzioni.map(String)
    if (x.corretta < 0 || x.corretta >= opzioni.length) return []
    return [{ domanda: x.domanda, opzioni, corretta: x.corretta, spiegazione: typeof x.spiegazione === 'string' ? x.spiegazione : undefined, fonte: typeof x.fonte === 'string' ? x.fonte : undefined }]
  })
}

export async function generaQuiz(m: Materiale, quante: number): Promise<DomandaQuiz[]> {
  const testo = await chiama(
    `Crea un quiz ${ESAME}, in italiano, basato SOLO sul materiale fornito.${TERMINI} ${quante} domande a risposta multipla, ciascuna con 4 opzioni e una sola corretta, di difficoltà variabile. `
    + 'Rispondi solo con un array JSON di oggetti: {"domanda": string, "opzioni": [4 string], "corretta": indice 0-3, "spiegazione": string breve, "fonte": titolo della fonte}.', m, true)
  const domande = leggiQuiz(testo)
  if (!domande.length) throw new Error('Gemini non ha creato domande valide: riprova.')
  return domande
}

export async function generaFlashcard(m: Materiale, quante: number): Promise<{ domanda: string; risposta: string; fonte?: string }[]> {
  const testo = await chiama(
    `Crea ${quante} flashcard in italiano sui concetti chiave del materiale (definizioni, soglie, numeri, raccomandazioni). `
    + 'Rispondi solo con un array JSON di oggetti: {"domanda": string, "risposta": string breve, "fonte": titolo della fonte}.', m, true)
  let dati: unknown
  try { dati = JSON.parse(testo.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { dati = [] }
  const elenco = (Array.isArray(dati) ? dati : []) as { domanda?: unknown; risposta?: unknown; fonte?: unknown }[]
  const carte = elenco.filter((c) => typeof c.domanda === 'string' && typeof c.risposta === 'string')
    .map((c) => ({ domanda: c.domanda as string, risposta: c.risposta as string, fonte: typeof c.fonte === 'string' ? c.fonte : undefined }))
  if (!carte.length) throw new Error('Gemini non ha creato flashcard valide: riprova.')
  return carte
}

/** Argomenti dal syllabus (testo o PDF): elenco di nomi brevi. */
export async function estraiArgomenti(m: Materiale): Promise<string[]> {
  const testo = await chiama('Dal syllabus/programma fornito estrai l\'elenco degli argomenti da studiare, in italiano, con nomi brevi (max 6 parole), nell\'ordine del programma. Rispondi solo con un array JSON di stringhe.', m, true)
  try {
    const dati = JSON.parse(testo.replace(/^```(?:json)?\s*|\s*```$/g, '')) as unknown
    const elenco = (Array.isArray(dati) ? dati : []).map(String).map((s) => s.trim()).filter(Boolean)
    if (elenco.length) return [...new Set(elenco)].slice(0, 80)
  } catch { /* sotto */ }
  throw new Error('Gemini non ha trovato argomenti: prova a incollare l\'elenco.')
}

/** Chiede a Gemini di distribuire gli argomenti nei giorni: restituisce il testo JSON da validare con leggiPianoAI. */
export function organizzaConAI(dati: {
  argomenti: { nome: string; fonte?: string; paginaDa?: number; paginaA?: number }[]
  giorni: { giorno: string; occupato?: string }[]
  minutiAlGiorno: number
  fine: string
}): Promise<string> {
  return chiama(
    `Sei un tutor per ${CHI}. Organizza un piano di studio fino al ${dati.fine} (giorno dell'esame, escluso). `
    + `Ha circa ${dati.minutiAlGiorno} minuti al giorno. Distribuisci gli argomenti nei giorni elencati in modo ragionato: argomenti più difficili o lunghi prima e su più giorni, `
    + 'pagine divise in blocchi continui senza buchi, carico simile tra i giorni, niente o poco studio nei giorni segnati "occupato", ultimo giorno disponibile per il ripasso generale. '
    + 'Rispondi solo con un array JSON di oggetti {"giorno":"AAAA-MM-GG","tipo":"studio"|"ripassoGenerale","argomento":nome esatto dell\'argomento,"paginaDa":numero,"paginaA":numero,"minuti":numero}.',
    { testo: `Argomenti:\n${JSON.stringify(dati.argomenti)}\n\nGiorni disponibili:\n${JSON.stringify(dati.giorni)}` }, true)
}

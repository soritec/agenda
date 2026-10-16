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
  return leggiErroreGoogle(await r.text().catch(() => '')).messaggio
}

/** Errore di Google: messaggio e, per i limiti (429), se è quello del giorno e fra quanti secondi riprovare. */
export function leggiErroreGoogle(testo: string): { messaggio: string; giornaliero: boolean; secondi?: number } {
  try {
    const e = (JSON.parse(testo) as { error?: { message?: string; details?: { '@type'?: string; retryDelay?: string; violations?: { quotaId?: string }[] }[] } }).error
    const dettagli = e?.details ?? []
    const giornaliero = dettagli.some((d) => d.violations?.some((v) => /PerDay/i.test(v.quotaId ?? ''))) || /per day|daily/i.test(e?.message ?? '')
    const ritardo = dettagli.find((d) => d.retryDelay)?.retryDelay
    const secondi = ritardo ? Math.ceil(Number.parseFloat(ritardo)) : undefined
    return { messaggio: (e?.message ?? '').slice(0, 200), giornaliero, secondi: Number.isFinite(secondi) ? secondi : undefined }
  } catch { return { messaggio: '', giornaliero: false } }
}

/** Testo semplice per l'utente quando si supera il limite gratuito. */
export function testoLimite(l: { giornaliero: boolean; secondi?: number }): string {
  if (l.giornaliero) return 'Hai usato tutte le richieste gratuite di Gemini di oggi: riprova domani. Per non avere questo limite si può attivare il pagamento a consumo su aistudio.google.com.'
  return `Troppe richieste a Gemini in poco tempo (limite della versione gratuita): riprova ${l.secondi ? `tra ${l.secondi} secondi` : 'tra un minuto'}.`
}

export const leggiChiave = () => { try { return localStorage.getItem(CHIAVE) ?? '' } catch { return '' } }
export const salvaChiave = (k: string) => { try { if (k) localStorage.setItem(CHIAVE, k); else localStorage.removeItem(CHIAVE) } catch { /* niente */ } }

/**
 * Per chi studia: il profilo principale è una specializzanda in ginecologia e ostetricia; gli altri profili
 * studiano giurisprudenza in inglese (testi e termini giuridici inglesi restano in inglese).
 */
const MEDICO = profiloPrincipale()
const CHI = MEDICO ? 'una specializzanda in ginecologia e ostetricia' : 'an LLM law student in England'
const ESAME = MEDICO ? "d'esame di specializzazione in ginecologia e ostetricia" : 'LLM (English law) exam'
/** Lingua delle risposte: italiano per il profilo principale, inglese per chi studia diritto in Inghilterra. */
const LINGUA = MEDICO ? 'in italiano' : 'in English'
const TERMINI = MEDICO ? '' : ' Lascia in inglese i termini giuridici, i nomi dei casi e delle leggi.'

export const AZIONI_AI = MEDICO ? {
  riassumi: { titolo: 'Riassumi', istruzione: 'Fai un riassunto chiaro e fedele del materiale, in italiano, per una specializzanda in ginecologia e ostetricia che ripassa. Paragrafi brevi; metti in evidenza definizioni, numeri e raccomandazioni.' },
  schema: { titolo: 'Schema a punti', istruzione: 'Trasforma il materiale in uno schema a punti gerarchico in italiano (titoli brevi, sotto-punti), utile per ripassare. Mantieni valori numerici, soglie e livelli di raccomandazione.' },
  semplifica: { titolo: 'Semplifica', istruzione: 'Riscrivi il materiale in italiano in modo più semplice e scorrevole, senza perdere informazioni cliniche importanti.' },
  domande: { titolo: "Domande d'esame", istruzione: "Scrivi in italiano 8 domande d'esame di specializzazione sul materiale, ognuna seguita dalla risposta sintetica. Formato: \"D: …\" e sulla riga sotto \"R: …\"." },
  flashcard: { titolo: 'Flashcard', istruzione: 'Crea in italiano 10 flashcard sui concetti chiave. Formato rigoroso, una per coppia di righe: "D: domanda" e sotto "R: risposta breve". Nient\'altro.' },
  traduci: { titolo: 'Traduci in italiano', istruzione: 'Traduci il materiale in italiano medico corretto, mantenendo la struttura.' },
} as const : {
  riassumi: { titolo: 'Summarise', istruzione: `Write a clear, faithful summary of the material in English for ${CHI} revising for exams. Short paragraphs; highlight principles, cases (with their names), statutes and arguments.` },
  schema: { titolo: 'Outline', istruzione: 'Turn the material into a hierarchical bullet-point outline in English (short headings, sub-points) for revision: rule, exceptions, leading cases, criticism.' },
  semplifica: { titolo: 'Simplify', istruzione: 'Rewrite the material in plain, readable English without losing important legal steps.' },
  domande: { titolo: 'Exam questions', istruzione: `Write 8 ${ESAME} questions in English on the material (including short problem questions), each followed by a concise answer citing the relevant cases. Use exactly this format: a line starting with "D: " for the question and the next line starting with "R: " for the answer.` },
  flashcard: { titolo: 'Flashcards', istruzione: 'Create 10 flashcards in English on the key concepts (principles, cases and what they decided, statutes). Strict format, one per pair of lines: "D: question" and below it "R: short answer". Nothing else.' },
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

/** `cerca` = Gemini può cercare su Google (per informazioni aggiornate; in quel caso niente risposta JSON forzata). */
async function chiama(istruzione: string, m: Materiale, json: boolean, cerca = false, leggero = false): Promise<string> {
  const chiave = leggiChiave()
  if (!chiave) throw new Error('Inserisci prima la tua chiave Gemini.')
  const parti: unknown[] = []
  for (const p of m.pdf ?? []) parti.push({ inline_data: { mime_type: 'application/pdf', data: await base64(p.blob) } })
  parti.push({ text: `${istruzione}\n\nRegola: non riportare mai dati che identificano persone o pazienti.${m.testo.trim() ? `\n\nMateriale:\n${m.testo}` : ''}` })
  const corpo = JSON.stringify({
    contents: [{ role: 'user', parts: parti }],
    generationConfig: json && !cerca ? { responseMimeType: 'application/json' } : undefined,
    tools: cerca ? [{ google_search: {} }] : undefined,
  })
  let ultimo = 0
  let ultimoMessaggio = ''
  let limite: { giornaliero: boolean; secondi?: number } | undefined
  // Per le richieste semplici si prova prima la versione "lite", che ha limiti gratuiti più alti.
  const tutti = await modelliDisponibili(chiave)
  const modelli = leggero ? [...tutti.filter((x) => /lite/.test(x)), ...tutti.filter((x) => !/lite/.test(x))] : tutti
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
      if (!r.ok) {
        const e = leggiErroreGoogle(await r.text().catch(() => ''))
        ultimoMessaggio = e.messaggio
        if (r.status === 429) limite = { giornaliero: (limite?.giornaliero ?? false) || e.giornaliero, secondi: e.secondi ?? limite?.secondi }
      }
      if (r.status === 429) break // limite di questo modello: ogni modello ha il suo, si prova il successivo
      if (r.status >= 500) continue
      if (!r.ok) throw new Error(`Errore di Gemini (${r.status}).${ultimoMessaggio ? ` Google dice: "${ultimoMessaggio}"` : ''}`)
      const dati = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
      const testo = (dati.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim()
      if (!testo) throw new Error('Gemini non ha risposto: riprova.')
      return testo
    }
  }
  if (ultimo === 429) throw new Error(testoLimite(limite ?? { giornaliero: false }))
  if (ultimo >= 500) throw new Error(`Gemini è sovraccarico in questo momento (succede con la versione gratuita): riprova tra qualche minuto.${ultimoMessaggio ? ` Google dice: "${ultimoMessaggio}"` : ''}`)
  throw new Error(`Gemini non è disponibile (${ultimo}).${ultimoMessaggio ? ` Google dice: "${ultimoMessaggio}"` : ''}`)
}

export const elabora = (azione: AzioneAI, m: Materiale) => chiama(AZIONI_AI[azione].istruzione, m, false, false, true)

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
    `Crea un quiz ${ESAME}, scritto ${LINGUA}, basato SOLO sul materiale fornito.${TERMINI} ${quante} domande a risposta multipla, ciascuna con 4 opzioni e una sola corretta, di difficoltà variabile. `
    + 'Rispondi solo con un array JSON di oggetti: {"domanda": string, "opzioni": [4 string], "corretta": indice 0-3, "spiegazione": string breve, "fonte": titolo della fonte}.', m, true)
  const domande = leggiQuiz(testo)
  if (!domande.length) throw new Error('Gemini non ha creato domande valide: riprova.')
  return domande
}

export async function generaFlashcard(m: Materiale, quante: number): Promise<{ domanda: string; risposta: string; fonte?: string }[]> {
  const testo = await chiama(
    `Crea ${quante} flashcard scritte ${LINGUA} sui concetti chiave del materiale (definizioni, soglie, numeri, raccomandazioni). `
    + 'Rispondi solo con un array JSON di oggetti: {"domanda": string, "risposta": string breve, "fonte": titolo della fonte}.', m, true, false, true)
  let dati: unknown
  try { dati = JSON.parse(testo.replace(/^```(?:json)?\s*|\s*```$/g, '')) } catch { dati = [] }
  const elenco = (Array.isArray(dati) ? dati : []) as { domanda?: unknown; risposta?: unknown; fonte?: unknown }[]
  const carte = elenco.filter((c) => typeof c.domanda === 'string' && typeof c.risposta === 'string')
    .map((c) => ({ domanda: c.domanda as string, risposta: c.risposta as string, fonte: typeof c.fonte === 'string' ? c.fonte : undefined }))
  if (!carte.length) throw new Error('Gemini non ha creato flashcard valide: riprova.')
  return carte
}

/** Argomenti dal syllabus (testo o PDF): elenco di nomi brevi. */
/** Argomenti e readings dal syllabus: per ognuno il nome e, se indicati, la lettura (libro, capitolo, articolo, caso) e le pagine. */
export async function estraiArgomenti(m: Materiale): Promise<{ nome: string; fonte?: string; paginaDa?: number; paginaA?: number }[]> {
  const testo = await chiama(
    `Dal syllabus/programma fornito estrai, nell'ordine del programma, gli argomenti da studiare e le letture assegnate (readings: libri e capitoli, articoli, casi, documenti). Scrivi ${LINGUA}. `
    + "Per ogni argomento o lettura: un nome breve (max 6 parole), la fonte da leggere se c'è (es. \"Treitel ch. 3\", \"Smith v Jones [2019] UKSC 4\") e le pagine se indicate. "
    + 'Rispondi solo con un array JSON di oggetti {"nome": string, "fonte": string facoltativa, "paginaDa": numero facoltativo, "paginaA": numero facoltativo}.', m, true)
  try {
    const dati = JSON.parse(testo.replace(/^```(?:json)?\s*|\s*```$/g, '')) as unknown
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : undefined)
    const elenco = (Array.isArray(dati) ? dati : []).flatMap((x): { nome: string; fonte?: string; paginaDa?: number; paginaA?: number }[] => {
      if (typeof x === 'string') return x.trim() ? [{ nome: x.trim() }] : []
      const d = x as Record<string, unknown>
      const nome = typeof d.nome === 'string' ? d.nome.trim() : ''
      if (!nome) return []
      const da = n(d.paginaDa), fino = n(d.paginaA)
      return [{ nome, fonte: typeof d.fonte === 'string' && d.fonte.trim() ? d.fonte.trim() : undefined, paginaDa: da, paginaA: da && fino && fino >= da ? fino : undefined }]
    })
    if (elenco.length) return elenco.slice(0, 80)
  } catch { /* sotto */ }
  throw new Error("Gemini non ha trovato argomenti: prova a incollare l'elenco.")
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

/**
 * Valutazioni di uno studio legale cercate su internet da Gemini (classifiche degli studenti, es. Legal Cheek):
 * voti per categoria e stipendi di trainee e NQ. Sono da verificare: l'utente li vede segnati come tali.
 */
export async function valutaStudio(studio: string, categorie: string[]): Promise<string> {
  return chiama(
    `Cerca su internet le valutazioni più recenti dello studio legale "${studio}" (Regno Unito) nelle classifiche degli studenti e dei trainee, in particolare Legal Cheek Firms Most List. `
    + `Per ognuna di queste categorie dai il voto (A*, A, B, C o D), solo se lo trovi: ${categorie.join(', ')}. `
    + 'Trova anche lo stipendio da trainee del primo anno a Londra e quello da NQ, in sterline. '
    + `Rispondi solo con un oggetto JSON: {"voti": {"Categoria": "voto"}, "tc": numero, "nq": numero}. Se non trovi un dato, lascialo fuori.`,
    { testo: '' }, true, true)
}

/* Commercial awareness (in inglese; le notizie di politica italiana in italiano) */

/** Le notizie economiche e giuridiche più importanti del periodo, divise per tema, cercate su internet. */
export async function notizieDellaSettimana(da: string, a: string, temi: { chiave: string; nome: string }[]): Promise<string> {
  return chiama(
    `Search the web for the most important business, financial and legal news published between ${da} and ${a}, useful for the commercial awareness of a law student applying to City law firms in London. `
    + `Give about 2 stories for each of these topics (key: name): ${temi.map((t) => `${t.chiave}: ${t.nome}`).join('; ')}. `
    + 'For each story write a summary of 4-5 sentences that explains the context, what happened and what may happen next, so that someone who knows nothing about it understands it. '
    + 'Write everything in English, EXCEPT the stories of topic "ita" (Italian politics), which must be written entirely in Italian. '
    + 'Reply only with a JSON array of objects: {"topic": key, "title": string, "source": newspaper name, "url": link to the article, "date": "YYYY-MM-DD", "summary": string, "figures": [up to 4 short key figures], "firms": [law firms involved, if any]}.',
    { testo: '' }, true, true)
}

/** Note per i colloqui su una notizia: perché conta per uno studio, cosa dire, practice areas, studi coinvolti. */
export async function spiegaNotizia(n: { titolo: string; riassunto?: string; fonte?: string }, italiano: boolean): Promise<string> {
  return chiama(
    `${italiano ? 'Rispondi in italiano.' : 'Answer in English.'} A law student preparing for training contract interviews at City law firms read this news story. `
    + `Story: "${n.titolo}"${n.fonte ? ` (${n.fonte})` : ''}. ${n.riassunto ?? ''} `
    + 'Explain briefly: why it matters for a commercial law firm and its clients (2-3 sentences), what she could say about it at an interview (2 sentences, showing commercial awareness), the practice areas involved, and any law firms known to be advising. '
    + 'Reply only with a JSON object: {"why": string, "interview": string, "practiceAreas": [strings], "firms": [strings]}.',
    { testo: '' }, true, true)
}

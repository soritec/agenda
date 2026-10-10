import { daBase64, inBase64 } from './cifratura'

/**
 * Lettura e scrittura di un file nel repository privato dei dati (API "contents" di GitHub).
 * Il token è un "fine-grained token" limitato al solo repository dei dati, con permesso Contents in lettura e scrittura.
 */
export interface ConfigurazioneGitHub {
  token: string
  proprietario: string
  repository: string
}

export interface FileRemoto {
  testo: string
  sha: string
}

export class ErroreGitHub extends Error {
  constructor(public stato: number, messaggio: string) {
    super(messaggio)
  }
}

const API = 'https://api.github.com'

function intestazioni(c: ConfigurazioneGitHub): HeadersInit {
  return { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
}

function messaggioErrore(stato: number): string {
  if (stato === 401) return 'La chiave di accesso GitHub non è valida o è scaduta.'
  if (stato === 403) return 'La chiave di accesso non ha il permesso di leggere e scrivere i dati.'
  if (stato === 404) return 'Archivio dei dati non trovato: controlla la chiave di accesso.'
  return `GitHub ha risposto con un errore (${stato}).`
}

const indirizzo = (c: ConfigurazioneGitHub, percorso: string) =>
  `${API}/repos/${encodeURIComponent(c.proprietario)}/${encodeURIComponent(c.repository)}/contents/${percorso.split('/').map(encodeURIComponent).join('/')}`

/** Controlla che la chiave apra il repository. */
export async function verificaAccesso(c: ConfigurazioneGitHub, f: typeof fetch = fetch): Promise<void> {
  const r = await f(`${API}/repos/${encodeURIComponent(c.proprietario)}/${encodeURIComponent(c.repository)}`, { headers: intestazioni(c) })
  if (!r.ok) throw new ErroreGitHub(r.status, messaggioErrore(r.status))
}

/** Il file, oppure `undefined` se non esiste ancora. */
export async function leggiFile(c: ConfigurazioneGitHub, percorso: string, f: typeof fetch = fetch): Promise<FileRemoto | undefined> {
  const r = await f(`${indirizzo(c, percorso)}?t=${Date.now()}`, { headers: intestazioni(c), cache: 'no-store' })
  if (r.status === 404) return undefined
  if (!r.ok) throw new ErroreGitHub(r.status, messaggioErrore(r.status))
  const corpo = (await r.json()) as { content?: string; sha: string; download_url?: string }
  let testo: string
  if (corpo.content) testo = new TextDecoder().decode(daBase64(corpo.content.replace(/\n/g, '')))
  else {
    // File oltre 1 MB: l'API non include il contenuto, si scarica a parte.
    const grezzo = await f(indirizzo(c, percorso), { headers: { ...intestazioni(c), Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' })
    if (!grezzo.ok) throw new ErroreGitHub(grezzo.status, messaggioErrore(grezzo.status))
    testo = await grezzo.text()
  }
  return { testo, sha: corpo.sha }
}

/**
 * Scrive il file. Con `sha` aggiorna solo se nessun altro dispositivo l'ha cambiato nel frattempo:
 * in quel caso GitHub risponde 409/422 e bisogna rileggere e fondere.
 */
export async function scriviFile(c: ConfigurazioneGitHub, percorso: string, testo: string, sha: string | undefined, messaggio: string, f: typeof fetch = fetch): Promise<string> {
  const r = await f(indirizzo(c, percorso), {
    method: 'PUT',
    headers: { ...intestazioni(c), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: messaggio, content: inBase64(new TextEncoder().encode(testo)), ...(sha ? { sha } : {}) }),
  })
  if (r.status === 409 || r.status === 422) throw new ErroreGitHub(409, 'Il file è cambiato su un altro dispositivo.')
  if (!r.ok) throw new ErroreGitHub(r.status, messaggioErrore(r.status))
  const corpo = (await r.json()) as { content: { sha: string } }
  return corpo.content.sha
}

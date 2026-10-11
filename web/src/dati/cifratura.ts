/**
 * Cifratura dei dati con la password dell'utente (WebCrypto, tutto sul dispositivo).
 * - Chiave: PBKDF2-SHA256 dalla password + sale casuale, 600.000 iterazioni → AES-GCM 256, non esportabile.
 * - Ogni cifratura usa un IV casuale di 12 byte.
 * Senza la password i dati su GitHub sono illeggibili, anche per GitHub.
 */

export const ITERAZIONI_PREDEFINITE = 600_000

export interface Cifrato {
  iv: string
  dati: string
}

/** Metadati pubblici (non segreti) per ricavare la chiave e verificare la password. */
export interface DescrittoreChiave {
  versione: 1
  sale: string
  iterazioni: number
  /** Testo noto cifrato con la chiave: serve a capire se la password è giusta. */
  verifica: Cifrato
}

const TESTO_VERIFICA = 'agenda:password-corretta'

export function inBase64(byte: Uint8Array): string {
  let s = ''
  for (let i = 0; i < byte.length; i += 0x8000) s += String.fromCharCode(...byte.subarray(i, i + 0x8000))
  return btoa(s)
}

export function daBase64(testo: string): Uint8Array<ArrayBuffer> {
  const s = atob(testo)
  const byte = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) byte[i] = s.charCodeAt(i)
  return byte
}

export async function derivaChiave(password: string, sale: Uint8Array<ArrayBuffer>, iterazioni = ITERAZIONI_PREDEFINITE): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: iterazioni },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function cifra(chiave: CryptoKey, testo: string): Promise<Cifrato> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const dati = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, new TextEncoder().encode(testo))
  return { iv: inBase64(iv), dati: inBase64(new Uint8Array(dati)) }
}

/** Errore se la chiave è sbagliata o i dati sono stati alterati. */
export async function decifra(chiave: CryptoKey, c: Cifrato): Promise<string> {
  const chiaro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daBase64(c.iv) }, chiave, daBase64(c.dati))
  return new TextDecoder().decode(chiaro)
}

/** Nuova password: sale casuale, chiave e testo di verifica. */
export async function nuovaChiave(password: string, iterazioni = ITERAZIONI_PREDEFINITE): Promise<{ chiave: CryptoKey; descrittore: DescrittoreChiave }> {
  const sale = crypto.getRandomValues(new Uint8Array(16))
  const chiave = await derivaChiave(password, sale, iterazioni)
  return { chiave, descrittore: { versione: 1, sale: inBase64(sale), iterazioni, verifica: await cifra(chiave, TESTO_VERIFICA) } }
}

/** Password esistente: restituisce la chiave, oppure `undefined` se la password è sbagliata. */
export async function apriChiave(password: string, d: DescrittoreChiave): Promise<CryptoKey | undefined> {
  const chiave = await derivaChiave(password, daBase64(d.sale), d.iterazioni)
  try {
    return (await decifra(chiave, d.verifica)) === TESTO_VERIFICA ? chiave : undefined
  } catch {
    return undefined
  }
}

/** Come `cifra`, ma per file (byte). */
export async function cifraByte(chiave: CryptoKey, byte: Uint8Array<ArrayBuffer>): Promise<Cifrato> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const dati = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chiave, byte)
  return { iv: inBase64(iv), dati: inBase64(new Uint8Array(dati)) }
}

export async function decifraByte(chiave: CryptoKey, c: Cifrato): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: daBase64(c.iv) }, chiave, daBase64(c.dati)))
}

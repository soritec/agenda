import { elenca, elimina, leggiConfigurazioneSincronizzazione, leggiContenuto, nuovoId, ripristina, salva, salvaContenuto } from './archivio'
import { cifraByte, decifraByte, type Cifrato } from './cifratura'
import { ErroreGitHub, leggiFile, scriviFile } from './github'
import type { Allegato } from './modello'

/**
 * Allegati: il record (nome, tipo, a cosa è collegato) si sincronizza con gli altri dati;
 * il contenuto resta sul dispositivo e, se la sincronizzazione è attiva, va su GitHub cifrato
 * in `allegati/<id>.cifrato`, da cui gli altri dispositivi lo scaricano quando serve.
 */
export const DIMENSIONE_MASSIMA = 20 * 1024 * 1024
const TIPI: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', gif: 'image/gif', webp: 'image/webp', txt: 'text/plain' }
const tipoDaNome = (nome: string) => TIPI[nome.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
const percorso = (id: string) => `allegati/${id}.cifrato`

export async function aggiungiAllegato(file: File, collegatoA: string): Promise<Allegato> {
  if (file.size > DIMENSIONE_MASSIMA) throw new Error('Il file supera 20 MB.')
  // Safari a volte non riesce a salvare direttamente il File scelto (soprattutto da Foto o iCloud):
  // si leggono prima i byte e si salva una copia. Il contenuto va salvato prima del record,
  // così un errore non lascia in elenco un allegato vuoto.
  const tipoMime = file.type || tipoDaNome(file.name)
  const copia = new Blob([await file.arrayBuffer()], { type: tipoMime })
  const id = nuovoId()
  await salvaContenuto(id, copia)
  return salva('allegati', { id, nome: file.name || 'file', tipoMime, dimensione: file.size, collegatoA })
}

export async function eliminaAllegato(a: Allegato): Promise<() => Promise<void>> {
  await elimina('allegati', a.id)
  return () => ripristina('allegati', a.id)
}

/** Contenuto del file: dal dispositivo, oppure scaricato e decifrato da GitHub. */
export async function contenutoAllegato(a: Allegato): Promise<Blob> {
  const locale = await leggiContenuto(a.id)
  if (locale) return locale
  const config = await leggiConfigurazioneSincronizzazione()
  if (!config || !a.caricato) throw new Error('Il file è su un altro dispositivo: collega la sincronizzazione o aprilo da lì.')
  const remoto = await leggiFile(config, percorso(a.id))
  if (!remoto) throw new Error('File non ancora caricato dall’altro dispositivo.')
  const byte = await decifraByte(config.chiave, (JSON.parse(remoto.testo) as { cifrato: Cifrato }).cifrato)
  const blob = new Blob([byte], { type: a.tipoMime })
  await salvaContenuto(a.id, blob)
  return blob
}

/** Apre il file in una nuova scheda (PDF, immagini) o lo scarica. */
export async function apriInNuovaFinestra(a: Allegato): Promise<void> {
  const blob = await contenutoAllegato(a)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  if (/^(application\/pdf|image\/|text\/)/.test(a.tipoMime)) link.target = '_blank'
  else link.download = a.nome
  link.rel = 'noopener'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Durante la sincronizzazione: carica (cifrati) i file presenti qui e non ancora su GitHub. */
export async function caricaAllegatiMancanti(): Promise<void> {
  const config = await leggiConfigurazioneSincronizzazione()
  if (!config) return
  for (const a of await elenca('allegati')) {
    if (a.caricato) continue
    const contenuto = await leggiContenuto(a.id)
    if (!contenuto) continue
    const cifrato = await cifraByte(config.chiave, new Uint8Array(await contenuto.arrayBuffer()))
    try {
      await scriviFile(config, percorso(a.id), JSON.stringify({ formato: 1, cifrato }), undefined, 'Aggiungi un allegato')
    } catch (e) {
      // Già presente (caricato da un tentativo precedente): va bene così.
      if (!(e instanceof ErroreGitHub && e.stato === 409)) throw e
    }
    await salva('allegati', { ...a, caricato: true })
  }
}

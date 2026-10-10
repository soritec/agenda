import { useSyncExternalStore } from 'react'
import {
  ascolta, istantaneaLocale, leggiConfigurazioneSincronizzazione, salvaConfigurazioneSincronizzazione, scriviGrezzi,
  type ConfigurazioneSincronizzazione,
} from './archivio'
import { apriChiave, cifra, decifra, nuovaChiave, type Cifrato, type DescrittoreChiave } from './cifratura'
import { differenze, fondi, haDifferenze, istantaneaVuota, type Istantanea } from './fusione'
import { ErroreGitHub, leggiFile, scriviFile, verificaAccesso, type ConfigurazioneGitHub } from './github'

/**
 * Sincronizzazione tra dispositivi tramite il repository privato dei dati su GitHub.
 * Su GitHub ci sono solo due file: `chiave.json` (sale e verifica della password, nulla di segreto)
 * e `agenda.cifrato.json` (tutti i dati, cifrati). Ogni dispositivo tiene la sua copia completa e
 * funziona anche senza rete; a ogni sincronizzazione le due copie si fondono record per record.
 */

export const PROPRIETARIO_PREDEFINITO = 'soritec'
export const REPOSITORY_PREDEFINITO = 'agenda-dati'
const FILE_CHIAVE = 'chiave.json'
const FILE_DATI = 'agenda.cifrato.json'

export type Stato =
  | { tipo: 'non-collegato' }
  | { tipo: 'pronto'; ultima?: number }
  | { tipo: 'in-corso'; ultima?: number }
  | { tipo: 'senza-rete'; ultima?: number }
  | { tipo: 'errore'; messaggio: string; ultima?: number }

let stato: Stato = { tipo: 'non-collegato' }
const ascoltatoriStato = new Set<() => void>()
function imposta(s: Stato) {
  stato = s
  ascoltatoriStato.forEach((a) => a())
}

export function useStatoSincronizzazione(): Stato {
  return useSyncExternalStore((a) => { ascoltatoriStato.add(a); return () => ascoltatoriStato.delete(a) }, () => stato)
}

const github = (c: Pick<ConfigurazioneSincronizzazione, 'token' | 'proprietario' | 'repository'>): ConfigurazioneGitHub =>
  ({ token: c.token.trim(), proprietario: c.proprietario, repository: c.repository })

/** Primo passo del collegamento: controlla la chiave di accesso e dice se la password esiste già. */
export async function controllaArchivio(token: string, proprietario = PROPRIETARIO_PREDEFINITO, repository = REPOSITORY_PREDEFINITO) {
  const c = github({ token, proprietario, repository })
  await verificaAccesso(c)
  const chiave = await leggiFile(c, FILE_CHIAVE)
  return { haPassword: chiave !== undefined }
}

/** Collega questo dispositivo: crea la password (primo dispositivo) o la verifica (gli altri). */
export async function collega(token: string, password: string, proprietario = PROPRIETARIO_PREDEFINITO, repository = REPOSITORY_PREDEFINITO): Promise<void> {
  const c = github({ token, proprietario, repository })
  await verificaAccesso(c)
  const file = await leggiFile(c, FILE_CHIAVE)
  let chiave: CryptoKey
  if (file) {
    const aperta = await apriChiave(password, JSON.parse(file.testo) as DescrittoreChiave)
    if (!aperta) throw new Error('Password sbagliata.')
    chiave = aperta
  } else {
    const nuova = await nuovaChiave(password)
    await scriviFile(c, FILE_CHIAVE, JSON.stringify(nuova.descrittore, null, 2), undefined, 'Crea la chiave dei dati')
    chiave = nuova.chiave
  }
  await salvaConfigurazioneSincronizzazione({ ...c, chiave })
  imposta({ tipo: 'pronto' })
  await sincronizza()
}

export async function scollega(): Promise<void> {
  await salvaConfigurazioneSincronizzazione(undefined)
  imposta({ tipo: 'non-collegato' })
}

let inCorso: Promise<void> | undefined
let ancoraUnaVolta = false

/** Sincronizza adesso (se ne è già in corso una, ne segue un'altra subito dopo). */
export function sincronizza(): Promise<void> {
  if (inCorso) {
    ancoraUnaVolta = true
    return inCorso
  }
  inCorso = esegui().finally(() => {
    inCorso = undefined
    if (ancoraUnaVolta) {
      ancoraUnaVolta = false
      void sincronizza()
    }
  })
  return inCorso
}

async function esegui(): Promise<void> {
  const config = await leggiConfigurazioneSincronizzazione()
  if (!config) return imposta({ tipo: 'non-collegato' })
  const ultima = config.ultimaSincronizzazione
  if (!navigator.onLine) return imposta({ tipo: 'senza-rete', ultima })
  imposta({ tipo: 'in-corso', ultima })
  const c = github(config)
  try {
    for (let tentativo = 0; tentativo < 3; tentativo++) {
      const file = await leggiFile(c, FILE_DATI)
      let remota = istantaneaVuota()
      if (file) {
        try {
          remota = JSON.parse(await decifra(config.chiave, (JSON.parse(file.testo) as { cifrato: Cifrato }).cifrato)) as Istantanea
        } catch {
          throw new Error('Non riesco a leggere i dati: la password potrebbe essere stata cambiata su un altro dispositivo. Scollega e ricollega questo dispositivo.')
        }
      }
      const locale = await istantaneaLocale()
      const fusa = fondi(locale, remota)
      const daScrivere = differenze(fusa, locale)
      const impostazioniNuove = (fusa.impostazioni?.modificatoIl ?? 0) > (locale.impostazioni?.modificatoIl ?? 0)
      if (Object.keys(daScrivere).length || impostazioniNuove) await scriviGrezzi(daScrivere, impostazioniNuove ? fusa.impostazioni : undefined)

      let sha = file?.sha
      if (!file || haDifferenze(fusa, remota)) {
        const contenuto = JSON.stringify({ formato: 1, cifrato: await cifra(config.chiave, JSON.stringify(fusa)) })
        try {
          sha = await scriviFile(c, FILE_DATI, contenuto, file?.sha, 'Aggiorna i dati')
        } catch (e) {
          if (e instanceof ErroreGitHub && e.stato === 409) continue // un altro dispositivo ha scritto: si rilegge e si rifonde
          throw e
        }
      }
      const adesso = Date.now()
      await salvaConfigurazioneSincronizzazione({ ...config, sha, ultimaSincronizzazione: adesso })
      return imposta({ tipo: 'pronto', ultima: adesso })
    }
    throw new Error('Troppe modifiche contemporanee: riprovo tra poco.')
  } catch (e) {
    if (!navigator.onLine) return imposta({ tipo: 'senza-rete', ultima })
    imposta({ tipo: 'errore', messaggio: e instanceof Error ? e.message : 'Sincronizzazione non riuscita.', ultima })
  }
}

let avviata = false
/** Sincronizza all'avvio, dopo ogni modifica (con un piccolo ritardo), al ritorno della rete e dell'app in primo piano. */
export function avviaSincronizzazioneAutomatica(): void {
  if (avviata) return
  avviata = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const presto = (ms: number) => {
    clearTimeout(timer)
    timer = setTimeout(() => void sincronizza(), ms)
  }
  void leggiConfigurazioneSincronizzazione().then((c) => {
    if (c) {
      imposta({ tipo: 'pronto', ultima: c.ultimaSincronizzazione })
      void sincronizza()
    }
  })
  ascolta((origine) => { if (origine === 'utente') presto(2500) })
  window.addEventListener('online', () => presto(500))
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') presto(300) })
  setInterval(() => { if (document.visibilityState === 'visible') void sincronizza() }, 5 * 60_000)
}

/* Backup: file JSON con tutti i dati, da conservare dove si vuole e da cui si può ripristinare. */

export async function creaBackup(): Promise<Blob> {
  return new Blob([JSON.stringify(await istantaneaLocale(), null, 1)], { type: 'application/json' })
}

/** Unisce un backup ai dati attuali (non cancella nulla): restituisce quanti record sono stati aggiunti o aggiornati. */
export async function ripristinaBackup(testo: string): Promise<number> {
  const backup = JSON.parse(testo) as Istantanea
  if (backup.formato !== 1 || typeof backup.collezioni !== 'object') throw new Error('Questo file non è un backup di Agenda.')
  const locale = await istantaneaLocale()
  const fusa = fondi(locale, backup)
  const daScrivere = differenze(fusa, locale)
  await scriviGrezzi(daScrivere, undefined, 'utente')
  return Object.values(daScrivere).reduce((n, elenco) => n + (elenco?.length ?? 0), 0)
}

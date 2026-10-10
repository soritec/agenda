import { correzioniCatalogoV1 } from '../moduli/turni/catalogoScuola'
import { aggiungiSmonti } from '../moduli/turni/smonto'
import { elenca, leggiImpostazioni, salvaImpostazioni, salvaTanti } from './archivio'

/**
 * Correzioni una tantum dei dati salvati, eseguite all'avvio. Ognuna ha un nome e si applica una sola volta
 * per dispositivo; non tocca ciò che l'utente ha modificato.
 */
export async function eseguiManutenzione(): Promise<void> {
  const impostazioni = await leggiImpostazioni()
  const fatte = new Set(impostazioni.correzioniApplicate ?? [])
  const nuove: string[] = []

  if (!fatte.has('orari-sigle-scuola-v2')) {
    // Le sigle caricate con la prima versione erano "tutto il giorno": si danno gli orari predefiniti.
    const correzioni = correzioniCatalogoV1(await elenca('modelliTurno'))
    if (correzioni.length) await salvaTanti('modelliTurno', correzioni)
    nuove.push('orari-sigle-scuola-v2')
  }

  if (!fatte.has('smonto-notte-v1')) {
    // Smonto notte automatico anche per le guardie notturne inserite prima di questa funzione.
    await aggiungiSmonti(await elenca('turni'))
    nuove.push('smonto-notte-v1')
  }

  if (nuove.length) await salvaImpostazioni({ correzioniApplicate: [...fatte, ...nuove] })
}

import { correzioniCatalogoV1 } from '../moduli/turni/catalogoScuola'
import { aggiungiSmonti } from '../moduli/turni/smonto'
import { CHIRURGICHE_PREDEFINITE, TIPI_PROCEDURA_PREDEFINITI } from '../moduli/specializzazione/logica'
import { elenca, elencaTutti, leggiImpostazioni, salvaImpostazioni, salvaTanti } from './archivio'

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

  if (!fatte.has('tipi-procedura-v1')) {
    // Elenco iniziale dei tipi di procedura. Id fissi: due dispositivi creano gli stessi record, senza doppioni.
    const esistenti = new Set((await elencaTutti('tipiProcedura')).map((t) => t.id))
    const mancanti = TIPI_PROCEDURA_PREDEFINITI
      .map((nome, ordine) => ({ id: `predefinito-${nome.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, nome, ordine, chirurgica: CHIRURGICHE_PREDEFINITE.has(nome) }))
      .filter((t) => !esistenti.has(t.id))
    if (mancanti.length) await salvaTanti('tipiProcedura', mancanti)
    nuove.push('tipi-procedura-v1')
  }

  if (!fatte.has('procedure-chirurgiche-v1')) {
    // Le procedure predefinite chirurgiche vengono segnate come tali (solo se l'utente non ha già scelto).
    const daSegnare = (await elencaTutti('tipiProcedura'))
      .filter((t) => t.chirurgica === undefined && t.id.startsWith('predefinito-') && CHIRURGICHE_PREDEFINITE.has(t.nome))
      .map((t) => ({ ...t, chirurgica: true }))
    if (daSegnare.length) await salvaTanti('tipiProcedura', daSegnare)
    nuove.push('procedure-chirurgiche-v1')
  }

  if (nuove.length) await salvaImpostazioni({ correzioniApplicate: [...fatte, ...nuove] })
}

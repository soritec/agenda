import { correzioniCatalogoV1 } from '../moduli/turni/catalogoScuola'
import { aggiungiSmonti } from '../moduli/turni/smonto'
import { CHIRURGICHE_PREDEFINITE, TIPI_PROCEDURA_PREDEFINITI } from '../moduli/specializzazione/logica'
import { CATEGORIE_PREDEFINITE, CATEGORIE_STUDENTE, idPredefinita } from '../moduli/budget/logica'
import { PROFILO_PRINCIPALE, profiloAttivo } from './profili'
import { ARGOMENTI_PREDEFINITI, idArgomento } from '../moduli/studio/logica'
import { elenca, elencaTutti, elimina, leggiImpostazioni, salvaImpostazioni, salvaTanti } from './archivio'

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

  if (!fatte.has('categorie-budget-v1')) {
    // Categorie di partenza del budget, con id fissi (niente doppioni tra dispositivi).
    const esistenti = new Set((await elencaTutti('categorieBudget')).map((c) => c.id))
    const mancanti = CATEGORIE_PREDEFINITE.map((c, ordine) => ({ ...c, id: idPredefinita(c.nome), ordine })).filter((c) => !esistenti.has(c.id))
    if (mancanti.length) await salvaTanti('categorieBudget', mancanti)
    nuove.push('categorie-budget-v1')
  }

  if (profiloAttivo() !== PROFILO_PRINCIPALE && !fatte.has('categorie-budget-studente-v1')) {
    // Negli altri profili le categorie di partenza sono quelle di chi studia; le altre predefinite, se mai usate, si tolgono.
    const tutte = await elencaTutti('categorieBudget')
    const usate = new Set([...(await elencaTutti('movimenti')), ...(await elencaTutti('ricorrenti'))].map((m) => m.categoriaId))
    const volute = new Set(CATEGORIE_STUDENTE.map((c) => idPredefinita(c.nome)))
    for (const c of tutte) if (c.eliminatoIl === undefined && c.id.startsWith('predefinita-') && !volute.has(c.id) && !usate.has(c.id)) await elimina('categorieBudget', c.id)
    const esistenti = new Set(tutte.filter((c) => c.eliminatoIl === undefined).map((c) => c.id))
    const mancanti = CATEGORIE_STUDENTE.map((c, ordine) => ({ ...c, id: idPredefinita(c.nome), ordine })).filter((c) => !esistenti.has(c.id))
    if (mancanti.length) await salvaTanti('categorieBudget', mancanti)
    nuove.push('categorie-budget-studente-v1')
  }

  if (!fatte.has('argomenti-studio-v1')) {
    const esistenti = new Set((await elencaTutti('argomentiStudio')).map((a) => a.id))
    const mancanti = ARGOMENTI_PREDEFINITI.map((nome, ordine) => ({ id: idArgomento(nome), nome, ordine })).filter((a) => !esistenti.has(a.id))
    if (mancanti.length) await salvaTanti('argomentiStudio', mancanti)
    nuove.push('argomenti-studio-v1')
  }

  if (profiloAttivo() !== PROFILO_PRINCIPALE && !fatte.has('argomenti-studio-altri-v1')) {
    // Gli argomenti di partenza (medici) non servono negli altri profili: si tolgono se non usati; resta "Altro".
    const usati = new Set([...(await elencaTutti('risorse')), ...(await elencaTutti('flashcard'))].map((x) => x.argomentoId))
    for (const a of await elencaTutti('argomentiStudio')) {
      if (a.eliminatoIl === undefined && ARGOMENTI_PREDEFINITI.includes(a.nome) && a.nome !== 'Altro' && a.id === idArgomento(a.nome) && !usati.has(a.id)) await elimina('argomentiStudio', a.id)
    }
    nuove.push('argomenti-studio-altri-v1')
  }

  if (!fatte.has('cose-casa-in-task-v1')) {
    // Le "cose da gestire" della casa diventano task con area Casa (id derivato: niente doppioni tra dispositivi).
    const cose = (await elencaTutti('coseCasa')).filter((c) => c.eliminatoIl === undefined)
    if (cose.length) {
      await salvaTanti('attivita', cose.map((c) => ({ id: `casa-${c.id}`, titolo: c.testo, scadenza: c.giorno, area: 'casa', priorita: 'nessuna', completataIl: c.fatto ? c.modificatoIl : undefined, creatoIl: c.creatoIl })))
      for (const c of cose) await elimina('coseCasa', c.id)
    }
    nuove.push('cose-casa-in-task-v1')
  }

  if (nuove.length) await salvaImpostazioni({ correzioniApplicate: [...fatte, ...nuove] })
}

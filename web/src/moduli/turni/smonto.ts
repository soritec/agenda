import { aggiungiGiorni, giornoDi } from '../../nucleo/calendario'
import { elenca, elimina, ripristina, salva } from '../../dati/archivio'
import type { GiornataSpeciale, Turno } from '../../dati/modello'
import { chiaveGiorno } from './supporto'
import { tipoGiornataDa, tipoTurnoDa } from './tipi'

/**
 * Smonto notte automatico: il giorno in cui finisce una guardia notturna si segna "smonto notte".
 * Si crea solo se quel giorno non ha già una giornata; se l'utente lo toglie resta tolto;
 * eliminando la notte si toglie anche il suo smonto.
 */

/** Giorno dello smonto: quello in cui finisce la notte (o il giorno dopo l'inizio, se finisce a mezzanotte). */
export function giornoSmonto(t: Pick<Turno, 'inizio' | 'fine'>): string {
  const inizio = giornoDi(t.inizio)
  const fine = giornoDi(t.fine - 1)
  const g = chiaveGiorno(fine) === chiaveGiorno(inizio) ? aggiungiGiorni(inizio, 1) : fine
  return chiaveGiorno(g)
}

export function smontiDaCreare(
  turni: Pick<Turno, 'id' | 'tipo' | 'inizio' | 'fine'>[],
  giornate: Pick<GiornataSpeciale, 'giorno'>[],
): { giorno: string; tipo: 'smontoNotte'; turnoId: string }[] {
  const occupati = new Set(giornate.map((g) => g.giorno))
  const risultato: { giorno: string; tipo: 'smontoNotte'; turnoId: string }[] = []
  for (const t of turni) {
    if (tipoTurnoDa(t.tipo) !== 'guardiaNotturna') continue
    const giorno = giornoSmonto(t)
    if (occupati.has(giorno)) continue
    occupati.add(giorno)
    risultato.push({ giorno, tipo: 'smontoNotte', turnoId: t.id })
  }
  return risultato
}

/** Da chiamare dopo aver salvato turni nuovi o modificati. */
export async function aggiungiSmonti(turni: Pick<Turno, 'id' | 'tipo' | 'inizio' | 'fine'>[]): Promise<void> {
  const nuovi = smontiDaCreare(turni, await elenca('ferie'))
  for (const s of nuovi) await salva('ferie', s)
}

/** Elimina un turno e il suo smonto automatico; restituisce la funzione per annullare. */
export async function eliminaTurno(id: string): Promise<() => Promise<void>> {
  const smonti = (await elenca('ferie')).filter((g) => g.turnoId === id && tipoGiornataDa(g.tipo) === 'smontoNotte')
  await elimina('turni', id)
  for (const s of smonti) await elimina('ferie', s.id)
  return async () => {
    await ripristina('turni', id)
    for (const s of smonti) await ripristina('ferie', s.id)
  }
}

/**
 * Sposta un turno a nuovi orari (trascinandolo): lo smonto automatico segue la notte.
 * Restituisce la funzione per annullare.
 */
export async function spostaTurno(t: Turno, tempi: Pick<Turno, 'inizio' | 'fine'>): Promise<() => Promise<void>> {
  const smonti = (await elenca('ferie')).filter((g) => g.turnoId === t.id && tipoGiornataDa(g.tipo) === 'smontoNotte')
  for (const s of smonti) await elimina('ferie', s.id)
  const nuovo = await salva('turni', { ...t, ...tempi })
  const prima = new Set((await elenca('ferie')).map((g) => g.id))
  await aggiungiSmonti([nuovo])
  const creati = (await elenca('ferie')).filter((g) => !prima.has(g.id))
  return async () => {
    for (const c of creati) await elimina('ferie', c.id)
    await salva('turni', t)
    for (const s of smonti) await ripristina('ferie', s.id)
  }
}

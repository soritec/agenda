import type { Base, Impostazioni, NomeCollezione } from './modello'

/**
 * Fotografia completa dei dati (anche i record eliminati, che servono a propagare le eliminazioni).
 * È il contenuto del file cifrato su GitHub e del backup.
 */
export interface Istantanea {
  formato: 1
  creataIl: number
  collezioni: Partial<Record<NomeCollezione, Base[]>>
  impostazioni?: Impostazioni & { modificatoIl?: number }
}

/** Unisce due istantanee record per record: vince la modifica più recente. Nessun record va perso. */
export function fondi(a: Istantanea, b: Istantanea): Istantanea {
  const nomi = new Set([...Object.keys(a.collezioni), ...Object.keys(b.collezioni)]) as Set<NomeCollezione>
  const collezioni: Istantanea['collezioni'] = {}
  for (const nome of nomi) {
    const perId = new Map<string, Base>()
    for (const r of [...(a.collezioni[nome] ?? []), ...(b.collezioni[nome] ?? [])]) {
      const presente = perId.get(r.id)
      if (!presente || r.modificatoIl > presente.modificatoIl) perId.set(r.id, r)
    }
    collezioni[nome] = [...perId.values()]
  }
  const ia = a.impostazioni, ib = b.impostazioni
  const impostazioni = !ia ? ib : !ib ? ia : (ib.modificatoIl ?? 0) > (ia.modificatoIl ?? 0) ? ib : ia
  return { formato: 1, creataIl: Date.now(), collezioni, impostazioni }
}

/** Record di `nuova` che mancano o sono più recenti rispetto a `vecchia` (cioè da scrivere). */
export function differenze(nuova: Istantanea, vecchia: Istantanea): Partial<Record<NomeCollezione, Base[]>> {
  const risultato: Partial<Record<NomeCollezione, Base[]>> = {}
  for (const [nome, record] of Object.entries(nuova.collezioni) as [NomeCollezione, Base[]][]) {
    const vecchi = new Map((vecchia.collezioni[nome] ?? []).map((r) => [r.id, r.modificatoIl]))
    const cambiati = record.filter((r) => (vecchi.get(r.id) ?? -1) < r.modificatoIl)
    if (cambiati.length) risultato[nome] = cambiati
  }
  return risultato
}

export function haDifferenze(nuova: Istantanea, vecchia: Istantanea): boolean {
  const impNuove = nuova.impostazioni?.modificatoIl ?? 0
  const impVecchie = vecchia.impostazioni?.modificatoIl ?? 0
  return Object.keys(differenze(nuova, vecchia)).length > 0 || impNuove > impVecchie
}

export const istantaneaVuota = (): Istantanea => ({ formato: 1, creataIl: 0, collezioni: {} })

import type { TipoTurno } from './tipi'

/**
 * Sigle dei turni usate dalla scuola di specializzazione (legenda del vademecum).
 * Orari predefiniti (modificabili): reparto, ambulatori ed ecografie 8–18; sala operatoria 7–18.
 * Smonto notte, congresso, riposo e ferie non sono turni ma giornate (vedi `TIPI_GIORNATA`).
 */
export interface VoceCatalogo {
  sigla: string
  nome: string
  tipo: TipoTurno
  orari: [number, number]
}

const ORA = 60
const AMB: [number, number] = [8 * ORA, 18 * ORA]
const SALA: [number, number] = [7 * ORA, 18 * ORA]

export const CATALOGO_SCUOLA: VoceCatalogo[] = [
  { sigla: 'G', nome: 'Guardia giorno', tipo: 'guardiaDiurna', orari: [8 * ORA, 20 * ORA] },
  { sigla: 'N', nome: 'Guardia notte', tipo: 'guardiaNotturna', orari: [20 * ORA, 8 * ORA] },
  { sigla: 'R', nome: 'Reparto Ostetricia', tipo: 'reparto', orari: AMB },
  { sigla: 'P', nome: 'Puerperio', tipo: 'reparto', orari: AMB },
  { sigla: 'DSO', nome: 'Day Service Ostetrico', tipo: 'reparto', orari: AMB },
  { sigla: 'Rg', nome: 'Reparto Ginecologia', tipo: 'reparto', orari: AMB },
  { sigla: 'F', nome: 'Amb. Gravidanza Fisiologica', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Gem', nome: 'Amb. Gemelli', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'PP', nome: 'Amb. Parto Prematuro', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Au', nome: 'Amb. Autoimmunità', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'I', nome: 'Amb. Ipertensione', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Pa', nome: 'Amb. Pluriabortività', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'D', nome: 'Amb. Dismetabolismo', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'PV', nome: 'Amb. Patologia Varia', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'A', nome: 'Amb. Gravidanza Alto Rischio', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Ex', nome: 'Amb. Gravidanza Extrauterina / I trim.', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Rh', nome: 'Immunoprofilassi anti-D', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Cs', nome: 'Consultorio', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'AGI', nome: 'Amb. Ginecologia generale', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'CDS', nome: 'Amb. Colposcopia', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Ben', nome: 'Amb. Patologia Benigna', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Aon', nome: 'Amb. Oncologia', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'Uro', nome: 'Amb. Uroginecologia', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'BT', nome: 'Bi-test', tipo: 'ecografia', orari: AMB },
  { sigla: 'Gen', nome: 'Ecografie genetiche', tipo: 'ecografia', orari: AMB },
  { sigla: 'Am', nome: 'Amniocentesi', tipo: 'ecografia', orari: AMB },
  { sigla: 'E', nome: 'Ecografie ostetriche', tipo: 'ecografia', orari: AMB },
  { sigla: 'E terr', nome: 'Ecografie ostetriche del territorio', tipo: 'ecografia', orari: AMB },
  { sigla: 'E pom', nome: 'Ecografie ostetriche pomeriggio', tipo: 'ecografia', orari: AMB },
  { sigla: 'Dpl', nome: 'Ecodoppler ostetricia', tipo: 'ecografia', orari: AMB },
  { sigla: 'ES', nome: 'Ecografie di II livello', tipo: 'ecografia', orari: AMB },
  { sigla: 'PI', nome: 'Piccoli interventi', tipo: 'salaOperatoria', orari: SALA },
  { sigla: 'Sop', nome: 'Sala operatoria', tipo: 'salaOperatoria', orari: SALA },
  { sigla: 'Tro', nome: 'Tronco', tipo: 'altro', orari: AMB },
]

/** Voci del catalogo non ancora presenti tra i turni tipo (confronto per sigla). */
export function vociMancanti(esistenti: { sigla: string }[]): VoceCatalogo[] {
  const presenti = new Set(esistenti.map((m) => m.sigla.trim().toLowerCase()))
  return CATALOGO_SCUOLA.filter((v) => !presenti.has(v.sigla.toLowerCase()))
}

/**
 * Prima versione del catalogo: tutte le voci senza G/N erano "tutto il giorno" e Tronco era sala operatoria.
 * Restituisce le correzioni da applicare ai turni tipo caricati allora e mai modificati dall'utente.
 */
export function correzioniCatalogoV1<T extends { sigla: string; nome: string; tipo: string; tuttoIlGiorno?: boolean }>(
  modelli: T[],
): (T & { minutoInizio: number; minutoFine: number; tuttoIlGiorno: undefined })[] {
  const perSigla = new Map(CATALOGO_SCUOLA.map((v) => [v.sigla, v]))
  return modelli.flatMap((m) => {
    const v = perSigla.get(m.sigla)
    if (!v || !m.tuttoIlGiorno || m.nome !== v.nome) return []
    const tipoVecchio = v.sigla === 'Tro' ? 'salaOperatoria' : v.tipo
    if (m.tipo !== tipoVecchio) return []
    return [{ ...m, tipo: v.tipo, minutoInizio: v.orari[0], minutoFine: v.orari[1], tuttoIlGiorno: undefined }]
  })
}

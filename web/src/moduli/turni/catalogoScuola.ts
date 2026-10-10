import type { TipoTurno } from './tipi'

/**
 * Sigle dei turni usate dalla scuola di specializzazione (legenda del vademecum).
 * Senza orari noti il turno è "tutto il giorno": l'utente può aggiungere gli orari in seguito.
 * Smonto notte, congresso, riposo e ferie non sono turni ma giornate (vedi `TIPI_GIORNATA`).
 */
export interface VoceCatalogo {
  sigla: string
  nome: string
  tipo: TipoTurno
  orari?: [number, number]
}

const ORA = 60

export const CATALOGO_SCUOLA: VoceCatalogo[] = [
  { sigla: 'G', nome: 'Guardia giorno', tipo: 'guardiaDiurna', orari: [8 * ORA, 20 * ORA] },
  { sigla: 'N', nome: 'Guardia notte', tipo: 'guardiaNotturna', orari: [20 * ORA, 8 * ORA] },
  { sigla: 'R', nome: 'Reparto Ostetricia', tipo: 'reparto' },
  { sigla: 'P', nome: 'Puerperio', tipo: 'reparto' },
  { sigla: 'DSO', nome: 'Day Service Ostetrico', tipo: 'reparto' },
  { sigla: 'Rg', nome: 'Reparto Ginecologia', tipo: 'reparto' },
  { sigla: 'F', nome: 'Amb. Gravidanza Fisiologica', tipo: 'ambulatorio' },
  { sigla: 'Gem', nome: 'Amb. Gemelli', tipo: 'ambulatorio' },
  { sigla: 'PP', nome: 'Amb. Parto Prematuro', tipo: 'ambulatorio' },
  { sigla: 'Au', nome: 'Amb. Autoimmunità', tipo: 'ambulatorio' },
  { sigla: 'I', nome: 'Amb. Ipertensione', tipo: 'ambulatorio' },
  { sigla: 'Pa', nome: 'Amb. Pluriabortività', tipo: 'ambulatorio' },
  { sigla: 'D', nome: 'Amb. Dismetabolismo', tipo: 'ambulatorio' },
  { sigla: 'PV', nome: 'Amb. Patologia Varia', tipo: 'ambulatorio' },
  { sigla: 'A', nome: 'Amb. Gravidanza Alto Rischio', tipo: 'ambulatorio' },
  { sigla: 'Ex', nome: 'Amb. Gravidanza Extrauterina / I trim.', tipo: 'ambulatorio' },
  { sigla: 'Rh', nome: 'Immunoprofilassi anti-D', tipo: 'ambulatorio' },
  { sigla: 'Cs', nome: 'Consultorio', tipo: 'ambulatorio' },
  { sigla: 'AGI', nome: 'Amb. Ginecologia generale', tipo: 'ambulatorio' },
  { sigla: 'CDS', nome: 'Amb. Colposcopia', tipo: 'ambulatorio' },
  { sigla: 'Ben', nome: 'Amb. Patologia Benigna', tipo: 'ambulatorio' },
  { sigla: 'Aon', nome: 'Amb. Oncologia', tipo: 'ambulatorio' },
  { sigla: 'Uro', nome: 'Amb. Uroginecologia', tipo: 'ambulatorio' },
  { sigla: 'BT', nome: 'Bi-test', tipo: 'ecografia' },
  { sigla: 'Gen', nome: 'Ecografie genetiche', tipo: 'ecografia' },
  { sigla: 'Am', nome: 'Amniocentesi', tipo: 'ecografia' },
  { sigla: 'E', nome: 'Ecografie ostetriche', tipo: 'ecografia' },
  { sigla: 'E terr', nome: 'Ecografie ostetriche del territorio', tipo: 'ecografia' },
  { sigla: 'E pom', nome: 'Ecografie ostetriche pomeriggio', tipo: 'ecografia' },
  { sigla: 'Dpl', nome: 'Ecodoppler ostetricia', tipo: 'ecografia' },
  { sigla: 'ES', nome: 'Ecografie di II livello', tipo: 'ecografia' },
  { sigla: 'PI', nome: 'Piccoli interventi', tipo: 'salaOperatoria' },
  { sigla: 'Sop', nome: 'Sala operatoria', tipo: 'salaOperatoria' },
  { sigla: 'Tro', nome: 'Tronco', tipo: 'salaOperatoria' },
]

/** Voci del catalogo non ancora presenti tra i turni tipo (confronto per sigla). */
export function vociMancanti(esistenti: { sigla: string }[]): VoceCatalogo[] {
  const presenti = new Set(esistenti.map((m) => m.sigla.trim().toLowerCase()))
  return CATALOGO_SCUOLA.filter((v) => !presenti.has(v.sigla.toLowerCase()))
}

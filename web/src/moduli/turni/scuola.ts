import { impegniTra, testoOrario, type DatiAgenda, type Impegno } from '../agenda/impegni'
import { chiaveGiorno } from './supporto'
import { giornoDi } from '../../nucleo/calendario'
import { tipoGiornataDa, tipoTurnoDa } from './tipi'

/** Impegni della scuola mostrati nel calendario dei turni: non sono turni e non contano nelle ore. */
export type GenereScuola = 'journal' | 'goi' | 'lezione' | 'riunione'
export interface VoceScuola { chiave: string; fonte: Impegno['fonte']; id: string; giorno: string; genere: GenereScuola; nome: string; breve: string; ora?: string; minuto?: number; link: string }

const BREVE: Record<GenereScuola, string> = { journal: 'JC', goi: 'GOI', lezione: 'Lez', riunione: 'Riun' }

/** Genere di un impegno della scuola; undefined per tutto il resto. */
export function genereDi(i: Pick<Impegno, 'fonte' | 'id'>): GenereScuola | undefined {
  if (i.fonte === 'journal' || i.id.startsWith('jc:')) return 'journal'
  if (i.fonte === 'lezione') return 'lezione'
  if (i.fonte !== 'riunione') return undefined
  return i.id.startsWith('goi:') ? 'goi' : 'riunione'
}

/** Voci del periodo per giorno: niente nei giorni di ferie, smonto e monto notte. */
export function vociScuola(d: DatiAgenda, da: string, a: string, adesso = Date.now()): Map<string, VoceScuola[]> {
  const assente = new Set((d.giornate ?? []).filter((g) => ['ferie', 'smontoNotte'].includes(tipoGiornataDa(g.tipo))).map((g) => g.giorno))
  for (const t of d.turni ?? []) if (tipoTurnoDa(t.tipo) === 'guardiaNotturna') assente.add(chiaveGiorno(giornoDi(t.inizio)))
  const out = new Map<string, VoceScuola[]>()
  for (const i of impegniTra(d, da, a, adesso)) {
    const genere = genereDi(i)
    if (assente.has(i.giorno) || !genere) continue
    const ora = i.minutoInizio === undefined ? undefined : testoOrario({ minutoInizio: i.minutoInizio })
    out.set(i.giorno, [...(out.get(i.giorno) ?? []), { chiave: i.chiave, fonte: i.fonte, id: i.id, giorno: i.giorno, genere, nome: i.titolo, breve: BREVE[genere], ora, minuto: i.minutoInizio, link: i.link }])
  }
  return out
}

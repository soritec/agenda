import { giornoDi } from '../../nucleo/calendario'
import { meseDelNome } from './importaPdf'

/** Collegamento degli allegati della pagina "File dei turni" (Specializzazione). */
export const FILE_TURNI = 'file-turni'

const EXCEL = /\.xlsx?$/i
export const eExcel = (a: { nome: string }) => EXCEL.test(a.nome)
/** File da cui l'app sa leggere i turni: PDF ed Excel. */
export const eLeggibile = (a: { nome: string; tipoMime: string }) => a.tipoMime === 'application/pdf' || eExcel(a)

type FileBase = { nome: string; creatoIl: number; collegatoA: string }

/** Mese a cui si riferisce il file: quello nel nome, altrimenti il mese in cui è stato caricato. */
export function meseDelFileTurni(a: FileBase): string {
  const g = giornoDi(a.creatoIl)
  return meseDelNome(a.nome, g.anno) ?? `${g.anno}-${String(g.mese).padStart(2, '0')}`
}

/** File con un collegamento, divisi per mese, dal più recente; dentro il mese, dal più recente caricato. */
export function filePerMese<T extends FileBase>(allegati: T[], collegamento: string): { mese: string; file: T[] }[] {
  const gruppi = new Map<string, T[]>()
  for (const a of allegati.filter((x) => x.collegatoA === collegamento)) {
    const m = meseDelFileTurni(a)
    gruppi.set(m, [...(gruppi.get(m) ?? []), a])
  }
  return [...gruppi.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([mese, file]) => ({ mese, file: file.sort((x, y) => y.creatoIl - x.creatoIl) }))
}

export const fileTurniPerMese = <T extends FileBase>(allegati: T[]) => filePerMese(allegati, FILE_TURNI)

import { giornoDi } from '../../nucleo/calendario'
import { meseDelNome } from './importaPdf'

/** Collegamento degli allegati della pagina "File dei turni" (Specializzazione). */
export const FILE_TURNI = 'file-turni'

type FileBase = { nome: string; creatoIl: number; collegatoA: string }

/** Mese a cui si riferisce il file: quello nel nome, altrimenti il mese in cui è stato caricato. */
export function meseDelFileTurni(a: FileBase): string {
  const g = giornoDi(a.creatoIl)
  return meseDelNome(a.nome, g.anno) ?? `${g.anno}-${String(g.mese).padStart(2, '0')}`
}

/** File dei turni divisi per mese, dal più recente; dentro il mese, dal più recente caricato. */
export function fileTurniPerMese<T extends FileBase>(allegati: T[]): { mese: string; file: T[] }[] {
  const gruppi = new Map<string, T[]>()
  for (const a of allegati.filter((x) => x.collegatoA === FILE_TURNI)) {
    const m = meseDelFileTurni(a)
    gruppi.set(m, [...(gruppi.get(m) ?? []), a])
  }
  return [...gruppi.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([mese, file]) => ({ mese, file: file.sort((x, y) => y.creatoIl - x.creatoIl) }))
}

import { contenutoAllegato } from '../../dati/allegati'
import type { Allegato } from '../../dati/modello'
import { righeDelPdf } from '../turni/importaPdf'
import { pezziDelPdf } from '../turni/leggiPdf'
import { leggiProgramma, righeDaDocx, type VoceProgramma } from './programma'
import { oggi } from '../turni/supporto'

/** File da cui si possono leggere le date. */
export const eProgrammaLeggibile = (a: { nome: string; tipoMime: string }) => a.tipoMime === 'application/pdf' || /\.(pdf|docx|xlsx?)$/i.test(a.nome)

async function righeDelFile(a: Allegato, file: Blob): Promise<string[][]> {
  if (/\.docx$/i.test(a.nome)) {
    const { unzipSync, strFromU8 } = await import('fflate')
    const documento = unzipSync(new Uint8Array(await file.arrayBuffer()))['word/document.xml']
    if (!documento) throw new Error('documento Word senza testo')
    return righeDaDocx(strFromU8(documento))
  }
  if (/\.xlsx?$/i.test(a.nome)) {
    const XLSX = await import('xlsx')
    const libro = XLSX.read(new Uint8Array(await file.arrayBuffer()))
    return libro.SheetNames.flatMap((n) => [[n], ...XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[n]!, { header: 1, raw: false, defval: '' }).map((r) => r.map(String))])
  }
  return righeDelPdf(await pezziDelPdf(file))
}

/** Voci del programma contenute in un file caricato. */
export async function vociDelFile(a: Allegato): Promise<VoceProgramma[]> {
  return leggiProgramma(await righeDelFile(a, await contenutoAllegato(a)), a.nome, oggi().anno)
}

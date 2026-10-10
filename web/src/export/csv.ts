import { componenti } from '../nucleo/calendario'

/** Valore di una cella con il suo tipo: CSV e (in futuro) XLSX lo scrivono ciascuno nel proprio formato. */
export type CellaExport =
  | { tipo: 'testo'; valore: string }
  | { tipo: 'intero'; valore: number }
  | { tipo: 'importo'; centesimi: number }
  | { tipo: 'ore'; minuti: number }
  | { tipo: 'data'; istante: number }
  | { tipo: 'ora'; istante: number }
  | { tipo: 'dataOra'; istante: number }
  | { tipo: 'vuota' }

export interface TabellaExport {
  titolo: string
  intestazioni: string[]
  righe: CellaExport[][]
}

/**
 * CSV pensato per Excel in italiano: separatore `;`, virgola decimale, righe CRLF, UTF-8 con BOM.
 * Numeri senza separatore delle migliaia né simbolo, così Excel li riconosce come numeri.
 */
const SEPARATORE = ';'

export function testoCSV(tabella: TabellaExport): string {
  const righe = [tabella.intestazioni.map(campo).join(SEPARATORE), ...tabella.righe.map((r) => r.map(valoreCSV).join(SEPARATORE))]
  return righe.join('\r\n') + '\r\n'
}

export function blobCSV(tabella: TabellaExport): Blob {
  return new Blob(['﻿', testoCSV(tabella)], { type: 'text/csv;charset=utf-8' })
}

export function valoreCSV(cella: CellaExport): string {
  switch (cella.tipo) {
    case 'testo': return campo(neutralizzaFormula(cella.valore))
    case 'intero': return String(cella.valore)
    case 'importo': return decimale(cella.centesimi)
    case 'ore': return oreDecimali(cella.minuti)
    case 'data': return dataOra(cella.istante, true, false)
    case 'ora': return dataOra(cella.istante, false, true)
    case 'dataOra': return dataOra(cella.istante, true, true)
    case 'vuota': return ''
  }
}

/** Racchiude tra virgolette se serve, raddoppiando le virgolette interne. */
function campo(s: string): string {
  return /[;"\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/** Un testo che inizia con = + - @ verrebbe eseguito da Excel come formula: lo si rende testo. */
function neutralizzaFormula(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

/** Centesimi → "1234,50". */
function decimale(centesimi: number): string {
  const segno = centesimi < 0 ? '-' : ''
  const a = Math.abs(Math.round(centesimi))
  return `${segno}${Math.floor(a / 100)},${String(a % 100).padStart(2, '0')}`
}

/** Ore con al massimo due decimali, senza zeri finali: 450 → "7,5", 480 → "8", 445 → "7,42". */
function oreDecimali(minuti: number): string {
  return decimale(Math.round((minuti / 60) * 100)).replace(/0+$/, '').replace(/,$/, '')
}

function dataOra(istante: number, data: boolean, ora: boolean): string {
  const c = componenti(istante)
  const due = (n: number) => String(n).padStart(2, '0')
  const parti: string[] = []
  if (data) parti.push(`${due(c.giorno)}/${due(c.mese)}/${c.anno}`)
  if (ora) parti.push(`${due(c.ora)}:${due(c.minuto)}`)
  return parti.join(' ')
}

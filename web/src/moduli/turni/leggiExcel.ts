import { MESI, type PezzoTesto } from './importaPdf'

export interface CellaFoglio { riga: number; colonna: number; testo: string; colonne: number }

/**
 * Le caselle di un foglio Excel diventano pezzi di testo con una posizione, come quelli di un PDF,
 * così la lettura dei turni è una sola. Il nome del foglio ("Novembre 2026") può dare il mese.
 */
export function pezziDaCelle(nome: string, pagina: number, celle: CellaFoglio[]): PezzoTesto[] {
  return [
    { testo: nome, x: 0, y: 0, larghezza: 0, pagina },
    ...celle.map((c) => ({ testo: c.testo, x: c.colonna * 20, y: c.riga * 16, larghezza: c.colonne * 20, pagina })),
  ]
}

/** Pezzi di testo di un file Excel (.xlsx o .xls). La libreria si scarica solo quando serve. */
export async function pezziDelExcel(file: Blob): Promise<PezzoTesto[]> {
  const XLSX = await import('xlsx')
  const libro = XLSX.read(new Uint8Array(await file.arrayBuffer()), { cellNF: true })
  return libro.SheetNames.flatMap((nome, i) => {
    const foglio = libro.Sheets[nome]!
    if (!foglio['!ref']) return []
    const unite = new Map((foglio['!merges'] ?? []).map((m) => [`${m.s.r}:${m.s.c}`, m.e.c - m.s.c + 1]))
    const area = XLSX.utils.decode_range(foglio['!ref'])
    const celle: CellaFoglio[] = []
    for (let r = area.s.r; r <= area.e.r; r++) {
      for (let c = area.s.c; c <= area.e.c; c++) {
        const cella = foglio[XLSX.utils.encode_cell({ r, c })]
        if (!cella || cella.v === undefined) continue
        // Una data (es. il primo del mese in alto a sinistra) diventa "novembre 2026".
        const data = cella.t === 'n' && cella.z && XLSX.SSF.is_date(cella.z) ? XLSX.SSF.parse_date_code(Number(cella.v)) : undefined
        const testo = data ? `${MESI[data.m - 1]} ${data.y}` : String(cella.v).trim()
        if (testo) celle.push({ riga: r + 1, colonna: c + 1, testo, colonne: unite.get(`${r}:${c}`) ?? 1 })
      }
    }
    return pezziDaCelle(nome, i + 1, celle)
  })
}

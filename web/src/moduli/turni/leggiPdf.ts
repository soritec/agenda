import type { PezzoTesto } from './importaPdf'

/** Pezzi di testo di un PDF con la posizione (y dall'alto). pdf.js si scarica solo quando serve. */
export async function pezziDelPdf(file: Blob): Promise<PezzoTesto[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const lavoratore = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = lavoratore.default
  const compito = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const doc = await compito.promise
  const pezzi: PezzoTesto[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n)
    const altezza = pagina.getViewport({ scale: 1 }).height
    for (const it of (await pagina.getTextContent()).items) {
      if (!('str' in it) || !it.str.trim()) continue
      pezzi.push({ testo: it.str, x: it.transform[4] as number, y: altezza - (it.transform[5] as number), larghezza: it.width, pagina: n })
    }
  }
  await compito.destroy()
  return pezzi
}

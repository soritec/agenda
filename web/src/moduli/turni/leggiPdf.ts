import type { PezzoTesto } from './importaPdf'

/**
 * Pezzi di testo di un PDF con la posizione (y dall'alto). pdf.js si scarica solo quando serve.
 * Se il lettore in parallelo (worker) non parte su questo browser, si riprova nella pagina stessa.
 */
export async function pezziDelPdf(file: Blob): Promise<PezzoTesto[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const byte = new Uint8Array(await file.arrayBuffer())
  try {
    const lavoratore = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = lavoratore.default
    return await leggi(pdfjs, byte.slice())
  } catch (primo) {
    console.warn('Lettura PDF con il worker non riuscita, riprovo senza', primo)
    // Il modulo del worker caricato qui registra `globalThis.pdfjsWorker`: pdf.js lo usa nella pagina.
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs')
    return await leggi(pdfjs, byte.slice())
  }
}

async function leggi(pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs'), byte: Uint8Array): Promise<PezzoTesto[]> {
  const compito = pdfjs.getDocument({ data: byte, isEvalSupported: false })
  try {
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
    return pezzi
  } finally {
    void compito.destroy()
  }
}

/**
 * PDF A4 di una tabella (es. i turni del mese), creato sul dispositivo.
 * La libreria si carica solo quando serve, così l'app resta leggera.
 */
export interface DocumentoPdf {
  titolo: string
  sottotitolo?: string
  intestazioni: string[]
  righe: string[][]
  /** Righe di totali sotto la tabella. */
  totali: string[]
}

export async function creaPdf(d: DocumentoPdf): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margine = 14

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(29, 28, 26)
  doc.text(d.titolo, margine, 18)
  if (d.sottotitolo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(107, 102, 95)
    doc.text(d.sottotitolo, margine, 24)
  }

  autoTable(doc, {
    startY: d.sottotitolo ? 29 : 24,
    head: [d.intestazioni],
    body: d.righe,
    margin: { left: margine, right: margine },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: [29, 28, 26], lineColor: [233, 228, 220], lineWidth: 0.1 },
    headStyles: { fillColor: [63, 110, 115], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [247, 244, 239] },
  })

  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 30) + 8
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(29, 28, 26)
  for (const riga of d.totali) {
    if (y > 285) {
      doc.addPage()
      y = 18
    }
    doc.text(riga, margine, y)
    y += 5.5
  }

  const pagine = doc.getNumberOfPages()
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.text(`${i} / ${pagine}`, 210 - margine, 290, { align: 'right' })
  }
  return doc.output('blob')
}

/** Condivide il file (iPhone: foglio di condivisione) oppure lo scarica. */
export async function condividiOScarica(blob: Blob, nomeFile: string, titolo: string): Promise<'condiviso' | 'scaricato'> {
  const file = new File([blob], nomeFile, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: titolo })
      return 'condiviso'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'condiviso'
    }
  }
  scarica(blob, nomeFile)
  return 'scaricato'
}

export function scarica(blob: Blob, nomeFile: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeFile
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

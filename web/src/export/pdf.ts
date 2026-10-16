import { mostraAvviso } from '../interfaccia/componenti'
/**
 * PDF A4 di una tabella con riepilogo (es. i turni del mese), creato sul dispositivo.
 * La libreria si carica solo quando serve, così l'app resta leggera.
 */
export type Colore = [number, number, number]

export interface RigaPdf {
  celle: string[]
  /** Colore tenue della colonna evidenziata (es. tipo di turno). */
  colore?: Colore
  evidenza?: 'ferie' | 'festivo'
}

export interface DocumentoPdf {
  titolo: string
  sottotitolo?: string
  /** Riquadri in alto: valore in grande e in grassetto, etichetta sotto. */
  riepilogo: { etichetta: string; valore: string }[]
  intestazioni: string[]
  righe: RigaPdf[]
  /** Colonne in grassetto (es. data e turno). */
  colonneGrassetto?: number[]
  /** Colonna colorata con `RigaPdf.colore`. */
  colonnaColore?: number
  colonneDestra?: number[]
  colonnaNote?: number
  /** Riga di totale in fondo alla tabella (stesse colonne delle intestazioni). */
  totaleTabella?: string[]
  piede?: string
}

const TESTO: Colore = [29, 28, 26]
const SECONDARIO: Colore = [107, 102, 95]
const ACCENTO: Colore = [63, 110, 115]
const SFONDO_RIQUADRO: Colore = [242, 238, 232]
const FERIE: Colore = [243, 231, 207]
const FESTIVO: Colore = [138, 76, 52]

export async function creaPdf(d: DocumentoPdf): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margine = 14
  const larghezza = 210 - 2 * margine

  // Intestazione
  doc.setFillColor(...ACCENTO)
  doc.rect(0, 0, 210, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...TESTO)
  doc.text(d.titolo, margine, 18)
  let y = 18
  if (d.sottotitolo) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(...SECONDARIO)
    doc.text(d.sottotitolo, margine, 24.5)
    y = 24.5
  }

  // Riquadri di riepilogo
  if (d.riepilogo.length) {
    y += 6
    const spazio = 3
    const w = (larghezza - spazio * (d.riepilogo.length - 1)) / d.riepilogo.length
    d.riepilogo.forEach((r, i) => {
      const x = margine + i * (w + spazio)
      doc.setFillColor(...SFONDO_RIQUADRO)
      doc.roundedRect(x, y, w, 17, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...TESTO)
      doc.text(r.valore, x + 4, y + 8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...SECONDARIO)
      doc.text(r.etichetta, x + 4, y + 13.5)
    })
    y += 17
  }

  const grassetto = new Set(d.colonneGrassetto ?? [])
  const destra = new Set(d.colonneDestra ?? [])
  autoTable(doc, {
    startY: y + 6,
    head: [d.intestazioni],
    body: d.righe.map((r) => r.celle),
    foot: d.totaleTabella ? [d.totaleTabella] : undefined,
    showFoot: 'lastPage',
    footStyles: { fillColor: [255, 255, 255], textColor: TESTO, fontStyle: 'bold', fontSize: 10, lineColor: TESTO, lineWidth: { top: 0.4 } },
    margin: { left: margine, right: margine, bottom: 16 },
    styles: { font: 'helvetica', fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 2.2, right: 2.2 }, textColor: TESTO, lineColor: [233, 228, 220], lineWidth: { bottom: 0.15 } },
    headStyles: { fillColor: ACCENTO, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    didParseCell: (c) => {
      if (c.section !== 'body') {
        if (destra.has(c.column.index)) c.cell.styles.halign = 'right'
        return
      }
      const riga = d.righe[c.row.index]
      if (!riga) return
      if (grassetto.has(c.column.index)) c.cell.styles.fontStyle = 'bold'
      if (destra.has(c.column.index)) c.cell.styles.halign = 'right'
      if (c.column.index === d.colonnaNote) {
        c.cell.styles.fontStyle = 'italic'
        c.cell.styles.textColor = SECONDARIO
      }
      if (riga.evidenza === 'ferie') c.cell.styles.fillColor = riga.colore ?? FERIE
      else if (riga.colore && c.column.index === d.colonnaColore) c.cell.styles.fillColor = riga.colore
      if (riga.evidenza === 'festivo' && c.column.index === 0) c.cell.styles.textColor = FESTIVO
    },
  })

  const pagine = doc.getNumberOfPages()
  for (let i = 1; i <= pagine; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150)
    if (d.piede) doc.text(d.piede, margine, 290)
    doc.text(`Pagina ${i} di ${pagine}`, 210 - margine, 290, { align: 'right' })
  }
  return doc.output('blob')
}

/** Condivide il file (iPhone: foglio di condivisione) oppure lo scarica. */
export async function condividiOScarica(blob: Blob, nomeFile: string, titolo: string): Promise<'condiviso' | 'scaricato'> {
  // Sul Mac il menu Condividi non offre né il Calendario né "Salva": il file si scarica (un .ics si apre poi con un doppio clic).
  const touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1
  if (!touch) {
    scarica(blob, nomeFile)
    mostraAvviso(blob.type === 'text/calendar'
      ? `Scaricato "${nomeFile}": aprilo dalla cartella Download con un doppio clic e il Calendario ti chiederà dove aggiungerlo.`
      : `Scaricato "${nomeFile}" nella cartella Download.`)
    return 'scaricato'
  }
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

/** PDF di solo testo (es. appunti di un argomento): titolo e sezioni con titolo e paragrafi, a capo automatico. */
export async function creaPdfTesto(titolo: string, sottotitolo: string, sezioni: { titolo: string; testo: string }[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margine = 18, larghezza = 210 - 2 * margine, fondo = 297 - 18
  doc.setFillColor(...ACCENTO)
  doc.rect(0, 0, 210, 4, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...TESTO)
  doc.text(titolo, margine, 20)
  doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...SECONDARIO)
  doc.text(sottotitolo, margine, 27)
  let y = 38
  const aCapo = (altezza: number) => { if (y + altezza > fondo) { doc.addPage(); y = 20 } }
  for (const s of sezioni) {
    aCapo(14)
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...TESTO)
    for (const riga of doc.splitTextToSize(s.titolo, larghezza) as string[]) { aCapo(7); doc.text(riga, margine, y); y += 6.5 }
    y += 1
    doc.setFont('helvetica', 'normal').setFontSize(10.5)
    for (const paragrafo of s.testo.split(/\n/)) {
      const righe = doc.splitTextToSize(paragrafo || ' ', larghezza) as string[]
      for (const riga of righe) { aCapo(5.5); doc.text(riga, margine, y); y += 5.2 }
    }
    y += 6
  }
  return doc.output('blob')
}

/** PDF di un taccuino: copertina colorata, poi una pagina per ogni pagina del diario (con le foto JPEG/PNG). */
export async function creaPdfTaccuino(t: { nome: string; colore: string; testoCopertina: string }, pagine: { titolo: string; data: string; umore?: string; testo: string; etichette?: string[]; foto: Blob[] }[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const esa = (c: string): Colore => { const n = parseInt(c.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
  doc.setFillColor(...esa(t.colore))
  doc.rect(0, 0, 210, 297, 'F')
  doc.setTextColor(...esa(t.testoCopertina))
  doc.setFont('helvetica', 'bold').setFontSize(32)
  doc.text(doc.splitTextToSize(t.nome, 160) as string[], 25, 120)
  doc.setFont('helvetica', 'normal').setFontSize(12)
  doc.text(`${pagine.length} ${pagine.length === 1 ? 'pagina' : 'pagine'}`, 25, 140)
  const margine = 20, larghezza = 210 - 2 * margine, fondo = 297 - 18
  const dataUrl = (b: Blob) => new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(b) })
  for (const p of pagine) {
    doc.addPage()
    let y = 22
    const aCapo = (h: number) => { if (y + h > fondo) { doc.addPage(); y = 20 } }
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...SECONDARIO)
    doc.text([p.data, p.umore].filter(Boolean).join('  ·  '), margine, y)
    y += 8
    doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...TESTO)
    for (const r of doc.splitTextToSize(p.titolo || 'Senza titolo', larghezza) as string[]) { aCapo(8); doc.text(r, margine, y); y += 8 }
    y += 2
    doc.setFont('times', 'normal').setFontSize(12)
    for (const par of p.testo.split('\n')) {
      for (const r of doc.splitTextToSize(par || ' ', larghezza) as string[]) { aCapo(6); doc.text(r, margine, y); y += 6 }
    }
    if (p.etichette?.length) { y += 3; aCapo(6); doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...SECONDARIO); doc.text(p.etichette.map((e) => `#${e}`).join('  '), margine, y); y += 6; doc.setTextColor(...TESTO) }
    for (const f of p.foto) {
      if (!/image\/(jpeg|png)/.test(f.type)) continue
      const url = await dataUrl(f)
      const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url }).catch(() => undefined)
      if (!img) continue
      const w = Math.min(larghezza, 120), h = (img.height / img.width) * w
      y += 4
      aCapo(Math.min(h, 200))
      doc.addImage(url, f.type === 'image/png' ? 'PNG' : 'JPEG', margine, y, w, Math.min(h, 200))
      y += Math.min(h, 200) + 2
    }
  }
  return doc.output('blob')
}

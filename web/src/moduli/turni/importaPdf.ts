/**
 * Lettura dei turni dai file PDF della scuola (tabelle mensili), senza intelligenza artificiale.
 * Riceve i pezzi di testo con la loro posizione (da pdf.js) e cerca il nome dell'utente in due forme di tabella:
 * - nome nelle caselle (es. guardie: colonne "… G" / "… N", righe = giorni) → la sigla viene dall'intestazione;
 * - nome nell'intestazione (es. una colonna per persona) → la sigla è scritta nella casella del giorno.
 * Logica pura: l'utente conferma sempre prima che i turni vengano salvati.
 */

export interface PezzoTesto { testo: string; x: number; y: number; larghezza: number; pagina: number }
export interface TurnoLetto {
  /** "2026-11-17" */
  giorno: string
  sigla: string
  /** Intestazione della colonna da cui viene (per mostrarla nella conferma). */
  colonna: string
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const RIGA_GIORNO = /^(lun|mar|mer|gio|ven|sab|dom)[a-zì]*\.?\s+(\d{1,2})$/i
/** Sigle che non sono turni (lo smonto lo segna già l'app dopo la notte). */
const DA_SALTARE = new Set(['smo', 'smonto', '-', '–', '/'])

export const normalizza = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').replace(/[.\s]+$/, '').trim()

/** Mese della tabella ("2026-11") dal primo "Novembre 2026" trovato. */
export function meseDelFile(pezzi: PezzoTesto[]): string | undefined {
  for (const p of pezzi) {
    const m = normalizza(p.testo).match(new RegExp(`\\b(${MESI.join('|')})\\s+(\\d{4})\\b`))
    if (m) return `${m[2]}-${String(MESI.indexOf(m[1]!) + 1).padStart(2, '0')}`
  }
  return undefined
}

interface Casella { testo: string; x: number; centro: number }

/** Righe della pagina (stessa altezza), con i pezzi vicini uniti in una casella. */
function righe(pezzi: PezzoTesto[]): Casella[][] {
  const ordinati = [...pezzi].sort((a, b) => a.y - b.y || a.x - b.x)
  const gruppi: PezzoTesto[][] = []
  for (const p of ordinati) {
    const ultimo = gruppi[gruppi.length - 1]
    if (ultimo && Math.abs(ultimo[0]!.y - p.y) <= 3) ultimo.push(p)
    else gruppi.push([p])
  }
  return gruppi.map((g) => {
    const caselle: { testo: string; x: number; fine: number }[] = []
    for (const p of g.sort((a, b) => a.x - b.x)) {
      const c = caselle[caselle.length - 1]
      if (c && p.x - c.fine < 6) { c.testo += (p.x - c.fine > 1 ? ' ' : '') + p.testo; c.fine = p.x + p.larghezza }
      else caselle.push({ testo: p.testo, x: p.x, fine: p.x + p.larghezza })
    }
    return caselle.map((c) => ({ testo: c.testo.trim(), x: c.x, centro: (c.x + c.fine) / 2 })).filter((c) => c.testo)
  })
}

/** Turni dell'utente (`nomi`: come compare nei file, anche più varianti) trovati nelle tabelle. */
export function leggiTurni(pezzi: PezzoTesto[], nomi: string[]): { mese?: string; turni: TurnoLetto[] } {
  const mese = meseDelFile(pezzi)
  const cercati = new Set(nomi.map(normalizza).filter(Boolean))
  if (!mese || cercati.size === 0) return { mese, turni: [] }
  const turni: TurnoLetto[] = []
  const pagine = [...new Set(pezzi.map((p) => p.pagina))]
  for (const pagina of pagine) {
    let intestazione: Casella[] | undefined
    let precedente: Casella[] | undefined
    for (const riga of righe(pezzi.filter((p) => p.pagina === pagina))) {
      const giorno = riga[0]?.testo.match(RIGA_GIORNO)
      if (!giorno) { precedente = riga; intestazione = undefined; continue }
      // L'intestazione è la riga (con almeno due caselle) appena sopra il primo giorno della tabella.
      if (!intestazione) intestazione = precedente && precedente.length >= 2 ? precedente : undefined
      precedente = riga
      if (!intestazione) continue
      const colonne = intestazione.filter((c) => c.centro > riga[0]!.x + 40 || c.x > riga[0]!.x + 20)
      const n = Number(giorno[2])
      if (n < 1 || n > 31) continue
      const chiave = `${mese}-${String(n).padStart(2, '0')}`
      const colonnaDi = (c: Casella) => {
        let scelta: Casella | undefined
        for (const col of colonne) if (col.x - 6 <= c.centro) scelta = col
        return scelta
      }
      for (const c of riga.slice(1)) {
        const col = colonnaDi(c)
        if (!col) continue
        if (cercati.has(normalizza(col.testo))) {
          // Una colonna per persona: nella casella c'è la sigla.
          for (const s of c.testo.split(/[\s,+/]+/)) if (s && !DA_SALTARE.has(normalizza(s))) turni.push({ giorno: chiave, sigla: s, colonna: col.testo })
        } else if (cercati.has(normalizza(c.testo))) {
          // Nome nella casella: la sigla è l'ultima parola dell'intestazione se corta (G, N, GSP…), altrimenti l'intestazione.
          const ultima = col.testo.trim().split(/\s+/).pop() ?? ''
          turni.push({ giorno: chiave, sigla: ultima.length <= 4 && /^[A-Za-z]+$/.test(ultima) ? ultima.toUpperCase() : col.testo, colonna: col.testo })
        }
      }
    }
  }
  const visti = new Set<string>()
  return { mese, turni: turni.filter((t) => { const k = `${t.giorno}|${normalizza(t.sigla)}`; if (visti.has(k)) return false; visti.add(k); return true }).sort((a, b) => a.giorno.localeCompare(b.giorno)) }
}

/** Turno tipo con la stessa sigla (senza badare a maiuscole, punti e spazi). */
export function modelloPerSigla<T extends { sigla: string }>(sigla: string, modelli: T[]): T | undefined {
  const k = (t: string) => normalizza(t).replace(/[^a-z0-9]/g, '')
  return modelli.find((m) => k(m.sigla) === k(sigla))
}

/** Mese ("2026-11") scritto nel nome del file, es. "Guardie novembre 2026.pdf"; se manca l'anno vale `annoPredefinito`. */
export function meseDelNome(nome: string, annoPredefinito?: number): string | undefined {
  const t = normalizza(nome).replace(/[_\-.]+/g, ' ')
  const m = t.match(new RegExp(`\\b(${MESI.join('|')})\\b(?:\\s+(\\d{4}))?`))
  const anno = m?.[2] ? Number(m[2]) : annoPredefinito
  return m && anno ? `${anno}-${String(MESI.indexOf(m[1]!) + 1).padStart(2, '0')}` : undefined
}

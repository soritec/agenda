import type { CategoriaBudget, Movimento, Ricorrente, Tassa, Turno } from '../../dati/modello'
import { componenti, giornoDi } from '../../nucleo/calendario'
import { chiaveGiorno, giornoDaChiave } from '../turni/supporto'

export type TipoMovimento = 'entrata' | 'uscita'

/** Categorie di partenza (id fissi, così due dispositivi non creano doppioni). L'utente può modificarle e aggiungerne. */
export const CATEGORIE_PREDEFINITE: Omit<CategoriaBudget, 'id' | 'creatoIl' | 'modificatoIl' | 'ordine'>[] = [
  { nome: 'Stipendio', tipo: 'entrata', colore: '#1D9E75' },
  { nome: 'Sostituzioni MMG', tipo: 'entrata', colore: '#5DCAA5', extra: true },
  { nome: 'Libera professione', tipo: 'entrata', colore: '#0F6E56', extra: true },
  { nome: 'Altre entrate', tipo: 'entrata', colore: '#97C459' },
  { nome: 'Casa', tipo: 'uscita', colore: '#85B7EB' },
  { nome: 'Spesa', tipo: 'uscita', colore: '#5DCAA5' },
  { nome: 'Trasporti', tipo: 'uscita', colore: '#B4B2A9' },
  { nome: 'Salute', tipo: 'uscita', colore: '#F0997B' },
  { nome: 'Svago', tipo: 'uscita', colore: '#ED93B1' },
  { nome: 'Abbonamenti', tipo: 'uscita', colore: '#FAC775' },
  { nome: 'Congressi e corsi', tipo: 'uscita', colore: '#AFA9EC', lavoro: true },
  { nome: 'Libri', tipo: 'uscita', colore: '#7F77DD', lavoro: true },
  { nome: 'Ordine e ENPAM', tipo: 'uscita', colore: '#534AB7', lavoro: true },
  { nome: 'Assicurazione professionale', tipo: 'uscita', colore: '#CECBF6', lavoro: true },
  { nome: 'Tasse universitarie', tipo: 'uscita', colore: '#3C3489', lavoro: true },
  { nome: 'Altre uscite', tipo: 'uscita', colore: '#D3D1C7' },
]
export const idPredefinita = (nome: string) => `predefinita-${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`

/** Importo scritto dall'utente ("45", "45,50", "1.234,5", "12.5") → centesimi. */
export function centesimiDa(testo: string): number | undefined {
  let t = testo.trim().replace(/€/g, '').replace(/\s/g, '')
  if (!t) return undefined
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : undefined
}

/**
 * Aggiunta veloce: "Spesa 45", "Sostituzione 180", "45 farmacia". L'importo è il numero nel testo;
 * la categoria è quella il cui nome inizia con una delle parole (altrimenti nessuna); il resto diventa la nota.
 */
export function leggiMovimentoVeloce(testo: string, categorie: CategoriaBudget[]): { importoCent?: number; categoria?: CategoriaBudget; nota?: string } {
  const numero = testo.match(/(\d[\d.,]*)\s*€?/)
  const importoCent = numero ? centesimiDa(numero[1]!) : undefined
  const resto = (numero ? testo.replace(numero[0], ' ') : testo).replace(/\s+/g, ' ').trim()
  const parole = resto.toLowerCase().split(' ').filter((p) => p.length >= 3)
  const simili = (a: string, b: string) => {
    let i = 0
    while (i < a.length && a[i] === b[i]) i++
    return a.startsWith(b) || b.startsWith(a) || i >= Math.max(4, Math.min(a.length, b.length) - 2)
  }
  const nomi = (c: CategoriaBudget) => c.nome.toLowerCase().split(/\s+/).filter((n) => n.length >= 3)
  const categoria = categorie.find((c) => parole.some((p) => nomi(c).some((n) => simili(n, p))))
  const usate = categoria ? parole.filter((p) => !nomi(categoria).some((n) => simili(n, p))) : parole
  const nota = categoria ? resto.split(' ').filter((p) => usate.includes(p.toLowerCase())).join(' ') : resto
  return { importoCent, categoria, nota: nota || undefined }
}

const meseDi = (giorno: string) => giorno.slice(0, 7)
const ultimoGiorno = (anno: number, mese: number) => new Date(Date.UTC(anno, mese, 0)).getUTCDate()

/** Giorno in cui cade una ricorrente nel mese dato (o undefined se quel mese non vale). */
export function giornoNelMese(r: Ricorrente, mese: string): string | undefined {
  const inizio = giornoDaChiave(r.inizio)
  if (!inizio || mese < meseDi(r.inizio) || (r.fine && mese > r.fine) || r.saltati?.includes(mese)) return undefined
  const [anno, m] = mese.split('-').map(Number) as [number, number]
  if (r.frequenza === 'anno' && m !== inizio.mese) return undefined
  return chiaveGiorno({ anno, mese: m, giorno: Math.min(inizio.giorno, ultimoGiorno(anno, m)) })
}

/** Una voce del budget: movimento salvato, volta di una ricorrente o compenso di un turno. */
export interface Voce {
  chiave: string
  origine: 'movimento' | 'ricorrente' | 'turno' | 'tassa'
  id: string
  tipo: TipoMovimento
  importoCent: number
  giorno: string
  categoriaId?: string
  titolo: string
  daIncassare?: boolean
}

export interface DatiBudget {
  categorie: CategoriaBudget[]
  movimenti: Movimento[]
  ricorrenti: Ricorrente[]
  turni?: Turno[]
  tasse?: Tassa[]
}

const tipoDa = (t: string): TipoMovimento => (t === 'entrata' ? 'entrata' : 'uscita')

/** Categoria delle entrate da turni (compenso scritto nel turno): sostituzioni MMG o libera professione. */
const categoriaTurno = (t: Turno) => idPredefinita(t.tipo === 'sostituzioneMMG' ? 'Sostituzioni MMG' : 'Libera professione')

/** Tutte le voci di un mese ("2026-10"). */
export function vociDelMese(d: DatiBudget, mese: string): Voce[] {
  const nomi = new Map(d.categorie.map((c) => [c.id, c.nome]))
  const voci: Voce[] = []
  for (const m of d.movimenti) {
    if (meseDi(m.giorno) !== mese) continue
    voci.push({ chiave: `m:${m.id}`, origine: 'movimento', id: m.id, tipo: tipoDa(m.tipo), importoCent: m.importoCent, giorno: m.giorno, categoriaId: m.categoriaId, titolo: m.nota || nomi.get(m.categoriaId) || 'Movimento', daIncassare: m.daIncassare })
  }
  for (const r of d.ricorrenti) {
    const giorno = giornoNelMese(r, mese)
    if (!giorno) continue
    voci.push({ chiave: `r:${r.id}:${mese}`, origine: 'ricorrente', id: r.id, tipo: tipoDa(r.tipo), importoCent: r.importoCent, giorno, categoriaId: r.categoriaId, titolo: r.descrizione || nomi.get(r.categoriaId) || 'Fisso' })
  }
  for (const t of d.turni ?? []) {
    if (!t.compensoCent) continue
    const giorno = chiaveGiorno(giornoDi(t.inizio))
    if (meseDi(giorno) !== mese) continue
    voci.push({ chiave: `t:${t.id}`, origine: 'turno', id: t.id, tipo: 'entrata', importoCent: t.compensoCent, giorno, categoriaId: categoriaTurno(t), titolo: nomi.get(categoriaTurno(t)) ?? 'Compenso turno', daIncassare: t.stato !== 'pagato' })
  }
  // Le tasse universitarie pagate (sezione Specializzazione) contano come uscite, senza riscriverle qui.
  for (const t of d.tasse ?? []) {
    const giorno = t.stato === 'pagato' ? t.pagatoIl ?? t.scadenza : undefined
    if (!giorno || meseDi(giorno) !== mese) continue
    voci.push({ chiave: `k:${t.id}`, origine: 'tassa', id: t.id, tipo: 'uscita', importoCent: t.importoCent, giorno, categoriaId: idPredefinita('Tasse universitarie'), titolo: t.descrizione })
  }
  return voci.sort((a, b) => b.giorno.localeCompare(a.giorno) || a.titolo.localeCompare(b.titolo))
}

export interface Riepilogo {
  entrateCent: number
  extraCent: number
  usciteCent: number
  restoCent: number
  daIncassare: Voce[]
  /** Uscite per categoria, dalla più grande. */
  perCategoria: { categoria: CategoriaBudget; cent: number; tettoCent?: number }[]
}

/**
 * Riepilogo del mese. Le voci future (dopo `oggi`) e quelle da incassare non entrano nei totali:
 * le future sono "scadenze", le da incassare stanno nel loro elenco.
 */
export function riepilogo(d: DatiBudget, mese: string, oggi: string): Riepilogo {
  const categorie = new Map(d.categorie.map((c) => [c.id, c]))
  const voci = vociDelMese(d, mese)
  const contano = voci.filter((v) => v.giorno <= oggi && !v.daIncassare)
  const entrate = contano.filter((v) => v.tipo === 'entrata')
  const uscite = contano.filter((v) => v.tipo === 'uscita')
  const somma = (l: Voce[]) => l.reduce((s, v) => s + v.importoCent, 0)
  const perCat = new Map<string, number>()
  for (const v of uscite) perCat.set(v.categoriaId ?? '', (perCat.get(v.categoriaId ?? '') ?? 0) + v.importoCent)
  const conTetto = d.categorie.filter((c) => c.tipo === 'uscita' && c.tettoCent && !perCat.has(c.id))
  return {
    entrateCent: somma(entrate),
    extraCent: somma(entrate.filter((v) => categorie.get(v.categoriaId ?? '')?.extra)),
    usciteCent: somma(uscite),
    restoCent: somma(entrate) - somma(uscite),
    daIncassare: voci.filter((v) => v.daIncassare),
    perCategoria: [
      ...[...perCat].map(([id, cent]) => ({ categoria: categorie.get(id) ?? { id, nome: 'Senza categoria', tipo: 'uscita', colore: '#D3D1C7', ordine: 999, creatoIl: 0, modificatoIl: 0 }, cent, tettoCent: categorie.get(id)?.tettoCent })),
      ...conTetto.map((c) => ({ categoria: c, cent: 0, tettoCent: c.tettoCent })),
    ].sort((a, b) => b.cent - a.cent || a.categoria.ordine - b.categoria.ordine),
  }
}

/** Mese "2026-10" spostato di n mesi. */
export function spostaMese(mese: string, n: number): string {
  const [a, m] = mese.split('-').map(Number) as [number, number]
  const t = a * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

/** Uscite in arrivo nei prossimi `giorni`: fissi, movimenti con data futura e tasse universitarie da pagare. */
export function prossimeScadenze(d: DatiBudget, oggi: string, giorni = 120): { chiave: string; giorno: string; titolo: string; importoCent: number; link: string }[] {
  const g = giornoDaChiave(oggi)!
  const limite = chiaveGiorno(giornoDi(Date.UTC(g.anno, g.mese - 1, g.giorno + giorni, 12)))
  const out: { chiave: string; giorno: string; titolo: string; importoCent: number; link: string }[] = []
  const mesi = Array.from({ length: Math.ceil(giorni / 28) + 1 }, (_, i) => spostaMese(meseDi(oggi), i))
  for (const mese of mesi) {
    for (const v of vociDelMese({ ...d, turni: [] }, mese)) {
      if (v.tipo === 'uscita' && v.giorno > oggi && v.giorno <= limite) out.push({ chiave: v.chiave, giorno: v.giorno, titolo: v.titolo, importoCent: v.importoCent, link: '#/budget' })
    }
  }
  for (const t of d.tasse ?? []) {
    if (t.stato !== 'pagato' && t.scadenza && t.scadenza <= limite) out.push({ chiave: `tassa:${t.id}`, giorno: t.scadenza, titolo: t.descrizione, importoCent: t.importoCent, link: '#/specializzazione/tasse' })
  }
  return out.sort((a, b) => a.giorno.localeCompare(b.giorno))
}

/** Giorno di oggi in ora italiana. */
export const oggiChiave = () => { const c = componenti(Date.now()); return chiaveGiorno(c) }

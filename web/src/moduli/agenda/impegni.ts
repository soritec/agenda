import { componenti, giornoDi, istante } from '../../nucleo/calendario'
import type { Application, Assegnazione, Attivita, Candidata, Stanza, JournalClub, NotaGiorno, PianoStudio, SessionePiano, EsameOLezione, Evento, GiornataSpeciale, ModelloTurno, Sede, Tassa, Turno } from '../../dati/modello'
import { vociDelMese, spostaMese, type DatiBudget } from '../budget/logica'
import { chiaveGiorno, giornoDaChiave, sedeEffettiva, siglaTurno, titoloTurno } from '../turni/supporto'
import { tipoGiornataDa, tipoTurnoDa, TITOLI_GIORNATA } from '../turni/tipi'

/**
 * L'agenda raccoglie gli impegni di tutte le sezioni in un unico elenco per giorno.
 * Ogni sezione resta la "fonte": l'agenda li mostra e porta alla pagina giusta per modificarli.
 */
export const FONTI = ['nota', 'turno', 'giornata', 'evento', 'task', 'studio', 'esame', 'lezione', 'journal', 'promemoria', 'tassa', 'casa', 'application'] as const
export type Fonte = (typeof FONTI)[number]
export const TITOLI_FONTE: Record<Fonte, string> = {
  nota: 'Note del giorno', turno: 'Turni', giornata: 'Ferie e riposi', evento: 'Impegni', task: 'Task', studio: 'Piani di studio', esame: 'Esami', lezione: 'Lezioni', journal: 'Journal club', promemoria: 'Promemoria', tassa: 'Scadenze', casa: 'Casa', application: 'Applications',
}

/** Nome di una singola voce, mostrato sotto il titolo. */
export const TITOLO_VOCE: Record<Fonte, string> = { nota: 'Nota', turno: 'Turno', giornata: 'Giornata', evento: 'Impegno', task: 'Task', studio: 'Studio', esame: 'Esame', lezione: 'Lezione', journal: 'Journal club', promemoria: 'Promemoria', tassa: 'Scadenza', casa: 'Casa', application: 'Application' }

export const CATEGORIE_EVENTO = ['personale', 'lavoro', 'studio', 'altro'] as const
export type CategoriaEvento = (typeof CATEGORIE_EVENTO)[number]
export const TITOLI_CATEGORIA: Record<CategoriaEvento, string> = { personale: 'Personale', lavoro: 'Lavoro', studio: 'Studio', altro: 'Altro' }
export const categoriaDa = (grezzo: string): CategoriaEvento => (CATEGORIE_EVENTO as readonly string[]).includes(grezzo) ? (grezzo as CategoriaEvento) : 'altro'

export interface Impegno {
  /** Unico nell'agenda: fonte + id del record (+ giorno per gli impegni di più giorni). */
  chiave: string
  fonte: Fonte
  id: string
  /** "2026-10-21" */
  giorno: string
  titolo: string
  dettaglio?: string
  /** Sigla breve per il calendario (turni) */
  sigla?: string
  /** Minuti dalla mezzanotte; assente = tutto il giorno. */
  minutoInizio?: number
  minutoFine?: number
  /** Classe di colore (es. tipo di turno o categoria). */
  colore: string
  /** Pagina dove si modifica. */
  link: string
  /** Completato, pagato o passato: mostrato in trasparenza. */
  concluso?: boolean
  /** Per l'esportazione nel Calendario. */
  modificatoIl: number
}

export interface DatiAgenda {
  turni?: Turno[]
  modelli?: Map<string, ModelloTurno>
  sedi?: Map<string, Sede>
  assegnazioni?: Assegnazione[]
  giornate?: GiornataSpeciale[]
  eventi?: Evento[]
  esami?: EsameOLezione[]
  tasse?: Tassa[]
  attivita?: Attivita[]
  note?: NotaGiorno[]
  journal?: JournalClub[]
  piani?: PianoStudio[]
  /** Dove si modificano esami e lezioni (predefinito: la sezione Specializzazione). */
  linkEsami?: string
  /** Casa: viewing delle candidate, partenze e arrivi delle coinquiline. */
  candidate?: Candidata[]
  /** Application: deadline (finché non è inviata) e date dei passi. */
  applications?: Application[]
  stanze?: Stanza[]
  /** Promemoria ricevuti (dalla chat). */
  promemoria?: { id: string; giorno: string; testo: string; fatto?: boolean; modificatoIl: number; da?: string }[]
  sessioniPiano?: SessionePiano[]
  /** Uscite fisse e in programma del budget, mostrate come scadenze. */
  budget?: DatiBudget
}

const minutoDi = (ms: number) => { const c = componenti(ms); return c.ora * 60 + c.minuto }
const orario = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`
export const testoOrario = (i: Pick<Impegno, 'minutoInizio' | 'minutoFine'>) =>
  i.minutoInizio === undefined ? 'Tutto il giorno' : i.minutoFine !== undefined ? `${orario(i.minutoInizio)}–${orario(i.minutoFine)}` : orario(i.minutoInizio)

/** Giorni da `da` ad `a` compresi ("2026-10-01"…"2026-10-31"). */
export function giorniTra(da: string, a: string): string[] {
  const g = giornoDaChiave(da), f = giornoDaChiave(a)
  if (!g || !f) return []
  const fine = istante(f.anno, f.mese, f.giorno, 12)
  const giorni: string[] = []
  for (let ms = istante(g.anno, g.mese, g.giorno, 12); ms <= fine && giorni.length < 400; ms += 86_400_000) giorni.push(chiaveGiorno(giornoDi(ms)))
  return giorni
}

/** Tutti gli impegni tra due giorni (compresi), ordinati: per giorno, prima quelli di tutto il giorno, poi per orario. */
export function impegniTra(d: DatiAgenda, da: string, a: string, adesso = Date.now()): Impegno[] {
  const dentro = (g: string) => g >= da && g <= a
  const oggi = chiaveGiorno(giornoDi(adesso))
  const out: Impegno[] = []

  for (const t of d.turni ?? []) {
    const giorno = chiaveGiorno(giornoDi(t.inizio))
    if (!dentro(giorno)) continue
    const modelli = d.modelli ?? new Map()
    const sede = d.sedi?.get(sedeEffettiva(t, d.assegnazioni) ?? '')
    out.push({
      chiave: `turno:${t.id}`, fonte: 'turno', id: t.id, giorno, titolo: titoloTurno(t, modelli), sigla: siglaTurno(t, modelli),
      dettaglio: [sede?.nome, t.note].filter(Boolean).join(' · ') || undefined,
      minutoInizio: t.tuttoIlGiorno ? undefined : minutoDi(t.inizio), minutoFine: t.tuttoIlGiorno ? undefined : minutoDi(t.fine),
      colore: `t-${tipoTurnoDa(t.tipo)}`, link: `#/turni/${t.id}`, concluso: t.fine < adesso, modificatoIl: t.modificatoIl,
    })
  }
  for (const g of d.giornate ?? []) {
    if (!dentro(g.giorno)) continue
    const tipo = tipoGiornataDa(g.tipo)
    out.push({
      chiave: `giornata:${g.id}`, fonte: 'giornata', id: g.id, giorno: g.giorno, titolo: TITOLI_GIORNATA[tipo],
      colore: `g-${tipo}`, link: `#/turni?mese=${g.giorno.slice(0, 7)}`, concluso: g.giorno < oggi, modificatoIl: g.modificatoIl,
    })
  }
  for (const n of d.note ?? []) {
    const fine = n.giornoFine && n.giornoFine > n.giorno ? n.giornoFine : n.giorno
    if (fine < da || n.giorno > a) continue
    for (const giorno of fine !== n.giorno ? giorniTra(n.giorno > da ? n.giorno : da, fine < a ? fine : a) : [n.giorno]) {
      out.push({
        chiave: `nota:${n.id}:${giorno}`, fonte: 'nota', id: n.id, giorno, titolo: n.testo,
        dettaglio: fine !== n.giorno ? `fino al ${Number(fine.slice(8, 10))}/${Number(fine.slice(5, 7))}` : undefined,
        colore: 'colore-nota', link: `#/agenda/nota/${n.id}`, modificatoIl: n.modificatoIl,
      })
    }
  }
  for (const e of d.eventi ?? []) {
    const fine = e.giornoFine && e.giornoFine > e.giorno ? e.giornoFine : e.giorno
    if (fine < da || e.giorno > a) continue
    const piuGiorni = fine !== e.giorno
    for (const giorno of piuGiorni ? giorniTra(e.giorno > da ? e.giorno : da, fine < a ? fine : a) : [e.giorno]) {
      const primo = giorno === e.giorno, ultimo = giorno === fine
      const conOrari = !e.tuttoIlGiorno && e.minutoInizio !== undefined && !piuGiorni
      out.push({
        chiave: `evento:${e.id}:${giorno}`, fonte: 'evento', id: e.id, giorno, titolo: e.titolo,
        dettaglio: [piuGiorni ? (primo ? 'inizio' : ultimo ? 'fine' : 'in corso') : '', e.luogo, e.note].filter(Boolean).join(' · ') || undefined,
        minutoInizio: conOrari ? e.minutoInizio : undefined, minutoFine: conOrari ? e.minutoFine : undefined,
        colore: `c-${categoriaDa(e.categoria)}`, link: `#/agenda/evento/${e.id}`, concluso: fine < oggi, modificatoIl: e.modificatoIl,
      })
    }
  }
  for (const e of d.esami ?? []) {
    if (!dentro(e.giorno)) continue
    const fonte: Fonte = e.tipo === 'lezione' ? 'lezione' : 'esame'
    out.push({
      chiave: `${fonte}:${e.id}`, fonte, id: e.id, giorno: e.giorno, titolo: e.titolo,
      dettaglio: [e.materia, e.esito].filter(Boolean).join(' · ') || undefined,
      colore: `colore-${fonte}`, link: d.linkEsami ?? `#/specializzazione/${fonte === 'esame' ? 'esami' : 'lezioni'}`,
      concluso: Boolean(e.completato) || e.giorno < oggi, modificatoIl: e.modificatoIl,
    })
  }
  const piani = new Map((d.piani ?? []).map((p) => [p.id, p]))
  for (const s of d.sessioniPiano ?? []) {
    const p = piani.get(s.pianoId)
    if (!p || !dentro(s.giorno)) continue
    out.push({
      chiave: `studio:${s.id}`, fonte: 'studio', id: s.id, giorno: s.giorno, titolo: `${s.tipo === 'studio' ? 'Studio: ' : ''}${s.titolo}`,
      dettaglio: [p.nome, s.paginaDa !== undefined ? `p. ${s.paginaDa}–${s.paginaA}` : '', `${s.minuti} min`].filter(Boolean).join(' · '),
      colore: 'colore-studio', link: '#/studio', concluso: Boolean(s.fatta), modificatoIl: s.modificatoIl,
    })
  }
  for (const ap of d.applications ?? []) {
    if (ap.deadline && dentro(ap.deadline)) {
      out.push({
        chiave: `application:deadline:${ap.id}`, fonte: 'application', id: ap.id, giorno: ap.deadline, titolo: `Deadline: ${ap.studio}`,
        colore: 'colore-application', link: '#/applications', concluso: ap.fatti > 0 || Boolean(ap.nonPassata) || ap.deadline < oggi, modificatoIl: ap.modificatoIl,
      })
    }
    ap.passi.forEach((p, i) => {
      const dt = ap.datePassi?.[p]
      if (!dt || !dentro(dt.giorno)) return
      out.push({
        chiave: `application:${i}:${ap.id}`, fonte: 'application', id: ap.id, giorno: dt.giorno, titolo: `${ap.studio}: ${p}`,
        minutoInizio: dt.minuto, minutoFine: dt.minuto !== undefined ? Math.min(1439, dt.minuto + 60) : undefined,
        colore: 'colore-application', link: '#/applications', concluso: i < ap.fatti || Boolean(ap.nonPassata) || dt.giorno < oggi, modificatoIl: ap.modificatoIl,
      })
    })
  }
  for (const c of d.candidate ?? []) {
    if (!c.viewing || c.valutazione === 'no') continue
    const g = chiaveGiorno(giornoDi(c.viewing))
    if (!dentro(g)) continue
    const inizio = minutoDi(c.viewing)
    out.push({
      chiave: `casa:viewing:${c.id}`, fonte: 'casa', id: c.id, giorno: g, titolo: `Viewing: ${c.nome}`, dettaglio: c.generalita,
      minutoInizio: inizio, minutoFine: Math.min(1439, inizio + 30), colore: 'colore-casa', link: '#/casa', concluso: c.stato === 'fatta' || g < oggi, modificatoIl: c.modificatoIl,
    })
  }
  for (const s of d.stanze ?? []) {
    if (s.esceIl && dentro(s.esceIl)) {
      out.push({ chiave: `casa:esce:${s.id}`, fonte: 'casa', id: s.id, giorno: s.esceIl, titolo: `Se ne va ${s.nome || 'una coinquilina'}`, colore: 'colore-casa', link: '#/casa', concluso: s.esceIl < oggi, modificatoIl: s.modificatoIl })
    }
    if (s.prossima && dentro(s.prossima.dal)) {
      out.push({ chiave: `casa:arriva:${s.id}`, fonte: 'casa', id: s.id, giorno: s.prossima.dal, titolo: `Arriva ${s.prossima.nome}`, colore: 'colore-casa', link: '#/casa', concluso: s.prossima.dal < oggi, modificatoIl: s.modificatoIl })
    }
  }
  for (const p of d.promemoria ?? []) {
    if (!dentro(p.giorno)) continue
    out.push({
      chiave: `promemoria:${p.id}`, fonte: 'promemoria', id: p.id, giorno: p.giorno, titolo: p.testo, dettaglio: p.da ? `promemoria da ${p.da}` : 'promemoria',
      colore: 'colore-promemoria', link: '#/chat', concluso: Boolean(p.fatto), modificatoIl: p.modificatoIl,
    })
  }
  for (const j of d.journal ?? []) {
    if (!dentro(j.giorno)) continue
    out.push({
      chiave: `journal:${j.id}`, fonte: 'journal', id: j.id, giorno: j.giorno, titolo: `Journal club: ${j.titolo}`, dettaglio: j.rivista,
      colore: 'colore-journal', link: '#/specializzazione/journal', concluso: Boolean(j.presentato) || j.giorno < oggi, modificatoIl: j.modificatoIl,
    })
  }
  for (const t of d.attivita ?? []) {
    if (!t.scadenza || !dentro(t.scadenza)) continue
    const minuto = t.minuto !== undefined && t.minuto >= 0 && t.minuto < 1440 ? t.minuto : undefined
    out.push({
      chiave: `task:${t.id}`, fonte: 'task', id: t.id, giorno: t.scadenza, titolo: t.titolo,
      dettaglio: [t.priorita === 'alta' ? 'priorità alta' : '', t.completataIl ? 'fatto' : ''].filter(Boolean).join(' · ') || undefined,
      minutoInizio: minuto, minutoFine: minuto !== undefined ? Math.min(minuto + 30, 1439) : undefined,
      colore: t.completataIl ? 'colore-task fatto' : 'colore-task', link: `#/task/${t.id}`,
      concluso: Boolean(t.completataIl), modificatoIl: t.modificatoIl,
    })
  }
  if (d.budget) {
    for (let mese = da.slice(0, 7); mese <= a.slice(0, 7); mese = spostaMese(mese, 1)) {
      for (const v of vociDelMese({ ...d.budget, turni: [], tasse: [] }, mese)) {
        if (v.tipo !== 'uscita' || !dentro(v.giorno) || (v.origine === 'movimento' && v.giorno <= oggi)) continue
        out.push({
          chiave: `budget:${v.chiave}`, fonte: 'tassa', id: v.id, giorno: v.giorno, titolo: v.titolo,
          dettaglio: (v.importoCent / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }),
          colore: v.giorno < oggi ? 'colore-pagato' : 'colore-inScadenza', link: `#/budget?mese=${mese}`, concluso: v.giorno < oggi, modificatoIl: 0,
        })
      }
    }
  }
  for (const t of d.tasse ?? []) {
    if (!t.scadenza || !dentro(t.scadenza)) continue
    const pagata = t.stato === 'pagato'
    out.push({
      chiave: `tassa:${t.id}`, fonte: 'tassa', id: t.id, giorno: t.scadenza, titolo: `Scadenza: ${t.descrizione}`,
      dettaglio: `${(t.importoCent / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}${pagata ? ' · pagata' : ''}`,
      colore: pagata ? 'colore-pagato' : t.scadenza < oggi ? 'colore-scaduta' : 'colore-inScadenza', link: '#/specializzazione/tasse',
      concluso: pagata, modificatoIl: t.modificatoIl,
    })
  }

  return out.sort((x, y) => x.giorno.localeCompare(y.giorno)
    || (x.minutoInizio ?? -1) - (y.minutoInizio ?? -1)
    || FONTI.indexOf(x.fonte) - FONTI.indexOf(y.fonte)
    || x.titolo.localeCompare(y.titolo))
}

export function perGiorno(impegni: Impegno[]): Map<string, Impegno[]> {
  const m = new Map<string, Impegno[]>()
  for (const i of impegni) m.set(i.giorno, [...(m.get(i.giorno) ?? []), i])
  return m
}

/* Vista a settimana: blocchi orari per colonna */

export interface Blocco {
  impegno: Impegno
  /** Minuti dalla mezzanotte del giorno della colonna (0–1440). */
  da: number
  a: number
  /** Il blocco continua dal giorno prima o nel giorno dopo (es. guardia notturna). */
  continuaPrima?: boolean
  continuaDopo?: boolean
  /** Corsia e numero di corsie del gruppo di blocchi che si sovrappongono. */
  corsia: number
  corsie: number
}

const giornoDopo = (g: string) => {
  const c = giornoDaChiave(g)!
  return chiaveGiorno(giornoDi(istante(c.anno, c.mese, c.giorno, 12) + 86_400_000))
}

/**
 * Divide gli impegni con orario in blocchi per giorno: quelli che passano la mezzanotte
 * finiscono a 24:00 e continuano il giorno dopo da 0:00. Gli impegni di tutto il giorno restano fuori.
 */
export function blocchiPerGiorno(impegni: Impegno[], giorni: string[]): Map<string, Blocco[]> {
  const grezzi = new Map<string, Omit<Blocco, 'corsia' | 'corsie'>[]>(giorni.map((g) => [g, []]))
  for (const i of impegni) {
    if (i.minutoInizio === undefined) continue
    const fine = i.minutoFine ?? i.minutoInizio + 60
    const attraversa = fine <= i.minutoInizio && i.minutoFine !== undefined
    grezzi.get(i.giorno)?.push({ impegno: i, da: i.minutoInizio, a: attraversa ? 1440 : Math.max(fine, i.minutoInizio + 30), continuaDopo: attraversa || undefined })
    if (attraversa && fine > 0) grezzi.get(giornoDopo(i.giorno))?.push({ impegno: i, da: 0, a: fine, continuaPrima: true })
  }
  const out = new Map<string, Blocco[]>()
  for (const [g, elenco] of grezzi) out.set(g, disponi(elenco))
  return out
}

/** Affianca i blocchi che si sovrappongono: ognuno prende la prima corsia libera del suo gruppo. */
export function disponi<T extends { da: number; a: number }>(blocchi: T[]): (T & { corsia: number; corsie: number })[] {
  const ordinati = [...blocchi].sort((x, y) => x.da - y.da || y.a - x.a)
  const out: (T & { corsia: number; corsie: number })[] = []
  let gruppo: (T & { corsia: number; corsie: number })[] = []
  let fineGruppo = -1
  const chiudi = () => { const n = Math.max(1, ...gruppo.map((b) => b.corsia + 1)); for (const b of gruppo) b.corsie = n; out.push(...gruppo); gruppo = [] }
  for (const b of ordinati) {
    if (b.da >= fineGruppo) { chiudi(); fineGruppo = -1 }
    const occupate = new Set(gruppo.filter((x) => x.a > b.da).map((x) => x.corsia))
    let corsia = 0
    while (occupate.has(corsia)) corsia++
    gruppo.push({ ...b, corsia, corsie: 1 })
    fineGruppo = Math.max(fineGruppo, b.a)
  }
  chiudi()
  return out
}

/** Lunedì della settimana del giorno dato. */
export function lunediDi(giorno: string): string {
  const c = giornoDaChiave(giorno)!
  const ms = istante(c.anno, c.mese, c.giorno, 12)
  const dow = componenti(ms).giornoSettimana
  return chiaveGiorno(giornoDi(ms - (dow - 1) * 86_400_000))
}

export function spostaGiorni(giorno: string, n: number): string {
  const c = giornoDaChiave(giorno)!
  return chiaveGiorno(giornoDi(istante(c.anno, c.mese, c.giorno, 12) + n * 86_400_000))
}

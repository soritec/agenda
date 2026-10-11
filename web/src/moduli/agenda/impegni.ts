import { componenti, giornoDi, istante } from '../../nucleo/calendario'
import type { Assegnazione, EsameOLezione, Evento, GiornataSpeciale, ModelloTurno, Sede, Tassa, Turno } from '../../dati/modello'
import { chiaveGiorno, giornoDaChiave, sedeEffettiva, siglaTurno, titoloTurno } from '../turni/supporto'
import { tipoGiornataDa, tipoTurnoDa, TITOLI_GIORNATA } from '../turni/tipi'

/**
 * L'agenda raccoglie gli impegni di tutte le sezioni in un unico elenco per giorno.
 * Ogni sezione resta la "fonte": l'agenda li mostra e porta alla pagina giusta per modificarli.
 */
export const FONTI = ['turno', 'giornata', 'evento', 'esame', 'lezione', 'tassa'] as const
export type Fonte = (typeof FONTI)[number]
export const TITOLI_FONTE: Record<Fonte, string> = {
  turno: 'Turni', giornata: 'Ferie e riposi', evento: 'Impegni', esame: 'Esami', lezione: 'Lezioni', tassa: 'Scadenze tasse',
}

/** Nome di una singola voce, mostrato sotto il titolo. */
export const TITOLO_VOCE: Record<Fonte, string> = { turno: 'Turno', giornata: 'Giornata', evento: 'Impegno', esame: 'Esame', lezione: 'Lezione', tassa: 'Tassa' }

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
      colore: `colore-${fonte}`, link: `#/specializzazione/${fonte === 'esame' ? 'esami' : 'lezioni'}`,
      concluso: Boolean(e.completato) || e.giorno < oggi, modificatoIl: e.modificatoIl,
    })
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

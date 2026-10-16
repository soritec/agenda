import type { Attivita } from '../../dati/modello'
import { giornoDaChiave, chiaveGiorno } from '../turni/supporto'

export const AREE = ['personale', 'lavoro', 'specializzazione', 'studio', 'casa', 'altro'] as const
export type Area = (typeof AREE)[number]
export const TITOLI_AREA: Record<Area, string> = { personale: 'Personale', lavoro: 'Lavoro', specializzazione: 'Specializzazione', studio: 'Studio', casa: 'Casa', altro: 'Altro' }
export const areaDa = (grezzo: string): Area => ((AREE as readonly string[]).includes(grezzo) ? (grezzo as Area) : 'altro')

/** In ordine di importanza; 'nessuna' è quella di partenza (anche per i vecchi 'normale'). */
export const PRIORITA = ['alta', 'media', 'bassa', 'nessuna'] as const
export type Priorita = (typeof PRIORITA)[number]
export const TITOLI_PRIORITA: Record<Priorita, string> = { alta: 'Alta', media: 'Media', bassa: 'Bassa', nessuna: 'Nessuna' }
/** Punti esclamativi mostrati accanto al titolo. */
export const SEGNI_PRIORITA: Record<Priorita, string> = { alta: '!!!', media: '!!', bassa: '!', nessuna: '' }
export const prioritaDa = (grezzo: string | undefined): Priorita => ((PRIORITA as readonly string[]).includes(grezzo ?? '') ? (grezzo as Priorita) : 'nessuna')

export const RIPETIZIONI = ['mai', 'giorno', 'settimana', 'mese', 'anno'] as const
export type Ripetizione = (typeof RIPETIZIONI)[number]
export const TITOLI_RIPETIZIONE: Record<Ripetizione, string> = { mai: 'Non si ripete', giorno: 'Ogni giorno', settimana: 'Ogni settimana', mese: 'Ogni mese', anno: 'Ogni anno' }
export const ripetizioneDa = (grezzo: string | undefined): Ripetizione => ((RIPETIZIONI as readonly string[]).includes(grezzo ?? '') ? (grezzo as Ripetizione) : 'mai')

/** Giorno + n giorni, sul calendario (senza ore: niente sorprese con l'ora legale). */
export function piuGiorni(giorno: string, n: number): string {
  const g = giornoDaChiave(giorno)!
  const d = new Date(Date.UTC(g.anno, g.mese - 1, g.giorno + n))
  return chiaveGiorno({ anno: d.getUTCFullYear(), mese: d.getUTCMonth() + 1, giorno: d.getUTCDate() })
}

/** Prossima scadenza di un task che si ripete. Il 31 del mese diventa l'ultimo giorno dei mesi più corti. */
export function prossimaScadenza(giorno: string, ripeti: Ripetizione): string | undefined {
  const g = giornoDaChiave(giorno)
  if (!g || ripeti === 'mai') return undefined
  if (ripeti === 'giorno') return piuGiorni(giorno, 1)
  if (ripeti === 'settimana') return piuGiorni(giorno, 7)
  const anno = g.anno + (ripeti === 'anno' ? 1 : g.mese === 12 ? 1 : 0)
  const mese = ripeti === 'anno' ? g.mese : (g.mese % 12) + 1
  const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate()
  return chiaveGiorno({ anno, mese, giorno: Math.min(g.giorno, ultimo) })
}

/**
 * Completa (o riapre) un task. Se si ripete, restituisce anche la copia con la scadenza successiva
 * (passi tutti da rifare).
 */
export function completa(t: Attivita, adesso: number): { aggiornato: Attivita; prossimo?: Omit<Attivita, 'id' | 'creatoIl' | 'modificatoIl'> } {
  if (t.completataIl) return { aggiornato: { ...t, completataIl: undefined } }
  const aggiornato = { ...t, completataIl: adesso }
  const ripeti = ripetizioneDa(t.ripeti)
  if (ripeti === 'mai' || !t.scadenza) return { aggiornato }
  const { id: _id, creatoIl: _c, modificatoIl: _m, completataIl: _f, eliminatoIl: _e, ...resto } = t
  return {
    aggiornato,
    prossimo: { ...resto, scadenza: prossimaScadenza(t.scadenza, ripeti), passi: t.passi?.map((p) => ({ testo: p.testo })) },
  }
}

export type Gruppo = 'inRitardo' | 'oggi' | 'domani' | 'prossimi' | 'senzaData' | 'completati'
export const TITOLI_GRUPPO: Record<Gruppo, string> = {
  inRitardo: 'In ritardo', oggi: 'Oggi', domani: 'Domani', prossimi: 'Più avanti', senzaData: 'Senza data', completati: 'Completati',
}

/** Divide i task nei gruppi della pagina, ognuno ordinato (priorità alta prima, poi scadenza e ora). */
export function raggruppa(elenco: Attivita[], oggi: string): Record<Gruppo, Attivita[]> {
  const domani = piuGiorni(oggi, 1)
  const g: Record<Gruppo, Attivita[]> = { inRitardo: [], oggi: [], domani: [], prossimi: [], senzaData: [], completati: [] }
  for (const t of elenco) {
    if (t.completataIl) g.completati.push(t)
    else if (!t.scadenza) g.senzaData.push(t)
    else if (t.scadenza < oggi) g.inRitardo.push(t)
    else if (t.scadenza === oggi) g.oggi.push(t)
    else if (t.scadenza === domani) g.domani.push(t)
    else g.prossimi.push(t)
  }
  const ordine = (a: Attivita, b: Attivita) =>
    (a.scadenza ?? '9999').localeCompare(b.scadenza ?? '9999')
    || PRIORITA.indexOf(prioritaDa(a.priorita)) - PRIORITA.indexOf(prioritaDa(b.priorita))
    || (a.minuto ?? 9999) - (b.minuto ?? 9999)
    || a.creatoIl - b.creatoIl
  for (const k of Object.keys(g) as Gruppo[]) g[k].sort(ordine)
  g.completati.sort((a, b) => (b.completataIl ?? 0) - (a.completataIl ?? 0))
  return g
}

/**
 * Inserimento veloce: "Chiamare segreteria domani 9:30 !" → titolo, scadenza, ora e priorità.
 * Riconosce oggi, domani, dopodomani, i giorni della settimana (il prossimo), un orario hh:mm o "alle 9", e "!" per priorità alta.
 * Quello che non è scritto (giorno, priorità) lo decide chi chiama, con i pulsanti accanto al campo.
 */
export function leggiTestoVeloce(testo: string, oggi: string, giornoSettimanaOggi: number): { titolo: string; scadenza?: string; minuto?: number; priorita?: 'alta' } {
  let t = ` ${testo.trim()} `
  let scadenza: string | undefined, minuto: number | undefined
  let priorita: 'alta' | undefined
  if (/\s!+\s?/.test(t) || /!\s*$/.test(t)) { priorita = 'alta'; t = t.replace(/!+/g, ' ') }
  const ora = t.match(/\s(?:alle\s+)?(\d{1,2})[:.](\d{2})\s/i) ?? t.match(/\salle\s+(\d{1,2})\s/i)
  if (ora) {
    const h = Number(ora[1]), m = Number(ora[2] ?? 0)
    if (h < 24 && m < 60) { minuto = h * 60 + m; t = t.replace(ora[0], ' ') }
  }
  const giorni = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
  const parole: [RegExp, () => string][] = [
    [/\sdopodomani\s/i, () => piuGiorni(oggi, 2)],
    [/\sdomani\s/i, () => piuGiorni(oggi, 1)],
    [/\soggi\s/i, () => oggi],
    ...giorni.map((nome, i): [RegExp, () => string] => [
      new RegExp(`\\s(?:${nome}|${nome.replace('ì', 'i')})\\s`, 'i'),
      () => piuGiorni(oggi, ((i + 1 - giornoSettimanaOggi + 7) % 7) || 7),
    ]),
  ]
  for (const [re, calcola] of parole) {
    if (re.test(t)) { scadenza = calcola(); t = t.replace(re, ' '); break }
  }
  return { titolo: t.replace(/\s+/g, ' ').trim(), scadenza, minuto, priorita }
}

export const SCHEDE = ['oggi', 'programmati', 'senzaData'] as const
export type Scheda = (typeof SCHEDE)[number]
export const TITOLI_SCHEDA: Record<Scheda, string> = { oggi: 'Oggi', programmati: 'Programmati', senzaData: 'Senza data' }

const perPriorita = (a: Attivita, b: Attivita) =>
  PRIORITA.indexOf(prioritaDa(a.priorita)) - PRIORITA.indexOf(prioritaDa(b.priorita))
  || (a.minuto ?? 9999) - (b.minuto ?? 9999) || a.creatoIl - b.creatoIl

/**
 * Task divisi nelle tre schede della pagina. I fatti restano visibili (in fondo, in trasparenza):
 * in Oggi quelli completati da oggi, in Senza data quelli completati negli ultimi 7 giorni,
 * nei Programmati finché il loro giorno non è passato.
 */
export function perScheda(elenco: Attivita[], oggi: string, inizioOggi: number) {
  const aperti = elenco.filter((t) => !t.completataIl)
  const fatti = elenco.filter((t) => t.completataIl)
  const inRitardo = aperti.filter((t) => t.scadenza && t.scadenza < oggi).sort((a, b) => a.scadenza!.localeCompare(b.scadenza!) || perPriorita(a, b))
  const oggiAperti = aperti.filter((t) => t.scadenza === oggi).sort(perPriorita)
  const oggiFatti = fatti.filter((t) => t.scadenza && t.scadenza <= oggi && t.completataIl! >= inizioOggi).sort(perPriorita)

  const programmati = new Map<string, Attivita[]>()
  for (const t of elenco.filter((x) => x.scadenza && x.scadenza > oggi).sort((a, b) =>
    a.scadenza!.localeCompare(b.scadenza!) || Number(Boolean(a.completataIl)) - Number(Boolean(b.completataIl)) || perPriorita(a, b))) {
    programmati.set(t.scadenza!, [...(programmati.get(t.scadenza!) ?? []), t])
  }
  const settimanaFa = inizioOggi - 7 * 86_400_000
  const senzaData = [
    ...aperti.filter((t) => !t.scadenza).sort(perPriorita),
    ...fatti.filter((t) => !t.scadenza && t.completataIl! >= settimanaFa).sort((a, b) => b.completataIl! - a.completataIl!),
  ]
  return {
    oggi: { inRitardo, aperti: oggiAperti, fatti: oggiFatti },
    programmati,
    senzaData,
    conteggi: {
      oggi: inRitardo.length + oggiAperti.length,
      programmati: aperti.filter((t) => t.scadenza && t.scadenza > oggi).length,
      senzaData: aperti.filter((t) => !t.scadenza).length,
    } satisfies Record<Scheda, number>,
  }
}

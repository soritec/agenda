import type { Bolletta, Candidata, Casa, PagamentoCasa, Stanza } from '../../dati/modello'
import type { Voce } from '../budget/logica'
import { aggiungiGiorni, giorniNelMese } from '../../nucleo/calendario'
import { giorniTra } from '../agenda/impegni'
import { chiaveGiorno, giornoDaChiave } from '../turni/supporto'

/**
 * Conti della casa: chi usa il profilo paga tutto l'affitto e le bills, le coinquiline le danno
 * la loro stanza più una quota fissa al mese per le bills; a fine mese si confronta la quota con le bills vere.
 */

export const CASA_PREDEFINITA = { affittoTotaleCent: 0, quotaBolletteCent: 15000, giornoAffitto: 1 }

/** Bills di partenza (nomi in inglese, come in Inghilterra). */
export const BOLLETTE_INIZIALI: { nome: string; icona: string; giorno: number }[] = [
  { nome: 'Electricity', icona: 'luce', giorno: 1 },
  { nome: 'Heating and hot water', icona: 'riscaldamento', giorno: 1 },
  { nome: 'Water', icona: 'acqua', giorno: 1 },
  { nome: 'Wifi', icona: 'wifi', giorno: 1 },
  { nome: 'Council tax', icona: 'comune', giorno: 1 },
]

/** Colori tenui della palette (sfondo, testo) per i riquadri delle bills. */
export const COLORI_BOLLETTA: [string, string][] = [
  ['#F6EEDF', '#6B5317'], ['#EADFE6', '#5A3E57'], ['#D8E2EE', '#2F4560'], ['#E6E6F1', '#45456A'],
  ['#DCEBD9', '#33553A'], ['#D6EAE8', '#21524E'], ['#F0D8CC', '#7A3E28'], ['#ECEAE6', '#4A4740'],
]
export const testoBolletta = (sfondo: string) => COLORI_BOLLETTA.find(([s]) => s === sfondo)?.[1] ?? '#4A4740'

/** Colori dei nomi nelle stanze (solo il testo è colorato). */
export const COLORI_STANZA = ['#2F4560', '#2E6B66', '#8A4F45', '#5A3E57', '#6B5317', '#45456A']

/** Cose da fare quando una coinquilina lascia la casa (si possono aggiungere altre voci). */
export const VOCI_USCITA = ['Chiavi restituite', 'Stanza pulita e controllata', 'Conguaglio delle bills', 'Sua parte del deposito restituita']

export const VALUTAZIONI = ['buono', 'forse', 'piuNo', 'no'] as const
export type Valutazione = (typeof VALUTAZIONI)[number]
export const TITOLI_VALUTAZIONE: Record<Valutazione, string> = { buono: 'Buon fit', forse: 'Forse', piuNo: 'Più no che sì', no: 'Assolutamente no' }
export const valutazioneDa = (v?: string): Valutazione => ((VALUTAZIONI as readonly string[]).includes(v ?? '') ? (v as Valutazione) : 'forse')

export const STATI_CANDIDATA = ['attesa', 'risposto', 'fissata', 'fatta'] as const
export type StatoCandidata = (typeof STATI_CANDIDATA)[number]
export const TITOLI_STATO_CANDIDATA: Record<StatoCandidata, string> = { attesa: 'In attesa di risposta', risposto: 'Risposto', fissata: 'Viewing arranged', fatta: 'Viewing completed' }
export const statoCandidataDa = (v?: string): StatoCandidata => ((STATI_CANDIDATA as readonly string[]).includes(v ?? '') ? (v as StatoCandidata) : 'attesa')

/** 'proprietario' = l'affitto del mese pagato al proprietario (riferimento: 'casa'). */
export type TipoPagamento = 'affitto' | 'bolletta' | 'conguaglio' | 'proprietario'
export const idPagamento = (tipo: TipoPagamento, riferimentoId: string, mese: string) => `${tipo}:${riferimentoId}:${mese}`

/** Quanto resta da pagare per la propria stanza: affitto totale meno le stanze delle altre. */
export function quotaPropria(casa: Pick<Casa, 'affittoTotaleCent'>, stanze: Stanza[]): number {
  return casa.affittoTotaleCent - stanze.filter((s) => !s.propria).reduce((t, s) => t + s.affittoCent, 0)
}

/** Ultimo giorno del mese "2026-10" → "2026-10-31". */
export function fineMese(mese: string): string {
  const [a, m] = mese.split('-').map(Number) as [number, number]
  return `${mese}-${String(giorniNelMese(a, m)).padStart(2, '0')}`
}

/** Chi abita la stanza in quel giorno: dopo l'arrivo della prossima coinquilina, è lei. */
export function occupante(s: Stanza, giorno: string): string {
  return s.prossima && s.prossima.dal <= giorno ? s.prossima.nome : s.nome
}

/** Se la prossima coinquilina è già arrivata, la stanza passa a lei (restituisce la stanza aggiornata). */
export function passaggioDiStanza(s: Stanza, oggi: string): Stanza | undefined {
  if (!s.prossima || s.prossima.dal > oggi) return undefined
  const { prossima, esceIl: _e, preavvisoIl: _p, ...resto } = s
  return { ...resto, nome: prossima.nome, dal: prossima.dal }
}

/** Il giorno dopo la partenza (quando la stanza è libera). */
export function giornoDopo(giorno: string): string {
  const g = giornoDaChiave(giorno)
  return g ? chiaveGiorno(aggiungiGiorni(g, 1)) : giorno
}

export function giorniMancanti(da: string, a: string): number {
  if (a < da) return 0
  return giorniTra(da, a).length - 1
}

export interface BollettaDelMese { b: Bolletta; importoCent: number; pagata: boolean; pagamento?: PagamentoCasa }

export function bolletteDelMese(bollette: Bolletta[], pagamenti: Map<string, PagamentoCasa>, mese: string): BollettaDelMese[] {
  return [...bollette].sort((a, b) => a.ordine - b.ordine).map((b) => {
    const p = pagamenti.get(idPagamento('bolletta', b.id, mese))
    return { b, importoCent: p?.importoCent ?? b.importoCent, pagata: Boolean(p?.fatto), pagamento: p }
  })
}

export interface ContiMese {
  totaleCent: number
  persone: number
  /** Parte di ognuna (bills diviso il numero di persone). */
  quotaCent: number
  /** Quota fissa versata da ogni coinquilina. */
  versatoCent: number
  /** Positivo = avanza, da restituire a ognuna; negativo = ognuna deve ancora. */
  differenzaCent: number
}

export function contiMese(bills: { importoCent: number }[], stanze: Stanza[], quotaBolletteCent: number): ContiMese {
  const totaleCent = bills.reduce((t, b) => t + b.importoCent, 0)
  const persone = Math.max(1, stanze.length)
  const quotaCent = Math.round(totaleCent / persone)
  return { totaleCent, persone, quotaCent, versatoCent: quotaBolletteCent, differenzaCent: quotaBolletteCent - quotaCent }
}

/** Candidate in ordine: prima le più promettenti, poi per viewing più vicina; le "assolutamente no" in fondo. */
export function ordinaCandidate(c: Candidata[]): Candidata[] {
  return [...c].sort((a, b) => VALUTAZIONI.indexOf(valutazioneDa(a.valutazione)) - VALUTAZIONI.indexOf(valutazioneDa(b.valutazione))
    || (a.viewing ?? Infinity) - (b.viewing ?? Infinity) || b.creatoIl - a.creatoIl)
}

/**
 * Voci del Budget calcolate dalla Casa per un mese: affitto pagato al proprietario e bills (uscite),
 * affitto + quota bills ricevuti dalle coinquiline (entrate, "da incassare" finché non arrivano), conguaglio.
 */
export function vociCasaDelMese(d: { casa?: Casa; stanze: Stanza[]; bollette: Bolletta[]; pagamenti: PagamentoCasa[] }, mese: string, categorie: { uscita: string; entrata: string }): Voce[] {
  if (!d.casa || d.stanze.length === 0) return []
  const pag = new Map(d.pagamenti.map((p) => [p.id, p]))
  const giornoDel = (g: number) => `${mese}-${String(Math.min(g, Number(fineMese(mese).slice(8)))).padStart(2, '0')}`
  const voci: Voce[] = []
  const giornoAffitto = giornoDel(d.casa.giornoAffitto ?? 1)
  if (d.casa.affittoTotaleCent > 0) {
    voci.push({ chiave: `casa:affitto:${mese}`, origine: 'casa', id: 'affitto', tipo: 'uscita', importoCent: d.casa.affittoTotaleCent, giorno: giornoAffitto, categoriaId: categorie.uscita, titolo: 'Affitto' })
  }
  const bills = bolletteDelMese(d.bollette, pag, mese)
  for (const { b, importoCent } of bills) {
    if (importoCent > 0) voci.push({ chiave: `casa:bill:${b.id}:${mese}`, origine: 'casa', id: b.id, tipo: 'uscita', importoCent, giorno: giornoDel(b.giorno), categoriaId: categorie.uscita, titolo: b.nome })
  }
  const conti = contiMese(bills, d.stanze, d.casa.quotaBolletteCent)
  for (const s of d.stanze.filter((x) => !x.propria)) {
    const nome = occupante(s, fineMese(mese)) || 'coinquilina'
    const ricevuto = pag.get(idPagamento('affitto', s.id, mese))?.fatto
    voci.push({ chiave: `casa:da:${s.id}:${mese}`, origine: 'casa', id: s.id, tipo: 'entrata', importoCent: s.affittoCent + d.casa.quotaBolletteCent, giorno: giornoAffitto, categoriaId: categorie.entrata, titolo: `Affitto e bills da ${nome}`, daIncassare: !ricevuto || undefined })
    if (conti.differenzaCent !== 0 && conti.totaleCent > 0) {
      const fatto = pag.get(idPagamento('conguaglio', s.id, mese))?.fatto
      voci.push({
        chiave: `casa:cong:${s.id}:${mese}`, origine: 'casa', id: s.id, tipo: conti.differenzaCent > 0 ? 'uscita' : 'entrata', importoCent: Math.abs(conti.differenzaCent), giorno: fineMese(mese),
        categoriaId: conti.differenzaCent > 0 ? categorie.uscita : categorie.entrata, titolo: conti.differenzaCent > 0 ? `Conguaglio bills a ${nome}` : `Conguaglio bills da ${nome}`,
        daIncassare: conti.differenzaCent < 0 && !fatto ? true : undefined,
      })
    }
  }
  return voci
}

import { giornoDi, giornoSettimana, giorniNelMese, type GiornoCivile } from '../../nucleo/calendario'
import type { GiornoMese } from '../../nucleo/festivita'
import type { Impostazioni, ModelloTurno, Sede, Turno } from '../../dati/modello'
import type { OpzioniRiepilogo } from './riepilogo'
import { tipoTurnoDa, TITOLI_TIPO_TURNO, type DatiTurno, type TipoTurno } from './tipi'

/** Dal record salvato ai dati usati dai calcoli. */
export function datiDa(t: Turno): DatiTurno {
  return {
    id: t.id, inizio: t.inizio, fine: t.fine, tipo: tipoTurnoDa(t.tipo),
    sedeId: t.sedeId, enteId: t.enteId, minutiManuali: t.minutiManuali, compensoCent: t.compensoCent,
  }
}

export function titoloTurno(t: Pick<Turno, 'tipo' | 'modelloId'>, modelli: Map<string, ModelloTurno>): string {
  const m = t.modelloId ? modelli.get(t.modelloId) : undefined
  return m?.nome ?? TITOLI_TIPO_TURNO[tipoTurnoDa(t.tipo)]
}

/** Sigla da mostrare nel calendario: quella del turno tipo, altrimenti l'iniziale del tipo. */
export function siglaTurno(t: Pick<Turno, 'tipo' | 'modelloId'>, modelli: Map<string, ModelloTurno>): string {
  const m = t.modelloId ? modelli.get(t.modelloId) : undefined
  return m?.sigla || TITOLI_TIPO_TURNO[tipoTurnoDa(t.tipo)].charAt(0)
}

export const eNotte = (tipo: string) => tipoTurnoDa(tipo) === 'guardiaNotturna'

export function chiaveGiorno(g: GiornoCivile): string {
  return `${g.anno}-${String(g.mese).padStart(2, '0')}-${String(g.giorno).padStart(2, '0')}`
}

export function giornoDaChiave(chiave: string): GiornoCivile | undefined {
  const m = chiave.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? { anno: Number(m[1]), mese: Number(m[2]), giorno: Number(m[3]) } : undefined
}

export function oggi(): GiornoCivile {
  return giornoDi(Date.now())
}

/** Celle della griglia del mese (settimana dal lunedì): `null` per i giorni fuori mese. */
export function celleMese(anno: number, mese: number): (GiornoCivile | null)[] {
  const vuoteIniziali = giornoSettimana({ anno, mese, giorno: 1 }) - 1
  const celle: (GiornoCivile | null)[] = Array(vuoteIniziali).fill(null)
  for (let g = 1; g <= giorniNelMese(anno, mese); g++) celle.push({ anno, mese, giorno: g })
  while (celle.length % 7 !== 0) celle.push(null)
  return celle
}

/** Turni raggruppati per giorno di inizio (ora italiana). */
export function turniPerGiorno(turni: Turno[]): Map<string, Turno[]> {
  const mappa = new Map<string, Turno[]>()
  for (const t of [...turni].sort((a, b) => a.inizio - b.inizio)) {
    const k = chiaveGiorno(giornoDi(t.inizio))
    mappa.set(k, [...(mappa.get(k) ?? []), t])
  }
  return mappa
}

export function perId<T extends { id: string }>(elenco: T[] | undefined): Map<string, T> {
  return new Map((elenco ?? []).map((x) => [x.id, x]))
}

/** "08:30" ↔ 510 minuti */
export function minutiDaOrario(orario: string): number | undefined {
  const m = orario.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return undefined
  const v = Number(m[1]) * 60 + Number(m[2])
  return v >= 0 && v < 24 * 60 ? v : undefined
}
export function orarioDaMinuti(minuti: number): string {
  return `${String(Math.floor(minuti / 60)).padStart(2, '0')}:${String(minuti % 60).padStart(2, '0')}`
}

/** Ore scritte dall'utente ("7,5", "7.5", "7:30", "8") → minuti. Vuoto → undefined. */
export function minutiDaOreScritte(testo: string): number | undefined | null {
  const t = testo.trim()
  if (t === '') return undefined
  const hm = t.match(/^(\d{1,2}):(\d{2})$/)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 48 ? Math.round(n * 60) : null
}
export function oreScritteDaMinuti(minuti: number | undefined): string {
  if (minuti === undefined) return ''
  return String(Math.round((minuti / 60) * 100) / 100).replace('.', ',')
}

/** Importo scritto ("120,50", "120") → centesimi. Vuoto → undefined; non valido → null. */
export function centesimiDaTesto(testo: string): number | undefined | null {
  const t = testo.trim().replace(/\./g, '').replace(',', '.').replace('€', '').trim()
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null
}
export function testoDaCentesimi(c: number | undefined): string {
  return c === undefined ? '' : (c / 100).toFixed(2).replace('.', ',')
}

/** Regole dell'utente → opzioni per riepilogo e controlli. */
export function regole(impostazioni: Impostazioni, sedi: Sede[] | undefined) {
  const esclusi: ReadonlySet<TipoTurno> = impostazioni.reperibilitaContaComeLavoro ? new Set() : new Set(['reperibilita'])
  const patronoPerSede = new Map<string, GiornoMese>()
  for (const s of sedi ?? []) if (s.patrono) patronoPerSede.set(s.id, s.patrono)
  const riepilogo: OpzioniRiepilogo = { sabatoFestivo: impostazioni.sabatoFestivo, esclusiDalleOre: esclusi, patronoPerSede }
  return { riepilogo, riposoMinimo: impostazioni.riposoMinimoMinuti, esclusiDalRiposo: esclusi }
}

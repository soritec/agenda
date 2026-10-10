import { aggiungiGiorni, giornoDi, giornoSettimana } from './calendario'

/** Giorno dell'anno senza anno (festività fissa o santo patrono). */
export interface GiornoMese {
  mese: number
  giorno: number
}

export interface Festivita {
  nome: string
  giorno: GiornoMese
}

export const NOME_PATRONO = 'Santo patrono'
/** Valore iniziale dell'impostazione "Il sabato è festivo" (modificabile dall'utente). */
export const SABATO_FESTIVO_PREDEFINITO = true

/** Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher). */
export function pasqua(anno: number): GiornoMese {
  const a = anno % 19
  const b = Math.floor(anno / 100), c = anno % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = h + l - 7 * m + 114
  return { mese: Math.floor(n / 31), giorno: (n % 31) + 1 }
}

/** Festività nazionali dell'anno in ordine di data (Pasqua esclusa: è comunque domenica). Il 4 ottobre non è festivo. */
export function festivitaNazionali(anno: number): Festivita[] {
  const p = pasqua(anno)
  const lunedi = aggiungiGiorni({ anno, mese: p.mese, giorno: p.giorno }, 1)
  return [
    { nome: 'Capodanno', giorno: { mese: 1, giorno: 1 } },
    { nome: 'Epifania', giorno: { mese: 1, giorno: 6 } },
    { nome: "Lunedì dell'Angelo", giorno: { mese: lunedi.mese, giorno: lunedi.giorno } },
    { nome: 'Festa della Liberazione', giorno: { mese: 4, giorno: 25 } },
    { nome: 'Festa del Lavoro', giorno: { mese: 5, giorno: 1 } },
    { nome: 'Festa della Repubblica', giorno: { mese: 6, giorno: 2 } },
    { nome: 'Ferragosto', giorno: { mese: 8, giorno: 15 } },
    { nome: 'Ognissanti', giorno: { mese: 11, giorno: 1 } },
    { nome: 'Immacolata Concezione', giorno: { mese: 12, giorno: 8 } },
    { nome: 'Natale', giorno: { mese: 12, giorno: 25 } },
    { nome: 'Santo Stefano', giorno: { mese: 12, giorno: 26 } },
  ].sort((x, y) => x.giorno.mese - y.giorno.mese || x.giorno.giorno - y.giorno.giorno)
}

/** La festività che cade nel giorno dell'istante, se c'è (i fine settimana ordinari non sono festività). */
export function festivitaDel(istanteMs: number, patrono?: GiornoMese): Festivita | undefined {
  const g = giornoDi(istanteMs)
  const trovata = festivitaNazionali(g.anno).find((f) => f.giorno.mese === g.mese && f.giorno.giorno === g.giorno)
  if (trovata) return trovata
  if (patrono && patrono.mese === g.mese && patrono.giorno === g.giorno) return { nome: NOME_PATRONO, giorno: patrono }
  return undefined
}

export interface OpzioniFestivi {
  patrono?: GiornoMese
  sabatoFestivo?: boolean
}

/** Vero se il giorno dell'istante è domenica, sabato (se impostato), festività nazionale o santo patrono della sede. */
export function eFestivo(istanteMs: number, opzioni: OpzioniFestivi = {}): boolean {
  const sabatoFestivo = opzioni.sabatoFestivo ?? SABATO_FESTIVO_PREDEFINITO
  const gs = giornoSettimana(giornoDi(istanteMs))
  return gs === 7 || (sabatoFestivo && gs === 6) || festivitaDel(istanteMs, opzioni.patrono) !== undefined
}

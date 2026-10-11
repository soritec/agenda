/**
 * Calcolatori ostetrico-ginecologici. Funzioni pure, testate, ognuna con la sua fonte.
 * Strumenti di supporto: non sostituiscono il giudizio clinico.
 * Misure ecografiche in centimetri dove non indicato diversamente.
 */

const GIORNO = 86_400_000
const utc = (g: string) => {
  const m = g.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : NaN
}
const daUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const giorniTra = (da: string, a: string) => Math.round((utc(a) - utc(da)) / GIORNO)
export const aggiungiGiorniData = (g: string, n: number) => daUtc(utc(g) + n * GIORNO)

export interface EtaGestazionale {
  giorni: number
  settimane: number
  resto: number
  /** "12+3" */
  testo: string
}

export function eg(giorni: number): EtaGestazionale {
  const settimane = Math.floor(giorni / 7), resto = giorni - settimane * 7
  return { giorni, settimane, resto, testo: `${settimane}+${resto}` }
}

/* 1. Datazione */

/** Da ultima mestruazione (regola di Naegele, corretta per la durata del ciclo). */
export function daUltimaMestruazione(um: string, riferimento: string, ciclo = 28): { eg: EtaGestazionale; dpp: string } {
  const correzione = ciclo - 28
  return { eg: eg(giorniTra(um, riferimento) - correzione), dpp: aggiungiGiorniData(um, 280 + correzione) }
}

/** Da CRL in mm (Robinson e Fleming 1975, con correzione 1,037). Valida per CRL 10–84 mm. */
export function egDaCrl(crlMm: number): EtaGestazionale {
  return eg(Math.round(8.052 * Math.sqrt(1.037 * crlMm) + 23.73))
}

/** Da biometria (Hadlock 1984, BPD, HC, AC, FL in cm). */
export function egDaBiometria(bpd: number, hc: number, ac: number, fl: number): EtaGestazionale {
  const settimane = 10.85 + 0.06 * hc * fl + 0.67 * bpd + 0.168 * ac
  return eg(Math.round(settimane * 7))
}

/** DPP partendo dall'età gestazionale misurata in un giorno. */
export const dppDaEg = (giorno: string, egGiorni: number) => aggiungiGiorniData(giorno, 280 - egGiorni)

/**
 * Ridatazione (ACOG Committee Opinion 700, 2017): si ridata sull'ecografia se la differenza con l'UM
 * supera una soglia che dipende dall'epoca dell'ecografia.
 */
export function sogliaRidatazione(egEcoGiorni: number): number {
  if (egEcoGiorni <= 8 * 7 + 6) return 5
  if (egEcoGiorni <= 15 * 7 + 6) return 7
  if (egEcoGiorni <= 21 * 7 + 6) return 10
  if (egEcoGiorni <= 27 * 7 + 6) return 14
  return 21
}

export function ridatazione(egUmGiorni: number, egEcoGiorni: number) {
  const differenza = Math.abs(egUmGiorni - egEcoGiorni)
  const soglia = sogliaRidatazione(egEcoGiorni)
  return { differenza, soglia, ridatare: differenza > soglia }
}

/* 2. Peso fetale */

/** Peso fetale stimato in grammi (Hadlock 1985, formula con BPD, HC, AC, FL in cm). */
export function pesoHadlock(bpd: number, hc: number, ac: number, fl: number): number {
  const log10 = 1.3596 - 0.00386 * ac * fl + 0.0064 * hc + 0.00061 * bpd * ac + 0.0424 * ac + 0.174 * fl
  return Math.round(10 ** log10)
}

/** Peso medio per epoca (Hadlock 1991): ln(peso) = 0,578 + 0,332·EG − 0,00354·EG² (EG in settimane). */
export const pesoMedioHadlock = (settimane: number) => Math.exp(0.578 + 0.332 * settimane - 0.00354 * settimane ** 2)

/** Percentile orientativo: distribuzione normale con deviazione standard ≈ 12,7% della media (Hadlock 1991). */
export function percentilePeso(peso: number, settimane: number): number {
  const media = pesoMedioHadlock(settimane)
  const z = (peso - media) / (0.127 * media)
  return Math.round(Math.min(99.9, Math.max(0.1, normaleCumulata(z) * 100)) * 10) / 10
}

function normaleCumulata(z: number): number {
  // Approssimazione di Abramowitz e Stegun 26.2.17 (errore < 7,5·10⁻⁸).
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

/* 3. Liquido amniotico */

export type Liquido = 'oligoidramnios' | 'normale' | 'polidramnios'
/** AFI (somma delle quattro tasche, cm): < 5 oligoidramnios, ≥ 25 polidramnios. */
export const classificaAfi = (afi: number): Liquido => (afi < 5 ? 'oligoidramnios' : afi >= 25 ? 'polidramnios' : 'normale')
/** Falda massima (cm): < 2 oligoidramnios, ≥ 8 polidramnios. */
export const classificaFalda = (falda: number): Liquido => (falda < 2 ? 'oligoidramnios' : falda >= 8 ? 'polidramnios' : 'normale')

/* 4. Bishop e Apgar */

export interface Bishop { dilatazione: number; cancellazione: number; stazione: number; consistenza: number; posizione: number }
/** Punteggi già scelti tra le opzioni (0–3 per i primi tre, 0–2 per gli ultimi due). */
export function bishop(b: Bishop) {
  const totale = b.dilatazione + b.cancellazione + b.stazione + b.consistenza + b.posizione
  return { totale, giudizio: totale >= 8 ? 'Favorevole' : totale <= 6 ? 'Sfavorevole' : 'Intermedio' }
}

export function apgar(valori: number[]) {
  const totale = valori.reduce((s, v) => s + v, 0)
  return { totale, giudizio: totale >= 7 ? 'Nella norma' : totale >= 4 ? 'Moderatamente depresso' : 'Gravemente depresso' }
}

/* 5. Classificazione di Robson (OMS 2017) */

export interface DatiRobson {
  parita: 'nullipara' | 'multipara'
  tcPrecedente: boolean
  feti: 'singolo' | 'multipli'
  presentazione: 'cefalica' | 'podalica' | 'trasversa'
  settimane: number
  travaglio: 'spontaneo' | 'indotto' | 'tcPrimaDelTravaglio'
}

export function robson(d: DatiRobson): { gruppo: string; descrizione: string } {
  if (d.feti === 'multipli') return { gruppo: '8', descrizione: 'Gravidanze multiple, compresi i pregressi TC' }
  if (d.presentazione === 'trasversa') return { gruppo: '9', descrizione: 'Feto singolo in situazione trasversa o obliqua, compresi i pregressi TC' }
  if (d.presentazione === 'podalica') {
    return d.parita === 'nullipara'
      ? { gruppo: '6', descrizione: 'Nullipare con feto singolo podalico' }
      : { gruppo: '7', descrizione: 'Multipare con feto singolo podalico, compresi i pregressi TC' }
  }
  if (d.settimane < 37) return { gruppo: '10', descrizione: 'Feto singolo cefalico pretermine (< 37 settimane), compresi i pregressi TC' }
  if (d.parita === 'multipara' && d.tcPrecedente) return { gruppo: '5', descrizione: 'Multipare con almeno un TC precedente, feto singolo cefalico a termine' }
  const n = d.parita === 'nullipara'
  if (d.travaglio === 'spontaneo') {
    return n ? { gruppo: '1', descrizione: 'Nullipare, feto singolo cefalico a termine, travaglio spontaneo' }
      : { gruppo: '3', descrizione: 'Multipare senza TC precedente, feto singolo cefalico a termine, travaglio spontaneo' }
  }
  const sotto = d.travaglio === 'indotto' ? 'a' : 'b'
  const come = d.travaglio === 'indotto' ? 'travaglio indotto' : 'TC prima del travaglio'
  return n ? { gruppo: `2${sotto}`, descrizione: `Nullipare, feto singolo cefalico a termine, ${come}` }
    : { gruppo: `4${sotto}`, descrizione: `Multipare senza TC precedente, feto singolo cefalico a termine, ${come}` }
}

/* 6. Shock index ed emorragia post-partum */

export function shockIndex(frequenza: number, sistolica: number, pesoKg?: number) {
  const si = Math.round((frequenza / sistolica) * 100) / 100
  // Classi della perdita ematica in gravidanza (Benedetti 1991; volemia a termine ≈ 100 mL/kg).
  const classi = [
    { fino: 0.9, grado: 'Compensata', percentuale: [0, 15], ml: '< 1000 mL' },
    { fino: 1.3, grado: 'Lieve', percentuale: [15, 25], ml: '1000–1500 mL' },
    { fino: 1.8, grado: 'Moderata', percentuale: [25, 35], ml: '1500–2000 mL' },
    { fino: Infinity, grado: 'Grave', percentuale: [35, 45], ml: '2000–3000 mL' },
  ] as const
  const classe = classi.find((c) => si < c.fino)!
  const stima: [number, number] | undefined = pesoKg ? [Math.round((pesoKg * 100 * classe.percentuale[0]) / 100), Math.round((pesoKg * 100 * classe.percentuale[1]) / 100)] : undefined
  return { si, allarme: si >= 0.9, grado: classe.grado, percentuale: classe.percentuale, perditaTipica: classe.ml, stimaMl: stima }
}

/* 7. Rischio tromboembolico in gravidanza e puerperio (RCOG Green-top 37a, 2015) */

export interface FattoreTev { id: string; testo: string; punti: number; quando: 'sempre' | 'antepartum' | 'postpartum' }

export const FATTORI_TEV: FattoreTev[] = [
  { id: 'tevPrecedente', testo: 'TEV precedente (non legato solo a chirurgia maggiore)', punti: 4, quando: 'sempre' },
  { id: 'tevChirurgico', testo: 'TEV precedente provocato da chirurgia maggiore', punti: 3, quando: 'sempre' },
  { id: 'trombofiliaAlto', testo: 'Trombofilia ad alto rischio nota', punti: 3, quando: 'sempre' },
  { id: 'comorbidita', testo: 'Comorbidità (tumore, scompenso cardiaco, LES attivo, MICI, sindrome nefrosica, diabete tipo 1 con nefropatia, anemia falciforme, tossicodipendenza e.v.)', punti: 3, quando: 'sempre' },
  { id: 'familiarita', testo: 'Familiarità di 1° grado per TEV non provocato o da estrogeni', punti: 1, quando: 'sempre' },
  { id: 'trombofiliaBasso', testo: 'Trombofilia a basso rischio (senza TEV)', punti: 1, quando: 'sempre' },
  { id: 'eta', testo: 'Età > 35 anni', punti: 1, quando: 'sempre' },
  { id: 'obesita', testo: 'Obesità (BMI ≥ 30)', punti: 1, quando: 'sempre' },
  { id: 'obesitaGrave', testo: 'Obesità grave (BMI ≥ 40, al posto della precedente)', punti: 2, quando: 'sempre' },
  { id: 'parita', testo: 'Parità ≥ 3', punti: 1, quando: 'sempre' },
  { id: 'fumo', testo: 'Fumo', punti: 1, quando: 'sempre' },
  { id: 'varici', testo: 'Varici voluminose', punti: 1, quando: 'sempre' },
  { id: 'preeclampsia', testo: 'Pre-eclampsia in questa gravidanza', punti: 1, quando: 'sempre' },
  { id: 'pma', testo: 'PMA / FIVET (solo antepartum)', punti: 1, quando: 'antepartum' },
  { id: 'gemellare', testo: 'Gravidanza multipla', punti: 1, quando: 'sempre' },
  { id: 'tcTravaglio', testo: 'Taglio cesareo in travaglio', punti: 2, quando: 'postpartum' },
  { id: 'tcElettivo', testo: 'Taglio cesareo elettivo', punti: 1, quando: 'postpartum' },
  { id: 'operativo', testo: 'Parto operativo medio-pelvico o rotazionale', punti: 1, quando: 'postpartum' },
  { id: 'travaglioLungo', testo: 'Travaglio prolungato (> 24 ore)', punti: 1, quando: 'postpartum' },
  { id: 'epp', testo: 'Emorragia post-partum > 1 litro o trasfusione', punti: 1, quando: 'postpartum' },
  { id: 'pretermine', testo: 'Parto pretermine < 37 settimane in questa gravidanza', punti: 1, quando: 'postpartum' },
  { id: 'mef', testo: 'Morte endouterina fetale in questa gravidanza', punti: 1, quando: 'postpartum' },
  { id: 'chirurgia', testo: 'Intervento chirurgico in gravidanza o puerperio (esclusa la sutura perineale)', punti: 3, quando: 'sempre' },
  { id: 'iperemesi', testo: 'Iperemesi', punti: 3, quando: 'antepartum' },
  { id: 'ohss', testo: 'Sindrome da iperstimolazione ovarica (1° trimestre)', punti: 4, quando: 'antepartum' },
  { id: 'infezione', testo: 'Infezione sistemica in corso', punti: 1, quando: 'sempre' },
  { id: 'immobilita', testo: 'Immobilità o disidratazione', punti: 1, quando: 'sempre' },
]

export function rischioTev(selezionati: Set<string>, momento: 'antepartum' | 'postpartum') {
  const validi = FATTORI_TEV.filter((f) => selezionati.has(f.id) && (f.quando === 'sempre' || f.quando === momento))
  // Obesità grave sostituisce obesità.
  const punti = validi.filter((f) => !(f.id === 'obesita' && selezionati.has('obesitaGrave'))).reduce((s, f) => s + f.punti, 0)
  const altoRischio = selezionati.has('tevPrecedente')
  let indicazione: string
  if (momento === 'antepartum') {
    indicazione = altoRischio ? 'Alto rischio: EBPM in gravidanza e per 6 settimane dopo il parto; valutazione specialistica.'
      : punti >= 4 ? 'EBPM dal primo trimestre.'
      : punti === 3 ? 'EBPM dalla 28ª settimana.'
      : 'Mobilizzazione e idratazione; rivalutare a ogni ricovero o cambiamento.'
  } else {
    indicazione = altoRischio ? 'Alto rischio: EBPM per 6 settimane dopo il parto.'
      : punti >= 2 ? 'EBPM per almeno 10 giorni dopo il parto (valutare di prolungare se i fattori persistono).'
      : 'Mobilizzazione precoce e idratazione.'
  }
  return { punti, indicazione }
}

/* 8. Risk of Malignancy Index (RMI I, Jacobs 1990) */

export function rmi(caratteristicheEco: number, postmenopausa: boolean, ca125: number) {
  const u = caratteristicheEco === 0 ? 0 : caratteristicheEco === 1 ? 1 : 3
  const m = postmenopausa ? 3 : 1
  const valore = Math.round(u * m * ca125 * 10) / 10
  return { u, m, valore, rischio: valore >= 200 ? 'Alto (≥ 200)' : valore >= 25 ? 'Moderato (25–199)' : 'Basso (< 25)' }
}

/* 9. β-hCG */

/** Variazione tra due dosaggi a distanza di `ore`: tempo di raddoppio (o di dimezzamento) e variazione a 48 ore. */
export function betaHcg(primo: number, secondo: number, ore: number) {
  const rapporto = secondo / primo
  const raddoppioOre = rapporto > 1 ? Math.round(((ore * Math.LN2) / Math.log(rapporto)) * 10) / 10 : undefined
  const dimezzamentoOre = rapporto < 1 ? Math.round(((ore * Math.LN2) / -Math.log(rapporto)) * 10) / 10 : undefined
  const variazione48 = Math.round((rapporto ** (48 / ore) - 1) * 1000) / 10
  return {
    raddoppioOre, dimezzamentoOre, variazione48,
    // Aumento minimo atteso in una gravidanza intrauterina vitale: circa 35% in 48 ore (Barnhart 2016).
    sottoAtteso: variazione48 < 35,
  }
}

/* 10. BMI e aumento di peso in gravidanza (IOM 2009) */

export function bmi(pesoKg: number, altezzaCm: number) {
  const valore = Math.round((pesoKg / (altezzaCm / 100) ** 2) * 10) / 10
  const classe = valore < 18.5 ? 'Sottopeso' : valore < 25 ? 'Normopeso' : valore < 30 ? 'Sovrappeso' : 'Obesità'
  return { valore, classe }
}

export function aumentoPesoRaccomandato(bmiPre: number, gemellare = false): { minimo: number; massimo: number } | undefined {
  if (gemellare) {
    if (bmiPre < 18.5) return undefined // dati insufficienti per le gemellari in sottopeso
    return bmiPre < 25 ? { minimo: 17, massimo: 25 } : bmiPre < 30 ? { minimo: 14, massimo: 23 } : { minimo: 11, massimo: 19 }
  }
  return bmiPre < 18.5 ? { minimo: 12.5, massimo: 18 } : bmiPre < 25 ? { minimo: 11.5, massimo: 16 } : bmiPre < 30 ? { minimo: 7, massimo: 11.5 } : { minimo: 5, massimo: 9 }
}

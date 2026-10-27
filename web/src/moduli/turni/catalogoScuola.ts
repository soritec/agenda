import type { TipoTurno } from './tipi'

/**
 * Sigle dei turni usate dalla scuola di specializzazione (legenda del vademecum).
 * Orari predefiniti (modificabili): reparto, ambulatori ed ecografie 8–18; sala operatoria 7–18.
 * Smonto notte, congresso, riposo e ferie non sono turni ma giornate (vedi `TIPI_GIORNATA`).
 */
export interface VoceCatalogo {
  sigla: string
  nome: string
  tipo: TipoTurno
  orari: [number, number]
  /** Dove e quando presentarsi (dal vademecum). */
  info?: string
}

const ORA = 60
const AMB: [number, number] = [8 * ORA, 18 * ORA]
const SALA: [number, number] = [7 * ORA, 18 * ORA]

const GUARDIA = "Presentarsi 10 minuti prima in sala consegne: piano 0, settore C (si entra dall'ingresso degli ambulatori di ostetricia). Se la sala parto è molto piena, le consegne si danno direttamente in sala parto (lo scrivono sul gruppo specializzandi). Sala parto e pronto soccorso: 1° piano, settore C (la sala parto si è spostata a settembre: non seguire il vademecum)."
const TRIAGE = 'Chi ruota in ginecologia: triage del pronto soccorso ostetrico-ginecologico con uno specializzando del IV anno (si visitano le pazienti che arrivano in PS).'
const SALA_PARTO = "Chi ruota in ostetricia: sala parto in affiancamento alle ostetriche, con gli strutturati e lo specializzando grande; si può entrare a vedere qualche parto solo con il permesso dell'ostetrica."
/** Testi delle guardie nelle versioni precedenti del catalogo (per aggiornarli). */
export const GUARDIA_PRIMA = 'Presentarsi 10–15 minuti prima in sala parto per le consegne.'
const AMB_OST = 'Ambulatori di ostetricia: piano terra, settore C.'
const AMB_GIN = (amb: string) => `Ambulatori di ginecologia: piano terra, settore A${amb}. Presentarsi alle 8:00–8:20; di solito finisce verso le 13–13:30, spesso anche il pomeriggio dalle 14–14:30.`
const SALA_GIN = 'Sala operatoria: piano -1, blocco F. Presentarsi alle 7:45 già cambiati (tutina azzurra, cuffia, mascherina); zoccoli nel blocco F, tutine dal distributore al piano -1 nel corridoio delle sale.'

const INFO_REPARTO_OST = "3° piano, settore C. Arrivare alle 7:45: poi si scende alle consegne con quelli della guardia (sala consegne, piano 0, settore C). Conviene portarsi il pranzo."
const INFO_PUERPERIO = 'Reparto maternità: 3° piano, settore B. Arrivare alle 7:45: poi si scende alle consegne con quelli della guardia (sala consegne, piano 0, settore C); di solito una settimana da lunedì a domenica.'
/** Reparti: ostetricia 7:45–18; ginecologia 7–19 (in settimana si aspetta la fine della sala). */
const REPARTO_OST: [number, number] = [7 * ORA + 45, 18 * ORA]
const REPARTO_GIN: [number, number] = [7 * ORA, 19 * ORA]
const INFO_REPARTO_GIN = 'Reparto: 7° piano, settore B. Arrivare alle 7 (dipende dagli strutturati: qualcuno è più flessibile). In settimana di solito si resta fino alle 18:30–19, perché si aspetta che finisca la sala; nel weekend si esce prima, verso pranzo o il primo pomeriggio. Una settimana da lunedì a domenica, con un riposo compensativo la settimana dopo. Cartella clinica elettronica e Galileo.'

/** Testi delle versioni precedenti del catalogo, per sigla: se il turno tipo ha ancora quello, si aggiorna. */
export const INFO_PRIMA: Record<string, string[]> = {
  R: ['3° piano, settore C. Alle 8 in guardia per le consegne della sala parto, in reparto verso le 8:30. Conviene portarsi il pranzo.'],
  P: ['Reparto maternità: 3° piano, settore B. Alle 8 in guardia per le consegne, in reparto verso le 8:30; di solito una settimana da lunedì a domenica.'],
  Rg: ['7° piano, settore B. In reparto alle 7:00–7:30, si può restare fino alle 20; una settimana da lunedì a domenica, con un riposo compensativo la settimana dopo. Cartella clinica elettronica e Galileo.'],
}

/** Turni tipo con un testo superato del catalogo, con il testo nuovo (quelli scritti dall'utente non si toccano). */
export function infoSuperate<T extends { sigla: string; info?: string }>(modelli: T[]): T[] {
  return modelli.flatMap((m) => {
    const voce = CATALOGO_SCUOLA.find((v) => v.sigla === m.sigla)
    return voce?.info && m.info && INFO_PRIMA[m.sigla]?.includes(m.info) ? [{ ...m, info: voce.info }] : []
  })
}

/** Turni tipo dei reparti ancora con l'orario predefinito di prima (8–18), con l'orario nuovo. */
export function orariRepartiSuperati<T extends { sigla: string; minutoInizio: number; minutoFine: number; tuttoIlGiorno?: boolean }>(modelli: T[]): T[] {
  return modelli.flatMap((m) => {
    if (!['R', 'P', 'Rg'].includes(m.sigla) || m.tuttoIlGiorno || m.minutoInizio !== 8 * ORA || m.minutoFine !== 18 * ORA) return []
    const v = CATALOGO_SCUOLA.find((x) => x.sigla === m.sigla)!
    return [{ ...m, minutoInizio: v.orari[0], minutoFine: v.orari[1] }]
  })
}

export const CATALOGO_SCUOLA: VoceCatalogo[] = [
  { sigla: 'G', nome: 'Guardia giorno (triage)', tipo: 'guardiaDiurna', orari: [8 * ORA, 20 * ORA], info: `Guardia 8–20. ${TRIAGE} ${GUARDIA}` },
  { sigla: 'N', nome: 'Guardia notte (triage)', tipo: 'guardiaNotturna', orari: [20 * ORA, 8 * ORA], info: `Guardia 20–8. ${TRIAGE} ${GUARDIA}` },
  { sigla: 'GG', nome: 'Guardia giorno (triage)', tipo: 'guardiaDiurna', orari: [8 * ORA, 20 * ORA], info: `Guardia 8–20. ${TRIAGE} ${GUARDIA}` },
  { sigla: 'GN', nome: 'Guardia notte (triage)', tipo: 'guardiaNotturna', orari: [20 * ORA, 8 * ORA], info: `Guardia 20–8. ${TRIAGE} ${GUARDIA}` },
  { sigla: 'GSP', nome: 'Guardia giorno sala parto', tipo: 'guardiaDiurna', orari: [8 * ORA, 20 * ORA], info: `Guardia sala parto 8–20. ${SALA_PARTO} ${GUARDIA}` },
  { sigla: 'NSP', nome: 'Guardia notte sala parto', tipo: 'guardiaNotturna', orari: [20 * ORA, 8 * ORA], info: `Guardia sala parto 20–8. ${SALA_PARTO} ${GUARDIA}` },
  { sigla: 'R', nome: 'Reparto Ostetricia', tipo: 'reparto', orari: REPARTO_OST, info: INFO_REPARTO_OST },
  { sigla: 'P', nome: 'Puerperio', tipo: 'reparto', orari: REPARTO_OST, info: INFO_PUERPERIO },
  { sigla: 'DSO', nome: 'Day Service Ostetrico', tipo: 'reparto', orari: AMB },
  { sigla: 'Rg', nome: 'Reparto Ginecologia', tipo: 'reparto', orari: REPARTO_GIN, info: INFO_REPARTO_GIN },
  { sigla: 'F', nome: 'Amb. Gravidanza Fisiologica', tipo: 'ambulatorio', orari: AMB, info: `${AMB_OST} Fisiologia medici: martedì e venerdì mattina.` },
  { sigla: 'Gem', nome: 'Amb. Gemelli', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'PP', nome: 'Amb. Parto Prematuro', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'Au', nome: 'Amb. Autoimmunità', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'I', nome: 'Amb. Ipertensione', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'Pa', nome: 'Amb. Pluriabortività', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'D', nome: 'Amb. Dismetabolismo', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'PV', nome: 'Amb. Patologia Varia', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'A', nome: 'Amb. Gravidanza Alto Rischio', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'Ex', nome: 'Amb. Gravidanza Extrauterina / I trim.', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'Rh', nome: 'Immunoprofilassi anti-D', tipo: 'ambulatorio', orari: AMB, info: AMB_OST },
  { sigla: 'Cs', nome: 'Consultorio', tipo: 'ambulatorio', orari: AMB },
  { sigla: 'AGI', nome: 'Amb. Ginecologia I livello', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN('') },
  { sigla: 'CDS', nome: 'Amb. Colposcopia', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN(', amb 4') },
  { sigla: 'Ben', nome: 'Amb. Benigna / endometriosi', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN(', amb 1 e 3') },
  { sigla: 'Aon', nome: 'Amb. Oncologico', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN('') },
  { sigla: 'Uro', nome: 'Amb. Urologia / uroginecologia', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN('') },
  { sigla: 'AUB', nome: 'Amb. Perdite ematiche atipiche', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN(', amb 5') },
  { sigla: 'ECO', nome: 'Ecografie ginecologiche', tipo: 'ecografia', orari: AMB, info: AMB_GIN(', amb 7') },
  { sigla: 'BRCA', nome: 'Amb. BRCA mutate', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN(', amb 7') },
  { sigla: 'ISC', nome: 'Isteroscopia', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN(', amb 5') },
  { sigla: 'AOE', nome: 'Amb. Oncologia età fertile', tipo: 'ambulatorio', orari: AMB, info: `${AMB_GIN(', amb 7')} Mercoledì mattina.` },
  { sigla: 'END', nome: 'Amb. Endocrino', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN(', amb 1 e 3') },
  { sigla: 'VACCINI', nome: 'Vaccini HPV', tipo: 'ambulatorio', orari: AMB, info: `${AMB_GIN(', amb 9')} 1° e 3° giovedì del mese.` },
  { sigla: 'ron', nome: 'Oncologia ginecologica', tipo: 'ambulatorio', orari: AMB, info: AMB_GIN(', amb 12') },
  { sigla: 'PR', nome: 'Prericoveri', tipo: 'ambulatorio', orari: AMB, info: 'Prericoveri: chiedere la stanza al mattino.' },
  { sigla: 'GOI', nome: 'Discussione casi onco (GOI)', tipo: 'altro', orari: [13 * ORA, 14 * ORA + 30], info: 'Discussione multidisciplinare dei casi di oncologia ginecologica: giovedì 13–14:30, Anatomia patologica, piano 0, corridoio settore A (solo in presenza).' },
  { sigla: 'BT', nome: 'Bi-test', tipo: 'ecografia', orari: AMB },
  { sigla: 'Gen', nome: 'Ecografie genetiche', tipo: 'ecografia', orari: AMB },
  { sigla: 'Am', nome: 'Amniocentesi', tipo: 'ecografia', orari: AMB },
  { sigla: 'E', nome: 'Ecografie ostetriche', tipo: 'ecografia', orari: AMB },
  { sigla: 'E terr', nome: 'Ecografie ostetriche del territorio', tipo: 'ecografia', orari: AMB, info: 'Ecografie del I trimestre e di accrescimento: martedì mattina. Le pazienti patologiche richiedono la supervisione dello strutturato.' },
  { sigla: 'E pom', nome: 'Ecografie ostetriche pomeriggio', tipo: 'ecografia', orari: AMB },
  { sigla: 'Dpl', nome: 'Ecodoppler ostetricia', tipo: 'ecografia', orari: AMB },
  { sigla: 'ES', nome: 'Ecografie di II livello', tipo: 'ecografia', orari: AMB },
  { sigla: 'PI', nome: 'Piccoli interventi', tipo: 'salaOperatoria', orari: SALA, info: 'Presentarsi in reparto di ostetricia (3° piano, settore C) alle 8. Sala operatoria ostetrica accanto alla sala parto (si entra col badge dal PS ostetrico).' },
  { sigla: 'Sop', nome: 'Sala operatoria', tipo: 'salaOperatoria', orari: SALA, info: SALA_GIN },
  { sigla: 'OP', nome: 'Sala operatoria ginecologia', tipo: 'salaOperatoria', orari: SALA, info: SALA_GIN },
  { sigla: 'OPP', nome: 'Piccoli interventi ginecologia', tipo: 'salaOperatoria', orari: SALA, info: SALA_GIN },
  { sigla: 'STRUM', nome: 'Affiancamento strumentista', tipo: 'salaOperatoria', orari: SALA, info: SALA_GIN },
  { sigla: 'Tro', nome: 'Tronco', tipo: 'altro', orari: AMB, info: 'Tronco comune: 2 settimane di senologia e 2 di chirurgia generale. In questo mese niente ferie.' },
]

/** Voci del catalogo non ancora presenti tra i turni tipo (confronto per sigla). */
export function vociMancanti(esistenti: { sigla: string }[]): VoceCatalogo[] {
  const presenti = new Set(esistenti.map((m) => m.sigla.trim().toLowerCase()))
  return CATALOGO_SCUOLA.filter((v) => !presenti.has(v.sigla.toLowerCase()))
}

/**
 * Prima versione del catalogo: tutte le voci senza G/N erano "tutto il giorno" e Tronco era sala operatoria.
 * Restituisce le correzioni da applicare ai turni tipo caricati allora e mai modificati dall'utente.
 */
export function correzioniCatalogoV1<T extends { sigla: string; nome: string; tipo: string; tuttoIlGiorno?: boolean }>(
  modelli: T[],
): (T & { minutoInizio: number; minutoFine: number; tuttoIlGiorno: undefined })[] {
  const perSigla = new Map(CATALOGO_SCUOLA.map((v) => [v.sigla, v]))
  // Nomi con cui alcune sigle erano state caricate la prima volta (poi rinominate dal vademecum di ginecologia).
  const nomiPrima: Record<string, string> = { AGI: 'Amb. Ginecologia generale', Ben: 'Amb. Patologia Benigna', Aon: 'Amb. Oncologia', Uro: 'Amb. Uroginecologia' }
  return modelli.flatMap((m) => {
    const v = perSigla.get(m.sigla)
    if (!v || !m.tuttoIlGiorno || m.nome !== (nomiPrima[v.sigla] ?? v.nome)) return []
    const tipoVecchio = v.sigla === 'Tro' ? 'salaOperatoria' : v.tipo
    if (m.tipo !== tipoVecchio) return []
    return [{ ...m, tipo: v.tipo, minutoInizio: v.orari[0], minutoFine: v.orari[1], tuttoIlGiorno: undefined }]
  })
}

/** Le informazioni del catalogo per i turni tipo che non le hanno ancora (confronto per sigla, senza maiuscole). */
export function infoMancanti<T extends { sigla: string; nome?: string; info?: string }>(modelli: T[]): T[] {
  // Confronto tollerante: senza maiuscole, spazi, punti e trattini (es. "E. terr" = "E terr"), poi per nome.
  const chiave = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  const conInfo = CATALOGO_SCUOLA.filter((v) => v.info)
  const perSigla = new Map(conInfo.map((v) => [chiave(v.sigla), v.info!]))
  const perNome = new Map(conInfo.map((v) => [chiave(v.nome), v.info!]))
  return modelli.flatMap((m) => {
    if (m.info) return []
    const info = perSigla.get(chiave(m.sigla)) ?? (m.nome ? perNome.get(chiave(m.nome)) : undefined)
    return info ? [{ ...m, info }] : []
  })
}

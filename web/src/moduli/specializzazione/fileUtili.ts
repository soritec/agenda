/** Cartelle della pagina "File utili": la cartella è scritta nel collegamento dell'allegato. */
export const CARTELLE_UTILI = [
  { id: 'istruzioni', nome: 'Istruzioni' },
  { id: 'protocolli', nome: 'Protocolli' },
  { id: 'moduli', nome: 'Moduli' },
  { id: 'altro', nome: 'Altro' },
] as const
export type CartellaUtile = (typeof CARTELLE_UTILI)[number]['id']

const PREFISSO = 'file-utili:'
export const collegamentoCartella = (c: CartellaUtile) => `${PREFISSO}${c}`
export const cartellaDi = (a: { collegatoA: string }) => a.collegatoA.slice(PREFISSO.length) as CartellaUtile

/** File utili, dal più recente. */
export const fileUtili = <T extends { collegatoA: string; creatoIl: number }>(allegati: T[]) =>
  allegati.filter((a) => a.collegatoA.startsWith(PREFISSO)).sort((a, b) => b.creatoIl - a.creatoIl)

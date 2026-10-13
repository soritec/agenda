/**
 * Profili: ogni persona ha il suo archivio sul dispositivo e il suo file su GitHub (stesso account e stessa password).
 * Il profilo principale usa i nomi storici ("agenda", "agenda.cifrato.json"), così i dati già esistenti restano dove sono.
 * I nomi delle persone stanno solo nei dati (archivio comune), mai nel codice.
 */
export const PROFILO_PRINCIPALE = 'principale'
const CHIAVE = 'agenda.profilo'

export function profiloAttivo(): string {
  try { return localStorage.getItem(CHIAVE) || PROFILO_PRINCIPALE } catch { return PROFILO_PRINCIPALE }
}

/** Passa a un altro profilo: l'app si ricarica e apre l'archivio di quel profilo. */
export function cambiaProfilo(id: string) {
  try { localStorage.setItem(CHIAVE, id) } catch { /* senza memoria locale resta il principale */ }
  location.hash = '#/oggi'
  location.reload()
}

export const nomeDatabase = (id = profiloAttivo()) => (id === PROFILO_PRINCIPALE ? 'agenda' : `agenda-${id}`)
export const fileDati = (id = profiloAttivo()) => (id === PROFILO_PRINCIPALE ? 'agenda.cifrato.json' : `agenda-${id}.cifrato.json`)
export const FILE_CONDIVISO = 'condiviso.cifrato.json'

/** Moduli di partenza per un profilo nuovo (si cambiano dalle Impostazioni). */
export const MODULI_NUOVO_PROFILO = ['oggi', 'agenda', 'task', 'studio', 'budget', 'casa', 'journaling', 'postit', 'chat', 'cerca']

/** Sezioni pensate per un profilo preciso: non compaiono se il profilo non le ha scelte. */
export const MODULI_SU_SCELTA = ['casa']

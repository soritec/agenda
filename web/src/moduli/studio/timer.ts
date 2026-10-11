import { elenca, salva } from '../../dati/archivio'
import { componenti } from '../../nucleo/calendario'
import { chiaveGiorno } from '../turni/supporto'

/**
 * Timer di studio con pause. Lo stato vive fuori dalle pagine (e nel dispositivo), così il tempo continua
 * anche cambiando sezione o chiudendo l'app; al ritorno si recuperano le fasi finite nel frattempo.
 */
export interface StatoTimer {
  fase: 'fermo' | 'studio' | 'pausa'
  durataStudio: number
  durataPausa: number
  /** Istante di fine della fase in corso (se sta correndo). */
  fineIl?: number
  /** Millisecondi rimasti, se messo in pausa con il pulsante. */
  rimanenteMs?: number
  argomentoId?: string
  /** Sessione di un piano di studio in corso (il tempo si somma lì). */
  sessionePianoId?: string
  etichetta?: string
  ciclo: number
}

const CHIAVE = 'agenda.timerStudio'
let stato: StatoTimer = leggi()
const ascoltatori = new Set<() => void>()

function leggi(): StatoTimer {
  try {
    const s = JSON.parse(localStorage.getItem(CHIAVE) ?? 'null') as StatoTimer | null
    if (s) return s
  } catch { /* ripiego sotto */ }
  return { fase: 'fermo', durataStudio: 60, durataPausa: 10, ciclo: 1 }
}
function imposta(nuovo: StatoTimer) {
  stato = nuovo
  try { localStorage.setItem(CHIAVE, JSON.stringify(stato)) } catch { /* solo comodità */ }
  ascoltatori.forEach((a) => a())
}
export const leggiTimer = () => stato
export function ascoltaTimer(a: () => void) {
  ascoltatori.add(a)
  return () => { ascoltatori.delete(a) }
}

const oggi = (ms: number) => chiaveGiorno(componenti(ms))
async function registra(minuti: number, quando: number, argomentoId?: string) {
  if (minuti < 1) return
  await salva('sessioniStudio', { giorno: oggi(quando), minuti: Math.round(minuti), argomentoId })
  if (stato.sessionePianoId) {
    const s = (await elenca('sessioniPiano')).find((x) => x.id === stato.sessionePianoId)
    if (s) await salva('sessioniPiano', { ...s, minutiFatti: (s.minutiFatti ?? 0) + Math.round(minuti) })
  }
}

function suona() {
  try {
    const ctx = new AudioContext()
    for (const [i, f] of [660, 880, 990].entries()) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16)
      o.connect(g).connect(ctx.destination)
      o.start(ctx.currentTime + i * 0.18)
      o.stop(ctx.currentTime + i * 0.18 + 0.18)
    }
    navigator.vibrate?.([120, 80, 120])
  } catch { /* niente suono */ }
}

export function scegliDurate(durataStudio: number, durataPausa: number) {
  imposta({ ...stato, durataStudio, durataPausa })
}
export function scegliArgomento(argomentoId?: string) {
  imposta({ ...stato, argomentoId })
}
/** Avvia il timer su una sessione di un piano (durata = minuti previsti, arrotondati). */
export function avviaSessione(id: string, etichetta: string, minuti: number) {
  imposta({ ...stato, sessionePianoId: id, etichetta, durataStudio: Math.max(5, Math.min(240, minuti)), fase: 'fermo', fineIl: undefined, rimanenteMs: undefined })
  avvia()
}
export function avvia() {
  if (stato.fase !== 'fermo' && stato.rimanenteMs !== undefined) {
    imposta({ ...stato, fineIl: Date.now() + stato.rimanenteMs, rimanenteMs: undefined })
    return
  }
  imposta({ ...stato, fase: 'studio', fineIl: Date.now() + stato.durataStudio * 60_000, rimanenteMs: undefined, ciclo: 1 })
}
export function metti_in_pausa() {
  if (!stato.fineIl) return
  imposta({ ...stato, rimanenteMs: Math.max(0, stato.fineIl - Date.now()), fineIl: undefined })
}
/** Ferma tutto; lo studio fatto finora nella fase in corso viene registrato. */
export async function ferma() {
  if (stato.fase === 'studio') {
    const rimasti = stato.fineIl ? stato.fineIl - Date.now() : stato.rimanenteMs ?? 0
    await registra((stato.durataStudio * 60_000 - rimasti) / 60_000, Date.now(), stato.argomentoId)
  }
  imposta({ ...stato, fase: 'fermo', fineIl: undefined, rimanenteMs: undefined, ciclo: 1, sessionePianoId: undefined, etichetta: undefined })
}
/** Da chiamare spesso: chiude le fasi finite (registrando lo studio) e passa alla successiva. */
export async function controlla(adesso = Date.now()) {
  let s = stato, cambiato = false
  while (s.fase !== 'fermo' && s.fineIl && adesso >= s.fineIl) {
    cambiato = true
    if (s.fase === 'studio') {
      await registra(s.durataStudio, s.fineIl, s.argomentoId)
      s = { ...s, fase: 'pausa', fineIl: s.fineIl + s.durataPausa * 60_000 }
    } else {
      s = { ...s, fase: 'studio', fineIl: s.fineIl + s.durataStudio * 60_000, ciclo: s.ciclo + 1 }
    }
  }
  if (cambiato) {
    imposta(s)
    if (adesso - (s.fineIl ?? adesso) < 0) suona()
  }
}
/** Millisecondi rimasti e frazione della fase ancora da fare (1 = appena iniziata). */
export function rimanente(s: StatoTimer, adesso = Date.now()) {
  const totale = (s.fase === 'pausa' ? s.durataPausa : s.durataStudio) * 60_000
  const ms = s.fase === 'fermo' ? totale : s.fineIl ? Math.max(0, s.fineIl - adesso) : s.rimanenteMs ?? totale
  return { ms, frazione: totale ? ms / totale : 0 }
}

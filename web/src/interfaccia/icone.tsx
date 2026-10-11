import type { ReactNode } from 'react'

/** Icone lineari, colore dal testo (currentColor). */
function Icona({ dimensione = 22, children }: { dimensione?: number; children: ReactNode }) {
  return (
    <svg width={dimensione} height={dimensione} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

type P = { dimensione?: number }

export const IconaOggi = (p: P) => (
  <Icona {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></Icona>
)
export const IconaAgenda = (p: P) => (
  <Icona {...p}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Icona>
)
export const IconaTurni = (p: P) => (
  <Icona {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icona>
)
export const IconaModuli = (p: P) => (
  <Icona {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" /></Icona>
)
export const IconaCerca = (p: P) => (
  <Icona {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></Icona>
)
export const IconaCestino = (p: P) => (
  <Icona {...p}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5.5M14 11v5.5" /></Icona>
)
export const IconaPiu = (p: P) => <Icona {...p}><path d="M12 5v14M5 12h14" /></Icona>
export const IconaIndietro = (p: P) => <Icona {...p}><path d="M15 6l-6 6 6 6" /></Icona>
export const IconaAvanti = (p: P) => <Icona {...p}><path d="M9 6l6 6-6 6" /></Icona>
export const IconaAvviso = (p: P) => <Icona {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" /></Icona>
export const IconaImpostazioni = (p: P) => (
  <Icona {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></Icona>
)
export const IconaTask = (p: P) => (
  <Icona {...p}><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Icona>
)
export const IconaSpecializzazione = (p: P) => (
  // Fonendoscopio
  <Icona {...p}><path d="M5 3H4a1.5 1.5 0 0 0-1.5 1.5V9a5.5 5.5 0 0 0 11 0V4.5A1.5 1.5 0 0 0 12 3h-1" /><path d="M8 14.5v1a5.5 5.5 0 0 0 11 0V13" /><circle cx="19" cy="10.5" r="2.2" /></Icona>
)
export const IconaStudio = (p: P) => (
  <Icona {...p}><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z" /><path d="M12 6.5V19" /></Icona>
)
export const IconaBudget = (p: P) => (
  <Icona {...p}><rect x="3.5" y="6" width="17" height="13" rx="3" /><path d="M3.5 10h17M15 14.5h2" /></Icona>
)
export const IconaJournaling = (p: P) => (
  <Icona {...p}><path d="M6 3.5h10a2 2 0 0 1 2 2v15H8a2 2 0 0 1-2-2z" /><path d="M6 17.5a2 2 0 0 1 2-2h10M10 8h5M10 11h3" /></Icona>
)
export const IconaPin = (p: P) => (
  <Icona {...p}><path d="M12 17v5" /><path d="M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2v.8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9A2 2 0 0 1 15 10.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /></Icona>
)
export const IconaSalvadanaio = (p: P) => (
  <Icona {...p}><path d="M5.5 9.6A6.5 6.5 0 0 1 11 7h3a6.5 6.5 0 0 1 6.5 6.5 5 5 0 0 1-2 4V20a.5.5 0 0 1-.5.5h-1.8l-.9-1.8h-4.6l-.9 1.8H7.5A.5.5 0 0 1 7 20v-2.4A6.4 6.4 0 0 1 5 16H3.5a.5.5 0 0 1-.5-.5v-3a.5.5 0 0 1 .5-.5h1.2a6 6 0 0 1 .8-2.4L4.5 7.2h2z" /><path d="M15.5 12.5v.01" /><path d="M10 4.5h4" /></Icona>
)
/* Icone delle sezioni di Specializzazione */
export const IconaLogbook = (p: P) => (
  <Icona {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h6M9 18h3" /></Icona>
)
export const IconaCappello = (p: P) => (
  <Icona {...p}><path d="M3 9l9-4.5L21 9l-9 4.5z" /><path d="M7 11v4.5c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5V11" /><path d="M21 9v5" /></Icona>
)
export const IconaLavagna = (p: P) => (
  <Icona {...p}><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M12 16v3M8 21l4-2 4 2" /><path d="M7 12l3-3 2 2 4-4" /></Icona>
)
export const IconaEuro = (p: P) => (
  <Icona {...p}><path d="M17.5 6.5A7 7 0 1 0 17.5 17.5" /><path d="M4 10h10M4 14h10" /></Icona>
)
export const IconaCalcolatrice = (p: P) => (
  <Icona {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><rect x="8" y="6" width="8" height="3.5" rx="0.5" /><path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 16.5h.01M12 16.5h.01M15.5 16.5h.01" /></Icona>
)
export const IconaMicroscopio = (p: P) => (
  <Icona {...p}><path d="M6 21h12" /><path d="M8 18h8" /><path d="M14 18a5 5 0 0 0 1-9.9" /><path d="M9.5 3.5l3 1.5-3 6-3-1.5z" /><path d="M8 11.5L7 13.5" /><path d="M10.5 9.5l2 1" /></Icona>
)
export const IconaAttestato = (p: P) => (
  <Icona {...p}><rect x="3" y="4" width="18" height="13" rx="1.5" /><path d="M7 8h10M7 11h6" /><circle cx="16" cy="16" r="2.5" /><path d="M14.8 18.2L14 22l2-1 2 1-.8-3.8" /></Icona>
)
export const IconaArticolo = (p: P) => (
  <Icona {...p}><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 11h7M9 14h7M9 17h4" /></Icona>
)
export const IconaStampa = (p: P) => (
  <Icona {...p}><path d="M7 8V3.5h10V8M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 5 8h14a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 19 17h-2" /><path d="M7 13.5h10v7H7z" /></Icona>
)

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
export const IconaStampa = (p: P) => (
  <Icona {...p}><path d="M7 8V3.5h10V8M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-6A1.5 1.5 0 0 1 5 8h14a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 19 17h-2" /><path d="M7 13.5h10v7H7z" /></Icona>
)

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
export const IconaPiu = (p: P) => <Icona {...p}><path d="M12 5v14M5 12h14" /></Icona>
export const IconaIndietro = (p: P) => <Icona {...p}><path d="M15 6l-6 6 6 6" /></Icona>
export const IconaAvanti = (p: P) => <Icona {...p}><path d="M9 6l6 6-6 6" /></Icona>
export const IconaAvviso = (p: P) => <Icona {...p}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17v.5" /></Icona>
export const IconaImpostazioni = (p: P) => (
  <Icona {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></Icona>
)

import { useEffect, useRef, useState } from 'react'

/** Dove è stato lasciato un elemento: il giorno e, nella griglia oraria, il minuto. */
export interface Rilascio {
  giorno: string
  minuto?: number
}

/**
 * Pressione prolungata e trascinamento insieme.
 * - iPhone: tieni premuto → compare la × (come prima); se poi muovi il dito, l'elemento si sposta dove lo lasci.
 * - Mac: clic destro → ×; tenendo premuto il tasto e muovendo il mouse l'elemento si trascina subito.
 * Le zone dove si può lasciare hanno `data-giorno`; la griglia oraria anche `data-ora-da` e `data-altezza-ora`.
 */
export function useTrascinamento<T>(onSposta: (elemento: T, dove: Rilascio) => void, onPremuto?: (chiave: string) => void) {
  const [attivo, setAttivo] = useState<string>()
  const scattata = useRef(false)
  const corrente = useRef<{
    chiave: string; elemento: T; sorgente: HTMLElement; x0: number; y0: number; mouse: boolean
    armato: boolean; trascina: boolean; timer?: ReturnType<typeof setTimeout>; fantasma?: HTMLElement; bersaglio?: HTMLElement; pulisci: () => void
  } | undefined>(undefined)
  const callback = useRef({ onSposta, onPremuto })
  callback.current = { onSposta, onPremuto }

  // Un tocco altrove nasconde la ×.
  useEffect(() => {
    if (!attivo) return
    const chiudi = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.('.x-elimina, [data-premuto="si"]')) setAttivo(undefined)
    }
    document.addEventListener('pointerdown', chiudi)
    return () => document.removeEventListener('pointerdown', chiudi)
  }, [attivo])

  function destinazione(x: number, y: number): { el: HTMLElement; dove: Rilascio } | undefined {
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>('[data-giorno]')
    if (!el?.dataset.giorno) return undefined
    const oraDa = el.dataset.oraDa, altezza = el.dataset.altezzaOra
    if (oraDa === undefined || altezza === undefined) return { el, dove: { giorno: el.dataset.giorno } }
    const r = el.getBoundingClientRect()
    // Quarti d'ora, partendo dal punto in alto dell'elemento trascinato.
    const minuto = Number(oraDa) * 60 + Math.round(((y - r.top) / Number(altezza)) * 4) * 15
    return { el, dove: { giorno: el.dataset.giorno, minuto: Math.max(0, Math.min(23 * 60 + 45, minuto)) } }
  }

  function inizia(chiave: string, elemento: T, e: { clientX: number; clientY: number; pointerType: string; currentTarget: EventTarget }) {
    corrente.current?.pulisci()
    scattata.current = false
    const sorgente = e.currentTarget as HTMLElement
    const stato: NonNullable<typeof corrente.current> = {
      chiave, elemento, sorgente, x0: e.clientX, y0: e.clientY, mouse: e.pointerType === 'mouse', armato: false, trascina: false,
      pulisci: () => {
        clearTimeout(stato.timer)
        stato.fantasma?.remove()
        stato.bersaglio?.classList.remove('bersaglio')
        sorgente.classList.remove('in-trascinamento')
        document.body.classList.remove('trascinando')
        document.removeEventListener('pointermove', muovi)
        document.removeEventListener('pointerup', fine)
        document.removeEventListener('pointercancel', annulla)
        document.removeEventListener('touchmove', muoviTocco)
        document.removeEventListener('touchend', fineTocco)
        if (corrente.current === stato) corrente.current = undefined
      },
    }
    corrente.current = stato
    stato.timer = setTimeout(() => {
      stato.armato = true
      scattata.current = true
      navigator.vibrate?.(15)
      setAttivo(chiave)
      callback.current.onPremuto?.(chiave)
    }, 450)

    const avvia = () => {
      stato.trascina = true
      scattata.current = true
      setAttivo(undefined)
      const r = sorgente.getBoundingClientRect()
      const f = sorgente.cloneNode(true) as HTMLElement
      f.classList.add('fantasma-trascina')
      f.querySelectorAll('.x-elimina').forEach((x) => x.remove())
      Object.assign(f.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, margin: '0', zIndex: '1000', pointerEvents: 'none' })
      f.dataset.dx = String(stato.x0 - r.left)
      f.dataset.dy = String(stato.y0 - r.top)
      document.body.appendChild(f)
      stato.fantasma = f
      sorgente.classList.add('in-trascinamento')
      document.body.classList.add('trascinando')
    }
    const sposta = (x: number, y: number) => {
      const d = Math.hypot(x - stato.x0, y - stato.y0)
      if (!stato.trascina) {
        if (stato.armato || (stato.mouse && d > 6)) { if (d > 6) avvia() }
        else if (d > 10) { stato.pulisci(); return } // il dito scorre la pagina: niente pressione
      }
      if (!stato.trascina || !stato.fantasma) return
      const f = stato.fantasma
      f.style.left = `${x - Number(f.dataset.dx)}px`
      f.style.top = `${y - Number(f.dataset.dy)}px`
      // Il punto in alto del fantasma decide l'ora; il dito decide il giorno.
      const b = destinazione(x, y)?.el
      if (b !== stato.bersaglio) {
        stato.bersaglio?.classList.remove('bersaglio')
        b?.classList.add('bersaglio')
        stato.bersaglio = b
      }
    }
    const lascia = (x: number, y: number) => {
      if (stato.trascina && stato.fantasma) {
        const top = y - Number(stato.fantasma.dataset.dy)
        const giorno = destinazione(x, y)
        const conOra = giorno && giorno.el.dataset.oraDa !== undefined ? destinazione(x, top + 2) ?? giorno : giorno
        stato.pulisci()
        if (conOra) callback.current.onSposta(stato.elemento, conOra.dove)
        return
      }
      stato.pulisci()
    }
    function muovi(ev: PointerEvent) { sposta(ev.clientX, ev.clientY) }
    function fine(ev: PointerEvent) { lascia(ev.clientX, ev.clientY) }
    function annulla() { if (!stato.trascina) stato.pulisci() }
    function muoviTocco(ev: TouchEvent) {
      const t = ev.touches[0]
      if (stato.armato || stato.trascina) ev.preventDefault() // durante il trascinamento la pagina non scorre
      if (t) sposta(t.clientX, t.clientY)
    }
    function fineTocco(ev: TouchEvent) {
      const t = ev.changedTouches[0]
      if (t && corrente.current === stato) lascia(t.clientX, t.clientY)
    }
    document.addEventListener('pointermove', muovi)
    document.addEventListener('pointerup', fine)
    document.addEventListener('pointercancel', annulla)
    document.addEventListener('touchmove', muoviTocco, { passive: false })
    document.addEventListener('touchend', fineTocco)
  }

  const gestori = (chiave: string, elemento: T) => ({
    'data-premuto': attivo === chiave ? 'si' : undefined,
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      inizia(chiave, elemento, e)
    },
    onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); setAttivo(chiave); callback.current.onPremuto?.(chiave) },
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
  })
  /** Vero se il clic appena arrivato conclude una pressione o un trascinamento (e va ignorato). */
  const eraPressione = () => {
    const s = scattata.current
    scattata.current = false
    return s
  }
  return { attivo, setAttivo, gestori, eraPressione }
}

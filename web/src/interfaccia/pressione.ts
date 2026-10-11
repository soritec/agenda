import { useEffect, useRef, useState } from 'react'

/**
 * Pressione prolungata (iPhone) o clic destro (Mac) su un elemento: fa comparire la sua ×.
 * Un tocco altrove la nasconde. `eraPressione()` dice se il clic appena arrivato va ignorato
 * perché ha concluso una pressione prolungata.
 */
export function usePressioneLunga() {
  const [attivo, setAttivo] = useState<string>()
  const stato = useRef<{ timer?: ReturnType<typeof setTimeout>; scattata: boolean }>({ scattata: false })

  useEffect(() => {
    if (!attivo) return
    const chiudi = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest?.('.x-elimina, [data-premuto="si"]')) setAttivo(undefined)
    }
    document.addEventListener('pointerdown', chiudi)
    return () => document.removeEventListener('pointerdown', chiudi)
  }, [attivo])

  const ferma = () => clearTimeout(stato.current.timer)
  const gestori = (chiave: string) => ({
    'data-premuto': attivo === chiave ? 'si' : undefined,
    onPointerDown: () => {
      stato.current.scattata = false
      ferma()
      stato.current.timer = setTimeout(() => {
        stato.current.scattata = true
        setAttivo(chiave)
        navigator.vibrate?.(15)
      }, 450)
    },
    onPointerUp: ferma,
    onPointerLeave: ferma,
    onPointerCancel: ferma,
    onContextMenu: (e: { preventDefault: () => void }) => { e.preventDefault(); setAttivo(chiave) },
  })
  const eraPressione = () => {
    const s = stato.current.scattata
    stato.current.scattata = false
    return s
  }
  return { attivo, setAttivo, gestori, eraPressione }
}

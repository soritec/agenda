import { useEffect, useState } from 'react'
import { ascolta, elenca, leggiImpostazioni } from './archivio'
import type { Collezioni, Impostazioni, NomeCollezione } from './modello'

/** Record della collezione, aggiornati a ogni modifica. `undefined` finché non sono caricati. */
export function useCollezione<N extends NomeCollezione>(nome: N): Collezioni[N][] | undefined {
  const [dati, setDati] = useState<Collezioni[N][]>()
  useEffect(() => {
    let attivo = true
    const carica = () => void elenca(nome).then((d) => attivo && setDati(d))
    carica()
    const smetti = ascolta(carica)
    return () => {
      attivo = false
      smetti()
    }
  }, [nome])
  return dati
}

export function useImpostazioni(): Impostazioni | undefined {
  const [dati, setDati] = useState<Impostazioni>()
  useEffect(() => {
    let attivo = true
    const carica = () => void leggiImpostazioni().then((d) => attivo && setDati(d))
    carica()
    const smetti = ascolta(carica)
    return () => {
      attivo = false
      smetti()
    }
  }, [])
  return dati
}

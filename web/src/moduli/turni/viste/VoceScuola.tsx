import { useMemo } from 'react'
import { profiloPrincipale } from '../../../dati/profili'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { parametroMese } from '../../../interfaccia/navigazione'
import { perId } from '../supporto'
import { vociScuola, type VoceScuola as Voce } from '../scuola'

/** Journal club, GOI, lezioni e riunioni del mese, per il calendario dei turni e la stampa. */
export function useVociScuola(anno: number, mese: number): Map<string, Voce[]> {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const giornate = useCollezione('ferie')
  const esami = useCollezione('esami')
  const journal = useCollezione('journalClub')
  const tolte = useImpostazioni()?.riunioniTolte
  return useMemo(() => {
    if (!profiloPrincipale()) return new Map()
    const qui = parametroMese(anno, mese)
    return vociScuola({ turni, modelli: perId(modelli), giornate, esami, journal, riunioniTolte: tolte ?? [] }, `${qui}-01`, `${qui}-31`)
  }, [turni, modelli, giornate, esami, journal, tolte, anno, mese])
}

export const Freccetta = () => (
  <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1.5 6h9M7 2.5 10.5 6 7 9.5" /></svg>
)

/** Riga di testo con la freccetta: sul telefono solo la sigla, in stampa il nome intero. */
export function VoceScuola({ voce, onApri }: { voce: Voce; onApri?: () => void }) {
  const contenuto = (
    <>
      <Freccetta />
      <span className="lungo">{voce.nome}{voce.ora ? ` ${voce.ora}` : ''}</span>
      <span className="corto">{voce.breve}</span>
    </>
  )
  const classe = `voce-scuola s-${voce.genere}`
  return onApri ? <button type="button" className={classe} title={voce.nome} onClick={onApri}>{contenuto}</button> : <span className={classe}>{contenuto}</span>
}

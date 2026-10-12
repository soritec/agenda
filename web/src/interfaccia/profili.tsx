import { useCondivisi, type Profilo } from '../dati/condiviso'
import { cambiaProfilo, PROFILO_PRINCIPALE, profiloAttivo } from '../dati/profili'

export const COLORI_PROFILO = ['#3E7C77', '#2F6FA8', '#8A4F45', '#6A4C93', '#A0742B', '#4F7A3A']

/** Profili con il principale sempre presente (anche prima di dargli un nome). */
export function useProfili() {
  const salvati = useCondivisi('profili')
  const principale: Profilo = salvati?.find((p) => p.id === PROFILO_PRINCIPALE)
    ?? { id: PROFILO_PRINCIPALE, nome: 'Io', colore: COLORI_PROFILO[0]!, creatoIl: 0, modificatoIl: 0 }
  const profili = [principale, ...(salvati ?? []).filter((p) => p.id !== PROFILO_PRINCIPALE).sort((a, b) => a.creatoIl - b.creatoIl)]
  const idAttivo = profiloAttivo()
  const attivo = profili.find((p) => p.id === idAttivo) ?? principale
  return { profili, attivo, altri: profili.filter((p) => p.id !== attivo.id), pronto: Boolean(salvati) }
}

export function Avatar({ p, dimensione = 28 }: { p: Pick<Profilo, 'nome' | 'colore'>; dimensione?: number }) {
  return (
    <span className="avatar" style={{ width: dimensione, height: dimensione, background: p.colore, fontSize: dimensione * 0.45 }} aria-hidden="true">
      {p.nome.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

/** Cambio profilo compatto (pagina Oggi, utile su iPhone): gli avatar dei profili. */
export function ScegliProfiloCompatto() {
  const { profili, attivo } = useProfili()
  if (profili.length < 2) return null
  return (
    <span className="profili-compatti" role="group" aria-label="Profilo">
      {profili.map((p) => (
        <button key={p.id} type="button" className={p.id === attivo.id ? 'attivo' : ''} title={p.id === attivo.id ? p.nome : `Passa a ${p.nome}`}
          aria-pressed={p.id === attivo.id} onClick={() => { if (p.id !== attivo.id) cambiaProfilo(p.id) }}>
          <Avatar p={p} dimensione={30} />
        </button>
      ))}
    </span>
  )
}

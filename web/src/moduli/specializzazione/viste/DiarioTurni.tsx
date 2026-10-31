import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { DiarioTurno } from '../../../dati/modello'
import { Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { giornoDaChiave } from '../../turni/supporto'

const FILTRI = [['tutto', 'Tutto'], ['imparato', 'Imparato'], ['approfondire', 'Da approfondire']] as const
type Filtro = (typeof FILTRI)[number][0]
const ms = (giorno: string) => { const g = giornoDaChiave(giorno)!; return istante(g.anno, g.mese, g.giorno, 12) }

/** Appunti di fine turno, dal più recente: cosa si è imparato e cosa approfondire, ognuno col suo colore. */
export function DiarioTurni() {
  const voci = useCollezione('diarioTurni')
  const [filtro, setFiltro] = useState<Filtro>('tutto')
  const [cerca, setCerca] = useState('')
  const [modifica, setModifica] = useState<DiarioTurno>()
  const testo = cerca.trim().toLowerCase()
  const visibili = (voci ?? []).filter((v) => (v.imparato || v.approfondire) && (filtro === 'tutto' || v[filtro])
    && (!testo || `${v.turni} ${v.imparato ?? ''} ${v.approfondire ?? ''}`.toLowerCase().includes(testo)))
    .sort((a, b) => b.giorno.localeCompare(a.giorno))
  const mesi = [...new Set(visibili.map((v) => v.giorno.slice(0, 7)))]

  async function togli(v: DiarioTurno) {
    await elimina('diarioTurni', v.id)
    mostraAvviso('Appunti tolti', () => void ripristina('diarioTurni', v.id))
  }

  return (
    <div className="schermata" style={{ maxWidth: 680 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">Diario dei turni</h1>
        </div>
      </header>
      <div className="riga-azioni" style={{ justifyContent: 'flex-start' }}>
        {FILTRI.map(([id, nome]) => <button key={id} type="button" className={`pulsante${filtro === id ? ' primario' : ''}`} onClick={() => setFiltro(id)}>{nome}</button>)}
      </div>
      {(voci ?? []).length > 5 && <input value={cerca} onChange={(e) => setCerca(e.target.value)} placeholder="Cerca negli appunti" aria-label="Cerca negli appunti" />}
      {visibili.length === 0 && <div className="vuoto">Niente da mostrare. Gli appunti arrivano dal riquadro che compare in Oggi dopo ogni turno.</div>}
      {mesi.map((m) => (
        <section key={m} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione" style={{ textTransform: 'capitalize' }}>{F.mese(ms(`${m}-01`))}</h2>
          {visibili.filter((v) => v.giorno.startsWith(m)).map((v) => (
            <article key={v.id} className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="banner-orari-testa">
                <div style={{ minWidth: 0 }}>
                  <strong>{F.dataBreve(ms(v.giorno))}</strong>
                  <span className="secondario piccolo" style={{ display: 'block' }}>{v.turni}</span>
                </div>
                <div className="riga-azioni" style={{ flexWrap: 'nowrap' }}>
                  <button type="button" className="link piccolo" onClick={() => setModifica(v)}>Modifica</button>
                  <button type="button" className="elimina-riga" aria-label={`Togli gli appunti del ${F.dataBreve(ms(v.giorno))}`} onClick={() => void togli(v)}>×</button>
                </div>
              </div>
              {v.imparato && filtro !== 'approfondire' && <p className="appunto imparato"><span>Cosa ho imparato</span>{v.imparato}</p>}
              {v.approfondire && filtro !== 'imparato' && <p className="appunto approfondire"><span>Cosa devo approfondire</span>{v.approfondire}</p>}
            </article>
          ))}
        </section>
      ))}
      {modifica && <FormDiario voce={modifica} onChiudi={() => setModifica(undefined)} />}
    </div>
  )
}

function FormDiario({ voce, onChiudi }: { voce: DiarioTurno; onChiudi: () => void }) {
  const [imparato, setImparato] = useState(voce.imparato ?? '')
  const [approfondire, setApprofondire] = useState(voce.approfondire ?? '')
  async function conferma() {
    await salva('diarioTurni', { ...voce, imparato: imparato.trim() || undefined, approfondire: approfondire.trim() || undefined })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={F.dataBreve(ms(voce.giorno))} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <label className="appunto imparato"><span>Cosa ho imparato</span><textarea rows={3} value={imparato} onChange={(e) => setImparato(e.target.value)} /></label>
        <label className="appunto approfondire"><span>Cosa devo approfondire</span><textarea rows={3} value={approfondire} onChange={(e) => setApprofondire(e.target.value)} /></label>
        <NotaPrivacy />
      </div>
    </Foglio>
  )
}

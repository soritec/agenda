import { useState } from 'react'
import * as F from '../../../nucleo/formati'
import { istante } from '../../../nucleo/calendario'
import { useCollezione } from '../../../dati/hooks'
import type { Allegato } from '../../../dati/modello'
import { Foglio } from '../../../interfaccia/componenti'
import { fileTurniPerMese } from '../fileTurni'
import { ImportaTurni } from './ImportaTurni'

const titoloMese = (m: string) => { const [a, n] = m.split('-').map(Number); return F.mese(istante(a!, n!, 1, 12)) }

/** Scelta di uno o più PDF della pagina "File dei turni" da cui leggere i propri turni. */
export function EstraiDaFile({ aperto, onChiudi }: { aperto: boolean; onChiudi: () => void }) {
  const allegati = useCollezione('allegati')
  const [scelti, setScelti] = useState<Set<string>>(new Set())
  const [daLeggere, setDaLeggere] = useState<Allegato[]>([])
  const gruppi = fileTurniPerMese((allegati ?? []).filter((a) => a.tipoMime === 'application/pdf'))
  const cambia = (id: string) => setScelti((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const chiudi = () => { setScelti(new Set()); onChiudi() }

  return (
    <>
      <Foglio aperto={aperto && daLeggere.length === 0} titolo="Estrai da file" onChiudi={chiudi}
        azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={scelti.size === 0}
          onClick={() => setDaLeggere((allegati ?? []).filter((a) => scelti.has(a.id)))}>Leggi{scelti.size ? ` (${scelti.size})` : ''}</button>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <span className="secondario piccolo">Scegli uno o più file caricati in Specializzazione → File dei turni (per esempio guardie e turni dello stesso mese).</span>
          {gruppi.length === 0 && <div className="vuoto">Nessun PDF. <a href="#/specializzazione/fileturni" onClick={chiudi}>Carica i file dei turni</a></div>}
          {gruppi.map((g) => (
            <section key={g.mese}>
              <div className="gruppo-titolo" style={{ textTransform: 'capitalize' }}>{titoloMese(g.mese)}</div>
              <div className="lista">
                {g.file.map((a) => (
                  <label key={a.id} className="riga">
                    <input type="checkbox" checked={scelti.has(a.id)} onChange={() => cambia(a.id)} />
                    <span className="crescente">
                      <span style={{ fontWeight: 600 }}>{a.nome}</span>
                      <span className="secondario piccolo">caricato il {F.dataBreve(a.creatoIl)}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ))}
          {gruppi.length > 0 && <a className="piccolo" href="#/specializzazione/fileturni" onClick={chiudi}>Vai ai file dei turni</a>}
        </div>
      </Foglio>
      <ImportaTurni allegati={daLeggere} onChiudi={() => { setDaLeggere([]); chiudi() }} />
    </>
  )
}

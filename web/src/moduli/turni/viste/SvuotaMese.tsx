import { useState } from 'react'
import { intervalloMese, istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elenca, elimina, ripristina } from '../../../dati/archivio'
import { Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { parametroMese } from '../../../interfaccia/navigazione'
import { tipoGiornataDa } from '../tipi'

/** Elimina in un colpo tutti i turni del mese (e, se scelto, anche ferie, riposo…), con "Annulla". */
export function SvuotaMese({ anno, mese, turni, giornate, onChiudi }: { anno: number; mese: number; turni: number; giornate: number; onChiudi: () => void }) {
  const [ancheGiornate, setAncheGiornate] = useState(turni === 0)
  const [inCorso, setInCorso] = useState(false)
  const nome = F.mese(istante(anno, mese, 1))

  async function conferma() {
    setInCorso(true)
    const { inizio, fine } = intervalloMese(anno, mese)
    const qui = parametroMese(anno, mese)
    const daTurni = (await elenca('turni')).filter((t) => t.inizio >= inizio && t.inizio < fine).map((t) => t.id)
    const idTurni = new Set(daTurni)
    // Sempre anche gli smonto automatici delle notti eliminate; le altre giornate solo se richiesto.
    const daGiornate = (await elenca('ferie'))
      .filter((g) => (ancheGiornate && g.giorno.startsWith(qui)) || (g.turnoId && idTurni.has(g.turnoId) && tipoGiornataDa(g.tipo) === 'smontoNotte'))
      .map((g) => g.id)
    for (const id of daTurni) await elimina('turni', id)
    for (const id of daGiornate) await elimina('ferie', id)
    onChiudi()
    mostraAvviso(`${nome}: eliminati ${daTurni.length} turni${daGiornate.length ? ` e ${daGiornate.length} giornate` : ''}`, () => {
      void (async () => {
        for (const id of daTurni) await ripristina('turni', id)
        for (const id of daGiornate) await ripristina('ferie', id)
      })()
    })
  }

  return (
    <Foglio aperto titolo="Svuota il mese" onChiudi={onChiudi}>
      <div className="modulo">
        <p style={{ margin: 0 }}>
          Elimino <strong>{turni === 1 ? 'il turno' : `tutti i ${turni} turni`} di {nome}</strong>. Subito dopo hai qualche secondo per premere "Annulla".
        </p>
        {giornate > 0 && (
          <label className="interruttore" style={{ borderBottom: 'none' }}>
            <span>Elimina anche ferie, riposo, congressi e smonto ({giornate})</span>
            <input type="checkbox" checked={ancheGiornate} onChange={(e) => setAncheGiornate(e.target.checked)} />
          </label>
        )}
        <div className="riga-azioni">
          <button type="button" className="pulsante pericolo" disabled={inCorso} onClick={() => void conferma()} style={{ fontWeight: 700 }}>
            Elimina tutto {nome}
          </button>
          <button type="button" className="pulsante" onClick={onChiudi}>Annulla</button>
        </div>
      </div>
    </Foglio>
  )
}

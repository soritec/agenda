import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Application } from '../../../dati/modello'
import { mostraAvviso } from '../../../interfaccia/componenti'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import { lunediDi } from '../../agenda/impegni'
import { programmaDa, TITOLI_PROGRAMMA } from '../../applications/logica'
import { DATI_TEMA, temaDa } from '../logica'
import { cambiaSegnalibro, Segnalibro } from './Commercial'

const dataBreve = (g?: string) => { const c = g ? giornoDaChiave(g) : undefined; return c ? F.dataBreve(istante(c.anno, c.mese, c.giorno, 12)) : '' }

/** Applications: segnalibro con "Annulla" quando si toglie. */
export async function segnalibroApplication(a: Application) {
  if (a.salvata) {
    await salva('applications', { ...a, salvata: undefined, salvataIl: undefined })
    mostraAvviso('Tolta dai salvati', () => void salva('applications', a))
  } else {
    await salva('applications', { ...a, salvata: true, salvataIl: chiaveGiorno(oggi()) })
  }
}

/** Tutto ciò che è stato salvato con il segnalibro: notizie e application. */
export function Salvati() {
  const notizie = useCollezione('notizie')
  const applications = useCollezione('applications')
  const [filtro, setFiltro] = useState<'tutti' | 'notizie' | 'applications'>('tutti')
  const nSalvate = (notizie ?? []).filter((n) => n.salvata)
  const aSalvate = (applications ?? []).filter((a) => a.salvata)
  const voci = [
    ...(filtro !== 'applications' ? nSalvate.map((n) => ({ tipo: 'notizia' as const, quando: n.salvataIl ?? '', n })) : []),
    ...(filtro !== 'notizie' ? aSalvate.map((a) => ({ tipo: 'application' as const, quando: a.salvataIl ?? '', a })) : []),
  ].sort((x, y) => y.quando.localeCompare(x.quando))

  return (
    <div className="schermata" style={{ maxWidth: 820 }}>
      <header className="intestazione"><h1 className="titolo-grande">Salvati</h1></header>
      <div className="segmenti" style={{ maxWidth: 460 }}>
        {([['tutti', `Tutti · ${nSalvate.length + aSalvate.length}`], ['notizie', `Notizie · ${nSalvate.length}`], ['applications', `Applications · ${aSalvate.length}`]] as const).map(([k, t]) => (
          <button key={k} type="button" className={filtro === k ? 'attivo' : ''} onClick={() => setFiltro(k)}>{t}</button>
        ))}
      </div>
      <div className="lista">
        {voci.length === 0 && <div className="vuoto">Niente di salvato. Tocca il segnalibro su una notizia di Commercial awareness o su un'application per ritrovarla qui.</div>}
        {voci.map((v) => v.tipo === 'notizia' ? (
          <div key={v.n.id} className="riga riga-salvato" style={{ cursor: 'default' }}>
            <span className="etichetta-tema" style={{ background: DATI_TEMA[temaDa(v.n.tema)].sfondo, color: DATI_TEMA[temaDa(v.n.tema)].colore }}>{DATI_TEMA[temaDa(v.n.tema)].nome}</span>
            <a className="crescente" href={lunediDi(v.n.giorno) ? `#/commercial?settimana=${lunediDi(v.n.giorno)}` : '#/commercial'} style={{ color: 'inherit' }}>
              <span style={{ fontWeight: 600 }} lang={temaDa(v.n.tema) === 'ita' ? 'it' : 'en'}>{v.n.titolo}</span>
              <span className="secondario piccolo">{[v.n.fonte, dataBreve(v.n.giorno), v.n.salvataIl ? `salvata ${dataBreve(v.n.salvataIl)}` : '', v.n.perche || v.n.colloquio ? 'con note' : ''].filter(Boolean).join(' · ')}</span>
            </a>
            <Segnalibro salvata onClick={() => void cambiaSegnalibro(v.n)} etichetta="Togli dai salvati" />
          </div>
        ) : (
          <div key={v.a.id} className="riga riga-salvato" style={{ cursor: 'default' }}>
            <span className="etichetta-tema" style={{ background: 'var(--superficie-2)', color: 'var(--testo-2)' }}>Application</span>
            <a className="crescente" href="#/applications" style={{ color: 'inherit' }}>
              <span style={{ fontWeight: 600, color: v.a.colore }}>{v.a.studio}</span>
              <span className="secondario piccolo">{[TITOLI_PROGRAMMA[programmaDa(v.a.programma)], v.a.salvataIl ? `salvata ${dataBreve(v.a.salvataIl)}` : ''].filter(Boolean).join(' · ')}</span>
            </a>
            <Segnalibro salvata onClick={() => void segnalibroApplication(v.a)} etichetta="Togli dai salvati" />
          </div>
        ))}
      </div>
    </div>
  )
}

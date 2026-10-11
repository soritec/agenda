import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Tassa } from '../../../dati/modello'
import { Avviso, Campo, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { centesimiDaTesto, chiaveGiorno, giornoDaChiave, oggi, testoDaCentesimi } from '../../turni/supporto'
import { statoTassa, TITOLI_STATO_TASSA, type StatoTassa } from '../logica'

const ORDINE: StatoTassa[] = ['scaduta', 'inScadenza', 'daPagare', 'pagato']
const dataBreve = (giorno?: string) => {
  const g = giorno ? giornoDaChiave(giorno) : undefined
  return g ? F.dataBreve(istante(g.anno, g.mese, g.giorno, 12)) : ''
}

/** Tasse (es. iscrizione alla scuola): da pagare o pagate, con importo, scadenza e colore di stato. */
export function Tasse() {
  const tasse = useCollezione('tasse')
  const [modifica, setModifica] = useState<{ record?: Tassa } | undefined>()
  const oggiChiave = chiaveGiorno(oggi())
  const elenco = [...(tasse ?? [])].map((t) => ({ t, stato: statoTassa(t, oggiChiave) }))
    .sort((a, b) => ORDINE.indexOf(a.stato) - ORDINE.indexOf(b.stato) || (a.t.scadenza ?? '9').localeCompare(b.t.scadenza ?? '9'))
  const daPagare = elenco.filter((x) => x.stato !== 'pagato')
  const anno = oggiChiave.slice(0, 4)
  const pagateAnno = elenco.filter((x) => x.stato === 'pagato' && (x.t.pagatoIl ?? x.t.scadenza ?? '').startsWith(anno))

  async function segnaPagata(t: Tassa, pagata: boolean) {
    await salva('tasse', { ...t, stato: pagata ? 'pagato' : 'daPagare', pagatoIl: pagata ? oggiChiave : undefined })
  }

  return (
    <div className="schermata" style={{ maxWidth: 760 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">Tasse</h1>
        </div>
        <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ Tassa</button>
      </header>

      <div className="tessere">
        <div className="tessera">
          <span className="valore">{F.importo(daPagare.reduce((s, x) => s + x.t.importoCent, 0))}</span>
          <span className="secondario piccolo">da pagare ({daPagare.length})</span>
        </div>
        <div className="tessera">
          <span className="valore">{F.importo(pagateAnno.reduce((s, x) => s + x.t.importoCent, 0))}</span>
          <span className="secondario piccolo">pagate nel {anno}</span>
        </div>
      </div>

      <div className="lista">
        {elenco.length === 0 && <div className="vuoto">Nessuna tassa. Aggiungi per esempio la rata di iscrizione.</div>}
        {elenco.map(({ t, stato }) => (
          <div key={t.id} className={`riga${stato === 'pagato' ? ' conclusa' : ''}`} style={{ cursor: 'default' }}>
            <input type="checkbox" checked={stato === 'pagato'} aria-label="Pagata" onChange={(e) => void segnaPagata(t, e.target.checked)}
              style={{ width: 20, height: 20, accentColor: 'var(--primario)', flexShrink: 0 }} />
            <button type="button" onClick={() => setModifica({ record: t })}
              style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
              <span className="crescente">
                <span style={{ fontWeight: 600 }}>{t.descrizione}</span>
                <span className="secondario piccolo">
                  {stato === 'pagato' ? (t.pagatoIl ? `pagata ${dataBreve(t.pagatoIl)}` : 'pagata') : t.scadenza ? `scade ${dataBreve(t.scadenza)}` : 'senza scadenza'}
                </span>
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span className="numeri" style={{ fontWeight: 700 }}>{F.importo(t.importoCent)}</span>
                <span className={`etichetta-tipo colore-${stato}`}>{TITOLI_STATO_TASSA[stato]}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
      {modifica && <FormTassa record={modifica.record} onChiudi={() => setModifica(undefined)} />}
    </div>
  )
}

function FormTassa({ record, onChiudi }: { record?: Tassa; onChiudi: () => void }) {
  const [b, setB] = useState({
    descrizione: record?.descrizione ?? '', importo: testoDaCentesimi(record?.importoCent), scadenza: record?.scadenza ?? '',
    pagata: record?.stato === 'pagato', note: record?.note ?? '',
  })
  const importoCent = centesimiDaTesto(b.importo)
  const valido = b.descrizione.trim() !== '' && typeof importoCent === 'number'
  async function conferma() {
    if (!valido || typeof importoCent !== 'number') return
    await salva('tasse', {
      ...record, descrizione: b.descrizione.trim(), importoCent, scadenza: b.scadenza || undefined,
      stato: b.pagata ? 'pagato' : 'daPagare', pagatoIl: b.pagata ? (record?.pagatoIl ?? chiaveGiorno(oggi())) : undefined, note: b.note.trim() || undefined,
    })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={record ? 'Tassa' : 'Nuova tassa'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Descrizione"><input value={b.descrizione} placeholder="es. Seconda rata iscrizione" onChange={(e) => setB({ ...b, descrizione: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Importo (€)"><input inputMode="decimal" value={b.importo} placeholder="es. 1250" onChange={(e) => setB({ ...b, importo: e.target.value })} /></Campo>
          <Campo etichetta="Scadenza"><input type="date" value={b.scadenza} onChange={(e) => setB({ ...b, scadenza: e.target.value })} /></Campo>
        </div>
        {b.importo.trim() !== '' && importoCent === null && <Avviso>Scrivi l'importo come 1250 oppure 1250,50.</Avviso>}
        <label className="interruttore" style={{ borderBottom: 'none' }}>
          <span>Pagata</span>
          <input type="checkbox" checked={b.pagata} onChange={(e) => setB({ ...b, pagata: e.target.checked })} />
        </label>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        {record && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('tasse', record.id).then(() => { onChiudi(); mostraAvviso(`Eliminata: ${record.descrizione}`, () => void ripristina('tasse', record.id)) })}>
            Elimina
          </button>
        )}
      </div>
    </Foglio>
  )
}

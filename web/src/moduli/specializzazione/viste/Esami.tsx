import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { EsameOLezione } from '../../../dati/modello'
import { Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'

const TIPI = [{ id: 'esame', titolo: 'Esame' }, { id: 'lezione', titolo: 'Lezione' }] as const
const dataEstesa = (giorno: string) => {
  const g = giornoDaChiave(giorno)
  return g ? F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12)) : giorno
}

export function Esami() {
  const esami = useCollezione('esami')
  const [modifica, setModifica] = useState<{ record?: EsameOLezione } | undefined>()
  const oggiChiave = chiaveGiorno(oggi())
  const ordinati = [...(esami ?? [])].sort((a, b) => a.giorno.localeCompare(b.giorno))
  const futuri = ordinati.filter((e) => e.giorno >= oggiChiave)
  const passati = ordinati.filter((e) => e.giorno < oggiChiave).reverse()

  const elenco = (voci: EsameOLezione[], vuoto: string) => (
    <div className="lista">
      {voci.length === 0 && <div className="vuoto piccolo">{vuoto}</div>}
      {voci.map((e) => (
        <button key={e.id} type="button" className="riga" onClick={() => setModifica({ record: e })}>
          <span className="crescente">
            <span style={{ fontWeight: 500 }}>{e.titolo}</span>
            <span className="secondario piccolo">{[e.tipo === 'esame' ? 'Esame' : 'Lezione', dataEstesa(e.giorno), e.materia].filter(Boolean).join(' · ')}</span>
          </span>
          {e.esito && <span className="numeri" style={{ fontWeight: 700 }}>{e.esito}</span>}
        </button>
      ))}
    </div>
  )

  return (
    <div className="schermata" style={{ maxWidth: 760 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">Esami e lezioni</h1>
        </div>
        <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ Aggiungi</button>
      </header>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">In programma</h2>
        {elenco(futuri, 'Niente in programma')}
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Passati</h2>
        {elenco(passati, 'Ancora nessuno')}
      </section>
      {modifica && <FormEsame record={modifica.record} onChiudi={() => setModifica(undefined)} />}
    </div>
  )
}

function FormEsame({ record, onChiudi }: { record?: EsameOLezione; onChiudi: () => void }) {
  const [b, setB] = useState({
    giorno: record?.giorno ?? chiaveGiorno(oggi()), tipo: record?.tipo ?? 'esame', titolo: record?.titolo ?? '',
    materia: record?.materia ?? '', esito: record?.esito ?? '', note: record?.note ?? '',
  })
  const valido = b.titolo.trim() !== '' && !!giornoDaChiave(b.giorno)
  async function conferma() {
    if (!valido) return
    await salva('esami', {
      ...record, giorno: b.giorno, tipo: b.tipo, titolo: b.titolo.trim(),
      materia: b.materia.trim() || undefined, esito: b.esito.trim() || undefined, note: b.note.trim() || undefined,
    })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={record ? (record.tipo === 'esame' ? 'Esame' : 'Lezione') : 'Nuovo esame o lezione'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <div role="group" aria-label="Tipo" className="riga-azioni">
          {TIPI.map((t) => (
            <button key={t.id} type="button" className="pillola" aria-pressed={b.tipo === t.id} onClick={() => setB({ ...b, tipo: t.id })}
              style={b.tipo === t.id ? { background: 'var(--primario)', color: 'var(--primario-testo)', borderColor: 'transparent', height: 36 } : { height: 36 }}>
              {t.titolo}
            </button>
          ))}
        </div>
        <Campo etichetta="Titolo"><input value={b.titolo} placeholder={b.tipo === 'esame' ? 'es. Esame di fine anno' : 'es. Diagnosi prenatale'} onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Data"><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
          <Campo etichetta="Materia (facoltativa)"><input value={b.materia} onChange={(e) => setB({ ...b, materia: e.target.value })} /></Campo>
        </div>
        <Campo etichetta={b.tipo === 'esame' ? 'Esito o voto' : 'Esito (facoltativo)'}><input value={b.esito} placeholder={b.tipo === 'esame' ? 'es. 30/30' : ''} onChange={(e) => setB({ ...b, esito: e.target.value })} /></Campo>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <NotaPrivacy />
        {record && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('esami', record.id).then(() => { onChiudi(); mostraAvviso(`Eliminato: ${record.titolo}`, () => void ripristina('esami', record.id)) })}>
            Elimina
          </button>
        )}
      </div>
    </Foglio>
  )
}

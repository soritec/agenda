import { profiloPrincipale } from '../../../dati/profili'
import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { EsameOLezione } from '../../../dati/modello'
import { Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import { eConcluso } from '../logica'

export type TipoAttivita = 'esame' | 'lezione'
const TITOLI = {
  esame: { uno: 'Esame', tanti: 'Esami', nuovo: 'Nuovo esame', conclusi: 'Conclusi' },
  lezione: { uno: 'Lezione', tanti: 'Lezioni', nuovo: 'Nuova lezione', conclusi: 'Concluse' },
}

const dataEstesa = (giorno: string) => {
  const g = giornoDaChiave(giorno)
  return g ? F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12)) : giorno
}

/** Esami oppure lezioni: quelli conclusi (data passata o segnati come completati) restano in trasparenza. */
export function EsamiOLezioni({ tipo }: { tipo: TipoAttivita }) {
  const tutti = useCollezione('esami')
  const [modifica, setModifica] = useState<{ record?: EsameOLezione } | undefined>()
  const oggiChiave = chiaveGiorno(oggi())
  const voci = (tutti ?? []).filter((e) => e.tipo === tipo)
  const prossimi = voci.filter((e) => !eConcluso(e, oggiChiave)).sort((a, b) => a.giorno.localeCompare(b.giorno))
  const conclusi = voci.filter((e) => eConcluso(e, oggiChiave)).sort((a, b) => b.giorno.localeCompare(a.giorno))
  const t = TITOLI[tipo]

  const riga = (e: EsameOLezione, concluso: boolean) => (
    <div key={e.id} className={`riga${concluso ? ' conclusa' : ''}`} style={{ cursor: 'default' }}>
      <input type="checkbox" checked={Boolean(e.completato)} aria-label={`${t.uno} completato`}
        onChange={(ev) => void salva('esami', { ...e, completato: ev.target.checked || undefined })}
        style={{ width: 20, height: 20, accentColor: 'var(--primario)', flexShrink: 0 }} />
      <button type="button" onClick={() => setModifica({ record: e })}
        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
        <span className={`etichetta-tipo colore-${tipo}`}>{t.uno}</span>
        <span className="crescente">
          <span style={{ fontWeight: 600, textDecoration: e.completato ? 'line-through' : undefined }}>{e.titolo}</span>
          <span className="secondario piccolo">{[dataEstesa(e.giorno), e.materia].filter(Boolean).join(' · ')}</span>
        </span>
        {e.esito && <span className="numeri" style={{ fontWeight: 700 }}>{e.esito}</span>}
      </button>
    </div>
  )

  return (
    <div className="schermata" style={{ maxWidth: 760 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">{t.tanti}</h1>
        </div>
        <div className="riga-azioni">
          <a className="pulsante" href={`#/specializzazione/${tipo === 'esame' ? 'lezioni' : 'esami'}`}>{TITOLI[tipo === 'esame' ? 'lezione' : 'esame'].tanti}</a>
          <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ {t.uno}</button>
        </div>
      </header>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">In programma</h2>
        <div className="lista">
          {prossimi.length === 0 && <div className="vuoto piccolo">Niente in programma</div>}
          {prossimi.map((e) => riga(e, false))}
        </div>
      </section>
      {conclusi.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione">{t.conclusi}</h2>
          <div className="lista">{conclusi.map((e) => riga(e, true))}</div>
        </section>
      )}
      {modifica && <FormAttivita tipo={tipo} record={modifica.record} onChiudi={() => setModifica(undefined)} />}
    </div>
  )
}

export function FormAttivita({ tipo, record, giorno, onChiudi }: { tipo: TipoAttivita; record?: EsameOLezione; giorno?: string; onChiudi: () => void }) {
  const [b, setB] = useState({
    giorno: record?.giorno ?? giorno ?? chiaveGiorno(oggi()), titolo: record?.titolo ?? '',
    materia: record?.materia ?? '', esito: record?.esito ?? '', note: record?.note ?? '', completato: Boolean(record?.completato),
  })
  const t = TITOLI[tipo]
  const valido = b.titolo.trim() !== '' && !!giornoDaChiave(b.giorno)
  async function conferma() {
    if (!valido) return
    await salva('esami', {
      ...record, tipo, giorno: b.giorno, titolo: b.titolo.trim(), completato: b.completato || undefined,
      materia: b.materia.trim() || undefined, esito: b.esito.trim() || undefined, note: b.note.trim() || undefined,
    })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={record ? t.uno : t.nuovo} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Titolo"><input value={b.titolo} placeholder={profiloPrincipale() ? (tipo === 'esame' ? 'es. Esame di fine anno' : 'es. Diagnosi prenatale') : (tipo === 'esame' ? 'es. Contract Law, esame finale' : 'es. Seminario di Tort Law')} onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Data"><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
          <Campo etichetta="Materia (facoltativa)"><input value={b.materia} onChange={(e) => setB({ ...b, materia: e.target.value })} /></Campo>
        </div>
        <Campo etichetta={tipo === 'esame' ? 'Esito o voto' : 'Esito (facoltativo)'}><input value={b.esito} placeholder={tipo === 'esame' ? (profiloPrincipale() ? 'es. 30/30' : 'es. 68 (Merit)') : ''} onChange={(e) => setB({ ...b, esito: e.target.value })} /></Campo>
        <label className="interruttore" style={{ borderBottom: 'none' }}>
          <span>Completato</span>
          <input type="checkbox" checked={b.completato} onChange={(e) => setB({ ...b, completato: e.target.checked })} />
        </label>
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

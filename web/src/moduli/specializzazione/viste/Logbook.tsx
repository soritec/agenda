import { useEffect, useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Procedura } from '../../../dati/modello'
import { blobCSV, type TabellaExport } from '../../../export/csv'
import { condividiOScarica, creaPdf, scarica } from '../../../export/pdf'
import { Avviso, Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { chiaveGiorno, giornoDaChiave, oggi, perId } from '../../turni/supporto'
import { ANNI_PREDEFINITI, annoDiCorso, conteggi, RUOLI, ruoloDa, settimaneValide, TITOLI_RUOLO, type Ruolo } from '../logica'

const dataBreve = (giorno: string) => {
  const g = giornoDaChiave(giorno)
  return g ? F.dataBreve(istante(g.anno, g.mese, g.giorno, 12)) : giorno
}

export function Logbook({ apriNuova }: { apriNuova: boolean }) {
  const procedure = useCollezione('procedure')
  const tipi = useCollezione('tipiProcedura')
  const impostazioni = useImpostazioni()
  const [anno, setAnno] = useState<number>()
  const [modifica, setModifica] = useState<{ record?: Procedura } | undefined>(apriNuova ? {} : undefined)
  const [mostrate, setMostrate] = useState(30)

  const anni = impostazioni?.anniSpecializzazione ?? ANNI_PREDEFINITI
  const mappaTipi = useMemo(() => perId(tipi), [tipi])
  const c = useMemo(() => conteggi(procedure ?? [], anno), [procedure, anno])
  const righe = useMemo(() => [...c.perTipo.entries()]
    .map(([id, r]) => ({ id, nome: mappaTipi.get(id)?.nome ?? '—', ...r, totale: r.primo + r.secondo + r.osservatore }))
    .sort((a, b) => b.totale - a.totale || a.nome.localeCompare(b.nome)), [c, mappaTipi])
  const elenco = useMemo(() => [...(procedure ?? [])]
    .filter((p) => anno === undefined || p.annoCorso === anno)
    .sort((a, b) => b.giorno.localeCompare(a.giorno) || b.creatoIl - a.creatoIl), [procedure, anno])

  const titoloFiltro = anno ? `${anno}° anno` : 'Tutti gli anni'

  async function esportaPdf(azione: 'scarica' | 'condividi') {
    const blob = await creaPdf({
      titolo: 'Logbook della specializzazione',
      sottotitolo: `${titoloFiltro} · aggiornato ${F.dataEstesa(Date.now())}`,
      riepilogo: [
        { etichetta: 'procedure', valore: String(c.totale) },
        ...RUOLI.map((r) => ({ etichetta: TITOLI_RUOLO[r].toLowerCase(), valore: String(c.perRuolo[r]) })),
      ],
      intestazioni: ['Procedura', '1° operatore', '2° operatore', 'Osservatore', 'Totale'],
      righe: righe.map((r) => ({ celle: [r.nome, String(r.primo), String(r.secondo), String(r.osservatore), String(r.totale)] })),
      colonneGrassetto: [0, 4],
      colonneDestra: [1, 2, 3, 4],
      totaleTabella: ['Totale', String(c.perRuolo.primo), String(c.perRuolo.secondo), String(c.perRuolo.osservatore), String(c.totale)],
      piede: 'Agenda · logbook con soli dati anonimi',
    })
    const nome = `Logbook ${titoloFiltro}.pdf`
    if (azione === 'scarica') scarica(blob, nome)
    else await condividiOScarica(blob, nome, 'Logbook')
  }

  function esportaCsv() {
    const tabella: TabellaExport = {
      titolo: 'Logbook',
      intestazioni: ['Data', 'Procedura', 'Ruolo', 'Anno di corso', 'Età', 'Settimane', 'Esito', 'Note'],
      righe: elenco.map((p) => [
        { tipo: 'testo', valore: p.giorno.split('-').reverse().join('/') },
        { tipo: 'testo', valore: mappaTipi.get(p.tipoId)?.nome ?? '' },
        { tipo: 'testo', valore: TITOLI_RUOLO[ruoloDa(p.ruolo)] },
        { tipo: 'intero', valore: p.annoCorso },
        p.eta !== undefined ? { tipo: 'intero', valore: p.eta } : { tipo: 'vuota' },
        { tipo: 'testo', valore: p.settimane ?? '' },
        { tipo: 'testo', valore: p.esito ?? '' },
        { tipo: 'testo', valore: p.note ?? '' },
      ]),
    }
    scarica(blobCSV(tabella), `Logbook ${titoloFiltro}.csv`)
  }

  return (
    <div className="schermata">
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">Logbook</h1>
        </div>
        <div className="riga-azioni">
          <button type="button" className="pulsante" onClick={() => void esportaPdf('scarica')}>PDF</button>
          <button type="button" className="pulsante" onClick={esportaCsv}>Excel (CSV)</button>
          {'share' in navigator && <button type="button" className="pulsante" onClick={() => void esportaPdf('condividi')}>Condividi</button>}
          <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ Procedura</button>
        </div>
      </header>

      <div role="group" aria-label="Anno di corso" className="riga-azioni">
        {[undefined, ...Array.from({ length: anni }, (_, i) => i + 1)].map((a) => (
          <button key={a ?? 'tutti'} type="button" className="pillola" aria-pressed={anno === a} onClick={() => setAnno(a)}
            style={anno === a ? { background: 'var(--primario)', color: 'var(--primario-testo)', borderColor: 'transparent' } : undefined}>
            {a ? `${a}° anno${c.perAnno.get(a) ? ` · ${c.perAnno.get(a)}` : ''}` : 'Tutti'}
          </button>
        ))}
      </div>

      <div className="tessere">
        <div className="tessera"><span className="valore">{c.totale}</span><span className="secondario piccolo">procedure</span></div>
        {RUOLI.map((r) => (
          <div key={r} className="tessera"><span className="valore">{c.perRuolo[r]}</span><span className="secondario piccolo">{TITOLI_RUOLO[r].toLowerCase()}</span></div>
        ))}
      </div>

      <section style={{ overflowX: 'auto' }}>
        <table className="tabella-stampa" style={{ minWidth: 480 }}>
          <thead>
            <tr><th>Procedura</th><th style={{ textAlign: 'right' }}>1° op.</th><th style={{ textAlign: 'right' }}>2° op.</th><th style={{ textAlign: 'right' }}>Oss.</th><th style={{ textAlign: 'right' }}>Totale</th></tr>
          </thead>
          <tbody>
            {righe.length === 0 && <tr><td colSpan={5} className="secondario">Nessuna procedura{anno ? ' in questo anno' : ''}.</td></tr>}
            {righe.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.nome}</td>
                <td className="numeri" style={{ textAlign: 'right' }}>{r.primo || ''}</td>
                <td className="numeri" style={{ textAlign: 'right' }}>{r.secondo || ''}</td>
                <td className="numeri" style={{ textAlign: 'right' }}>{r.osservatore || ''}</td>
                <td className="numeri" style={{ textAlign: 'right', fontWeight: 700 }}>{r.totale}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Ultime registrate</h2>
        <div className="lista">
          {elenco.length === 0 && <div className="vuoto">Ancora niente qui.</div>}
          {elenco.slice(0, mostrate).map((p) => (
            <div key={p.id} className="riga" style={{ cursor: 'default' }}>
              <button type="button" onClick={() => setModifica({ record: p })}
                style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                <span className="secondario piccolo numeri" style={{ width: 70, flexShrink: 0 }}>{dataBreve(p.giorno)}</span>
                <span className="crescente">
                  <span style={{ fontWeight: 500 }}>{mappaTipi.get(p.tipoId)?.nome ?? '—'}</span>
                  <span className="secondario piccolo">
                    {[TITOLI_RUOLO[ruoloDa(p.ruolo)], `${p.annoCorso}° anno`, p.eta !== undefined ? `${p.eta} anni` : '', p.settimane ? `${p.settimane} sett.` : '', p.esito ?? ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </button>
              <button type="button" className="elimina-riga" aria-label="Elimina"
                onClick={() => void elimina('procedure', p.id).then(() => mostraAvviso('Procedura eliminata', () => void ripristina('procedure', p.id)))}>×</button>
            </div>
          ))}
        </div>
        {elenco.length > mostrate && <button type="button" className="pulsante" onClick={() => setMostrate((n) => n + 50)}>Mostra altre</button>}
      </section>

      {modifica && (
        <FormProcedura record={modifica.record} inizio={impostazioni?.inizioSpecializzazione} anni={anni} onChiudi={() => setModifica(undefined)} />
      )}
    </div>
  )
}

function FormProcedura({ record, inizio, anni, onChiudi }: { record?: Procedura; inizio?: string; anni: number; onChiudi: () => void }) {
  const tipi = useCollezione('tipiProcedura')
  const [giorno, setGiorno] = useState(record?.giorno ?? chiaveGiorno(oggi()))
  const [tipoId, setTipoId] = useState(record?.tipoId ?? '')
  const [ruolo, setRuolo] = useState<Ruolo>(record ? ruoloDa(record.ruolo) : 'primo')
  const annoAutomatico = annoDiCorso(inizio, giorno, anni)
  const [annoScelto, setAnnoScelto] = useState<number | undefined>(record?.annoCorso)
  const [eta, setEta] = useState(record?.eta?.toString() ?? '')
  const [settimane, setSettimane] = useState(record?.settimane ?? '')
  const [esito, setEsito] = useState(record?.esito ?? '')
  const [note, setNote] = useState(record?.note ?? '')
  const [filtro, setFiltro] = useState('')

  // Senza una scelta esplicita, l'anno segue la data.
  useEffect(() => { if (!record) setAnnoScelto(undefined) }, [giorno, record])
  const annoCorso = annoScelto ?? annoAutomatico ?? 1
  const etaNumero = eta.trim() === '' ? undefined : Number(eta)
  const etaValida = etaNumero === undefined || (Number.isInteger(etaNumero) && etaNumero >= 10 && etaNumero <= 70)
  const settimaneOk = settimane.trim() === '' || settimaneValide(settimane)
  const valido = !!giornoDaChiave(giorno) && tipoId !== '' && etaValida && settimaneOk

  const elencoTipi = [...(tipi ?? [])].sort((a, b) => a.ordine - b.ordine)
    .filter((t) => !filtro.trim() || t.nome.toLowerCase().includes(filtro.trim().toLowerCase()))

  async function conferma() {
    if (!valido) return
    await salva('procedure', {
      ...record, giorno, tipoId, ruolo, annoCorso,
      eta: etaNumero, settimane: settimane.trim().replace(/\s+/g, '') || undefined, esito: esito.trim() || undefined, note: note.trim() || undefined,
    })
    onChiudi()
    if (!record) mostraAvviso('Procedura aggiunta al logbook')
  }

  return (
    <Foglio aperto titolo={record ? 'Procedura' : 'Nuova procedura'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <div className="campi-affiancati">
          <Campo etichetta="Data"><input type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} /></Campo>
          <Campo etichetta={annoAutomatico ? 'Anno di corso (automatico)' : 'Anno di corso'}>
            <select value={annoCorso} onChange={(e) => setAnnoScelto(Number(e.target.value))}>
              {Array.from({ length: anni }, (_, i) => i + 1).map((a) => <option key={a} value={a}>{a}° anno</option>)}
            </select>
          </Campo>
        </div>

        <div className="campo">
          <span>Procedura</span>
          {(tipi ?? []).length > 10 && (
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Cerca…"
              style={{ minHeight: 38, padding: '6px 12px', borderRadius: 10, border: '1px solid var(--linea-forte)', background: 'var(--superficie)' }} />
          )}
          <div className="scelte-rapide">
            {elencoTipi.map((t) => (
              <button key={t.id} type="button" className="scelta-rapida" aria-pressed={tipoId === t.id} onClick={() => setTipoId(t.id)}
                style={tipoId === t.id ? { borderColor: 'var(--primario)', borderWidth: 2, background: 'var(--accento-tenue)', fontWeight: 600 } : undefined}>
                <span className="nome">{t.nome}</span>
              </button>
            ))}
          </div>
          <a href="#/specializzazione/impostazioni" className="piccolo" onClick={onChiudi}>Modifica l'elenco delle procedure</a>
        </div>

        <div className="campo">
          <span>Ruolo</span>
          <div role="group" aria-label="Ruolo" className="riga-azioni">
            {RUOLI.map((r) => (
              <button key={r} type="button" className="pillola" aria-pressed={ruolo === r} onClick={() => setRuolo(r)}
                style={ruolo === r ? { background: 'var(--primario)', color: 'var(--primario-testo)', borderColor: 'transparent', height: 36 } : { height: 36 }}>
                {TITOLI_RUOLO[r]}
              </button>
            ))}
          </div>
        </div>

        <details open={Boolean(record?.eta || record?.settimane || record?.esito || record?.note)}>
          <summary style={{ cursor: 'pointer', color: 'var(--accento)' }}>Dati anonimi facoltativi</summary>
          <div className="modulo" style={{ marginTop: 10 }}>
            <div className="campi-affiancati">
              <Campo etichetta="Età della paziente"><input inputMode="numeric" value={eta} placeholder="es. 32" onChange={(e) => setEta(e.target.value)} /></Campo>
              <Campo etichetta="Settimane"><input value={settimane} placeholder="es. 39+2" onChange={(e) => setSettimane(e.target.value)} /></Campo>
            </div>
            {!etaValida && <Avviso>Scrivi l'età in anni (solo il numero).</Avviso>}
            {!settimaneOk && <Avviso>Scrivi le settimane come 39+2 oppure 39.</Avviso>}
            <Campo etichetta="Esito"><input value={esito} placeholder="es. regolare" onChange={(e) => setEsito(e.target.value)} /></Campo>
            <Campo etichetta="Note"><textarea value={note} onChange={(e) => setNote(e.target.value)} /></Campo>
            <NotaPrivacy />
          </div>
        </details>
        {record && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('procedure', record.id).then(() => { onChiudi(); mostraAvviso('Procedura eliminata', () => void ripristina('procedure', record.id)) })}>
            Elimina
          </button>
        )}
      </div>
    </Foglio>
  )
}

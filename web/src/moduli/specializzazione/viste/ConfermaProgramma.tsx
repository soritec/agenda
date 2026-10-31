import { useEffect, useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Allegato } from '../../../dati/modello'
import { Avviso, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { giornoDaChiave, minutiDaOrario, orarioDaMinuti } from '../../turni/supporto'
import { vociDelFile } from '../leggiProgramma'
import type { VoceProgramma } from '../programma'

interface Proposta extends VoceProgramma { scelto: boolean; giaPresente: boolean }

/** Mostra le date trovate nel file: niente viene salvato finché l'utente non tocca "Aggiungi". */
export function ConfermaProgramma({ allegato, tipo, onChiudi }: { allegato?: Allegato; tipo: 'lezione' | 'riunione'; onChiudi: () => void }) {
  const esistenti = useCollezione('esami')
  const [voci, setVoci] = useState<VoceProgramma[]>()
  const [errore, setErrore] = useState<string>()
  const [proposte, setProposte] = useState<Proposta[]>()
  const nome = tipo === 'lezione' ? 'lezioni' : 'riunioni'

  useEffect(() => {
    setVoci(undefined); setErrore(undefined); setProposte(undefined)
    if (!allegato) return
    let attivo = true
    vociDelFile(allegato).then((v) => { if (attivo) setVoci(v) })
      .catch((e: unknown) => { if (attivo) setErrore(`Non riesco a leggere il file. Dettaglio per Claude: ${e instanceof Error ? e.message : String(e)}`) })
    return () => { attivo = false }
  }, [allegato])
  const presenti = useMemo(() => new Set((esistenti ?? []).filter((e) => e.tipo === tipo).map((e) => `${e.giorno}|${e.titolo.toLowerCase()}`)), [esistenti, tipo])
  useEffect(() => {
    if (!voci || !esistenti) return
    setProposte(voci.map((v) => { const giaPresente = presenti.has(`${v.giorno}|${v.titolo.toLowerCase()}`); return { ...v, giaPresente, scelto: !giaPresente } }))
    // Le proposte si calcolano una volta sola per file, non a ogni salvataggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voci, !!esistenti])

  const scelte = (proposte ?? []).filter((p) => p.scelto && p.titolo.trim())
  const cambia = (i: number, m: Partial<Proposta>) => setProposte((ps) => ps?.map((p, j) => (j === i ? { ...p, ...m } : p)))
  async function aggiungi() {
    const creati = await Promise.all(scelte.map((p) => salva('esami', {
      tipo, giorno: p.giorno, titolo: p.titolo.trim(), materia: p.sede, minuto: p.minuto, note: p.responsabile ? `Responsabile: ${p.responsabile}` : undefined,
    })))
    onChiudi()
    mostraAvviso(`Aggiunte ${creati.length} ${nome}`, () => void Promise.all(creati.map((c) => elimina('esami', c.id))))
  }

  return (
    <Foglio aperto={!!allegato} titolo={`Inserisci le ${nome}`} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={scelte.length === 0} onClick={() => void aggiungi()}>Aggiungi{scelte.length ? ` (${scelte.length})` : ''}</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="secondario piccolo">{allegato?.nome}</span>
        {errore && <Avviso>{errore}</Avviso>}
        {!errore && !proposte && <span className="secondario piccolo">Leggo il file…</span>}
        {proposte?.length === 0 && <div className="vuoto">Non ho trovato date in questo file. Puoi inserirle a mano.</div>}
        {proposte && proposte.length > 0 && <span className="secondario piccolo">Trovate {proposte.length} voci. Togli la spunta a quelle che non ti servono e correggi ciò che vuoi: niente viene salvato prima di Aggiungi.</span>}
        {proposte && proposte.length > 0 && (
          <div className="lista">
            {proposte.map((p, i) => {
              const g = giornoDaChiave(p.giorno)!
              return (
                <div key={`${p.giorno}-${i}`} className="riga" style={{ cursor: 'default', opacity: p.scelto ? 1 : 0.55 }}>
                  <input type="checkbox" checked={p.scelto} aria-label={`Aggiungi ${p.titolo}`} onChange={(e) => cambia(i, { scelto: e.target.checked })} />
                  <span className="crescente" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{F.dataBreve(istante(g.anno, g.mese, g.giorno, 12))}{p.giaPresente ? ' · già inserita' : ''}</span>
                    <input value={p.titolo} aria-label="Argomento" onChange={(e) => cambia(i, { titolo: e.target.value })} />
                    <span style={{ display: 'flex', gap: 6 }}>
                      <input className="crescente" value={p.sede ?? ''} placeholder="Sede" aria-label="Sede" onChange={(e) => cambia(i, { sede: e.target.value || undefined })} />
                      <input type="time" style={{ width: 112 }} aria-label="Ora" value={p.minuto !== undefined ? orarioDaMinuti(p.minuto) : ''} onChange={(e) => cambia(i, { minuto: minutiDaOrario(e.target.value) })} />
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <NotaPrivacy />
      </div>
    </Foglio>
  )
}

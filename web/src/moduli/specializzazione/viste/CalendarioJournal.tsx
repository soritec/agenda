import { useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, salva, salvaImpostazioni } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { Avviso, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { calendarioDaFoto } from '../../studio/ai'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import type { VoceCalendarioJournal } from '../journalFoto'

interface Proposta extends VoceCalendarioJournal { scelto: boolean; giaPresente: boolean }

/** Legge la foto del calendario: niente viene salvato finché l'utente non tocca "Aggiungi". */
export function CalendarioJournal({ onChiudi }: { onChiudi: () => void }) {
  const esistenti = useCollezione('journalClub')
  const tolte = useImpostazioni()?.riunioniTolte
  const [proposte, setProposte] = useState<Proposta[]>()
  const [leggo, setLeggo] = useState(false)
  const [errore, setErrore] = useState<string>()
  const scelte = (proposte ?? []).filter((p) => p.scelto && p.titolo.trim())
  const cambia = (i: number, m: Partial<Proposta>) => setProposte((ps) => ps?.map((p, j) => (j === i ? { ...p, ...m } : p)))

  async function leggi(foto: File) {
    setErrore(undefined); setProposte(undefined); setLeggo(true)
    try {
      const k = chiaveGiorno(oggi())
      const presenti = new Set((esistenti ?? []).filter((j) => j.daCalendario).map((j) => j.giorno))
      const voci = await calendarioDaFoto(foto, k)
      if (!voci.length) setErrore('Non ho trovato date in questa foto. Prova con una foto più nitida.')
      setProposte(voci.map((v) => ({ ...v, giaPresente: presenti.has(v.giorno), scelto: v.giorno >= k && !presenti.has(v.giorno) })))
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Non riesco a leggere la foto.') } finally { setLeggo(false) }
  }

  async function aggiungi() {
    const prima = tolte ?? []
    const creati = await Promise.all(scelte.filter((p) => !p.senzaJournal).map((p) => salva('journalClub', { titolo: p.titolo.trim(), giorno: p.giorno, minuto: 7 * 60, daCalendario: true })))
    const saltati = scelte.filter((p) => p.senzaJournal).map((p) => `jc:${p.giorno}`)
    if (saltati.length) await salvaImpostazioni({ riunioniTolte: [...new Set([...prima, ...saltati])] })
    onChiudi()
    mostraAvviso(`Segnate ${scelte.length} date`, () => void Promise.all(creati.map((c) => elimina('journalClub', c.id))).then(() => salvaImpostazioni({ riunioniTolte: prima })))
  }

  return (
    <Foglio aperto titolo="Calendario da foto" onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={scelte.length === 0} onClick={() => void aggiungi()}>Aggiungi{scelte.length ? ` (${scelte.length})` : ''}</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="secondario piccolo">La foto viene letta da Gemini, quindi passa da Google: con la versione gratuita Google può usare ciò che riceve. Mai foto con dati delle pazienti. I nomi dei colleghi non vengono salvati.</span>
        <label className="pulsante primario" style={{ cursor: 'pointer', position: 'relative', alignSelf: 'flex-start' }}>
          {proposte ? 'Scegli un\'altra foto' : 'Scegli la foto'}
          <input type="file" accept="image/*,application/pdf" className="file-nascosto"
            onChange={(e) => { const campo = e.currentTarget, f = campo.files?.[0]; if (f) void leggi(f).finally(() => { campo.value = '' }) }} />
        </label>
        {leggo && <span className="secondario piccolo">Leggo la foto…</span>}
        {errore && <Avviso>{errore}</Avviso>}
        {proposte && proposte.length > 0 && <span className="secondario piccolo">Controlla le date: togli la spunta a quelle che non ti servono e correggi ciò che vuoi.</span>}
        {proposte && proposte.length > 0 && (
          <div className="lista">
            {proposte.map((p, i) => {
              const g = giornoDaChiave(p.giorno)!
              return (
                <div key={p.giorno} className="riga" style={{ cursor: 'default', opacity: p.scelto ? 1 : 0.55 }}>
                  <input type="checkbox" checked={p.scelto} aria-label={`Aggiungi ${p.titolo}`} onChange={(e) => cambia(i, { scelto: e.target.checked })} />
                  <span className="crescente" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{F.dataBreve(istante(g.anno, g.mese, g.giorno, 12))}{p.giaPresente ? ' · già inserita' : ''}</span>
                    <input value={p.titolo} aria-label="Argomento" onChange={(e) => cambia(i, { titolo: e.target.value })} />
                    <label className="piccolo" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={p.senzaJournal} onChange={(e) => cambia(i, { senzaJournal: e.target.checked })} /> Quel giorno niente journal club
                    </label>
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Foglio>
  )
}

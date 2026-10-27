import { useEffect, useMemo, useState } from 'react'
import { giornoDaChiave, perId, turniPerGiorno } from '../supporto'
import * as F from '../../../nucleo/formati'
import { istante } from '../../../nucleo/calendario'
import { contenutoAllegato } from '../../../dati/allegati'
import { salva, salvaImpostazioni } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Allegato, ModelloTurno, Turno } from '../../../dati/modello'
import { Avviso, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { CATALOGO_SCUOLA } from '../catalogoScuola'
import { leggiTurni, modelloPerSigla, type PezzoTesto, type TurnoLetto } from '../importaPdf'
import { pezziDelPdf } from '../leggiPdf'
import { intervallo, intervalloTuttoIlGiorno } from '../orari'
import { aggiungiSmonti, eliminaTurno } from '../smonto'

/** Valore della scelta per una sigla della scuola che non è ancora un turno tipo. */
const CATALOGO = 'catalogo:'

interface Proposta extends TurnoLetto { modelloId?: string; scelto: boolean; giaPresente: boolean; allegatoId: string }

/**
 * Legge i propri turni da un file PDF dei turni e li mostra per la conferma: niente viene salvato
 * finché l'utente non tocca "Aggiungi". I turni già presenti nello stesso giorno restano deselezionati.
 */
export function ImportaTurni({ allegati, onChiudi }: { allegati: Allegato[]; onChiudi: () => void }) {
  const impostazioni = useImpostazioni()
  const modelli = useCollezione('modelliTurno')
  const turni = useCollezione('turni')
  const [pezzi, setPezzi] = useState<{ allegato: Allegato; pezzi: PezzoTesto[] }[]>()
  const [errore, setErrore] = useState<string>()
  const [nome, setNome] = useState('')
  const [proposte, setProposte] = useState<Proposta[]>()
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    setPezzi(undefined); setErrore(undefined); setProposte(undefined)
    if (allegati.length === 0) return
    let attivo = true
    void (async () => {
      const letti: { allegato: Allegato; pezzi: PezzoTesto[] }[] = []
      const problemi: string[] = []
      const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e))
      for (const a of allegati) {
        let contenuto: Blob
        try { contenuto = await contenutoAllegato(a) } catch (e) { problemi.push(`${a.nome}: ${motivo(e)}`); continue }
        try { letti.push({ allegato: a, pezzi: await pezziDelPdf(contenuto) }) } catch (e) {
          console.error(e)
          problemi.push(`${a.nome}: non riesco a leggerne il testo (funziona con i PDF fatti al computer, non con foto o scansioni). Dettaglio per Claude: ${motivo(e)}`)
        }
      }
      if (!attivo) return
      if (problemi.length) setErrore(problemi.join('\n'))
      setPezzi(letti)
    })()
    return () => { attivo = false }
  }, [allegati])
  useEffect(() => { if (impostazioni?.nomeNeiTurni && !nome) setNome(impostazioni.nomeNeiTurni) }, [impostazioni, nome])

  const nomeSalvato = impostazioni?.nomeNeiTurni?.trim()
  const letti = useMemo(() => {
    if (!pezzi || !nomeSalvato) return undefined
    const perFile = pezzi.map((p) => ({ allegato: p.allegato, ...leggiTurni(p.pezzi, nomeSalvato.split(/\s*;\s*/)) }))
    const visti = new Set<string>()
    return {
      mesi: [...new Set(perFile.flatMap((f) => (f.mese ? [f.mese] : [])))].sort(),
      senzaMese: perFile.filter((f) => !f.mese).map((f) => f.allegato.nome),
      // Stesso giorno e stessa sigla in due file (es. guardie e turni) = un turno solo.
      turni: perFile.flatMap((f) => f.turni.map((t) => ({ ...t, allegatoId: f.allegato.id })))
        .filter((t) => { const k = `${t.giorno}|${t.sigla.toLowerCase()}`; if (visti.has(k)) return false; visti.add(k); return true })
        .sort((a, b) => a.giorno.localeCompare(b.giorno)),
    }
  }, [pezzi, nomeSalvato])

  useEffect(() => {
    if (!letti || !modelli || !turni) return
    const perGiorno = turniPerGiorno(turni)
    setProposte(letti.turni.map((t) => {
      const modello = modelloPerSigla(t.sigla, modelli)
      // Sigla della scuola non ancora tra i turni tipo: si crea insieme ai turni.
      const dalCatalogo = modello ? undefined : modelloPerSigla(t.sigla, CATALOGO_SCUOLA)
      const modelloId = modello?.id ?? (dalCatalogo ? `${CATALOGO}${dalCatalogo.sigla}` : undefined)
      const giaPresente = (perGiorno.get(t.giorno) ?? []).some((x) => (modello ? x.modelloId === modello.id : !dalCatalogo))
      return { ...t, modelloId, scelto: !!modelloId && !giaPresente, giaPresente }
    }))
    // Le proposte si ricalcolano solo quando cambia il file letto, non a ogni salvataggio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letti, !!modelli, !!turni])

  const mappa = useMemo(() => perId(modelli), [modelli])
  const ordinati = useMemo(() => [...(modelli ?? [])].sort((a, b) => a.sigla.localeCompare(b.sigla)), [modelli])
  const daAggiungere = (proposte ?? []).filter((p) => p.scelto && p.modelloId)
  const cambia = (i: number, m: Partial<Proposta>) => setProposte((ps) => ps?.map((p, j) => (j === i ? { ...p, ...m } : p)))

  async function aggiungi() {
    setSalvando(true)
    const creati: Turno[] = []
    const nuoviModelli = new Map<string, ModelloTurno>()
    const modelloDi = async (id: string) => {
      if (!id.startsWith(CATALOGO)) return mappa.get(id)
      const v = CATALOGO_SCUOLA.find((x) => x.sigla === id.slice(CATALOGO.length))
      if (!v) return undefined
      if (!nuoviModelli.has(id)) nuoviModelli.set(id, await salva('modelliTurno', {
        nome: v.nome, sigla: v.sigla, tipo: v.tipo, ordine: (modelli?.length ?? 0) + nuoviModelli.size, minutoInizio: v.orari[0], minutoFine: v.orari[1], info: v.info,
      }))
      return nuoviModelli.get(id)
    }
    for (const p of daAggiungere) {
      const m = await modelloDi(p.modelloId!)
      if (!m) continue
      const g = giornoDaChiave(p.giorno)!
      const orari = m.tuttoIlGiorno ? intervalloTuttoIlGiorno(g) : intervallo(g, m.minutoInizio, m.minutoFine)
      creati.push(await salva('turni', { ...orari, tipo: m.tipo, tuttoIlGiorno: m.tuttoIlGiorno, stato: 'pianificato', sedeId: m.sedeId, modelloId: m.id, origine: 'importato', importazioneId: p.allegatoId }))
    }
    await aggiungiSmonti(creati)
    setSalvando(false)
    onChiudi()
    mostraAvviso(`Aggiunti ${creati.length} turni`, () => void Promise.all(creati.map((t) => eliminaTurno(t.id))))
  }

  const nomeMesi = (letti?.mesi ?? []).map((m) => { const g = giornoDaChiave(`${m}-01`)!; return F.mese(istante(g.anno, g.mese, 1, 12)) }).join(', ')
  return (
    <Foglio aperto={allegati.length > 0} titolo="Inserisci i miei turni" onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={salvando || daAggiungere.length === 0}
        onClick={() => void aggiungi()}>Aggiungi{daAggiungere.length ? ` (${daAggiungere.length})` : ''}</button>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="secondario piccolo">{allegati.map((a) => a.nome).join(' · ')}</span>
        <form className="campo" onSubmit={(e) => { e.preventDefault(); void salvaImpostazioni({ nomeNeiTurni: nome.trim() || undefined }) }}>
          <label htmlFor="nome-turni">Il tuo nome come compare nei file</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input id="nome-turni" className="crescente" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. il cognome" autoComplete="off" />
            <button type="submit" className="pulsante" disabled={nome.trim() === (nomeSalvato ?? '')}>Cerca</button>
          </div>
          <span className="secondario piccolo">Scrivilo esattamente come nel file. Se compare in modi diversi, separali con ; (punto e virgola).</span>
        </form>
        {errore && <Avviso><span style={{ whiteSpace: 'pre-line' }}>{errore}</span></Avviso>}
        {!errore && !pezzi && <span className="secondario piccolo">Leggo il file…</span>}
        {letti && letti.senzaMese.length > 0 && <Avviso>Non trovo il mese (es. "Novembre 2026") dentro: {letti.senzaMese.join(', ')}.</Avviso>}
        {proposte && letti && letti.mesi.length > 0 && (
          proposte.length === 0
            ? <div className="vuoto">Nessun turno trovato a nome "{nomeSalvato}" ({nomeMesi}).</div>
            : <>
              <span className="secondario piccolo">Trovati {proposte.length} turni ({nomeMesi}). Controlla e tocca Aggiungi: niente viene salvato prima.</span>
              <div className="lista">
                {proposte.map((p, i) => {
                  const g = giornoDaChiave(p.giorno)!
                  return (
                    <label key={`${p.giorno}-${p.sigla}`} className="riga" style={{ opacity: p.scelto ? 1 : 0.55 }}>
                      <input type="checkbox" checked={p.scelto} disabled={!p.modelloId} onChange={(e) => cambia(i, { scelto: e.target.checked })} />
                      <span className="crescente">
                        <span style={{ fontWeight: 600 }}>{F.dataBreve(istante(g.anno, g.mese, g.giorno, 12))}</span>
                        <span className="secondario piccolo">{p.sigla} · colonna "{p.colonna}"{p.giaPresente ? ' · già nel calendario' : ''}</span>
                      </span>
                      <select value={p.modelloId ?? ''} onChange={(e) => cambia(i, { modelloId: e.target.value || undefined, scelto: !!e.target.value })} style={{ maxWidth: 190 }}>
                        <option value="">Scegli il turno…</option>
                        {ordinati.map((m) => <option key={m.id} value={m.id}>{m.sigla} · {m.nome}</option>)}
                        {p.modelloId?.startsWith(CATALOGO) && (() => { const v = modelloPerSigla(p.modelloId.slice(CATALOGO.length), CATALOGO_SCUOLA)!; return <option value={p.modelloId}>{v.sigla} · {v.nome} (nuovo)</option> })()}
                      </select>
                    </label>
                  )
                })}
              </div>
            </>
        )}
      </div>
    </Foglio>
  )
}

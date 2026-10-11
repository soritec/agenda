import { useEffect, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { TipoProcedura } from '../../../dati/modello'
import { Allegati } from '../../../interfaccia/Allegati'
import { Campo, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { giornoDaChiave } from '../../turni/supporto'
import { conteggi, RUOLI, ruoloDa, TITOLI_RUOLO } from '../logica'

/** Siti suggeriti per studiare le procedure: si aggiungono con un tocco e si possono togliere. */
const SITI_SUGGERITI = [
  { titolo: 'WebSurg (IRCAD)', url: 'https://www.websurg.com' },
  { titolo: 'GLOWM', url: 'https://www.glowm.com' },
  { titolo: 'ISUOG', url: 'https://www.isuog.org' },
  { titolo: 'RCOG Green-top Guidelines', url: 'https://www.rcog.org.uk/guidance/browse-all-guidance/green-top-guidelines/' },
]

const dataBreve = (giorno: string) => {
  const g = giornoDaChiave(giorno)
  return g ? F.dataBreve(istante(g.anno, g.mese, g.giorno, 12)) : giorno
}

export function SchedaProcedura({ id }: { id: string }) {
  const tipi = useCollezione('tipiProcedura')
  const procedure = useCollezione('procedure')
  const tipo = tipi?.find((t) => t.id === id)
  if (tipi && !tipo) {
    return (
      <div className="schermata">
        <a href="#/specializzazione/logbook" className="piccolo">‹ Logbook</a>
        <h1 className="titolo-grande">Procedura non trovata</h1>
      </div>
    )
  }
  if (!tipo) return null
  return <Contenuto key={tipo.id} tipo={tipo} registrate={(procedure ?? []).filter((p) => p.tipoId === id)} />
}

function Contenuto({ tipo, registrate }: { tipo: TipoProcedura; registrate: { id: string; tipoId: string; giorno: string; ruolo: string; annoCorso: number }[] }) {
  const [appunti, setAppunti] = useState(tipo.appunti ?? '')
  const [nuovoTitolo, setNuovoTitolo] = useState('')
  const [nuovoUrl, setNuovoUrl] = useState('')
  const c = conteggi(registrate)
  const link = tipo.link ?? []

  // Gli appunti si salvano da soli poco dopo aver smesso di scrivere.
  useEffect(() => {
    if (appunti === (tipo.appunti ?? '')) return
    const t = setTimeout(() => void salva('tipiProcedura', { ...tipo, appunti: appunti || undefined }), 800)
    return () => clearTimeout(t)
  }, [appunti, tipo])

  const salvaLink = (nuovi: { titolo: string; url: string }[]) => salva('tipiProcedura', { ...tipo, link: nuovi.length ? nuovi : undefined })
  const indirizzo = nuovoUrl.trim() && !/^https?:\/\//.test(nuovoUrl.trim()) ? `https://${nuovoUrl.trim()}` : nuovoUrl.trim()
  const linkValido = /^https?:\/\/[^\s.]+\.[^\s]+$/.test(indirizzo)

  async function aggiungiLink() {
    if (!linkValido) return
    await salvaLink([...link, { titolo: nuovoTitolo.trim() || indirizzo.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]!, url: indirizzo }])
    setNuovoTitolo('')
    setNuovoUrl('')
  }

  const ricercaVideo = `https://www.youtube.com/results?search_query=${encodeURIComponent(tipo.nome)}`

  return (
    <div className="schermata" style={{ maxWidth: 820 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione/logbook" className="piccolo">‹ Logbook</a>
          <h1 className="titolo-grande">{tipo.nome}</h1>
        </div>
        <label className="pillola" style={{ cursor: 'pointer', gap: 8 }}>
          <input type="checkbox" checked={Boolean(tipo.chirurgica)} onChange={(e) => void salva('tipiProcedura', { ...tipo, chirurgica: e.target.checked || undefined })} />
          Chirurgica
        </label>
      </header>

      <div className="tessere">
        <div className="tessera"><span className="valore">{c.totale}</span><span className="secondario piccolo">registrate</span></div>
        {RUOLI.map((r) => <div key={r} className="tessera"><span className="valore">{c.perRuolo[r]}</span><span className="secondario piccolo">{TITOLI_RUOLO[r].toLowerCase()}</span></div>)}
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Dove studiarla</h2>
        <div className="lista">
          {link.length === 0 && <div className="vuoto piccolo">Aggiungi i link ai video o alle guide (per esempio la pagina WebSurg di questa procedura).</div>}
          {link.map((l, i) => (
            <div key={`${l.url}-${i}`} className="riga" style={{ cursor: 'default' }}>
              <a href={l.url} target="_blank" rel="noreferrer" className="crescente" style={{ color: 'var(--testo)' }}>
                <span style={{ fontWeight: 600 }}>{l.titolo}</span>
                <span className="secondario piccolo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url.replace(/^https?:\/\//, '')}</span>
              </a>
              <button type="button" className="elimina-riga" aria-label={`Togli ${l.titolo}`}
                onClick={() => void salvaLink(link.filter((_, j) => j !== i)).then(() => mostraAvviso(`Tolto: ${l.titolo}`, () => void salvaLink(link)))}>×</button>
            </div>
          ))}
        </div>
        <div className="scheda modulo">
          <div className="campi-affiancati">
            <Campo etichetta="Nome del link (facoltativo)"><input value={nuovoTitolo} placeholder="es. Video WebSurg" onChange={(e) => setNuovoTitolo(e.target.value)} /></Campo>
            <Campo etichetta="Indirizzo"><input value={nuovoUrl} placeholder="Incolla qui il link" inputMode="url" autoCapitalize="off" spellCheck={false}
              onChange={(e) => setNuovoUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void aggiungiLink() }} /></Campo>
          </div>
          <div className="riga-azioni">
            <button type="button" className="pulsante primario" disabled={!linkValido} onClick={() => void aggiungiLink()}>Aggiungi link</button>
            <a className="pulsante" href={ricercaVideo} target="_blank" rel="noreferrer">Cerca video</a>
          </div>
          <div className="riga-azioni">
            <span className="secondario piccolo">Siti utili:</span>
            {SITI_SUGGERITI.filter((s) => !link.some((l) => l.url === s.url)).map((s) => (
              <button key={s.url} type="button" className="pillola" onClick={() => void salvaLink([...link, s])}>+ {s.titolo}</button>
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">I miei appunti</h2>
        <textarea className="appunti" value={appunti} onChange={(e) => setAppunti(e.target.value)}
          placeholder={'Passaggi, trucchi, cosa ricordare…\n\nSi salvano da soli mentre scrivi.'} />
        <NotaPrivacy />
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Allegati</h2>
        <Allegati collegatoA={`tipoProcedura:${tipo.id}`} avvisoPrivacy="Documenti utili per studiare (PDF, immagini, linee guida). Niente dati delle pazienti." />
      </section>

      {registrate.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione">Registrate</h2>
          <div className="lista">
            {[...registrate].sort((a, b) => b.giorno.localeCompare(a.giorno)).slice(0, 20).map((p) => (
              <div key={p.id} className="riga" style={{ cursor: 'default' }}>
                <span className="secondario piccolo numeri" style={{ width: 64 }}>{dataBreve(p.giorno)}</span>
                <span className="crescente">{TITOLI_RUOLO[ruoloDa(p.ruolo)]} · {p.annoCorso}° anno</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

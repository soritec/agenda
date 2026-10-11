import { useRef, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, nuovoId, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Corso, JournalClub } from '../../../dati/modello'
import { Allegati } from '../../../interfaccia/Allegati'
import { EtichetteAllegati } from '../../../interfaccia/Visualizzatore'
import { Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import { creditiAnno } from '../../studio/logica'

const dataEstesa = (g: string) => { const c = giornoDaChiave(g); return c ? F.dataEstesa(istante(c.anno, c.mese, c.giorno, 12)) : g }
const numero = (t: string) => { const n = Number(t.replace(',', '.')); return t.trim() && Number.isFinite(n) && n >= 0 ? n : undefined }
const testoNumero = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','))

/* Corsi e crediti ECM */

export function CorsiEcm() {
  const corsi = useCollezione('corsi')
  const [modifica, setModifica] = useState<{ c?: Corso }>()
  const anno = chiaveGiorno(oggi()).slice(0, 4)
  const anni = [...new Set((corsi ?? []).map((c) => c.giorno.slice(0, 4)))].sort().reverse()
  return (
    <div className="schermata" style={{ maxWidth: 760 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">Corsi ed ECM</h1>
        </div>
        <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ Corso</button>
      </header>
      <div className="tessere">
        <div className="tessera"><span className="valore">{testoNumero(creditiAnno(corsi ?? [], anno))}</span><span className="secondario piccolo">crediti nel {anno}</span></div>
        <div className="tessera"><span className="valore">{(corsi ?? []).filter((c) => c.giorno.startsWith(anno)).length}</span><span className="secondario piccolo">corsi nel {anno}</span></div>
        <div className="tessera"><span className="valore">{testoNumero(creditiAnno(corsi ?? [], ''))}</span><span className="secondario piccolo">crediti in totale</span></div>
      </div>
      {(corsi ?? []).length === 0 && <div className="vuoto secondario">Nessun corso. Aggiungi congressi e corsi con i loro crediti e gli attestati in PDF.</div>}
      {anni.map((a) => (
        <section key={a} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione">{a} <span className="secondario piccolo" style={{ fontWeight: 400 }}>· {testoNumero(creditiAnno(corsi ?? [], a))} crediti</span></h2>
          <div className="lista">
            {(corsi ?? []).filter((c) => c.giorno.startsWith(a)).sort((x, y) => y.giorno.localeCompare(x.giorno)).map((c) => (
              <div key={c.id} className="riga" style={{ cursor: 'default' }}>
                <button type="button" className="crescente" onClick={() => setModifica({ c })} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                  <span style={{ fontWeight: 600 }}>{c.titolo}</span>
                  <span className="secondario piccolo">{[dataEstesa(c.giorno), c.ente, c.ore !== undefined ? `${testoNumero(c.ore)} ore` : ''].filter(Boolean).join(' · ')}</span>
                  <EtichetteAllegati collegatoA={`corso:${c.id}`} />
                </button>
                {c.crediti !== undefined && <span className="numeri" style={{ fontWeight: 700 }}>{testoNumero(c.crediti)} ECM</span>}
                <button type="button" className="elimina-task" aria-label={`Elimina ${c.titolo}`}
                  onClick={() => void elimina('corsi', c.id).then(() => mostraAvviso(`Eliminato: ${c.titolo}`, () => void ripristina('corsi', c.id)))}>×</button>
              </div>
            ))}
          </div>
        </section>
      ))}
      {modifica && <FormCorso c={modifica.c} onChiudi={() => setModifica(undefined)} />}
    </div>
  )
}

function FormCorso({ c, onChiudi }: { c?: Corso; onChiudi: () => void }) {
  const id = useRef(c?.id ?? nuovoId()).current
  const [b, setB] = useState({ titolo: c?.titolo ?? '', giorno: c?.giorno ?? chiaveGiorno(oggi()), ente: c?.ente ?? '', crediti: testoNumero(c?.crediti), ore: testoNumero(c?.ore), note: c?.note ?? '' })
  const valido = b.titolo.trim() !== '' && !!giornoDaChiave(b.giorno)
  async function conferma() {
    if (!valido) return
    await salva('corsi', { ...c, id, titolo: b.titolo.trim(), giorno: b.giorno, ente: b.ente.trim() || undefined, crediti: numero(b.crediti), ore: numero(b.ore), note: b.note.trim() || undefined })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={c ? 'Corso' : 'Nuovo corso'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Titolo"><input value={b.titolo} autoFocus={!c} placeholder="es. Corso di ecografia ostetrica" onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Giorno"><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
          <Campo etichetta="Crediti ECM"><input inputMode="decimal" value={b.crediti} onChange={(e) => setB({ ...b, crediti: e.target.value })} /></Campo>
          <Campo etichetta="Ore"><input inputMode="decimal" value={b.ore} onChange={(e) => setB({ ...b, ore: e.target.value })} /></Campo>
        </div>
        <Campo etichetta="Organizzatore (facoltativo)"><input value={b.ente} onChange={(e) => setB({ ...b, ente: e.target.value })} /></Campo>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <div className="campo"><span>Attestato</span><Allegati collegatoA={`corso:${id}`} /></div>
        <NotaPrivacy />
      </div>
    </Foglio>
  )
}

/* Journal club */

export function JournalClubPagina() {
  const elenco = useCollezione('journalClub')
  const [modifica, setModifica] = useState<{ j?: JournalClub }>()
  const oggiChiave = chiaveGiorno(oggi())
  const prossimi = (elenco ?? []).filter((j) => !j.presentato && j.giorno >= oggiChiave).sort((a, b) => a.giorno.localeCompare(b.giorno))
  const passati = (elenco ?? []).filter((j) => j.presentato || j.giorno < oggiChiave).sort((a, b) => b.giorno.localeCompare(a.giorno))
  const riga = (j: JournalClub, concluso: boolean) => (
    <div key={j.id} className={`riga${concluso ? ' conclusa' : ''}`} style={{ cursor: 'default' }}>
      <input type="checkbox" checked={Boolean(j.presentato)} aria-label="Presentato" style={{ width: 20, height: 20, accentColor: 'var(--primario)', flexShrink: 0 }}
        onChange={(e) => void salva('journalClub', { ...j, presentato: e.target.checked || undefined })} />
      <button type="button" className="crescente" onClick={() => setModifica({ j })} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
        <span style={{ fontWeight: 600 }}>{j.titolo}</span>
        <span className="secondario piccolo">{[dataEstesa(j.giorno), j.rivista].filter(Boolean).join(' · ')}</span>
        <EtichetteAllegati collegatoA={`journal:${j.id}`} />
      </button>
      {j.link && <a className="pillola piccola" href={j.link} target="_blank" rel="noreferrer">Articolo</a>}
      <button type="button" className="elimina-task" aria-label={`Elimina ${j.titolo}`}
        onClick={() => void elimina('journalClub', j.id).then(() => mostraAvviso('Eliminato', () => void ripristina('journalClub', j.id)))}>×</button>
    </div>
  )
  return (
    <div className="schermata" style={{ maxWidth: 760 }}>
      <header className="intestazione">
        <div>
          <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
          <h1 className="titolo-grande">Journal club</h1>
        </div>
        <button type="button" className="pulsante primario" onClick={() => setModifica({})}>+ Articolo</button>
      </header>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Da presentare</h2>
        <div className="lista">
          {prossimi.length === 0 && <div className="vuoto piccolo">Nessun articolo in programma. Compaiono anche in Agenda.</div>}
          {prossimi.map((j) => riga(j, false))}
        </div>
      </section>
      {passati.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione">Presentati</h2>
          <div className="lista">{passati.map((j) => riga(j, true))}</div>
        </section>
      )}
      {modifica && <FormJournal j={modifica.j} onChiudi={() => setModifica(undefined)} />}
    </div>
  )
}

function FormJournal({ j, onChiudi }: { j?: JournalClub; onChiudi: () => void }) {
  const id = useRef(j?.id ?? nuovoId()).current
  const [b, setB] = useState({ titolo: j?.titolo ?? '', giorno: j?.giorno ?? chiaveGiorno(oggi()), rivista: j?.rivista ?? '', link: j?.link ?? '', note: j?.note ?? '', presentato: Boolean(j?.presentato) })
  const link = b.link.trim() && !/^https?:\/\//.test(b.link.trim()) ? `https://${b.link.trim()}` : b.link.trim()
  const valido = b.titolo.trim() !== '' && !!giornoDaChiave(b.giorno)
  async function conferma() {
    if (!valido) return
    await salva('journalClub', { ...j, id, titolo: b.titolo.trim(), giorno: b.giorno, rivista: b.rivista.trim() || undefined, link: link || undefined, note: b.note.trim() || undefined, presentato: b.presentato || undefined })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={j ? 'Journal club' : 'Nuovo articolo'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Titolo dell'articolo"><input value={b.titolo} autoFocus={!j} onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Giorno della presentazione"><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
          <Campo etichetta="Rivista (facoltativa)"><input value={b.rivista} placeholder="es. AJOG" onChange={(e) => setB({ ...b, rivista: e.target.value })} /></Campo>
        </div>
        <Campo etichetta="Link (facoltativo)"><input value={b.link} inputMode="url" autoCapitalize="off" placeholder="es. link PubMed o DOI" onChange={(e) => setB({ ...b, link: e.target.value })} /></Campo>
        <label className="interruttore"><span>Già presentato</span><input type="checkbox" checked={b.presentato} onChange={(e) => setB({ ...b, presentato: e.target.checked })} /></label>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <div className="campo"><span>PDF e slide</span><Allegati collegatoA={`journal:${id}`} /></div>
        <NotaPrivacy />
      </div>
    </Foglio>
  )
}

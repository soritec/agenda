import { useEffect, useRef, useState } from 'react'
import { istante } from '../../nucleo/calendario'
import * as F from '../../nucleo/formati'
import { eliminaCondiviso, ripristinaCondiviso, salvaCondiviso, useCondivisi, type Messaggio, type Promemoria } from '../../dati/condiviso'
import { sincronizzazioneRapida } from '../../dati/sincronizzazione'
import { Campo, Foglio, mostraAvviso } from '../../interfaccia/componenti'
import { IconaSveglia } from '../../interfaccia/icone'
import { Avatar, useProfili } from '../../interfaccia/profili'
import { chiaveGiorno, giornoDaChiave, oggi } from '../turni/supporto'

const ms = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const quando = (t: number) => {
  const oggiChiave = chiaveGiorno(oggi())
  const g = new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  return g === oggiChiave ? F.ora(t) : `${F.dataBreve(t)} ${F.ora(t)}`
}
const giornoPromemoria = (g: string) => {
  const o = chiaveGiorno(oggi())
  return g === o ? 'oggi' : F.dataEstesa(ms(g))
}

export function Chat() {
  const { profili, attivo, altri, pronto } = useProfili()
  const messaggi = useCondivisi('messaggi')
  const promemoria = useCondivisi('promemoria')
  const [con, setCon] = useState<string>()
  const [testo, setTesto] = useState('')
  const [nuovoPromemoria, setNuovoPromemoria] = useState(false)
  const fondo = useRef<HTMLDivElement>(null)
  const altro = altri.find((p) => p.id === con) ?? altri[0]
  const nomeDi = (id: string) => profili.find((p) => p.id === id)?.nome ?? '—'

  useEffect(() => { sincronizzazioneRapida(true); return () => sincronizzazioneRapida(false) }, [])
  const traNoi = (x: { da: string; a: string }) => altro && ((x.da === attivo.id && x.a === altro.id) || (x.da === altro.id && x.a === attivo.id))
  const voci = [
    ...(messaggi ?? []).filter(traNoi).map((m) => ({ tipo: 'messaggio' as const, t: m.creatoIl, m })),
    ...(promemoria ?? []).filter(traNoi).map((p) => ({ tipo: 'promemoria' as const, t: p.creatoIl, p })),
  ].sort((a, b) => a.t - b.t)

  // Ciò che arriva a me, una volta visto, si segna come letto.
  useEffect(() => {
    for (const m of messaggi ?? []) if (m.a === attivo.id && altro && m.da === altro.id && !m.letto) void salvaCondiviso('messaggi', { ...m, letto: true })
    for (const p of promemoria ?? []) if (p.a === attivo.id && altro && p.da === altro.id && !p.vistoIl) void salvaCondiviso('promemoria', { ...p, vistoIl: Date.now() })
  }, [messaggi, promemoria, attivo.id, altro])
  useEffect(() => { fondo.current?.scrollIntoView({ block: 'end' }) }, [voci.length])

  async function invia() {
    const t = testo.trim()
    if (!t || !altro) return
    setTesto('')
    await salvaCondiviso('messaggi', { da: attivo.id, a: altro.id, testo: t })
  }

  if (!pronto) return null
  if (!altro) {
    return (
      <div className="schermata" style={{ maxWidth: 720 }}>
        <h1 className="titolo-grande">Chat</h1>
        <div className="scheda secondario">Per chattare serve almeno un altro profilo: aggiungilo in <a href="#/impostazioni">Impostazioni</a>.</div>
      </div>
    )
  }

  return (
    <div className="schermata pagina-chat" style={{ maxWidth: 760 }}>
      <header className="intestazione" style={{ alignItems: 'center' }}>
        <h1 className="titolo-grande titolo-con-icona"><Avatar p={altro} dimensione={34} />{altro.nome}</h1>
        {altri.length > 1 && (
          <div className="riga-azioni">{altri.map((p) => <button key={p.id} type="button" className={`pillola${p.id === altro.id ? ' filtro-attivo' : ''}`} onClick={() => setCon(p.id)}>{p.nome}</button>)}</div>
        )}
      </header>

      <div className="conversazione">
        {voci.length === 0 && <div className="vuoto secondario">Scrivi il primo messaggio, o manda un promemoria.</div>}
        {voci.map((v) => v.tipo === 'messaggio'
          ? <Fumetto key={v.m.id} m={v.m} mio={v.m.da === attivo.id} />
          : <CartaPromemoria key={v.p.id} p={v.p} mio={v.p.da === attivo.id} nomeDa={nomeDi(v.p.da)} nomeA={nomeDi(v.p.a)} />)}
        <div ref={fondo} />
      </div>

      <div className="scrivi-chat">
        <button type="button" className="pulsante con-icona" onClick={() => setNuovoPromemoria(true)} aria-label="Manda un promemoria"><IconaSveglia dimensione={18} /><span className="solo-largo">Promemoria</span></button>
        <textarea rows={1} value={testo} placeholder="Scrivi un messaggio…" aria-label="Messaggio" onChange={(e) => setTesto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void invia() } }} />
        <button type="button" className="pulsante primario" disabled={!testo.trim()} onClick={() => void invia()}>Invia</button>
      </div>
      <span className="secondario piccolo">I messaggi arrivano entro circa mezzo minuto quando l'app è aperta. Non arrivano notifiche sul telefono ad app chiusa.</span>

      {nuovoPromemoria && <FormPromemoria a={altro.id} nomeA={altro.nome} da={attivo.id} onChiudi={() => setNuovoPromemoria(false)} />}
    </div>
  )
}

function Fumetto({ m, mio }: { m: Messaggio; mio: boolean }) {
  return (
    <div className={`fumetto${mio ? ' mio' : ''}`}>
      <span className="testo-fumetto">{m.testo}</span>
      <span className="ora-fumetto">{quando(m.creatoIl)}{mio && m.letto ? ' · letto' : ''}</span>
      {mio && (
        <button type="button" className="x-fumetto" aria-label="Elimina il messaggio"
          onClick={() => void eliminaCondiviso('messaggi', m.id).then(() => mostraAvviso('Messaggio eliminato', () => void ripristinaCondiviso('messaggi', m.id)))}>×</button>
      )}
    </div>
  )
}

function CartaPromemoria({ p, mio, nomeDa, nomeA }: { p: Promemoria; mio: boolean; nomeDa: string; nomeA: string }) {
  return (
    <div className={`carta-promemoria${mio ? ' mio' : ''}${p.fatto ? ' fatto' : ''}`}>
      <span className="testa-promemoria"><IconaSveglia dimensione={15} /> Promemoria per {mio ? nomeA : 'te'} · {giornoPromemoria(p.giorno)}</span>
      <span className="testo-promemoria">{p.testo}</span>
      <span className="piede-promemoria">
        {mio
          ? <span>{p.fatto ? `Fatto ✓${p.fattoIl ? ` · ${quando(p.fattoIl)}` : ''}` : 'Non ancora fatto'}</span>
          : (
            <label className="spunta-promemoria">
              <input type="checkbox" checked={Boolean(p.fatto)} onChange={(e) => void salvaCondiviso('promemoria', { ...p, fatto: e.target.checked || undefined, fattoIl: e.target.checked ? Date.now() : undefined })} />
              {p.fatto ? 'Fatto' : 'Segna come fatto'}
            </label>
          )}
        <span className="secondario">da {mio ? 'te' : nomeDa}</span>
        {mio && (
          <button type="button" className="x-fumetto statico" aria-label="Elimina il promemoria"
            onClick={() => void eliminaCondiviso('promemoria', p.id).then(() => mostraAvviso('Promemoria eliminato', () => void ripristinaCondiviso('promemoria', p.id)))}>×</button>
        )}
      </span>
    </div>
  )
}

function FormPromemoria({ a, nomeA, da, onChiudi }: { a: string; nomeA: string; da: string; onChiudi: () => void }) {
  const [testo, setTesto] = useState('')
  const [giorno, setGiorno] = useState(chiaveGiorno(oggi()))
  const valido = testo.trim() !== '' && !!giornoDaChiave(giorno)
  async function conferma() {
    if (!valido) return
    await salvaCondiviso('promemoria', { da, a, testo: testo.trim(), giorno })
    onChiudi()
    mostraAvviso(`Promemoria inviato a ${nomeA}`)
  }
  return (
    <Foglio aperto titolo={`Promemoria per ${nomeA}`} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Invia</button>}>
      <div className="modulo">
        <Campo etichetta="Cosa deve ricordarsi"><textarea rows={2} autoFocus value={testo} placeholder="es. Inviare la domanda VS allo studio, entro stasera" onChange={(e) => setTesto(e.target.value)} /></Campo>
        <Campo etichetta="Per quando"><input type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} /></Campo>
        <span className="secondario piccolo">Comparirà in Oggi e in Agenda di {nomeA}, che potrà segnarlo come fatto: lo vedrai qui.</span>
      </div>
    </Foglio>
  )
}

/** Promemoria ricevuti per oggi (e quelli rimasti indietro), da spuntare nella pagina Oggi. */
export function PromemoriaDiOggi() {
  const { profili, attivo } = useProfili()
  const promemoria = useCondivisi('promemoria')
  const oggiChiave = chiaveGiorno(oggi())
  const inizio = istante(Number(oggiChiave.slice(0, 4)), Number(oggiChiave.slice(5, 7)), Number(oggiChiave.slice(8, 10)))
  const miei = (promemoria ?? []).filter((p) => p.a === attivo.id && p.giorno <= oggiChiave && (!p.fatto || (p.fattoIl ?? 0) >= inizio))
    .sort((a, b) => Number(Boolean(a.fatto)) - Number(Boolean(b.fatto)) || a.giorno.localeCompare(b.giorno))
  if (!miei.length) return null
  return (
    <section className="scheda promemoria-oggi">
      <h2 className="titolo-sezione titolo-con-icona"><IconaSveglia dimensione={18} /> Promemoria per te</h2>
      {miei.map((p) => (
        <label key={p.id} className={`riga-semplice${p.fatto ? ' conclusa' : ''}`} style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={Boolean(p.fatto)} style={{ width: 18, height: 18, accentColor: 'var(--primario)' }}
            onChange={(e) => void salvaCondiviso('promemoria', { ...p, fatto: e.target.checked || undefined, fattoIl: e.target.checked ? Date.now() : undefined })} />
          <span className="crescente">
            <span style={{ fontWeight: 600, textDecoration: p.fatto ? 'line-through' : undefined }}>{p.testo}</span>
            <span className="secondario piccolo">da {profili.find((x) => x.id === p.da)?.nome ?? '—'}{p.giorno < oggiChiave && !p.fatto ? ` · era per ${giornoPromemoria(p.giorno)}` : ''}</span>
          </span>
        </label>
      ))}
    </section>
  )
}

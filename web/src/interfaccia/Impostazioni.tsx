import { useRef, useState } from 'react'
import * as F from '../nucleo/formati'
import { scarica } from '../export/pdf'
import {
  collega, controllaArchivio, creaBackup, PROPRIETARIO_PREDEFINITO, REPOSITORY_PREDEFINITO, ripristinaBackup, scollega, sincronizza,
  useStatoSincronizzazione, type Stato,
} from '../dati/sincronizzazione'
import { Avviso, Campo, mostraAvviso } from './componenti'
import { GestioneProfili } from './GestioneProfili'
import { useImpostazioni } from '../dati/hooks'
import { salvaImpostazioni } from '../dati/archivio'
import { profiloAttivo } from '../dati/profili'

const PAGINA_TOKEN = 'https://github.com/settings/personal-access-tokens/new'

export function testoStato(s: Stato): string {
  const quando = 'ultima' in s && s.ultima ? ` · ${F.dataBreve(s.ultima)} ${F.ora(s.ultima)}` : ''
  switch (s.tipo) {
    case 'non-collegato': return 'Non collegato: i dati sono solo su questo dispositivo'
    case 'pronto': return `Sincronizzato${quando}`
    case 'in-corso': return 'Sincronizzazione in corso…'
    case 'senza-rete': return `Senza rete: sincronizzo appena torna${quando}`
    case 'errore': return `Problema: ${s.messaggio}`
  }
}

export function coloreStato(s: Stato): string {
  return s.tipo === 'pronto' ? '#4E8A63' : s.tipo === 'errore' ? 'var(--pericolo)' : s.tipo === 'non-collegato' ? 'var(--linea-forte)' : '#C0913E'
}

export function Impostazioni() {
  const stato = useStatoSincronizzazione()
  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <h1 className="titolo-grande">Impostazioni</h1>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h2 className="titolo-sezione">Sincronizzazione e password</h2>
        {stato.tipo === 'non-collegato' ? <Collegamento /> : <StatoCollegato stato={stato} />}
      </section>
      <GestioneProfili />
      <SceltaValuta />
      <Backup />
    </div>
  )
}

function StatoCollegato({ stato }: { stato: Stato }) {
  return (
    <div className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: coloreStato(stato), flexShrink: 0 }} />
        <span style={{ fontWeight: 500 }}>{testoStato(stato)}</span>
      </div>
      <p className="secondario piccolo" style={{ margin: 0 }}>
        I dati vengono cifrati con la tua password su questo dispositivo e salvati nell'archivio privato "{REPOSITORY_PREDEFINITO}".
        Mac e iPhone si aggiornano da soli quando c'è rete.
      </p>
      <div className="riga-azioni">
        <button type="button" className="pulsante primario" disabled={stato.tipo === 'in-corso'} onClick={() => void sincronizza()}>Sincronizza ora</button>
        <button type="button" className="pulsante pericolo"
          onClick={() => window.confirm('Scollegare questo dispositivo? I dati restano qui e su GitHub; per ricollegarlo serviranno chiave di accesso e password.') && void scollega()}>
          Scollega questo dispositivo
        </button>
      </div>
    </div>
  )
}

function Collegamento() {
  const [passo, setPasso] = useState<'token' | 'password'>('token')
  const [token, setToken] = useState('')
  const [haPassword, setHaPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [conferma, setConferma] = useState('')
  const [errore, setErrore] = useState<string>()
  const [attesa, setAttesa] = useState(false)

  async function avanti() {
    setErrore(undefined)
    setAttesa(true)
    try {
      const r = await controllaArchivio(token)
      setHaPassword(r.haPassword)
      setPasso('password')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Non riesco a raggiungere GitHub.')
    } finally {
      setAttesa(false)
    }
  }

  async function finisci() {
    setErrore(undefined)
    if (!haPassword && password.length < 10) return setErrore('Usa almeno 10 caratteri: per esempio tre parole e un numero.')
    if (!haPassword && password !== conferma) return setErrore('Le due password non coincidono.')
    setAttesa(true)
    try {
      await collega(token, password)
      mostraAvviso('Dispositivo collegato: i dati ora si sincronizzano')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Collegamento non riuscito.')
    } finally {
      setAttesa(false)
    }
  }

  if (passo === 'token') {
    return (
      <div className="scheda modulo">
        <p style={{ margin: 0 }}>
          Per sincronizzare Mac e iPhone serve una <strong>chiave di accesso</strong> di GitHub che apra solo l'archivio dei dati. Si crea una volta e si incolla qui su ogni dispositivo.
        </p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6, lineHeight: 1.45 }}>
          <li>Apri <a href={PAGINA_TOKEN} target="_blank" rel="noreferrer">la pagina per creare la chiave su GitHub</a> (accedi se te lo chiede).</li>
          <li><strong>Token name</strong>: scrivi <code>Agenda</code>.</li>
          <li><strong>Expiration</strong>: scegli la durata più lunga. Prima della scadenza GitHub ti avvisa e ne crei una nuova.</li>
          <li><strong>Repository access</strong>: scegli <em>Only select repositories</em> e seleziona <code>{PROPRIETARIO_PREDEFINITO}/{REPOSITORY_PREDEFINITO}</code>.</li>
          <li><strong>Permissions</strong> → <em>Repository permissions</em> → <strong>Contents</strong>: <em>Read and write</em>.</li>
          <li>Premi <strong>Generate token</strong>, copia il codice (inizia con <code>github_pat_</code>) e incollalo qui sotto.</li>
        </ol>
        <Campo etichetta="Chiave di accesso">
          <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" spellCheck={false} />
        </Campo>
        <span className="nota-privacy">La chiave resta solo su questo dispositivo. Non scriverla altrove e non condividerla.</span>
        {errore && <Avviso>{errore}</Avviso>}
        <button type="button" className="pulsante primario" disabled={token.trim().length < 20 || attesa} onClick={() => void avanti()}>
          {attesa ? 'Controllo…' : 'Avanti'}
        </button>
      </div>
    )
  }

  return (
    <div className="scheda modulo">
      {haPassword ? (
        <>
          <p style={{ margin: 0 }}>Inserisci la <strong>password</strong> che hai scelto sul primo dispositivo.</p>
          <Campo etichetta="Password">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Campo>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            Scegli la <strong>password</strong> che cifra i tuoi dati. Ti servirà per collegare gli altri dispositivi.
          </p>
          <Avviso>
            Conservala bene (per esempio nel Portachiavi o in un posto sicuro): senza password i dati su GitHub non si possono leggere, nemmeno da me.
            Quelli già sui tuoi dispositivi restano comunque.
          </Avviso>
          <Campo etichetta="Nuova password (almeno 10 caratteri)">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </Campo>
          <Campo etichetta="Ripeti la password">
            <input type="password" value={conferma} onChange={(e) => setConferma(e.target.value)} autoComplete="new-password" />
          </Campo>
        </>
      )}
      {errore && <Avviso>{errore}</Avviso>}
      <div className="riga-azioni">
        <button type="button" className="pulsante primario" disabled={!password || attesa} onClick={() => void finisci()}>
          {attesa ? 'Collego… (qualche secondo)' : haPassword ? 'Collega' : 'Crea la password e collega'}
        </button>
        <button type="button" className="pulsante" onClick={() => setPasso('token')}>Indietro</button>
      </div>
    </div>
  )
}

function Backup() {
  const input = useRef<HTMLInputElement>(null)
  async function scaricaBackup() {
    scarica(await creaBackup(), `Agenda backup ${new Date().toISOString().slice(0, 10)}.json`)
  }
  async function ripristina(file: File) {
    try {
      const n = await ripristinaBackup(await file.text())
      mostraAvviso(n ? `Backup ripristinato: ${n} elementi aggiunti o aggiornati` : 'Il backup non conteneva niente di nuovo')
    } catch (e) {
      mostraAvviso(e instanceof Error ? e.message : 'Ripristino non riuscito')
    }
  }
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 className="titolo-sezione">Backup</h2>
      <div className="scheda modulo">
        <p className="secondario" style={{ margin: 0 }}>
          Un file con tutti i tuoi dati, da tenere dove vuoi (per esempio in iCloud Drive). Il ripristino aggiunge i dati del file a quelli attuali, senza cancellare nulla.
        </p>
        <span className="nota-privacy">Il file di backup non è cifrato: conservalo in un posto sicuro.</span>
        <div className="riga-azioni">
          <button type="button" className="pulsante" onClick={() => void scaricaBackup()}>Scarica backup</button>
          <button type="button" className="pulsante" onClick={() => input.current?.click()}>Ripristina da backup…</button>
          <input ref={input} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void ripristina(f); e.target.value = '' }} />
        </div>
      </div>
    </section>
  )
}

/** Valuta degli importi di questo profilo (Budget, Casa, compensi). */
function SceltaValuta() {
  const impostazioni = useImpostazioni()
  const attuale = impostazioni?.valuta ?? 'EUR'
  async function scegli(v: F.Valuta) {
    await salvaImpostazioni({ valuta: v })
    if (F.ricordaValuta(v, profiloAttivo())) location.reload()
  }
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 className="titolo-sezione">Valuta di questo profilo</h2>
      <div className="segmenti" role="radiogroup" aria-label="Valuta" style={{ maxWidth: 360 }}>
        {([['EUR', 'Euro €'], ['GBP', 'Sterlina £']] as const).map(([v, t]) => (
          <button key={v} type="button" role="radio" aria-checked={attuale === v} className={attuale === v ? 'attivo' : ''} onClick={() => void scegli(v)}>{t}</button>
        ))}
      </div>
      <span className="secondario piccolo">Gli importi già scritti restano gli stessi numeri: cambia solo il simbolo.</span>
    </section>
  )
}

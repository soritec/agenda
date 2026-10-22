import { useEffect, useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import { elenca, elimina, ripristina, salva, salvaTanti } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Notizia } from '../../../dati/modello'
import { Avviso, Campo, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { IconaIndietro, IconaAvanti, IconaLink, IconaScintille, IconaSegnalibro } from '../../../interfaccia/icone'
import { leggiChiave, notizieDellaSettimana, spiegaNotizia } from '../../studio/ai'
import { chiaveGiorno, giornoDaChiave, oggi } from '../../turni/supporto'
import { lunediDi, spostaGiorni } from '../../agenda/impegni'
import {
  DATI_TEMA, delPeriodo, unisciConFeed, leggiNotizie, leggiSpiegazione, nuoveSoltanto, settimanaDi, storiaDellaSettimana, studiConApplication, TEMI, temaDa, type Tema,
} from '../logica'

const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
/** Date in inglese ("15 Oct"), perché la sezione è in inglese. */
const fData = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short' })
const dataEn = (g: string) => fData.format(msGiorno(g))
const elencoDa = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean)

/** Toglie una notizia: le automatiche si nascondono (non si possono cancellare dal file), le proprie si eliminano. */
async function togli(n: Notizia) {
  if (n.daFeed) await salva('notizie', { ...n, nascosta: true })
  else await elimina('notizie', n.id)
}
async function rimetti(n: Notizia) {
  if (n.daFeed) await salva('notizie', { ...n, nascosta: undefined })
  else await ripristina('notizie', n.id)
}

/** Salva o toglie il segnalibro (con "Annulla" quando si toglie). */
export async function cambiaSegnalibro(n: Notizia) {
  if (n.salvata) {
    await salva('notizie', { ...n, salvata: undefined, salvataIl: undefined })
    mostraAvviso('Removed from saved', () => void salva('notizie', n))
  } else {
    await salva('notizie', { ...n, salvata: true, salvataIl: chiaveGiorno(oggi()) })
  }
}

export function Segnalibro({ salvata, onClick, etichetta }: { salvata?: boolean; onClick: () => void; etichetta?: string }) {
  return (
    <button type="button" className={`segnalibro${salvata ? ' salvato' : ''}`} aria-pressed={Boolean(salvata)} aria-label={etichetta ?? (salvata ? 'Remove from saved' : 'Save')}
      title={etichetta ?? (salvata ? 'Remove from saved' : 'Save')} onClick={onClick}>
      <IconaSegnalibro dimensione={19} pieno={salvata} />
    </button>
  )
}

/** Commercial awareness: notizie della settimana per tema, con riassunti, cifre, note per i colloqui e segnalibri. */
/** Notizie automatiche: giornali (ogni giorno) e quelle scritte da Claude (ogni settimana). Senza rete restano quelle già viste. */
function useNotizieAutomatiche() {
  const [dati, setDati] = useState<{ notizie: Notizia[]; aggiornato?: string }>({ notizie: [] })
  useEffect(() => {
    let vivo = true
    type File = { aggiornato?: string; notizie?: Notizia[] }
    const leggi = (file: string): Promise<File> => fetch(`${import.meta.env.BASE_URL}${file}`, { cache: 'no-cache' })
      .then((r) => (r.ok ? (r.json() as Promise<File>) : {}))
      .catch(() => ({}))
    void Promise.all([leggi('notizie-claude.json'), leggi('notizie.json')]).then(([claude, giornali]) => {
      if (!vivo) return
      // Prima quelle di Claude (riassunti lunghi): a parità di articolo vincono loro.
      const visti = new Set<string>()
      const notizie = [...(claude.notizie ?? []), ...(giornali.notizie ?? [])].filter((n) => { const k = n.url ?? n.id; if (visti.has(k)) return false; visti.add(k); return true })
      setDati({ notizie, aggiornato: giornali.aggiornato ?? claude.aggiornato })
    })
    return () => { vivo = false }
  }, [])
  return dati
}

export function Commercial({ settimanaParam }: { settimanaParam?: string | null }) {
  const salvate = useCollezione('notizie')
  const automatiche = useNotizieAutomatiche()
  const notizie = useMemo(() => (salvate ? unisciConFeed(salvate, automatiche.notizie) : undefined), [salvate, automatiche.notizie])
  const applications = useCollezione('applications')
  const oggiChiave = chiaveGiorno(oggi())
  const { da, a } = settimanaDi(settimanaParam && giornoDaChiave(settimanaParam) ? settimanaParam : oggiChiave)
  const [filtro, setFiltro] = useState<'all' | Tema>('all')
  const [aperta, setAperta] = useState<{ n?: Notizia; tema?: Tema }>()
  const [cerco, setCerco] = useState(false)
  const [errore, setErrore] = useState<string>()
  const vai = (giorno: string) => { location.hash = lunediDi(giorno) === lunediDi(oggiChiave) ? '#/commercial' : `#/commercial?settimana=${lunediDi(giorno)}` }

  const settimana = useMemo(() => delPeriodo(notizie ?? [], da, a).sort((x, y) => y.giorno.localeCompare(x.giorno) || y.creatoIl - x.creatoIl), [notizie, da, a])
  const storia = storiaDellaSettimana(settimana)
  const altre = settimana.filter((n) => n !== storia)
  const temiConNotizie = TEMI.filter((t) => altre.some((n) => temaDa(n.tema) === t))
  const temiMostrati = filtro === 'all' ? temiConNotizie : [filtro]
  const conNote = settimana.filter((n) => n.perche || n.colloquio).length

  async function cercaNotizie() {
    setCerco(true); setErrore(undefined)
    try {
      const fine = a < oggiChiave ? a : oggiChiave
      const trovate = nuoveSoltanto(leggiNotizie(await notizieDellaSettimana(da, fine, TEMI.map((t) => ({ chiave: t, nome: t === 'ita' ? 'Italian politics' : DATI_TEMA[t].nome }))), fine), notizie ?? [])
      if (!trovate.length) throw new Error('Gemini found no new stories for this week. Try again later.')
      await salvaTanti('notizie', trovate.map((n) => ({ ...n, giorno: n.giorno < da ? da : n.giorno })))
      mostraAvviso(`${trovate.length} new ${trovate.length === 1 ? 'story' : 'stories'} added`)
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Something went wrong.') }
    setCerco(false)
  }

  return (
    <div className="schermata commercial" style={{ maxWidth: 1000 }} lang="en">
      <header className="intestazione">
        <div>
          <div className="sopratitolo">Week of {dataEn(da)} – {dataEn(a)} · {settimana.length} {settimana.length === 1 ? 'story' : 'stories'} · {conNote} with notes</div>
          <h1 className="titolo-grande">Commercial awareness</h1>
        </div>
        <div className="riga-azioni">
          <button type="button" className="pulsante tondo" aria-label="Previous week" onClick={() => vai(spostaGiorni(da, -7))}><IconaIndietro dimensione={18} /></button>
          {da !== lunediDi(oggiChiave) && <button type="button" className="pulsante" onClick={() => vai(oggiChiave)}>This week</button>}
          <button type="button" className="pulsante tondo" aria-label="Next week" onClick={() => vai(spostaGiorni(da, 7))}><IconaAvanti dimensione={18} /></button>
        </div>
      </header>

      <div className="riga-azioni">
        {leggiChiave()
          ? <button type="button" className="pulsante" disabled={cerco || da > oggiChiave} onClick={() => void cercaNotizie()}><IconaScintille dimensione={16} /> {cerco ? 'Searching the news… (up to a minute)' : "This week's news"}</button>
          : null}
        <button type="button" className="pulsante primario" onClick={() => setAperta({})}>+ Story</button>
      </div>
      {automatiche.aggiornato && <span className="secondario piccolo">News updated automatically every day from BBC, The Guardian, City AM, Legal Cheek, ANSA, Il Post and Il Sole 24 Ore · last update {dataEn(automatiche.aggiornato.slice(0, 10))}</span>}
      {errore && <Avviso>{errore}</Avviso>}
      {settimana.some((n) => n.daGemini) && <span className="secondario piccolo">Stories found by Gemini: check them in the original article before quoting them.</span>}

      {storia && <StoriaSettimana n={storia} studi={studiConApplication(storia, applications ?? [])} onModifica={() => setAperta({ n: storia })} />}

      {settimana.length === 0 ? (
        <div className="vuoto">No stories for this week yet. Use "This week's news" or add one with "+ Story".</div>
      ) : (
        <>
          <div className="filtri-agenda">
            <button type="button" className={`pillola${filtro === 'all' ? ' filtro-attivo' : ''}`} onClick={() => setFiltro('all')}>All</button>
            {TEMI.map((t) => (
              <button key={t} type="button" className="pillola" aria-pressed={filtro === t} onClick={() => setFiltro(t)}
                style={filtro === t ? { background: DATI_TEMA[t].sfondo, color: DATI_TEMA[t].colore, borderColor: DATI_TEMA[t].sfondo, fontWeight: 600 } : undefined}>{DATI_TEMA[t].nome}</button>
            ))}
          </div>
          <div className="temi-notizie">
            {temiMostrati.map((t) => {
              const elenco = altre.filter((n) => temaDa(n.tema) === t)
              return (
                <section key={t} className="tema-notizie">
                  <div className="testa-tema" style={{ background: DATI_TEMA[t].sfondo, color: DATI_TEMA[t].colore }}>
                    <span>{DATI_TEMA[t].nome}</span><span className="conta">{elenco.length}</span>
                  </div>
                  {elenco.length === 0 && <div className="vuoto piccolo">{t === 'ita' ? 'Nessuna notizia questa settimana.' : 'No stories this week.'}</div>}
                  {elenco.map((n) => <VoceNotizia key={n.id} n={n} studi={studiConApplication(n, applications ?? [])} onModifica={() => setAperta({ n })} />)}
                  <button type="button" className="link piccolo aggiungi-tema" onClick={() => setAperta({ tema: t })}>{t === 'ita' ? '+ notizia' : '+ story'}</button>
                </section>
              )
            })}
          </div>
        </>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Sources</h2>
        <div className="riga-azioni" style={{ gap: 6 }}>
          {[['Financial Times', 'https://www.ft.com'], ['The Economist', 'https://www.economist.com'], ['Reuters', 'https://www.reuters.com/business'], ['BBC Business', 'https://www.bbc.co.uk/news/business'],
            ['City AM', 'https://www.cityam.com'], ['Legal Cheek', 'https://www.legalcheek.com/category/commercial-awareness'], ['The Lawyer', 'https://www.thelawyer.com'], ['Law Gazette', 'https://www.lawgazette.co.uk'],
            ['Il Sole 24 Ore', 'https://www.ilsole24ore.com'], ['Corriere', 'https://www.corriere.it']].map(([t, u]) => (
            <a key={u} className="pillola" href={u} target="_blank" rel="noreferrer"><IconaLink dimensione={13} /> {t}</a>
          ))}
        </div>
      </section>

      {aperta && <FormNotizia n={aperta.n} tema={aperta.tema} giornoPredefinito={a < oggiChiave ? a : oggiChiave < da ? da : oggiChiave} onChiudi={() => setAperta(undefined)} />}
    </div>
  )
}

/** Note di Gemini sulla notizia (perché conta, cosa dire al colloquio…). */
function useSpiegazione(n: Notizia) {
  const [cerco, setCerco] = useState(false)
  const [errore, setErrore] = useState<string>()
  async function spiega() {
    setCerco(true); setErrore(undefined)
    try {
      const s = leggiSpiegazione(await spiegaNotizia(n, temaDa(n.tema) === 'ita'))
      if (!s) throw new Error('Gemini did not answer properly: try again.')
      await salva('notizie', { ...n, perche: n.perche || s.perche, colloquio: n.colloquio || s.colloquio, aree: n.aree?.length ? n.aree : s.aree, studi: n.studi?.length ? n.studi : s.studi, daGemini: true })
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Something went wrong.') }
    setCerco(false)
  }
  return { cerco, errore, spiega }
}

const Cifre = ({ n }: { n: Notizia }) => (n.cifre?.length ? <div className="cifre-notizia">{n.cifre.map((c) => <span key={c}>{c}</span>)}</div> : null)
const Fonte = ({ n }: { n: Notizia }) => (
  <span className="secondario piccolo">
    {n.url ? <a href={n.url} target="_blank" rel="noreferrer">{n.fonte || 'Article'}</a> : n.fonte}{n.fonte || n.url ? ' · ' : ''}{dataEn(n.giorno)}
  </span>
)
const Studi = ({ n, studi }: { n: Notizia; studi: string[] }) => {
  const tutti = [...new Set([...(n.studi ?? []), ...studi])]
  if (!tutti.length) return null
  return (
    <span className="secondario piccolo">Firms: {tutti.map((s, i) => (
      <span key={s}>{i > 0 ? ' · ' : ''}{studi.includes(s) ? <strong className="studio-applicato">{s} (you applied)</strong> : s}</span>
    ))}</span>
  )
}

function StoriaSettimana({ n, studi, onModifica }: { n: Notizia; studi: string[]; onModifica: () => void }) {
  const t = DATI_TEMA[temaDa(n.tema)]
  const { cerco, errore, spiega } = useSpiegazione(n)
  return (
    <article className="scheda storia-settimana" lang={temaDa(n.tema) === 'ita' ? 'it' : 'en'}>
      <div className="riga-azioni" style={{ gap: 8 }}>
        <span className="etichetta-tema" style={{ background: t.sfondo, color: t.colore }}>Story of the week · {t.nome}</span>
        <Fonte n={n} />
        <span className="crescente" />
        <Segnalibro salvata={n.salvata} onClick={() => void cambiaSegnalibro(n)} />
      </div>
      <h2 className="titolo-storia">{n.titolo}</h2>
      {n.riassunto && <p className="riassunto-notizia">{n.riassunto}</p>}
      <Cifre n={n} />
      <div className="note-storia">
        <div><span className="etichetta-nota">Why it matters for a firm</span><span>{n.perche || '—'}</span></div>
        <div><span className="etichetta-nota">What I'd say at interview</span><span>{n.colloquio || '—'}</span></div>
      </div>
      {n.aree?.length ? <div className="riga-azioni" style={{ gap: 5 }}>{n.aree.map((x) => <span key={x} className="etichetta-tema" style={{ background: t.sfondo, color: t.colore }}>{x}</span>)}</div> : null}
      <Studi n={n} studi={studi} />
      {errore && <Avviso>{errore}</Avviso>}
      <div className="riga-azioni" style={{ gap: 6 }}>
        {(!n.perche || !n.colloquio) && leggiChiave() && <button type="button" className="pillola" disabled={cerco} onClick={() => void spiega()}><IconaScintille dimensione={14} /> {cerco ? 'Thinking…' : 'Explain with Gemini'}</button>}
        <button type="button" className="pillola" onClick={onModifica}>Edit notes</button>
        <button type="button" className="pillola" onClick={() => void salva('notizie', { ...n, storiaSettimana: undefined })}>Not story of the week</button>
      </div>
    </article>
  )
}

function VoceNotizia({ n, studi, onModifica }: { n: Notizia; studi: string[]; onModifica: () => void }) {
  const [aperta, setAperta] = useState(false)
  const { cerco, errore, spiega } = useSpiegazione(n)
  const t = DATI_TEMA[temaDa(n.tema)]
  const ita = temaDa(n.tema) === 'ita'
  async function rendiStoria() {
    const { da, a } = settimanaDi(n.giorno)
    const altre = (await elenca('notizie')).filter((x) => x.storiaSettimana && x.giorno >= da && x.giorno <= a && x.id !== n.id)
    if (altre.length) await salvaTanti('notizie', altre.map((x) => ({ ...x, storiaSettimana: undefined })))
    await salva('notizie', { ...n, storiaSettimana: true })
  }
  return (
    <article className={`voce-notizia${aperta ? ' aperta' : ''}`} lang={ita ? 'it' : 'en'}>
      <div className="testa-notizia">
        <button type="button" className="titolo-notizia" onClick={() => setAperta(!aperta)}>{n.titolo}</button>
        <Segnalibro salvata={n.salvata} onClick={() => void cambiaSegnalibro(n)} />
        <button type="button" className="elimina-task" aria-label={`Delete ${n.titolo}`}
          onClick={() => void togli(n).then(() => mostraAvviso(ita ? 'Notizia tolta' : 'Story removed', () => void rimetti(n)))}>×</button>
      </div>
      <Fonte n={n} />
      {n.riassunto && <p className="riassunto-notizia">{n.riassunto}</p>}
      <Cifre n={n} />
      {aperta && (
        <div className="dettaglio-notizia">
          <div><span className="etichetta-nota">{ita ? 'Perché conta per uno studio' : 'Why it matters for a firm'}</span><span>{n.perche || (ita ? 'Ancora nessuna nota.' : 'No notes yet.')}</span></div>
          {n.colloquio && <div><span className="etichetta-nota">{ita ? 'Cosa direi al colloquio' : "What I'd say at interview"}</span><span>{n.colloquio}</span></div>}
          {n.aree?.length ? <div className="riga-azioni" style={{ gap: 5 }}>{n.aree.map((x) => <span key={x} className="etichetta-tema" style={{ background: t.sfondo, color: t.colore }}>{x}</span>)}</div> : null}
          <Studi n={n} studi={studi} />
          {errore && <Avviso>{errore}</Avviso>}
          <div className="riga-azioni" style={{ gap: 6 }}>
            {n.url && <a className="pillola" href={n.url} target="_blank" rel="noreferrer"><IconaLink dimensione={13} /> {ita ? "Apri l'articolo" : 'Open article'}</a>}
            {(!n.perche || !n.colloquio) && leggiChiave() && <button type="button" className="pillola" disabled={cerco} onClick={() => void spiega()}><IconaScintille dimensione={14} /> {cerco ? '…' : ita ? 'Spiegamela con Gemini' : 'Explain with Gemini'}</button>}
            <button type="button" className="pillola" onClick={onModifica}>{ita ? 'Modifica' : 'Edit'}</button>
            <button type="button" className="pillola" onClick={() => void rendiStoria()}>Story of the week</button>
          </div>
        </div>
      )}
      {(!aperta && (studi.length > 0)) && <Studi n={n} studi={studi} />}
      <button type="button" className="leggi-tutto" onClick={() => setAperta(!aperta)}>{aperta ? (ita ? 'Chiudi' : 'Show less') : (ita ? 'Leggi tutto' : 'Read more')}</button>
    </article>
  )
}

function FormNotizia({ n, tema, giornoPredefinito, onChiudi }: { n?: Notizia; tema?: Tema; giornoPredefinito: string; onChiudi: () => void }) {
  const [b, setB] = useState({
    titolo: n?.titolo ?? '', tema: temaDa(n?.tema ?? tema ?? 'deal'), fonte: n?.fonte ?? '', url: n?.url ?? '', giorno: n?.giorno ?? giornoPredefinito,
    riassunto: n?.riassunto ?? '', cifre: (n?.cifre ?? []).join(', '), perche: n?.perche ?? '', colloquio: n?.colloquio ?? '', aree: (n?.aree ?? []).join(', '), studi: (n?.studi ?? []).join(', '),
  })
  const valido = b.titolo.trim() !== '' && Boolean(giornoDaChiave(b.giorno))
  async function conferma() {
    if (!valido) return
    await salva('notizie', {
      ...n, titolo: b.titolo.trim(), tema: b.tema, fonte: b.fonte.trim() || undefined, url: /^https?:\/\//.test(b.url.trim()) ? b.url.trim() : undefined, giorno: b.giorno,
      riassunto: b.riassunto.trim() || undefined, cifre: elencoDa(b.cifre).length ? elencoDa(b.cifre) : undefined, perche: b.perche.trim() || undefined,
      colloquio: b.colloquio.trim() || undefined, aree: elencoDa(b.aree).length ? elencoDa(b.aree) : undefined, studi: elencoDa(b.studi).length ? elencoDa(b.studi) : undefined,
    })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={n ? 'Story' : 'New story'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Save</button>}>
      <div className="modulo" lang="en">
        <Campo etichetta="Headline"><input value={b.titolo} autoFocus={!n} onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="riga-azioni" role="radiogroup" aria-label="Topic" style={{ gap: 5 }}>
          {TEMI.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={b.tema === t} className="pillola" onClick={() => setB({ ...b, tema: t })}
              style={b.tema === t ? { background: DATI_TEMA[t].sfondo, color: DATI_TEMA[t].colore, borderColor: DATI_TEMA[t].sfondo, fontWeight: 600 } : undefined}>{DATI_TEMA[t].nome}</button>
          ))}
        </div>
        <div className="campi-affiancati">
          <Campo etichetta="Source"><input value={b.fonte} placeholder="e.g. Financial Times" onChange={(e) => setB({ ...b, fonte: e.target.value })} /></Campo>
          <Campo etichetta="Date"><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
        </div>
        <Campo etichetta="Link to the article"><input value={b.url} inputMode="url" placeholder="https://…" onChange={(e) => setB({ ...b, url: e.target.value })} /></Campo>
        <Campo etichetta="Summary"><textarea rows={5} value={b.riassunto} placeholder="Context, what happened, what may happen next" onChange={(e) => setB({ ...b, riassunto: e.target.value })} /></Campo>
        <Campo etichetta="Key figures (separated by commas)"><input value={b.cifre} placeholder="£4bn deal value, 1,200 stores" onChange={(e) => setB({ ...b, cifre: e.target.value })} /></Campo>
        <Campo etichetta="Why it matters for a firm"><textarea value={b.perche} onChange={(e) => setB({ ...b, perche: e.target.value })} /></Campo>
        <Campo etichetta="What I'd say at interview"><textarea value={b.colloquio} onChange={(e) => setB({ ...b, colloquio: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Practice areas"><input value={b.aree} placeholder="M&A, Competition" onChange={(e) => setB({ ...b, aree: e.target.value })} /></Campo>
          <Campo etichetta="Law firms involved"><input value={b.studi} placeholder="Linklaters, Slaughter and May" onChange={(e) => setB({ ...b, studi: e.target.value })} /></Campo>
        </div>
        {n && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void togli(n).then(() => { onChiudi(); mostraAvviso('Story removed', () => void rimetti(n)) })}>Delete</button>
        )}
      </div>
    </Foglio>
  )
}


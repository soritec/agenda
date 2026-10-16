import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { componenti, istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva, salvaTanti } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { Bolletta, Candidata, Casa as DatiCasa, PagamentoCasa, Stanza } from '../../../dati/modello'
import { Avviso, Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { IconaFiamma, IconaFulmine, IconaGoccia, IconaImpostazioni, IconaLetto, IconaLink, IconaPalazzo, IconaPiu, IconaPorta, IconaPuntini, IconaWifi } from '../../../interfaccia/icone'
import { centesimiDaTesto, chiaveGiorno, giornoDaChiave, oggi, testoDaCentesimi } from '../../turni/supporto'
import {
  BOLLETTE_INIZIALI, bolletteDelMese, CASA_PREDEFINITA, COLORI_BOLLETTA, COLORI_STANZA, contiMese, fineMese, giornoDopo, giorniMancanti, idPagamento,
  occupante, ordinaCandidate, VOCI_USCITA, type TipoPagamento, passaggioDiStanza, quotaPropria, STATI_CANDIDATA, statoCandidataDa, testoBolletta, TITOLI_STATO_CANDIDATA,
  TITOLI_VALUTAZIONE, VALUTAZIONI, valutazioneDa,
} from '../logica'

const ICONE_BOLLETTA: Record<string, (p: { dimensione?: number }) => ReactNode> = {
  luce: IconaFulmine, riscaldamento: IconaFiamma, acqua: IconaGoccia, wifi: IconaWifi, comune: IconaPalazzo, altro: IconaPuntini,
}
const TITOLI_ICONA: Record<string, string> = { luce: 'Luce', riscaldamento: 'Riscaldamento', acqua: 'Acqua', wifi: 'Wifi', comune: 'Council tax', altro: 'Altro' }
const COLORI_VALUTAZIONE: Record<string, [string, string]> = { buono: ['#DCEBD9', '#33553A'], forse: ['#F6EEDF', '#6B5317'], piuNo: ['#F0D8CC', '#7A3E28'], no: ['#E7D3D0', '#6E2E26'] }

const msGiorno = (g: string) => { const c = giornoDaChiave(g)!; return istante(c.anno, c.mese, c.giorno, 12) }
const dataBreve = (g?: string) => (g && giornoDaChiave(g) ? F.dataBreve(msGiorno(g)) : '')
const nomeMese = (mese: string) => F.mese(msGiorno(`${mese}-01`))
const spostaMese = (mese: string, n: number) => {
  const [a, m] = mese.split('-').map(Number) as [number, number]
  const t = a * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
const testoViewing = (ms: number) => `${F.dataBreve(ms)}, ${F.ora(ms)}`
/** "2026-10-16T18:30" per i campi data e ora. */
const perCampo = (ms?: number) => {
  if (ms === undefined) return ''
  const c = componenti(ms)
  return `${chiaveGiorno(c)}T${String(c.ora).padStart(2, '0')}:${String(c.minuto).padStart(2, '0')}`
}
const daCampo = (v: string) => {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  return m ? istante(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])) : undefined
}

/** Casa condivisa: stanze, bills del mese con conti automatici, partenze, ricerca di coinquiline e cose da gestire. */
export function Casa({ meseParam }: { meseParam?: string }) {
  const casaRecord = useCollezione('casa')
  const stanzeTutte = useCollezione('stanze')
  const bollette = useCollezione('bollette')
  const pagamentiTutti = useCollezione('pagamentiCasa')
  const candidate = useCollezione('candidate')
  const oggiChiave = chiaveGiorno(oggi())
  const mese = meseParam && /^\d{4}-\d{2}$/.test(meseParam) ? meseParam : oggiChiave.slice(0, 7)
  const vaiAlMese = (m: string) => { location.hash = m === oggiChiave.slice(0, 7) ? '#/casa' : `#/casa?mese=${m}` }

  const [aperto, setAperto] = useState<
    | { cosa: 'casa' } | { cosa: 'stanza'; s?: Stanza } | { cosa: 'bolletta'; b?: Bolletta; importoMese?: number }
    | { cosa: 'partenza'; s?: Stanza } | { cosa: 'candidata'; c?: Candidata } | { cosa: 'scegli'; c: Candidata }
  >()

  const pronto = casaRecord && stanzeTutte && bollette && pagamentiTutti
  const casa: Omit<DatiCasa, 'creatoIl' | 'modificatoIl'> = casaRecord?.[0] ?? { id: 'casa', ...CASA_PREDEFINITA }
  const stanze = useMemo(() => [...(stanzeTutte ?? [])].sort((a, b) => Number(Boolean(b.propria)) - Number(Boolean(a.propria)) || a.ordine - b.ordine), [stanzeTutte])
  const altre = stanze.filter((s) => !s.propria)
  const pagamenti = useMemo(() => new Map((pagamentiTutti ?? []).map((p) => [p.id, p])), [pagamentiTutti])
  const bills = bolletteDelMese(bollette ?? [], pagamenti, mese)
  const conti = contiMese(bills, stanze, casa.quotaBolletteCent)
  const partenze = stanze.filter((s) => s.esceIl)

  // Quando arriva la nuova coinquilina, la stanza passa a lei.
  useEffect(() => {
    for (const s of stanzeTutte ?? []) {
      const nuova = passaggioDiStanza(s, oggiChiave)
      if (nuova) void salva('stanze', nuova)
    }
  }, [stanzeTutte, oggiChiave])

  async function segna(tipo: TipoPagamento, riferimentoId: string, extra: Partial<PagamentoCasa> = {}) {
    const id = idPagamento(tipo, riferimentoId, mese)
    const p = pagamenti.get(id)
    const fatto = 'fatto' in extra ? extra.fatto : !p?.fatto
    await salva('pagamentiCasa', { ...p, id, tipo, riferimentoId, mese, ...extra, fatto: fatto || undefined, fattoIl: fatto ? (p?.fattoIl ?? oggiChiave) : undefined })
  }

  async function prepara() {
    await salva('casa', { id: 'casa', ...CASA_PREDEFINITA })
    await salvaTanti('stanze', [
      { nome: '', propria: true, affittoCent: 0, colore: COLORI_STANZA[0]!, ordine: 0 },
      { nome: 'Coinquilina 1', affittoCent: 85000, colore: COLORI_STANZA[1]!, ordine: 1 },
      { nome: 'Coinquilina 2', affittoCent: 90000, colore: COLORI_STANZA[2]!, ordine: 2 },
    ])
    await salvaTanti('bollette', BOLLETTE_INIZIALI.map((b, i) => ({ ...b, importoCent: 0, colore: COLORI_BOLLETTA[i % COLORI_BOLLETTA.length]![0], ordine: i })))
    setAperto({ cosa: 'casa' })
  }

  if (!pronto) return <div className="schermata" />

  if (stanze.length === 0) {
    return (
      <div className="schermata" style={{ maxWidth: 900 }}>
        <header><h1 className="titolo-grande">Casa</h1></header>
        <div className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <span>Qui tieni i conti della casa: le stanze con il loro affitto, le bills di ogni mese divise tra tutte, chi se ne va e la ricerca di nuove coinquiline.</span>
          <span className="secondario piccolo">Preparo tre stanze (la tua e due coinquiline) e le bills più comuni: poi cambi nomi e importi.</span>
          <button type="button" className="pulsante primario" onClick={() => void prepara()}>Prepara la casa</button>
        </div>
      </div>
    )
  }

  const avanza = conti.differenzaCent >= 0
  const candidateOrdinate = ordinaCandidate((candidate ?? []).filter((c) => !c.scelta))
  const stanzaCercata = altre.find((s) => s.esceIl && !s.prossima)

  return (
    <div className="schermata casa" style={{ maxWidth: 900 }}>
      <header className="intestazione">
        <div>
          <div className="sopratitolo">{nomeMese(mese)} · {F.simboloValuta()}</div>
          <h1 className="titolo-grande">Casa</h1>
        </div>
        <div className="riga-azioni">
          <button type="button" className="pulsante tondo" aria-label="Mese precedente" onClick={() => vaiAlMese(spostaMese(mese, -1))}>‹</button>
          {mese !== oggiChiave.slice(0, 7) && <button type="button" className="pulsante" onClick={() => vaiAlMese(oggiChiave.slice(0, 7))}>Questo mese</button>}
          <button type="button" className="pulsante tondo" aria-label="Mese successivo" onClick={() => vaiAlMese(spostaMese(mese, 1))}>›</button>
          <button type="button" className="pulsante tondo" aria-label="Affitto e quota bills" onClick={() => setAperto({ cosa: 'casa' })}><IconaImpostazioni dimensione={18} /></button>
        </div>
      </header>

      <section className="sezione-casa">
        <div className="testa-sezione-casa">
          <h2 className="titolo-sezione">Stanze</h2>
          <span className="secondario piccolo">affitto totale {F.importo(casa.affittoTotaleCent)} · pagato da te{casa.giornoAffitto ? `, il ${casa.giornoAffitto}` : ''}</span>
        </div>
        {(() => {
          const p = pagamenti.get(idPagamento('proprietario', 'casa', mese))
          return (
            <button type="button" className={`affitto-mese${p?.fatto ? ' fatto' : ''}`} aria-pressed={Boolean(p?.fatto)} onClick={() => void segna('proprietario', 'casa')}>
              <span className={`pallino-casa${p?.fatto ? ' fatto' : ''}`} aria-hidden="true" />
              <span><strong>Affitto di {nomeMese(mese).split(' ')[0]}</strong> {p?.fatto ? `pagato il ${dataBreve(p.fattoIl)}` : 'da pagare al proprietario'}</span>
              <span className="numeri" style={{ marginLeft: 'auto' }}>{F.importo(casa.affittoTotaleCent)}</span>
            </button>
          )
        })()}
        <div className="stanze">
          {stanze.map((s) => {
            const p = pagamenti.get(idPagamento('affitto', s.id, mese))
            const nome = s.propria ? (s.nome || 'La tua stanza') : occupante(s, fineMese(mese)) || 'Senza nome'
            return (
              <div key={s.id} className="stanza">
                <div className="testa-stanza">
                  <button type="button" className="nome-stanza" style={{ color: s.colore }} onClick={() => setAperto({ cosa: 'stanza', s })}>{nome}</button>
                  {s.propria
                    ? <span style={{ color: s.colore }}><IconaLetto dimensione={18} /></span>
                    : <button type="button" className={`pallino-casa${p?.fatto ? ' fatto' : ''}`} style={{ color: s.colore }} aria-pressed={Boolean(p?.fatto)}
                        aria-label={`${nome}: affitto e bills ricevuti`} onClick={() => void segna('affitto', s.id)} />}
                </div>
                <span className="numeri importo-stanza">{F.importo(s.propria ? quotaPropria(casa, stanze) : s.affittoCent)}</span>
                <span className="secondario piccolo">
                  {s.propria ? "il resto dell'affitto" : [`+ ${F.importo(casa.quotaBolletteCent)} bills`, p?.fatto ? `ricevuto ${dataBreve(p.fattoIl)}` : 'da ricevere'].join(' · ')}
                </span>
                {s.esceIl && <span className="piccolo" style={{ color: s.colore }}>se ne va il {dataBreve(s.esceIl)}</span>}
                {s.prossima && s.prossima.dal > fineMese(mese) && <span className="secondario piccolo">poi {s.prossima.nome} dal {dataBreve(s.prossima.dal)}</span>}
              </div>
            )
          })}
        </div>
        <button type="button" className="link piccolo" style={{ alignSelf: 'flex-start' }} onClick={() => setAperto({ cosa: 'stanza' })}>+ Stanza</button>
      </section>

      <section className="sezione-casa">
        <div className="testa-sezione-casa">
          <h2 className="titolo-sezione">Bills del mese</h2>
          <button type="button" className="pillola" onClick={() => setAperto({ cosa: 'bolletta' })}><IconaPiu dimensione={14} /> Altra voce</button>
        </div>
        <div className="bills">
          {bills.length === 0 && <div className="vuoto piccolo">Nessuna bill: aggiungine una con "Altra voce".</div>}
          {bills.map(({ b, importoCent, pagata }) => {
            const C = ICONE_BOLLETTA[b.icona] ?? IconaPuntini
            const colore = testoBolletta(b.colore)
            return (
              <div key={b.id} className={`bill${pagata ? ' pagata' : ''}`} style={{ background: b.colore, color: colore }}>
                <button type="button" className="corpo-bill" onClick={() => setAperto({ cosa: 'bolletta', b, importoMese: importoCent })}>
                  <C dimensione={19} />
                  <span className="crescente">
                    <span style={{ fontWeight: 600 }}>{b.nome}</span>
                    <span className="piccolo" style={{ opacity: 0.8 }}>ogni mese, il {b.giorno}{pagata ? ' · pagata' : ''}</span>
                  </span>
                  <span className="numeri" style={{ fontWeight: 700 }}>{importoCent ? F.importo(importoCent) : 'importo?'}</span>
                </button>
                <button type="button" className={`pallino-casa${pagata ? ' fatto' : ''}`} aria-pressed={pagata} aria-label={`${b.nome} pagata`} onClick={() => void segna('bolletta', b.id)} />
                <button type="button" className="x-bill" aria-label={`Elimina ${b.nome}`}
                  onClick={() => void elimina('bollette', b.id).then(() => mostraAvviso(`Eliminata: ${b.nome}`, () => void ripristina('bollette', b.id)))}>×</button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="sezione-casa">
        <h2 className="titolo-sezione">Conti automatici</h2>
        <div className="scheda conti-casa">
          <div className="riga-conto"><span>Bills del mese</span><span className="numeri">{F.importo(conti.totaleCent)}</span></div>
          <div className="riga-conto"><span>Parte di ognuna (diviso {conti.persone})</span><span className="numeri">{F.importo(conti.quotaCent)}</span></div>
          <div className="riga-conto"><span>Ognuna ti dà per le bills</span><span className="numeri">{F.importo(conti.versatoCent)}</span></div>
          <div className="riga-conto totale">
            <strong>{conti.differenzaCent === 0 ? 'Pari: nessun conguaglio' : avanza ? 'Da restituire a ognuna' : 'Ognuna ti deve ancora'}</strong>
            <strong className="numeri" style={{ color: conti.differenzaCent === 0 ? undefined : avanza ? '#2E6B57' : '#8A4F45' }}>{F.importo(Math.abs(conti.differenzaCent))}</strong>
          </div>
          {conti.differenzaCent !== 0 && altre.length > 0 && (
            <div className="conguagli">
              {altre.map((s) => {
                const p = pagamenti.get(idPagamento('conguaglio', s.id, mese))
                const nome = occupante(s, fineMese(mese)) || 'Senza nome'
                return (
                  <button key={s.id} type="button" className={`conguaglio${p?.fatto ? ' fatto' : ''}`} onClick={() => void segna('conguaglio', s.id)}>
                    <span className={`pallino-casa${p?.fatto ? ' fatto' : ''}`} style={{ color: s.colore }} aria-hidden="true" />
                    <span style={{ color: s.colore, fontWeight: 600 }}>{nome}</span>
                    <span className="secondario piccolo">{p?.fatto ? (avanza ? `restituiti ${dataBreve(p.fattoIl)}` : `ricevuti ${dataBreve(p.fattoIl)}`) : avanza ? 'da restituire' : 'da ricevere'}</span>
                  </button>
                )
              })}
            </div>
          )}
          {bills.some((x) => !x.importoCent) && <span className="secondario piccolo">Alcune bills non hanno ancora l'importo: toccale per scriverlo.</span>}
        </div>
      </section>

      <section className="sezione-casa">
        <div className="testa-sezione-casa">
          <h2 className="titolo-sezione">Partenze</h2>
          {altre.length > 0 && <button type="button" className="pillola" onClick={() => setAperto({ cosa: 'partenza' })}><IconaPiu dimensione={14} /> Segna una partenza</button>}
        </div>
        <div className="lista">
          {partenze.length === 0 && <div className="vuoto piccolo">Nessuna partenza prevista.</div>}
          {partenze.map((s) => {
            const mancano = giorniMancanti(oggiChiave, s.esceIl!)
            const totale = s.preavvisoIl ? giorniMancanti(s.preavvisoIl, s.esceIl!) : 0
            const fatto = totale ? Math.min(100, Math.max(0, ((totale - mancano) / totale) * 100)) : 0
            return (
              <div key={s.id} className="riga partenza" style={{ cursor: 'default' }}>
                <span style={{ color: s.colore }}><IconaPorta dimensione={20} /></span>
                <button type="button" className="crescente" onClick={() => setAperto({ cosa: 'partenza', s })} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
                  <span><strong style={{ color: s.colore }}>{s.nome || 'Senza nome'}</strong> lascia la stanza da {F.importo(s.affittoCent)}</span>
                  <span className="secondario piccolo">
                    {[`esce il ${dataBreve(s.esceIl)}`, s.preavvisoIl ? `preavviso dato il ${dataBreve(s.preavvisoIl)}` : '', `stanza libera dal ${dataBreve(giornoDopo(s.esceIl!))}`,
                      s.prossima ? `arriva ${s.prossima.nome} il ${dataBreve(s.prossima.dal)}` : ''].filter(Boolean).join(' · ')}
                  </span>
                  <ListaUscita s={s} />
                  {totale > 0 && <span className="barra-partenza"><span style={{ width: `${fatto}%`, background: s.colore }} /></span>}
                </button>
                <span style={{ textAlign: 'right' }}>
                  <span className="numeri" style={{ fontWeight: 700, fontSize: 17, display: 'block' }}>{mancano === 0 ? 'oggi' : `${mancano} ${mancano === 1 ? 'giorno' : 'giorni'}`}</span>
                  <span className="secondario piccolo">{mancano === 0 ? '' : 'alla partenza'}</span>
                </span>
                <button type="button" className="elimina-task" aria-label="Togli la partenza"
                  onClick={() => {
                    const prima = s
                    void salva('stanze', { ...s, esceIl: undefined, preavvisoIl: undefined, prossima: undefined })
                      .then(() => mostraAvviso('Partenza tolta', () => void salva('stanze', prima)))
                  }}>×</button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="sezione-casa">
        <div className="testa-sezione-casa">
          <h2 className="titolo-sezione">Cerca coinquilina</h2>
          <span className="riga-azioni" style={{ gap: 6 }}>
            <a className="pillola" href="https://www.spareroom.co.uk" target="_blank" rel="noreferrer"><IconaLink dimensione={14} /> SpareRoom</a>
            <button type="button" className="pillola" onClick={() => setAperto({ cosa: 'candidata' })}><IconaPiu dimensione={14} /> Candidata</button>
          </span>
        </div>
        {stanzaCercata && <span className="secondario piccolo">Per la stanza da {F.importo(stanzaCercata.affittoCent)}, libera dal {dataBreve(giornoDopo(stanzaCercata.esceIl!))}</span>}
        <div className="lista">
          {candidateOrdinate.length === 0 && <div className="vuoto piccolo">Nessuna candidata. Quando qualcuna risponde all'annuncio, aggiungila qui.</div>}
          {candidateOrdinate.map((c) => <SchedaCandidata key={c.id} c={c} stanza={stanze.find((s) => s.id === c.stanzaId)} onApri={() => setAperto({ cosa: 'candidata', c })} onScegli={() => setAperto({ cosa: 'scegli', c })} />)}
        </div>
      </section>

      <CoseDaGestire oggiChiave={oggiChiave} />

      {aperto?.cosa === 'casa' && <FormCasa casa={casa} stanze={stanze} onChiudi={() => setAperto(undefined)} />}
      {aperto?.cosa === 'stanza' && <FormStanza s={aperto.s} quotaPropriaCent={quotaPropria(casa, stanze)} numero={stanze.length} onChiudi={() => setAperto(undefined)} />}
      {aperto?.cosa === 'bolletta' && <FormBolletta b={aperto.b} importoMese={aperto.importoMese} mese={mese} pagamento={aperto.b ? pagamenti.get(idPagamento('bolletta', aperto.b.id, mese)) : undefined} numero={(bollette ?? []).length} onChiudi={() => setAperto(undefined)} />}
      {aperto?.cosa === 'partenza' && <FormPartenza s={aperto.s} stanze={altre} onChiudi={() => setAperto(undefined)} />}
      {aperto?.cosa === 'candidata' && <FormCandidata c={aperto.c} stanze={altre} predefinita={stanzaCercata?.id} onChiudi={() => setAperto(undefined)} />}
      {aperto?.cosa === 'scegli' && <FormScegli c={aperto.c} stanze={altre} oggiChiave={oggiChiave} onChiudi={() => setAperto(undefined)} />}
    </div>
  )
}

function SchedaCandidata({ c, stanza, onApri, onScegli }: { c: Candidata; stanza?: Stanza; onApri: () => void; onScegli: () => void }) {
  const v = valutazioneDa(c.valutazione)
  const stato = statoCandidataDa(c.stato)
  const [sfondo, testo] = COLORI_VALUTAZIONE[v]!
  const prossima = () => VALUTAZIONI[(VALUTAZIONI.indexOf(v) + 1) % VALUTAZIONI.length]!
  return (
    <div className={`riga candidata${v === 'no' ? ' conclusa' : ''}`} style={{ cursor: 'default', alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'flex-start' }}>
        <button type="button" className="crescente" onClick={onApri} style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
          <span style={{ fontWeight: 600 }}>{c.nome}</span>
          {c.generalita && <span className="secondario piccolo">{c.generalita}</span>}
          <span className="secondario piccolo">Viewing: {c.viewing ? testoViewing(c.viewing) : 'da fissare'}{stanza ? ` · stanza da ${F.importo(stanza.affittoCent)}` : ''}</span>
        </button>
        <button type="button" className="etichetta-valutazione" style={{ background: sfondo, color: testo }} title="Tocca per cambiare"
          onClick={() => void salva('candidate', { ...c, valutazione: prossima() })}>{TITOLI_VALUTAZIONE[v]}</button>
        <button type="button" className="elimina-task" aria-label={`Elimina ${c.nome}`}
          onClick={() => void elimina('candidate', c.id).then(() => mostraAvviso(`Eliminata: ${c.nome}`, () => void ripristina('candidate', c.id)))}>×</button>
      </div>
      <div className="passi-candidata">
        {STATI_CANDIDATA.map((s, i) => (
          <button key={s} type="button" className={i < STATI_CANDIDATA.indexOf(stato) ? 'fatto' : s === stato ? 'attuale' : ''} onClick={() => void salva('candidate', { ...c, stato: s })}>
            {TITOLI_STATO_CANDIDATA[s]}
          </button>
        ))}
        {v !== 'no' && <button type="button" className="scegli-candidata" onClick={onScegli}>Scegli</button>}
      </div>
    </div>
  )
}

/** Cose da gestire per la casa: sono task con area "Casa", quindi compaiono anche nella sezione Task. */
function CoseDaGestire({ oggiChiave }: { oggiChiave: string }) {
  const attivita = useCollezione('attivita')
  const [testo, setTesto] = useState('')
  const [giorno, setGiorno] = useState('')
  const elenco = (attivita ?? []).filter((t) => t.area === 'casa')
    .sort((a, b) => Number(Boolean(a.completataIl)) - Number(Boolean(b.completataIl)) || (a.scadenza ?? '9').localeCompare(b.scadenza ?? '9') || a.creatoIl - b.creatoIl)
  async function aggiungi() {
    if (!testo.trim()) return
    await salva('attivita', { titolo: testo.trim(), scadenza: giorno || undefined, area: 'casa', priorita: 'nessuna' })
    setTesto(''); setGiorno('')
  }
  return (
    <section className="sezione-casa">
      <div className="testa-sezione-casa">
        <h2 className="titolo-sezione">Cose da gestire</h2>
        <a className="link piccolo" href="#/task">anche in Task ›</a>
      </div>
      <div className="lista">
        {elenco.map((c) => (
          <div key={c.id} className={`riga${c.completataIl ? ' conclusa' : ''}`} style={{ cursor: 'default' }}>
            <input type="checkbox" checked={Boolean(c.completataIl)} aria-label="Fatto" onChange={(e) => void salva('attivita', { ...c, completataIl: e.target.checked ? Date.now() : undefined })}
              style={{ width: 20, height: 20, accentColor: 'var(--primario)', flexShrink: 0 }} />
            <span className="crescente" style={{ textDecoration: c.completataIl ? 'line-through' : undefined }}>{c.titolo}</span>
            {c.scadenza && <span className="piccolo" style={{ color: !c.completataIl && c.scadenza < oggiChiave ? 'var(--pericolo)' : 'var(--testo-2)' }}>{dataBreve(c.scadenza)}</span>}
            <button type="button" className="elimina-task" aria-label={`Elimina ${c.titolo}`}
              onClick={() => void elimina('attivita', c.id).then(() => mostraAvviso('Eliminato', () => void ripristina('attivita', c.id)))}>×</button>
          </div>
        ))}
      </div>
      <div className="aggiunta-veloce aggiunta-casa">
        <input value={testo} placeholder="es. Chiamare il landlord per la caldaia" aria-label="Nuova cosa da gestire"
          onChange={(e) => setTesto(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void aggiungi() }} />
        <label className="data-casa">
          <span className="secondario piccolo">Entro il</span>
          <input type="date" value={giorno} onChange={(e) => setGiorno(e.target.value)} aria-label="Entro il (facoltativo)" />
        </label>
        <button type="button" className="pulsante primario" disabled={!testo.trim()} onClick={() => void aggiungi()}>Aggiungi</button>
      </div>
    </section>
  )
}

/** Cose da fare per la partenza: si spuntano, si tolgono con la ×, se ne aggiungono altre. */
function ListaUscita({ s }: { s: Stanza }) {
  const [nuova, setNuova] = useState('')
  const voci: { voce: string; fatto?: boolean }[] = s.uscita ?? VOCI_USCITA.map((voce) => ({ voce }))
  const salvaVoci = (v: { voce: string; fatto?: boolean }[]) => salva('stanze', { ...s, uscita: v })
  return (
    <span className="lista-uscita" onClick={(e) => e.stopPropagation()}>
      {voci.map((v, i) => (
        <span key={`${v.voce}-${i}`} className={`voce-uscita${v.fatto ? ' fatta' : ''}`}>
          <input type="checkbox" checked={Boolean(v.fatto)} aria-label={v.voce} onChange={(e) => void salvaVoci(voci.map((x, j) => (j === i ? { ...x, fatto: e.target.checked || undefined } : x)))} />
          <span className="crescente">{v.voce}</span>
          <button type="button" className="elimina-task" aria-label={`Togli ${v.voce}`} onClick={() => void salvaVoci(voci.filter((_, j) => j !== i))}>×</button>
        </span>
      ))}
      <input className="data-piccola" value={nuova} placeholder="+ altra cosa da fare (Invio)" onChange={(e) => setNuova(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && nuova.trim()) { void salvaVoci([...voci, { voce: nuova.trim() }]); setNuova('') } }} />
      <span className="secondario piccolo">{voci.filter((v) => v.fatto).length} di {voci.length} fatte</span>
    </span>
  )
}

/* Fogli di modifica */

const Salva = ({ valido, onClick }: { valido: boolean; onClick: () => void }) => (
  <button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={onClick}>Salva</button>
)
const campoImporto = (v: string, set: (v: string) => void, etichetta: string, esempio: string) => (
  <Campo etichetta={`${etichetta} (${F.simboloValuta()})`}><input inputMode="decimal" value={v} placeholder={esempio} onChange={(e) => set(e.target.value)} /></Campo>
)

function FormCasa({ casa, stanze, onChiudi }: { casa: Omit<DatiCasa, 'creatoIl' | 'modificatoIl'>; stanze: Stanza[]; onChiudi: () => void }) {
  const [b, setB] = useState({ totale: testoDaCentesimi(casa.affittoTotaleCent || undefined), quota: testoDaCentesimi(casa.quotaBolletteCent), giorno: String(casa.giornoAffitto ?? 1) })
  const totale = centesimiDaTesto(b.totale), quota = centesimiDaTesto(b.quota)
  const valido = typeof totale === 'number' && typeof quota === 'number'
  const resto = typeof totale === 'number' ? quotaPropria({ affittoTotaleCent: totale }, stanze) : undefined
  async function conferma() {
    if (typeof totale !== 'number' || typeof quota !== 'number') return
    const giorno = Math.min(31, Math.max(1, Number(b.giorno) || 1))
    await salva('casa', { ...casa, id: 'casa', affittoTotaleCent: totale, quotaBolletteCent: quota, giornoAffitto: giorno })
    onChiudi()
  }
  return (
    <Foglio aperto titolo="Affitto e bills" onChiudi={onChiudi} azione={<Salva valido={valido} onClick={() => void conferma()} />}>
      <div className="modulo">
        {campoImporto(b.totale, (v) => setB({ ...b, totale: v }), 'Affitto totale al proprietario', 'es. 2550')}
        {resto !== undefined && <span className="secondario piccolo">La tua stanza: {F.importo(resto)} (il resto dopo le stanze delle coinquiline).</span>}
        <div className="campi-affiancati">
          {campoImporto(b.quota, (v) => setB({ ...b, quota: v }), 'Ognuna ti dà per le bills', 'es. 150')}
          <Campo etichetta="Giorno dell'affitto"><input inputMode="numeric" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
        </div>
        {((b.totale.trim() && totale === null) || (b.quota.trim() && quota === null)) && <Avviso>Scrivi gli importi come 2550 oppure 2550,50.</Avviso>}
      </div>
    </Foglio>
  )
}

function FormStanza({ s, quotaPropriaCent, numero, onChiudi }: { s?: Stanza; quotaPropriaCent: number; numero: number; onChiudi: () => void }) {
  const [b, setB] = useState({ nome: s?.nome ?? '', affitto: testoDaCentesimi(s?.affittoCent || undefined), colore: s?.colore ?? COLORI_STANZA[numero % COLORI_STANZA.length]!, dal: s?.dal ?? '' })
  const affitto = centesimiDaTesto(b.affitto)
  const valido = s?.propria ? true : b.nome.trim() !== '' && typeof affitto === 'number'
  async function conferma() {
    if (!valido) return
    await salva('stanze', { ...s, nome: b.nome.trim(), affittoCent: s?.propria ? 0 : (affitto as number), colore: b.colore, ordine: s?.ordine ?? numero, dal: b.dal || undefined })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={s?.propria ? 'La tua stanza' : s ? 'Stanza' : 'Nuova stanza'} onChiudi={onChiudi} azione={<Salva valido={valido} onClick={() => void conferma()} />}>
      <div className="modulo">
        <Campo etichetta={s?.propria ? 'Nome (facoltativo)' : 'Chi ci abita'}><input value={b.nome} placeholder={s?.propria ? 'La tua stanza' : 'Nome'} onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
        {s?.propria
          ? <span className="secondario piccolo">La tua stanza costa il resto dell'affitto: {F.importo(quotaPropriaCent)}. L'affitto totale si cambia con l'ingranaggio in alto.</span>
          : campoImporto(b.affitto, (v) => setB({ ...b, affitto: v }), 'Affitto della stanza', 'es. 850')}
        {!s?.propria && <Campo etichetta="Abita qui dal (facoltativo)"><input type="date" value={b.dal} onChange={(e) => setB({ ...b, dal: e.target.value })} /></Campo>}
        {b.affitto.trim() !== '' && affitto === null && <Avviso>Scrivi l'importo come 850 oppure 850,50.</Avviso>}
        <span className="secondario piccolo">Colore del nome</span>
        <div className="riga-azioni">
          {COLORI_STANZA.map((c) => <button key={c} type="button" className="campione-colore" aria-label={`Colore ${c}`} aria-pressed={b.colore === c} style={{ background: c }} onClick={() => setB({ ...b, colore: c })} />)}
        </div>
        {s && !s.propria && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('stanze', s.id).then(() => { onChiudi(); mostraAvviso('Stanza eliminata', () => void ripristina('stanze', s.id)) })}>Elimina la stanza</button>
        )}
      </div>
    </Foglio>
  )
}

function FormBolletta({ b: bolletta, importoMese, mese, pagamento, numero, onChiudi }: {
  b?: Bolletta; importoMese?: number; mese: string; pagamento?: PagamentoCasa; numero: number; onChiudi: () => void
}) {
  const [b, setB] = useState({
    nome: bolletta?.nome ?? '', abituale: testoDaCentesimi(bolletta?.importoCent || undefined), delMese: testoDaCentesimi(importoMese || undefined),
    giorno: String(bolletta?.giorno ?? 1), icona: bolletta?.icona ?? 'altro', colore: bolletta?.colore ?? COLORI_BOLLETTA[numero % COLORI_BOLLETTA.length]![0],
  })
  const abituale = b.abituale.trim() ? centesimiDaTesto(b.abituale) : 0
  const delMese = b.delMese.trim() ? centesimiDaTesto(b.delMese) : undefined
  const valido = b.nome.trim() !== '' && typeof abituale === 'number' && delMese !== null
  async function conferma() {
    if (!valido || typeof abituale !== 'number') return
    const salvata = await salva('bollette', {
      ...bolletta, nome: b.nome.trim(), importoCent: abituale, giorno: Math.min(31, Math.max(1, Number(b.giorno) || 1)), icona: b.icona, colore: b.colore, ordine: bolletta?.ordine ?? numero,
    })
    // L'importo del mese si salva solo se diverso da quello abituale.
    const id = idPagamento('bolletta', salvata.id, mese)
    const importoCent = typeof delMese === 'number' && delMese !== abituale ? delMese : undefined
    if (pagamento || importoCent !== undefined) await salva('pagamentiCasa', { ...pagamento, id, tipo: 'bolletta', riferimentoId: salvata.id, mese, importoCent })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={bolletta ? b.nome || 'Bill' : 'Nuova bill'} onChiudi={onChiudi} azione={<Salva valido={valido} onClick={() => void conferma()} />}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={b.nome} placeholder="es. TV licence" onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
        <div className="campi-affiancati">
          {campoImporto(b.abituale, (v) => setB({ ...b, abituale: v }), 'Importo di ogni mese', 'es. 40')}
          {bolletta && campoImporto(b.delMese, (v) => setB({ ...b, delMese: v }), `Solo ${nomeMese(mese)}`, 'se diverso')}
        </div>
        <Campo etichetta="Scade ogni mese il giorno"><input inputMode="numeric" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
        {(abituale === null || delMese === null) && <Avviso>Scrivi l'importo come 40 oppure 40,50.</Avviso>}
        <span className="secondario piccolo">Icona</span>
        <div className="riga-azioni">
          {Object.entries(ICONE_BOLLETTA).map(([k, C]) => (
            <button key={k} type="button" className={`pillola${b.icona === k ? ' filtro-attivo' : ''}`} aria-label={TITOLI_ICONA[k]} title={TITOLI_ICONA[k]} onClick={() => setB({ ...b, icona: k })}><C dimensione={16} /></button>
          ))}
        </div>
        <span className="secondario piccolo">Colore del riquadro</span>
        <div className="riga-azioni">
          {COLORI_BOLLETTA.map(([c]) => <button key={c} type="button" className="campione-colore" aria-label={`Colore ${c}`} aria-pressed={b.colore === c} style={{ background: c }} onClick={() => setB({ ...b, colore: c })} />)}
        </div>
      </div>
    </Foglio>
  )
}

function FormPartenza({ s, stanze, onChiudi }: { s?: Stanza; stanze: Stanza[]; onChiudi: () => void }) {
  const [b, setB] = useState({ stanzaId: s?.id ?? stanze.find((x) => !x.esceIl)?.id ?? stanze[0]?.id ?? '', esceIl: s?.esceIl ?? '', preavvisoIl: s?.preavvisoIl ?? '' })
  const stanza = stanze.find((x) => x.id === b.stanzaId)
  const valido = Boolean(stanza) && Boolean(giornoDaChiave(b.esceIl)) && (!b.preavvisoIl || b.preavvisoIl <= b.esceIl)
  async function conferma() {
    if (!valido || !stanza) return
    await salva('stanze', { ...stanza, esceIl: b.esceIl, preavvisoIl: b.preavvisoIl || undefined, uscita: stanza.uscita ?? VOCI_USCITA.map((voce) => ({ voce })) })
    onChiudi()
  }
  return (
    <Foglio aperto titolo="Partenza" onChiudi={onChiudi} azione={<Salva valido={valido} onClick={() => void conferma()} />}>
      <div className="modulo">
        <Campo etichetta="Chi se ne va">
          <select value={b.stanzaId} onChange={(e) => setB({ ...b, stanzaId: e.target.value })}>
            {stanze.map((x) => <option key={x.id} value={x.id}>{x.nome || 'Senza nome'} · {F.importo(x.affittoCent)}</option>)}
          </select>
        </Campo>
        <div className="campi-affiancati">
          <Campo etichetta="Esce il"><input type="date" value={b.esceIl} onChange={(e) => setB({ ...b, esceIl: e.target.value })} /></Campo>
          <Campo etichetta="Preavviso dato il (facoltativo)"><input type="date" value={b.preavvisoIl} onChange={(e) => setB({ ...b, preavvisoIl: e.target.value })} /></Campo>
        </div>
        {b.esceIl && b.preavvisoIl > b.esceIl && <Avviso>Il preavviso deve venire prima della partenza.</Avviso>}
        {b.esceIl && <span className="secondario piccolo">La stanza sarà libera dal {dataBreve(giornoDopo(b.esceIl))}. La partenza compare anche in Agenda.</span>}
      </div>
    </Foglio>
  )
}

function FormCandidata({ c, stanze, predefinita, onChiudi }: { c?: Candidata; stanze: Stanza[]; predefinita?: string; onChiudi: () => void }) {
  const [b, setB] = useState({
    nome: c?.nome ?? '', generalita: c?.generalita ?? '', viewing: perCampo(c?.viewing), valutazione: valutazioneDa(c?.valutazione), stato: statoCandidataDa(c?.stato),
    stanzaId: c?.stanzaId ?? predefinita ?? '',
  })
  const valido = b.nome.trim() !== ''
  async function conferma() {
    if (!valido) return
    const viewing = daCampo(b.viewing)
    // Con la viewing fissata, lo stato avanza da solo (se era ancora indietro).
    const stato = viewing && STATI_CANDIDATA.indexOf(b.stato) < STATI_CANDIDATA.indexOf('fissata') && !c?.viewing ? 'fissata' : b.stato
    await salva('candidate', { ...c, nome: b.nome.trim(), generalita: b.generalita.trim() || undefined, viewing, valutazione: b.valutazione, stato, stanzaId: b.stanzaId || undefined })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={c ? c.nome : 'Nuova candidata'} onChiudi={onChiudi} azione={<Salva valido={valido} onClick={() => void conferma()} />}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={b.nome} onChange={(e) => setB({ ...b, nome: e.target.value })} /></Campo>
        <Campo etichetta="Generalità"><textarea value={b.generalita} placeholder="età, lavoro, da dove viene, abitudini…" onChange={(e) => setB({ ...b, generalita: e.target.value })} /></Campo>
        <NotaPrivacy />
        <div className="campi-affiancati">
          <Campo etichetta="Viewing"><input type="datetime-local" value={b.viewing} onChange={(e) => setB({ ...b, viewing: e.target.value })} /></Campo>
          {stanze.length > 1 && (
            <Campo etichetta="Per la stanza">
              <select value={b.stanzaId} onChange={(e) => setB({ ...b, stanzaId: e.target.value })}>
                <option value="">—</option>
                {stanze.map((x) => <option key={x.id} value={x.id}>{F.importo(x.affittoCent)} · ora di {x.nome || 'nessuna'}</option>)}
              </select>
            </Campo>
          )}
        </div>
        <span className="secondario piccolo">Com'è andata</span>
        <div className="riga-azioni">
          {VALUTAZIONI.map((v) => (
            <button key={v} type="button" className="etichetta-valutazione" aria-pressed={b.valutazione === v}
              style={{ background: COLORI_VALUTAZIONE[v]![0], color: COLORI_VALUTAZIONE[v]![1], outline: b.valutazione === v ? `2px solid ${COLORI_VALUTAZIONE[v]![1]}` : 'none' }}
              onClick={() => setB({ ...b, valutazione: v })}>{TITOLI_VALUTAZIONE[v]}</button>
          ))}
        </div>
        <span className="secondario piccolo">A che punto siete</span>
        <div className="segmenti">
          {STATI_CANDIDATA.map((s) => <button key={s} type="button" className={b.stato === s ? 'attivo' : ''} onClick={() => setB({ ...b, stato: s })}>{TITOLI_STATO_CANDIDATA[s]}</button>)}
        </div>
        <span className="secondario piccolo">La viewing compare anche in Agenda.</span>
      </div>
    </Foglio>
  )
}

/** Candidata scelta: diventa la prossima coinquilina della stanza, dal giorno dell'arrivo. */
function FormScegli({ c, stanze, oggiChiave, onChiudi }: { c: Candidata; stanze: Stanza[]; oggiChiave: string; onChiudi: () => void }) {
  const iniziale = stanze.find((s) => s.id === c.stanzaId) ?? stanze.find((s) => s.esceIl && !s.prossima) ?? stanze[0]
  const [b, setB] = useState({ stanzaId: iniziale?.id ?? '', dal: iniziale?.esceIl ? giornoDopo(iniziale.esceIl) : oggiChiave })
  const stanza = stanze.find((s) => s.id === b.stanzaId)
  const valido = Boolean(stanza) && Boolean(giornoDaChiave(b.dal))
  async function conferma() {
    if (!valido || !stanza) return
    const primaStanza = stanza, primaCandidata = c
    await salva('stanze', { ...stanza, prossima: { nome: c.nome, dal: b.dal, candidataId: c.id } })
    await salva('candidate', { ...c, scelta: true, stanzaId: stanza.id })
    onChiudi()
    mostraAvviso(`${c.nome} arriva il ${dataBreve(b.dal)}`, () => { void salva('stanze', primaStanza); void salva('candidate', primaCandidata) })
  }
  return (
    <Foglio aperto titolo={`Scegli ${c.nome}`} onChiudi={onChiudi} azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Conferma</button>}>
      <div className="modulo">
        <Campo etichetta="Stanza">
          <select value={b.stanzaId} onChange={(e) => { const s = stanze.find((x) => x.id === e.target.value); setB({ stanzaId: e.target.value, dal: s?.esceIl ? giornoDopo(s.esceIl) : b.dal }) }}>
            {stanze.map((x) => <option key={x.id} value={x.id}>{F.importo(x.affittoCent)} · ora di {x.nome || 'nessuna'}</option>)}
          </select>
        </Campo>
        <Campo etichetta="Arriva il"><input type="date" value={b.dal} onChange={(e) => setB({ ...b, dal: e.target.value })} /></Campo>
        <span className="secondario piccolo">Da quel giorno la stanza passa a {c.nome}, con lo stesso affitto (lo puoi cambiare toccando il nome). L'arrivo compare anche in Agenda.</span>
      </div>
    </Foglio>
  )
}

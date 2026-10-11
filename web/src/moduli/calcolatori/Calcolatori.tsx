import { useState, type ReactNode } from 'react'
import { istante } from '../../nucleo/calendario'
import * as F from '../../nucleo/formati'
import { Campo } from '../../interfaccia/componenti'
import { chiaveGiorno, giornoDaChiave, oggi } from '../turni/supporto'
import * as C from './formule'

interface Voce { id: string; titolo: string; descrizione: string; gruppo: 'Ostetricia' | 'Sala parto' | 'Ginecologia' | 'Generale'; vista: () => ReactNode }

const CALCOLATORI: Voce[] = [
  { id: 'datazione', titolo: 'Età gestazionale e DPP', descrizione: 'Da ultima mestruazione, CRL o biometria; ridatazione', gruppo: 'Ostetricia', vista: () => <Datazione /> },
  { id: 'peso', titolo: 'Peso fetale stimato', descrizione: 'Hadlock (BPD, HC, AC, FL) e percentile', gruppo: 'Ostetricia', vista: () => <PesoFetale /> },
  { id: 'liquido', titolo: 'Liquido amniotico', descrizione: 'AFI e falda massima', gruppo: 'Ostetricia', vista: () => <Liquido /> },
  { id: 'tev', titolo: 'Rischio tromboembolico', descrizione: 'RCOG Green-top 37a, prima e dopo il parto', gruppo: 'Ostetricia', vista: () => <Tev /> },
  { id: 'peso-gravidanza', titolo: 'BMI e aumento di peso', descrizione: 'Aumento raccomandato in gravidanza (IOM 2009)', gruppo: 'Ostetricia', vista: () => <Bmi /> },
  { id: 'bishop', titolo: 'Punteggio di Bishop', descrizione: 'Favorevolezza della cervice', gruppo: 'Sala parto', vista: () => <Bishop /> },
  { id: 'apgar', titolo: 'Apgar', descrizione: 'Neonato a 1, 5 e 10 minuti', gruppo: 'Sala parto', vista: () => <Apgar /> },
  { id: 'robson', titolo: 'Classificazione di Robson', descrizione: 'I 10 gruppi per i tagli cesarei', gruppo: 'Sala parto', vista: () => <Robson /> },
  { id: 'shock', titolo: 'Shock index', descrizione: 'Emorragia post-partum: gravità e perdita stimata', gruppo: 'Sala parto', vista: () => <Shock /> },
  { id: 'rmi', titolo: 'RMI', descrizione: 'Rischio di malignità delle masse annessiali', gruppo: 'Ginecologia', vista: () => <Rmi /> },
  { id: 'hcg', titolo: 'β-hCG', descrizione: 'Tempo di raddoppio e variazione a 48 ore', gruppo: 'Ginecologia', vista: () => <Hcg /> },
]
const GRUPPI = ['Ostetricia', 'Sala parto', 'Ginecologia'] as const

/** Elenco dei calcolatori oppure, se c'è `id`, il calcolatore scelto. */
export function Calcolatori({ id }: { id?: string }) {
  const scelto = CALCOLATORI.find((c) => c.id === id)
  if (scelto) {
    return (
      <div className="schermata" style={{ maxWidth: 720 }}>
        <header>
          <a href="#/specializzazione/calcolatori" className="piccolo">‹ Calcolatori</a>
          <h1 className="titolo-grande">{scelto.titolo}</h1>
        </header>
        {scelto.vista()}
        <AvvisoClinico />
      </div>
    )
  }
  return (
    <div className="schermata" style={{ maxWidth: 820 }}>
      <header>
        <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
        <h1 className="titolo-grande">Calcolatori</h1>
      </header>
      {GRUPPI.map((g) => (
        <section key={g} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="titolo-sezione">{g}</h2>
          <div className="lista">
            {CALCOLATORI.filter((c) => c.gruppo === g).map((c) => (
              <a key={c.id} className="riga" href={`#/specializzazione/calcolatori/${c.id}`}>
                <span className="crescente">
                  <span style={{ fontWeight: 600 }}>{c.titolo}</span>
                  <span className="secondario piccolo">{c.descrizione}</span>
                </span>
                <span className="secondario">›</span>
              </a>
            ))}
          </div>
        </section>
      ))}
      <AvvisoClinico />
    </div>
  )
}

function AvvisoClinico() {
  return <p className="nota-privacy">Strumenti di supporto: non sostituiscono il giudizio clinico né i protocolli del tuo reparto. Nessun dato viene salvato.</p>
}

/* Pezzi comuni */

/** Legge un numero scritto con la virgola o con il punto; undefined se vuoto o non valido. */
function numero(testo: string): number | undefined {
  const t = testo.trim().replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}
const fmt = (n: number, decimali = 1) => n.toLocaleString('it-IT', { maximumFractionDigits: decimali })
const dataEstesa = (giorno: string) => {
  const g = giornoDaChiave(giorno)
  return g ? F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12)) : giorno
}

function Numero({ etichetta, valore, onCambia, unita, placeholder }: { etichetta: string; valore: string; onCambia: (v: string) => void; unita?: string; placeholder?: string }) {
  return (
    <Campo etichetta={unita ? `${etichetta} (${unita})` : etichetta}>
      <input inputMode="decimal" value={valore} placeholder={placeholder} onChange={(e) => onCambia(e.target.value)}
        aria-invalid={valore.trim() !== '' && numero(valore) === undefined} />
    </Campo>
  )
}

function Segmenti<T extends string>({ valore, opzioni, onCambia }: { valore: T; opzioni: { id: T; titolo: string }[]; onCambia: (v: T) => void }) {
  return (
    <div className="segmenti" role="radiogroup">
      {opzioni.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={valore === o.id} className={valore === o.id ? 'attivo' : ''} onClick={() => onCambia(o.id)}>{o.titolo}</button>
      ))}
    </div>
  )
}

/** Come Campo, ma senza <label>: un clic sul titolo non deve premere il primo pulsante. */
function Gruppo({ etichetta, children }: { etichetta: string; children: ReactNode }) {
  return <div className="campo"><span>{etichetta}</span>{children}</div>
}

function Risultato({ titolo, valore, dettaglio, tono }: { titolo: string; valore: ReactNode; dettaglio?: ReactNode; tono?: 'ok' | 'attenzione' | 'allarme' }) {
  return (
    <div className={`risultato${tono ? ` ${tono}` : ''}`}>
      <span className="secondario piccolo">{titolo}</span>
      <span className="valore">{valore}</span>
      {dettaglio && <span className="piccolo">{dettaglio}</span>}
    </div>
  )
}

function Fonte({ children }: { children: ReactNode }) {
  return <p className="secondario piccolo" style={{ margin: 0 }}><strong>Formula e fonte.</strong> {children}</p>
}

function Vuoto({ testo = 'Inserisci i valori per vedere il risultato.' }: { testo?: string }) {
  return <div className="vuoto piccolo">{testo}</div>
}

/** Punteggio scelto da un menu di opzioni (Bishop, Apgar). */
function Punteggio({ etichetta, valore, opzioni, onCambia }: { etichetta: string; valore: number; opzioni: string[]; onCambia: (v: number) => void }) {
  return (
    <Campo etichetta={etichetta}>
      <select value={valore} onChange={(e) => onCambia(Number(e.target.value))}>
        {opzioni.map((o, i) => <option key={o} value={i}>{i} · {o}</option>)}
      </select>
    </Campo>
  )
}

/* 1. Datazione */

function Datazione() {
  const [metodo, setMetodo] = useState<'um' | 'crl' | 'biometria'>('um')
  const [um, setUm] = useState('')
  const [ciclo, setCiclo] = useState('28')
  const [giornoEco, setGiornoEco] = useState(chiaveGiorno(oggi()))
  const [crl, setCrl] = useState('')
  const [bio, setBio] = useState({ bpd: '', hc: '', ac: '', fl: '' })
  const oggiChiave = chiaveGiorno(oggi())
  const umValida = !!giornoDaChiave(um)
  const durata = numero(ciclo) ?? 28

  const daUm = umValida ? C.daUltimaMestruazione(um, oggiChiave, durata) : undefined
  let egEco: C.EtaGestazionale | undefined
  if (metodo === 'crl' && numero(crl)) egEco = C.egDaCrl(numero(crl)!)
  if (metodo === 'biometria') {
    const [b, h, a, f] = [bio.bpd, bio.hc, bio.ac, bio.fl].map(numero)
    if (b && h && a && f) egEco = C.egDaBiometria(b, h, a, f)
  }
  const ecoValida = !!giornoDaChiave(giornoEco)
  const crlFuori = metodo === 'crl' && numero(crl) !== undefined && (numero(crl)! < 10 || numero(crl)! > 84)
  const egUmAllEco = umValida && ecoValida ? C.daUltimaMestruazione(um, giornoEco, durata).eg : undefined
  const confronto = egEco && egUmAllEco ? C.ridatazione(egUmAllEco.giorni, egEco.giorni) : undefined
  const egOggiDaEco = egEco && ecoValida ? C.eg(egEco.giorni + C.giorniTra(giornoEco, oggiChiave)) : undefined

  return (
    <>
      <Segmenti valore={metodo} onCambia={setMetodo} opzioni={[{ id: 'um', titolo: 'Ultima mestruazione' }, { id: 'crl', titolo: 'CRL' }, { id: 'biometria', titolo: 'Biometria' }]} />
      <div className="scheda modulo">
        <div className="campi-affiancati">
          <Campo etichetta={metodo === 'um' ? 'Primo giorno ultima mestruazione' : 'Ultima mestruazione (per confronto)'}>
            <input type="date" value={um} onChange={(e) => setUm(e.target.value)} />
          </Campo>
          <Numero etichetta="Durata del ciclo" unita="giorni" valore={ciclo} onCambia={setCiclo} />
        </div>
        {metodo !== 'um' && (
          <div className="campi-affiancati">
            <Campo etichetta="Giorno dell'ecografia"><input type="date" value={giornoEco} onChange={(e) => setGiornoEco(e.target.value)} /></Campo>
            {metodo === 'crl' && <Numero etichetta="CRL" unita="mm" valore={crl} onCambia={setCrl} placeholder="es. 45" />}
          </div>
        )}
        {metodo === 'biometria' && (
          <div className="campi-affiancati">
            <Numero etichetta="BPD" unita="cm" valore={bio.bpd} onCambia={(v) => setBio({ ...bio, bpd: v })} />
            <Numero etichetta="HC" unita="cm" valore={bio.hc} onCambia={(v) => setBio({ ...bio, hc: v })} />
            <Numero etichetta="AC" unita="cm" valore={bio.ac} onCambia={(v) => setBio({ ...bio, ac: v })} />
            <Numero etichetta="FL" unita="cm" valore={bio.fl} onCambia={(v) => setBio({ ...bio, fl: v })} />
          </div>
        )}
      </div>

      <div className="risultati">
        {metodo === 'um' && (daUm ? (
          <>
            <Risultato titolo="Età gestazionale oggi" valore={daUm.eg.giorni >= 0 ? `${daUm.eg.testo} sett.` : '—'} />
            <Risultato titolo="Data presunta del parto" valore={dataEstesa(daUm.dpp)} dettaglio={durata !== 28 ? `Corretta per ciclo di ${fmt(durata, 0)} giorni` : undefined} />
          </>
        ) : <Vuoto />)}
        {metodo !== 'um' && (egEco && ecoValida ? (
          <>
            <Risultato titolo="Età gestazionale all'ecografia" valore={`${egEco.testo} sett.`} tono={crlFuori ? 'attenzione' : undefined}
              dettaglio={crlFuori ? 'Formula valida per CRL tra 10 e 84 mm' : undefined} />
            {egOggiDaEco && giornoEco !== oggiChiave && <Risultato titolo="Età gestazionale oggi" valore={`${egOggiDaEco.testo} sett.`} />}
            <Risultato titolo="DPP secondo l'ecografia" valore={dataEstesa(C.dppDaEg(giornoEco, egEco.giorni))} />
            {confronto && egUmAllEco && (
              <Risultato titolo="Confronto con l'ultima mestruazione" tono={confronto.ridatare ? 'attenzione' : 'ok'}
                valore={confronto.ridatare ? 'Ridatare sull\'ecografia' : 'Tenere la datazione da UM'}
                dettaglio={`Da UM: ${egUmAllEco.testo}. Differenza ${confronto.differenza} giorni, soglia ${confronto.soglia} giorni a questa epoca.`} />
            )}
          </>
        ) : <Vuoto />)}
      </div>

      <Fonte>
        UM: regola di Naegele, DPP = UM + 280 giorni + (durata del ciclo − 28).
        CRL: Robinson e Fleming 1975 (EG in giorni = 8,052 × √(1,037 × CRL mm) + 23,73), valida 10–84 mm.
        Biometria: Hadlock 1984 (EG sett. = 10,85 + 0,060 × HC × FL + 0,67 × BPD + 0,168 × AC).
        Ridatazione: ACOG Committee Opinion 700 (2017), soglie 5 giorni fino a 8+6, 7 fino a 15+6, 10 fino a 21+6, 14 fino a 27+6, 21 oltre.
      </Fonte>
    </>
  )
}

/* 2. Peso fetale */

function PesoFetale() {
  const [v, setV] = useState({ bpd: '', hc: '', ac: '', fl: '', sett: '', giorni: '0' })
  const [b, h, a, f] = [v.bpd, v.hc, v.ac, v.fl].map(numero)
  const peso = b && h && a && f ? C.pesoHadlock(b, h, a, f) : undefined
  const settimane = numero(v.sett)
  const eg = settimane !== undefined ? settimane + (numero(v.giorni) ?? 0) / 7 : undefined
  const percentile = peso && eg && eg >= 20 && eg <= 42 ? C.percentilePeso(peso, eg) : undefined
  return (
    <>
      <div className="scheda modulo">
        <div className="campi-affiancati">
          <Numero etichetta="BPD" unita="cm" valore={v.bpd} onCambia={(x) => setV({ ...v, bpd: x })} />
          <Numero etichetta="HC" unita="cm" valore={v.hc} onCambia={(x) => setV({ ...v, hc: x })} />
          <Numero etichetta="AC" unita="cm" valore={v.ac} onCambia={(x) => setV({ ...v, ac: x })} />
          <Numero etichetta="FL" unita="cm" valore={v.fl} onCambia={(x) => setV({ ...v, fl: x })} />
        </div>
        <div className="campi-affiancati">
          <Numero etichetta="Età gestazionale" unita="settimane" valore={v.sett} onCambia={(x) => setV({ ...v, sett: x })} placeholder="es. 34" />
          <Numero etichetta="+ giorni" valore={v.giorni} onCambia={(x) => setV({ ...v, giorni: x })} />
        </div>
      </div>
      <div className="risultati">
        {peso ? (
          <>
            <Risultato titolo="Peso fetale stimato" valore={`${peso.toLocaleString('it-IT')} g`} dettaglio="Errore atteso circa ± 15%" />
            {percentile !== undefined && (
              <Risultato titolo="Percentile (orientativo)" valore={`${fmt(percentile)}°`}
                tono={percentile < 10 || percentile > 90 ? 'attenzione' : 'ok'}
                dettaglio={`${percentile < 3 ? 'Sotto il 3° percentile' : percentile < 10 ? 'Piccolo per l\'epoca (< 10°)' : percentile > 90 ? 'Grande per l\'epoca (> 90°)' : 'Nella norma'} · peso medio a quest'epoca ${Math.round(C.pesoMedioHadlock(eg!)).toLocaleString('it-IT')} g`} />
            )}
          </>
        ) : <Vuoto />}
      </div>
      <Fonte>
        Hadlock 1985: log₁₀ peso = 1,3596 − 0,00386 × AC × FL + 0,0064 × HC + 0,00061 × BPD × AC + 0,0424 × AC + 0,174 × FL (misure in cm).
        Percentile da Hadlock 1991 (ln peso medio = 0,578 + 0,332 × EG − 0,00354 × EG², DS ≈ 12,7%): orientativo, per decisioni cliniche usa le curve adottate dal tuo centro (es. INTERGROWTH-21st, OMS).
      </Fonte>
    </>
  )
}

/* 3. Liquido amniotico */

const TITOLO_LIQUIDO: Record<C.Liquido, string> = { oligoidramnios: 'Oligoidramnios', normale: 'Nella norma', polidramnios: 'Polidramnios' }

function Liquido() {
  const [metodo, setMetodo] = useState<'afi' | 'falda'>('afi')
  const [q, setQ] = useState(['', '', '', ''])
  const [falda, setFalda] = useState('')
  const valori = q.map(numero)
  const afi = valori.every((x) => x !== undefined) ? valori.reduce((s, x) => s! + x!, 0)! : undefined
  const mvp = numero(falda)
  const esito = metodo === 'afi' ? (afi !== undefined ? C.classificaAfi(afi) : undefined) : mvp !== undefined ? C.classificaFalda(mvp) : undefined
  return (
    <>
      <Segmenti valore={metodo} onCambia={setMetodo} opzioni={[{ id: 'afi', titolo: 'AFI (4 quadranti)' }, { id: 'falda', titolo: 'Falda massima' }]} />
      <div className="scheda modulo">
        {metodo === 'afi' ? (
          <div className="campi-affiancati">
            {['Superiore destro', 'Superiore sinistro', 'Inferiore destro', 'Inferiore sinistro'].map((t, i) => (
              <Numero key={t} etichetta={t} unita="cm" valore={q[i]!} onCambia={(x) => setQ(q.map((y, j) => (j === i ? x : y)))} />
            ))}
          </div>
        ) : <Numero etichetta="Falda verticale massima" unita="cm" valore={falda} onCambia={setFalda} />}
      </div>
      <div className="risultati">
        {esito ? (
          <Risultato titolo={metodo === 'afi' ? `AFI ${fmt(afi!)} cm` : `Falda ${fmt(mvp!)} cm`} valore={TITOLO_LIQUIDO[esito]} tono={esito === 'normale' ? 'ok' : 'attenzione'} />
        ) : <Vuoto />}
      </div>
      <Fonte>AFI: &lt; 5 cm oligoidramnios, 5–24,9 cm normale, ≥ 25 cm polidramnios. Falda massima: &lt; 2 cm oligoidramnios, 2–7,9 cm normale, ≥ 8 cm polidramnios (ACOG/SMFM; dopo 24 settimane la falda massima riduce le diagnosi di oligoidramnios senza peggiorare gli esiti).</Fonte>
    </>
  )
}

/* 4. Bishop */

function Bishop() {
  const [b, setB] = useState<C.Bishop>({ dilatazione: 0, cancellazione: 0, stazione: 0, consistenza: 0, posizione: 0 })
  const r = C.bishop(b)
  return (
    <>
      <div className="scheda modulo">
        <Punteggio etichetta="Dilatazione" valore={b.dilatazione} opzioni={['chiusa', '1–2 cm', '3–4 cm', '≥ 5 cm']} onCambia={(x) => setB({ ...b, dilatazione: x })} />
        <Punteggio etichetta="Raccorciamento" valore={b.cancellazione} opzioni={['0–30%', '40–50%', '60–70%', '≥ 80%']} onCambia={(x) => setB({ ...b, cancellazione: x })} />
        <Punteggio etichetta="Livello della parte presentata" valore={b.stazione} opzioni={['−3', '−2', '−1 / 0', '+1 / +2']} onCambia={(x) => setB({ ...b, stazione: x })} />
        <Punteggio etichetta="Consistenza" valore={b.consistenza} opzioni={['rigida', 'media', 'morbida']} onCambia={(x) => setB({ ...b, consistenza: x })} />
        <Punteggio etichetta="Posizione" valore={b.posizione} opzioni={['posteriore', 'intermedia', 'anteriore']} onCambia={(x) => setB({ ...b, posizione: x })} />
      </div>
      <div className="risultati">
        <Risultato titolo="Punteggio di Bishop" valore={`${r.totale} / 13`} dettaglio={r.giudizio} tono={r.totale >= 8 ? 'ok' : 'attenzione'} />
      </div>
      <Fonte>Bishop 1964. ≥ 8 cervice favorevole (probabilità di parto vaginale simile al travaglio spontaneo); ≤ 6 sfavorevole, in caso di induzione si considera la maturazione cervicale.</Fonte>
    </>
  )
}

/* 5. Apgar */

const APGAR = [
  { titolo: 'Frequenza cardiaca', opzioni: ['assente', '< 100/min', '≥ 100/min'] },
  { titolo: 'Respiro', opzioni: ['assente', 'debole, irregolare', 'pianto vigoroso'] },
  { titolo: 'Tono muscolare', opzioni: ['flaccido', 'flessione degli arti', 'movimenti attivi'] },
  { titolo: 'Riflessi (risposta alla stimolazione)', opzioni: ['nessuna', 'smorfia', 'pianto, tosse, starnuto'] },
  { titolo: 'Colorito', opzioni: ['cianotico o pallido', 'estremità cianotiche', 'roseo'] },
]

function Apgar() {
  const [v, setV] = useState([2, 2, 2, 2, 1])
  const r = C.apgar(v)
  return (
    <>
      <div className="scheda modulo">
        {APGAR.map((a, i) => <Punteggio key={a.titolo} etichetta={a.titolo} valore={v[i]!} opzioni={a.opzioni} onCambia={(x) => setV(v.map((y, j) => (j === i ? x : y)))} />)}
      </div>
      <div className="risultati">
        <Risultato titolo="Apgar" valore={`${r.totale} / 10`} dettaglio={r.giudizio} tono={r.totale >= 7 ? 'ok' : r.totale >= 4 ? 'attenzione' : 'allarme'} />
      </div>
      <Fonte>Apgar 1953; AAP/ACOG 2015: 7–10 rassicurante, 4–6 moderatamente anormale, 0–3 basso. Se a 5 minuti è &lt; 7, si ripete ogni 5 minuti fino a 20.</Fonte>
    </>
  )
}

/* 6. Robson */

function Robson() {
  const [d, setD] = useState<C.DatiRobson>({ parita: 'nullipara', tcPrecedente: false, feti: 'singolo', presentazione: 'cefalica', settimane: 39, travaglio: 'spontaneo' })
  const r = C.robson(d)
  return (
    <>
      <div className="scheda modulo">
        <Gruppo etichetta="Parità">
          <Segmenti valore={d.parita} onCambia={(x) => setD({ ...d, parita: x, tcPrecedente: x === 'nullipara' ? false : d.tcPrecedente })} opzioni={[{ id: 'nullipara', titolo: 'Nullipara' }, { id: 'multipara', titolo: 'Multipara' }]} />
        </Gruppo>
        {d.parita === 'multipara' && (
          <label className="interruttore"><span>Almeno un taglio cesareo precedente</span><input type="checkbox" checked={d.tcPrecedente} onChange={(e) => setD({ ...d, tcPrecedente: e.target.checked })} /></label>
        )}
        <Gruppo etichetta="Numero di feti">
          <Segmenti valore={d.feti} onCambia={(x) => setD({ ...d, feti: x })} opzioni={[{ id: 'singolo', titolo: 'Singolo' }, { id: 'multipli', titolo: 'Multipli' }]} />
        </Gruppo>
        <Gruppo etichetta="Presentazione">
          <Segmenti valore={d.presentazione} onCambia={(x) => setD({ ...d, presentazione: x })} opzioni={[{ id: 'cefalica', titolo: 'Cefalica' }, { id: 'podalica', titolo: 'Podalica' }, { id: 'trasversa', titolo: 'Trasversa/obliqua' }]} />
        </Gruppo>
        <Gruppo etichetta="Età gestazionale">
          <Segmenti valore={d.settimane >= 37 ? 'termine' : 'pretermine'} onCambia={(x) => setD({ ...d, settimane: x === 'termine' ? 39 : 34 })} opzioni={[{ id: 'termine', titolo: '≥ 37 settimane' }, { id: 'pretermine', titolo: '< 37 settimane' }]} />
        </Gruppo>
        <Gruppo etichetta="Inizio del travaglio">
          <Segmenti valore={d.travaglio} onCambia={(x) => setD({ ...d, travaglio: x })} opzioni={[{ id: 'spontaneo', titolo: 'Spontaneo' }, { id: 'indotto', titolo: 'Indotto' }, { id: 'tcPrimaDelTravaglio', titolo: 'TC prima del travaglio' }]} />
        </Gruppo>
      </div>
      <div className="risultati">
        <Risultato titolo="Gruppo di Robson" valore={`Gruppo ${r.gruppo}`} dettaglio={r.descrizione} />
      </div>
      <Fonte>Robson 2001; OMS, Robson Classification Implementation Manual 2017 (sottogruppi a = indotto, b = TC prima del travaglio).</Fonte>
    </>
  )
}

/* 7. Shock index */

function Shock() {
  const [fc, setFc] = useState('')
  const [pas, setPas] = useState('')
  const [peso, setPeso] = useState('')
  const f = numero(fc), p = numero(pas)
  const r = f && p ? C.shockIndex(f, p, numero(peso)) : undefined
  return (
    <>
      <div className="scheda modulo">
        <div className="campi-affiancati">
          <Numero etichetta="Frequenza cardiaca" unita="bpm" valore={fc} onCambia={setFc} />
          <Numero etichetta="Pressione sistolica" unita="mmHg" valore={pas} onCambia={setPas} />
          <Numero etichetta="Peso (facoltativo)" unita="kg" valore={peso} onCambia={setPeso} />
        </div>
      </div>
      <div className="risultati">
        {r ? (
          <>
            <Risultato titolo="Shock index" valore={fmt(r.si, 2)} tono={r.si >= 1.4 ? 'allarme' : r.allarme ? 'attenzione' : 'ok'}
              dettaglio={r.si >= 1.4 ? 'Molto elevato: probabile necessità di trasfusione e intervento urgente' : r.allarme ? 'Elevato (≥ 0,9): segno precoce di instabilità' : 'Nella norma in gravidanza (0,7–0,9)'} />
            <Risultato titolo="Perdita orientativa" valore={r.perditaTipica}
              dettaglio={`${r.grado}: ${r.percentuale[0]}–${r.percentuale[1]}% della volemia${r.stimaMl ? ` (≈ ${r.stimaMl[0].toLocaleString('it-IT')}–${r.stimaMl[1].toLocaleString('it-IT')} mL con il peso indicato)` : ''}`} />
          </>
        ) : <Vuoto />}
      </div>
      <Fonte>Shock index = frequenza cardiaca / pressione sistolica. Soglie ostetriche: ≥ 0,9 allarme, ≥ 1,4 grave (Nathan 2015, El Ayadi 2016). Perdita stimata dalle classi di Benedetti (volemia a termine ≈ 100 mL/kg): solo orientativa, i segni vitali compaiono tardi.</Fonte>
    </>
  )
}

/* 8. Rischio tromboembolico */

function Tev() {
  const [momento, setMomento] = useState<'antepartum' | 'postpartum'>('antepartum')
  const [scelti, setScelti] = useState<Set<string>>(new Set())
  const r = C.rischioTev(scelti, momento)
  const visibili = C.FATTORI_TEV.filter((f) => f.quando === 'sempre' || f.quando === momento)
  const cambia = (id: string, si: boolean) => {
    const n = new Set(scelti)
    if (si) n.add(id); else n.delete(id)
    setScelti(n)
  }
  return (
    <>
      <Segmenti valore={momento} onCambia={setMomento} opzioni={[{ id: 'antepartum', titolo: 'In gravidanza' }, { id: 'postpartum', titolo: 'Dopo il parto' }]} />
      <div className="risultati" style={{ position: 'sticky', top: 8, zIndex: 1 }}>
        <Risultato titolo="Punteggio" valore={`${r.punti} ${r.punti === 1 ? 'punto' : 'punti'}`} dettaglio={r.indicazione}
          tono={scelti.has('tevPrecedente') || (momento === 'antepartum' ? r.punti >= 3 : r.punti >= 2) ? 'attenzione' : 'ok'} />
      </div>
      <div className="lista">
        {visibili.map((f) => (
          <label key={f.id} className="riga" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={scelti.has(f.id)} onChange={(e) => cambia(f.id, e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0, accentColor: 'var(--primario)' }} />
            <span className="crescente">{f.testo}</span>
            <span className="numeri secondario" style={{ fontWeight: 600 }}>{f.punti}</span>
          </label>
        ))}
      </div>
      <Fonte>RCOG Green-top Guideline 37a (2015). In gravidanza: ≥ 4 punti EBPM dal primo trimestre, 3 punti dalla 28ª settimana. Dopo il parto: ≥ 2 punti EBPM per almeno 10 giorni. TEV precedente: alto rischio, consulenza specialistica. La guida completa considera anche altri fattori: in caso di dubbio consultala.</Fonte>
    </>
  )
}

/* 9. BMI */

function Bmi() {
  const [peso, setPeso] = useState('')
  const [altezza, setAltezza] = useState('')
  const [gemellare, setGemellare] = useState(false)
  const p = numero(peso), a = numero(altezza)
  const r = p && a ? C.bmi(p, a) : undefined
  const aumento = r ? C.aumentoPesoRaccomandato(r.valore, gemellare) : undefined
  return (
    <>
      <div className="scheda modulo">
        <div className="campi-affiancati">
          <Numero etichetta="Peso prima della gravidanza" unita="kg" valore={peso} onCambia={setPeso} />
          <Numero etichetta="Altezza" unita="cm" valore={altezza} onCambia={setAltezza} />
        </div>
        <label className="interruttore" style={{ borderBottom: 'none' }}><span>Gravidanza gemellare</span><input type="checkbox" checked={gemellare} onChange={(e) => setGemellare(e.target.checked)} /></label>
      </div>
      <div className="risultati">
        {r ? (
          <>
            <Risultato titolo="BMI" valore={fmt(r.valore)} dettaglio={r.classe} tono={r.classe === 'Normopeso' ? 'ok' : 'attenzione'} />
            <Risultato titolo="Aumento di peso raccomandato" valore={aumento ? `${fmt(aumento.minimo)}–${fmt(aumento.massimo)} kg` : 'Dati insufficienti'}
              dettaglio={aumento ? 'Su tutta la gravidanza' : 'Per le gemellari in sottopeso non ci sono raccomandazioni IOM'} />
          </>
        ) : <Vuoto />}
      </div>
      <Fonte>BMI = peso (kg) / altezza (m)². Classi OMS. Aumento raccomandato: Institute of Medicine 2009 (singola: sottopeso 12,5–18, normopeso 11,5–16, sovrappeso 7–11,5, obesità 5–9 kg; gemellare: 17–25, 14–23, 11–19 kg).</Fonte>
    </>
  )
}

/* 10. RMI */

const CARATTERISTICHE_RMI = ['Cisti multiloculare', 'Aree solide', 'Lesione bilaterale', 'Ascite', 'Metastasi addominali']

function Rmi() {
  const [eco, setEco] = useState<boolean[]>(CARATTERISTICHE_RMI.map(() => false))
  const [menopausa, setMenopausa] = useState(false)
  const [ca125, setCa125] = useState('')
  const ca = numero(ca125)
  const r = ca !== undefined ? C.rmi(eco.filter(Boolean).length, menopausa, ca) : undefined
  return (
    <>
      <div className="lista">
        {CARATTERISTICHE_RMI.map((t, i) => (
          <label key={t} className="riga" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={eco[i]} onChange={(e) => setEco(eco.map((x, j) => (j === i ? e.target.checked : x)))} style={{ width: 20, height: 20, accentColor: 'var(--primario)' }} />
            <span className="crescente">{t}</span>
          </label>
        ))}
      </div>
      <div className="scheda modulo">
        <label className="interruttore"><span>Postmenopausa</span><input type="checkbox" checked={menopausa} onChange={(e) => setMenopausa(e.target.checked)} /></label>
        <Numero etichetta="CA-125" unita="U/mL" valore={ca125} onCambia={setCa125} />
      </div>
      <div className="risultati">
        {r ? (
          <Risultato titolo={`RMI = U ${r.u} × M ${r.m} × CA-125`} valore={fmt(r.valore)} dettaglio={`Rischio ${r.rischio.toLowerCase()}`}
            tono={r.valore >= 200 ? 'allarme' : r.valore >= 25 ? 'attenzione' : 'ok'} />
        ) : <Vuoto testo="Inserisci il CA-125 per vedere il risultato." />}
      </div>
      <Fonte>RMI I (Jacobs 1990): U = 0 con nessuna caratteristica ecografica, 1 con una, 3 con due o più; M = 1 premenopausa, 3 postmenopausa. ≥ 200 alto rischio, invio a centro di ginecologia oncologica (RCOG GTG 34). Oggi si preferiscono IOTA Simple Rules o ADNEX quando disponibili.</Fonte>
    </>
  )
}

/* 11. β-hCG */

function Hcg() {
  const [primo, setPrimo] = useState('')
  const [secondo, setSecondo] = useState('')
  const [ore, setOre] = useState('48')
  const a = numero(primo), b = numero(secondo), h = numero(ore)
  const r = a && b && h ? C.betaHcg(a, b, h) : undefined
  return (
    <>
      <div className="scheda modulo">
        <div className="campi-affiancati">
          <Numero etichetta="Primo dosaggio" unita="mUI/mL" valore={primo} onCambia={setPrimo} />
          <Numero etichetta="Secondo dosaggio" unita="mUI/mL" valore={secondo} onCambia={setSecondo} />
          <Numero etichetta="Ore tra i due" valore={ore} onCambia={setOre} />
        </div>
      </div>
      <div className="risultati">
        {r ? (
          <>
            <Risultato titolo="Variazione in 48 ore" valore={`${r.variazione48 > 0 ? '+' : ''}${fmt(r.variazione48)}%`}
              tono={r.variazione48 >= 35 ? 'ok' : 'attenzione'}
              dettaglio={r.variazione48 >= 35 ? 'Compatibile con una gravidanza intrauterina in evoluzione' : r.variazione48 > 0 ? 'Aumento inferiore al minimo atteso (35%): da approfondire' : 'In calo'} />
            {r.raddoppioOre !== undefined && <Risultato titolo="Tempo di raddoppio" valore={`${fmt(r.raddoppioOre)} ore`} />}
            {r.dimezzamentoOre !== undefined && <Risultato titolo="Tempo di dimezzamento" valore={`${fmt(r.dimezzamentoOre)} ore`} />}
          </>
        ) : <Vuoto />}
      </div>
      <Fonte>Raddoppio = ore × ln 2 / ln(secondo / primo). Aumento minimo in 48 ore in una gravidanza intrauterina vitale ≈ 35% (Barnhart 2004, 2016; per valori iniziali alti l'aumento atteso è minore). Da interpretare sempre insieme all'ecografia e alla zona di discriminazione.</Fonte>
    </>
  )
}

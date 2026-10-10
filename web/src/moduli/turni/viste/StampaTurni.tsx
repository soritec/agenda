import { useMemo, useState } from 'react'
import { intervalloMese, istante } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { condividiOScarica, creaPdf, scarica, type Colore, type RigaPdf } from '../../../export/pdf'
import { Avviso } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro } from '../../../interfaccia/icone'
import { parametroMese } from '../../../interfaccia/navigazione'
import { calcolaRiepilogo } from '../riepilogo'
import { areaDelMese, MESI_PER_ROTAZIONE, TITOLI_AREA } from '../rotazione'
import { ETICHETTE_GIORNATA, minuti, TIPI_GIORNATA, tipoGiornataDa, tipoTurnoDa, TITOLI_GIORNATA, type TipoGiornata, type TipoTurno } from '../tipi'
import { celleMese, chiaveGiorno, classeSigla, datiConSede, datiDa, larghezzaTurno, sedeEffettiva, orarioCompatto, perId, siglaTurno, titoloTurno, turniPerGiorno } from '../supporto'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const INTESTAZIONI = ['Data', 'Turno', 'Orario', 'Ore', 'Sede', 'Note']

/** Toni chiari dei tipi di turno per il PDF (stessa famiglia di colori dell'app). */
const COLORI_PDF: Record<TipoTurno, Colore> = {
  guardiaNotturna: [214, 223, 238],
  guardiaDiurna: [242, 232, 210],
  reparto: [224, 235, 221],
  ambulatorio: [221, 231, 242],
  sostituzioneMMG: [236, 224, 234],
  festivo: [244, 224, 214],
  domiciliare: [233, 228, 220],
  ecografia: [216, 236, 233],
  salaOperatoria: [238, 226, 217],
  altro: [238, 236, 232],
}

/** Colori delle giornate senza turno nel PDF. */
const COLORI_GIORNATA: Record<TipoGiornata, Colore> = {
  ferie: [236, 233, 228],
  riposo: [226, 238, 245],
  congresso: [230, 239, 217],
  smontoNotte: [230, 230, 241],
}

interface Riga extends RigaPdf {
  chiave: string
  ordine: number
  tipo?: TipoTurno
  giornata?: TipoGiornata
}

/** Turni del mese impaginati per il foglio A4, con stampa, PDF e condivisione. */
export function StampaTurni({ anno, mese }: { anno: number; mese: number }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const ferie = useCollezione('ferie')
  const assegnazioni = useCollezione('assegnazioni')
  const periodi = useCollezione('periodiRotazione')
  const impostazioni = useImpostazioni()
  const [stato, setStato] = useState<string>()
  const sabatoFestivo = impostazioni?.sabatoFestivo

  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])
  const perGiorno = useMemo(() => turniPerGiorno(turni ?? []), [turni])
  const qui = parametroMese(anno, mese)
  const delMese = useMemo(() => {
    const { inizio, fine } = intervalloMese(anno, mese)
    return (turni ?? []).filter((t) => t.inizio >= inizio && t.inizio < fine).sort((a, b) => a.inizio - b.inizio)
  }, [turni, anno, mese])
  const giornateMese = useMemo(
    () => new Map((ferie ?? []).filter((f) => f.giorno.startsWith(qui)).map((f) => [f.giorno, tipoGiornataDa(f.tipo)] as const)),
    [ferie, qui],
  )
  const riepilogo = useMemo(() => calcolaRiepilogo(delMese.map((t) => datiConSede(t, assegnazioni)), anno, mese, { sabatoFestivo }), [delMese, assegnazioni, anno, mese, sabatoFestivo])

  const nomeMese = F.mese(istante(anno, mese, 1))
  const titolo = `Turni · ${nomeMese.charAt(0).toUpperCase()}${nomeMese.slice(1)}`
  const area = periodi ? areaDelMese(periodi, anno, mese) : undefined
  const sottotitolo = area ? `Rotazione in ${TITOLI_AREA[area.area]} · mese ${area.meseDellaRotazione} di ${MESI_PER_ROTAZIONE}` : undefined

  // Righe: turni e giorni di ferie in ordine di data.
  const righe = useMemo(() => {
    const elenco: Riga[] = delMese.map((t) => {
      const tipo = tipoTurnoDa(t.tipo)
      const m = minuti(datiDa(t))
      return {
        chiave: t.id,
        ordine: t.inizio,
        tipo,
        colore: COLORI_PDF[tipo],
        evidenza: eFestivo(t.inizio, { sabatoFestivo }) ? 'festivo' : undefined,
        celle: [
          F.dataBreve(t.inizio),
          titoloTurno(t, mappaModelli),
          t.tuttoIlGiorno ? 'Tutto il giorno' : `${F.ora(t.inizio)} – ${F.ora(t.fine)}`,
          m > 0 ? F.durata(m) : '',
          mappaSedi.get(sedeEffettiva(t, assegnazioni) ?? '')?.nome ?? '',
          t.note ?? '',
        ],
      }
    })
    for (const [g, tipo] of giornateMese) {
      const [a, m, gg] = g.split('-').map(Number)
      const i = istante(a!, m!, gg!, 12)
      elenco.push({ chiave: `giornata-${g}`, ordine: i - 1, evidenza: 'ferie', colore: COLORI_GIORNATA[tipo], giornata: tipo, celle: [F.dataBreve(i), TITOLI_GIORNATA[tipo], '', '', '', ''] })
    }
    return elenco.sort((x, y) => x.ordine - y.ordine)
  }, [delMese, giornateMese, mappaModelli, mappaSedi, sabatoFestivo, assegnazioni])

  const caselle = [
    { etichetta: 'ore lavorate', valore: F.durata(riepilogo.minutiTotali) },
    { etichetta: 'turni', valore: String(riepilogo.numeroTurni) },
    { etichetta: 'notti', valore: String(riepilogo.notti) },
    { etichetta: 'festivi', valore: String(riepilogo.turniFestivi) },
    ...TIPI_GIORNATA.map((tipo) => ({ tipo, n: [...giornateMese.values()].filter((x) => x === tipo).length }))
      .filter((x) => x.n > 0)
      .map((x) => ({ etichetta: TITOLI_GIORNATA[x.tipo].toLowerCase(), valore: String(x.n) })),
  ]
  const nomeFile = `Turni ${nomeMese}.pdf`

  async function pdf(azione: 'condividi' | 'scarica') {
    setStato('Preparo il PDF…')
    try {
      const blob = await creaPdf({
        titolo, sottotitolo, riepilogo: caselle, intestazioni: INTESTAZIONI, righe,
        colonneGrassetto: [0, 1], colonnaColore: 1, colonneDestra: [3], colonnaNote: 5,
        totaleTabella: ['Totale ore', '', '', F.durata(riepilogo.minutiTotali), '', ''],
        piede: `Agenda · creato ${F.dataEstesa(Date.now())}`,
      })
      if (azione === 'scarica') scarica(blob, nomeFile)
      else await condividiOScarica(blob, nomeFile, titolo)
      setStato(undefined)
    } catch {
      setStato('Non è stato possibile creare il PDF. Riprova.')
    }
  }

  const precedente = mese === 1 ? parametroMese(anno - 1, 12) : parametroMese(anno, mese - 1)
  const successivo = mese === 12 ? parametroMese(anno + 1, 1) : parametroMese(anno, mese + 1)

  return (
    <div className="schermata stampa" style={{ maxWidth: 900 }}>
      <div className="intestazione non-stampare">
        <a href={`#/turni?mese=${qui}`} className="piccolo">‹ Turni</a>
        <div className="riga-azioni">
          <a className="pulsante tondo" href={`#/turni/stampa?mese=${precedente}`} aria-label="Mese precedente"><IconaIndietro dimensione={18} /></a>
          <a className="pulsante tondo" href={`#/turni/stampa?mese=${successivo}`} aria-label="Mese successivo"><IconaAvanti dimensione={18} /></a>
          <button type="button" className="pulsante" onClick={() => window.print()}>Stampa</button>
          <button type="button" className="pulsante" onClick={() => void pdf('scarica')}>Scarica PDF</button>
          {'share' in navigator && <button type="button" className="pulsante primario" onClick={() => void pdf('condividi')}>Condividi</button>}
        </div>
      </div>
      {stato && <div className="non-stampare"><Avviso>{stato}</Avviso></div>}

      <header className="testata-stampa">
        <h1 className="titolo-grande" style={{ fontSize: 28 }}>{titolo}</h1>
        {sottotitolo && <div className="secondario" style={{ fontWeight: 500 }}>{sottotitolo}</div>}
      </header>

      <div className="tessere foglio-stampa">
        {caselle.map((c) => (
          <div key={c.etichetta} className="tessera">
            <span className="valore">{c.valore}</span>
            <span className="secondario piccolo">{c.etichetta}</span>
          </div>
        ))}
      </div>

      <section className="mese foglio-stampa" aria-label="Calendario del mese">
        <div className="giorni-settimana">{GIORNI.map((g) => <span key={g}>{g}</span>)}</div>
        <div className="griglia">
          {celleMese(anno, mese).map((g, i) => {
            if (!g) return <span key={`v${i}`} />
            const k = chiaveGiorno(g)
            const festivo = eFestivo(istante(g.anno, g.mese, g.giorno, 12), { sabatoFestivo })
            return (
              <div key={k} className={`cella${festivo ? ' festivo' : ''}${giornateMese.has(k) ? ` g-${giornateMese.get(k)}` : ''}`} style={{ cursor: 'default', minHeight: 58 }}>
                <span className="numero" style={{ width: 'auto', height: 22, fontWeight: 600 }}>{g.giorno}</span>
                <span className="sigle">
                  {giornateMese.has(k) && <span className={`etichetta-giornata g-${giornateMese.get(k)}`}>{ETICHETTE_GIORNATA[giornateMese.get(k)!]}</span>}
                  {(perGiorno.get(k) ?? []).map((t) => (
                    <span key={t.id} className="turno-mini">
                      <span className={`${classeSigla(t.tipo)} barra-turno`} style={{ width: larghezzaTurno(t) }}>{siglaTurno(t, mappaModelli)}</span>
                      {orarioCompatto(t) && <span className="orario-mini">{orarioCompatto(t)}</span>}
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <table className="tabella-stampa">
        <thead><tr>{INTESTAZIONI.map((h, i) => <th key={h} style={i === 3 ? { textAlign: 'right' } : undefined}>{h}</th>)}</tr></thead>
        <tbody>
          {righe.length === 0 && <tr><td colSpan={6} className="secondario">Nessun turno in questo mese.</td></tr>}
          {righe.map((r) => (
            <tr key={r.chiave} className={r.giornata ? `riga-giornata g-${r.giornata}` : undefined}>
              <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }} className={r.evidenza === 'festivo' ? 'data-festiva' : undefined}>{r.celle[0]}</td>
              <td style={{ fontWeight: 700 }}>
                {r.tipo && <span className={classeSigla(r.tipo)} style={{ minWidth: 10, width: 10, height: 10, padding: 0, marginRight: 6, verticalAlign: 'middle' }} />}
                {r.celle[1]}
              </td>
              <td className="numeri" style={{ whiteSpace: 'nowrap' }}>{r.celle[2]}</td>
              <td className="numeri" style={{ textAlign: 'right', fontWeight: 600 }}>{r.celle[3]}</td>
              <td>{r.celle[4]}</td>
              <td className="secondario" style={{ fontStyle: 'italic' }}>{r.celle[5]}</td>
            </tr>
          ))}
        </tbody>
        {righe.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={3} style={{ fontWeight: 700 }}>Totale ore</td>
              <td className="numeri" style={{ textAlign: 'right', fontWeight: 700 }}>{F.durata(riepilogo.minutiTotali)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>

      <p className="secondario piccolo non-stampare">
        Su iPhone, "Condividi" apre il foglio di condivisione (Mail, WhatsApp, File…). "Stampa" permette anche di salvare come PDF.
      </p>
      <span className="solo-stampa secondario piccolo">Agenda · stampato {F.dataEstesa(Date.now())}</span>
    </div>
  )
}

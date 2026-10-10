import { useMemo, useState } from 'react'
import { intervalloMese, istante } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { condividiOScarica, creaPdf, scarica } from '../../../export/pdf'
import { Avviso } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro } from '../../../interfaccia/icone'
import { parametroMese } from '../../../interfaccia/navigazione'
import { calcolaRiepilogo } from '../riepilogo'
import { areaDelMese, MESI_PER_ROTAZIONE, TITOLI_AREA } from '../rotazione'
import { minuti } from '../tipi'
import { celleMese, chiaveGiorno, classeSigla, datiDa, orarioCompatto, perId, siglaTurno, titoloTurno, turniPerGiorno } from '../supporto'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

/** Turni del mese impaginati per il foglio A4, con stampa, PDF e condivisione. */
export function StampaTurni({ anno, mese }: { anno: number; mese: number }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const ferie = useCollezione('ferie')
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
  const ferieMese = useMemo(() => (ferie ?? []).filter((f) => f.giorno.startsWith(qui)).map((f) => f.giorno).sort(), [ferie, qui])
  const riepilogo = useMemo(() => calcolaRiepilogo(delMese.map(datiDa), anno, mese, { sabatoFestivo }), [delMese, anno, mese, sabatoFestivo])

  const nomeMese = F.mese(istante(anno, mese, 1))
  const titolo = `Turni · ${nomeMese.charAt(0).toUpperCase()}${nomeMese.slice(1)}`
  const area = periodi ? areaDelMese(periodi, anno, mese) : undefined
  const sottotitolo = area ? `Rotazione: ${TITOLI_AREA[area.area]} (mese ${area.meseDellaRotazione} di ${MESI_PER_ROTAZIONE})` : undefined

  // Righe della tabella: turni e giorni di ferie in ordine di data.
  const righe = useMemo(() => {
    const elenco: { chiave: string; ordine: number; celle: string[] }[] = delMese.map((t) => ({
      chiave: t.id,
      ordine: t.inizio,
      celle: [
        F.dataBreve(t.inizio),
        titoloTurno(t, mappaModelli),
        t.tuttoIlGiorno ? 'Tutto il giorno' : `${F.ora(t.inizio)}–${F.ora(t.fine)}`,
        minuti(datiDa(t)) > 0 ? F.durata(minuti(datiDa(t))) : '',
        (t.sedeId && mappaSedi.get(t.sedeId)?.nome) || '',
        t.note ?? '',
      ],
    }))
    for (const g of ferieMese) {
      const [a, m, gg] = g.split('-').map(Number)
      const i = istante(a!, m!, gg!, 12)
      elenco.push({ chiave: `ferie-${g}`, ordine: i - 1, celle: [F.dataBreve(i), 'Ferie', '', '', '', ''] })
    }
    return elenco.sort((x, y) => x.ordine - y.ordine)
  }, [delMese, ferieMese, mappaModelli, mappaSedi])

  const totali = [
    `Ore lavorate: ${F.durata(riepilogo.minutiTotali)}`,
    `Turni: ${riepilogo.numeroTurni} · Notti: ${riepilogo.notti} · Festivi: ${riepilogo.turniFestivi}${ferieMese.length ? ` · Ferie: ${ferieMese.length} giorni` : ''}`,
  ]
  const intestazioni = ['Data', 'Turno', 'Orario', 'Ore', 'Sede', 'Note']
  const nomeFile = `Turni ${nomeMese}.pdf`

  async function pdf(azione: 'condividi' | 'scarica') {
    setStato('Preparo il PDF…')
    try {
      const blob = await creaPdf({ titolo, sottotitolo, intestazioni, righe: righe.map((r) => r.celle), totali })
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
    <div className="schermata" style={{ maxWidth: 900 }}>
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

      <header>
        <h1 className="titolo-grande" style={{ fontSize: 26 }}>{titolo}</h1>
        {sottotitolo && <div className="secondario">{sottotitolo}</div>}
      </header>

      <section className="mese foglio-stampa" aria-label="Calendario del mese">
        <div className="giorni-settimana">{GIORNI.map((g) => <span key={g}>{g}</span>)}</div>
        <div className="griglia">
          {celleMese(anno, mese).map((g, i) => {
            if (!g) return <span key={`v${i}`} />
            const k = chiaveGiorno(g)
            const festivo = eFestivo(istante(g.anno, g.mese, g.giorno, 12), { sabatoFestivo })
            return (
              <div key={k} className={`cella${festivo ? ' festivo' : ''}${ferieMese.includes(k) ? ' ferie' : ''}`} style={{ cursor: 'default', minHeight: 58 }}>
                <span className="numero" style={{ width: 'auto', height: 22 }}>{g.giorno}</span>
                <span className="sigle">
                  {ferieMese.includes(k) && <span className="etichetta-ferie">Ferie</span>}
                  {(perGiorno.get(k) ?? []).map((t) => (
                    <span key={t.id} className="turno-mini">
                      <span className={classeSigla(t.tipo)}>{siglaTurno(t, mappaModelli)}</span>
                      <span className="orario-mini">{orarioCompatto(t)}</span>
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <table className="tabella-stampa">
        <thead><tr>{intestazioni.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {righe.length === 0 && <tr><td colSpan={6} className="secondario">Nessun turno in questo mese.</td></tr>}
          {righe.map((r) => <tr key={r.chiave}>{r.celle.map((c, i) => <td key={i} className={i === 3 ? 'numeri' : undefined}>{c}</td>)}</tr>)}
        </tbody>
      </table>

      <div className="foglio-stampa" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {totali.map((t) => <div key={t} className="numeri" style={{ fontWeight: 500 }}>{t}</div>)}
      </div>
      <p className="secondario piccolo non-stampare">
        Su iPhone, "Condividi" apre il foglio di condivisione (Mail, WhatsApp, File…). "Stampa" permette anche di salvare come PDF.
      </p>
      <span className="solo-stampa secondario piccolo">Stampato {F.dataEstesa(Date.now())}</span>
    </div>
  )
}

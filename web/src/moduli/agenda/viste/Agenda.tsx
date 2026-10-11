import { useMemo, useState } from 'react'
import { aggiungiGiorni, istante, stessoGiorno } from '../../../nucleo/calendario'
import { eFestivo } from '../../../nucleo/festivita'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Evento } from '../../../dati/modello'
import { creaIcs, type EventoIcs } from '../../../export/ics'
import { condividiOScarica } from '../../../export/pdf'
import { Avviso, Campo, Foglio, mostraAvviso, NotaPrivacy } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro, IconaPiu } from '../../../interfaccia/icone'
import { parametroMese, vai } from '../../../interfaccia/navigazione'
import { celleMese, chiaveGiorno, giornoDaChiave, minutiDaOrario, oggi, orarioDaMinuti, perId } from '../../turni/supporto'
import { CATEGORIE_EVENTO, categoriaDa, FONTI, impegniTra, perGiorno, testoOrario, TITOLI_CATEGORIA, TITOLI_FONTE, TITOLO_VOCE, type CategoriaEvento, type Fonte, type Impegno } from '../impegni'

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const CHIAVE_FILTRI = 'agenda.fontiNascoste'

function leggiNascoste(): Set<Fonte> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHIAVE_FILTRI) ?? '[]') as Fonte[])
  } catch {
    return new Set()
  }
}

const dataEstesa = (giorno: string) => {
  const g = giornoDaChiave(giorno)
  return g ? F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12)) : giorno
}

/** Classi di colore della voce: i turni riusano i colori della sigla. */
const classeVoce = (i: Impegno) => (i.fonte === 'turno' ? `voce sigla ${i.colore}` : `voce ${i.colore}`)

/** Tutti gli impegni in un solo calendario: turni, giornate, impegni, esami, lezioni, scadenze. */
export function Agenda({ anno, mese, eventoAperto, nuovoGiorno }: { anno: number; mese: number; eventoAperto?: string; nuovoGiorno?: string }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const sedi = useCollezione('sedi')
  const assegnazioni = useCollezione('assegnazioni')
  const giornate = useCollezione('ferie')
  const eventi = useCollezione('eventi')
  const esami = useCollezione('esami')
  const tasse = useCollezione('tasse')
  const impostazioni = useImpostazioni()
  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const mappaSedi = useMemo(() => perId(sedi), [sedi])

  const g0 = oggi()
  const oggiChiave = chiaveGiorno(g0)
  const [nascoste, setNascoste] = useState(leggiNascoste)
  const meseQui = `${anno}-${String(mese).padStart(2, '0')}`
  const [scelto, setScelto] = useState(() => (oggiChiave.startsWith(meseQui) ? oggiChiave : `${meseQui}-01`))
  const [esporta, setEsporta] = useState(false)
  const giornoScelto = scelto.startsWith(meseQui) ? scelto : `${meseQui}-01`

  const dati = { turni, modelli: mappaModelli, sedi: mappaSedi, assegnazioni, giornate, eventi, esami, tasse }
  const tutti = useMemo(
    () => impegniTra(dati, `${meseQui}-01`, chiaveGiorno(aggiungiGiorni({ anno, mese, giorno: 1 }, 45))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [turni, mappaModelli, mappaSedi, assegnazioni, giornate, eventi, esami, tasse, meseQui],
  )
  const visibili = tutti.filter((i) => !nascoste.has(i.fonte))
  const mappa = perGiorno(visibili)
  const delGiorno = mappa.get(giornoScelto) ?? []
  const prossimi = visibili.filter((i) => i.giorno > giornoScelto).slice(0, 12)

  const precedente = parametroMese(mese === 1 ? anno - 1 : anno, mese === 1 ? 12 : mese - 1)
  const successivo = parametroMese(mese === 12 ? anno + 1 : anno, mese === 12 ? 1 : mese + 1)
  const evento = eventoAperto === 'nuovo' ? undefined : eventi?.find((e) => e.id === eventoAperto)
  const chiudiForm = () => vai(`#/agenda?mese=${meseQui}`)

  function cambiaFiltro(f: Fonte) {
    const n = new Set(nascoste)
    if (n.has(f)) n.delete(f); else n.add(f)
    setNascoste(n)
    try { localStorage.setItem(CHIAVE_FILTRI, JSON.stringify([...n])) } catch { /* solo comodità */ }
  }

  return (
    <div className="schermata">
      <header className="testata-turni">
        <h1 className="titolo-grande">Agenda</h1>
        <div />
        <div className="riga-azioni azioni">
          <button type="button" className="pulsante" onClick={() => setEsporta(true)}>Calendario Apple</button>
          <a className="pulsante tondo primario" href={`#/agenda/evento/nuovo?mese=${meseQui}&giorno=${giornoScelto}`} aria-label="Nuovo impegno"><IconaPiu dimensione={18} /></a>
        </div>
      </header>
      <div className="riga-azioni navigazione-mese">
        <a className="pulsante tondo" href={`#/agenda?mese=${precedente}`} aria-label="Mese precedente"><IconaIndietro dimensione={18} /></a>
        <a className="pulsante" href={`#/agenda?mese=${parametroMese(g0.anno, g0.mese)}`} onClick={() => setScelto(oggiChiave)} title="Torna a oggi"
          style={{ minWidth: 150, fontWeight: 600, textTransform: 'capitalize' }}>{F.mese(istante(anno, mese, 1))}</a>
        <a className="pulsante tondo" href={`#/agenda?mese=${successivo}`} aria-label="Mese successivo"><IconaAvanti dimensione={18} /></a>
      </div>

      <div className="filtri-agenda" role="group" aria-label="Cosa mostrare">
        {FONTI.map((f) => (
          <button key={f} type="button" className={`pillola${nascoste.has(f) ? ' spenta' : ''}`} aria-pressed={!nascoste.has(f)} onClick={() => cambiaFiltro(f)}>
            <span className={`pallino-fonte f-${f}`} />{TITOLI_FONTE[f]}
          </button>
        ))}
      </div>

      <div className="colonne">
        <div className="principale">
          <section className="mese grande agenda" aria-label="Calendario del mese: tocca un giorno per vedere i suoi impegni">
            <div className="giorni-settimana">{GIORNI.map((g) => <span key={g}>{g}</span>)}</div>
            <div className="griglia">
              {celleMese(anno, mese).map((g, i) => {
                if (!g) return <span key={`v${i}`} />
                const k = chiaveGiorno(g)
                const voci = mappa.get(k) ?? []
                const festivo = eFestivo(istante(g.anno, g.mese, g.giorno, 12), { sabatoFestivo: impostazioni?.sabatoFestivo ?? true })
                const classi = ['cella', festivo && 'festivo', stessoGiorno(g, g0) && 'oggi', k === giornoScelto && 'selezionato'].filter(Boolean).join(' ')
                return (
                  <div key={k} className={classi}>
                    <button type="button" className="aggiungi" onClick={() => setScelto(k)} onDoubleClick={() => vai(`#/agenda/evento/nuovo?mese=${meseQui}&giorno=${k}`)}
                      aria-label={`${F.dataEstesa(istante(g.anno, g.mese, g.giorno, 12))}: ${voci.length ? `${voci.length} impegni` : 'nessun impegno'}`} />
                    <span className="numero">{g.giorno}</span>
                    <span className="voci">
                      {voci.slice(0, 3).map((v) => (
                        <span key={v.chiave} className={`${classeVoce(v)}${v.concluso ? ' conclusa' : ''}`}>{v.fonte === 'turno' ? v.sigla : v.titolo}</span>
                      ))}
                      {voci.length > 3 && <span className="altre">+{voci.length - 3}</span>}
                    </span>
                    <span className="puntini" aria-hidden="true">
                      {voci.slice(0, 4).map((v) => <span key={v.chiave} className={`pallino-fonte f-${v.fonte}`} />)}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
          <span className="secondario piccolo">Tocca un giorno per vedere i suoi impegni{window.matchMedia?.('(hover: hover)').matches ? ', doppio clic per aggiungerne uno' : ''}. Turni, esami, lezioni e tasse si modificano nelle loro sezioni: toccali per andarci.</span>
        </div>

        <aside className="laterale-destra">
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="intestazione" style={{ alignItems: 'center' }}>
              <h2 className="titolo-sezione" style={{ textTransform: 'capitalize' }}>{giornoScelto === oggiChiave ? 'Oggi' : dataEstesa(giornoScelto)}</h2>
              <a className="pulsante piccolo" href={`#/agenda/evento/nuovo?mese=${meseQui}&giorno=${giornoScelto}`}>+ Impegno</a>
            </div>
            <ElencoImpegni voci={delGiorno} vuoto="Niente in programma" />
          </section>
          {prossimi.length > 0 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="titolo-sezione">Nei giorni dopo</h2>
              <ElencoImpegni voci={prossimi} conData />
            </section>
          )}
        </aside>
      </div>

      {eventoAperto && (eventoAperto === 'nuovo' || evento) && (
        <FormEvento key={eventoAperto} record={evento} giorno={nuovoGiorno ?? giornoScelto} onChiudi={chiudiForm} />
      )}
      {esporta && <EsportaCalendario anno={anno} mese={mese} dati={dati} nascoste={nascoste} onChiudi={() => setEsporta(false)} />}
    </div>
  )
}

/** Elenco di impegni (usato anche nella pagina Oggi). */
export function ElencoImpegni({ voci, conData, vuoto }: { voci: Impegno[]; conData?: boolean; vuoto?: string }) {
  return (
    <div className="lista">
      {voci.length === 0 && vuoto && <div className="vuoto piccolo">{vuoto}</div>}
      {voci.map((v) => (
        <a key={v.chiave} className={`riga riga-impegno${v.concluso ? ' conclusa' : ''}`} href={v.link}>
          <span className="orario-impegno numeri">
            {conData && <span style={{ display: 'block', fontWeight: 600, color: 'var(--testo)' }}>{F.dataBreve(istante(Number(v.giorno.slice(0, 4)), Number(v.giorno.slice(5, 7)), Number(v.giorno.slice(8, 10)), 12))}</span>}
            {v.minutoInizio === undefined ? (conData ? '' : 'giornata') : testoOrario(v).replace('–', '\n')}
          </span>
          <span className={`pallino-fonte f-${v.fonte}`} style={{ width: 4, height: 'auto', alignSelf: 'stretch', borderRadius: 2 }} />
          <span className="crescente">
            <span style={{ fontWeight: 600 }}>{v.fonte === 'turno' && v.sigla ? `${v.sigla} · ` : ''}{v.titolo}</span>
            <span className="secondario piccolo">{[v.fonte === 'evento' ? '' : TITOLO_VOCE[v.fonte], v.dettaglio].filter(Boolean).join(' · ')}</span>
          </span>
        </a>
      ))}
    </div>
  )
}

/* Modulo per aggiungere o modificare un impegno */

function FormEvento({ record, giorno, onChiudi }: { record?: Evento; giorno: string; onChiudi: () => void }) {
  const [b, setB] = useState({
    titolo: record?.titolo ?? '',
    giorno: record?.giorno ?? giorno,
    giornoFine: record?.giornoFine ?? '',
    tuttoIlGiorno: record?.tuttoIlGiorno ?? false,
    inizio: orarioDaMinuti(record?.minutoInizio ?? 9 * 60),
    fine: orarioDaMinuti(record?.minutoFine ?? 10 * 60),
    luogo: record?.luogo ?? '',
    categoria: record ? categoriaDa(record.categoria) : ('personale' as CategoriaEvento),
    note: record?.note ?? '',
  })
  const [piuGiorni, setPiuGiorni] = useState(Boolean(record?.giornoFine))
  const mInizio = minutiDaOrario(b.inizio), mFine = minutiDaOrario(b.fine)
  const fineValida = !piuGiorni || (!!giornoDaChiave(b.giornoFine) && b.giornoFine >= b.giorno)
  const orariValidi = b.tuttoIlGiorno || piuGiorni || (mInizio !== undefined && (b.fine.trim() === '' || mFine !== undefined))
  const valido = b.titolo.trim() !== '' && !!giornoDaChiave(b.giorno) && fineValida && orariValidi

  async function conferma() {
    if (!valido) return
    const senzaOrari = b.tuttoIlGiorno || piuGiorni
    await salva('eventi', {
      ...record, titolo: b.titolo.trim(), giorno: b.giorno, categoria: b.categoria,
      giornoFine: piuGiorni && b.giornoFine > b.giorno ? b.giornoFine : undefined,
      tuttoIlGiorno: senzaOrari || undefined,
      minutoInizio: senzaOrari ? undefined : mInizio, minutoFine: senzaOrari ? undefined : mFine,
      luogo: b.luogo.trim() || undefined, note: b.note.trim() || undefined,
    })
    onChiudi()
    if (!record) mostraAvviso(`Aggiunto: ${b.titolo.trim()}`)
  }

  return (
    <Foglio aperto titolo={record ? 'Impegno' : 'Nuovo impegno'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Titolo"><input value={b.titolo} placeholder="es. Riunione di reparto, dentista…" onChange={(e) => setB({ ...b, titolo: e.target.value })} /></Campo>
        <div className="campo">
          <span>Tipo</span>
          <div className="riga-azioni" role="group" aria-label="Tipo di impegno">
            {CATEGORIE_EVENTO.map((c) => (
              <button key={c} type="button" className={`pillola voce-scelta c-${c}`} aria-pressed={b.categoria === c} onClick={() => setB({ ...b, categoria: c })}>{TITOLI_CATEGORIA[c]}</button>
            ))}
          </div>
        </div>
        <div className="campi-affiancati">
          <Campo etichetta={piuGiorni ? 'Dal' : 'Giorno'}><input type="date" value={b.giorno} onChange={(e) => setB({ ...b, giorno: e.target.value })} /></Campo>
          {piuGiorni && <Campo etichetta="Al"><input type="date" value={b.giornoFine} min={b.giorno} onChange={(e) => setB({ ...b, giornoFine: e.target.value })} /></Campo>}
        </div>
        <label className="interruttore">
          <span>Più giorni (es. congresso, viaggio)</span>
          <input type="checkbox" checked={piuGiorni} onChange={(e) => { setPiuGiorni(e.target.checked); if (e.target.checked && !b.giornoFine) setB({ ...b, giornoFine: b.giorno }) }} />
        </label>
        {!piuGiorni && (
          <label className="interruttore">
            <span>Tutto il giorno</span>
            <input type="checkbox" checked={b.tuttoIlGiorno} onChange={(e) => setB({ ...b, tuttoIlGiorno: e.target.checked })} />
          </label>
        )}
        {!piuGiorni && !b.tuttoIlGiorno && (
          <div className="campi-affiancati">
            <Campo etichetta="Dalle"><input type="time" value={b.inizio} onChange={(e) => setB({ ...b, inizio: e.target.value })} /></Campo>
            <Campo etichetta="Alle (facoltativo)"><input type="time" value={b.fine} onChange={(e) => setB({ ...b, fine: e.target.value })} /></Campo>
          </div>
        )}
        {piuGiorni && !fineValida && <Avviso>L'ultimo giorno deve essere uguale o dopo il primo.</Avviso>}
        <Campo etichetta="Luogo (facoltativo)"><input value={b.luogo} onChange={(e) => setB({ ...b, luogo: e.target.value })} /></Campo>
        <Campo etichetta="Note"><textarea value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} /></Campo>
        <NotaPrivacy />
        {record && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('eventi', record.id).then(() => { onChiudi(); mostraAvviso(`Eliminato: ${record.titolo}`, () => void ripristina('eventi', record.id)) })}>
            Elimina
          </button>
        )}
      </div>
    </Foglio>
  )
}

/* Esportazione nel Calendario di Apple (file .ics) */

function EsportaCalendario({ anno, mese, dati, nascoste, onChiudi }: {
  anno: number; mese: number; dati: Parameters<typeof impegniTra>[0]; nascoste: Set<Fonte>; onChiudi: () => void
}) {
  const [errore, setErrore] = useState<string>()
  const nomeMese = F.mese(istante(anno, mese, 1))

  async function esporta(periodo: 'mese' | 'futuro') {
    const meseQui = `${anno}-${String(mese).padStart(2, '0')}`
    const da = periodo === 'mese' ? `${meseQui}-01` : chiaveGiorno(oggi())
    const a = periodo === 'mese' ? `${meseQui}-31` : chiaveGiorno(aggiungiGiorni(oggi(), 400))
    const voci = impegniTra(dati, da, a).filter((i) => !nascoste.has(i.fonte))
    const turni = perId(dati.turni)
    const eventiIcs: EventoIcs[] = voci.map((v) => {
      const g = giornoDaChiave(v.giorno)!
      const t = v.fonte === 'turno' ? turni.get(v.id) : undefined
      const domani = aggiungiGiorni(g, 1)
      const tutto = v.minutoInizio === undefined
      const inizio = t && !tutto ? t.inizio : istante(g.anno, g.mese, g.giorno, tutto ? 0 : Math.floor(v.minutoInizio! / 60), tutto ? 0 : v.minutoInizio! % 60)
      let fine = t && !tutto ? t.fine : tutto ? istante(domani.anno, domani.mese, domani.giorno) : inizio + 60 * 60_000
      if (!t && !tutto && v.minutoFine !== undefined) {
        fine = istante(g.anno, g.mese, g.giorno, Math.floor(v.minutoFine / 60), v.minutoFine % 60)
        if (fine <= inizio) fine += 24 * 60 * 60_000
      }
      return {
        uid: `${v.chiave.replace(/:/g, '-')}@agenda`, titolo: v.fonte === 'turno' && v.sigla ? `${v.sigla} · ${v.titolo}` : v.titolo,
        inizio, fine, tuttoIlGiorno: tutto, note: v.dettaglio, modificatoIl: v.modificatoIl,
      }
    })
    if (!eventiIcs.length) {
      setErrore('Non c’è niente da esportare in questo periodo.')
      return
    }
    const blob = new Blob([creaIcs(eventiIcs, 'Agenda')], { type: 'text/calendar' })
    await condividiOScarica(blob, periodo === 'mese' ? `Agenda ${nomeMese}.ics` : 'Agenda da oggi.ics', 'Agenda')
    onChiudi()
  }

  return (
    <Foglio aperto titolo="Calendario Apple" onChiudi={onChiudi}>
      <p className="secondario" style={{ margin: 0 }}>
        Crea un file da aprire con il Calendario: gli impegni vengono aggiunti (se li esporti di nuovo, il Calendario aggiorna quelli che ha già).
        Esporta solo ciò che è acceso nei filtri.
      </p>
      {errore && <Avviso>{errore}</Avviso>}
      <div className="scelte-rapide">
        <button type="button" className="scelta-rapida" onClick={() => void esporta('mese')}><span className="nome"><strong style={{ textTransform: 'capitalize' }}>{nomeMese}</strong><br /><span className="orario">solo questo mese</span></span></button>
        <button type="button" className="scelta-rapida" onClick={() => void esporta('futuro')}><span className="nome"><strong>Da oggi in poi</strong><br /><span className="orario">tutto ciò che è in programma</span></span></button>
      </div>
    </Foglio>
  )
}


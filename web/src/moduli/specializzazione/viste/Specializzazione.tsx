import { useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Collegamento, EsameOLezione } from '../../../dati/modello'
import { Campo, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { IconaImpostazioni } from '../../../interfaccia/icone'
import { assegnazioneDelMese } from '../../turni/assegnazioni'
import { areaDelMese, MESI_PER_ROTAZIONE, TITOLI_AREA } from '../../turni/rotazione'
import { chiaveGiorno, giornoDaChiave, oggi, perId } from '../../turni/supporto'
import { ANNI_PREDEFINITI, annoDiCorso, conteggi, eConcluso, statoTassa } from '../logica'

const dataBreve = (giorno: string) => {
  const g = giornoDaChiave(giorno)
  return g ? F.dataBreve(istante(g.anno, g.mese, g.giorno, 12)) : giorno
}

/** Specializzazione: anno di corso, rotazione e un riquadro per ogni sezione. */
export function Specializzazione() {
  const impostazioni = useImpostazioni()
  const procedure = useCollezione('procedure')
  const esami = useCollezione('esami')
  const tasse = useCollezione('tasse')
  const periodi = useCollezione('periodiRotazione')
  const assegnazioni = useCollezione('assegnazioni')
  const sedi = useCollezione('sedi')
  const collegamenti = useCollezione('collegamenti')
  const [modificaLink, setModificaLink] = useState<{ record?: Collegamento } | undefined>()

  const g0 = oggi()
  const oggiChiave = chiaveGiorno(g0)
  const anni = impostazioni?.anniSpecializzazione ?? ANNI_PREDEFINITI
  const anno = annoDiCorso(impostazioni?.inizioSpecializzazione, oggiChiave, anni)
  const area = periodi ? areaDelMese(periodi, g0.anno, g0.mese) : undefined
  const ospedale = assegnazioni ? assegnazioneDelMese(assegnazioni, g0.anno, g0.mese) : undefined
  const nomeOspedale = ospedale ? perId(sedi).get(ospedale.periodo.sedeId)?.nome : undefined
  const c = useMemo(() => conteggi(procedure ?? []), [procedure])
  const prossimo = (tipo: string): EsameOLezione | undefined =>
    [...(esami ?? [])].filter((e) => e.tipo === tipo && !eConcluso(e, oggiChiave)).sort((a, b) => a.giorno.localeCompare(b.giorno))[0]
  const prossimoEsame = prossimo('esame'), prossimaLezione = prossimo('lezione')
  const daPagare = (tasse ?? []).filter((t) => t.stato !== 'pagato')
  const totaleDaPagare = daPagare.reduce((s, t) => s + t.importoCent, 0)
  const statoPeggiore = daPagare.map((t) => statoTassa(t, oggiChiave)).sort((a, b) => ['scaduta', 'inScadenza', 'daPagare'].indexOf(a) - ['scaduta', 'inScadenza', 'daPagare'].indexOf(b))[0]
  const link = [...(collegamenti ?? [])].sort((a, b) => a.ordine - b.ordine || a.titolo.localeCompare(b.titolo))

  return (
    <div className="schermata">
      <header className="intestazione">
        <div>
          {anno && <div className="sopratitolo">{anno}° anno di {anni}</div>}
          <h1 className="titolo-grande">Specializzazione</h1>
        </div>
        <div className="riga-azioni">
          <a className="pulsante primario" href="#/specializzazione/logbook?nuova=1">+ Procedura</a>
          <a className="pulsante tondo" href="#/specializzazione/impostazioni" aria-label="Impostazioni della specializzazione"><IconaImpostazioni dimensione={18} /></a>
        </div>
      </header>

      {impostazioni && !impostazioni.inizioSpecializzazione && (
        <div className="scheda" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Imposta il mese di inizio: calcolo da solo l'anno di corso.</span>
          <a className="pulsante primario" href="#/specializzazione/impostazioni">Imposta</a>
        </div>
      )}

      <div className="tessere">
        <a className="tessera" href="#/turni" style={{ color: 'var(--testo)' }}>
          <span className="secondario piccolo">Rotazione</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{area ? TITOLI_AREA[area.area] : '—'}</span>
          <span className="secondario piccolo">{area ? `mese ${area.meseDellaRotazione} di ${MESI_PER_ROTAZIONE}` : 'da scegliere nei Turni'}</span>
        </a>
        <a className="tessera" href="#/turni" style={{ color: 'var(--testo)' }}>
          <span className="secondario piccolo">Ospedale</span>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{nomeOspedale ?? '—'}</span>
          <span className="secondario piccolo">{ospedale ? `mese ${ospedale.meseDelPeriodo} di ${ospedale.periodo.mesi}` : 'da scegliere nei Turni'}</span>
        </a>
      </div>

      <div className="sezioni-spec">
        <a className="riquadro-sezione" href="#/specializzazione/logbook">
          <span className="titolo">Logbook</span>
          <span className="valore">{c.totale}</span>
          <span className="dettaglio">{c.perRuolo.primo} da 1° operatore{anno && c.perAnno.get(anno) ? ` · ${c.perAnno.get(anno)} quest'anno` : ''}</span>
        </a>
        <a className="riquadro-sezione" href="#/specializzazione/esami">
          <span className="titolo"><span className="etichetta-tipo colore-esame">Esami</span></span>
          <span className="dettaglio">{prossimoEsame ? <><strong style={{ color: 'var(--testo)' }}>{prossimoEsame.titolo}</strong><br />{dataBreve(prossimoEsame.giorno)}</> : 'Nessun esame in programma'}</span>
        </a>
        <a className="riquadro-sezione" href="#/specializzazione/lezioni">
          <span className="titolo"><span className="etichetta-tipo colore-lezione">Lezioni</span></span>
          <span className="dettaglio">{prossimaLezione ? <><strong style={{ color: 'var(--testo)' }}>{prossimaLezione.titolo}</strong><br />{dataBreve(prossimaLezione.giorno)}</> : 'Nessuna lezione in programma'}</span>
        </a>
        <a className="riquadro-sezione" href="#/specializzazione/tasse">
          <span className="titolo">Tasse {statoPeggiore && statoPeggiore !== 'daPagare' && <span className={`etichetta-tipo colore-${statoPeggiore}`}>{statoPeggiore === 'scaduta' ? 'scaduta' : 'in scadenza'}</span>}</span>
          <span className="valore">{daPagare.length ? F.importo(totaleDaPagare) : '—'}</span>
          <span className="dettaglio">{daPagare.length ? `${daPagare.length} da pagare` : 'Niente da pagare'}</span>
        </a>
        <a className="riquadro-sezione in-arrivo" href="#/specializzazione/calcolatori">
          <span className="titolo">Calcolatori</span>
          <span className="dettaglio">EG e DPP, Hadlock, Bishop… in arrivo</span>
        </a>
        <a className="riquadro-sezione in-arrivo" href="#/specializzazione/ricerca">
          <span className="titolo">Ricerca</span>
          <span className="dettaglio">Da sviluppare più avanti</span>
        </a>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="intestazione" style={{ alignItems: 'center' }}>
          <h2 className="titolo-sezione">Servizi di ateneo</h2>
          <button type="button" className="link" onClick={() => setModificaLink({})}>Aggiungi</button>
        </div>
        <div className="lista">
          {link.length === 0 && <div className="vuoto piccolo">Aggiungi i link che usi: segreteria online, e-learning, posta…</div>}
          {link.map((l) => (
            <div key={l.id} className="riga" style={{ cursor: 'default' }}>
              <a href={l.url} target="_blank" rel="noreferrer" className="crescente" style={{ color: 'var(--testo)' }}>
                <span style={{ fontWeight: 500 }}>{l.titolo}</span>
                <span className="secondario piccolo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url.replace(/^https?:\/\//, '')}</span>
              </a>
              <button type="button" className="link piccolo" onClick={() => setModificaLink({ record: l })}>Modifica</button>
            </div>
          ))}
        </div>
      </section>

      {modificaLink && <FormCollegamento record={modificaLink.record} ordine={link.length} onChiudi={() => setModificaLink(undefined)} />}
    </div>
  )
}

/** Sezione della specializzazione non ancora sviluppata. */
export function SezioneInArrivo({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header>
        <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
        <h1 className="titolo-grande">{titolo}</h1>
      </header>
      <p className="secondario">{testo}</p>
    </div>
  )
}

function FormCollegamento({ record, ordine, onChiudi }: { record?: Collegamento; ordine: number; onChiudi: () => void }) {
  const [titolo, setTitolo] = useState(record?.titolo ?? '')
  const [url, setUrl] = useState(record?.url ?? '')
  const indirizzo = url.trim() && !/^https?:\/\//.test(url.trim()) ? `https://${url.trim()}` : url.trim()
  const valido = titolo.trim() !== '' && /^https?:\/\/[^\s.]+\.[^\s]+$/.test(indirizzo)
  async function conferma() {
    if (!valido) return
    await salva('collegamenti', { ...record, titolo: titolo.trim(), url: indirizzo, categoria: record?.categoria ?? 'ateneo', ordine: record?.ordine ?? ordine })
    onChiudi()
  }
  return (
    <Foglio aperto titolo={record ? 'Collegamento' : 'Nuovo collegamento'} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} disabled={!valido} onClick={() => void conferma()}>Salva</button>}>
      <div className="modulo">
        <Campo etichetta="Nome"><input value={titolo} placeholder="es. Segreteria online" onChange={(e) => setTitolo(e.target.value)} /></Campo>
        <Campo etichetta="Indirizzo"><input value={url} placeholder="es. https://…" inputMode="url" autoCapitalize="off" spellCheck={false} onChange={(e) => setUrl(e.target.value)} /></Campo>
        {record && (
          <button type="button" className="pulsante pericolo"
            onClick={() => void elimina('collegamenti', record.id).then(() => { onChiudi(); mostraAvviso(`Eliminato: ${record.titolo}`, () => void ripristina('collegamenti', record.id)) })}>
            Elimina
          </button>
        )}
      </div>
    </Foglio>
  )
}

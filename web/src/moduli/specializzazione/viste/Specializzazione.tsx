import { useMemo, useState } from 'react'
import { istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import type { Collegamento } from '../../../dati/modello'
import { Campo, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaImpostazioni } from '../../../interfaccia/icone'
import { assegnazioneDelMese } from '../../turni/assegnazioni'
import { areaDelMese, MESI_PER_ROTAZIONE, TITOLI_AREA } from '../../turni/rotazione'
import { chiaveGiorno, oggi, perId } from '../../turni/supporto'
import { ANNI_PREDEFINITI, annoDiCorso, conteggi } from '../logica'

/** Panoramica della specializzazione: anno di corso, rotazione, logbook, esami e collegamenti di ateneo. */
export function Specializzazione() {
  const impostazioni = useImpostazioni()
  const procedure = useCollezione('procedure')
  const tipi = useCollezione('tipiProcedura')
  const esami = useCollezione('esami')
  const periodi = useCollezione('periodiRotazione')
  const assegnazioni = useCollezione('assegnazioni')
  const sedi = useCollezione('sedi')
  const collegamenti = useCollezione('collegamenti')
  const [modificaLink, setModificaLink] = useState<{ record?: Collegamento } | undefined>()

  const g0 = oggi()
  const anno = annoDiCorso(impostazioni?.inizioSpecializzazione, chiaveGiorno(g0), impostazioni?.anniSpecializzazione)
  const area = periodi ? areaDelMese(periodi, g0.anno, g0.mese) : undefined
  const ospedale = assegnazioni ? assegnazioneDelMese(assegnazioni, g0.anno, g0.mese) : undefined
  const nomeOspedale = ospedale ? perId(sedi).get(ospedale.periodo.sedeId)?.nome : undefined
  const c = useMemo(() => conteggi(procedure ?? []), [procedure])
  const diQuestAnno = anno ? c.perAnno.get(anno) ?? 0 : undefined
  const piuFatte = useMemo(() => {
    const nomi = perId(tipi)
    return [...c.perTipo.entries()]
      .map(([id, r]) => ({ nome: nomi.get(id)?.nome ?? '—', totale: r.primo + r.secondo + r.osservatore, primo: r.primo }))
      .sort((a, b) => b.totale - a.totale)
      .slice(0, 5)
  }, [c, tipi])
  const oggiChiave = chiaveGiorno(g0)
  const prossimi = [...(esami ?? [])].filter((e) => e.giorno >= oggiChiave).sort((a, b) => a.giorno.localeCompare(b.giorno)).slice(0, 3)
  const link = [...(collegamenti ?? [])].sort((a, b) => a.ordine - b.ordine || a.titolo.localeCompare(b.titolo))

  return (
    <div className="schermata">
      <header className="intestazione">
        <div>
          <div className="sopratitolo">{anno ? `${anno}° anno di ${impostazioni?.anniSpecializzazione ?? ANNI_PREDEFINITI}` : 'Specializzazione'}</div>
          <h1 className="titolo-grande">Specializzazione</h1>
        </div>
        <div className="riga-azioni">
          <a className="pulsante primario" href="#/specializzazione/logbook?nuova=1">+ Procedura</a>
          <a className="pulsante tondo" href="#/specializzazione/impostazioni" aria-label="Impostazioni della specializzazione"><IconaImpostazioni dimensione={18} /></a>
        </div>
      </header>

      {impostazioni && !impostazioni.inizioSpecializzazione && (
        <div className="scheda">
          <div className="titolo-sezione">Quando hai iniziato?</div>
          <p className="secondario">Con il mese di inizio calcolo da solo l'anno di corso, anche per ogni procedura del logbook.</p>
          <a className="pulsante primario" href="#/specializzazione/impostazioni">Imposta l'inizio</a>
        </div>
      )}

      <div className="tessere">
        <a className="tessera" href="#/turni" style={{ color: 'var(--testo)' }}>
          <span className="secondario piccolo">Rotazione</span>
          <span style={{ fontWeight: 600, fontSize: 17 }}>{area ? TITOLI_AREA[area.area] : '—'}</span>
          <span className="secondario piccolo">{area ? `mese ${area.meseDellaRotazione} di ${MESI_PER_ROTAZIONE}` : 'da scegliere nei Turni'}</span>
        </a>
        <a className="tessera" href="#/turni" style={{ color: 'var(--testo)' }}>
          <span className="secondario piccolo">Ospedale</span>
          <span style={{ fontWeight: 600, fontSize: 17 }}>{nomeOspedale ?? '—'}</span>
          <span className="secondario piccolo">{ospedale ? `mese ${ospedale.meseDelPeriodo} di ${ospedale.periodo.mesi}` : 'da scegliere nei Turni'}</span>
        </a>
        <a className="tessera" href="#/specializzazione/logbook" style={{ color: 'var(--testo)' }}>
          <span className="secondario piccolo">Procedure</span>
          <span className="valore">{c.totale}</span>
          <span className="secondario piccolo">{diQuestAnno !== undefined ? `${diQuestAnno} quest'anno` : 'in totale'}</span>
        </a>
      </div>

      <div className="colonne">
        <div className="principale">
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="intestazione" style={{ alignItems: 'center' }}>
              <h2 className="titolo-sezione">Logbook</h2>
              <a href="#/specializzazione/logbook">Apri ›</a>
            </div>
            <div className="lista">
              {piuFatte.length === 0 && <div className="vuoto">Nessuna procedura registrata. <a href="#/specializzazione/logbook?nuova=1">Aggiungi la prima</a></div>}
              {piuFatte.map((t) => (
                <a key={t.nome} className="riga" href="#/specializzazione/logbook">
                  <span className="crescente"><span style={{ fontWeight: 500 }}>{t.nome}</span><span className="secondario piccolo">{t.primo} da 1° operatore</span></span>
                  <span className="numeri" style={{ fontWeight: 600 }}>{t.totale}</span>
                </a>
              ))}
            </div>
          </section>
        </div>
        <aside className="laterale-destra">
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="intestazione" style={{ alignItems: 'center' }}>
              <h2 className="titolo-sezione">Esami e lezioni</h2>
              <a href="#/specializzazione/esami">Tutti ›</a>
            </div>
            <div className="lista">
              {prossimi.length === 0 && <div className="vuoto piccolo">Niente in programma</div>}
              {prossimi.map((e) => {
                const [a, m, g] = e.giorno.split('-').map(Number)
                return (
                  <a key={e.id} className="riga" href="#/specializzazione/esami">
                    <span className="crescente">
                      <span style={{ fontWeight: 500 }}>{e.titolo}</span>
                      <span className="secondario piccolo">{e.tipo === 'esame' ? 'Esame' : 'Lezione'} · {F.dataBreve(istante(a!, m!, g!, 12))}</span>
                    </span>
                    <IconaAvanti dimensione={14} />
                  </a>
                )
              })}
            </div>
          </section>

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
        </aside>
      </div>

      {modificaLink && <FormCollegamento record={modificaLink.record} ordine={link.length} onChiudi={() => setModificaLink(undefined)} />}
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

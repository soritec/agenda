import { useMemo, useState } from 'react'
import { aggiungiGiorni, istante } from '../../../nucleo/calendario'
import * as F from '../../../nucleo/formati'
import { elimina, ripristina, salva } from '../../../dati/archivio'
import { useCollezione } from '../../../dati/hooks'
import type { ModelloTurno } from '../../../dati/modello'
import { Avviso, Foglio, mostraAvviso } from '../../../interfaccia/componenti'
import { IconaAvanti, IconaIndietro } from '../../../interfaccia/icone'
import { avvisi } from '../controlli'
import { intervallo, intervalloTuttoIlGiorno } from '../orari'
import { TIPI_GIORNATA, TIPI_TURNO, TITOLI_GIORNATA, TITOLI_TIPO_TURNO, tipoGiornataDa, tipoTurnoDa, type TipoGiornata, type TipoTurno } from '../tipi'
import { chiaveGiorno, classeSigla, datiDa, giornoDaChiave, orarioDaMinuti, perId, siglaTurno, titoloTurno, turniPerGiorno } from '../supporto'

/** Ordine dei gruppi di turni tipo nel pannello: prima i più usati. */
const ORDINE_GRUPPI: TipoTurno[] = ['guardiaDiurna', 'guardiaNotturna', 'reparto', 'ambulatorio', 'ecografia', 'salaOperatoria',
  ...TIPI_TURNO.filter((t) => !['guardiaDiurna', 'guardiaNotturna', 'reparto', 'ambulatorio', 'ecografia', 'salaOperatoria'].includes(t))]

/**
 * Pannello di un giorno: si aggiunge un turno con un tocco sul turno tipo, si segnano le giornate
 * (ferie, riposo…) e si passa al giorno prima o dopo senza tornare alla griglia.
 */
export function GiornoRapido({ giorno, onCambia, onChiudi }: { giorno: string | undefined; onCambia: (g: string) => void; onChiudi: () => void }) {
  const turni = useCollezione('turni')
  const modelli = useCollezione('modelliTurno')
  const giornate = useCollezione('ferie')
  const [filtro, setFiltro] = useState('')
  const g = giorno ? giornoDaChiave(giorno) : undefined

  const mappaModelli = useMemo(() => perId(modelli), [modelli])
  const delGiorno = useMemo(() => (giorno ? turniPerGiorno(turni ?? []).get(giorno) ?? [] : []), [turni, giorno])
  const giornata = (giornate ?? []).find((x) => x.giorno === giorno)
  const gruppi = useMemo(() => {
    const testo = filtro.trim().toLowerCase()
    const elenco = [...(modelli ?? [])]
      .filter((m) => !testo || m.sigla.toLowerCase().includes(testo) || m.nome.toLowerCase().includes(testo))
      .sort((a, b) => a.ordine - b.ordine || a.nome.localeCompare(b.nome))
    return ORDINE_GRUPPI.map((tipo) => ({ tipo, voci: elenco.filter((m) => tipoTurnoDa(m.tipo) === tipo) })).filter((x) => x.voci.length > 0)
  }, [modelli, filtro])
  const sovrapposti = useMemo(() => {
    const tutti = (turni ?? []).map(datiDa)
    return delGiorno.filter((t) => avvisi(datiDa(t), tutti).length > 0).map((t) => titoloTurno(t, mappaModelli))
  }, [delGiorno, turni, mappaModelli])

  if (!g || !giorno) return <Foglio aperto={false} titolo="" onChiudi={onChiudi}>{null}</Foglio>
  const mezzogiorno = istante(g.anno, g.mese, g.giorno, 12)

  async function aggiungi(m: ModelloTurno) {
    if (!g) return
    const orari = m.tuttoIlGiorno ? intervalloTuttoIlGiorno(g) : intervallo(g, m.minutoInizio, m.minutoFine)
    const nuovo = await salva('turni', {
      ...orari, tipo: m.tipo, tuttoIlGiorno: m.tuttoIlGiorno, stato: 'pianificato', sedeId: m.sedeId, modelloId: m.id, origine: 'manuale',
    })
    mostraAvviso(`Aggiunto: ${m.nome} · ${F.dataBreve(mezzogiorno)}`, () => void elimina('turni', nuovo.id))
  }

  async function cambiaGiornata(tipo: TipoGiornata) {
    if (!giorno) return
    if (giornata && tipoGiornataDa(giornata.tipo) === tipo) {
      await elimina('ferie', giornata.id)
      mostraAvviso(`Tolto: ${TITOLI_GIORNATA[tipo]}`, () => void ripristina('ferie', giornata.id))
      return
    }
    await salva('ferie', giornata ? { ...giornata, tipo } : { giorno, tipo })
  }

  const sposta = (n: number) => onCambia(chiaveGiorno(aggiungiGiorni(g, n)))

  return (
    <Foglio aperto titolo={F.dataEstesa(mezzogiorno)} onChiudi={onChiudi}
      azione={<button type="button" className="link" style={{ fontSize: 17, fontWeight: 600 }} onClick={onChiudi}>Fine</button>}>
      <div className="giorno-rapido" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="navigazione-giorno">
          <button type="button" className="pulsante" onClick={() => sposta(-1)}><IconaIndietro dimensione={16} /> Giorno prima</button>
          <button type="button" className="pulsante" onClick={() => sposta(1)}>Giorno dopo <IconaAvanti dimensione={16} /></button>
        </div>

        {(delGiorno.length > 0 || giornata) && (
          <div className="lista">
            {giornata && (
              <div className="riga" style={{ cursor: 'default' }}>
                <span className={`etichetta-giornata g-${tipoGiornataDa(giornata.tipo)}`}>{TITOLI_GIORNATA[tipoGiornataDa(giornata.tipo)]}</span>
                <span className="crescente" />
                <button type="button" className="elimina-riga" aria-label={`Togli ${TITOLI_GIORNATA[tipoGiornataDa(giornata.tipo)]}`}
                  onClick={() => void cambiaGiornata(tipoGiornataDa(giornata.tipo))}>×</button>
              </div>
            )}
            {delGiorno.map((t) => {
              const nome = titoloTurno(t, mappaModelli)
              return (
                <div key={t.id} className="riga" style={{ cursor: 'default' }}>
                  <a href={`#/turni/${t.id}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, color: 'var(--testo)' }}>
                    <span className={classeSigla(t.tipo)}>{siglaTurno(t, mappaModelli)}</span>
                    <span className="crescente">
                      <span style={{ fontWeight: 500 }}>{nome}</span>
                      <span className="secondario piccolo numeri">{t.tuttoIlGiorno ? 'Tutto il giorno' : `${F.ora(t.inizio)} – ${F.ora(t.fine)}`}</span>
                    </span>
                  </a>
                  <button type="button" className="elimina-riga" aria-label={`Elimina ${nome}`}
                    onClick={() => void elimina('turni', t.id).then(() => mostraAvviso(`Eliminato: ${nome}`, () => void ripristina('turni', t.id)))}>×</button>
                </div>
              )
            })}
          </div>
        )}
        {sovrapposti.length > 0 && <Avviso>Attenzione: {sovrapposti.join(', ')} si sovrappone a un altro turno.</Avviso>}

        <div className="gruppo-titolo">Giornata</div>
        <div className="scelte-rapide">
          {TIPI_GIORNATA.map((tipo) => (
            <button key={tipo} type="button" className={`scelta-rapida giornata g-${tipo}`} aria-pressed={giornata ? tipoGiornataDa(giornata.tipo) === tipo : false}
              onClick={() => void cambiaGiornata(tipo)}
              style={giornata && tipoGiornataDa(giornata.tipo) === tipo ? { borderColor: 'var(--primario)', borderWidth: 2 } : undefined}>
              <span className={`pallino-giornata g-${tipo}`} />
              <span className="nome">{TITOLI_GIORNATA[tipo]}</span>
            </button>
          ))}
        </div>

        <div className="gruppo-titolo">Aggiungi turno</div>
        {(modelli ?? []).length > 8 && (
          <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Cerca sigla o nome (es. E pom)"
            style={{ minHeight: 40, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--linea-forte)', background: 'var(--superficie)' }} />
        )}
        {(modelli ?? []).length === 0 && (
          <span className="secondario piccolo">Non hai ancora turni tipo: aggiungili da <a href="#/turni/impostazioni" onClick={onChiudi}>Turni tipo e sedi</a>.</span>
        )}
        {gruppi.map(({ tipo, voci }) => (
          <div key={tipo} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="secondario piccolo">{TITOLI_TIPO_TURNO[tipo]}</span>
            <div className="scelte-rapide">
              {voci.map((m) => (
                <button key={m.id} type="button" className="scelta-rapida" onClick={() => void aggiungi(m)}>
                  <span className={classeSigla(m.tipo)} style={{ minWidth: 34 }}>{m.sigla}</span>
                  <span className="nome">
                    {m.nome}
                    {!m.tuttoIlGiorno && <span className="orario numeri" style={{ display: 'block' }}>{orarioDaMinuti(m.minutoInizio)} – {orarioDaMinuti(m.minutoFine)}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <a className="pulsante" href={`#/turni/nuovi?mese=${giorno.slice(0, 7)}&giorni=${giorno}`} onClick={onChiudi}>
          Più giorni insieme o orario personalizzato
        </a>
      </div>
    </Foglio>
  )
}

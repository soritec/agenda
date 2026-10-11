import { useEffect, useState } from 'react'
import { elimina, ripristina, salva, salvaImpostazioni } from '../../../dati/archivio'
import { useCollezione, useImpostazioni } from '../../../dati/hooks'
import { Campo, mostraAvviso } from '../../../interfaccia/componenti'
import { ANNI_PREDEFINITI } from '../logica'

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']

export function ImpostazioniSpecializzazione() {
  const impostazioni = useImpostazioni()
  const tipi = useCollezione('tipiProcedura')
  const procedure = useCollezione('procedure')
  const [nuovo, setNuovo] = useState('')
  const [inizio, setInizio] = useState<{ anno: string; mese: string }>()

  useEffect(() => {
    if (!impostazioni || inizio) return
    const [a = '', m = ''] = (impostazioni.inizioSpecializzazione ?? '').split('-')
    setInizio({ anno: a, mese: m ? String(Number(m)) : '' })
  }, [impostazioni, inizio])

  function salvaInizio(prossimo: { anno: string; mese: string }) {
    setInizio(prossimo)
    const anno = Number(prossimo.anno), mese = Number(prossimo.mese)
    if (anno >= 2000 && anno <= 2100 && mese >= 1 && mese <= 12) {
      void salvaImpostazioni({ inizioSpecializzazione: `${anno}-${String(mese).padStart(2, '0')}` })
    }
  }

  const elenco = [...(tipi ?? [])].sort((a, b) => a.ordine - b.ordine)
  const usati = new Set((procedure ?? []).map((p) => p.tipoId))

  async function aggiungi() {
    const nome = nuovo.trim()
    if (!nome) return
    await salva('tipiProcedura', { nome, ordine: (elenco.at(-1)?.ordine ?? 0) + 1 })
    setNuovo('')
  }

  return (
    <div className="schermata" style={{ maxWidth: 720 }}>
      <header>
        <a href="#/specializzazione" className="piccolo">‹ Specializzazione</a>
        <h1 className="titolo-grande">Impostazioni specializzazione</h1>
      </header>

      <section className="scheda modulo">
        <h2 className="titolo-sezione">Inizio della specializzazione</h2>
        <div className="campi-affiancati">
          <Campo etichetta="Mese">
            <select value={inizio?.mese ?? ''} onChange={(e) => salvaInizio({ anno: inizio?.anno ?? '', mese: e.target.value })}>
              <option value="">—</option>
              {MESI.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </Campo>
          <Campo etichetta="Anno">
            <input inputMode="numeric" value={inizio?.anno ?? ''} placeholder="es. 2024" onChange={(e) => salvaInizio({ anno: e.target.value, mese: inizio?.mese ?? '' })} />
          </Campo>
          <Campo etichetta="Durata (anni)">
            <select value={impostazioni?.anniSpecializzazione ?? ANNI_PREDEFINITI} onChange={(e) => void salvaImpostazioni({ anniSpecializzazione: Number(e.target.value) })}>
              {[4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Campo>
        </div>
        <span className="secondario piccolo">Serve a calcolare l'anno di corso (oggi e per ogni procedura del logbook).</span>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="titolo-sezione">Procedure del logbook</h2>
        <div className="lista">
          {elenco.map((t, i) => (
            <div key={t.id} className="riga" style={{ cursor: 'default' }}>
              <input value={t.nome} aria-label="Nome della procedura"
                onChange={(e) => void salva('tipiProcedura', { ...t, nome: e.target.value })}
                style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', padding: '4px 0', fontSize: 15 }} />
              <label className="secondario piccolo" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={Boolean(t.chirurgica)} onChange={(e) => void salva('tipiProcedura', { ...t, chirurgica: e.target.checked || undefined })} />
                Chirurgica
              </label>
              <button type="button" className="link piccolo" disabled={i === 0} aria-label="Sposta su"
                onClick={() => { const prima = elenco[i - 1]!; void salva('tipiProcedura', { ...t, ordine: prima.ordine }).then(() => salva('tipiProcedura', { ...prima, ordine: t.ordine })) }}>↑</button>
              <button type="button" className="elimina-riga" aria-label={`Elimina ${t.nome}`}
                onClick={() => {
                  if (usati.has(t.id) && !window.confirm(`"${t.nome}" è usata nel logbook: le procedure registrate restano ma senza nome. Eliminarla?`)) return
                  void elimina('tipiProcedura', t.id).then(() => mostraAvviso(`Eliminata: ${t.nome}`, () => void ripristina('tipiProcedura', t.id)))
                }}>×</button>
            </div>
          ))}
        </div>
        <div className="riga-azioni">
          <input value={nuovo} placeholder="Nuova procedura (es. Cerchiaggio)" onChange={(e) => setNuovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void aggiungi() }}
            style={{ flex: 1, minWidth: 200, minHeight: 40, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--linea-forte)', background: 'var(--superficie)' }} />
          <button type="button" className="pulsante primario" disabled={!nuovo.trim()} onClick={() => void aggiungi()}>Aggiungi</button>
        </div>
      </section>
    </div>
  )
}

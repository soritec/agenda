import { useState } from 'react'
import { eliminaCondiviso, ripristinaCondiviso, salvaCondiviso, type Profilo } from '../dati/condiviso'
import { cambiaProfilo, MODULI_NUOVO_PROFILO, PROFILO_PRINCIPALE } from '../dati/profili'
import { mostraAvviso } from './componenti'
import { SEZIONI } from './Guscio'
import { Avatar, COLORI_PROFILO, useProfili } from './profili'

/** Profili (Impostazioni): nomi, colori, sezioni visibili, cambio profilo. */
export function GestioneProfili() {
  const { profili, attivo } = useProfili()
  const [aperto, setAperto] = useState<string>()

  async function salvaProfilo(p: Profilo, modifiche: Partial<Profilo>) {
    // Il profilo principale si salva solo quando gli si dà un nome o lo si modifica.
    await salvaCondiviso('profili', { ...p, ...modifiche, creatoIl: p.creatoIl || Date.now() })
  }
  async function aggiungi() {
    if (!profili.some((p) => p.id === PROFILO_PRINCIPALE && p.creatoIl)) await salvaProfilo(profili[0]!, {})
    const nuovo = await salvaCondiviso('profili', { id: `p-${crypto.randomUUID().slice(0, 8)}`, nome: 'Nuovo profilo', colore: COLORI_PROFILO[profili.length % COLORI_PROFILO.length]!, moduli: MODULI_NUOVO_PROFILO })
    setAperto(nuovo.id)
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 className="titolo-sezione">Profili</h2>
      <span className="secondario piccolo">Ogni profilo ha i suoi dati e le sue sezioni; chat e promemoria sono in comune. Stesso account e stessa password per tutti.</span>
      <div className="lista">
        {profili.map((p) => (
          <div key={p.id} className="riga riga-profilo" style={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar p={p} />
              <input className="campo-in-riga" style={{ fontWeight: 600 }} defaultValue={p.nome} aria-label="Nome del profilo"
                onBlur={(e) => { const n = e.target.value.trim(); if (n && n !== p.nome) void salvaProfilo(p, { nome: n }) }} />
              {p.id === attivo.id
                ? <span className="pillola piccola filtro-attivo">In uso</span>
                : <button type="button" className="pillola piccola" onClick={() => cambiaProfilo(p.id)}>Usa questo profilo</button>}
              <button type="button" className="link piccolo" onClick={() => setAperto(aperto === p.id ? undefined : p.id)}>{aperto === p.id ? 'Chiudi' : 'Modifica'}</button>
              {p.id !== PROFILO_PRINCIPALE && p.id !== attivo.id && (
                <button type="button" className="elimina-task" aria-label={`Togli ${p.nome}`} onClick={() => {
                  if (!window.confirm(`Togliere il profilo "${p.nome}" dall'elenco? I suoi dati restano salvati e si possono recuperare.`)) return
                  void eliminaCondiviso('profili', p.id).then(() => mostraAvviso(`Tolto: ${p.nome}`, () => void ripristinaCondiviso('profili', p.id)))
                }}>×</button>
              )}
            </div>
            {aperto === p.id && (
              <div className="modulo" style={{ paddingTop: 10 }}>
                <div className="riga-azioni">
                  {COLORI_PROFILO.map((c) => <button key={c} type="button" className="campione-colore" aria-label={`Colore ${c}`} aria-pressed={p.colore === c} style={{ background: c }} onClick={() => void salvaProfilo(p, { colore: c })} />)}
                </div>
                <span className="secondario piccolo">Sezioni visibili in questo profilo:</span>
                <div className="riga-azioni">
                  {SEZIONI.filter((s) => s.id !== 'oggi').map((s) => {
                    const attiva = !p.moduli || p.moduli.includes(s.id)
                    return (
                      <button key={s.id} type="button" className={`pillola${attiva ? ' filtro-attivo' : ''}`}
                        onClick={() => {
                          const tutte = SEZIONI.map((x) => x.id as string)
                          const ora = new Set(p.moduli ?? tutte)
                          if (attiva) ora.delete(s.id); else ora.add(s.id)
                          void salvaProfilo(p, { moduli: tutte.filter((x) => ora.has(x)) })
                        }}>{s.titolo}</button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <button type="button" className="pulsante" style={{ alignSelf: 'flex-start' }} onClick={() => void aggiungi()}>+ Aggiungi profilo</button>
    </section>
  )
}

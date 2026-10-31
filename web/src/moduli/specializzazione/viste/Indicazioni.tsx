const REGOLE = [
  { nome: 'Journal club', testo: "Mercoledì alle 7, 3° piano settore A. La presenza è obbligatoria. Uno o due specializzandi, con uno strutturato di riferimento, presentano un argomento di ginecologia." },
  { nome: 'GOI', testo: "Giovedì alle 13, 3° piano settore A: riunione multidisciplinare con oncologi e radiologi. È obbligatoria per chi è di turno AON il giovedì pomeriggio, caldamente consigliata a tutti gli altri. Al I anno il turno GOI del mercoledì pomeriggio serve a preparare i casi del giorno dopo con lo specializzando senior." },
  { nome: 'Lunedì', testo: "Dalle 14 alle 16 riunione di ostetricia, dalle 16 alle 17:30 lezione, che è obbligatoria." },
]

/** Regole della scuola su riunioni e journal club. */
export function Indicazioni() {
  return (
    <details className="tendina-indicazioni">
      <summary>Indicazioni della scuola</summary>
      {REGOLE.map((r) => <p key={r.nome}><strong>{r.nome}.</strong> {r.testo}</p>)}
    </details>
  )
}

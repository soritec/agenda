import { Component, type ReactNode } from 'react'

/** Se una pagina si blocca per un errore, al posto della pagina bianca mostra un messaggio con il dettaglio da copiare. */
export class ErrorePagina extends Component<{ chiave: string; children: ReactNode }, { errore?: Error; chiave: string }> {
  state: { errore?: Error; chiave: string } = { chiave: this.props.chiave }
  static getDerivedStateFromError(errore: Error) { return { errore } }
  // Cambiando pagina il messaggio sparisce e si riprova.
  static getDerivedStateFromProps(p: { chiave: string }, s: { errore?: Error; chiave: string }) { return p.chiave !== s.chiave ? { errore: undefined, chiave: p.chiave } : null }
  render() {
    const e = this.state.errore
    if (!e) return this.props.children
    const dettaglio = `${e.name}: ${e.message}\n${(e.stack ?? '').split('\n').slice(0, 4).join('\n')}`
    return (
      <div className="schermata">
        <div className="scheda" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <strong>Questa pagina si è bloccata</strong>
          <span className="secondario">I tuoi dati sono al sicuro. Copia il dettaglio qui sotto e mandalo a Claude.</span>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>{dettaglio}</pre>
          <div className="riga-azioni">
            <button type="button" className="pulsante" onClick={() => void navigator.clipboard?.writeText(dettaglio)}>Copia il dettaglio</button>
            <button type="button" className="pulsante primario" onClick={() => this.setState({ errore: undefined })}>Riprova</button>
          </div>
        </div>
      </div>
    )
  }
}

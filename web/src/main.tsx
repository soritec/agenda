import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './interfaccia/stile.css'
import { eseguiManutenzione } from './dati/manutenzione'
import { avviaSincronizzazioneAutomatica } from './dati/sincronizzazione'

void eseguiManutenzione().finally(() => avviaSincronizzazioneAutomatica())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

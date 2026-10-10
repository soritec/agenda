import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './interfaccia/stile.css'
import { eseguiManutenzione } from './dati/manutenzione'

void eseguiManutenzione()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

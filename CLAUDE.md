# CLAUDE.md — Agenda (versione web)

App personale (agenda, turni, specializzazione, budget, documenti) come PWA su GitHub Pages.
Questo repository è **pubblico**: contiene solo codice. Note di progetto, spec e dati stanno nel repository
**privato** clonato in `privato/` (ignorato da git qui).

@privato/CLAUDE-personale.md

## Regole
- **Niente informazioni personali in questo repository** (nomi di persone, luoghi di lavoro, università, email): usare nomi generici negli esempi e nei test. Le informazioni personali vanno solo in `privato/`.
- **Mai dati identificativi dei pazienti**: ogni campo di testo libero mostra `NotaPrivacy`.
- **Mai perdere dati**: record con `id` stabile, `modificatoIl`, eliminazione morbida (`eliminatoIl`); ogni modifica all'archivio IndexedDB = nuovo passo in `upgrade` senza toccare i precedenti.
- Offline-first; i dati dell'utente vanno su GitHub solo cifrati (vedi `docs/ARCHITETTURA-WEB.md`).
- Interfaccia in italiano; date solo tramite `web/src/nucleo/calendario.ts` (ora italiana, settimana dal lunedì). Mai `getHours()`/`getDate()`.
- Se una richiesta è ambigua: chiedere, non supporre. Spiegare all'utente in modo semplice.

## Come lavorare
- Node.js in `~/.agenda-tools/node`: `export PATH="$HOME/.agenda-tools/node/bin:$PATH"`. GitHub CLI: `~/.agenda-tools/gh/bin/gh`.
- Codice in `web/`: `npm test` (Vitest, con `TZ=America/New_York`), `npx tsc -b`, `npm run build`, `npm run dev`.
- Pubblicazione: push su `main` → GitHub Actions (`.github/workflows/pubblica.yml`) esegue test e build e pubblica su Pages.
- Logica pura e testata in `src/nucleo`, `src/moduli/*/` (file non `viste/`); viste React in `viste/`; stile solo da `src/interfaccia/stile.css`.
- Un commit per ogni passo verificabile; messaggi in italiano, all'imperativo.

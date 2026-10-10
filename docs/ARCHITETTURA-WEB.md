# Architettura — versione web (decisa il 2026-10-10)

Sostituisce, per ora, la versione nativa Swift (progetto e codice in archivio nel repository privato).
L'app nativa potrà arrivare dopo, importando il backup JSON della versione web.

## Obiettivi
- Una sola web app (PWA) usabile su Mac (browser) e iPhone (collegamento nella schermata Home).
- **Offline-first**: tutti i dati sono sul dispositivo; la sincronizzazione avviene quando c'è rete.
- **Dati dell'utente solo su GitHub, in un repository privato, cifrati** con una password che conosce solo l'utente.
- Nessun server nostro.

## Pezzi
| Pezzo | Scelta |
|---|---|
| Hosting dell'app | GitHub Pages, repository pubblico `agenda` (solo codice, nessun dato) |
| Dati | repository **privato** (`agenda-privato`, cartella `dati/`), un file cifrato per collezione |
| Accesso ai dati | API REST di GitHub (Contents API) con un *fine-grained token* limitato al solo repo dati, inserito dall'utente su ogni dispositivo |
| Cifratura | WebCrypto: AES-GCM 256, chiave derivata dalla password con PBKDF2-SHA256 (600.000 iterazioni), sale e IV casuali per file |
| Archivio locale | IndexedDB |
| Offline | Service worker + manifest (installabile su iPhone e Mac) |
| Linguaggio | TypeScript |
| Interfaccia | React + Vite |
| Test | Vitest (calcoli, cifratura, fusione dei dati, export) |
| Pubblicazione | GitHub Actions → GitHub Pages a ogni push su `main` |

## Sincronizzazione
- Ogni record ha `id` (UUID), `modificatoIl` e, se cancellato, `eliminatoIl` (record "lapide", mai cancellazione fisica immediata).
- Sincronizzazione: scarica i file remoti → decifra → **fonde per id, vince `modificatoIl` più recente** → cifra → carica con lo `sha` letto (se nel frattempo è cambiato, si riparte dal download). Nessuna perdita silenziosa: ogni conflitto è risolto per record, non per file.
- Il token e la password restano solo sul dispositivo (IndexedDB), mai nel codice né su GitHub.
- Backup: export JSON completo (non cifrato o cifrato, a scelta) + ripristino.

## Limiti accettati rispetto alla spec nativa
- Calendario Apple: niente scrittura diretta; export `.ics` da importare (e in futuro, eventualmente, un calendario in abbonamento).
- Face ID: sostituito da un blocco con la password (o PIN) dell'app; valutare WebAuthn più avanti.
- Widget, Siri, scansione con OCR: non disponibili sul web o rimandati.

## Struttura delle cartelle (proposta)
```
web/
├── index.html
├── public/            # icone, manifest
├── src/
│   ├── nucleo/        # calendario it-IT, festività, formati, aree, moduli
│   ├── dati/          # IndexedDB, cifratura, sincronizzazione GitHub, backup
│   ├── moduli/
│   │   ├── turni/     # logica (porting da Swift) + viste
│   │   └── attivita/
│   ├── export/        # CSV, PDF, ICS
│   └── interfaccia/   # design system (colori dell'anteprima), componenti, layout iPhone/Mac
└── test/
```

## Prerequisiti sul Mac
- Node.js (non installato al 2026-10-10; Homebrew assente). Serve per sviluppo e test; l'utente non deve usarlo.
- Account GitHub dell'utente.

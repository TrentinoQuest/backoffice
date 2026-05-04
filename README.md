# Trentino Quest — Backoffice

[![CI](https://github.com/TrentinoQuest/backoffice/actions/workflows/ci.yml/badge.svg)](https://github.com/TrentinoQuest/backoffice/actions/workflows/ci.yml)

Pannello amministrativo web di **Trentino Quest**, app gamificata per l'esplorazione del Trentino.

Progetto del corso di **Ingegneria del Software** (a.a. 2025-2026), Università degli Studi di Trento, Prof. Sandro Fiore.
**Gruppo 19**: Valerio Cancemi (242804), Federico Caposano (243138).

## Stack tecnologico

- **Framework**: Angular 20 (standalone components)
- **Linguaggio**: TypeScript 5.x con strict mode
- **Build tool**: Angular CLI
- **Target**: browser desktop

## Architettura

L'applicazione racchiude in un singolo repository i due componenti frontend amministrativi del Deliverable D2:

- **BackofficeWebApp** — interfaccia per l'Amministratore: gestione delle quest, approvazione delle richieste di affiliazione delle Attività Locali, dashboard analitica sui flussi turistici
- **OperatorApp** — interfaccia per l'Operatore Manutenzione: piazzamento fisico dei QR code, aggiornamento posizioni GPS, segnalazione QR code mancanti o danneggiati

I due componenti del D2 sono fusi in una singola Single Page Application Angular per pragmatismo operativo: condividono autenticazione, layout, mappe, accesso alle API, e team di sviluppo. La separazione logica è garantita da role-based routing: ogni rotta è protetta da guard che verificano il ruolo dell'utente autenticato (`UserRole.ADMIN` o `UserRole.MAINTENANCE`) e impediscono l'accesso all'area non di competenza.

La struttura interna riflette questa organizzazione:

```
src/app/
├── app.ts, app.html, app.config.ts  # shell dell'applicazione
├── app.routes.ts                    # routing principale
├── core/                            # servizi e guard singleton (una sola istanza)
│   ├── guards/                      # auth guard, role guard
│   ├── services/                    # auth service, api service
│   └── interceptors/                # JWT interceptor, error interceptor
├── shared/                          # componenti riutilizzabili
│   ├── components/                  # data table, chart, map view
│   └── pipes/
├── layout/                          # shell desktop (sidebar, header, footer)
└── features/
    ├── admin/                       # area Amministratore (in arrivo)
    └── operator/                    # area Operatore Manutenzione (in arrivo)
```

Le features verranno popolate progressivamente con le pagine corrispondenti ai requisiti funzionali del Deliverable D1: gestione quest (RF35), gestione QR code (RF33-RF34), approvazione affiliazioni (RF38), dashboard analitica (RF39), operazioni di manutenzione QR (RF40-RF45).

## Avvio rapido

Requisiti: Node.js >= 22, npm.

```bash
# 1. Installa le dipendenze
npm install

# 2. Avvia l'app in modalità sviluppo
npm start
```

L'app è disponibile su `http://localhost:4200` con auto-reload sulle modifiche.

## Script disponibili

| Comando                | Descrizione                                |
| ---------------------- | ------------------------------------------ |
| `npm start`            | Avvia l'app in modalità sviluppo           |
| `npm run build`        | Compila l'app per produzione               |
| `npm run watch`        | Build in watch mode per sviluppo           |
| `npm test`             | Esegue gli unit test con Karma             |
| `npm run lint`         | Esegue ESLint su tutti i file `.ts`        |
| `npm run lint:fix`     | ESLint con auto-fix                        |
| `npm run format`       | Formatta il codice con Prettier            |
| `npm run format:check` | Verifica la formattazione senza modificare |
| `npm run typecheck`    | Verifica i tipi TypeScript senza compilare |

## Comunicazione con il backend

L'applicazione comunica con il backend tramite chiamate REST documentate nello schema OpenAPI del repository [`trentino-quest-backend`](https://github.com/TrentinoQuest/backend). I tipi TypeScript dei contratti API sono importati dal pacchetto condiviso [`@trentino-quest/shared-types`](https://github.com/TrentinoQuest/shared-types).

```typescript
import type { Quest, Business, AuthResponse } from '@trentino-quest/shared-types';
```

Modificare un contratto API significa aggiornare i tipi nel pacchetto `shared-types`, pubblicarli, e reinstallare nel backoffice con `npm install`. TypeScript segnalerà automaticamente eventuali punti del codice da adattare.

## Struttura del repository del progetto

Trentino Quest è organizzato come polyrepo:

- [`trentino-quest-docs`](https://github.com/TrentinoQuest/docs) — Deliverable D1, D2, ADR architetturali
- [`trentino-quest-backend`](https://github.com/TrentinoQuest/backend) — Backend Express + MongoDB
- [`trentino-quest-shared-types`](https://github.com/TrentinoQuest/shared-types) — DTO TypeScript condivisi
- [`trentino-quest-mobile`](https://github.com/TrentinoQuest/mobile) — App mobile Ionic + Angular + Capacitor
- **trentino-quest-backoffice** — questo repository

## Convenzioni di sviluppo

Il progetto segue **Conventional Commits**:

- `feat:` nuova funzionalità
- `fix:` correzione di bug
- `chore:` modifiche di setup, configurazione, manutenzione
- `docs:` aggiornamenti alla documentazione
- `refactor:` modifiche al codice senza cambi funzionali
- `test:` aggiunta o modifica di test
- `style:` modifiche di formattazione

ESLint e Prettier sono configurati con regole identiche agli altri repository TypeScript del progetto (backend, mobile, shared-types) per garantire coerenza stilistica.

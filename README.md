# invest-pal

An educational paper-trading platform. It pairs a virtual portfolio with
predictive analysis based on W.D. Gann's methods (Gann angles, Square of Nine,
time cycles) and translates the output into plain language for beginners.

Everything here is virtual money and educational content — not financial advice.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS v4, shadcn/ui (radix / nova preset) |
| Routing | React Router |
| Backend & data | Supabase (Postgres, Auth, Edge Functions) — *Phase 2* |
| Gann engine | Python — *Phase 4* |
| AI mentor | OpenRouter — *Phase 6* |

## Getting started

```bash
npm install
cp .env.example .env   # fill in as later phases need them
npm run dev
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run lint` | Run oxlint |
| `npm run preview` | Preview the production build |

## Project structure

```
src/
  components/
    layout/      App shell, shared page scaffolding
    ui/          shadcn/ui primitives (generated — edit with care)
  pages/         Route-level screens
  services/      API clients (Supabase, market data, Gann, OpenRouter)
  hooks/         Reusable React hooks
  lib/           Framework-agnostic helpers (env, formatting, cn)
  types/         Shared domain types
```

The `@/` import alias maps to `src/` (configured in `vite.config.ts` and
`tsconfig.app.json`).

## Roadmap

- [x] **Phase 1** — Project setup: Vite + React + TypeScript, Tailwind, shadcn/ui
- [ ] **Phase 2** — Supabase schema, auth, $100,000 starting virtual balance
- [ ] **Phase 3** — Market data integration and candlestick charting
- [ ] **Phase 4** — Gann engine (angles, Square of Nine, cycle analysis)
- [ ] **Phase 5** — Paper trading engine (long/short, PnL, portfolio dashboard)
- [ ] **Phase 6** — AI mentor that explains signals in two sentences

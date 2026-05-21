# Deriv AI Market Analyst

A smart AI-powered Deriv market analysis web dashboard for studying synthetic indices and forex. Streams live market data from Deriv's WebSocket API, runs a full technical analysis engine, and integrates with a local AI model (Ollama/llama.cpp) for natural-language market reasoning. When AI is offline, falls back to rule-based analysis.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at /api)
- `pnpm --filter @workspace/deriv-analyst run dev` — run the frontend (served at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + TailwindCSS + lightweight-charts (candlestick) + recharts (indicators) + Zustand (state)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- AI: Ollama/llama.cpp local inference with rule-based fallback

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — DB tables: marketData, predictions, aiAnalysis, memory
- `artifacts/api-server/src/lib/indicators.ts` — RSI, MACD, EMA, SMA, Bollinger Bands, ATR, Stochastic
- `artifacts/api-server/src/lib/derivWs.ts` — Deriv WebSocket candle/tick fetching with cache
- `artifacts/api-server/src/lib/aiService.ts` — AI inference (Ollama/llama.cpp) + rule-based fallback
- `artifacts/api-server/src/routes/` — REST endpoints for market, indicators, analysis, predictions, memory, ai
- `artifacts/deriv-analyst/src/` — React frontend: pages/, store.ts (Zustand), App.tsx

## Architecture decisions

- Deriv WebSocket data is fetched per-request with an in-memory cache (TTL = 1 granularity period); no persistent WS connection to keep it lightweight
- AI analysis is cached for 5 minutes per symbol to avoid hammering the local model
- When local AI (Ollama/llama.cpp) is offline, a deterministic rule-based engine calculates rise/fall probabilities from indicator signals
- PostgreSQL is used for predictions, AI analysis history, and learning memory; market data is not persisted (streamed from Deriv)
- All indicator math runs on the API server — frontend receives pre-calculated values only

## Product

- **Live Market Dashboard** — candlestick chart, current price, trend/volatility/momentum badges, spike detection, support/resistance levels
- **Technical Indicators** — RSI gauge, MACD, EMA alignment, Bollinger Bands, Stochastic, ATR, trend strength
- **AI Analysis Panel** — natural-language reasoning, rise/fall probability bars, confidence meter, signals & warnings
- **Predictions & Accuracy** — record and track directional predictions vs actual outcomes
- **Learning Memory** — AI learns from past prediction outcomes to refine future analysis

## User preferences

- Dark theme forced by default
- For analysis/learning only — never guarantees profits or places trades
- Symbols default to R_100 (Volatility 100 Index)

## Gotchas

- Always run `pnpm --filter @workspace/db run push` after schema changes
- Always run `pnpm --filter @workspace/api-spec run codegen` after openapi.yaml changes, then `pnpm run typecheck:libs`
- lightweight-charts v5 uses `chart.addSeries(CandlestickSeries, options)` — not the old `chart.addCandlestickSeries()`
- AI local server expected at `AI_BASE_URL` env (default: `http://localhost:11434` for Ollama). App works without it.
- Deriv API uses app_id=1089 (public demo app). For production, register your own app_id at developers.deriv.com

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Deriv API docs: https://api.deriv.com/
- Ollama: https://ollama.com/

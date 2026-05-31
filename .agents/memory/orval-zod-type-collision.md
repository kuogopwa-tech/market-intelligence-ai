---
name: Orval Zod+TypeParams Collision
description: TS2308 ambiguous re-export when OpenAPI route has both path AND query params
---

## The Rule
When an OpenAPI endpoint has **both** a path parameter (e.g. `{symbol}`) AND a query parameter (e.g. `limit`), Orval generates:
- `api.ts` (Zod output): a Zod schema const named `GetXParams` (for path params)
- `types/getXParams.ts` (types output): a TypeScript type alias named `GetXParams` (for query params)

Both land in `lib/api-zod/src/index.ts` via `export *`, causing `TS2308: has already exported a member named 'GetXParams'`.

**Why:** Orval names both exports after the operationId+Params pattern, with no disambiguation between path and query param groups.

**How to apply:** When adding a new OpenAPI route that has a `{param}` in the path AND query params, either:
1. **Remove optional query params from the spec** (preferred) — handle defaults in the route handler code. This is clean and avoids future regeneration surprises.
2. Or use a different operationId naming strategy in the Orval config (more complex).

Routes with ONLY path params (no query params) — fine.
Routes with ONLY query params (no path params) — fine.
Routes with BOTH — conflict.

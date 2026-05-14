# Stage 4Z — Self-hosted product readiness

Stage 4Z closes the Stage 4 self-hosted line with a single product-readiness
contract. The goal is explicit: Dermatolog Pro must be deployable as one
server-owned product made of frontend, backend, PostgreSQL, object storage,
local auth/RBAC, clinical workflows, Device Bridge operations, backup/restore,
observability, and release gates.

## Contract

- Runtime endpoint: `GET /api/v1/product/readiness`.
- OpenAPI: `/openapi.stage4z.json`.
- UI surface: `/sys/self-hosted-ops`, section `Product readiness`.
- CI/preflight: `npm run preflight:stage4z`.
- Full local gate: `npm run preflight:all`.

The endpoint is system-admin only and records `product.readiness.read` in the
append-only audit log. It returns safe metadata only:

- product boundary;
- readiness capabilities;
- required deployment gates;
- OpenAPI contract list;
- privacy and redaction policy.

## Self-hosted product boundary

Allowed:

- static frontend served by nginx;
- Node self-hosted backend;
- operator-owned PostgreSQL;
- operator-owned object storage or local filesystem object storage;
- backend-owned Device Bridge worker process;
- local backup, restore, deploy smoke, and rollback drill scripts.

Forbidden:

- Supabase runtime coupling;
- hosted Edge Functions;
- managed third-party database runtime dependency;
- browser WebUSB/WebBluetooth/WebSerial access from the UI;
- exposing tokens, passwords, raw request bodies, patient names, object keys,
  storage paths, signed URLs, or raw environment values.

## Required release gates

Run before promoting a server deployment:

```bash
npm run preflight:stage4z
npm run preflight:all
npm run smoke:stage4k
npm run deploy:stage4m:post-deploy:dry-run
npm run deploy:stage4m:backup-after-deploy:dry-run
npm run deploy:stage4m:rollback-drill:dry-run
```

Expected:

- all commands exit 0;
- `node scripts/check-no-deno-locks.mjs` remains green;
- `package-lock.json` remains unchanged unless dependency changes are
  intentional;
- product readiness UI shows `Managed runtime: none` and
  `Managed database: none`.

## Verification

```bash
npm run test:stage4z
npm run check:stage4z
npm run preflight:stage4z
npm run e2e:stage4z
```

`check:stage4z` verifies route contracts, OpenAPI 4Z, UI/client wiring,
workflow wiring, docs, package scripts, `preflight:all` wiring, and the
self-hosted product boundary.

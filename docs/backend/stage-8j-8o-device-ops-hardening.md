# Stage 8J-8O · Device Bridge production readiness and operations handbook

## Scope

Stage 8J-8O is the first x2 product batch after the batch-size change. It
bundles six related stages into one Pull request:

- Stage 8J: backend Device Bridge production readiness projection.
- Stage 8K: production readiness UI on `/sys/devices`.
- Stage 8L: deterministic drift guard and preflight.
- Stage 8M: server operations handbook manifest.
- Stage 8N: operations handbook renderer and Lovable sync prompt.
- Stage 8O: handbook guard, workflow, and project-memory update.

## Runtime contract

The backend exposes:

- `GET /api/v1/device-bridge-worker/production-readiness`
- `GET /openapi.stage8j-8o.json`

The readiness endpoint is system-admin only. It aggregates existing
self-hosted Device Bridge signals from Stage 4U-4Y:

- worker telemetry;
- hardening;
- recovery;
- command audit/replay;
- audit export metadata.

The endpoint returns safe metadata only. It does not expose worker payloads,
result payloads, tokens, raw patient names, signed URLs, or storage paths.

## UI contract

`/sys/devices` renders a "Stage 8J-8L · Production readiness" panel when a
self-hosted session token exists. The panel shows:

- readiness status and completion percent;
- safe operational counters;
- readiness gates;
- the product boundary note.

Demo mode remains local and does not claim live Device Bridge readiness.

## Server operations handbook

The Stage 8M-8O handbook lives in:

- `deploy/self-hosted/operations-handbook.stage8m-8o.json`
- `scripts/stage8m-8o-server-operations-handbook.mjs`

The renderer produces a repository-bundled handoff with daily checks, incident
boundaries, deployment boundaries, preflight commands, and a post-merge
Lovable sync prompt. It is metadata only and does not include live server
secrets or raw runtime payloads.

## Verification

Run:

```bash
npm run preflight:stage8j-8o
npm run handbook:stage8m-8o:dry-run
npm run check:project-memory
node scripts/check-no-deno-locks.mjs
```

`preflight:stage8j-8o` runs the backend service tests, route tests, frontend
adapter/page tests, handbook tests, guard tests, Stage 4Y and Stage 8G-8I
regression preflights, project-memory tests, and the deno-lock guard.

## Product boundary

- Managed runtime/database dependency: none.
- Database: local PostgreSQL.
- Object storage: local self-hosted object store.
- Browser hardware API coupling: none.
- External Device Bridge worker runtime dependency: none for product startup;
  worker state is read from local PostgreSQL.
- CRM/ad/scheduling systems remain inbound/import sources only.
- Worker payload visibility: backend-only.

The protected files are scanned for managed-runtime markers, Supabase markers,
browser hardware APIs, signed URLs, storage paths, raw worker payload fields,
and raw patient names.

## Lovable sync

Only send the Lovable prompt after the Pull request is merged into `main` and
local `main` has been verified. The expected response is:

```text
Confirmed: Stage 8J-8O synced from main, no conflicts.
```

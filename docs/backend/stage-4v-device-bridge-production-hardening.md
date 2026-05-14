# Stage 4V — Device Bridge production hardening

Stage 4V hardens the self-hosted Device Bridge worker runtime for production
operation while keeping hardware access outside the browser.

## Scope

- Backend endpoint: `GET /api/v1/device-bridge-worker/hardening`.
- Frontend surface: `/sys/devices`, section `Device Bridge worker production hardening`.
- OpenAPI: `/openapi.stage4v.json`.
- Database migration: `0011_stage4v_device_bridge_production_hardening.sql`.
- CI/preflight: `npm run preflight:stage4v`.

## Backend contract

Stage 4V adds backend-owned lifecycle metadata to `device_bridge_commands`:

- `idempotency_key`;
- `attempt_count`;
- `lifecycle_revision`;
- `last_polled_at`;
- `next_attempt_at`;
- `expires_at`;
- `cleanup_after`;
- `last_worker_error`.

Worker polling now respects `next_attempt_at` and `expires_at`, increments
`attempt_count`, and sets a capped backoff window. Worker lifecycle updates are
idempotent: repeated ack/complete/fail calls for the same command return the
current safe command projection instead of leaking backend internals.

The hardening endpoint is protected by the normal self-hosted JWT session and
the `system_admin` role. It returns only safe metadata:

- stale worker count;
- retrying command count;
- backoff-delayed command count;
- maximum queue age in seconds;
- retention cleanup candidate count;
- per-bridge stale/retry/backoff summaries.

It does not expose worker tokens, raw command payloads, raw command results,
storage paths, patient names, signed URLs, driver payloads, or browser hardware
access.

## Frontend behavior

When a self-hosted session is present, `/sys/devices` loads:

- device bridges via `/api/v1/device-bridges`;
- devices via `/api/v1/devices`;
- worker observability via `/api/v1/device-bridge-worker/status`;
- worker hardening via `/api/v1/device-bridge-worker/hardening`.

The hardening panel shows production readiness signals:

- stale workers;
- retrying commands;
- backoff-delayed commands;
- maximum queue age;
- retention cleanup candidates;
- current hardening policy.

Without a self-hosted session the page stays in existing demo mode and does not
call the backend.

## Self-hosted product boundary

This is the self-hosted product boundary for Stage 4V.

Stage 4V keeps the product deployable as one owned stack:

- frontend served by the bundled app;
- backend Node service;
- PostgreSQL database;
- local object storage;
- optional local Device Bridge worker process.

No Supabase runtime, Edge Functions, managed database calls, browser WebUSB,
WebBluetooth, or WebSerial access are added.

## Verification

```bash
npm run preflight:stage4v
npm run typecheck
npm run preflight:stage4u
npm run e2e:stage4v
node scripts/check-no-deno-locks.mjs
```

Expected:

- backend route tests pass for hardening metrics and RBAC denial;
- worker repository tests cover backoff/idempotency/retention SQL;
- frontend tests pass for live hardening rendering;
- guard rejects managed-runtime coupling and browser hardware APIs;
- `package-lock.json` is unchanged;
- no `deno.lock` files exist.

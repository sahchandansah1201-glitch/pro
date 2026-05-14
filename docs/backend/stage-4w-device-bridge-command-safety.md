# Stage 4W — Device Bridge command safety

Stage 4W adds a recovery surface for commands that were leased by a local
Device Bridge worker but did not finish cleanly. It keeps recovery decisions in
the self-hosted backend and never moves raw hardware payloads into the browser.

## Scope

- Backend endpoint: `GET /api/v1/device-bridge-worker/recovery`.
- Backend endpoint: `POST /api/v1/device-bridge-worker/commands/{commandId}/recovery`.
- Frontend surface: `/sys/devices`, section `Device Bridge command recovery`.
- OpenAPI: `/openapi.stage4w.json`.
- Database migration: `0012_stage4w_device_bridge_command_safety.sql`.
- CI/preflight: `npm run preflight:stage4w`.

## Backend contract

Stage 4W adds backend-owned safety metadata to `device_bridge_commands`:

- `lease_owner`;
- `lease_expires_at`;
- `recovery_action`;
- `recovery_reason`;
- `recovery_requested_at`;
- `recovered_by`.

Worker polling sets a short lease on commands returned to the worker. Lifecycle
updates clear lease metadata when a command is acknowledged, completed, or
failed. The recovery projection classifies commands into safe operational
states:

- expired active lease;
- retryable failed command;
- cancellable queued command;
- recently leased command.

`system_admin` can reschedule a retryable/stuck command back to `queued` or
cancel a command that should not run. Both actions write audit events:

- `device_bridge.command.reschedule`;
- `device_bridge.command.cancel`;
- `device_bridge.worker.recovery.read`.

The recovery endpoints return only operational metadata. They do not expose
worker tokens, raw command payloads, raw command results, storage paths, patient
names, signed URLs, driver payloads, object keys, or browser hardware access.

## Frontend behavior

When a self-hosted session is present, `/sys/devices` now loads:

- device bridges via `/api/v1/device-bridges`;
- devices via `/api/v1/devices`;
- worker observability via `/api/v1/device-bridge-worker/status`;
- worker hardening via `/api/v1/device-bridge-worker/hardening`;
- command recovery via `/api/v1/device-bridge-worker/recovery`.

The recovery panel shows:

- stuck command count;
- expired lease count;
- retryable failed command count;
- cancellable command count;
- current lease/recovery policy;
- a safe queue projection with command id, bridge code, command kind, status,
  age, attempts, and recovery state.

The UI can ask the backend to `reschedule` or `cancel` a command. It updates the
local safe queue projection after a successful backend response. Without a
self-hosted session the page stays in existing demo mode and does not call the
backend.

## Self-hosted product boundary

This is the self-hosted product boundary for Stage 4W.

The deployable product remains one owned stack:

- frontend served by the bundled app;
- backend Node service;
- PostgreSQL database;
- local object storage;
- local Device Bridge worker process.

No Supabase runtime, Edge Functions, managed database calls, browser WebUSB,
WebBluetooth, WebSerial, or third-party command queue services are added.

## Verification

```bash
npm run preflight:stage4w
npm run typecheck
npm run preflight:stage4v
npm run e2e:stage4w
node scripts/check-no-deno-locks.mjs
```

Expected:

- backend route tests pass for recovery list/action and RBAC denial;
- worker repository tests cover lease metadata and recovery SQL;
- frontend tests pass for live recovery rendering and action handling;
- e2e smoke covers the recovery panel and a reschedule action;
- guard rejects managed-runtime coupling and browser hardware APIs;
- `package-lock.json` is unchanged;
- no `deno.lock` files exist.

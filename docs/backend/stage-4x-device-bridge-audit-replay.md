# Stage 4X — Device Bridge audit replay

Stage 4X adds a safe command audit and replay surface for the self-hosted Device
Bridge. It lets `system_admin` review append-only command lifecycle events and
queue a backend-owned replay of a completed, failed, or cancelled command
without exposing raw command payloads to the browser.

## Scope

- Backend endpoint: `GET /api/v1/device-bridge-worker/audit`.
- Backend endpoint: `POST /api/v1/device-bridge-worker/commands/{commandId}/replay`.
- Frontend surface: `/sys/devices`, section `Device Bridge command audit and replay`.
- OpenAPI: `/openapi.stage4x.json`.
- Database migration: `0013_stage4x_device_bridge_audit_replay.sql`.
- CI/preflight: `npm run preflight:stage4x`.

## Backend contract

The audit endpoint reads from the append-only `audit_log` table and joins the
safe command, bridge, and device metadata needed for operations review. It does
not select or return raw `audit_log.metadata_json`, raw command payloads, worker
results, object keys, signed URLs, patient names, or worker secrets.

The replay endpoint is intentionally backend-owned:

- `system_admin` is required through the existing ops scope.
- The source command must be in a terminal status: `completed`, `failed`, or
  `cancelled`.
- The source command type must be allow-listed: `bridge_health_check` or
  `device_calibration_request`.
- PostgreSQL clones the source command payload server-side into a new queued
  command and records `replay_of_command_id`, `replay_requested_at`,
  `replay_requested_by`, and `replay_policy`.
- The API response returns only the safe queued-command projection.

Audit events:

- `device_bridge.command.audit.read`;
- `device_bridge.command.replay`.

## Frontend behavior

When a self-hosted session is present, `/sys/devices` loads the Stage 4X audit
projection after the existing registry, worker runtime, hardening, and recovery
panels. The panel shows:

- total command audit events;
- replay event count;
- recovery event count;
- affected command count;
- replay policy and allow-listed command types;
- a safe event list with action, command type, bridge code, command status, and
  lifecycle revision.

The `Replay` action posts to the backend replay endpoint. The UI never reads or
displays command payloads, result bodies, storage paths, patient identifiers, or
worker tokens.

## Self-hosted product boundary

This is the self-hosted product boundary for Stage 4X.

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
npm run preflight:stage4x
npm run typecheck
npm run preflight:stage4w
npm run e2e:stage4x
node scripts/check-no-deno-locks.mjs
```

Expected:

- backend repository/service/route tests pass for safe audit projection, replay
  policy, RBAC denial, validation, and audit events;
- frontend tests pass for audit rendering and replay action handling;
- e2e smoke covers the audit panel and replay action;
- guard rejects managed-runtime coupling and browser hardware APIs;
- `package-lock.json` is unchanged;
- no `deno.lock` files exist.

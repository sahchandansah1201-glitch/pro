# Stage 4U — Device Bridge worker observability

Stage 4U makes the Stage 4T local Device Bridge worker visible to system
administrators without moving hardware control into the browser.

## Scope

- Backend endpoint: `GET /api/v1/device-bridge-worker/status`.
- Frontend surface: `/sys/devices`, section `Device Bridge worker observability`.
- OpenAPI: `/openapi.stage4u.json`.
- CI/preflight: `npm run preflight:stage4u`.

## Backend contract

The status endpoint is protected by the normal self-hosted JWT session and the
`system_admin` role. It reads only PostgreSQL tables owned by the self-hosted
product:

- `device_bridges`
- `device_bridge_commands`
- `medical_devices`
- `clinics`

The response contains safe lifecycle metadata:

- worker status and heartbeat timestamps;
- worker version and host name;
- bridge command counters;
- recent command status rows.

The endpoint does not expose `DEVICE_BRIDGE_WORKER_TOKEN`, command
`payload_json`, command `result_json`, storage paths, patient names, signed
URLs, driver payloads, or browser hardware access.

## Frontend behavior

When a self-hosted session is present, `/sys/devices` loads:

- device bridges via `/api/v1/device-bridges`;
- devices via `/api/v1/devices`;
- worker observability via `/api/v1/device-bridge-worker/status`.

The UI shows:

- bridge worker counts;
- online/degraded/offline worker counts;
- queued/failed command counts;
- heartbeat list;
- recent command lifecycle list.

Without a self-hosted session the page stays in existing demo mode and does not
call the backend.

## Self-hosted product boundary

This is the self-hosted product boundary for Stage 4U.

Stage 4U keeps the product deployable as one owned stack:

- frontend served by the bundled app;
- backend Node service;
- PostgreSQL database;
- local object storage;
- optional local Device Bridge worker process.

No Supabase runtime, Edge Functions, managed database calls, browser WebUSB,
WebBluetooth, or WebSerial access are added.

## Verification

```bash
npm run preflight:stage4u
npm run typecheck
npm run preflight:stage4t
node scripts/check-no-deno-locks.mjs
```

Expected:

- backend route tests pass for worker telemetry and RBAC denial;
- frontend tests pass for live worker status rendering;
- guard rejects managed-runtime coupling and browser hardware APIs;
- `package-lock.json` is unchanged;
- no `deno.lock` files exist.

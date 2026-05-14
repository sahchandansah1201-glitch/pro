# Stage 4T — Device Bridge worker runtime

Stage 4T adds the first local worker runtime for the Stage 4S Device Bridge
contract. The backend already owns the command queue; this stage gives the
server/operator a process that can send heartbeat, poll commands, acknowledge
work, and complete or fail commands.

The worker is intentionally conservative. It runs outside the browser, talks to
the self-hosted backend, and ships with a noop hardware adapter. Real device
drivers can be added later behind this adapter boundary without changing the
browser UI or adding managed services.

## 1. Runtime files

- Worker CLI: `worker/device-bridge/worker.mjs`
- Unit tests: `worker/device-bridge/worker.test.mjs`
- Worker README: `worker/device-bridge/README.md`
- Environment template:
  `deploy/self-hosted/device-bridge-worker.stage4t.env.example`
- systemd unit:
  `deploy/self-hosted/device-bridge-worker.stage4t.service`

## 2. Required environment

```bash
SELF_HOSTED_API_BASE_URL=http://127.0.0.1:3001
DEVICE_BRIDGE_WORKER_TOKEN=replace-me-with-64-random-characters-worker-token
DEVICE_BRIDGE_CLINIC_ID=10000000-0000-4000-8000-000000000001
DEVICE_BRIDGE_CODE=br-live-01
```

The token is the same backend-local `DEVICE_BRIDGE_WORKER_TOKEN` introduced in
Stage 4S. It is not a user JWT and must not be exposed to frontend code.

## 3. Commands

```bash
npm run worker:stage4t:dry-run
npm run worker:stage4t:once
npm run worker:stage4t:loop
```

Dry-run prints the planned backend endpoints and redacts the worker token.

`once` performs one cycle:

1. `POST /api/v1/device-bridge-worker/heartbeat`
2. `GET /api/v1/device-bridge-worker/commands`
3. `PATCH /api/v1/device-bridge-worker/commands/{commandId}` with
   `acknowledged`
4. Executes through the local adapter
5. `PATCH /api/v1/device-bridge-worker/commands/{commandId}` with
   `completed` or `failed`

`loop` repeats the same cycle using `DEVICE_BRIDGE_POLL_INTERVAL_MS`.

## 4. Adapter boundary

The built-in adapter is `stage4t-noop-adapter`:

- `bridge_health_check` completes successfully.
- `device_calibration_request` and `device_stream_open_request` fail with
  `adapter_missing` until a clinic-owned hardware adapter is installed.

This avoids pretending that hardware work happened when no device driver exists.

## 5. Verification

Run:

```bash
npm run preflight:stage4t
```

This executes:

- `worker/device-bridge/worker.test.mjs`
- `scripts/check-stage4t-device-bridge-worker-runtime.test.mjs`
- `scripts/check-stage4t-device-bridge-worker-runtime.mjs`
- `scripts/check-no-deno-locks.mjs`

`scripts/preflight-all.mjs` also includes
`Stage 4T Device Bridge worker runtime preflight`.

## 6. CI

Workflow:

```text
.github/workflows/stage4t-device-bridge-worker-runtime.yml
```

It runs `npm run preflight:stage4t` and writes a GitHub Actions summary.

## 7. Product boundary

Stage 4T keeps the project deployable as a single self-hosted product:

- PostgreSQL and the self-hosted backend remain the system of record.
- The local worker is controlled by the deployment owner.
- There is no Supabase runtime dependency.
- There are no `api-read`, `api-write`, or Edge Function calls.
- Browser code does not use WebUSB, WebBluetooth, or WebSerial.

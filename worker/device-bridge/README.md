# Stage 4T Device Bridge Worker

This worker is a local process for the self-hosted Dermatolog Pro deployment.
It talks to the Stage 4S backend worker contract and never runs inside the
browser.

## Required environment

```bash
SELF_HOSTED_API_BASE_URL=http://127.0.0.1:3001
DEVICE_BRIDGE_WORKER_TOKEN=replace-me-worker-token
DEVICE_BRIDGE_CLINIC_ID=10000000-0000-4000-8000-000000000001
DEVICE_BRIDGE_CODE=br-live-01
```

Optional:

```bash
DEVICE_BRIDGE_HOST_NAME=clinic-bridge-01
DEVICE_BRIDGE_WORKER_VERSION=stage4t-local-worker
DEVICE_BRIDGE_POLL_LIMIT=10
DEVICE_BRIDGE_POLL_INTERVAL_MS=5000
```

## Commands

```bash
npm run worker:stage4t:dry-run
npm run worker:stage4t:once
npm run worker:stage4t:loop
```

`once` sends heartbeat, polls queued commands, acknowledges each command, then
marks it completed or failed using the built-in noop adapter.

The noop adapter is intentionally conservative:

- `bridge_health_check` completes successfully.
- hardware commands such as calibration or stream-open fail with
  `adapter_missing` until a clinic-owned hardware adapter is installed.

## Boundary

- No Supabase runtime.
- No `api-read` / `api-write` / Edge Functions.
- No browser WebUSB, WebBluetooth, or WebSerial.
- No worker token is printed in dry-run or logs.

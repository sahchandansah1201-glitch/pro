# Stage 4S — Self-hosted Device Bridge worker contract

Stage 4S closes the backend side of the Device Bridge command loop. Stage 4R let
authenticated users enqueue safe commands. Stage 4S gives the local Device
Bridge worker a server-owned contract to report heartbeat, poll queued commands,
acknowledge work, and complete or fail commands.

The worker contract is part of the self-hosted product. It uses PostgreSQL and
the self-hosted backend only. It does not introduce managed runtime dependencies
or direct browser hardware access.

## 1. Runtime boundary

- Frontend users authenticate with the existing self-hosted JWT flow.
- The local Device Bridge worker authenticates with
  `Authorization: Bearer <DEVICE_BRIDGE_WORKER_TOKEN>`.
- `DEVICE_BRIDGE_WORKER_TOKEN` is a deployment-local secret set on the backend
  process. It is never exposed to the browser UI.
- Worker responses do not include the raw token, object storage keys, signed
  URLs, patient names, emails, cookies, or external service credentials.
- Browser code still does not use WebUSB, WebBluetooth, WebSerial, Supabase,
  `api-read`, `api-write`, or Edge Functions.

## 2. Endpoints

### Heartbeat

```http
POST /api/v1/device-bridge-worker/heartbeat
Authorization: Bearer <DEVICE_BRIDGE_WORKER_TOKEN>
Content-Type: application/json
```

Required body:

```json
{
  "clinicId": "10000000-0000-4000-8000-000000000001",
  "bridgeCode": "br-live-01"
}
```

Optional fields: `hostName`, `version`, `lanStatus`, `workerStatus`,
`metadata`.

The backend upserts the bridge by `(clinic_id, bridge_code)`, updates
`last_heartbeat_at`, `worker_last_seen_at`, `worker_status`, and writes
`device_bridge.worker.heartbeat` to the audit log.

### Poll commands

```http
GET /api/v1/device-bridge-worker/commands?clinicId=<uuid>&bridgeCode=br-live-01&limit=10
Authorization: Bearer <DEVICE_BRIDGE_WORKER_TOKEN>
```

The backend returns queued or acknowledged commands for the worker bridge and
sets `dispatched_at` for newly seen commands. Polling uses PostgreSQL row locks
with `for update skip locked` so multiple workers do not claim the same batch.

### Update command lifecycle

```http
PATCH /api/v1/device-bridge-worker/commands/{commandId}
Authorization: Bearer <DEVICE_BRIDGE_WORKER_TOKEN>
Content-Type: application/json
```

Allowed statuses:

- `acknowledged`
- `completed`
- `failed`

The backend records `acknowledged_at` and `completed_at` timestamps as
appropriate, stores a sanitized `result_json`, and writes either
`device_bridge.command.ack` or `device_bridge.command.complete` to the audit
log.

## 3. Database

Migration:

```text
backend/self-hosted/db/migrations/0010_stage4s_device_bridge_worker_contract.sql
```

It adds worker lifecycle fields to `device_bridges` and queue indexes for
`device_bridge_commands`:

- `worker_status`
- `worker_last_seen_at`
- `worker_version`
- `worker_metadata_json`
- `device_bridge_commands_worker_queue_idx`
- `device_bridge_commands_worker_result_idx`

## 4. OpenAPI and gateway

- Backend contract: `backend/self-hosted/openapi.stage4s.json`
- Gateway route: `/openapi.stage4s.json`
- Metadata link: `GET /api/v1/meta` now reports Stage `4S` and exposes the
  worker endpoint links.

## 5. Verification

Run:

```bash
npm run preflight:stage4s
```

This executes:

- `backend/self-hosted/device-bridge-worker-auth.test.mjs`
- `backend/self-hosted/device-bridge-worker-repository.test.mjs`
- `backend/self-hosted/device-bridge-worker-service.test.mjs`
- `backend/self-hosted/ops-runtime-checks.test.mjs`
- `backend/self-hosted/routes.test.mjs`
- `scripts/check-stage4s-device-bridge-worker-contract.test.mjs`
- `src/pages/sys/SysSelfHostedOpsPage.test.tsx`
- `scripts/check-stage4s-device-bridge-worker-contract.mjs`
- `scripts/check-no-deno-locks.mjs`

`scripts/preflight-all.mjs` also includes
`Stage 4S Device Bridge worker contract preflight`.

## 6. CI

Workflow:

```text
.github/workflows/stage4s-device-bridge-worker-contract.yml
```

It runs `npm run preflight:stage4s` and writes a GitHub Actions summary.

## 7. Product boundary

Stage 4S keeps the product independently deployable:

- PostgreSQL is the system of record.
- Device Bridge commands are backend-owned rows.
- The worker is a local process controlled by the deployment owner.
- No third-party service can disable this path by revoking an external API key.

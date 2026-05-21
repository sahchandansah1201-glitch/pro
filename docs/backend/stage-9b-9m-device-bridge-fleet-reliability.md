# Stage 9B-9M · Device Bridge fleet reliability

Stage 9B-9M turns the earlier Stage 9B-9D hypothesis into a larger x2
repository-owned product batch. It extends the Device Bridge operations work
from Stage 8P-9A with a fleet reliability contract, SLO gates, UI visibility,
guard coverage, CI workflow coverage, and project-memory handoff.

## Scope

- Backend endpoint: `GET /api/v1/device-bridge-worker/fleet-reliability`
- OpenAPI document: `GET /openapi.stage9b-9m.json`
- Frontend UI: `/sys/devices`, section "Stage 9B-9M · Fleet reliability"
- Manifest: `deploy/self-hosted/device-bridge-fleet-reliability.stage9b-9m.json`
- Renderer: `npm run reliability:stage9b-9m:dry-run`
- Preflight: `npm run preflight:stage9b-9m`

## Included stages

- Stage 9B: Fleet reliability register
- Stage 9C: Worker SLO policy
- Stage 9D: Command queue SLO policy
- Stage 9E: Backend reliability endpoint
- Stage 9F: OpenAPI and nginx publishing
- Stage 9G: Frontend reliability adapter
- Stage 9H: System devices reliability UI
- Stage 9I: Safe reliability export preview
- Stage 9J: Drift guard
- Stage 9K: Workflow gate
- Stage 9L: Project-memory refresh
- Stage 9M: Next batch handoff

## Backend contract

`createDeviceBridgeFleetReliabilityService` reuses the Stage 8P-9A continuity
service and returns safe fleet-level metadata:

- queue pressure counts
- stale worker counts
- inherited continuity gate counts
- weekly/monthly SLO policy labels
- product boundary booleans
- next-batch handoff metadata

The endpoint writes a safe audit event:

- `device_bridge.fleet_reliability.read`

The audit metadata includes status, completion percent, queue pressure, and
fleet attention counts only.

## Frontend contract

`src/lib/self-hosted-device-api.ts` exposes:

- `toSelfHostedDeviceBridgeFleetReliabilityDTO`
- `getSelfHostedDeviceBridgeFleetReliability`

`SysDevicesPage` loads the endpoint only when a self-hosted session exists and
renders the result in `/sys/devices`. Demo mode remains unchanged.

## Product boundary

- Managed runtime/database dependency: none
- Database: local PostgreSQL
- Object storage: local self-hosted object store
- Browser hardware APIs: disabled
- External runtime calls: false
- Payload visibility: backend-only

The endpoint and UI must not expose tokens, protected storage fields, raw worker
payloads, patient names, or browser hardware API coupling.

## Verification

```bash
npm run test:stage9b-9m
npm run check:stage9b-9m
npm run reliability:stage9b-9m:dry-run
npm run preflight:stage9b-9m
```

`preflight:stage9b-9m` runs backend service tests, route tests, frontend adapter
tests, UI tests, manifest renderer tests, the drift guard, the previous
Stage 8P-9A preflight, project-memory checks, and the deno-lock guard.

## Lovable confirmation

The prompt is valid only after the Pull request has been merged into `main` and
local `main` has been verified.

Expected confirmation:

```text
Confirmed: Stage 9B-9M synced from main, no conflicts.
```

## Next hypothesis

Stage 9N-9Z is only a hypothesis until repository files define it.

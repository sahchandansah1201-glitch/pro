# Stage 8P-9A · Device Bridge operations continuity

## Scope

Stage 8P-9A is the second x2 product batch after the batch-size change. It
bundles twelve related stages into one Pull request:

- Stage 8P: incident drill register.
- Stage 8Q: telemetry retention register.
- Stage 8R: continuity checklist.
- Stage 8S: backend continuity endpoint.
- Stage 8T: OpenAPI and nginx publishing.
- Stage 8U: frontend continuity adapter.
- Stage 8V: system devices continuity UI.
- Stage 8W: safe export preview.
- Stage 8X: drift guard.
- Stage 8Y: workflow gate.
- Stage 8Z: project-memory refresh.
- Stage 9A: next batch handoff.

## Runtime contract

The backend exposes:

- `GET /api/v1/device-bridge-worker/operations-continuity`
- `GET /openapi.stage8p-9a.json`

The continuity endpoint is `system_admin` only. It derives safe operator
continuity metadata from the existing Device Bridge production readiness
projection and records `device_bridge.operations_continuity.read` in audit.

It returns:

- incident drill metadata;
- telemetry retention policy;
- continuity gates;
- the included stage map;
- next-batch handoff metadata;
- product boundary metadata.

It does not expose worker payloads, worker result bodies, tokens, raw patient
names, protected storage fields, or live server secrets.

## UI contract

`/sys/devices` renders a "Stage 8P-9A · Operations continuity" panel when a
self-hosted session token exists. The panel shows:

- continuity status and completion percent;
- queue pressure and attention counters;
- stage-by-stage continuity status;
- continuity gates;
- the product boundary note with the Stage 9B-9D hypothesis.

Demo mode remains local and does not claim live Device Bridge operations
continuity.

## Continuity package

The repository-bundled package lives in:

- `deploy/self-hosted/device-ops-continuity.stage8p-9a.json`
- `scripts/stage8p-9a-device-ops-continuity.mjs`

The renderer produces a metadata-only report and a post-merge Lovable sync
prompt. It is not a live-server approval and does not include external
incident evidence or live archive contents.

## Verification

Run:

```bash
npm run preflight:stage8p-9a
npm run continuity:stage8p-9a:dry-run
npm run check:project-memory
node scripts/check-no-deno-locks.mjs
```

`preflight:stage8p-9a` runs the backend service tests, route tests, frontend
adapter/page tests, continuity renderer tests, guard tests, Stage 8J-8O
regression preflight, project-memory tests, and the deno-lock guard.

## Product boundary

- Managed runtime/database dependency: none.
- Database: local PostgreSQL.
- Object storage: local self-hosted object store.
- Browser hardware API coupling: none.
- External Device Bridge worker runtime dependency: none for product startup;
  worker state is read from local PostgreSQL.
- CRM/ad/scheduling systems remain inbound/import sources only.
- Worker payload visibility: backend-only.

The protected files are scanned for managed-runtime markers, browser hardware
APIs, protected storage fields, raw worker payload fields, and raw patient
names.

## Lovable sync

Only send the Lovable prompt after the Pull request is merged into `main` and
local `main` has been verified. The expected response is:

```text
Confirmed: Stage 8P-9A synced from main, no conflicts.
```

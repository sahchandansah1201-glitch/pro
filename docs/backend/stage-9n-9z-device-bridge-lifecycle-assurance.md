# Stage 9N-9Z — Device Bridge lifecycle assurance

Stage 9N-9Z closes the next x2 Device Bridge batch after Stage 9B-9M. It
turns fleet reliability metadata into an operator-safe lifecycle assurance
package: maintenance review, worker upgrade posture, audit retention closure,
safe UI projection, CI guard, workflow gate, project-memory refresh, and the
next-batch handoff.

## Scope

- Backend endpoint: `GET /api/v1/device-bridge-worker/lifecycle-assurance`
- OpenAPI document: `/openapi.stage9n-9z.json`
- Frontend adapter: `getSelfHostedDeviceBridgeLifecycleAssurance`
- UI surface: `/sys/devices`, section `Stage 9N-9Z · Lifecycle assurance`
- Manifest: `deploy/self-hosted/device-bridge-lifecycle-assurance.stage9n-9z.json`
- Renderer: `npm run assurance:stage9n-9z:dry-run`
- Guard: `npm run check:stage9n-9z`

## Included stages

- Stage 9N — Lifecycle assurance register
- Stage 9O — Maintenance window policy
- Stage 9P — Worker upgrade posture
- Stage 9Q — Audit retention closure
- Stage 9R — Backend assurance endpoint
- Stage 9S — OpenAPI and nginx publishing
- Stage 9T — Frontend assurance adapter
- Stage 9U — System devices assurance UI
- Stage 9V — Safe closure export preview
- Stage 9W — Drift guard
- Stage 9X — Workflow gate
- Stage 9Y — Project-memory refresh
- Stage 9Z — Next batch handoff

## Product boundary

- Managed runtime/database dependency: none
- Database: local PostgreSQL
- Object storage: local self-hosted object store
- Browser hardware APIs: disabled
- External runtime calls: disabled
- Payload visibility: backend-only
- Raw worker payloads, raw result payloads, worker secrets, patient names,
  tokens, storage paths, and signed links are not included in reports or UI.

## Verification

```bash
npm run test:stage9n-9z
npm run check:stage9n-9z
npm run assurance:stage9n-9z:dry-run
npm run preflight:stage9n-9z
npm run check:project-memory
node scripts/check-no-deno-locks.mjs
```

`preflight:stage9n-9z` also runs the Stage 9B-9M preflight as a regression
gate because lifecycle assurance derives from the fleet reliability contract.

## Lovable sync rule

The Lovable prompt is valid only after this Pull request is merged into
`main` and local `main` is verified. Expected confirmation:

```text
Confirmed: Stage 9N-9Z synced from main, no conflicts.
```

Stage 10A-10L remains a hypothesis until repository files define it.

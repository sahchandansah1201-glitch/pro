# Stage 4G · Self-hosted visit workspace (read-only)

Stage 4G connects the doctor `VisitWorkspacePage` to the self-hosted PostgreSQL
backend in **read-only** mode. No managed-runtime coupling is introduced.

## Endpoints

- `GET /api/v1/patients/{patientId}/visits` — visits for a patient (RBAC scoped).
- `GET /api/v1/visits/{visitId}` — visit detail with patient/clinic projection.
- `GET /api/v1/visits/{visitId}/lesions` — lesions linked to the visit.
- `GET /api/v1/visits/{visitId}/assets` — clinical asset metadata only
  (no `object_bucket`/`object_key`/signed URLs).

All endpoints require a self-hosted bearer token (`Authorization: Bearer …`),
enforce `visitReadScope` (doctors, clinic admins, system admins), and emit
`visit.list` / `visit.read` / `visit.lesions` / `visit.assets` audit events.

## Frontend

`src/lib/self-hosted-visit-api.ts` exposes:

- `listSelfHostedVisitsByPatient`
- `getSelfHostedVisit`
- `listSelfHostedVisitLesions`
- `listSelfHostedVisitAssets`

`VisitWorkspaceLiveBanner` (rendered above the workspace tabs) shows:

- demo banner when the local self-hosted token is missing;
- live status with visit id, status, lesion and asset counts when the token is
  present;
- inline error when the backend rejects the request.

The rest of the page continues to read mock data; live writes/uploads are out
of scope for Stage 4G.

## Verification

```
npm run preflight:stage4g
npm run typecheck
npm run build
```

`preflight:stage4g` runs the backend repository/route tests, the frontend
client and banner tests, the Stage 4G guard, and `check-no-deno-locks`.
`scripts/preflight-all.mjs` includes `Stage 4G self-hosted visit workspace
preflight` so it ships in the global gate.

## Guardrails

- `package-lock.json` is not touched.
- No `deno.lock` is created.
- `supabase`, `api-read`, `api-write`, `edge function`, `SUPABASE_*` are
  forbidden in Stage 4G runtime files.

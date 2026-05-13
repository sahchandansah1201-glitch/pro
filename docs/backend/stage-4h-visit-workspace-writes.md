# Stage 4H — Self-hosted visit workspace writes

Stage 4H turns the visit workspace JSON workflow into backend-owned writes while preserving demo/local mode when no self-hosted token is present.

## Scope

- `PATCH /api/v1/visits/{visitId}` updates visit status and chief complaint.
- `POST /api/v1/visits/{visitId}/lesions` creates a lesion linked to the scoped visit.
- `PATCH /api/v1/lesions/{lesionId}` updates lesion JSON fields.
- `DELETE /api/v1/lesions/{lesionId}` soft archives a lesion by setting `deleted_at`; rows are not physically deleted.
- `PATCH /api/v1/visits/{visitId}/report` creates or updates report text.

Binary asset upload and object storage writes stay out of scope for Stage 4H.

## Backend

- Write repository: `backend/self-hosted/visit-workspace-write-repository.mjs`.
- Write service: `backend/self-hosted/visit-workspace-write-service.mjs`.
- RBAC: `VISIT_WRITE_ROLES = ["system_admin", "doctor"]`; clinic admins, assistants, and operators are denied write access.
- Validation returns the common JSON error envelope with `validation_error`.
- Audit events: `visit.update`, `lesion.create`, `lesion.update`, `lesion.archive`, `report.update`.
- OpenAPI contract: `backend/self-hosted/openapi.stage4h.json`.

## Frontend

- Client: `src/lib/self-hosted-visit-write-api.ts`.
- Live UI panel: `src/pages/doctor/VisitWorkspaceLiveActions.tsx`.
- Demo mode remains unchanged. Without a self-hosted token, the write panel is hidden and existing mock/local UI continues to work.
- Live mode exposes compact controls for visit status/complaint, lesion create/update/archive, and report text.

## Deployment

- Migration: `backend/self-hosted/db/migrations/0005_stage4h_visit_workspace_writes.sql`.
- Reverse proxy exposes `/openapi.stage4h.json` through `deploy/self-hosted/nginx.stage4a.conf`.
- CI workflow: `.github/workflows/stage4h-visit-workspace-writes.yml`.

## Verification

```bash
npm run preflight:stage4h
npm run typecheck
npm run build
```

Guardrails:

- `package-lock.json` must remain unchanged.
- `deno.lock` files must not exist.
- New Stage 4H runtime files must not introduce managed-runtime coupling: `supabase`, `api-read`, `api-write`, `edge function`, or `SUPABASE_*`.

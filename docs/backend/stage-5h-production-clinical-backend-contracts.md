# Stage 5H — Production Clinical Backend Contracts

Stage 5H moves the remaining clinical workspace tabs from production
placeholders to self-hosted backend contracts.

## Scope

- `clinical_assessments` and `clinical_conclusions` are owned by the
  local PostgreSQL database.
- Existing `reports` receive a stable `visit_id` lookup contract.
- `lesion_comparison_decision_drafts` stores a doctor-owned metadata draft
  for a selected lesion image pair, with patient delivery disabled.
- The browser reads and writes production clinical workspace data only
  through the self-hosted backend.
- Demo/dev mode remains unchanged and still uses mock clinical tabs.

## Backend Contracts

- `GET /api/v1/visits/{visitId}/assessment`
- `PATCH /api/v1/visits/{visitId}/assessment`
- `GET /api/v1/visits/{visitId}/conclusion`
- `PATCH /api/v1/visits/{visitId}/conclusion`
- `GET /api/v1/visits/{visitId}/report`
- `PATCH /api/v1/visits/{visitId}/report`
- `PATCH /api/v1/visits/{visitId}/lesion-comparison-draft`

All routes require bearer auth and clinic-scoped RBAC. Reads use visit
read scope. Writes use visit write scope. Audit events are:

- `assessment.read`
- `assessment.update`
- `conclusion.read`
- `conclusion.update`
- `report.read`
- `report.update`
- `lesion_comparison_draft.upsert`

## Lesion Comparison Draft Boundary

`PATCH /api/v1/visits/{visitId}/lesion-comparison-draft` accepts only
metadata needed for the doctor's selected image-pair decision:

- lesion ID, pair key, two image IDs, technical comparability, technical
  reasons, and selected action (`retake`, `excluded`, `report_limit`);
- no diagnosis, risk, prognosis, treatment, patient-facing report text, file
  path, signed URL, QR/session/credential material, model internals, or storage
  reference;
- response boundary flags are always `patientDeliveryAllowed: false` and
  `protectedFieldsExposed: false`;
- audit metadata intentionally omits `imageIds` and `pairKey`; it stores only
  visit ID, lesion ID, action, comparability, image count, reason count, and
  boundary flags.

The doctor lesion screen still saves a local draft first. When a self-hosted
backend session is configured, it also writes the same metadata draft through
the Stage 5H endpoint. When self-hosted is not configured, UI copy says the
backend audit was not sent.

## Product Boundary

- managed runtime: none
- managed database: none
- browser hardware APIs: none
- no Supabase runtime, `api-read`, `api-write`, Edge Function, raw object
  path, or signed URL dependency in protected Stage 5H files
- no patient delivery for lesion comparison draft decisions until a separate
  patient-facing longitudinal protocol gate is approved

## Validation

```bash
npm run preflight:stage5h
npm run preflight:stage5g
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- Stage 5H backend tests, frontend tests, guard, and deno-lock guard pass.
- Stage 5G still proves production does not fall back to mock clinical
  assessment/report data.
- `package-lock.json` remains unchanged.

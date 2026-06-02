# Stage 5H — Production Clinical Backend Contracts

Stage 5H moves the remaining clinical workspace tabs from production
placeholders to self-hosted backend contracts.

## Scope

- `clinical_assessments` and `clinical_conclusions` are owned by the
  local PostgreSQL database.
- Existing `reports` receive a stable `visit_id` lookup contract.
- `lesion_comparison_decision_drafts` stores a doctor-owned metadata draft
  for a selected lesion image pair, with patient delivery disabled.
- Batch AW adds a production-safe longitudinal lesion ledger read contract
  assembled from visit, lesion, clinical asset, and assessment metadata.
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
- `GET /api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-history`

All routes require bearer auth and clinic-scoped RBAC. Reads use visit
read scope. Writes use visit write scope. Audit events are:

- `assessment.read`
- `assessment.update`
- `conclusion.read`
- `conclusion.update`
- `report.read`
- `report.update`
- `lesion_comparison_draft.upsert`
- `lesion_longitudinal_history.read`

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

## Batch AW Longitudinal Lesion Ledger Boundary

`GET /api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-history`
returns only doctor-side technical metadata for one lesion across visits:

- lesion identity, body zone/surface labels, visit counts, image counts,
  same-kind candidate pair counts, and assessment counts;
- visit timeline rows with status, timestamps, counts, and first/last capture
  time;
- candidate image pairs with image IDs, visit IDs, asset kind, technical status
  (`ready`, `warning`, `blocked`), and technical reasons such as missing capture
  time or non-image content type.

The endpoint does not return object bucket, object key, checksum, storage path,
signed URL, image bytes, QR/session/credential material, `physicianText`,
`patientSafeText`, diagnosis, risk, prognosis, treatment, or any patient
delivery artifact. Boundary flags are always:

- `patientDeliveryAllowed: false`
- `protectedFieldsExposed: false`
- `storagePathsExposed: false`
- `signedUrlsIssued: false`
- `rawImageBytesExposed: false`
- `doctorOnlyTextExposed: false`
- `clinicalConclusionGenerated: false`

Audit event `lesion_longitudinal_history.read` stores only patient ID, lesion
ID, aggregate counts, and boundary flags. It intentionally omits image IDs,
pair keys, protected asset references, doctor-only text, and any patient-facing
copy.

## Brainstorm Coverage

- `SD-MF-025` / lesion timeline and repeated observation: partially solved.
  Batch AW moves the longitudinal history from UI mock into a production
  metadata ledger. Remaining gate: protected image rendering and doctor-side
  visual verification still need a separate backend image proxy.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch AW
  provides same-kind candidate pairs and technical blockers. Remaining gate:
  richer capture-condition metadata and persisted pair review decisions beyond
  the existing draft contract.
- `SD-MF-028` / safe technical comparison: in work. Batch AW preserves the
  "not clinical conclusion" boundary and only emits technical metadata.
- `SD-MF-046` / photo protocol and protected photo access: in work. Batch AW
  does not deliver images to patients or doctors; it prepares the ledger needed
  before real protected-image rendering.

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

# Stage 4D — Self-hosted patient write API

Stage 4D turns the Stage 4C authenticated patient boundary into the first
real clinical write surface inside the self-hosted backend. It remains a
single deployable product boundary: frontend, backend, PostgreSQL, object
storage, and nginx are owned by the local deployment.

## Goals

- `POST /api/v1/patients` creates a patient in PostgreSQL.
- `GET /api/v1/patients/:patientId` reads one role-scoped patient card.
- `PATCH /api/v1/patients/:patientId` updates demographics, consent, and notes.
- `DELETE /api/v1/patients/:patientId` soft-archives a patient by setting
  `deleted_at`; it never physically deletes the row.
- All write routes require a backend-issued bearer token.
- Writes are scoped by local RBAC and append audit events.

## Runtime files

- `backend/self-hosted/patient-write-service.mjs` validates payloads, resolves
  clinic scope, calls the repository, and writes audit events.
- `backend/self-hosted/patients-repository.mjs` owns PostgreSQL SQL builders for
  detail, create, update, and soft archive.
- `backend/self-hosted/routes.mjs` exposes Stage 4D routes and safe JSON errors.
- `backend/self-hosted/openapi.stage4d.json` documents the write contract.
- `backend/self-hosted/db/migrations/0004_stage4d_patient_writes.sql` adds
  active-patient indexes and documents the soft archive semantics.

## RBAC

Patient writes use `patientWriteScope` and `PATIENT_WRITE_ROLES`:

- `system_admin` can write across clinics, but must send `clinicId` on create.
- `clinic_admin` can write only assigned clinics.
- `doctor` can write only assigned clinics.
- `assistant` and `operator` are rejected with `403 forbidden`.

For non-system users, `clinicId` may be omitted only when the token has one
clinic scope. If more than one clinic is available, the payload must choose the
clinic explicitly.

## Validation

The backend validates patient writes before SQL:

- `fullName` is required on create and must contain at least two words.
- `birthDate` must be `YYYY-MM-DD`, year `>= 1900`, and not future.
- `sex` must be `female`, `male`, `other`, or `unknown`.
- `phototype` must be `I` through `VI`.
- `notes` is capped at 2000 characters.
- malformed JSON returns `400 invalid_json`;
- validation failures return `422 validation_error` with safe field-level
  details.

## Audit

Stage 4D appends audit events through `audit_log`:

- `patient.create`
- `patient.read`
- `patient.update`
- `patient.archive`

Audit records include `correlationId`, actor user ID, clinic ID, entity ID, and
safe metadata such as changed field names. Audit failures stay best-effort so
the write path is not blocked by logging infrastructure in this stage.

## No managed backend runtime dependency

Stage 4D continues the self-hosted boundary. Runtime backend/deploy files must
not call Supabase, `api-read`, `api-write`, edge functions, or project refs.
`scripts/check-stage4d-patient-writes.mjs` enforces this for Stage 4D files.

## Local verification

```bash
npm run preflight:stage4d
docker compose --env-file deploy/self-hosted/.env.example -f deploy/self-hosted/docker-compose.stage4a.yml config
node scripts/check-no-deno-locks.mjs
```

`npm run preflight:all` includes Stage 4D after Stage 4A, Stage 4B, and
Stage 4C.

## 9. Next stage

See [Stage 4E — Frontend patient API integration](./stage-4e-frontend-patient-api.md)
for the Patients page bridge to the self-hosted Stage 4D API.

## Non-goals

- No frontend form is wired to the new write endpoints in this slice.
- No physical patient deletion.
- No visit/lesion/report writes.
- No object upload mutation changes.

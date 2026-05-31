# Stage 5N — Production patient portal contracts

## 1. Goal

Stage 5N cuts the patient-facing `/me` workspace over to the
self-hosted product boundary in production mode.

- Backend owns patient portal reads through PostgreSQL.
- Frontend production mode reads `/api/v1/me/portal` and
  `/api/v1/me/reports/{reportId}`.
- Batch S extends the same patient portal boundary with
  `/api/v1/me/photo-protocols/{visitId}` for metadata-only SD-MF-046
  photo/protocol reads.
- Batch U adds patient-visible photo controls on `/me/reports/:id` that call the
  Batch T backend proxy with the patient bearer session and expose only a local
  browser object URL after the backend authorizes the request.
- Batch V adds patient-visible revoke/audit review: `/me/reports/:id` shows
  `Отзыв и журнал доступа`, disables photo preparation after `revoked`, and
  renders only safe audit labels/dates derived from release metadata.
- Batch AA extends `/api/v1/me/history` and `/me/history` with two safe
  aggregates: longitudinal `comparisonOperations` and
  access `sessionLifecycle` governance counters.
- Demo/dev mode keeps the existing mock patient portal.
- Patient self-booking writes are intentionally out of scope; booking is
  read-only until a dedicated write contract is added.

## 2. Backend

New PostgreSQL contract:

- `patient_user_links` maps local `app_users.id` to local `patients.id`.
- `app_role` includes `patient`.
- Patient portal endpoints require the `patient` role.

Endpoints:

- `GET /api/v1/me/portal`
- `GET /api/v1/me/history`
- `GET /api/v1/me/reports/{reportId}`
- `GET /api/v1/me/photo-protocols/{visitId}`
- `GET /api/v1/me/photo-protocols/{visitId}/photos/{sequence}/download`
- `GET /openapi.stage5n.json`

The repository selects `patient_safe_text` only. Physician-only report
text is not selected or returned to the browser.

The photo-protocol endpoint is not file delivery. It reads prepared or revoked
`patient_photo_protocol_releases` rows through `patient_user_links` and returns
safe counts, status, expiry, and per-photo descriptors such as sequence,
content type, capture time, and lesion label. It keeps delivery blocked with
`patientDeliveryAllowed: false`, `rawFilesExposed: false`,
`signedUrlsIssued: false`, `storagePathsExposed: false`, and
`tokensExposed: false`.

Batch V adds an `auditTrail` summary to the same metadata response. It is
patient-safe only: `prepared`, `expires`, and `revoked` labels with dates.
It does not expose raw audit payloads, correlation ids, actor ids, revoke
reasons, object identifiers, storage paths, signed links, access tokens, or
doctor-only text.

Batch T adds a backend photo proxy endpoint for the same patient scope. It is
closed by default: bytes stream only when the release is `prepared`, the linked
patient identity matches, imaging consent exists, `expires_at` is present and
future, and backend metadata explicitly sets
`patientFileProxyEnabled: true`. The proxy streams bytes from backend-owned
object storage without returning object bucket/key values, storage paths,
signed URLs, access tokens, or doctor-only text. Denied and successful proxy
attempts are audit-recorded.

`GET /api/v1/me/history` returns a patient-safe longitudinal history model:
lesion cards, visit timeline, and aggregate photo-protocol policy/retention
counters. Batch AA adds `comparisonOperations` (series readiness for doctor
review) and `sessionLifecycle` (prepared/active/expiring/revoked windows with
policy gates). It does not expose diagnosis strings, doctor-only text, raw
files, storage paths, signed links, access tokens, or object identifiers.

## 3. Frontend

Production pages:

- `/me`
- `/me/history`
- `/me/reports`
- `/me/reports/:id`
- `/me/booking`
- `/me/reminders`

Production mode renders live components that read only from the
self-hosted backend. Demo mode renders the preserved `*Demo` pages.

Patient-visible photo controls are deliberately narrow. The patient sees the
doctor-selected photo metadata and a `Подготовить фото` action. The browser then
fetches `/api/v1/me/photo-protocols/{visitId}/photos/{sequence}/download` with
the patient bearer token and creates a temporary local object URL for
`Открыть фото`. The DOM must not render backend paths, object bucket/key values,
storage paths, signed links, access tokens, object identifiers, doctor-only
text, or clinical diagnosis/risk wording.

When the photo protocol is revoked, `/me/reports/:id` shows
`Фото-протокол отозван` and the `Отзыв и журнал доступа` section. Photo opening
controls stay visible but disabled, so the patient can understand what changed
without triggering the download proxy. Detailed append-only audit, revoke
reason, and service payload remain backend-only.

The production `/me/history` screen reads only `/api/v1/me/history` and keeps
the same safety boundary: comparison remains doctor-reviewed, and raw access
artifacts stay hidden from the patient DOM. Batch AA also renders
`Операции сравнения` and `Жизненный цикл доступа` with aggregate counters only.

## 4. Product Boundary

Stage 5N remains a single self-hosted product:

- runtime: local Node.js backend
- database: local PostgreSQL
- object storage: backend-owned local object store from earlier stages
- managed runtime/database: none
- Supabase/API-read/API-write/Edge Function coupling: forbidden
- browser hardware APIs: forbidden in patient portal runtime files

## 5. Validation

Run:

```bash
npm run preflight:stage5n
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- backend node tests pass
- patient portal API/front-end tests pass
- Stage 5N guard reports OK
- no `deno.lock`
- `package-lock.json` is unchanged

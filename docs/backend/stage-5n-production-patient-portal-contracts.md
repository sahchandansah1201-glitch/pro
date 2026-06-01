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
future, retention policy is approved, and backend metadata explicitly sets
`patientFileProxyEnabled: true`. The proxy streams bytes from backend-owned
object storage without returning object bucket/key values, storage paths,
signed URLs, access tokens, or doctor-only text. Denied and successful proxy
attempts are audit-recorded.

Batch AG hardens the same proxy with a runtime retention-policy gate:
`retentionPolicyApproved` must be true before the backend reads object storage.
If the policy is missing, the proxy denies the request with
`photo_protocol_retention_required`, records a denial audit event with the safe
reason `retention_policy_required`, and does not expose object bucket/key
values, signed links, storage paths, credentials, QR/session identifiers, raw
tokens, or doctor-only text. This is a download gate, not patient delivery
expansion or retention-policy auto-approval.

Batch AK adds `POST /api/v1/me/photo-protocols/{visitId}/access/exchange`.
The patient submits a credential to the self-hosted backend; the service hashes
the credential with the configured credential pepper, compares only hashes in
PostgreSQL, creates a backend-owned session boundary, and stores only
`session_hash`/`session_fingerprint` in
`patient_photo_protocol_access_sessions`. The response contains
`PatientPortalPhotoProtocolAccessExchange` metadata only:
`session_boundary_ready` plus boolean `*Exposed: false` flags. It does not return
the raw credential, credential hash/fingerprint, raw session identifier, session
hash/fingerprint, QR value, signed URL, storage path, object key, or doctor-only
text. Denied and successful exchange attempts are audit-recorded with safe
reason/status metadata only.

Deployment gate: `PATIENT_PHOTO_PROTOCOL_CREDENTIAL_PEPPER` must be provisioned
from the same secret as PostgreSQL
`app.patient_photo_protocol_credential_pepper`, which was used when Batch AJ
stored the credential hash. `PATIENT_PHOTO_PROTOCOL_SESSION_PEPPER` must also be
configured before production exchange is enabled. If the credential pepper is
out of sync, valid patient credentials will be denied without exposing the
credential or stored hash.

Batch AL adds the session transport contract for that confirmed boundary. On
successful access exchange only, the backend sets
`sd_photo_protocol_session` as an `HttpOnly; Secure; SameSite=Strict` cookie
scoped to `/api/v1/me/photo-protocols/{visitId}` and capped by the same
short-lived session TTL. The session value is not returned in JSON, audit
metadata, OpenAPI examples, browser state, or the patient DOM. Denied exchange
attempts return no cookie. CORS responses include
`access-control-allow-credentials: true` for configured origins so the browser
can receive and later send the HttpOnly cookie without JavaScript access.

Batch AM turns that cookie transport into an enforced backend boundary for
`GET /api/v1/me/photo-protocols/{visitId}/photos/{sequence}/download`. The
route reads only the `sd_photo_protocol_session` cookie value from the request,
the delivery service hashes it with `PATIENT_PHOTO_PROTOCOL_SESSION_PEPPER`,
and the repository checks only the hash against an active
`patient_photo_protocol_access_sessions` row for the linked patient/release.
Missing, malformed, unconfigured, expired, or unmatched sessions deny before
object storage is read. Audit metadata stays aggregate/safe:
`rawSessionIdExposed`, `sessionHashExposed`, and `sessionFingerprintExposed`
remain false; no cookie value, session hash, session fingerprint, signed URL,
object bucket/key, or doctor-only text is returned.

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

The access-exchange client uses
`/api/v1/me/photo-protocols/{visitId}/access/exchange` only to confirm the
server-side boundary. Batch AL sends the request with `credentials: "include"`
so the browser can persist the backend-set HttpOnly cookie. It must not store
the submitted credential, raw session secret, credential hash/fingerprint,
session hash/fingerprint, QR values, or signed links in browser state or the
DOM. Photo downloads also use `credentials: "include"` and still receive bytes
only from the backend proxy, not storage paths or signed URLs.

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

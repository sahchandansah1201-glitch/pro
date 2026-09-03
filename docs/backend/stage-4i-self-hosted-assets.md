# Stage 4I · Self-hosted clinical assets

Stage 4I adds the first self-hosted Imaging write contract. It keeps the
product deployable as one frontend + backend + PostgreSQL + object-storage
bundle and does not add any managed Supabase runtime dependency.

## Scope

- `POST /api/v1/visits/{visitId}/assets` registers clinical asset metadata in
  PostgreSQL.
- `GET /api/v1/assets/{assetId}/download-url` returns a backend-owned download
  URL contract.
- Imaging uses the self-hosted asset adapter when a self-hosted session exists,
  and keeps the existing demo/legacy behavior otherwise.
- Responses expose only safe asset metadata. Raw object bucket/key, storage
  path, signed query params, access tokens, and checksums are backend-only.

## Backend Contract

### POST /api/v1/visits/{visitId}/assets

Every request must include an `Idempotency-Key` header. The value is scoped to
the authenticated clinic, must contain 16–128 safe ASCII characters
(`A-Z`, `a-z`, `0-9`, `.`, `_`, `:`, `-`), and may be reused only for an exact
retry of the same normalized asset request. Request body is JSON:

```json
{
  "kind": "overview_photo",
  "contentType": "image/png",
  "byteSize": 1024,
  "lesionId": null,
  "capturedAt": "2026-05-12T09:00:00.000Z",
  "checksumSha256": null,
  "originalFileName": "spot.png"
}
```

Accepted image content types are JPEG, PNG, WebP, HEIC and HEIF up to 25 MB.
`report_attachment` accepts PDF up to 50 MB. `overview`, `macro`, and
`body_map` are accepted as UI aliases for `overview_photo`.

The backend verifies visit write scope through `visitWriteScope`, checks the
optional lesion belongs to the visit's patient and clinic (including a lesion
first recorded during another visit), and computes a canonical request hash.
It then atomically claims `(clinic_id, idempotency_key)` in
`clinical_asset_upload_requests` before any object-storage write. Only the
reservation owner may store the object, insert `clinical_assets`, complete the
reservation, and record `asset.create` in the audit log.

- First completed request: HTTP `201`, `upload.replayed=false`.
- Exact completed replay: HTTP `200`, the original asset and
  `upload.replayed=true`; no second object write, asset row, or audit event.
- Same key with a different normalized request: HTTP `409`
  (`idempotency_conflict`).
- Concurrent exact retry while the 15-minute owner lease is still active: HTTP
  `409` (`asset_upload_in_progress`). The client may retry later with the same
  key.
- Exact retry after lease expiry atomically rotates the reservation token for
  one contender, increments `recovery_count`, and retains the original object
  bucket/key. Other concurrent contenders remain `asset_upload_in_progress`.
- A missing or invalid key is rejected before object storage and metadata writes.

If the process stops after object write but before database completion, the
reservation remains `pending`. An exact retry after lease expiry reconciles only
that reservation-owned key: matching bytes are reused, missing bytes are
restored, and mismatched partial bytes are rewritten from the already validated
request. Object-store read or permission errors fail closed before metadata and
audit writes. The recovery does not scan or delete unknown files; abandoned
reservations without an exact retry remain subject to a separate operator-owned
retention policy.

Migration order is `0098` before the new backend. Existing writers remain
compatible because the lease columns have database defaults. During rollback,
the backend is rolled back first; the additive columns and recovery history are
retained rather than deleting clinical or audit history.

### GET /api/v1/assets/{assetId}/download-url

The backend verifies `clinicalMediaReadScope` and returns the backend-owned
route. A pure `clinic_admin` is denied before repository or object-store
access:

```json
{
  "assetId": "uuid",
  "clinicId": "uuid",
  "visitId": "uuid",
  "downloadUrl": "/api/v1/assets/{assetId}/download",
  "expiresIn": 300,
  "expiresAt": "2026-05-12T09:05:00.000Z"
}
```

This is a backend-owned URL contract. Binary proxying/object-storage streaming
can be added as the next storage stage without changing the UI safe DTO.

## Frontend Contract

`src/lib/self-hosted-asset-api.ts` maps backend asset metadata to the safe DTO
used by `VisitImagingTab`. The Imaging panel prefers the self-hosted adapter
when `useSelfHostedApiSession()` has a token and base URL.

Both interactive upload surfaces create one key and one `capturedAt` value per
selected file/context and preserve them across a failed retry. Selecting a
different file, visit, lesion, or image kind creates a new request identity.

The UI copy states which backend is active and still avoids raw storage terms
or signed URLs in visible text.

## Guardrails

- No `supabase`, `api-read`, `api-write`, `edge function`, or `SUPABASE_*`
  tokens in Stage 4I runtime files.
- `object_bucket` and `object_key` are only used inside backend repository SQL
  and are never returned by route responses.
- Idempotency identity is tenant-scoped; replay never bypasses visit/lesion
  authorization and never exposes the reservation token or canonical hash.
- `package-lock.json` is not modified.
- `deno.lock` files are not allowed.

## Verification

```bash
npm run preflight:stage4i
npm run typecheck
node scripts/check-no-deno-locks.mjs
```

`preflight:stage4i` runs backend repository/service/route tests, frontend
asset adapter and Imaging integration tests, the Stage 4I guard, and the
deno-lock guard.

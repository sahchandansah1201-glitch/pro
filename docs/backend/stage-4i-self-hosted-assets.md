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

Request body is JSON:

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
optional lesion belongs to the visit, generates an internal object key, inserts
`clinical_assets`, and records `asset.create` in the audit log.

### GET /api/v1/assets/{assetId}/download-url

The backend verifies visit read scope and returns:

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

The UI copy states which backend is active and still avoids raw storage terms
or signed URLs in visible text.

## Guardrails

- No `supabase`, `api-read`, `api-write`, `edge function`, or `SUPABASE_*`
  tokens in Stage 4I runtime files.
- `object_bucket` and `object_key` are only used inside backend repository SQL
  and are never returned by route responses.
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

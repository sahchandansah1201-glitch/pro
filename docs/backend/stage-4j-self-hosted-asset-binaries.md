# Stage 4J — Self-hosted asset binaries

Stage 4J turns the Stage 4I asset contract into a self-hosted binary flow:
the frontend uploads file bytes to the local backend, the backend stores them
under a backend-owned object store, and downloads are served through an
authenticated backend proxy.

## Runtime Scope

- `POST /api/v1/visits/{visitId}/assets` accepts JSON with `dataBase64`,
  `contentType`, `byteSize`, optional `checksumSha256`, and safe metadata.
- `GET /api/v1/assets/{assetId}/download-url` still returns a backend-owned
  route and never exposes bucket/key paths, signed URLs, or access tokens.
- `GET /api/v1/assets/{assetId}/download` streams bytes through the backend
  after bearer authentication and RBAC checks.
- Metadata remains in PostgreSQL; bytes are written through
  `backend/self-hosted/object-store.mjs`.

## Storage

The default local object store root is `.self-hosted/object-storage`. In
Docker Compose, backend runtime data is mounted at:

```bash
OBJECT_STORAGE_LOCAL_DIR=/var/lib/dermatolog-pro/object-storage
```

The local store is intentionally filesystem-based in Stage 4J, with the same
backend-owned bucket/key metadata shape that can later be backed by an S3
compatible service without changing the browser contract.

## Security Rules

- The browser never sends `objectBucket`, `objectKey`, or raw storage paths.
- Download URLs contain no `access_token`, `sig`, signed query params, bucket
  names, or object keys.
- File preview uses an authenticated fetch and browser `blob:` URL.
- `asset.download` audit events are recorded for binary reads.
- `object-store.mjs` rejects path traversal and unsafe path segments.
- Stage 4J runtime files are scanned for managed-runtime coupling:
  `supabase`, `api-read`, `api-write`, `edge function`, and `SUPABASE_`.

## Local Verification

```bash
npm run preflight:stage4j
```

Expected:

- `object-store.test.mjs`, `asset-write-service.test.mjs`, and
  `routes.test.mjs` pass under `node --test`.
- `src/lib/self-hosted-asset-api.test.ts`, `VisitImagingTab.test.tsx`, and
  hygiene tests pass under Vitest.
- `scripts/check-stage4j-self-hosted-asset-binaries.mjs` reports OK.
- `node scripts/check-no-deno-locks.mjs` reports OK.
- `package-lock.json` remains unchanged.

## Deployment Notes

`deploy/self-hosted/docker-compose.stage4a.yml` now mounts a backend volume for
local asset binaries. The Nginx gateway exposes `/openapi.stage4j.json` and
continues to proxy `/api/*` to the backend.

This stage keeps the product deployable as one self-hosted frontend + backend
stack without requiring Supabase-managed runtime services.

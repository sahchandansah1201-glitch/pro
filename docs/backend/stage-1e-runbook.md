# Stage 1E runbook — Clinical assets + private storage

Stage 1E is delivered in slices:

- **1E-A** (committed): DB layer — assets RLS / write-guard / private Storage
  bucket policies. No Edge Function or frontend changes.
- **1E-B** (this slice): asset metadata API routes (api-write + a single
  api-read route). No binary upload/download URL issuance, no frontend.
- **1E-C** (deferred): Storage upload/download URL issuance + frontend.

## Stage 1E-B — asset metadata API routes

Scope: backend-only DB / storage slice. No api-read / api-write route changes,
no frontend changes, no live contract tests.

## What was added

1. New migration `db/stage1e/migrations/20260509000001_stage1e_assets.sql`
   (mirrored at `supabase/migrations/20260509000001_stage1e_assets.sql`):
   - Replaces the body of the immutable Stage 1D helper
     `public._stage1d_allowed_entities()` to add `'asset'` to the
     allow-list. The Stage 1D file is **not** modified on disk; the helper is
     replaced via `CREATE OR REPLACE` in the new migration. Signature, search
     path, volatility and grants are preserved.
   - Column-level INSERT and UPDATE grants on `public.assets`. `clinic_id` and
     `created_at` are intentionally NOT granted; UPDATE additionally excludes
     `kind`, `source`, `storage_object_path`, `captured_at`, `visit_id`.
   - INSERT/UPDATE RLS policies for `doctor` and `private_doctor` only.
   - BEFORE INSERT/UPDATE write-guard trigger
     `tg_00_stage1e_assets_write_guard` that:
     * forces `clinic_id` from the parent visit on INSERT,
     * validates `lesion_id` (if any) belongs to the same visit's clinic
       and patient,
     * enforces `id`, `clinic_id`, `visit_id`, `kind`, `source`,
       `storage_object_path`, `captured_at`, `created_at` immutability
       on UPDATE,
     * requires the caller to hold `doctor` or `private_doctor`.
   - Private Storage bucket `clinical-assets` (`public = false`).
   - `storage.objects` policies for the bucket:
     * SELECT for `system_admin`,
     * SELECT and INSERT for clinic doctor / private_doctor (clinic UUID
       parsed from segment 2 of the path
       `clinic/{clinic_id}/visit/{visit_id}/...`),
     * no UPDATE / DELETE policies — those operations remain blocked.
2. New pgTAP test file `db/stage1e/tests/stage1e_assets.test.sql`
   (mirrored at `supabase/tests/stage1e_assets.test.sql`), 22 tests.
3. `scripts/forbidden-patterns.mjs` extended to include the two new
   canonical/install byte-identity pairs.

## What is NOT in this slice

- No api-read or api-write asset routes.
- No upload-URL or download-URL Edge Function endpoints.
- No DTO / projection rules for assets.
- No DELETE flow (metadata or storage).
- No assistant write access.
- No patient-facing asset access.
- No live contract tests.

## Verify locally

```
npx supabase db reset
npx supabase test db
node scripts/check-canonical-install-identity.mjs
node scripts/check-no-deno-locks.mjs
node scripts/scan-doctor-forbidden.mjs
git status --short
```

Expected pgTAP outcome: `Files=4, Result=PASS` with the previous Stage
1A + 1C + 1D suite (110 tests) plus the 22 Stage 1E-A tests for a combined
total of 132 tests. The exact total may differ by environment; the
`Result=PASS` and `Files=4` lines are the source of truth.

If anything is not green, stop and report — do not patch around the test
output.

## Rollback

The migration is additive only. To roll back, run the SQL block from
`db/stage1e/README.md` ("Rollback" section) and remove the new migration
files from both `db/stage1e/` and `supabase/`.

## Stop conditions met during planning

- No service role usage in any policy or function.
- No mutation of Stage 1A / 1C / 1D migration files on disk (only a
  `CREATE OR REPLACE` of the Stage 1D allow-list helper from the new
  Stage 1E migration).
- No frontend or Edge Function code change.
- No new dependencies, no lock files, no `supabase db push`.

### Routes added

`api-write` (POST/PATCH, doctor / private_doctor only):

- `POST  /doctor/visits/:visitId/assets` → 201, returns `AssetDTO`.
- `PATCH /doctor/assets/:assetId` → 200, returns `AssetDTO`.

`api-read` (GET, doctor / private_doctor only):

- `GET   /doctor/visits/:visitId/assets` → 200, returns
  `{ data: AssetDTO[], nextCursor: null }`.

### Body schemas

`POST /doctor/visits/:visitId/assets` (camelCase only):

```
{
  "kind": "overview|dermoscopy|macro|body_map",
  "source": "phone|file|camera|device_bridge|local_transfer",
  "storageObjectPath": "clinic/{clinicId}/visit/{visitId}/...",
  "capturedAt": "ISO timestamp",
  "qualityScore": 0..1,
  "lesionId": "uuid|null (optional)",
  "deviceId": "uuid|null (optional)",
  "qualityIssues": "string[] (optional)",
  "exif": "object (optional)"
}
```

> The `kind` and `source` enums are pinned to the Stage 1A DB enums
> `image_kind` and `image_source` (the Stage 1A schema is frozen). This is a
> deliberate divergence from the Stage 1E planning doc, which mentioned
> `closeup`/`other`/`import` — those are not present in the DB enums and would
> require a Stage 1A migration, which is forbidden in this slice.

`PATCH /doctor/assets/:assetId` (allow-list mirrors the Stage 1E-A column
UPDATE grants):

```
{ "lesionId"?: "uuid|null", "deviceId"?: "uuid|null",
  "qualityScore"?: 0..1, "qualityIssues"?: "string[]", "exif"?: "object" }
```

Server-controlled fields (`id`, `clinicId`, `createdAt`, `kind`, `source`,
`storageObjectPath`, `capturedAt`, `visitId`) are rejected with `422
validation_error`. The `clinic_id` is forced from the parent visit by the
Stage 1E-A BEFORE INSERT trigger.

### Defence-in-depth path binding

`storageObjectPath` is verified to contain `/visit/{visitId}/`. Storage
RLS already requires the full `clinic/{clinicId}/visit/{visitId}/...` shape;
this client-side check fails fast before the DB round-trip.

### Response DTO surface (intentional omissions)

Both `POST /doctor/visits/:visitId/assets` and
`PATCH /doctor/assets/:assetId` accept `storageObjectPath` and `exif` on the
request body. The response DTO (`AssetDTO` in `api-write`,
`DoctorAssetDTO` in `api-read`) **intentionally does NOT expose**:

- `storageObjectPath` / `storage_object_path` — raw bucket paths must not
  leak through the JSON API. Binary access will be brokered via short-lived
  signed URLs in Stage 1E-C; until then clients have no need for the path.
- `exif` — EXIF blobs may carry GPS coordinates, device serials, and other
  PII. They are persisted server-side for downstream analytics but are not
  rendered on any read surface.

Unit and live contract tests assert these keys are absent from every asset
response payload.

### Audit

Every successful asset write goes through `public.log_clinical_write` with
`entity = 'asset'` (added to the immutable allow-list helper in Stage 1E-A).
The audit payload only carries `correlation_id`, `route`, `changed_fields`
(camelCase names only), and `parent_ids = { visitId, lesionId? }`. Clinical
free text is never logged.

### Verify locally

Backend pgTAP suite (unchanged from 1E-A):

```
npx supabase db reset
npx supabase test db    # Files=4, Result=PASS
```

api-write unit + live (start the function in another shell):

```
deno test --no-check supabase/functions/api-write/_tests/projections.test.ts
deno test --no-check supabase/functions/api-write/_tests/audit.test.ts

npx supabase functions serve api-write \
  --env-file ./supabase/.env.local --no-verify-jwt
deno test --allow-env --allow-net --allow-read --no-check \
  --config tests/api-write/live/deno.json \
  tests/api-write/live/contract.test.ts
```

api-read live regression:

```
npx supabase functions serve api-read \
  --env-file ./supabase/.env.local --no-verify-jwt
deno test --allow-env --allow-net --allow-read --no-check \
  --config tests/api-read/live/deno.json \
  tests/api-read/live/contract.test.ts
```

### Stop conditions met for 1E-B

- No DB migration changes (only the Edge Functions and tests).
- No service role usage anywhere.
- No frontend / `src/**` changes.
- No new dependencies.
- No Storage URL issuance — deferred to Stage 1E-C.

# Stage 1E — Clinical Assets + Secure Media Access (Plan)

## 1. Exact scope

Backend-only slice adding controlled clinical asset metadata routes and a private Storage bucket for clinical media, accessible only via caller-JWT-authorized Edge Function operations. No frontend wiring.

In scope:
- New migration `db/stage1e/migrations/20260509000001_stage1e_assets.sql` adding:
  - INSERT/UPDATE/DELETE RLS policies for `public.assets` (doctor/private_doctor in-clinic write; patient never writes).
  - A Stage-1C-style write-guard pattern for assets (clinic_id immutable, FK consistency to visit/lesion via composite key already enforced by schema).
  - Extension of audit allowlist via a Stage-1E `_stage1e_allowed_entities()` shim that unions in `'asset'` and additional actions `'soft_delete'`. Implemented as a NEW function plus a replacement of `log_clinical_write` validation that consults both Stage-1D and Stage-1E lists. Stage-1D file is NOT mutated.
  - Optional: column `deleted_at timestamptz` on `public.assets` (soft delete) — only if approved; otherwise omit and use hard DELETE under RLS.
- Private Supabase Storage bucket `clinical-assets` created via SQL migration (`storage.buckets` insert) and `storage.objects` RLS policies that reuse `public.has_clinic_access()` by parsing `clinic_id` from the object path prefix `clinic/{clinic_id}/visit/{visit_id}/{asset_id}.{ext}`.
- New api-write routes:
  - `POST   /doctor/visits/:visitId/assets` — register asset metadata (after client uploads to storage).
  - `PATCH  /doctor/assets/:assetId` — update mutable fields (`lesionId`, `qualityScore`, `qualityIssues`, `exif` whitelist).
  - `DELETE /doctor/assets/:assetId` — remove metadata row (hard or soft per decision); does not delete storage object (separate route below).
- New api-read routes:
  - `GET /doctor/visits/:visitId/assets` — list metadata.
  - `GET /doctor/assets/:assetId` — single metadata.
  - `GET /doctor/assets/:assetId/download-url` — short-lived signed download URL via storage RLS (caller JWT only, no service role).
- Upload flow: Edge Function returns a **signed upload URL** scoped to a deterministic object path. Two design options handled in §5/§3.

Out of scope (explicit exclusions in §2).

## 2. Explicit exclusions

- No frontend changes.
- No patient-facing asset routes (patient report assets deferred to a later slice).
- No service-role usage in any request path.
- No DICOM/PACS, no thumbnail generation, no AI pipeline, no virus scan.
- No changes to Stage 1A/1C/1D migration files.
- No new dependencies, no package/lockfile edits.
- No `supabase db push`. Migrations are applied locally via `npx supabase db reset`.
- No deletion of storage objects from the Edge Function (deferred; metadata DELETE only).
- No changes to existing api-read 23/23 or api-write 25/25 contracts.

## 3. Existing schema verification notes

Verified against current code:
- `public.assets` exists with columns: `id, clinic_id, visit_id, lesion_id, kind, source, storage_object_path, captured_at, device_id, quality_score, quality_issues[], exif jsonb, created_at`. Composite FKs `(visit_id,clinic_id)` and `(lesion_id,clinic_id)` already enforce clinic isolation.
- Stage 1A RLS on `public.assets` currently has SELECT only (`assets_sysadmin_select`, `assets_clinic_select`). No INSERT/UPDATE/DELETE policies → all writes are blocked under RLS today. Stage 1E must add them.
- Patient role intentionally cannot SELECT asset metadata (Stage 1A comment line 166). Preserve this.
- Stage 1D `_stage1d_allowed_entities()` does NOT include `'asset'`. Audit must be extended without mutating Stage-1D file.
- Enums `image_kind` and `image_source` already exist.
- No existing Storage bucket configured for clinical media.

## 4. DB / RLS / Storage changes

New file: `db/stage1e/migrations/20260509000001_stage1e_assets.sql`

a) RLS on `public.assets`:
- `assets_doctor_insert` — `for insert to authenticated with check (has_clinic_access(auth.uid(), clinic_id) and (has_role(auth.uid(),'doctor') or has_role(auth.uid(),'private_doctor')))`.
- `assets_doctor_update` — same predicate, plus a write-guard trigger that forbids changing `clinic_id`, `visit_id`, `storage_object_path`, `kind`, `source`, `captured_at`, `created_at`. Only `lesion_id`, `quality_score`, `quality_issues`, `exif` mutable.
- `assets_doctor_delete` — same predicate (or replaced by soft-delete update if `deleted_at` chosen).

b) Audit extension:
- New helpers `public._stage1e_allowed_entities()` returning `array['asset']` and `public._stage1e_allowed_actions()` returning `array['soft_delete','delete']`.
- `create or replace function public.log_clinical_write(...)` body updated to allow `_entity` if it is in EITHER `_stage1d_allowed_entities()` OR `_stage1e_allowed_entities()`, and `_action` if in either action list. Signature unchanged → no api-write code changes required for the call site.

c) Storage bucket and policies:
- `insert into storage.buckets (id,name,public) values ('clinical-assets','clinical-assets',false) on conflict do nothing;`
- Object path convention: `clinic/{clinic_id}/visit/{visit_id}/{asset_id}.{ext}`.
- Policies on `storage.objects` for `bucket_id='clinical-assets'`:
  - SELECT: `has_clinic_access(auth.uid(), (split_part(name,'/',2))::uuid)` AND (sysadmin OR doctor/private_doctor/assistant in clinic).
  - INSERT: same clinic check + role in (doctor, private_doctor, assistant), plus path shape regex check.
  - UPDATE/DELETE: deferred (no policy → blocked).
- All policies use caller JWT exclusively.

## 5. Edge Function route changes

api-write (`supabase/functions/api-write/index.ts`):
- Add routes listed in §1; new handlers in same file pattern as existing.
- Add mappings in `mapping.ts`, projections in `projections.ts` (`ASSET_COLS`, `toAssetDTO`).
- Validators: `assertUuid`, whitelist `kind ∈ image_kind`, `source ∈ image_source`, `qualityScore ∈ [0,1]`, `qualityIssues: string[]`, `exif: object`. Reject any free-text keys.
- Audit: each handler calls `recordWrite(client, ctx, { entity: 'asset', action: 'create'|'update'|'delete', entityId, clinicId, route, changedFields, parentIds: { visitId, lesionId? } })`. `storage_object_path`, `exif` contents, and any device serial fields are NEVER passed in `changedFields` payload — only top-level field names allowed by Stage-1D denylist rules.

Upload URL flow (chosen approach — caller-JWT-only, no service role):
- Client requests `POST /doctor/visits/:visitId/assets/upload-url` with `{ kind, source, contentType, ext }`.
- Function:
  1. Verifies caller has clinic access to the visit's clinic (single SELECT under RLS).
  2. Generates `assetId = uuid()` and deterministic `path = clinic/{clinicId}/visit/{visitId}/{assetId}.{ext}`.
  3. Calls `supabase.storage.from('clinical-assets').createSignedUploadUrl(path)` using the **caller-JWT client**. This works without service role because storage INSERT policy authorizes the caller.
  4. Returns `{ assetId, path, uploadUrl, token, expiresAt }`. No metadata row is created yet.
- Client uploads bytes directly to storage signed URL.
- Client then calls `POST /doctor/visits/:visitId/assets` with `{ assetId, path, kind, source, capturedAt, qualityScore, qualityIssues, exif, lesionId? }`. Function verifies path shape matches `(clinicId,visitId,assetId)` and inserts metadata under RLS.

Download URL flow:
- `GET /doctor/assets/:assetId/download-url` → SELECT metadata row (RLS), then `createSignedUrl(path, 60s)` with caller JWT. Return `{ url, expiresAt }`.

api-read (`supabase/functions/api-read/index.ts`): list/get routes use existing patterns; projections strip `storage_object_path` from default DTO (path only returned in dedicated download-url response).

## 6. DTO / projection rules

`AssetDTO` exposes: `id, visitId, lesionId, kind, source, capturedAt, qualityScore, qualityIssues, exifSummary, createdAt`.

Strict rules:
- Never include `storage_object_path` in any list/get DTO. Path lives only inside signed-URL responses, server-side.
- Never include raw `exif` as-is. Project to a fixed subset: `{ make, model, lensModel, iso, fNumber, exposureTime, focalLength, dateTimeOriginal }`. Drop GPS, serial, owner, and any unknown keys.
- Never include `device_id` until a Devices stage exists; omit from DTO.
- Forbidden-fields hygiene scanner extended to include: `storage_object_path`, `signedUrl token`, `device_id`, raw `exif`.

## 7. Audit logging behavior

- Entity: `'asset'`. Actions: `'create' | 'update' | 'delete'` (and `'soft_delete'` if soft-delete approved).
- `changedFields` allowed: `lesionId, qualityScore, qualityIssues, kind, source, capturedAt`. Never log `storage_object_path`, `exif`, `deviceId`.
- `parentIds`: `{ visitId, lesionId? }`.
- Upload-URL issuance is NOT a write and is NOT audited as a clinical write. (Optionally logged via a separate non-audit telemetry log line; out of scope here.)
- All audit calls go through existing `recordWrite()` → `log_clinical_write` RPC. Stage-1E migration extends the RPC's allowlist only.

## 8. Test plan

pgTAP — new file `db/stage1e/tests/stage1e_assets.test.sql`:
- Doctor in clinic A can INSERT asset for visit in clinic A; cannot for clinic B.
- Doctor cannot UPDATE `clinic_id`, `visit_id`, `storage_object_path`, `kind`, `source`, `captured_at` (write-guard).
- Patient cannot SELECT/INSERT/UPDATE/DELETE assets.
- Assistant role permissions: SELECT yes via existing clinic_select; INSERT yes (storage upload); metadata write — restrict to doctor/private_doctor (assistant blocked).
- `log_clinical_write` accepts `entity='asset', action='create'|'update'|'delete'` and rejects unknown actions.
- Storage policy tests (where pgTAP can inspect `storage.objects` policies): policy presence + predicate text contains `has_clinic_access`.
- Total target: ≥15 new pgTAP tests; combined suite goal `Files=4, Tests≥125, PASS`.

Unit tests (Deno) — `supabase/functions/api-write/_tests/`:
- New `assets.test.ts`: mapping/projection/validator coverage; ensure `storage_object_path` and raw `exif` never appear in DTO; `changedFields` excludes denylisted keys.
- Extend `projections.test.ts` and `forbidden-fields.ts` for asset DTO.

Live contract tests:
- `tests/api-write/live/contract.test.ts`: add cases for upload-url issuance, metadata create, update, delete, cross-clinic 404/403, invalid path shape rejection.
- `tests/api-read/live/contract.test.ts`: list/get/download-url, ensure `storage_object_path` absent.
- Targets: api-write live ≥30 tests pass; api-read live ≥27 pass. Existing 23/25 must remain green.

Static / hygiene:
- `scripts/forbidden-patterns.mjs` extended with `storage_object_path`, raw `exif`, `device_serial`.
- `scripts/check-canonical-install-identity.mjs` extended to include the new Stage-1E migration mirrored under `supabase/migrations/`.
- `scripts/check-no-deno-locks.mjs` unchanged.
- Backend guardrails workflow runs all the above.

## 9. File plan

Create:
- `db/stage1e/README.md`
- `db/stage1e/migrations/20260509000001_stage1e_assets.sql`
- `db/stage1e/tests/stage1e_assets.test.sql`
- `supabase/migrations/20260509000001_stage1e_assets.sql` (byte-identical mirror)
- `supabase/tests/stage1e_assets.test.sql` (byte-identical mirror)
- `docs/backend/stage-1e-runbook.md`
- `supabase/functions/api-write/_tests/assets.test.ts`

Edit:
- `supabase/functions/api-write/index.ts` — add routes/handlers.
- `supabase/functions/api-write/mapping.ts` — `mapAssetInsert/Update`.
- `supabase/functions/api-write/projections.ts` — `ASSET_COLS`, `toAssetDTO`.
- `supabase/functions/api-write/validators.ts` — asset whitelists.
- `supabase/functions/api-write/audit.ts` — extend `AuditEntity`/`AuditAction` TS union only.
- `supabase/functions/api-read/index.ts`, `projections.ts`, `_tests/projections.test.ts`, `_tests/forbidden-fields.ts` — read routes + DTOs.
- `tests/api-write/live/contract.test.ts`, `tests/api-read/live/contract.test.ts`, helpers if needed.
- `scripts/forbidden-patterns.mjs`.
- `scripts/check-canonical-install-identity.mjs` (only if it lists files explicitly).
- `.lovable/plan.md`.

Do NOT edit: Stage 1A/1C/1D migrations or RPC files.

## 10. Rollback plan

- Migration is additive; rollback = `drop policy ... on public.assets`, `drop function public._stage1e_allowed_entities/_actions`, restore prior `log_clinical_write` body, `delete from storage.buckets where id='clinical-assets'` (only if empty).
- Code rollback: revert the api-write/api-read commits; routes are net-new, so no existing client breaks.
- DB reset path: `npx supabase db reset` reapplies Stage 1A→1D and skips Stage 1E once the migration file is removed.

## 11. Stop conditions

Stop and request guidance if any of:
- pgTAP combined run is not `PASS` or test count drops below current 110.
- api-read live drops below 23/23 or api-write live drops below 25/25.
- Signed upload URL creation requires service role in tested Supabase version (then defer §5 upload-url route to a follow-up; keep metadata routes only).
- Storage policy on `storage.objects` cannot reference `public.has_clinic_access` (permission/extension issue) — defer Storage bucket to follow-up.
- Hygiene scan flags any `storage_object_path` / raw `exif` leak.
- Generated `deno.lock` files appear in `git status`.
- Any change would require editing a Stage 1A/1C/1D migration in place.
- Any path requires service-role credentials in the Edge Function request path.

## 12. Recommended implementation slicing

Slice 1E-A — DB + Audit extension:
- Stage-1E migration (RLS + write-guard + audit allowlist), pgTAP tests, canonical-mirror copy, hygiene patterns. No Edge Function changes. Verify `Files=4, Tests≥125, PASS`.

Slice 1E-B — Metadata routes (api-write + api-read):
- Add create/update/delete and list/get routes. Unit tests + live contract tests. No storage bucket yet. Doctor can register a row referencing a path that may not yet exist (acceptable for this slice; documented).

Slice 1E-C — Storage bucket + policies:
- Add bucket and `storage.objects` policies in a follow-up migration `20260509000002_stage1e_storage.sql`. Add download-url route. Add storage-policy presence pgTAP tests.

Slice 1E-D — Signed upload URL route:
- Only proceed if Slice 1E-C confirms caller-JWT signed uploads work without service role. Otherwise defer and document.

Slice 1E-E — Patient report assets (separate future stage, not Stage 1E).

Plan complete; ready for implementation prompt.

## Stage 1C — Controlled Write API + Write RLS (plan only)

### 1. Proposed exact scope

Smallest safe scope to unblock the existing doctor workflow:

- New Edge Function `api-write` (sibling of `api-read`), JWT-authenticated, RLS-enforced, no service role.
- Additive write RLS migration that grants `INSERT`/`UPDATE` (no `DELETE`) to `authenticated` for a small set of clinical tables, with policies restricted to `doctor` / `private_doctor` in the same clinic.
- pgTAP write-RLS test suite + live api-write contract tests + static hygiene checks.
- Reused auth/cors/errors/correlation/validators utilities from `api-read` via copy (not import) to keep the two functions independently deployable.

Explicitly **out of scope** (deferred):
- No `assistant`, `clinic_admin`, `operator`, `system_admin`, `patient` writes.
- No `patient_user_link` / `consents` / `audit_logs` writes (audit_logs may be appended via `SECURITY DEFINER` helper; see §4 — if rejected, drop and defer).
- No `assets` writes (image upload pipeline is a separate stage; metadata insert deferred).
- No deletes anywhere.
- No operator entities (`bot_dialogs`, `bot_messages`, `analysis_cards`).
- No signed-link / protected-link token issuance.
- No remote `supabase db push`.
- No frontend wiring (`src/**` untouched).
- No changes to existing Stage 1B read behaviour.

### 2. Routes/methods (grouped by surface)

All routes require `Authorization: Bearer <jwt>`; doctor surface gated by `roles ∩ {doctor, private_doctor}`. Only `POST` and `PATCH`. No `DELETE`.

Doctor surface (`/doctor/*`):
- `POST   /doctor/patients`                                 — create patient in caller's clinic
- `PATCH  /doctor/patients/:patientId`                      — edit demographics / risk_factors
- `POST   /doctor/patients/:patientId/visits`               — open a visit
- `PATCH  /doctor/visits/:visitId`                          — update status / complaint / closed_at
- `POST   /doctor/visits/:visitId/lesions`                  — add lesion (body-map point)
- `PATCH  /doctor/lesions/:lesionId`                        — update label/status/coords
- `POST   /doctor/visits/:visitId/assessments`              — create assessment (ABCD, 7-pt, AI fields)
- `POST   /doctor/visits/:visitId/conclusions`              — create conclusion (doctor_text, follow_up_plan)
- `POST   /doctor/visits/:visitId/reports`                  — ensure report exists, return id
- `POST   /doctor/reports/:reportId/versions`               — create new draft `report_version`
- `PATCH  /doctor/report-versions/:versionId`               — status transitions: `draft → final → amended`; never to `revoked` in 1C; sets `signed_by/signed_at` on `final`

Patient/public/operator surfaces: **no write routes** in Stage 1C.

### 3. Tables affected and exact write actions

| Table | INSERT | UPDATE | Notes |
|---|---|---|---|
| `patients`         | ✅ doctor | ✅ doctor | `clinic_id` forced server-side from caller's primary clinic; `created_by = auth.uid()` |
| `visits`           | ✅ doctor | ✅ doctor | `doctor_id = auth.uid()` on insert; `clinic_id` inherited from patient |
| `lesions`          | ✅ doctor | ✅ doctor | clinic_id inherited from patient via composite FK |
| `assessments`      | ✅ doctor | ❌       | append-only in 1C |
| `conclusions`      | ✅ doctor | ❌       | append-only in 1C |
| `reports`          | ✅ doctor | ✅ doctor | UPDATE only to set `current_version_id` |
| `report_versions`  | ✅ doctor | ✅ doctor | status transitions only; `patient_safe_text` and `doctor_text` set on insert |
| `audit_logs`       | (via SECURITY DEFINER helper `public.log_audit(...)`) | ❌ | If reviewer rejects helper, drop and defer audit logging to Stage 1D |

Untouched by writes: `clinics`, `profiles`, `user_roles`, `patient_user_link`, `assets`, `consents`, `public_signed_links`, `protected_analysis_links`.

### 4. RLS / GRANT strategy

New additive migration `db/stage1c/migrations/20260507000001_stage1c_writes.sql`.

**Grants** (selectively re-grant what Stage 1A revoked):
```sql
grant insert, update on
  public.patients, public.visits, public.lesions,
  public.assessments, public.conclusions,
  public.reports, public.report_versions
to authenticated;
-- DELETE remains revoked everywhere.
```

**Helper functions** (`SECURITY DEFINER`, `set search_path = public`, all `STABLE` except writes):
- `public.is_clinic_doctor(_user_id uuid, _clinic_id uuid) returns boolean` — true iff `user_roles` has `doctor` or `private_doctor` for `(_user_id, _clinic_id)`.
- (Optional) `public.log_audit(_clinic uuid, _action text, _entity text, _entity_id uuid, _payload jsonb) returns void` — single insert into `audit_logs` with `actor_id = auth.uid()`. Used by `api-write` so audit insertion is uniform without granting raw INSERT on `audit_logs` to authenticated.

**Same-clinic enforcement** (per-table policy pattern):
```sql
create policy patients_doctor_insert on public.patients
  for insert to authenticated
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));

create policy patients_doctor_update on public.patients
  for update to authenticated
  using  (public.is_clinic_doctor(auth.uid(), clinic_id))
  with check (public.is_clinic_doctor(auth.uid(), clinic_id));
```

For child tables (`visits`, `lesions`, `assets`-style children, `assessments`, `conclusions`, `reports`, `report_versions`), `WITH CHECK` calls `is_clinic_doctor(auth.uid(), clinic_id)` directly — composite FKs already pin `clinic_id` to the parent.

**Why patient/public/operator writes remain impossible:**
- Stage 1A revokes `INSERT/UPDATE/DELETE` from `authenticated` and `anon`. Stage 1C re-grants only the listed tables, only to `authenticated`.
- Every write policy `WITH CHECK` is gated by `public.is_clinic_doctor(auth.uid(), clinic_id)`, which only returns true for `doctor`/`private_doctor` rows in `user_roles` — `patient`/`operator`/`clinic_admin` cannot satisfy it.
- `anon` is never granted writes.
- No service role in `api-write` request paths.

### 5. DTO / input validation strategy

In `api-write`:
- Per-route Zod-equivalent (or hand-written) schemas in `validators.ts` (extended). Validate: UUID shape on path params, ISO timestamps, enum values (`visit_status`, `lesion_status`, `report_version_status`), numeric bounds (`map_x/map_y ∈ [0,1]`, `ai_confidence ∈ [0,1]`), max string lengths.
- Server **forces** `clinic_id`, `created_by`, `doctor_id`, `decided_by`, `signed_by` from `auth.uid()` / caller context — these fields are stripped from request bodies.
- Response DTOs reuse the existing read-side projection style: explicit allow-list, **no raw row spread**, no `patient_safe_text` field-name leakage to patient-facing responses (none in 1C, but the lint check stays).
- Status-transition guard for `report_versions.status` enforced both in API (allowed transitions table) and in DB via additional trigger or `CHECK`-style policy in the migration.

### 6. Test plan

**pgTAP write-RLS tests** — `db/stage1c/tests/stage1c_writes.test.sql` (mirrors Stage 1A pattern, JWT-sub impersonation):
- Doctor in clinic A can `INSERT`/`UPDATE` patients/visits/lesions/assessments/conclusions/reports/report_versions in clinic A.
- Doctor in clinic A **cannot** insert/update rows with `clinic_id = clinic B`.
- Patient/operator/clinic_admin/assistant/anon **cannot** insert/update any of the above (expect SQLSTATE `42501` or zero affected rows).
- `DELETE` denied for everyone on all listed tables.
- `audit_logs`: direct `INSERT` denied to authenticated; helper `log_audit()` succeeds.
- Append-only invariant: `assessments`/`conclusions` `UPDATE` denied even for owning doctor.

**Live API contract tests** — `tests/api-write/live/contract.test.ts` (new, mirrors `tests/api-read/live`):
- Bootstrap reuses `tests/api-read/live/helpers.ts` JWT minting helpers (extracted into shared `tests/_shared/` if duplication grows; otherwise copy).
- Cases: doctor happy paths (each route 2xx, response DTO shape), doctor cross-clinic write returns 403/404, patient/operator/anon return 403, malformed body returns 400, missing JWT returns 401.
- Idempotency: re-running suite is safe (creates fresh patients with unique `code`).

**Static checks** (extend existing `scripts/scan-doctor-forbidden.mjs` / hygiene workflow):
- `rg -n 'service_role|SERVICE_ROLE' supabase/functions/api-write/` must be empty.
- `rg -n 'patientSafeText' supabase/functions/api-write/` must be empty.
- `rg -n '\\.\\.\\.row|\\.\\.\\.data\\b' supabase/functions/api-write/**/*.ts` must be empty (no raw row spread).
- `deno check --config supabase/functions/api-write/deno.json supabase/functions/api-write/index.ts` passes.
- `deno test --allow-env --no-check supabase/functions/api-write/_tests/` passes.

### 7. File plan

**Will create**
- `db/stage1c/README.md` — install/verify steps mirroring Stage 1A README.
- `db/stage1c/migrations/20260507000001_stage1c_writes.sql` — grants + write policies + `is_clinic_doctor` (+ optional `log_audit`).
- `db/stage1c/tests/stage1c_writes.test.sql` — pgTAP write-RLS suite.
- `supabase/functions/api-write/index.ts` — route table, doctor-role gate, dispatchers.
- `supabase/functions/api-write/auth.ts` — copy of read auth (HS256 local + hosted fallback), no service role.
- `supabase/functions/api-write/cors.ts`, `correlation.ts`, `errors.ts`, `validators.ts`, `projections.ts` (write-side DTOs), `deno.json`.
- `supabase/functions/api-write/_tests/projections.test.ts`, `_tests/forbidden-fields.ts`.
- `tests/api-write/live/{README.md,contract.test.ts,helpers.ts,deno.json}`.
- `docs/backend/stage-1c-runbook.md` — local verify steps.

**May edit**
- `db/stage1a/README.md` — strike "Write policies for clinical roles" from §8 prerequisites and link Stage 1C runbook.
- `scripts/scan-doctor-forbidden.mjs` — extend scan path to include `supabase/functions/api-write/`.
- `.github/workflows/doctor-hygiene-scan.yml` — add api-write deno check + projections test job.
- `tests/api-read/live/helpers.ts` — only if JWT-mint helpers are extracted into `tests/_shared/`; otherwise unchanged.

**Will not touch**
- `src/**`, `package.json`, `package-lock.json`, `bun.lockb`, Vite/Tailwind config.
- Stage 1A migrations (`db/stage1a/migrations/*.sql`), Stage 1A seed, Stage 1A pgTAP tests.
- `supabase/functions/api-read/**` source (only test helpers may be refactored shared if needed).
- `supabase/config.toml` (api-write deploys with default `verify_jwt = false` like api-read; in-code JWT validation handles it).

### 8. Rollback plan

Stage 1C is fully additive.

To revert:
1. Remove `supabase/migrations/20260507000001_stage1c_writes.sql` (and its install copy under `supabase/migrations/` if installed).
2. `npx supabase db reset` — write policies & grants disappear; Stage 1A revokes restore deny-by-default.
3. Delete `supabase/functions/api-write/` directory (function not deployed remotely until Stage 1D).
4. Remove `db/stage1c/`, `tests/api-write/`, `docs/backend/stage-1c-runbook.md`.
5. Revert `db/stage1a/README.md` and hygiene scan/workflow edits.

No data migration to undo — Stage 1C does not transform existing rows.

### 9. Stop conditions

Stop and report (do not patch through) if any of these occur during implementation:
- pgTAP write tests show a non-doctor role can insert/update any clinical row → RLS bug; fix policy before proceeding.
- Live contract test shows `clinic_id` from request body is honoured (cross-clinic write succeeds) → server is not forcing `clinic_id` from caller context; halt and fix.
- Any `api-write` response includes `doctor_text`, `patient_safe_text`, raw DB column names, or fields outside the DTO allow-list.
- Hygiene scan finds `service_role` / `SERVICE_ROLE` / raw `{ ...row }` spread under `supabase/functions/api-write/`.
- A required policy needs to query the same table it is attached to (recursive RLS) — switch to a `SECURITY DEFINER` helper instead.
- The `audit_logs` helper approach is rejected in review → drop audit insertion from Stage 1C and defer; do **not** grant raw INSERT on `audit_logs` to authenticated.
- Any need arises to modify a Stage 1A migration in place, change `src/**`, change package files, or run `supabase db push`.

Plan complete; ready for implementation prompt.

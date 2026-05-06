# Stage 1A — Local install instructions

> **Why this folder?** The Lovable agent harness blocks direct writes under
> `supabase/migrations/`. The Stage 1A SQL artifacts live here and you copy
> them into the Supabase folders locally before running migrations/tests.
>
> **Status: Stage 1A verified locally.**
> - `npx supabase db reset` passes.
> - `npx supabase test db` passes: 39/39 pgTAP assertions.
> - `npm test -- --run` passes: 321/321 frontend tests.
> - `node scripts/scan-doctor-forbidden.mjs` passes (0 matches).
> - No `src/**` or package files were modified.
>
> External Supabase project ref: `exayfgindfbupzpnjzfl`.
> **Do NOT run `supabase db push` yet** — Stage 1A is local-only schema/RLS/seed.
> No API endpoints, no Edge Functions, no frontend wiring are part of Stage 1A.

## 0. Prerequisites
- Local Supabase stack running (`npm run db:status` reports up).
- Project linked: `exayfgindfbupzpnjzfl`.
- No changes under `src/**` are required or made by Stage 1A.

## 1. Install artifacts into the Supabase folder

```bash
mkdir -p supabase/migrations supabase/tests
cp db/stage1a/migrations/20260506000001_stage1a_schema.sql supabase/migrations/
cp db/stage1a/migrations/20260506000002_stage1a_rls.sql    supabase/migrations/
cp db/stage1a/seed.sql                                     supabase/seed.sql
cp db/stage1a/tests/stage1a_rls.test.sql                   supabase/tests/
```

> If `supabase/seed.sql` already exists, append instead of overwriting,
> or rename our seed to `supabase/seed_stage1a.sql` and `\i` it from the main one.

## 2. Apply migrations + seed

```bash
npx supabase db reset      # drops local DB, replays migrations, runs seed
```

Expected: command exits 0. The `\i supabase/seed.sql` step prints no errors.

## 3. Run SQL/RLS tests

```bash
npx supabase test db
```

Expected: `stage1a_rls.test.sql` reports `# All tests passed` with 39 assertions.

> Local-only commands. **Do NOT run `supabase db push`** against the remote
> project (`exayfgindfbupzpnjzfl`) at this stage.

The test file uses `pgtap`. The Supabase CLI installs `pgtap` automatically inside
the local DB. If not present, run `create extension if not exists pgtap;` once.

## 4. Verify the rest of the project is untouched

```bash
git status --short            # only db/stage1a + supabase/{migrations,tests,seed.sql}
git diff --stat -- src        # must be empty
npm test -- --run             # existing Vitest suite still green
node scripts/scan-doctor-forbidden.mjs   # hygiene scan, exit 0
```

## 5. Success criteria

- `npx supabase db reset` runs cleanly and is idempotent (run it twice; row
  counts and IDs are identical).
- `npx supabase test db` reports 39/39 assertions passed.
- No files under `src/**` were modified.
- No new dependencies were added.
- `public_signed_links` and `protected_analysis_links` contain only sha-256
  hex digests in `token_hash`. There is no `token` column on either table.

## 6. Rollback

Stage 1A is additive. To undo:

```bash
rm supabase/migrations/20260506000001_stage1a_schema.sql
rm supabase/migrations/20260506000002_stage1a_rls.sql
rm supabase/tests/stage1a_rls.test.sql
# Remove or revert supabase/seed.sql to its previous state.
npx supabase db reset
```

## 7. Known limitations / assumptions

- **Auth users are seeded directly into `auth.users`.** This is acceptable for
  local dev only. Do not run this seed against the linked remote project.
- **No password is set** for demo users — RLS tests authenticate by setting
  the JWT `sub` claim, not by signing in.
- **Doctor and assistant** are granted roles in *both* main and north clinics
  to mirror the existing mock data where v-005 (north clinic) is staffed by
  the main-clinic doctor. This is intentional and tested.
- **Operator has zero clinical reads** in Stage 1A by design. Operator-specific
  entities (bot_dialogs, bot_messages, analysis_cards) are deferred.
- **No write policies exist** for any non-system role. All writes are
  performed by Postgres superuser during seed only.
- Token hashes are sha-256 of synthetic plaintexts (`stage1a-public-link-fixture-1`,
  `stage1a-protected-link-fixture-1`). The plaintexts are intentionally NOT
  stored in the database; they exist only as literal arguments to `digest()`
  inside this seed file.
- **Patient-safe column projection is an API/application concern (Stage 1B).**
  Stage 1A enforces row-level access only — it does not hide doctor-only
  columns (e.g. `doctor_version_text`) at the column level. Callers must not
  expose those columns to patient clients until Stage 1B adds the API
  projection layer (views, PostgREST column grants, or Edge Function DTOs).

## 8. Stage 1B prerequisites (not implemented here)

- API/DTO layer that projects patient-safe columns only for patient role.
- Write policies for clinical roles (currently all writes are superuser-only).
- Operator-facing entities: `bot_dialogs`, `bot_messages`, `analysis_cards`.
- Token issuance/verification flow for `public_signed_links` and
  `protected_analysis_links` (Stage 1A stores hashes only).
- Remote rollout plan before any `supabase db push` to `exayfgindfbupzpnjzfl`.

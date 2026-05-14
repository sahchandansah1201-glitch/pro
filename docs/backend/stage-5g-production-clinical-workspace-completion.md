# Stage 5G — Production Clinical Workspace Completion

Stage 5G closes the remaining production workspace gaps after Stage 5F moved
patients, patient detail, visits, and lesions onto the self-hosted backend.

## Scope

- In `VITE_APP_MODE=production`, the visit workspace no longer renders
  mock-derived assessment, conclusion, or report tabs.
- Body Map keeps live self-hosted lesions visible, but local demo lesion
  placement is disabled in production.
- Demo/dev mode keeps the existing mock clinical tabs and local lesion draft
  workflow for review and design iteration.
- The product boundary remains operator-owned:
  - managed runtime: none
  - managed database: none
  - database: PostgreSQL deployed with the self-hosted stack
  - object storage: operator-owned local/S3-compatible storage through the
    self-hosted backend

## Production Behavior

Production clinical tabs show explicit contract-waiting states:

- Assessment waits for a self-hosted assessment API.
- Conclusion waits for a self-hosted conclusion API.
- Report waits for a self-hosted report API.

This is intentional. The UI must not silently build medical assessment or
report output from demo/mock data after production cutover. Until those backend
contracts exist, the production workspace is read-only for live patient, visit,
lesion, and asset flows already covered by Stage 4G-4J and Stage 5F.

## Guardrails

Run:

```bash
npm run preflight:stage5g
```

The preflight runs:

- `src/pages/doctor/VisitWorkspacePage.test.tsx`
- `scripts/check-stage5g-production-clinical-workspace-completion.test.mjs`
- `scripts/check-stage5g-production-clinical-workspace-completion.mjs`
- `scripts/check-no-deno-locks.mjs`

The guard verifies:

- production assessment/conclusion/report tabs use safe empty states;
- Body Map production mode blocks local demo lesion creation;
- Stage 5G is wired into `package.json` and `preflight-all`;
- protected runtime files do not contain managed-runtime coupling such as
  `api-read`, `api-write`, Edge Functions, `SUPABASE_*`, browser hardware APIs,
  signed URLs, or storage object paths.

## Release Checklist

Before promoting the build:

```bash
npm run preflight:stage5g
npm run preflight:stage5f
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git status --short
```

Expected:

- all commands pass;
- `package-lock.json` remains unchanged;
- no `deno.lock` exists;
- production workspace does not show mock clinical assessment/report content;
- demo/dev workspace behavior remains available.

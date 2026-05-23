# Stage 19A-19Z — Clinical follow-up outcome and quality review

## Scope

Stage 19A-19Z extends the Stage 18A-18Z follow-up operations queue with local
outcome and quality review state. It keeps the workflow inside the self-hosted
product boundary: PostgreSQL is the source of truth, backend routes enforce
RBAC, and the doctor workspace reads and updates only local metadata.

Implemented surfaces:

- PostgreSQL migration `0026_stage19_followup_outcome_quality.sql`.
- Outcome and quality review fields on `clinical_follow_up_tasks`.
- Append-only `clinical_follow_up_quality_events`.
- Backend contracts:
  - `GET /api/v1/clinical/follow-ups/outcomes/summary`
  - `PATCH /api/v1/clinical/follow-ups/{followUpId}/quality`
- OpenAPI contract `openapi.stage19a-19z.json`.
- nginx publishing for `/openapi.stage19a-19z.json`.
- Frontend self-hosted follow-up outcome and quality API adapter.
- Doctor visit workspace outcome/QA summary and row actions.
- Stage 19 guard, workflow, docs, project-memory update, and preflight wiring.

## Product Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- PostgreSQL remains the source of truth.
- Outcome and quality evidence is local metadata only.
- No notification provider, CRM, advertising, scheduling, browser hardware, or
  managed Supabase runtime is introduced.
- No signed URLs, storage paths, object keys, provider tokens, raw patient
  identity, or hidden patient-unsafe notes are exposed through the Stage 19
  summary or quality update response.

## RBAC

- Read outcome and quality summary: `visitReadScope`.
- Update follow-up quality state: `visitWriteScope`.
- Patient portal follow-up endpoints remain patient-owned and do not expose
  internal quality review notes or operations metadata.

## Audit

Stage 19 adds audit actions:

- `clinical_follow_up.outcomes.summary`
- `clinical_follow_up.quality.update`

Every quality update also writes a local `clinical_follow_up_quality_events`
row with previous and next safe outcome/quality state.

## Verification

```bash
npm run test:stage19a-19z
npm run check:stage19a-19z
npm run preflight:stage19a-19z
```

Expected:

- Repository, service, routes, frontend adapter, and doctor workspace tests pass.
- Guard reports Stage 19 files and markers present.
- Stage 18 regression preflight remains green.
- Project-memory guard remains green.
- Typecheck, `check-no-deno-locks`, and `git diff --check` pass.
- `package-lock.json` remains unchanged.

## Lovable Handoff

After the Stage 19 Pull request is merged into `main` and local `main` is
verified, Lovable should confirm:

`Confirmed: Stage 19A-19Z synced from main, no conflicts.`

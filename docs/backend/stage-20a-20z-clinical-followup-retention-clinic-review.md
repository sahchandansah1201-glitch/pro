# Stage 20A-20Z · Clinical follow-up retention and clinic review readiness

Stage 20A-20Z closes the repository-confirmed Stage 20 hypothesis after Stage
19A-19Z: follow-up analytics, retention review, and clinic review readiness.
It extends the self-hosted clinical follow-up loop without adding managed
runtime, managed database, notification provider, browser hardware APIs, or
external clinical proof.

## Scope

- Add local retention review state to `clinical_follow_up_tasks`.
- Add local clinic review state to `clinical_follow_up_tasks`.
- Record review mutations in append-only
  `clinical_follow_up_retention_review_events`.
- Expose a clinic-scoped summary:
  `GET /api/v1/clinical/follow-ups/clinic-review/summary`.
- Expose a clinic-scoped update route:
  `PATCH /api/v1/clinical/follow-ups/{followUpId}/clinic-review`.
- Surface retention and clinic review counters/actions in the doctor live visit
  workspace.
- Publish the Stage 20A-20Z OpenAPI contract through the self-hosted backend
  and nginx.

## Product Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Source of truth: self-hosted PostgreSQL.
- Browser hardware APIs: none.
- Retention and clinic review evidence is local metadata only.
- The repository does not claim external retention archive proof, medical
  outcome proof, or clinic SOP approval.

## Data Model

Migration `0027_stage20_followup_retention_clinic_review.sql` adds bounded local
states:

- `retention_review_state`: `not_due`, `due`, `reviewed`, `archived`.
- `clinic_review_state`: `not_scheduled`, `scheduled`, `completed`,
  `needs_policy_review`.
- free-text local review notes.
- reviewer/timestamp fields scoped to local `app_users`.
- append-only local review events.

## API Contract

`GET /api/v1/clinical/follow-ups/clinic-review/summary` returns safe counters:

- total follow-ups.
- retention due/reviewed/archived.
- clinic review scheduled/completed/needs policy review.
- quality needs attention.
- closed follow-ups missing local evidence.
- local review event count.

`PATCH /api/v1/clinical/follow-ups/{followUpId}/clinic-review` accepts only:

- `retentionReviewState`.
- `retentionReviewNote`.
- `clinicReviewState`.
- `clinicReviewNote`.

Both routes use existing local JWT auth and clinic RBAC scopes.

## Frontend

The doctor visit workspace now shows a retention/clinic-review summary below
the Stage 19 quality panel and adds row actions for:

- local retention review complete.
- clinic policy review required.
- clinic review completed.

The panel labels the data as local review metadata and does not show provider
tokens, signed URLs, object storage paths, raw patient identity exports, or
external evidence payloads.

## Verification

- `npm run test:stage20a-20z`
- `npm run check:stage20a-20z`
- `npm run preflight:stage20a-20z`

Expected Lovable confirmation after merge to `main`:

`Confirmed: Stage 20A-20Z synced from main, no conflicts.`

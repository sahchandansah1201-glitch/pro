# Stage 28A-28Z · Clinical follow-up SOP policy governance evidence export

Stage 28A-28Z extends Stage 27A-27Z local SOP policy governance closure with a
local evidence export/review checkpoint for follow-up tasks whose governance
closure is complete.

## Scope

- Adds SOP policy governance evidence fields to `clinical_follow_up_tasks`.
- Adds append-only `clinical_follow_up_sop_policy_governance_evidence_events`.
- Adds `GET /api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary`.
- Adds `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence`.
- Publishes `openapi.stage28a-28z.json` through backend and nginx.
- Adds frontend API helpers and doctor workspace evidence export controls.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Database remains local PostgreSQL.
- Evidence export state is local metadata only.
- This stage does not prove external governance approval, legal sign-off,
  external SOP completion, or medical correctness outside this self-hosted
  product boundary.

## PostgreSQL

`clinical_follow_up_tasks` receives:

- `sop_policy_governance_evidence_state`
- `sop_policy_governance_evidence_note`
- `sop_policy_governance_evidence_reviewed_by_user_id`
- `sop_policy_governance_evidence_reviewed_at`

`clinical_follow_up_sop_policy_governance_evidence_events` stores append-only
local evidence state changes.

## Verification

- `npm run test:stage28a-28z`
- `npm run check:stage28a-28z`
- `npm run preflight:stage28a-28z`
- `npm run preflight:stage27a-27z`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

# Stage 29A-29Z · Clinical follow-up SOP policy governance evidence reconciliation

Stage 29A-29Z extends Stage 28A-28Z local SOP policy governance evidence export
with a local reconciliation checkpoint for follow-up tasks whose governance
evidence has been exported.

## Scope

- Adds SOP policy governance evidence reconciliation fields to
  `clinical_follow_up_tasks`.
- Adds append-only
  `clinical_follow_up_sop_policy_governance_evidence_reconciliation_events`.
- Adds
  `GET /api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary`.
- Adds
  `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation`.
- Publishes `openapi.stage29a-29z.json` through backend and nginx.
- Adds frontend API helpers and doctor workspace reconciliation controls.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Database remains local PostgreSQL.
- Reconciliation state is local metadata only.
- This stage does not prove external governance approval, legal sign-off,
  external SOP completion, or medical correctness outside this self-hosted
  product boundary.

## PostgreSQL

`clinical_follow_up_tasks` receives:

- `sop_policy_governance_evidence_reconciliation_state`
- `sop_policy_governance_evidence_reconciliation_note`
- `sop_policy_governance_evidence_reconciled_by_user_id`
- `sop_policy_governance_evidence_reconciled_at`

`clinical_follow_up_sop_policy_governance_evidence_reconciliation_events`
stores append-only local reconciliation state changes.

## Verification

- `npm run test:stage29a-29z`
- `npm run check:stage29a-29z`
- `npm run preflight:stage29a-29z`
- `npm run preflight:stage28a-28z`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

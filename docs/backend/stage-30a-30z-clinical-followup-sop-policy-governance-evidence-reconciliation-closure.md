# Stage 30A-30Z · Clinical follow-up SOP policy governance evidence reconciliation closure

Stage 30A-30Z extends Stage 29A-29Z local SOP policy governance evidence
reconciliation with a local closure checkpoint for follow-up tasks whose
governance evidence has been reconciled.

## Scope

- Adds SOP policy governance evidence reconciliation closure fields to
  `clinical_follow_up_tasks`.
- Adds append-only
  `clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events`.
- Adds
  `GET /api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary`.
- Adds
  `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure`.
- Publishes `openapi.stage30a-30z.json` through backend and nginx.
- Adds frontend API helpers and doctor workspace reconciliation closure controls.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Database remains local PostgreSQL.
- Reconciliation closure state is local metadata only.
- This stage does not prove external governance approval, legal sign-off,
  external SOP completion, or medical correctness outside this self-hosted
  product boundary.

## PostgreSQL

`clinical_follow_up_tasks` receives:

- `sop_policy_governance_evidence_reconciliation_closure_state`
- `sop_policy_governance_evidence_reconciliation_closure_note`
- `sop_policy_governance_evidence_reconciliation_closed_by_user_id`
- `sop_policy_governance_evidence_reconciliation_closed_at`

`clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events`
stores append-only local reconciliation closure state changes.

## Verification

- `npm run test:stage30a-30z`
- `npm run check:stage30a-30z`
- `npm run preflight:stage30a-30z`
- `npm run preflight:stage29a-29z`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

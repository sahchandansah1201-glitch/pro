# Stage 31A-31Z · Clinical follow-up SOP policy governance evidence reconciliation closure receipt

Stage 31A-31Z extends Stage 30A-30Z local SOP policy governance evidence
reconciliation closure with a local receipt checkpoint for follow-up tasks whose
reconciliation closure has been recorded.

## Scope

- Adds SOP policy governance evidence reconciliation closure receipt fields to
  `clinical_follow_up_tasks`.
- Adds append-only
  `clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events`.
- Adds
  `GET /api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary`.
- Adds
  `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt`.
- Publishes `openapi.stage31a-31z.json` through backend and nginx.
- Adds frontend API helpers and doctor workspace closure receipt controls.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Database remains local PostgreSQL.
- Closure receipt state is local metadata only.
- This stage does not prove external governance approval, legal sign-off,
  external SOP completion, or medical correctness outside this self-hosted
  product boundary.

## PostgreSQL

`clinical_follow_up_tasks` receives:

- `sop_policy_governance_evidence_reconciliation_closure_receipt_state`
- `sop_policy_governance_evidence_reconciliation_closure_receipt_note`
- `sop_policy_governance_evidence_reconciliation_closure_received_by_user_id`
- `sop_policy_governance_evidence_reconciliation_closure_received_at`

`clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events`
stores append-only local closure receipt state changes.

## Verification

- `npm run test:stage31a-31z`
- `npm run check:stage31a-31z`
- `npm run preflight:stage31a-31z`
- `npm run preflight:stage30a-30z`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

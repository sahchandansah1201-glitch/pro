# Stage 27A-27Z - Clinical Follow-Up SOP Policy Governance Closure

Stage 27A-27Z extends Stage 26A-26Z local SOP policy governance readiness with a
local governance closure checkpoint for follow-up tasks that have completed
clinic SOP policy governance review.

## Scope

- Adds SOP policy governance closure fields to `clinical_follow_up_tasks`.
- Adds append-only `clinical_follow_up_sop_policy_governance_closure_events`.
- Adds `GET /api/v1/clinical/follow-ups/sop-policy-governance-closure/summary`.
- Adds `PATCH /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-closure`.
- Publishes `/openapi.stage27a-27z.json`.
- Adds frontend API helpers and doctor workspace governance closure controls.
- Adds guard, workflow, project-memory updates, and `preflight-all` wiring.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Source of truth: self-hosted PostgreSQL.
- Browser hardware API dependency: none.
- SOP policy governance closure is local metadata only.
- The repository does not prove external SOP approval, medical correctness,
  legal governance sign-off, or remediation outside this self-hosted product
  boundary.

## Local State

`clinical_follow_up_tasks` stores:

- `sop_policy_governance_closure_state`
- `sop_policy_governance_closure_note`
- `sop_policy_governance_closed_by_user_id`
- `sop_policy_governance_closed_at`

`clinical_follow_up_sop_policy_governance_closure_events` stores append-only
local governance closure state changes.

## Verification

```bash
npm run test:stage27a-27z
npm run check:stage27a-27z
npm run preflight:stage27a-27z
```

Expected Lovable confirmation after merge:

```text
Confirmed: Stage 27A-27Z synced from main, no conflicts.
```

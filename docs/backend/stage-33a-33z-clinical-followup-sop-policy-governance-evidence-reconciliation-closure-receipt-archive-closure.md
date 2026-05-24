# Stage 33A-33Z · Clinical Follow-Up SOP Policy Governance Evidence Reconciliation Closure Receipt Archive Closure

Stage 33A-33Z adds a local archive closure checkpoint after Stage 32A-32Z
archive readiness. The checkpoint is repository-defined and self-hosted only.

## Scope

- PostgreSQL fields on `clinical_follow_up_tasks` for local archive closure
  state, note, actor, and timestamp.
- Append-only
  `clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_events`.
- Backend summary and update endpoints.
- OpenAPI contract at `/openapi.stage33a-33z.json`.
- Frontend self-hosted API adapter and doctor workspace summary/actions.
- Guard, tests, workflow, preflight-all wiring, and project-memory update.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Database: local PostgreSQL.
- Object storage: local self-hosted object store.
- External runtime calls: false.
- Browser hardware APIs: false.

Archive closure is local metadata only. It is not proof of outside
governance sign-off, legal archive sufficiency, or medical correctness.

## Verification

- `npm run test:stage33a-33z`
- `npm run check:stage33a-33z`
- `npm run preflight:stage33a-33z`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

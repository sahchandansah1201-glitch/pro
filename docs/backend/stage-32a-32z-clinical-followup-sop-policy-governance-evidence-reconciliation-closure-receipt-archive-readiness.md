# Stage 32A-32Z · Clinical Follow-Up SOP Policy Governance Evidence Reconciliation Closure Receipt Archive Readiness

Stage 32A-32Z adds a local archive readiness checkpoint after Stage 31A-31Z
closure receipt. The checkpoint is repository-defined and self-hosted only.

## Scope

- PostgreSQL fields on `clinical_follow_up_tasks` for local archive readiness
  state, note, actor, and timestamp.
- Append-only
  `clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_events`.
- Backend summary and update endpoints.
- OpenAPI contract at `/openapi.stage32a-32z.json`.
- Frontend self-hosted API adapter and doctor workspace summary/actions.
- Guard, tests, workflow, preflight-all wiring, and project-memory update.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Database: local PostgreSQL.
- Object storage: local self-hosted object store.
- External runtime calls: false.
- Browser hardware APIs: false.

Archive readiness is local metadata only. It is not proof of outside
governance sign-off, legal archive sufficiency, or medical correctness.

## Verification

- `npm run test:stage32a-32z`
- `npm run check:stage32a-32z`
- `npm run preflight:stage32a-32z`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`

# Stage 37A-37Z - Clinical Follow-Up SOP Archive Closure Receipt Handoff Receipt Reconciliation

Stage 37A-37Z adds a clinic-local reconciliation checkpoint for the Stage 36 archive closure receipt handoff receipt. It keeps the self-hosted boundary intact and stores only local metadata on clinical follow-up tasks.

## Implemented Surface

- `clinical_follow_up_tasks.stage37_archive_handoff_receipt_reconciliation_state`
- `clinical_follow_up_tasks.stage37_archive_handoff_receipt_reconciliation_note`
- `clinical_follow_up_tasks.stage37_archive_handoff_receipt_reconciled_by_user_id`
- `clinical_follow_up_tasks.stage37_archive_handoff_receipt_reconciled_at`
- Append-only `clinical_follow_up_stage37_archive_handoff_receipt_reconciliation_events`
- Backend summary and update routes
- OpenAPI contract at `/openapi.stage37a-37z.json`
- Doctor workspace summary tiles and local reconcile/rework actions
- Guard, workflow, package scripts, preflight-all wiring, and project-memory update

## Boundary

- Managed runtime/database dependency: none
- Managed notification provider dependency: none
- Runtime/database: self-hosted Node.js and local PostgreSQL
- Object storage remains local self-hosted object storage
- No Supabase, managed serverless runtime, managed notification provider, browser hardware APIs, signed URLs, tokens, or raw patient names are introduced
- This reconciliation receipt does not assert external governance acceptance
- This reconciliation receipt does not assert legal archive sufficiency
- This reconciliation receipt does not assert medical correctness

## Verification

- `npm run test:stage37a-37z`
- `npm run check:stage37a-37z`
- `npm run preflight:stage37a-37z`
- `npm run preflight:all -- --dry-run`
- `npm run typecheck`
- `npm run build`
- `node scripts/check-no-deno-locks.mjs`
- `git diff --check`

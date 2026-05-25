# Stage 36A-36Z - Clinical Follow-Up SOP Archive Closure Receipt Handoff Receipt

Stage 36A-36Z adds a clinic-local receipt checkpoint for the Stage 35 archive closure receipt handoff. It keeps the self-hosted boundary intact and stores only local metadata on clinical follow-up tasks.

## Implemented Surface

- `clinical_follow_up_tasks.stage36_archive_handoff_receipt_state`
- `clinical_follow_up_tasks.stage36_archive_handoff_receipt_note`
- `clinical_follow_up_tasks.stage36_archive_handoff_received_by_user_id`
- `clinical_follow_up_tasks.stage36_archive_handoff_received_at`
- Append-only `clinical_follow_up_stage36_archive_handoff_receipt_events`
- Backend summary and update routes
- OpenAPI contract at `/openapi.stage36a-36z.json`
- Doctor workspace summary tiles and local receive/rework actions
- Guard, workflow, package scripts, preflight-all wiring, and project-memory update

## Boundary

- Managed runtime/database dependency: none
- Managed notification provider dependency: none
- Runtime/database: self-hosted Node.js and local PostgreSQL
- Object storage remains local self-hosted object storage
- No Supabase, managed serverless runtime, managed notification provider, browser hardware APIs, signed URLs, tokens, or raw patient names are introduced
- This receipt does not assert external governance acceptance
- This receipt does not assert legal archive sufficiency
- This receipt does not assert medical correctness

## Verification

- `npm run test:stage36a-36z`
- `npm run check:stage36a-36z`
- `npm run preflight:stage36a-36z`
- `npm run preflight:all -- --dry-run`
- `npm run typecheck`
- `npm run build`
- `node scripts/check-no-deno-locks.mjs`
- `git diff --check`

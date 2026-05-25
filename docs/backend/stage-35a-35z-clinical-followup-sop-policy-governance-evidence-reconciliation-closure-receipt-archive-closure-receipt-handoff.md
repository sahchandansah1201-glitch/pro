# Stage 35A-35Z · Clinical Follow-Up SOP Policy Governance Evidence Reconciliation Closure Receipt Archive Closure Receipt Handoff

Stage 35A-35Z adds a clinic-local archive closure receipt handoff checkpoint after the Stage 34 archive closure receipt has been received.

## Scope

- PostgreSQL fields on `clinical_follow_up_tasks` for local archive closure receipt handoff state, note, actor, and timestamp.
- Append-only `clinical_follow_up_stage35_archive_receipt_handoff_events` for local audit history.
- Backend summary and update routes under `/api/v1/clinical/follow-ups/...archive-closure-receipt-handoff`.
- `openapi.stage35a-35z.json` plus nginx publishing.
- Doctor live workspace summary tiles and row actions for archive closure receipt handoff.
- Stage guard, tests, workflow, package scripts, preflight-all wiring, and project-memory handoff updates.

## Boundary

- Managed runtime/database dependency: none.
- Managed notification provider dependency: none.
- Runtime data stays in local PostgreSQL and the existing self-hosted backend.
- This handoff records local operational metadata only. It does not establish external governance approval, legal archive sufficiency, or medical correctness.
- The UI and API do not expose raw patient names, tokens, signed URLs, storage object paths, or managed-provider references.

## Verification

- `npm run test:stage35a-35z`
- `npm run check:stage35a-35z`
- `npm run preflight:stage35a-35z`
- `npm run preflight:stage34a-34z`
- `npm run preflight:all -- --dry-run`
- `node scripts/check-no-deno-locks.mjs`
- `git diff --check`

Expected Lovable confirmation after merge:

```text
Confirmed: Stage 35A-35Z synced from main, no conflicts.
```

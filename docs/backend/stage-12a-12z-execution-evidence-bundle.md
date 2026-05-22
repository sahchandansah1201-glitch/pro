# Stage 12A-12Z · Execution evidence bundle

Stage 12A-12Z turns the Stage 11A-11Z Development quality ledger into an
Execution evidence bundle. The goal is to make future large-batch handoff
claims reproducible: every claim should point to repository files or command
output, not to chat memory.

This is a process and evidence stage. It changes no production routes,
frontend runtime, database schema, deploy topology, or self-hosted runtime
behavior.

## Implementation Evidence

The implementation section requires:

- base commit;
- branch name;
- included stages;
- owned files;
- same-Pull-request justification;
- runtime boundary statement.

The bundle keeps the batch size at 26 related stages after Stage 11A-11Z and
records Stage 13A-13Z as the next hypothesis.

## Diagnostics Evidence

The critical rule is `evidence_not_assertion`: every handoff claim must map to
repository evidence or a command output. A diagnostic entry must include:

- defect found before handoff;
- recurrence class;
- fix applied;
- prevention rule;
- verification command;
- worklog entry.

This extends the Stage 11 `defect_requires_prevention` rule with explicit
evidence capture.

## Verification Evidence

Required local gates are:

```bash
npm run test:stage12a-12z
npm run check:stage12a-12z
npm run evidence:stage12a-12z:dry-run
npm run preflight:stage12a-12z
npm run preflight:stage11a-11z
npm run check:project-memory
npm run typecheck
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
git diff --check
```

The `checks_before_ready` rule keeps the Pull request in draft until local
preflight and GitHub checks have passed.

## GitHub Evidence

The bundle requires evidence for:

- Pull request URL;
- commit SHA;
- check-run summary;
- fallback method for API timeouts;
- merge commit;
- deleted branch status.

GraphQL timeout handling remains explicit: use REST check-runs instead of
using a timeout as permission to skip waiting.

## Lovable Evidence

The `merge_before_prompt` and `lovable_prompt_generated` rules keep Lovable
handoff deterministic. The sync prompt is generated from
`deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json` after merge
into `main` and local `main` verification.

## Product Boundary

- Runtime behavior changed: false.
- Backend routes added: none.
- Frontend product pages added: none.
- Database migrations added: none.
- Managed runtime/database dependency: none.
- Browser hardware APIs: false.
- External runtime calls: false.

The bundle stores repository execution evidence only. It must not include
secrets, patient identifiers, storage references, worker raw data, or live
operator evidence.

## Files

- `deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json`
- `scripts/stage12a-12z-execution-evidence-bundle.mjs`
- `scripts/check-stage12a-12z-execution-evidence-bundle.mjs`
- `docs/project-memory/WORKING_CONTRACT.md`
- `docs/project-memory/BATCH_TEMPLATE.md`
- `.github/workflows/stage12a-12z-execution-evidence-bundle.yml`

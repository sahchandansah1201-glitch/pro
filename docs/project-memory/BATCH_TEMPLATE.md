# BATCH_TEMPLATE

Use this template before starting future multi-stage work.

## Batch Identity

- Batch id:
- Included stages:
- Branch:
- Base branch: `main`
- Expected Pull request title:

## Batch Manifest

- Manifest path:
- Package id:
- Same-PR justification:
- Next-stage hypothesis:

## Why One Pull Request

- Shared product area:
- Shared files or checks:
- Reason this should not be split into small PRs:
- If fewer than three related stages, allowed micro-PR reason:

## Scope

- Backend changes:
- Frontend changes:
- Database changes:
- Deploy or workflow changes:
- Documentation and project-memory changes:

## Product Boundary

- Managed runtime dependency: `none`
- Managed database dependency: `none`
- Browser hardware API dependency:
- External service dependency:
- Data that must stay outside git:

## Required Checks

- Stage-specific tests:
- Stage-specific guard:
- Stage-specific preflight:
- Readiness Reporter:
- Error prevention dry-run:
- Previous-batch regression preflight:
- Typecheck:
- Project memory guard:
- Full preflight dry-run:
- No lock-file guard:
- Whitespace diff check:

## Error Prevention

- Diagnosed defects:
- Source batch for each defect:
- Symptom:
- Prevention rule or guard:
- Test or command that proves the prevention:
- Temporary artifact check completed:
- UI endpoint/request-count drift considered:
- Shared type drift considered:

## Development Quality Ledger

- Batch intake evidence:
- Repository evidence:
- Scope-to-file ownership evidence:
- Diagnostics evidence:
- Verification evidence:
- Pull request evidence:
- Lovable handoff evidence:
- Next x2 batch handoff evidence:

## Execution Evidence Bundle

- Implementation evidence:
- Diagnostics evidence:
- Verification evidence:
- GitHub evidence:
- Lovable evidence:
- Evidence rule ids:
- Checks-before-ready proof:
- Merge-before-prompt proof:
- Previous-batch regression proof:
- Sync-mismatch recovery proof:

## Pull Request Lifecycle

- Branch created:
- Commit created:
- Branch pushed:
- Pull request created:
- Checks passed:
- Pull request merged:
- Local `main` verified:
- Lovable prompt sent after merge:

## Lovable Sync Prompt

Write the exact post-merge prompt here. It must ask Lovable to verify files from
`main`, not from an open PR branch.

## Lovable Verification Manifest

- Required files:
- Required commands:
- Expected confirmation:
- package-lock expectation:
- deno.lock expectation:

## Post-Merge Handoff Gate

- PR merged into `main`:
- Local branch is `main`:
- Stage preflight passed:
- Project-memory guard passed:
- Deno-lock guard passed:
- Lovable prompt allowed:

## Drift Guard

- Manifest and docs aligned:
- Package scripts present:
- Workflow present:
- `preflight-all` label present:
- Project-memory confirmed stage updated:
- Next-stage hypothesis updated:

## Product Roadmap Controls

- Product Gap Register:
- Next Product Batch Planner:
- Roadmap Drift Guard:
- Each next product batch has at least three related stages:
- Managed runtime/database dependency remains `none`:

## Project Memory Refresh

- `PROJECT_STATE.yaml` updated:
- `HANDOFF.md` updated:
- `WORKLOG.md` updated:
- `NEXT_ACTIONS.md` updated:
- `RISKS.md` updated:
- `ARTIFACTS.md` updated:

## Sync Mismatch Recovery

If Lovable reports missing files:

1. Verify the Pull request is merged into `main`.
2. Verify local `main` contains the commit.
3. Verify the connected Lovable project points at the same GitHub repository and
   branch.
4. Trigger Lovable GitHub reconnect or a no-op main commit only after the above
   checks.

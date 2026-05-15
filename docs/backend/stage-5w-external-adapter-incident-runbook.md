# Stage 5W — External adapter incident runbook

Stage 5W adds the production incident playbook for inbound CRM/ad adapters. It
classifies rejected-item spikes, duplicate spikes, and stale imports from local
Stage 5T/5V evidence, then produces an operator-owned adapter-control manifest.

## Scope

- Add `deploy/self-hosted/integrations/adapter-incident-policy.stage5w.example.json`.
- Add `scripts/stage5w-external-adapter-incident-runbook.mjs`.
- Generate a local incident report with:
  - severity
  - recommended adapter state
  - incident reasons
  - pause/resume checklist
  - adapter-control manifest
  - evidence checklist
- Keep adapter control outside the core product runtime.

## Product Boundary

- Managed runtime/database dependency: none.
- The runbook CLI performs no network calls.
- The product does not stop, start, poll, or call external CRM/ad services.
- Pause/resume is operator-owned: the generated adapter-control manifest is a
  local file consumed by the clinic's adapter process.
- The self-hosted product remains available while an adapter is paused.
- Reports must not contain raw CRM URLs, tokens, patient names, storage paths,
  signed URL fields, or managed-runtime IDs.

## Local Usage

Generate the bundled incident runbook:

```bash
npm run adapter:stage5w:incident:example
```

Write report and adapter-control manifest:

```bash
node scripts/stage5w-external-adapter-incident-runbook.mjs \
  --input deploy/self-hosted/integrations/booking-import.stage5u.example.json \
  --status-file deploy/self-hosted/integrations/booking-import-status.stage5v.example.json \
  --policy-file deploy/self-hosted/integrations/adapter-incident-policy.stage5w.example.json \
  --output test-results/stage5w-incident-runbook.md \
  --control-output var/self-hosted/integrations/clinic-crm.adapter-control.json \
  --dry-run
```

For incident response, attach:

- Stage 5W incident runbook
- Stage 5V operator report
- Stage 5T status snapshot
- sanitized Stage 5U payload summary

## Validation

```bash
npm run preflight:stage5w
npm run preflight:stage5v
npm run preflight:stage5u
node scripts/check-no-deno-locks.mjs
```

The Stage 5W guard verifies policy fixture, runbook CLI, tests, workflow, docs,
package scripts, preflight-all wiring, and protected-file runtime boundary.

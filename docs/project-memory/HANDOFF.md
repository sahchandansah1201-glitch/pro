# HANDOFF

## Scope

This handoff captures the repository state while Stage 8A-8C is being
implemented on branch `codex/stage8a-8c-crm-inbound-adapter`.

## Confirmed state

1. Stage 6A-6Z and Stage 7A-7I are present on the current branch base.
2. Stage 7A-7C is the development workflow contract.
3. Stage 7D-7F is the batch automation contract and Lovable prompt gate.
4. Stage 7G-7I is the confirmed batch verification loop:
   - readiness reporter;
   - Lovable sync verification manifest;
   - drift guard.
5. Stage 7J-7L adds a product roadmap control layer only:
   - Stage 7J: product gap register.
   - Stage 7K: next product batch planner.
   - Stage 7L: product roadmap drift guard.
6. Stage 8A-8C implements the CRM inbound adapter layer:
   - Stage 8A: CRM inbound adapter contract.
   - Stage 8B: CRM export normalization into Stage 5Q import payloads.
   - Stage 8C: safe import audit flow.
7. Stage 8A-8C product boundary:
   - no backend route changes;
   - no database migrations;
   - no frontend runtime pages;
   - no managed runtime or managed database dependency;
   - no browser/backend runtime calls to CRM or advertising systems.

## Important operational fact

The Lovable sync prompt remains valid only after the Pull request is merged
into `main` and local `main` is verified. A prompt for an open PR branch is
expected to produce a false "missing files" result because Lovable follows
`main` unless branch switching is explicitly enabled.

## Hypothesis

- `Stage 8D-8F` is the next likely product batch after Stage 8A-8C.

## Immediate continuation recommendation

1. Finish Stage 8A-8C in one Pull request.
2. Run:
   - `npm run preflight:stage8a-8c`
   - `npm run preflight:stage7j-7l`
   - `npm run check:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`
3. Create the Pull request, wait for checks, merge into `main`, verify local
   `main`, then send the Lovable sync prompt.
4. Future product batches should default to at least three related stages per
   Pull request unless a documented hotfix reason applies.

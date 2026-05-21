# NEXT_ACTIONS

## Highest-confidence next step

Complete Stage 8D-8F as one Pull request, then merge it before sending the
Lovable sync prompt.

## Immediate sequence

1. **Complete Stage 8D-8F implementation**:
   - keep the scope focused on local availability sync snapshots, conflict
     detection, booking confirmation readiness, operator UI summary, guard, CI
     guard, and preflight wiring;
   - do not add browser/backend runtime calls to CRM, advertising systems, or
     external scheduling services.

2. **Verify before commit**:
   - `npm run test:stage8d-8f`
   - `npm run check:stage8d-8f`
   - `npm run availability:stage8d-8f:dry-run`
   - `npm run preflight:stage8d-8f`
   - `npm run preflight:stage5r`
   - `npm run preflight:stage5s`
   - `npm run test:project-memory`
   - `npm run check:project-memory`
   - `npm run preflight:all -- --dry-run`
   - `node scripts/check-no-deno-locks.mjs`

3. **Complete the Pull request lifecycle**:
   - commit and push the branch;
   - create the Pull request;
   - wait for checks;
   - merge into `main`;
   - verify local `main`;
   - only then send Lovable the sync prompt.

4. **Use the product roadmap for the next implementation phase**:
   - minimum three related stages per Pull request;
   - smaller PRs require a documented reason: urgent CI fix, security fix,
     single-file typo, or hotfix.

## Stage 8G-8I hypothesis

Stage 8G-8I is the next likely product batch after Stage 8D-8F. Its current
roadmap scope is clinical reporting completion after booking readiness, but it
remains a hypothesis until repository files define it.

Historical note: Stage 7G-7I is complete and introduced the batch verification
loop that Stage 7J-7L now uses for product-roadmap planning. Stage 7D-7F
remains the confirmed batch automation contract and Lovable prompt gate
foundation.

Historical roadmap anchor: Stage 8A-8C is complete and remains the confirmed
CRM inbound adapter batch that Stage 7J-7L uses as the original next-product
batch handoff target. Do not remove this historical Stage 8A-8C marker when
updating current next actions.

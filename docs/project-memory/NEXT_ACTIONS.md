# NEXT_ACTIONS

## Highest-confidence next step

Complete Stage 7J-7L as one Pull request, then merge it before sending the
Lovable sync prompt.

## Immediate sequence

1. **Complete Stage 7J-7L implementation**:
   - keep the scope limited to product gap register, next product batch
     planner, roadmap dry-run, drift guard, CI guard, and preflight wiring;
   - do not change product runtime behavior in this stage.

2. **Verify before commit**:
   - `npm run test:stage7j-7l`
   - `npm run check:stage7j-7l`
   - `npm run roadmap:stage7j-7l:dry-run`
   - `npm run preflight:stage7j-7l`
   - `npm run preflight:stage7g-7i`
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

## Stage 8A-8C hypothesis

Stage 8A-8C is the next likely product batch after Stage 7J-7L. Its current
roadmap scope is CRM inbound adapter implementation, but it remains a
hypothesis until repository files define it.

Historical note: Stage 7G-7I is complete and introduced the batch verification
loop that Stage 7J-7L now uses for product-roadmap planning. Stage 7D-7F
remains the confirmed batch automation contract and Lovable prompt gate
foundation.

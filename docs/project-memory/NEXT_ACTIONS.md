# NEXT_ACTIONS

## Highest-confidence next step

Complete Stage 8A-8C as one Pull request, then merge it before sending the
Lovable sync prompt.

## Immediate sequence

1. **Complete Stage 8A-8C implementation**:
   - keep the scope focused on CRM inbound adapter contract, export
     normalization, safe import audit, guard, CI guard, and preflight wiring;
   - do not add browser/backend runtime calls to CRM or advertising systems.

2. **Verify before commit**:
   - `npm run test:stage8a-8c`
   - `npm run check:stage8a-8c`
   - `npm run adapter:stage8a-8c:dry-run`
   - `npm run preflight:stage8a-8c`
   - `npm run preflight:stage7j-7l`
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

## Stage 8D-8F hypothesis

Stage 8D-8F is the next likely product batch after Stage 8A-8C. Its current
roadmap scope is appointment availability sync and booking confirmation, but it
remains a hypothesis until repository files define it.

Historical note: Stage 7G-7I is complete and introduced the batch verification
loop that Stage 7J-7L now uses for product-roadmap planning. Stage 7D-7F
remains the confirmed batch automation contract and Lovable prompt gate
foundation.

# Stage 16A-16Z - Product cycle readiness

Stage 16A-16Z converts the Stage 15A-15Z post-sync handoff into a
repository-owned product-cycle readiness packet. It is intentionally a
planning and gate batch: it does not change production runtime behavior,
backend routes, frontend pages, database schema, or deployment topology.

The goal is to stop drifting through process-only batches. Stage 16 freezes
the evidence needed to choose the next product-facing implementation cycle.

## Scope

- Stage 16A: Post-sync baseline intake
- Stage 16B: Product roadmap replay
- Stage 16C: Product-facing batch selection
- Stage 16D: Backend surface inventory
- Stage 16E: Frontend surface inventory
- Stage 16F: Data contract inventory
- Stage 16G: External intake inventory
- Stage 16H: Device Bridge inventory
- Stage 16I: RBAC and security inventory
- Stage 16J: Production UX gap inventory
- Stage 16K: Test debt inventory
- Stage 16L: Migration and deploy debt inventory
- Stage 16M: Operations readiness inventory
- Stage 16N: Next product batch rules
- Stage 16O: Acceptance criteria freeze
- Stage 16P: File ownership map
- Stage 16Q: Risk and defect prevention map
- Stage 16R: Stage 15 regression gate
- Stage 16S: Command bundle freeze
- Stage 16T: Lovable sync prompt freeze
- Stage 16U: Sync mismatch diagnostic freeze
- Stage 16V: Self-hosted boundary assertion
- Stage 16W: Privacy and artifact hygiene assertion
- Stage 16X: Pull request lifecycle gate
- Stage 16Y: Stage 17 hypothesis
- Stage 16Z: Product-cycle handoff packet

## Recommended product candidate

The manifest records three candidate product cycles. The recommended
hypothesis for Stage 17A-17Z is:

`Clinical follow-up and patient communication loop`
(clinical follow-up and patient communication loop)

Reason: it connects doctor workspace, patient portal, visit schedule, and
self-hosted notification/audit contracts without adding a managed dependency.

Alternate hypotheses remain:

- Clinic intake reconciliation workbench
- Device Bridge image-quality operations loop

Stage 17 remains a hypothesis until repository files define the concrete
scope.

## Required rules

The guard requires these rule identifiers:

- `product_cycle_not_chat_memory`
- `product_facing_batch_required`
- `stage15_regression_required`
- `surface_inventory_required`
- `lovable_prompt_from_manifest`
- `next_stage_hypothesis_recorded`

These rules close a repeatable failure mode: after a successful Lovable sync,
the next work can drift back into process-only evidence unless the repository
forces a product-facing selection or records a clear blocker.

## Verification

Run:

```bash
npm run test:stage16a-16z
npm run check:stage16a-16z
npm run readiness:stage16a-16z:dry-run
npm run preflight:stage16a-16z
```

The preflight also runs `npm run preflight:stage15a-15z`, project-memory
checks, TypeScript typecheck, no-deno-lock guard, and `git diff --check`.

## Product boundary

- Runtime behavior changed: false
- Managed runtime/database dependency: none
- Browser hardware APIs: false
- External runtime calls: false
- Data visibility: repository product-cycle planning evidence only

Managed runtime/database dependency: none.

The Stage 16 protected files must not introduce managed-runtime references,
browser hardware APIs, raw patient identifiers, bearer values, signed link
values, storage paths, worker raw values, or binary object references.

## Lovable prompt policy

The prompt is generated from
`deploy/self-hosted/product-cycle-readiness.stage16a-16z.json`. It is valid
only after the Pull request is merged into `main`, local `main` is verified,
and GitHub checks are green.

Expected Lovable response:

`Confirmed: Stage 16A-16Z synced from main, no conflicts.`

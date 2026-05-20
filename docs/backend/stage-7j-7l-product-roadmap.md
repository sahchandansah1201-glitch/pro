# Stage 7J-7L — Product roadmap control

Stage 7J-7L closes the process-only Stage 7 sequence by turning the repository
back toward product delivery. It does not add product runtime behavior. It
records the next product gaps, groups the next work into larger related
batches, and guards the roadmap against drift.

- Stage 7J: Product gap register.
- Stage 7K: Next product batch planner.
- Stage 7L: Product roadmap drift guard.

## Stage 7J: Product gap register

The register lives in
`deploy/self-hosted/product-roadmap.stage7j-7l.json`. It records confirmed
product areas and planned gaps using repository evidence paths only.

The register intentionally does not claim live go-live approval or external
operator evidence. It only records what the repository can verify.

## Stage 7K: Next product batch planner

`scripts/stage7j-7l-product-roadmap.mjs` renders the dry-run roadmap:

```bash
npm run roadmap:stage7j-7l:dry-run
```

The next product batches are:

- Stage 8A-8C — CRM inbound adapter implementation.
- Stage 8D-8F — Appointment availability sync and booking confirmation.
- Stage 8G-8I — Clinical reporting completion.
- Stage 8J-8L — Device Bridge production hardening.
- Stage 8M-8O — Server operations handbook.

Each batch has at least three related stages, preserving the Stage 7B batch
size rule.

## Stage 7L: Product roadmap drift guard

`scripts/check-stage7j-7l-product-roadmap.mjs` verifies:

- manifest, docs, reporter, tests, workflow, package scripts, and
  `preflight-all` describe the same Stage 7J-7L batch;
- each next product batch has at least three stages;
- project-memory records Stage 7J-7L as confirmed and Stage 8A-8C as the next
  hypothesis;
- protected files do not introduce runtime coupling, raw patient identifiers,
  object-storage paths, signed URLs, or browser hardware APIs.

## Required checks

```bash
npm run test:stage7j-7l
npm run check:stage7j-7l
npm run roadmap:stage7j-7l:dry-run
npm run preflight:stage7j-7l
npm run check:project-memory
node scripts/check-no-deno-locks.mjs
```

## Product boundary

- Runtime product change: false.
- Backend schema change: false.
- Frontend runtime change: false.
- Managed runtime/database dependency: none.
- Browser hardware API dependency: false.

Stage 7J-7L is a planning and guardrail batch. The product implementation work
begins in the next hypothesis, Stage 8A-8C.

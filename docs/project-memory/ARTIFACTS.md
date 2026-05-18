# ARTIFACTS

## Core repository references

1. Project/product docs:
   - [PRODUCT.md](../../PRODUCT.md)
   - [DESIGN.md](../../DESIGN.md)
   - [README.md](../../README.md)

2. Stage 6 manifests:
   - [acceptance-baseline.stage6a.json](../../deploy/self-hosted/acceptance-baseline.stage6a.json)
   - [server-install-package.stage6b.json](../../deploy/self-hosted/server-install-package.stage6b.json)
   - [install-verification.stage6c.json](../../deploy/self-hosted/install-verification.stage6c.json)
   - [live-install-evidence.stage6d.json](../../deploy/self-hosted/live-install-evidence.stage6d.json)
   - [go-live-handoff.stage6e.json](../../deploy/self-hosted/go-live-handoff.stage6e.json)

3. Stage 6 docs:
   - [stage-6a-production-acceptance-baseline.md](../backend/stage-6a-production-acceptance-baseline.md)
   - [stage-6b-server-install-package.md](../backend/stage-6b-server-install-package.md)
   - [stage-6c-production-install-verification.md](../backend/stage-6c-production-install-verification.md)
   - [stage-6d-live-install-evidence-receipt.md](../backend/stage-6d-live-install-evidence-receipt.md)
   - [stage-6e-production-go-live-handoff.md](../backend/stage-6e-production-go-live-handoff.md)

4. Stage 6 scripts:
   - [stage6a-production-acceptance-baseline.mjs](../../scripts/stage6a-production-acceptance-baseline.mjs)
   - [stage6b-server-install-package.mjs](../../scripts/stage6b-server-install-package.mjs)
   - [stage6c-production-install-verification.mjs](../../scripts/stage6c-production-install-verification.mjs)
   - [stage6d-live-install-evidence-receipt.mjs](../../scripts/stage6d-live-install-evidence-receipt.mjs)
   - [stage6e-production-go-live-handoff.mjs](../../scripts/stage6e-production-go-live-handoff.mjs)

5. Stage 6 guards:
   - [check-stage6a-production-acceptance-baseline.mjs](../../scripts/check-stage6a-production-acceptance-baseline.mjs)
   - [check-stage6b-server-install-package.mjs](../../scripts/check-stage6b-server-install-package.mjs)
   - [check-stage6c-production-install-verification.mjs](../../scripts/check-stage6c-production-install-verification.mjs)
   - [check-stage6d-live-install-evidence-receipt.mjs](../../scripts/check-stage6d-live-install-evidence-receipt.mjs)
   - [check-stage6e-production-go-live-handoff.mjs](../../scripts/check-stage6e-production-go-live-handoff.mjs)

6. Stage 6 workflows:
   - [.github/workflows/stage6a-production-acceptance-baseline.yml](../../.github/workflows/stage6a-production-acceptance-baseline.yml)
   - [.github/workflows/stage6b-server-install-package.yml](../../.github/workflows/stage6b-server-install-package.yml)
   - [.github/workflows/stage6c-production-install-verification.yml](../../.github/workflows/stage6c-production-install-verification.yml)
   - [.github/workflows/stage6d-live-install-evidence-receipt.yml](../../.github/workflows/stage6d-live-install-evidence-receipt.yml)
   - [.github/workflows/stage6e-production-go-live-handoff.yml](../../.github/workflows/stage6e-production-go-live-handoff.yml)

## Verification outputs captured during black-box creation

1. `git status -sb` -> clean on `main`.
2. `node scripts/check-no-deno-locks.mjs` -> OK.
3. `npm run preflight:stage6d` -> PASS:
   - 10 tests passed.
   - Guard passed (`7 files checked`).
   - Stage 6D report rendered in dry-run mode with zero leak findings.

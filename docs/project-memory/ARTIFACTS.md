# ARTIFACTS

## Core repository references

1. Project/product docs:
   - [PRODUCT.md](/Users/istokdmgmail.com/Documents/GitHub/pro/PRODUCT.md)
   - [DESIGN.md](/Users/istokdmgmail.com/Documents/GitHub/pro/DESIGN.md)
   - [README.md](/Users/istokdmgmail.com/Documents/GitHub/pro/README.md)

2. Stage 6 manifests:
   - [acceptance-baseline.stage6a.json](/Users/istokdmgmail.com/Documents/GitHub/pro/deploy/self-hosted/acceptance-baseline.stage6a.json)
   - [server-install-package.stage6b.json](/Users/istokdmgmail.com/Documents/GitHub/pro/deploy/self-hosted/server-install-package.stage6b.json)
   - [install-verification.stage6c.json](/Users/istokdmgmail.com/Documents/GitHub/pro/deploy/self-hosted/install-verification.stage6c.json)
   - [live-install-evidence.stage6d.json](/Users/istokdmgmail.com/Documents/GitHub/pro/deploy/self-hosted/live-install-evidence.stage6d.json)

3. Stage 6 docs:
   - [stage-6a-production-acceptance-baseline.md](/Users/istokdmgmail.com/Documents/GitHub/pro/docs/backend/stage-6a-production-acceptance-baseline.md)
   - [stage-6b-server-install-package.md](/Users/istokdmgmail.com/Documents/GitHub/pro/docs/backend/stage-6b-server-install-package.md)
   - [stage-6c-production-install-verification.md](/Users/istokdmgmail.com/Documents/GitHub/pro/docs/backend/stage-6c-production-install-verification.md)
   - [stage-6d-live-install-evidence-receipt.md](/Users/istokdmgmail.com/Documents/GitHub/pro/docs/backend/stage-6d-live-install-evidence-receipt.md)

4. Stage 6 scripts:
   - [stage6a-production-acceptance-baseline.mjs](/Users/istokdmgmail.com/Documents/GitHub/pro/scripts/stage6a-production-acceptance-baseline.mjs)
   - [stage6b-server-install-package.mjs](/Users/istokdmgmail.com/Documents/GitHub/pro/scripts/stage6b-server-install-package.mjs)
   - [stage6c-production-install-verification.mjs](/Users/istokdmgmail.com/Documents/GitHub/pro/scripts/stage6c-production-install-verification.mjs)
   - [stage6d-live-install-evidence-receipt.mjs](/Users/istokdmgmail.com/Documents/GitHub/pro/scripts/stage6d-live-install-evidence-receipt.mjs)

5. Stage 6 guards:
   - [check-stage6a-production-acceptance-baseline.mjs](/Users/istokdmgmail.com/Documents/GitHub/pro/scripts/check-stage6a-production-acceptance-baseline.mjs)
   - [check-stage6b-server-install-package.mjs](/Users/istokdmgmail.com/Documents/GitHub/pro/scripts/check-stage6b-server-install-package.mjs)
   - [check-stage6c-production-install-verification.mjs](/Users/istokdmgmail.com/Documents/GitHub/pro/scripts/check-stage6c-production-install-verification.mjs)
   - [check-stage6d-live-install-evidence-receipt.mjs](/Users/istokdmgmail.com/Documents/GitHub/pro/scripts/check-stage6d-live-install-evidence-receipt.mjs)

6. Stage 6 workflows:
   - [.github/workflows/stage6a-production-acceptance-baseline.yml](/Users/istokdmgmail.com/Documents/GitHub/pro/.github/workflows/stage6a-production-acceptance-baseline.yml)
   - [.github/workflows/stage6b-server-install-package.yml](/Users/istokdmgmail.com/Documents/GitHub/pro/.github/workflows/stage6b-server-install-package.yml)
   - [.github/workflows/stage6c-production-install-verification.yml](/Users/istokdmgmail.com/Documents/GitHub/pro/.github/workflows/stage6c-production-install-verification.yml)
   - [.github/workflows/stage6d-live-install-evidence-receipt.yml](/Users/istokdmgmail.com/Documents/GitHub/pro/.github/workflows/stage6d-live-install-evidence-receipt.yml)

## Verification outputs captured during black-box creation

1. `git status -sb` -> clean on `main`.
2. `node scripts/check-no-deno-locks.mjs` -> OK.
3. `npm run preflight:stage6d` -> PASS:
   - 10 tests passed.
   - Guard passed (`7 files checked`).
   - Stage 6D report rendered in dry-run mode with zero leak findings.

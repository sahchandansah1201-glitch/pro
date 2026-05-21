# Stage 8G-8I — Clinical reporting completion

Stage 8G-8I completes the production clinical reporting loop after the
Stage 5H assessment/conclusion/report contracts.

- Stage 8G: backend report-package read contract.
- Stage 8H: readiness gate for assessment, conclusion, report, lesion, and
  asset completeness.
- Stage 8I: production report-tab summary in the doctor workspace.

## Scope

- `GET /api/v1/visits/{visitId}/report-package`
- `backend/self-hosted/clinical-report-package-repository.mjs`
- `backend/self-hosted/clinical-report-package-service.mjs`
- `src/lib/self-hosted-clinical-report-package-api.ts`
- `VisitWorkspacePage` production report tab

The report package is a safe, count-oriented readiness snapshot. It includes
statuses, presence booleans, missing gate keys, lesion count, asset count, and
the self-hosted product boundary.

## Runtime boundary

- Managed runtime/database dependency: none
- Source of truth: local PostgreSQL tables
- External CRM/ad/scheduling runtime calls: false
- Browser hardware APIs: false
- Raw patient data in report package: false

The endpoint does not expose object storage paths, signed URLs, access tokens,
raw external payloads, or raw patient identifiers beyond scoped internal ids
already used by the self-hosted API.

## Readiness gates

The package is `ready` only when:

- assessment exists and is `ready` or `signed`;
- assessment summary is present;
- conclusion exists and is `ready` or `signed`;
- conclusion summary is present;
- report exists and is `signed`;
- report physician text is present;
- report patient-safe text is present.

Otherwise the package is `blocked` and returns stable missing keys such as
`assessment_missing`, `report_not_signed`, or `patient_safe_text_missing`.

## Audit

Every read records:

- action: `clinical_report.package.read`
- entity type: `visit`
- metadata: ready flag, missing count, lesion count, asset count

Audit metadata is count-only and safe for logs.

## Validation

```bash
npm run test:stage8g-8i
npm run check:stage8g-8i
npm run preflight:stage8g-8i
npm run preflight:stage5h
npm run preflight:stage5g
npm run test:project-memory
npm run check:project-memory
node scripts/check-no-deno-locks.mjs
```

Expected:

- backend repository/service/routes tests pass;
- frontend client and workspace tests pass;
- guard confirms product boundary and project-memory markers;
- `package-lock.json` remains unchanged;
- no `deno.lock` files exist.

## Next stage

Stage 8J-8L is a hypothesis until repository files define it. The current
roadmap names it as Device Bridge production hardening.

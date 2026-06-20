# Stage 5H Production Clinical Evidence Closure Runbook

This runbook turns a production aggregate validation export into a strict
closure bundle and an audit-safe receipt for SD-MF-025, SD-MF-026, and SD-MF-028.

## Required Input

Use a JSON export with:

- `evidenceScope.source = "production_clinic_operations"`;
- `evidenceScope.sampleContract = false`;
- `evidenceScope.realClinicalDataset = true`;
- `evidenceScope.realProtectedAssets = true`;
- `evidenceScope.mockDataUsed = false`;
- `evidenceScope.patientRowsIncluded = false`;
- `evidenceScope.sourceLogsIncluded = false`;
- `validation` containing the five aggregate Stage 5H sections:
  - `timelineRolloutLongitudinalClinicalValidation`;
  - `timelineRolloutProductionDatasetEvidence`;
  - `timelineRolloutProductionReviewerRollbackEvidence`;
  - `timelineRolloutProductionReviewerGovernance`;
  - `timelineRolloutProductionReviewerEvidence`.

The export must contain aggregate counters only. Do not include patient rows,
raw logs, storage paths, signed URLs, access tokens, session IDs, credentials,
reviewer identities, diagnosis, risk, prognosis, treatment, measurements, or
dynamic conclusions.

## API Export And Strict Run

When a self-hosted clinic backend is available, prefer the API exporter. It
fetches the aggregate validation endpoint, keeps only the five closure evidence
sections, validates strict production boundaries before writing files, and then
writes the bundle and receipt.

```bash
SELF_HOSTED_API_BASE_URL="https://<clinic-host>" \
SELF_HOSTED_BEARER_TOKEN="<staff-token-with-visit-read-scope>" \
STAGE5H_VISIT_ID="<visit-id>" \
STAGE5H_CONFIRM_REAL_PRODUCTION_AGGREGATE="I_CONFIRM_REAL_AGGREGATE_NO_PATIENT_ROWS" \
npm run export:stage5h:clinical-evidence-from-api -- \
  --out-dir reports/stage5h-production-clinical-evidence
```

The exporter does not print the bearer token. If the API response contains
protected keys, clinical-output keys, non-zero blockers, or missing production
counts, it fails before writing `validation-export.json`,
`evidence-bundle.json`, or `evidence-closure-receipt.json`.

After the export succeeds, independently verify the receipt package:

```bash
npm run verify:stage5h:clinical-evidence-receipt -- \
  --dir reports/stage5h-production-clinical-evidence
```

## Strict Run

```bash
npm run build:stage5h:clinical-evidence-bundle -- \
  --strict-production \
  --source <validation-export.json> \
  --out <evidence-bundle.json>

npm run run:stage5h:clinical-evidence-closure -- \
  --source <validation-export.json> \
  --out-dir reports/stage5h-production-clinical-evidence
```

The second command writes:

- `evidence-bundle.json`;
- `evidence-closure-receipt.json`.

Then verify the package:

```bash
npm run verify:stage5h:clinical-evidence-receipt -- \
  --dir reports/stage5h-production-clinical-evidence
```

`reports/` is ignored by git. Do not commit real clinic evidence exports or
receipts unless the clinic explicitly approves a safe artifact publication
process.

## What The Receipt Proves

The receipt records:

- repository HEAD and branch;
- source file name and SHA-256 hash;
- generated bundle SHA-256 hash;
- strict production mode;
- checked evidence section count;
- SD-MF coverage;
- passed safety boundaries.

The receipt does not store the raw source export, patient rows, raw logs,
storage paths, signed URLs, credentials, or clinical text.

The verifier checks:

- the source and bundle SHA-256 hashes recorded in the receipt;
- the bundle passes strict production validation again;
- all five section statuses are ready;
- SD-MF-025, SD-MF-026, and SD-MF-028 are represented;
- patient delivery, measurements, protected fields, clinical output, and raw
  source payload storage remain false;
- the receipt itself does not contain raw aggregate counters, protected keys,
  clinical keys, storage paths, signed URLs, credentials, or token/session
  material.

## Closing Rules

`SD-MF-025` can be marked resolved only after the strict run passes with real
longitudinal clinical validation and production dataset evidence aggregates.

`SD-MF-026` can be marked resolved only after the strict run passes with real
production reviewer rollback, governance, and evidence aggregates.

`SD-MF-028` can be marked resolved only if the same strict run confirms:

- `patientDeliveryAllowed = false`;
- `medicalMeasurementAllowed = false`;
- `protectedFieldsExposed = false`;
- `clinicalOutputGenerated = false`;
- no diagnosis, risk, prognosis, treatment, measurement, or dynamic conclusion
  keys are present.

If any required aggregate count is zero, any blocker is non-zero, or any safety
flag is enabled, the receipt is not written and the SD-MF item remains open.

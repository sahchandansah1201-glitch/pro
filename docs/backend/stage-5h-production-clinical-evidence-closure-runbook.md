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

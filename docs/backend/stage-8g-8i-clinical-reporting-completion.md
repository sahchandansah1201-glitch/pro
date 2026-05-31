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
statuses, presence booleans, missing gate keys, lesion count, asset count, the
self-hosted product boundary, and a `patientPhotoProtocol` metadata contract
for Batch Q / SD-MF-046.

`patientPhotoProtocol` is not a file-delivery feature. It only states whether
doctor-selected photo/protocol metadata is ready for a future backend contract
and records why patient delivery remains blocked. It exposes photo counts,
consent/readiness blockers, and safe delivery-boundary booleans.

## Runtime boundary

- Managed runtime/database dependency: none
- Source of truth: local PostgreSQL tables
- External CRM/ad/scheduling runtime calls: false
- Browser hardware APIs: false
- Raw patient data in report package: false

The endpoint does not expose object storage paths, signed URLs, access tokens,
raw external payloads, or raw patient identifiers beyond scoped internal ids
already used by the self-hosted API.

For the patient photo/protocol contract specifically, the endpoint also marks:

- raw files exposed: false;
- storage paths exposed: false;
- signed URLs issued: false;
- tokens exposed: false;
- physician text exposed: false;
- release audit required: true;
- revoke required: true;
- patient identity check required: true.

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

## Patient photo/protocol metadata gate

The `patientPhotoProtocol` object uses a separate gate from report readiness.
It is `metadata_ready_backend_blocked` only when:

- imaging consent exists;
- at least one patient photo asset exists (`overview_photo` or `dermoscopy`);
- the report exists and is signed;
- report patient-safe text is present.

Even in that state, `deliveryBoundary.patientDeliveryAllowed` remains `false`
and `self_hosted_photo_delivery_contract_missing` remains in `missing` until a
real self-hosted file proxy, release audit, revoke flow, patient identity gate,
and retention contract are implemented.

If any metadata gate is missing, the object is `blocked` and returns stable
keys such as `imaging_consent_missing`, `patient_photo_assets_missing`,
`report_not_signed`, or `patient_safe_text_missing`.

## Patient photo/protocol release ledger

Batch R adds the first persistence layer for the SD-MF-046 photo/protocol
release workflow:

- migration: `0055_patient_photo_protocol_releases.sql`;
- `POST /api/v1/visits/{visitId}/patient-photo-protocol-release`;
- `POST /api/v1/visits/{visitId}/patient-photo-protocol-release/revoke`;
- repository/service tests for prepare, revoke, RBAC, and protected-field
  hygiene.

This is still not patient photo delivery. The release ledger records
doctor-write prepare/revoke metadata, safe selected-photo counts, blockers,
expiry, and audit actions. It does not expose raw files, storage paths, signed
links, access tokens, or physician-only text. A `prepared` ledger row means the
metadata gate is ready and the only remaining blocker is
`self_hosted_photo_delivery_contract_missing`; patient delivery remains
blocked until a real self-hosted file proxy, identity check, patient portal read
model, retention policy, and approved patient-safe copy gates are implemented.

## Audit

Every read records:

- action: `clinical_report.package.read`
- entity type: `visit`
- metadata: ready flag, missing count, lesion count, asset count,
  patient photo protocol status, patient photo count, and patient photo
  delivery allowed flag

Audit metadata is count-only and safe for logs.

Prepare/revoke operations record separate metadata-only audit events:

- action: `patient_photo_protocol.release.prepare`;
- action: `patient_photo_protocol.release.revoke`;
- metadata: visit id, status, selected-photo count, blocker count, delivery
  allowed flag, and revoke reason presence only.

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

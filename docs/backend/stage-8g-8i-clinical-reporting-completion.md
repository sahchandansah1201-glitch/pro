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
- `POST /api/v1/visits/{visitId}/patient-photo-protocol-release/policy`;
- `POST /api/v1/visits/{visitId}/patient-photo-protocol-release/revoke`;
- `GET /api/v1/visits/{visitId}/patient-photo-protocol-release/audit`;
- `GET /api/v1/patient-photo-protocol-release/governance`;
- `POST /api/v1/patient-photo-protocol-release/governance/revoke-expired`;
- `POST /api/v1/patient-photo-protocol-release/governance/block-missing-expiry`;
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

## Policy governance review

Batch Y adds doctor-side policy governance for the same release ledger:

- `POST /api/v1/visits/{visitId}/patient-photo-protocol-release/policy`;
- payload can update `patientFileProxyEnabled`, `patientCopyApproved`,
  `retentionPolicyApproved`, and `expiresAt`;
- write stays metadata-only: no raw files, storage paths, signed links, tokens,
  object identifiers, or revoke reason text are exposed;
- audit adds `patient_photo_protocol.release.policy_review` and is visible in
  immutable staff/admin release audit counters.

## Staff/admin immutable audit review

Batch W adds a staff/admin read-model for the release ledger:

- `GET /api/v1/visits/{visitId}/patient-photo-protocol-release/audit`;
- repository SQL reads `patient_photo_protocol_releases` plus append-only
  `audit_log` events for prepare, revoke, patient read, proxy download, and
  proxy denial;
- service uses visit read scope, so doctor, clinic admin, and system admin can
  review the safe ledger inside their clinic scope;
- production `VisitWorkspacePage` report tab shows `Журнал выдачи фото` with
  immutable audit counts and event labels.

The audit review is intentionally safe and not a raw audit export. It returns
event labels, timestamps, actor type (`staff` or `patient`), counters, status,
and reason-present booleans. It does not expose raw audit payloads, actor
identifiers, internal request identifiers, revoke reason text, object storage
identifiers, storage paths, signed links, tokens, or physician-only text.

## Staff/admin aggregate governance

Batch AB adds a clinic-scope governance read model for administrator and
private-practice operating screens:

- `GET /api/v1/patient-photo-protocol-release/governance`;
- production admin route `/admin/governance`;
- UI title: `Управление доступом`;
- aggregate summary for prepared, blocked, revoked, retention, patient-copy,
  file-proxy and expiry gates;
- metadata-only queue rows with queue number, status, policy status, selected
  photo count, blocker count, expiry, update time and attention flags.
- Batch AC extends the same response with aggregate-only `operations` readiness:
  retention review due/ready counts, revoke-review readiness, and patient
  session lifecycle counters. These fields support the admin UI blocks
  `Операционный контур`, `Retention-разбор`, `Отзыв доступа`, and
  `Жизненный цикл сессий`.

The governance read model is not patient delivery and not a patient-level
export. It deliberately omits patient names, raw identifiers, release
identifiers, visit identifiers, report identifiers, revoke reason text, raw
policy payloads, files, storage locations, signed links, tokens, and
doctor-only text. The operations readiness also forces
`temporaryCredentialsExposed`, `qrTokensExposed`, `sessionIdsExposed`, and
`revokeReasonExposed` to false. Its purpose is to make policy/session
lifecycle work visible without weakening the Stage 5N patient portal boundary.

## Production-safe lifecycle execution

Batch AD moves SD-MF-046/045 beyond readiness for one narrow operation:

- `POST /api/v1/patient-photo-protocol-release/governance/revoke-expired`;
- payload requires `confirm: true` and an optional bounded `limit` from 1 to
  200;
- backend updates only release rows already in `prepared` state with
  `expires_at <= now()` inside the caller clinic scope;
- each affected row is marked `revoked` with a fixed system reason code
  `expired_access_window`;
- the route returns only an aggregate operation result: affected count, active
  windows skipped, expiring windows remaining, missing-expiry count, limit, and
  boundary booleans.

The operation is a production lifecycle control, not a data export. It does
not expose patient rows, raw identifiers, revoke reason text, credentials,
QR tokens, session identifiers, storage paths, signed links, files, or
doctor-only text. Admin UI `/admin/governance` calls it only when a
self-hosted session is configured; demo mode stays local-only.

Batch AE adds the next narrow lifecycle operation:

- `POST /api/v1/patient-photo-protocol-release/governance/block-missing-expiry`;
- payload requires `confirm: true` and an optional bounded `limit` from 1 to
  200;
- backend updates only release rows already in `prepared` state with no
  `expires_at` inside the caller clinic scope;
- each affected row is marked `blocked` and receives stable blockers
  `expiry_required` and `session_lifecycle_review_required`;
- the route returns the same aggregate-only operation result with safe
  boundary flags.

This closes the unsafe "prepared forever" window without issuing files,
credentials, QR tokens, session identifiers, signed links, or patient-level
exports. Admin UI `/admin/governance` exposes it as `Заблокировать без срока`
inside `Жизненный цикл сессий`; demo mode remains local-only.

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

Audit-review reads record:

- action: `patient_photo_protocol.release_audit.read`;
- entity type: `patient_photo_protocol_release`;
- metadata: visit id, status, immutable-ledger flag, event counts, and protected
  payload exposure flag only.

Aggregate governance reads record:

- action: `patient_photo_protocol.release_governance.read`;
- entity type: `patient_photo_protocol_release_governance`;
- metadata: release totals, prepared/blocked/revoked counts, policy blocker
  counts, active access-window counts, and metadata-only boundary flags.

Production-safe lifecycle operations record:

- action: `patient_photo_protocol.release_governance.revoke_expired`;
- action: `patient_photo_protocol.release_governance.block_missing_expiry`;
- entity type: `patient_photo_protocol_release_governance_operation`;
- metadata: operation name, execution status, affected/skipped counts, and
  false exposure flags for patient rows, raw identifiers, revoke reason,
  temporary credentials, QR tokens, session identifiers, and delivery.

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

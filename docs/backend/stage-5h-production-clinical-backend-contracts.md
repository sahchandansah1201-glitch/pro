# Stage 5H — Production Clinical Backend Contracts

Stage 5H moves the remaining clinical workspace tabs from production
placeholders to self-hosted backend contracts.

## Scope

- `clinical_assessments` and `clinical_conclusions` are owned by the
  local PostgreSQL database.
- Existing `reports` receive a stable `visit_id` lookup contract.
- `lesion_comparison_decision_drafts` stores a doctor-owned metadata draft
  for a selected lesion image pair, with patient delivery disabled.
- Batch AW adds a production-safe longitudinal lesion ledger read contract
  assembled from visit, lesion, clinical asset, and assessment metadata.
- The browser reads and writes production clinical workspace data only
  through the self-hosted backend.
- Demo/dev mode remains unchanged and still uses mock clinical tabs.

## Backend Contracts

- `GET /api/v1/visits/{visitId}/assessment`
- `PATCH /api/v1/visits/{visitId}/assessment`
- `GET /api/v1/visits/{visitId}/conclusion`
- `PATCH /api/v1/visits/{visitId}/conclusion`
- `GET /api/v1/visits/{visitId}/report`
- `PATCH /api/v1/visits/{visitId}/report`
- `PATCH /api/v1/visits/{visitId}/lesion-comparison-draft`
- `GET /api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-history`

All routes require bearer auth and clinic-scoped RBAC. Reads use visit
read scope. Writes use visit write scope. Audit events are:

- `assessment.read`
- `assessment.update`
- `conclusion.read`
- `conclusion.update`
- `report.read`
- `report.update`
- `lesion_comparison_draft.upsert`
- `lesion_longitudinal_history.read`

## Lesion Comparison Draft Boundary

`PATCH /api/v1/visits/{visitId}/lesion-comparison-draft` accepts only
metadata needed for the doctor's selected image-pair decision:

- lesion ID, pair key, two image IDs, technical comparability, technical
  reasons, and selected action (`retake`, `excluded`, `report_limit`);
- no diagnosis, risk, prognosis, treatment, patient-facing report text, file
  path, signed URL, QR/session/credential material, model internals, or storage
  reference;
- response boundary flags are always `patientDeliveryAllowed: false` and
  `protectedFieldsExposed: false`;
- audit metadata intentionally omits `imageIds` and `pairKey`; it stores only
  visit ID, lesion ID, action, comparability, image count, reason count, and
  boundary flags.

The doctor lesion screen still saves a local draft first. When a self-hosted
backend session is configured, it also writes the same metadata draft through
the Stage 5H endpoint. When self-hosted is not configured, UI copy says the
backend audit was not sent.

## Batch AW Longitudinal Lesion Ledger Boundary

`GET /api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-history`
returns only doctor-side technical metadata for one lesion across visits:

- lesion identity, body zone/surface labels, visit counts, image counts,
  same-kind candidate pair counts, and assessment counts;
- visit timeline rows with status, timestamps, counts, and first/last capture
  time;
- candidate image pairs with image IDs, visit IDs, asset kind, technical status
  (`ready`, `warning`, `blocked`), and technical reasons such as missing capture
  time or non-image content type.

The endpoint does not return object bucket, object key, checksum, storage path,
signed URL, image bytes, QR/session/credential material, `physicianText`,
`patientSafeText`, diagnosis, risk, prognosis, treatment, or any patient
delivery artifact. Boundary flags are always:

- `patientDeliveryAllowed: false`
- `protectedFieldsExposed: false`
- `storagePathsExposed: false`
- `signedUrlsIssued: false`
- `rawImageBytesExposed: false`
- `doctorOnlyTextExposed: false`
- `clinicalConclusionGenerated: false`

Audit event `lesion_longitudinal_history.read` stores only patient ID, lesion
ID, aggregate counts, and boundary flags. It intentionally omits image IDs,
pair keys, protected asset references, doctor-only text, and any patient-facing
copy.

## Brainstorm Coverage

- `SD-MF-025` / lesion timeline and repeated observation: partially solved.
  Batch AW moves the longitudinal history from UI mock into a production
  metadata ledger. Remaining gate: protected image rendering and doctor-side
  visual verification still need a separate backend image proxy.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch AW
  provides same-kind candidate pairs and technical blockers. Remaining gate:
  richer capture-condition metadata and persisted pair review decisions beyond
  the existing draft contract.
- `SD-MF-028` / safe technical comparison: in work. Batch AW preserves the
  "not clinical conclusion" boundary and only emits technical metadata.
- `SD-MF-046` / photo protocol and protected photo access: in work. Batch AW
  does not deliver images to patients or doctors; it prepares the ledger needed
  before real protected-image rendering.

## Batch AX Protected Doctor Image Proxy Boundary

`GET /api/v1/patients/{patientId}/lesions/{lesionId}/images/{assetId}/render`
streams a protected lesion image through the self-hosted backend for doctor-side
longitudinal and comparison review.

The route is binary-only:

- authenticates staff through the existing Stage 5H bearer session;
- applies clinic scope through `visitReadScope`;
- verifies that the requested clinical asset belongs to the requested patient
  and lesion;
- allows only lesion-linked `overview_photo` and `dermoscopy` image assets;
- reads object bucket/key only inside `buildGetProtectedLesionImageAssetSql`;
- streams bytes from the backend object store with `cache-control: no-store`;
- never returns JSON containing object bucket/key, object path, signed link,
  token, QR/session/credential material, doctor-only report text, or
  patient-facing report text.

Audit action:

- `lesion_protected_image.proxy.download`

Audit metadata includes only patient ID, lesion ID, asset ID, kind, content
type, byte size, `deliveryMode: doctor_backend_proxy`, and boundary booleans:

- `patientDeliveryAllowed: false`
- `signedUrlsIssued: false`
- `storagePathsExposed: false`
- `rawImageBytesExposedInJson: false`

Frontend client:

- `downloadSelfHostedProtectedLesionImage`
- fetches with `credentials: "include"` and bearer auth;
- returns a `Blob` plus safe boundary flags;
- does not expose signed links or storage identifiers.

Doctor UI:

- the full-screen lesion comparison dialog shows `Защищённые превью врача`;
- `Подготовить защищённые превью` is enabled only for configured self-hosted
  sessions with production UUID patient/lesion/image IDs;
- successful downloads are rendered with local object URLs and revoked on pair
  changes/unmount;
- mock/non-production IDs keep the previous parameter-only placeholder.

### Batch AX Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch AX adds the
  protected rendering path needed to show real images from the production
  ledger. Remaining gate: richer capture-condition metadata and production
  visual QA on real assets.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch AX
  allows the doctor compare dialog to render real protected images through a
  backend proxy. Remaining gate: true annotation geometry and calibrated
  comparability metadata.
- `SD-MF-028` / dynamics reliability: partially solved. Batch AX keeps rendering
  separate from clinical conclusions; it does not create diagnosis, risk,
  prognosis, treatment, or automated dynamic assessment.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch AX is
  doctor-side only and does not enable patient delivery.

## Batch AY Protected Rendering QA Fixture

Batch AY makes the Batch AX protected rendering path testable on a
production-like UUID fixture without enabling patient delivery.

Fixture:

- `PROTECTED_RENDER_QA_IDS` in `src/lib/mock-data.ts`;
- fake patient code `DP-QA-PROXY`;
- fake lesion `QA protected proxy`;
- two lesion-linked UUID image IDs using `mock://images/protected-render-qa/*`
  as demo-only placeholders.

Doctor UI:

- the full-screen lesion comparison dialog includes `Готовность protected rendering`;
- readiness rows show:
  - `Self-hosted вход`;
  - `Production UUID`;
  - `Backend proxy`;
  - `Выдача пациенту`;
- `Подготовить защищённые превью` remains disabled when self-hosted auth or
  production UUID IDs are missing;
- with the QA UUID fixture and a configured self-hosted session, the button
  calls the Batch AX backend proxy client, receives `Blob` bytes, renders
  object URLs locally, and revokes them on unmount.

Safety boundary:

- still no patient delivery;
- no new backend route;
- no signed URL, object bucket/key, storage path, QR/session/credential,
  doctor-only report text, patient-facing report text, diagnosis, risk,
  prognosis, treatment, or automated dynamic conclusion in UI/client/OpenAPI;
- the fixture is deterministic demo data for QA only and is not a real patient
  or real image.

### Batch AY Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch AY adds a
  production-like UUID QA fixture so protected image rendering can be tested
  instead of staying only as disabled mock-state. Remaining gate: real
  production assets and richer capture-condition metadata.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch AY
  verifies protected A/B previews in the compare dialog via object URLs.
  Remaining gate: true annotation geometry and clinical-grade viewer QA.
- `SD-MF-028` / dynamics reliability: partially solved. Batch AY keeps the
  rendering path technical and does not add clinical conclusions.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch AY is
  doctor-side QA only and keeps patient delivery off.

## Batch AZ Capture-Condition QA Panel

Batch AZ adds a richer doctor-side capture-condition QA panel in the
full-screen lesion comparison dialog. It does not add backend routes or patient
delivery.

Doctor UI:

- the full-screen lesion comparison dialog includes `Контроль условий съёмки`;
- the panel shows a technical summary:
  - `Итог: условия технически повторяемы`; or
  - `Итог: нужна повторяемая съёмка`;
- checklist rows show:
  - `Тип снимка`;
  - `Источник`;
  - `Устройство`;
  - `Интервал`;
  - `Качество`;
  - `Замечания качества`;
- same-device/same-source/same-kind UUID QA images are marked technically
  repeatable;
- non-repeatable demo pairs show the exact technical blockers such as different
  image type, different source, different device, low minimum quality, and
  quality issues.

Safety boundary:

- no new backend route;
- no patient delivery;
- no signed URL, object bucket/key, storage path, QR/session/credential,
  doctor-only report text, patient-facing report text, diagnosis, risk,
  prognosis, treatment, or automated dynamic conclusion in UI/client/OpenAPI;
- visible copy says `Не является клинической оценкой динамики`.

### Batch AZ Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch AZ makes the
  selected pair's chronology and metadata constraints easier to inspect.
  Remaining gate: real production assets and richer capture-condition metadata
  from devices.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch AZ adds
  a concrete repeatability checklist for A/B comparison. Remaining gate: true
  annotation geometry and clinical-grade viewer QA.
- `SD-MF-028` / dynamics reliability: partially solved. Batch AZ separates
  technical repeatability from clinical dynamic assessment and keeps clinical
  conclusions out of the UI.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch AZ is
  doctor-side technical QA only and keeps patient delivery off.

## Batch BA Technical Geometry Markers

Batch BA adds a doctor-side technical geometry layer inside the full-screen
lesion comparison dialog. It is a local viewer QA feature only. It does not add
backend routes, persistence, calibrated measurement, or patient delivery.

Doctor UI:

- the full-screen lesion comparison tools include `Техническая геометрия`;
- doctors can place deterministic technical markers on `Снимок A` and
  `Снимок B`;
- marker coordinates are normalized as percentages of the current frame:
  - `A x48 y52`;
  - `B x52 y52`;
- the image panels render accessible markers such as
  `Технический маркер A · x48 y52`;
- controls expose:
  - `Поставить маркер A`;
  - `Поставить маркер B`;
  - `Очистить маркеры`;
- status text shows `Маркеры: 0/2` or `Маркеры: 2/2`;
- visible copy says `Координаты нормализованы: проценты кадра`,
  `Не является медицинским измерением`, and `Выдача пациенту: выключена`.

Safety boundary:

- no medical measurement;
- no calibrated metric scale;
- no diagnosis, risk, prognosis, treatment, or automated dynamic conclusion;
- no backend route, audit event, persistence, patient delivery, signed URL,
  object bucket/key, storage path, QR/session/credential, doctor-only report
  text, or patient-facing report text is added by Batch BA.

### Batch BA Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BA keeps the
  selected pair geometry visible within the existing compare chronology. The
  remaining gate is production capture metadata and real longitudinal assets.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BA adds
  normalized technical marker geometry for A/B review. The remaining gate is
  calibrated annotation geometry, production viewer QA, and backend-safe marker
  persistence if approved.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BA keeps geometry
  explicitly non-medical and prevents marker placement from becoming a clinical
  dynamic assessment.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BA
  remains doctor-side QA only and keeps patient delivery off.

## Batch BB Calibration Readiness QA

Batch BB adds a doctor-side calibration readiness layer inside the full-screen
lesion comparison dialog. It is a local viewer QA feature only. It does not add
backend routes, persistence, calibrated medical measurement, or patient
delivery.

Doctor UI:

- the full-screen lesion comparison tools include `Калибровка viewer`;
- the panel shows `Калибровка: не готова` until every technical gate is
  available;
- readiness rows show:
  - `Профиль устройства`;
  - `Размер кадра`;
  - `Масштабная шкала`;
  - `Миллиметры`;
- non-repeatable demo pairs show exact blockers such as `d-003 / без
  устройства`, `2048×2048 / 3000×2000`, and `шкала не обнаружена`;
- same-device UUID QA pairs show `одно устройство: d-003` and `один размер:
  2048×2048`, but remain non-calibrated because no scale marker exists;
- doctors can press `Зафиксировать ограничение калибровки`, which only sets
  local UI state `Ограничение калибровки зафиксировано локально`.

Safety boundary:

- `Измерения в мм недоступны`;
- `Не используйте маркеры как размер очага`;
- `Выдача пациенту: выключена`;
- no diagnosis, risk, prognosis, treatment, or automated dynamic conclusion;
- no backend route, audit event, persistence, patient delivery, signed URL,
  object bucket/key, storage path, QR/session/credential, doctor-only report
  text, or patient-facing report text is added by Batch BB.

### Batch BB Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BB makes the
  selected pair's calibration constraints visible next to chronology and
  capture-condition metadata. The remaining gate is production capture metadata
  and real longitudinal assets.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BB adds
  an explicit calibration readiness gate for A/B viewer review. The remaining
  gate is calibrated annotation geometry, production viewer QA, and backend-safe
  marker persistence if approved.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BB keeps
  millimeter measurements unavailable and prevents normalized markers from
  becoming lesion size or dynamic assessment.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BB
  remains doctor-side QA only and keeps patient delivery off.

## Batch BC Production Capture Metadata

Batch BC turns capture-condition readiness from mock-only UI state into a
production-safe Stage 5H metadata contract.

Backend contracts:

- `PATCH /api/v1/visits/{visitId}/assets/{assetId}/capture-metadata`
  stores asset-scoped capture metadata in `clinical_asset_capture_metadata`;
- `GET /api/v1/patients/{patientId}/lesions/{lesionId}/capture-metadata`
  returns a doctor-side lesion metadata ledger with asset counts, metadata
  counts, frame/device/quality/calibration readiness and technical reasons;
- repository SQL reads from `clinical_assets`,
  `clinical_asset_capture_metadata`, and optional `medical_devices` display
  metadata;
- audit actions:
  - `clinical_asset_capture_metadata.upsert`;
  - `lesion_capture_metadata.read`.

Safety boundary:

- no protected image bytes in JSON;
- no object bucket/key, checksum, storage path, signed URL, QR/session,
  credential material, physician text, patient-safe report text, diagnosis,
  risk, prognosis, treatment, or automated dynamic conclusion;
- `patientDeliveryAllowed`, `protectedFieldsExposed`,
  `storagePathsExposed`, `signedUrlsIssued`, `rawImageBytesExposed`,
  `doctorOnlyTextExposed`, and `clinicalConclusionGenerated` are forced false
  in the read model.

### Batch BC Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BC adds the
  production capture metadata source needed for real longitudinal timeline and
  pair-readiness decisions. Remaining gate: populate the table from production
  capture/device bridge events and validate with real assets.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BC
  gives the comparison workflow real device/frame/quality/scale metadata.
  Remaining gate: use this read model in production viewer QA and validate
  device calibration rules.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BC provides the
  metadata policy layer required before any longitudinal dynamic interpretation.
  Remaining gate: clinical validation and explicit analysis block/allow rules.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BC is
  doctor-side metadata only; patient delivery remains off.

## Batch BD Backend-Safe Marker And Calibration Persistence

Batch BD persists doctor-side viewer QA decisions for the selected image pair.
This is not a clinical measurement contract. It records technical marker
coordinates and calibration blockers so the team can audit the viewer workflow
without exposing protected files or delivering anything to a patient.

Backend contracts:

- `PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa`;
- table `lesion_comparison_viewer_qa_drafts`;
- payload fields:
  - `lesionId`;
  - `pairKey`;
  - exactly two `imageIds`;
  - normalized `technicalMarkers` with `target`, `xPercent`, `yPercent`;
  - `calibrationStatus`;
  - `calibrationReasons`;
  - `captureMetadataStatus`;
- audit action `lesion_comparison_viewer_qa.upsert`.

Frontend behavior:

- `Зафиксировать ограничение калибровки` still works locally when the
  self-hosted backend is not configured;
- when the self-hosted doctor session is configured, the same action sends
  metadata-only viewer QA to the Stage 5H backend;
- success copy says `Viewer QA сохранён в self-hosted backend. Выдача пациенту:
  выключена.`;
- technical marker coordinates remain normalized frame percentages.

Safety boundary:

- `medicalMeasurementAllowed=false`;
- `patientDeliveryAllowed=false`;
- `protectedFieldsExposed=false`;
- no storage path, signed URL, object bucket/key, QR/session/credential,
  doctor-only report text, patient-safe report text, diagnosis, risk,
  prognosis, treatment, or dynamic conclusion;
- audit metadata stores counts/statuses only and does not include `pairKey` or
  image IDs.

### Batch BD Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BD persists
  technical viewer QA state for selected chronology pairs. Remaining gate:
  production asset validation and timeline-level review surfaces.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BD
  closes backend-safe marker/calibration persistence for doctor-side compare
  workflow. Remaining gate: calibrated production viewer QA and approved
  measurement policy.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BD records
  calibration limits and marker metadata without allowing medical measurement.
  Remaining gate: production analysis gate that prevents dynamic conclusions
  unless capture metadata and calibration policy pass.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BD
  keeps patient delivery off; persisted QA can later support doctor-approved
  protocol evidence after privacy/security/copy gates.

## Batch BE Viewer QA Technical Review Workflow

Batch BE adds a production-safe technical review state over an existing
`lesion_comparison_viewer_qa_drafts` record. It lets a doctor record whether
the selected A/B pair is technically ready, needs recapture, or should not be
used for dynamic comparison. This is not a diagnosis, prognosis, measurement,
or patient-facing delivery event.

Backend contracts:

- migration `0061_stage5h_viewer_qa_review_workflow.sql`;
- `PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/review`;
- repository builder `buildReviewLesionComparisonViewerQaSql`;
- service normalizer `normalizeLesionComparisonViewerQaReviewPayload`;
- service method `reviewLesionComparisonViewerQa`;
- audit action `lesion_comparison_viewer_qa.review`.

Review statuses:

- `technical_ready`;
- `needs_recapture`;
- `not_suitable_for_comparison`.

Frontend behavior:

- full-screen comparison includes `Технический review viewer QA`;
- self-hosted flow first saves metadata-only viewer QA, then saves review
  metadata;
- demo/unconfigured flow remains local-only;
- success copy says `Viewer QA review сохранён в self-hosted backend. Выдача
  пациенту: выключена.`;
- screen copy says `Решение техническое: не диагноз, не динамика, не
  измерение.`

Safety boundary:

- review updates only an existing viewer QA draft;
- SQL re-checks clinic/patient/visit/lesion scope and confirms the two selected
  image assets are lesion-linked clinical images;
- audit metadata stores only `visitId`, `lesionId`, review status, reason
  count, and boundary flags;
- audit metadata does not include `pairKey` or image IDs;
- `medicalMeasurementAllowed=false`;
- `patientDeliveryAllowed=false`;
- `protectedFieldsExposed=false`;
- no raw image bytes, object bucket/key, storage path, signed URL, QR/session,
  credential material, doctor-only text, patient-safe report text, diagnosis,
  risk, prognosis, treatment, or automated dynamic conclusion.

### Batch BE Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BE adds
  review state for selected chronology pairs. Remaining gate: production asset
  validation and timeline-level review rollups.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BE
  adds persisted technical review decisions after marker/calibration QA.
  Remaining gate: calibrated production viewer QA, clinical-grade reviewer
  workflow and approved measurement policy.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BE records
  technical allow/block decisions without clinical dynamic conclusions.
  Remaining gate: production analysis gate that prevents dynamic conclusions
  unless capture metadata and calibration policy pass.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BE is
  doctor-side technical review only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BF Viewer QA Review Queue

Batch BF adds a visit-scoped read model for technical viewer QA review
decisions. It turns persisted review states into an operational queue for the
doctor workspace report tab without exposing pair keys, image IDs, protected
image storage fields, patient delivery material, or clinical dynamic
conclusions.

Backend contracts:

- `GET /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/review-queue`;
- repository builder `buildGetVisitLesionComparisonViewerQaReviewQueueSql`;
- service method `getVisitLesionComparisonViewerQaReviewQueue`;
- audit action `lesion_comparison_viewer_qa.review_queue.read`;
- OpenAPI schema `LesionComparisonViewerQaReviewQueue`.

Queue filters:

- `status=actionable` (default): `unreviewed`, `needs_recapture`,
  `not_suitable_for_comparison`;
- `status=all`;
- `status=unreviewed`;
- `status=technical_ready`;
- `status=needs_recapture`;
- `status=not_suitable_for_comparison`;
- `limit=1..100`, default `20`.

Frontend behavior:

- the production report workspace renders region `Очередь viewer QA`;
- copy states `Технический контур сравнения`;
- the queue shows summary counts and safe item labels such as `Нужен
  переснимок`, `Не использовать для динамики`, and `Проверить пару`;
- copy states `Выдача пациенту: выключена`;
- no `pairKey` or image IDs are rendered.

Safety boundary:

- audit metadata stores only visit-level summary counts and boundary flags;
- queue items are metadata-only: lesion label/body zone, technical review
  status, calibration status, reason labels, marker count and next action;
- `patientDeliveryAllowed=false`;
- `medicalMeasurementAllowed=false`;
- `protectedFieldsExposed=false`;
- `pairKeysExposed=false`;
- `imageIdsExposed=false`;
- `clinicalConclusionGenerated=false`;
- no raw image bytes, object bucket/key, storage path, signed URL, QR/session,
  credential material, doctor-only text, patient-safe report text, diagnosis,
  risk, prognosis, treatment, or automated dynamic conclusion.

### Batch BF Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BF adds a
  visit-level queue/read-model for technical review decisions over persisted
  image-pair QA. Remaining gate: production dataset validation and
  timeline-level QA rollout over real assets.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BF
  converts pair review decisions into an actionable doctor queue. Remaining
  gate: calibrated production viewer QA, clinical-grade reviewer workflow and
  approved measurement policy.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BF makes
  unsuitable/recapture decisions visible at the report workspace before any
  dynamic interpretation. Remaining gate: production analysis gate that
  prevents dynamic conclusions unless metadata, calibration and review pass.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BF is
  doctor-side metadata only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BG Longitudinal QA Gate

Batch BG adds a lesion-level production QA gate over the longitudinal timeline.
It aggregates capture metadata and viewer QA review decisions into one
metadata-only readiness read model before any dynamic interpretation is allowed.

Backend contracts:

- `GET /api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-qa`;
- repository builder `buildGetLesionLongitudinalQaSql`;
- service method `getLesionLongitudinalQa`;
- audit action `lesion_longitudinal_qa.read`;
- OpenAPI schema `LesionLongitudinalQa`.

Readiness fields:

- `status`: `blocked`, `needs_review`, or `technical_ready`;
- counts for visits, images, candidate pairs, reviewed pairs, technical-ready
  pairs, recapture decisions, excluded pairs, unreviewed pairs, missing capture
  metadata, calibration blockers and missing technical markers;
- `technicalRolloutReady`;
- `dynamicConclusionAllowed=false`.

Frontend behavior:

- `LesionDetailPage` renders region `Готовность продольного QA`;
- local demo data is collapsed into safe aggregate counts;
- self-hosted UUID data can be refreshed with `Обновить production QA`;
- safe copy states `Динамика заблокирована`, `Не создаёт вывод о динамике`,
  `Вывод о динамике: выключен`, and `Выдача пациенту: выключена`;
- no pair keys, image IDs, storage paths, signed URLs, QR/session/credential
  material, doctor-only text, patient-safe report text, diagnosis, risk,
  prognosis or treatment copy is rendered.

Safety boundary:

- audit metadata stores only lesion-level aggregate counts and boundary flags;
- `patientDeliveryAllowed=false`;
- `medicalMeasurementAllowed=false`;
- `protectedFieldsExposed=false`;
- `pairKeysExposed=false`;
- `imageIdsExposed=false`;
- `storagePathsExposed=false`;
- `signedUrlsIssued=false`;
- `rawImageBytesExposed=false`;
- `doctorOnlyTextExposed=false`;
- `clinicalConclusionGenerated=false`.

### Batch BG Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BG adds
  timeline-level QA rollout readiness over the lesion history. Remaining gate:
  production dataset validation and richer device-provided capture metadata.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BG
  aggregates persisted pair review decisions into lesion-level readiness and
  next actions. Remaining gate: calibrated production viewer QA and
  clinical-grade reviewer workflow.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BG blocks dynamic
  interpretation until metadata, review, calibration and marker gates pass.
  Remaining gate: approved production analysis policy; automated clinical
  dynamic conclusions remain disabled.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BG is
  doctor-side metadata only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BH Calibrated Reviewer Workflow

Batch BH adds a calibrated production viewer QA reviewer-workflow gate over the
existing metadata-only viewer QA draft and technical review. It is the first
clinical-grade workflow control for image-pair review, but it still does not
create a diagnosis, dynamic conclusion, medical measurement, or patient-facing
delivery state.

Backend contracts:

- migration `0062_stage5h_calibrated_viewer_reviewer_workflow.sql`;
- `PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/reviewer-workflow`;
- repository builder `buildReviewLesionComparisonViewerQaReviewerWorkflowSql`;
- service method `reviewLesionComparisonViewerQaReviewerWorkflow`;
- payload normalizer `normalizeLesionComparisonViewerQaReviewerWorkflowPayload`;
- audit action `lesion_comparison_viewer_qa.reviewer_workflow`;
- OpenAPI schema `LesionComparisonViewerQaReviewerWorkflow`.

Backend gates:

- an existing viewer QA draft must match the visit, patient, clinic, lesion,
  pair key and two scoped image IDs;
- `review_status = technical_ready`;
- `calibration_status = ready`;
- `capture_metadata_status = ready`;
- `technical_markers` must contain at least two normalized markers;
- if any gate fails, backend stores `reviewer_workflow_status =
  technical_gate_blocked`.

Frontend behavior:

- `LesionDetailPage` full-screen comparison adds region
  `Clinical-grade reviewer workflow`;
- the region shows gate rows for technical review, calibration, capture
  metadata and technical markers;
- standard user path: select two calibrated UUID fixture images, open
  full-screen comparison, place A/B markers, click `Технически готово`, then
  click `Reviewer workflow принят`;
- the UI copy states `Не диагноз, не динамика, не медицинское измерение` and
  `Выдача пациенту: выключена`.

Safety boundary:

- audit metadata excludes `pairKey` and image IDs;
- `medicalMeasurementAllowed=false`;
- `patientDeliveryAllowed=false`;
- `protectedFieldsExposed=false`;
- no object bucket/key, storage path, signed URL, QR/session/credential
  material, doctor-only text, patient-safe report text, diagnosis, risk,
  prognosis, treatment, automated dynamic conclusion, or protected-image
  delivery is exposed.

### Batch BH Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BH adds a
  calibrated fixture and reviewer workflow over image-pair QA. Remaining gate:
  production dataset validation and rollout across real longitudinal assets.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BH
  closes the first clinical-grade reviewer workflow gate after technical
  review, calibration, metadata and marker readiness. Remaining gate:
  production reviewer roles, reviewer assignment/escalation and calibrated
  viewer QA validation on real assets.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BH blocks
  reviewer acceptance unless all technical gates pass; dynamic conclusions and
  medical measurements remain disabled. Remaining gate: approved production
  analysis policy and clinical-grade validation before any dynamic output.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BH is
  doctor-side metadata only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BJ Visit Longitudinal Dataset Validation

Batch BJ adds visit-scoped production dataset validation for timeline-level QA
rollout. It aggregates lesion-level capture metadata, viewer QA review,
calibration and reviewer-workflow readiness for the lesions in a visit. It is a
technical rollout gate only: it does not create a diagnosis, medical
measurement, clinical dynamic conclusion, or patient delivery state.

Backend contracts:

- `GET /api/v1/visits/{visitId}/longitudinal-dataset-validation`;
- repository builder `buildGetVisitLongitudinalDatasetValidationSql`;
- repository method `getVisitLongitudinalDatasetValidation`;
- service method `getVisitLongitudinalDatasetValidation`;
- audit action `visit_longitudinal_dataset_validation.read`;
- OpenAPI schema `VisitLongitudinalDatasetValidation`.

Returned shape:

- `readiness`: aggregate status, lesion count, timeline candidates, ready /
  review / blocked timeline counts, image count, pair count, technical-ready
  pair count, missing metadata count, calibration blockers, missing marker count,
  and reviewer-workflow-ready count;
- `items`: safe lesion rows with label, body zone/surface, aggregate counts,
  status and next action;
- `blockers`: safe grouped blockers with counts;
- `nextActions`: safe action enum;
- `boundaries`: all delivery, measurement, protected-field, pair-key,
  image-ID, storage-path, signed-URL, raw-image, doctor-text and clinical
  conclusion flags forced to `false`.

Safety boundary:

- no `pairKey` or image IDs in API/UI/audit metadata;
- no object bucket/key, storage path, signed URL, QR/session/credential
  material, doctor-only report text, patient-safe report text, raw image bytes,
  diagnosis, risk, prognosis, treatment or dynamic conclusion;
- `patientDeliveryAllowed=false`;
- `medicalMeasurementAllowed=false`;
- `clinicalConclusionGenerated=false`.

Frontend behavior:

- `VisitWorkspacePage` report tab adds region `Готовность timeline QA`;
- the block shows aggregate counters, top blockers and per-lesion technical
  next actions;
- visible copy states `Production dataset validation`, `не создаёт вывод о
  динамике`, `Динамический вывод: выключен` and `выдача пациенту выключена`.

### Batch BJ Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BJ adds
  visit-level validation over lesion timelines so rollout readiness is visible
  before clinicians rely on chronology. Remaining gate: production dataset
  validation on real assets and richer device-provided capture metadata.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BJ
  aggregates pair-review, calibration and marker gates across visit lesions.
  Remaining gate: clinical-grade reviewer workflow operations on real
  production assets and approved measurement policy.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BJ keeps dynamic
  interpretation blocked unless technical dataset gates are ready; no dynamic
  conclusion is generated. Remaining gate: approved production analysis policy.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BJ is
  doctor-side metadata only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BK Device-Provided Capture Metadata Evidence

Batch BK adds production device-provided capture metadata evidence to the Stage
5H capture metadata ledger. It closes the gap left by Batch BJ: timeline QA no
longer treats generic capture metadata as enough when device/camera evidence is
missing or stale. This is still a technical gate only. It does not create a
diagnosis, medical measurement, clinical dynamic conclusion, or patient
delivery.

Backend contracts:

- migration `0063_stage5h_capture_device_evidence.sql`;
- `clinical_asset_capture_metadata` adds `device_capture_profile`,
  `lighting_profile`, `focus_profile`, `distance_profile`,
  `device_calibration_status`, `device_calibration_checked_at` and
  `device_evidence_status`;
- protected-key CHECK blocks serials, raw device identifiers, MAC/IP/Bluetooth,
  Wi-Fi and credential-like fields in `metadata_json`;
- `PATCH /api/v1/visits/{visitId}/assets/{assetId}/capture-metadata` accepts
  the new metadata fields and derives device evidence readiness server-side;
- `GET /api/v1/patients/{patientId}/lesions/{lesionId}/capture-metadata`
  returns nested `deviceEvidence`;
- lesion and visit rollout gates add blocker `device_metadata_not_ready` and
  next action `complete_device_metadata`;
- audit stays aggregate-only and stores safe statuses/counts only.

Returned shape additions:

- `deviceEvidence`: capture profile, lighting profile, focus profile, distance
  profile, calibration status, optional calibration checked timestamp and
  readiness status;
- capture metadata summary includes `deviceEvidenceReadyCount` and
  `deviceEvidenceReviewCount`;
- longitudinal QA/readiness includes `deviceEvidenceNotReadyCount`;
- visit dataset validation includes per-lesion and aggregate
  `deviceEvidenceNotReadyCount`.

Safety boundary:

- no serial number, raw device ID, MAC/IP/Bluetooth/Wi-Fi identifier, device
  credential, object bucket/key, storage path, signed URL, QR/session/token,
  doctor-only text, patient-safe report text, diagnosis, risk, prognosis,
  treatment, measurement, or dynamic conclusion is exposed;
- `patientDeliveryAllowed=false`;
- `medicalMeasurementAllowed=false`;
- `clinicalConclusionGenerated=false`.

Frontend behavior:

- `VisitWorkspacePage` report tab keeps region `Готовность timeline QA`;
- the block now exposes device metadata readiness as a separate aggregate and
  per-lesion count;
- next action label `Дозаполнить device metadata` appears when the backend
  returns `complete_device_metadata`;
- visible copy remains technical: `Production dataset validation`, `не создаёт
  вывод о динамике`, `Динамический вывод: выключен`, and patient delivery stays
  off.

### Batch BK Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BK adds richer
  device-provided capture metadata evidence to chronology/timeline readiness.
  Remaining gate: production validation on real assets and device bridge
  integration quality checks.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BK
  blocks pair/timeline rollout when capture device evidence is missing, stale,
  or incomplete. Remaining gate: calibrated production viewer QA and reviewer
  operations on real assets.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BK keeps dynamic
  interpretation blocked when device/capture evidence is incomplete; no
  clinical dynamic conclusion is generated. Remaining gate: approved production
  analysis policy and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BK is
  doctor-side metadata only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BL Device Bridge Quality Checks

Batch BL adds a production-safe Device Bridge quality gate to the existing
Stage 5H longitudinal QA and dataset validation flow. This is not a new patient
delivery feature and does not create clinical conclusions. It separates two
operational facts:

- `deviceEvidence`: whether a capture has complete device-provided metadata;
- `deviceBridgeQuality`: whether a `device_bridge` capture has a registered,
  connected device, an online bridge, an online worker, and a fresh heartbeat.

Contract additions:

- `GET /api/v1/patients/{patientId}/lesions/{lesionId}/capture-metadata`
  returns nested `deviceBridgeQuality.status` and safe reason codes;
- lesion longitudinal QA adds `deviceBridgeQualityNotReadyCount`, blocker
  `device_bridge_quality_not_ready`, and next action `check_device_bridge`;
- visit longitudinal dataset validation adds aggregate and per-lesion
  `deviceBridgeQualityNotReadyCount`;
- OpenAPI and the frontend DTO force the same metadata-only boundary.

Safety boundary:

- no device serials, raw device IDs, MAC/IP/Bluetooth/Wi-Fi identifiers,
  bridge hostnames, worker payloads, credentials, object bucket/key, storage
  path, signed URL, QR/session/token, doctor-only text, patient-safe report
  text, diagnosis, risk, prognosis, treatment, measurement, or dynamic
  conclusion is exposed;
- audit metadata stores only aggregate counts and boundary flags;
- `patientDeliveryAllowed=false`;
- `medicalMeasurementAllowed=false`;
- `clinicalConclusionGenerated=false`.

Frontend behavior:

- `VisitWorkspacePage` report tab shows a separate `Bridge` counter in
  `Готовность timeline QA`;
- per-lesion rows show `bridge: {count}`;
- next action label `Проверить Device Bridge` appears when the backend returns
  `check_device_bridge`;
- `LesionDetailPage` shows the same production blocker/action in the lesion
  `Готовность продольного QA` section.

### Batch BL Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BL closes the
  device bridge integration quality check that was still open after Batch BK.
  Remaining gate: validation on real production assets and richer
  device-provided metadata.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BL
  prevents image-pair/timeline rollout when the Device Bridge channel or worker
  heartbeat is not production-ready. Remaining gate: clinical-grade reviewer
  operations on real assets.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BL keeps dynamic
  interpretation blocked when capture transport evidence is incomplete or
  stale; no clinical dynamic conclusion is generated. Remaining gate: approved
  production analysis policy and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BL is
  doctor-side metadata only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BM Production Asset Readiness Gate

Batch BM adds a production-safe protected asset readiness gate to the existing
Stage 5H longitudinal QA and dataset validation flow. This does not stream
image bytes to the patient and does not create signed URLs. The backend may
internally verify that a clinical asset has protected object-store presence,
positive byte size, and capture time, but API/UI/audit responses expose only
derived status, reason codes, and aggregate counts.

Contract additions:

- `GET /api/v1/patients/{patientId}/lesions/{lesionId}/capture-metadata`
  returns nested `productionAssetReadiness.status/reasons`;
- lesion longitudinal QA adds `productionAssetNotReadyCount`, blocker
  `production_asset_not_ready`, and next action `verify_production_asset`;
- visit longitudinal dataset validation adds aggregate and per-lesion
  `productionAssetNotReadyCount`;
- OpenAPI and frontend DTOs expose only metadata-only readiness fields.

Safety boundary:

- no object bucket/key, storage path, checksum, signed URL, raw image bytes,
  QR/session/token, doctor-only text, patient-safe report text, diagnosis,
  risk, prognosis, treatment, measurement, or dynamic conclusion is exposed in
  API/UI/audit;
- audit metadata stores only aggregate counts and boundary flags;
- `patientDeliveryAllowed=false`;
- `medicalMeasurementAllowed=false`;
- `clinicalConclusionGenerated=false`.

Frontend behavior:

- `VisitWorkspacePage` report tab shows a separate `Assets` counter in
  `Готовность timeline QA`;
- per-lesion rows show `assets: {count}`;
- next action label `Проверить production assets` appears when the backend
  returns `verify_production_asset`;
- `LesionDetailPage` shows the same production blocker/action in the lesion
  `Готовность продольного QA` section.

### Batch BM Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BM adds a real
  production asset readiness gate to chronology/timeline validation. Remaining
  gate: validate the gate on real clinic assets and extend device-provided
  metadata where needed.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BM
  prevents image-pair/timeline rollout when protected production assets are not
  backend-proxy-ready. Remaining gate: clinical-grade reviewer operations on
  real assets and approved measurement policy.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BM keeps dynamic
  interpretation blocked when production asset readiness is incomplete; no
  clinical dynamic conclusion is generated. Remaining gate: approved production
  analysis policy and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BM is
  doctor-side metadata-only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BN Capture Protocol Metadata Gate

Batch BN adds a metadata-only capture protocol evidence gate on top of the
existing production device evidence, Device Bridge quality, and production
asset readiness checks. The goal is to make timeline QA stricter before any
dynamic interpretation: a capture can be present and proxy-ready, but still
remain blocked if its protocol version, lens profile, polarization mode, color
reference status, or device clock sync status is missing or needs review.

Migration:

- `0064_stage5h_capture_protocol_evidence.sql` extends
  `clinical_asset_capture_metadata` with `capture_protocol_version`,
  `lens_profile`, `polarization_mode`, `color_reference_status`,
  `device_clock_sync_status`, and `capture_protocol_status`;
- migration CHECK `clinical_asset_capture_metadata_no_protocol_sensitive_keys`
  blocks raw EXIF, GPS/location payloads, operator/patient names, firmware or
  device serials, network identifiers, and credentials in `metadata_json`.

Contract additions:

- `GET /api/v1/patients/{patientId}/lesions/{lesionId}/capture-metadata`
  returns nested `captureProtocol` with safe enum/status fields only;
- lesion capture metadata summary adds `captureProtocolReadyCount` and
  `captureProtocolReviewCount`;
- lesion longitudinal QA adds `captureProtocolNotReadyCount`, blocker
  `capture_protocol_not_ready`, and next action `complete_capture_protocol`;
- visit longitudinal dataset validation adds aggregate and per-lesion
  `captureProtocolNotReadyCount`;
- OpenAPI and frontend DTOs expose only safe protocol status metadata.

Safety boundary:

- no raw EXIF, GPS/location payloads, operator names, patient names, firmware
  serials, device serials, MAC/IP/Bluetooth/Wi-Fi identifiers, credentials,
  object bucket/key, storage path, checksum, signed URL, raw image bytes,
  QR/session/token, doctor-only text, patient-safe report text, diagnosis,
  risk, prognosis, treatment, measurement, or dynamic conclusion is exposed in
  API/UI/audit;
- audit metadata stores only aggregate counts, protocol status, and boundary
  flags;
- `patientDeliveryAllowed=false`;
- `medicalMeasurementAllowed=false`;
- `clinicalConclusionGenerated=false`.

Frontend behavior:

- `VisitWorkspacePage` report tab shows a separate `Protocol` counter in
  `Готовность timeline QA`;
- per-lesion rows show `protocol: {count}`;
- next action label `Дозаполнить протокол съёмки` appears when the backend
  returns `complete_capture_protocol`;
- `LesionDetailPage` shows the same protocol blocker/action in the lesion
  `Готовность продольного QA` section.

### Batch BN Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BN adds richer
  production capture protocol metadata to chronology/timeline readiness.
  Remaining gate: validate on real clinic assets and populate protocol fields
  from actual devices/import pipelines.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BN
  blocks pair/timeline rollout when capture protocol evidence is missing or
  stale, even if assets and device bridge checks are present. Remaining gate:
  clinical-grade reviewer operations on real assets and approved measurement
  policy.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BN keeps dynamic
  interpretation blocked until capture protocol evidence is ready; no clinical
  dynamic conclusion is generated. Remaining gate: approved production analysis
  policy and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BN is
  doctor-side metadata-only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BO Measurement Policy Gate

Batch BO adds an approved-measurement-policy gate before clinical-grade reviewer
operations. The name is intentionally narrow: this policy approves only the
technical reviewer workflow boundary. It does not enable millimeter
measurements, lesion size calculations, clinical dynamic conclusions, patient
delivery, or report release.

Migration:

- `0065_stage5h_measurement_policy_gate.sql` extends
  `lesion_comparison_viewer_qa_drafts` with `measurement_policy_status`,
  `measurement_policy_reasons`, `measurement_policy_reviewed_by_user_id`, and
  `measurement_policy_reviewed_at`;
- allowed statuses are `not_approved`, `review_required`, and
  `approved_for_technical_review`;
- CHECK `lesion_comparison_viewer_qa_measurement_policy_no_protected_keys`
  blocks measurement values, diagnosis/risk/prognosis/treatment claims,
  protected image/storage fields, QR/session/token fields, and doctor/patient
  report text in policy metadata.

Contract additions:

- `PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/measurement-policy`
  persists the metadata-only policy decision over an existing viewer QA pair;
- service audit action `lesion_comparison_measurement_policy.review` stores
  only visit/lesion/status/reason counts and boundary flags;
- `reviewerWorkflow.gate.measurementPolicyApproved` is required before
  reviewer workflow can become ready;
- lesion longitudinal QA and visit longitudinal dataset validation add
  `measurementPolicyNotReadyCount`, blocker `measurement_policy_required`, and
  next action `approve_measurement_policy`;
- review queue adds `measurementPolicyRequired` and item-level
  `measurementPolicy` status without pair keys or image IDs.

Safety boundary:

- `medicalMeasurementAllowed=false` remains forced in database writes,
  repository normalizers, service responses, frontend DTOs, and UI copy;
- `patientDeliveryAllowed=false` and `protectedFieldsExposed=false` remain
  forced;
- no raw image bytes, object bucket/key, storage path, checksum, signed URL,
  QR/session/credential material, pair keys or image IDs in rollups/audit,
  diagnosis/risk/prognosis/treatment, clinical dynamic conclusion, doctor-only
  text, or patient-safe report text is exposed.

Frontend behavior:

- `LesionDetailPage` full-screen comparison shows region `Политика измерений`
  after `Технический review viewer QA` and before
  `Clinical-grade reviewer workflow`;
- the policy region states `Измерения остаются выключены` and
  `Выдача пациенту: выключена`;
- reviewer workflow stays disabled until technical review, capture metadata,
  calibration, markers, and measurement policy are ready;
- `VisitWorkspacePage` report workspace shows `Policy` counter, per-lesion
  `policy: {count}`, and action label `Утвердить policy измерений`.

### Batch BO Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BO adds the
  approved policy gate to timeline readiness, so chronology rollout is blocked
  until reviewer operations have a safe technical policy. Remaining gate:
  validate policy workflow on real clinic assets and reviewer roles.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BO
  closes the approved measurement policy prerequisite for clinical-grade
  reviewer workflow while keeping actual measurements disabled. Remaining gate:
  full clinical-grade reviewer operations on production assets and role-based
  reviewer assignment.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BO prevents
  dynamic interpretation from advancing when the policy gate is missing; no
  clinical dynamic conclusion is generated. Remaining gate: approved production
  analysis policy and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BO is
  doctor-side metadata-only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BP Reviewer Assignment And Second Review

Batch BP adds reviewer assignment and second-review gates after the Batch BO
measurement policy gate and before clinical-grade reviewer workflow acceptance.
This is an operational safety workflow, not a medical conclusion. It stores
assignment state and second-review state as metadata only.

Migration:

- `0066_stage5h_reviewer_assignment_second_review.sql` extends
  `lesion_comparison_viewer_qa_drafts` with `reviewer_assignment_status`,
  `reviewer_assignment_reasons`, `assigned_reviewer_user_id`,
  `reviewer_assigned_by_user_id`, `reviewer_assigned_at`,
  `second_review_status`, `second_review_reasons`,
  `second_reviewer_user_id`, `second_reviewed_by_user_id`, and
  `second_reviewed_at`;
- allowed assignment statuses are `unassigned`, `assigned`,
  `second_review_required`, `second_review_assigned`,
  `second_review_completed`, and `assignment_blocked`;
- allowed second-review statuses are `not_required`, `required`, `assigned`,
  `completed`, and `blocked`;
- CHECK `lesion_comparison_viewer_qa_reviewer_assignment_no_protected_keys`
  blocks reviewer names/emails, protected image/storage fields,
  QR/session/token fields, doctor/patient report text, diagnosis/risk/
  prognosis/treatment claims, and dynamic clinical conclusion keys.

Contract additions:

- `PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/reviewer-assignment`
  persists the metadata-only reviewer assignment / second-review decision;
- request fields `assignedReviewerUserId` and `secondReviewerUserId` are
  backend write-only values. Responses, UI, and audit expose only status,
  reason counts, timestamps, and boundary booleans;
- service audit action `lesion_comparison_reviewer_assignment.review` stores
  only visit/lesion/status/reason counts, reviewer-present booleans, and
  forced-false boundary flags;
- `reviewerWorkflow.gate.reviewerAssignmentReady` and
  `reviewerWorkflow.gate.secondReviewReady` are required before reviewer
  workflow can be accepted;
- review queue adds `reviewerAssignmentRequired`,
  `secondReviewRequired`, item-level `reviewerAssignment` and `secondReview`,
  and next actions `assign_reviewer` / `complete_second_review`;
- lesion longitudinal QA and visit longitudinal dataset validation add
  `reviewerAssignmentNotReadyCount`, `secondReviewNotReadyCount`, blockers
  `reviewer_assignment_required` / `second_review_required`, and corresponding
  next actions.

Safety boundary:

- `reviewerIdentityExposed=false`, `medicalMeasurementAllowed=false`,
  `patientDeliveryAllowed=false`, and `protectedFieldsExposed=false` remain
  forced across DB metadata, repository normalizers, service responses,
  frontend DTOs, and UI copy;
- no reviewer names/emails, pair keys, image IDs in rollups/audit, raw image
  bytes, object bucket/key, storage path, checksum, signed URL,
  QR/session/credential material, diagnosis/risk/prognosis/treatment,
  clinical dynamic conclusion, doctor-only text, or patient-safe report text is
  exposed.

Frontend behavior:

- `LesionDetailPage` full-screen comparison now shows region
  `Назначение reviewer` after `Политика измерений` and before
  `Clinical-grade reviewer workflow`;
- actions `Назначить reviewer`, `Потребовать second review`, and
  `Second review завершён` save locally in demo mode and use the self-hosted
  backend when configured;
- the UI states that UUID reviewer values are backend write-only and that names
  and contacts are hidden;
- final reviewer acceptance remains disabled until technical review, capture
  metadata, calibration, markers, measurement policy, reviewer assignment, and
  second-review requirements are all satisfied;
- `VisitWorkspacePage` shows compact `Assign` and `Second` counters, per-lesion
  `assignment:` / `second:` fragments, and action labels `Назначить reviewer`
  and `Закрыть second review`.

### Batch BP Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BP adds
  reviewer assignment and second-review readiness to lesion/timeline rollout,
  so chronology does not advance from technical QA without an assigned reviewer
  workflow. Remaining gate: validation on real production assets and reviewer
  operations data.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BP
  closes reviewer assignment and second-review prerequisites for
  clinical-grade workflow acceptance. Remaining gate: production analysis
  policy and clinical validation beyond technical metadata.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BP blocks
  dynamic interpretation when reviewer assignment or second review is missing;
  no clinical dynamic conclusion is generated. Remaining gate: approved
  production analysis policy.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BP is
  doctor-side metadata-only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BQ Production Analysis Policy Gate

Batch BQ adds a production analysis policy gate after measurement policy,
reviewer assignment, and second-review readiness. This gate authorizes only the
production-readiness workflow boundary. It does not generate a clinical dynamic
conclusion, diagnosis, prognosis, treatment recommendation, medical
measurement, or patient delivery payload.

Migration:

- `0067_stage5h_production_analysis_policy_gate.sql` extends
  `lesion_comparison_viewer_qa_drafts` with
  `production_analysis_policy_status`,
  `production_analysis_policy_reasons`,
  `production_analysis_policy_reviewed_by_user_id`, and
  `production_analysis_policy_reviewed_at`;
- allowed statuses are `not_approved`, `review_required`, and
  `approved_for_production_analysis`;
- CHECK `lesion_comparison_viewer_qa_production_analysis_policy_no_protected_keys`
  blocks diagnosis/risk/prognosis/treatment keys, dynamic clinical conclusion
  keys such as `dynamicConclusion` / `clinicalDynamicConclusion`, measurement
  value keys, patient delivery payloads, protected image/storage fields,
  QR/session/token fields, and doctor/patient report text.

Contract additions:

- `PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/production-analysis-policy`
  persists a metadata-only production analysis policy decision;
- service audit action `lesion_comparison_production_analysis_policy.review`
  stores visit/lesion/status/reason counts and forced-false boundaries only;
- `reviewerWorkflow.gate.productionAnalysisPolicyApproved` is required before
  reviewer workflow acceptance;
- review queue adds `productionAnalysisPolicyRequired`, item-level
  `productionAnalysisPolicy`, and next action
  `approve_production_analysis_policy`;
- lesion longitudinal QA and visit longitudinal dataset validation add
  `productionAnalysisPolicyNotReadyCount`, blocker
  `production_analysis_policy_required`, and next action
  `approve_production_analysis_policy`.

Safety boundary:

- `medicalMeasurementAllowed=false`, `patientDeliveryAllowed=false`,
  `protectedFieldsExposed=false`, and `clinicalOutputGenerated=false` remain
  forced by repository normalizers, service responses, frontend DTOs, and UI
  copy;
- no pair keys, image IDs in rollups/audit, reviewer identities in patient/UI
  copy, raw image bytes, object bucket/key, storage path, checksum, signed URL,
  QR/session/credential material, diagnosis/risk/prognosis/treatment,
  clinical dynamic conclusion, doctor-only text, or patient-safe report text is
  exposed.

Frontend behavior:

- `LesionDetailPage` full-screen comparison now shows region
  `Production analysis policy` after `Назначение reviewer` and before
  `Clinical-grade reviewer workflow`;
- actions `Утвердить analysis policy` and `Нужен разбор analysis policy` save
  locally in demo mode and use the self-hosted backend when configured;
- the policy approval action is gated by approved technical measurement policy,
  reviewer assignment, and second review;
- `VisitWorkspacePage` shows compact `Analysis` counters, per-lesion
  `analysis:` fragments, and action label `Утвердить analysis policy`.

### Batch BQ Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BQ adds the
  production analysis policy gate to lesion/timeline readiness, so chronology
  rollout does not advance into production-analysis workflow without an
  explicit policy approval. Remaining gate: validation on real production
  datasets and clinical operations rollout.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BQ
  closes the production analysis policy prerequisite after technical policy,
  reviewer assignment, and second review. Remaining gate: production reviewer
  operations validation and approved analysis procedure.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BQ keeps dynamic
  interpretation blocked until production analysis policy is approved; clinical
  dynamic conclusion remains disabled. Remaining gate: approved production
  analysis policy governance and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in progress. Batch BQ is
  doctor-side metadata-only; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BR Timeline Rollout Governance

Пункт плана: `production dataset validation / timeline-level QA rollout ->
timeline rollout governance`.

Batch BR adds a production-safe approval/review ledger for visit-level
longitudinal timeline rollout. It sits on top of
`GET /api/v1/visits/{visitId}/longitudinal-dataset-validation` and stores only
aggregate governance metadata. It does not approve patient delivery, does not
generate a clinical dynamic conclusion, and does not expose pair keys, image
IDs, reviewer identities, storage fields, signed URLs, QR/session/credential
material, diagnosis/risk/prognosis/treatment, measurement values, doctor-only
text, or patient report text.

Migration:

- `0068_stage5h_timeline_rollout_governance.sql` creates
  `visit_longitudinal_timeline_rollout_reviews`;
- allowed statuses are `not_approved`, `review_required`, and
  `approved_for_clinical_operations`;
- stored counters are visit-level aggregates only:
  `lesion_count`, `ready_timeline_count`, `needs_review_timeline_count`,
  `blocked_timeline_count`, `candidate_pair_count`, and
  `reviewer_workflow_ready_count`;
- CHECK `visit_longitudinal_timeline_rollout_reviews_metadata_no_protected_keys`
  blocks pair/image keys, storage/object/signed URL keys, reviewer identity
  keys, dynamic/clinical conclusion keys, diagnosis/risk/prognosis/treatment
  keys, measurement value keys, QR/session/token keys, and doctor/patient text
  keys;
- boundary flags remain forced false:
  `patient_delivery_allowed`, `medical_measurement_allowed`,
  `protected_fields_exposed`, and `clinical_output_generated`.

Contract additions:

- `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout` persists a
  metadata-only timeline rollout governance review;
- `buildReviewVisitLongitudinalTimelineRolloutSql` scopes the write to the
  visit, patient, clinic, and caller clinic scope, then upserts one review row
  per visit;
- service method `reviewVisitLongitudinalTimelineRollout` uses the current
  longitudinal dataset validation snapshot and downgrades requested
  `approved_for_clinical_operations` to `review_required` when validation is
  not `ready_for_rollout`;
- service audit action `visit_longitudinal_timeline_rollout.review` stores
  aggregate counters, status, reason count, and forced-false boundary flags
  only;
- `VisitLongitudinalDatasetValidation` now includes `timelineRollout` so the
  report workspace can show the latest governance state beside readiness.

Frontend behavior:

- `VisitWorkspacePage` report tab adds region `Контур timeline rollout` inside
  `Готовность timeline QA`;
- visible copy states: `Rollout сохраняет только aggregate metadata`,
  `Clinical dynamic conclusion: выключен`, and `Выдача пациенту: выключена`;
- `Утвердить timeline rollout` is disabled unless readiness is
  `ready_for_rollout`;
- `Нужен разбор rollout` remains available and writes a metadata-only review;
- after saving, the workspace reloads the self-hosted read model and shows
  `Timeline rollout governance сохранён`.

Safety boundary:

- `medicalMeasurementAllowed=false`, `patientDeliveryAllowed=false`,
  `protectedFieldsExposed=false`, and `clinicalOutputGenerated=false` are
  forced in repository, service, OpenAPI schema, frontend DTO normalizer, and
  UI copy;
- no patient delivery or clinical dynamic conclusion is produced by this
  batch;
- no pair keys, image IDs, object bucket/key, storage path, checksum, signed
  URL, QR/session/credential, reviewer identity, doctor-only text,
  patient-safe report text, diagnosis, risk, prognosis, treatment, or
  measurement values are returned in rollout read/write responses or audit
  metadata.

### Batch BR Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BR adds a
  visit-level rollout governance decision over the timeline validation result.
  Remaining gate: validation on real clinical production datasets and rollout
  SOP.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BR
  prevents clinical operations rollout until pair review, policy, assignment,
  and second-review counters are ready at timeline level. Remaining gate:
  production reviewer operations validation.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BR still keeps
  `Clinical dynamic conclusion: выключен`; readiness approval is governance
  metadata, not a medical conclusion. Remaining gate: approved production
  analysis procedure and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in work. Batch BR is
  doctor-side metadata-only timeline governance; patient delivery remains off
  until privacy/security/retention/session/approved-copy gates are explicitly
  closed.

## Batch BS Timeline Rollout SOP

Пункт плана: `production dataset validation / timeline-level QA rollout ->
timeline rollout SOP`.

Batch BS adds a production-safe SOP receipt on top of Batch BR timeline rollout
governance. The SOP stores only operational checklist metadata for whether the
clinic can start timeline QA rollout work. It does not approve patient delivery,
does not enable medical measurements, does not generate clinical dynamic
conclusions, and does not expose pair keys, image IDs, reviewer identities,
storage fields, signed URLs, QR/session/credential material, diagnosis/risk/
prognosis/treatment, doctor-only text, or patient report text.

Migration:

- `0069_stage5h_timeline_rollout_sop.sql` creates
  `visit_longitudinal_timeline_rollout_sop_reviews`;
- allowed SOP statuses are `not_started`, `in_review`, and
  `ready_for_operational_rollout`;
- checklist fields are `dataset_validation_status`,
  `reviewer_operations_status`, `rollback_plan_status`,
  `monitoring_plan_status`, `rollout_window_status`, and `owner_ack_status`,
  each with `missing`, `needs_review`, or `ready`;
- stored counters are visit-level aggregates only:
  `lesion_count`, `ready_timeline_count`, `blocked_timeline_count`,
  `candidate_pair_count`, and `reviewer_workflow_ready_count`;
- CHECK `visit_longitudinal_timeline_rollout_sop_metadata_no_protected_keys`
  blocks pair/image keys, storage/object/signed URL keys, reviewer identity
  keys, dynamic/clinical conclusion keys, diagnosis/risk/prognosis/treatment
  keys, measurement value keys, QR/session/token keys, and doctor/patient text
  keys;
- boundary flags remain forced false:
  `patient_delivery_allowed`, `medical_measurement_allowed`,
  `protected_fields_exposed`, and `clinical_output_generated`.

Contract additions:

- `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/sop` persists
  a metadata-only SOP review receipt;
- `buildReviewVisitLongitudinalTimelineRolloutSopSql` scopes the write to the
  visit, patient, clinic, and caller clinic scope, then upserts one SOP row per
  visit;
- `VisitLongitudinalDatasetValidation` now includes `timelineRolloutSop` so the
  report workspace can show the latest SOP state beside dataset readiness and
  Batch BR rollout governance;
- service method `reviewVisitLongitudinalTimelineRolloutSop` uses the current
  dataset validation snapshot and latest rollout governance state. Requested
  `ready_for_operational_rollout` is downgraded to `in_review` unless
  validation is `ready_for_rollout`, rollout governance is
  `approved_for_clinical_operations`, and every SOP checklist field is `ready`;
- service audit action `visit_longitudinal_timeline_rollout_sop.review` stores
  aggregate counters, statuses, checklist readiness, reason count, and
  forced-false boundary flags only.

Frontend behavior:

- `VisitWorkspacePage` report tab adds region `SOP timeline rollout` inside
  `Готовность timeline QA`, after `Контур timeline rollout`;
- visible copy states `SOP фиксирует только operational checklist`,
  `Clinical dynamic conclusion: выключен`, and `Выдача пациенту: выключена`;
- the region shows compact checklist fields: `Dataset`, `Reviewer`,
  `Rollback`, `Monitoring`, `Window`, and `Owner`;
- `Утвердить SOP rollout` is disabled unless dataset readiness is
  `ready_for_rollout` and Batch BR rollout governance is
  `approved_for_clinical_operations`;
- `Зафиксировать SOP review` remains available and writes metadata-only review
  state;
- after saving, the workspace reloads the self-hosted read model and shows
  `Timeline rollout SOP сохранён. Clinical dynamic conclusion: выключен.`

Safety boundary:

- `medicalMeasurementAllowed=false`, `patientDeliveryAllowed=false`,
  `protectedFieldsExposed=false`, and `clinicalOutputGenerated=false` are
  forced in repository, service, OpenAPI schema, frontend DTO normalizer, and
  UI copy;
- no patient delivery or clinical dynamic conclusion is produced by this
  batch;
- no pair keys, image IDs, object bucket/key, storage path, checksum, signed
  URL, QR/session/credential, reviewer identity, doctor-only text,
  patient-safe report text, diagnosis, risk, prognosis, treatment, or
  measurement values are returned in SOP read/write responses or audit
  metadata.

### Batch BS Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BS adds the
  operational SOP receipt required before timeline QA rollout can be considered
  ready at visit level. Remaining gate: execute validation on real clinical
  production datasets and monitor SOP usage in clinic workflow.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BS
  prevents rollout readiness from becoming operational unless reviewer
  operations and rollback/monitoring/owner checklist items are ready. Remaining
  gate: production reviewer operations validation on real assets.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BS keeps
  `Clinical dynamic conclusion: выключен`; SOP readiness is operational
  metadata, not a medical conclusion. Remaining gate: approved production
  analysis procedure and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in work. Batch BS is
  doctor-side metadata-only SOP governance; patient delivery remains off until
  privacy/security/retention/session/approved-copy gates are explicitly closed.

## Batch BT Timeline Rollout Evidence

Batch BT adds the post-SOP monitoring evidence receipt for timeline QA rollout.
It solves the plan item `production dataset validation / timeline-level QA
rollout -> SOP monitoring / rollout evidence`. The batch is still
doctor/admin-side metadata only: it records whether monitoring evidence,
sample audit, exception log, rollback drill, and owner signoff are ready, but it
does not generate a clinical dynamic conclusion and does not enable patient
delivery.

Migration:

- `0070_stage5h_timeline_rollout_evidence.sql` creates
  `visit_longitudinal_timeline_rollout_evidence_reviews`;
- stored fields are aggregate operational metadata only:
  `evidence_status`, `evidence_reasons`, `sop_status`, `validation_status`,
  `rollout_status`, five checklist statuses, monitoring window days, sampled
  timeline count, exception count, rollback drill count, and existing rollout
  aggregate counters;
- allowed evidence statuses are `not_started`, `in_review`, and
  `ready_for_monitored_rollout`;
- CHECK constraints force `patient_delivery_allowed=false`,
  `medical_measurement_allowed=false`, `protected_fields_exposed=false`, and
  `clinical_output_generated=false`;
- CHECK `visit_longitudinal_timeline_rollout_evidence_metadata_no_protected_keys`
  blocks pair keys, image IDs, patient rows, object/storage/signed URL fields,
  evidence URLs/raw logs, QR/session/credential material, reviewer names/emails,
  doctor/patient report text, diagnosis/risk/prognosis/treatment, measurement
  values, and dynamic clinical conclusion keys.

Contract additions:

- `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/evidence`
  persists the metadata-only evidence receipt;
- repository builder
  `buildReviewVisitLongitudinalTimelineRolloutEvidenceSql` upserts by
  `visit_id` inside the clinic-scoped visit boundary;
- the `GET /api/v1/visits/{visitId}/longitudinal-dataset-validation` read model
  now includes `timelineRolloutEvidence`;
- service validator
  `normalizeVisitLongitudinalTimelineRolloutEvidencePayload` rejects protected
  keys and clinical claim wording;
- service review method downgrades a requested
  `ready_for_monitored_rollout` to `in_review` with reason
  `timeline_rollout_evidence_not_ready` unless dataset validation is
  `ready_for_rollout`, Batch BR rollout is
  `approved_for_clinical_operations`, Batch BS SOP is
  `ready_for_operational_rollout`, all five evidence checklist fields are
  `ready`, monitoring window and sample/drill counts are positive, and
  exception count is zero;
- audit action `visit_longitudinal_timeline_rollout_evidence.review` stores
  aggregate counts, statuses, evidence readiness booleans, reason count, and
  forced-false boundary flags only.

Frontend behavior:

- `VisitWorkspacePage` report tab adds region `Evidence timeline rollout`
  inside `Готовность timeline QA`, after `SOP timeline rollout`;
- visible copy states `Evidence фиксирует только aggregate monitoring`,
  `Clinical dynamic conclusion: выключен`, and `Выдача пациенту: выключена`;
- compact fields show `Monitoring`, `Sample`, `Exceptions`, `Rollback`,
  `Owner`, `Window`, `Sampled`, `Incidents`, and `Drills`;
- `Утвердить monitored rollout` is disabled unless dataset readiness is
  `ready_for_rollout`, Batch BR rollout governance is
  `approved_for_clinical_operations`, and Batch BS SOP is
  `ready_for_operational_rollout`;
- `Зафиксировать evidence review` remains available and writes metadata-only
  review state;
- after saving, the workspace reloads the self-hosted read model and shows
  `Timeline rollout evidence сохранён. Clinical dynamic conclusion: выключен.`

Safety boundary:

- `medicalMeasurementAllowed=false`, `patientDeliveryAllowed=false`,
  `protectedFieldsExposed=false`, and `clinicalOutputGenerated=false` are
  forced in repository, service, OpenAPI schema, frontend DTO normalizer, and
  UI copy;
- no patient delivery or clinical dynamic conclusion is produced by this batch;
- no pair keys, image IDs, patient rows, object bucket/key, storage path,
  checksum, signed URL, QR/session/credential, reviewer identity, doctor-only
  text, patient-safe report text, diagnosis, risk, prognosis, treatment,
  measurement values, evidence URLs, or raw logs are returned in evidence
  read/write responses or audit metadata.

### Batch BT Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BT adds the
  monitored-rollout evidence receipt required after SOP approval, so timeline
  rollout can capture real monitoring/sample/rollback evidence before scaling.
  Remaining gate: validate the evidence workflow on real production datasets
  and track monitoring outcomes over time.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BT
  prevents operational rollout from being considered monitored unless sample
  audit, exception log, rollback drill, and owner signoff are ready. Remaining
  gate: production reviewer operations validation on real assets and clinic
  SOP adoption.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BT keeps
  `Clinical dynamic conclusion: выключен`; evidence readiness is operational
  monitoring metadata, not a medical conclusion. Remaining gate: approved
  production analysis procedure, clinical validation, and post-rollout
  incident monitoring.
- `SD-MF-046` / patient protocol and lesion history: in work. Batch BT is
  doctor-side metadata-only rollout evidence; patient delivery remains off
  until privacy/security/retention/session/approved-copy gates are explicitly
  closed.

## Batch BU Timeline Rollout Monitoring Outcomes

Plan item: `production dataset validation / timeline-level QA rollout ->
monitoring outcomes / rollout incident evidence`.

Batch BU adds the post-evidence monitoring outcome layer after Batch BT. It is
still a doctor-side, metadata-only operational gate: it records aggregate
outcomes from monitored rollout and incident closure, not clinical dynamic
conclusions and not patient delivery.

Persistence:

- `0071_stage5h_timeline_rollout_monitoring.sql` creates
  `visit_longitudinal_timeline_rollout_monitoring_reviews`;
- stored fields are aggregate operational metadata only:
  `monitoring_status`, `monitoring_reasons`, validation/rollout/SOP/evidence
  statuses, five checklist statuses, monitoring window days, monitored and
  sampled timeline counts, incident counts, unresolved incident count, closed
  exception count, rollback execution count, and existing rollout aggregate
  counters;
- allowed monitoring statuses are `not_started`, `in_review`, and
  `ready_for_production_rollout`;
- CHECK constraints force `patient_delivery_allowed=false`,
  `medical_measurement_allowed=false`, `protected_fields_exposed=false`, and
  `clinical_output_generated=false`;
- CHECK `visit_longitudinal_timeline_rollout_monitoring_metadata_no_protected_keys`
  blocks pair keys, image IDs, patient rows, object/storage/signed URL fields,
  evidence URLs/raw logs, raw monitoring logs, incident payloads, QR/session/
  credential material, reviewer names/emails, doctor/patient report text,
  diagnosis/risk/prognosis/treatment, measurement values, and dynamic clinical
  conclusion keys.

Contract additions:

- `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/monitoring`
  persists the metadata-only monitoring outcome review;
- repository builder
  `buildReviewVisitLongitudinalTimelineRolloutMonitoringSql` upserts by
  `visit_id` inside the clinic-scoped visit boundary;
- the `GET /api/v1/visits/{visitId}/longitudinal-dataset-validation` read model
  now includes `timelineRolloutMonitoring`;
- service validator
  `normalizeVisitLongitudinalTimelineRolloutMonitoringPayload` rejects protected
  keys and clinical claim wording;
- service review method downgrades requested `ready_for_production_rollout` to
  `in_review` with reason `timeline_rollout_monitoring_not_ready` unless
  dataset validation is `ready_for_rollout`, Batch BR rollout is
  `approved_for_clinical_operations`, Batch BS SOP is
  `ready_for_operational_rollout`, Batch BT evidence is
  `ready_for_monitored_rollout`, all five monitoring checklist fields are
  `ready`, monitoring window/monitored/sample counts are positive, and
  unresolved incident count is zero;
- audit action `visit_longitudinal_timeline_rollout_monitoring.review` stores
  aggregate counts, statuses, checklist readiness booleans, reason count, and
  forced-false boundary flags only.

Frontend behavior:

- `VisitWorkspacePage` report tab adds region `Monitoring outcomes rollout`
  inside `Готовность timeline QA`, after `Evidence timeline rollout`;
- visible copy states `Monitoring фиксирует только aggregate outcomes`,
  `Clinical dynamic conclusion: выключен`, and `Выдача пациенту: выключена`;
- compact fields show `Outcome`, `Incidents`, `Exceptions`, `Rollback`,
  `Owner`, `Window`, `Monitored`, `Sampled`, `Open Inc.`, `Closed Ex.`, and
  `Rollback Run`;
- `Утвердить production rollout` is disabled unless dataset readiness is
  `ready_for_rollout`, Batch BR rollout governance is
  `approved_for_clinical_operations`, Batch BS SOP is
  `ready_for_operational_rollout`, and Batch BT evidence is
  `ready_for_monitored_rollout`;
- `Зафиксировать monitoring review` remains available and writes metadata-only
  review state;
- after saving, the workspace reloads the self-hosted read model and shows
  `Timeline rollout monitoring сохранён. Clinical dynamic conclusion: выключен.`

Safety boundary:

- `medicalMeasurementAllowed=false`, `patientDeliveryAllowed=false`,
  `protectedFieldsExposed=false`, and `clinicalOutputGenerated=false` are
  forced in repository, service, OpenAPI schema, frontend DTO normalizer, and
  UI copy;
- no patient delivery or clinical dynamic conclusion is produced by this batch;
- no pair keys, image IDs, patient rows, object bucket/key, storage path,
  checksum, signed URL, QR/session/credential, reviewer identity, doctor-only
  text, patient-safe report text, diagnosis, risk, prognosis, treatment,
  measurement values, evidence URLs, raw monitoring logs, or incident payloads
  are returned in monitoring read/write responses or audit metadata.

### Batch BU Brainstorm Coverage

- `SD-MF-025` / lesion image chronology: partially solved. Batch BU adds
  monitored-rollout outcome and incident evidence after Batch BT, so timeline
  rollout can track whether monitored production usage had samples, closed
  exceptions, rollback execution, and no unresolved incidents. Remaining gate:
  production outcome monitoring on real clinical datasets over time.
- `SD-MF-026` / comparable image-pair workflow: partially solved. Batch BU
  adds post-rollout outcome/incident closure gating to reviewer operations.
  Remaining gate: clinical operations validation on real assets and production
  reviewer governance.
- `SD-MF-028` / dynamics reliability: partially solved. Batch BU keeps
  `Clinical dynamic conclusion: выключен`; production rollout is blocked when
  monitoring outcomes or incidents are not closed. Remaining gate: approved
  production analysis procedure and clinical validation.
- `SD-MF-046` / patient protocol and lesion history: in work. Batch BU is
  doctor-side metadata-only monitoring outcomes; patient delivery remains off
  until privacy/security/retention/session/approved-copy gates are explicitly
  closed.

## Product Boundary

- managed runtime: none
- managed database: none
- browser hardware APIs: none
- no Supabase runtime, `api-read`, `api-write`, Edge Function, raw object
  path, or signed URL dependency in protected Stage 5H files
- no patient delivery for lesion comparison draft decisions until a separate
  patient-facing longitudinal protocol gate is approved

## Validation

```bash
npm run preflight:stage5h
npm run preflight:stage5g
npm run preflight:all -- --dry-run
node scripts/check-no-deno-locks.mjs
```

Expected:

- Stage 5H backend tests, frontend tests, guard, and deno-lock guard pass.
- Stage 5G still proves production does not fall back to mock clinical
  assessment/report data.
- `package-lock.json` remains unchanged.

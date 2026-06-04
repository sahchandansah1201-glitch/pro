# Batch BR Lovable Verification Prompt

Проверь синхронизацию Batch BR `Timeline Rollout Governance`.

Пункт плана: `production dataset validation / timeline-level QA rollout -> timeline rollout governance`.

Не вноси изменения. Только проверь код текущей ветки и дай отчёт.

## Проверки

1. HEAD commit соответствует Batch BR: `Build Batch BR timeline rollout governance`.
2. Batch BQ сохранён: `production_analysis_policy_required`, `approve_production_analysis_policy`, `Production analysis policy`, `Analysis`, `analysis:` остаются в коде.
3. Есть migration `backend/self-hosted/db/migrations/0068_stage5h_timeline_rollout_governance.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_reviews` и хранит только aggregate metadata: `lesion_count`, `ready_timeline_count`, `needs_review_timeline_count`, `blocked_timeline_count`, `candidate_pair_count`, `reviewer_workflow_ready_count`.
5. Migration CHECK содержит forced-false boundaries: `patient_delivery_allowed=false`, `medical_measurement_allowed=false`, `protected_fields_exposed=false`, `clinical_output_generated=false`.
6. Migration CHECK `visit_longitudinal_timeline_rollout_reviews_metadata_no_protected_keys` блокирует `pairKey`, `imageIds`, storage/object/signed URL keys, token/QR/session keys, reviewer identity keys, `doctorVersionText`, `patientSafeText`, `dynamicConclusion`, diagnosis/risk/prognosis/treatment and measurement value keys.
7. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutSql`, upsert по `visit_id`, clinic-scoped target visit, and returns no pair/image/storage/clinical text fields.
8. `buildGetVisitLongitudinalDatasetValidationSql` includes latest `timelineRollout` read model from `visit_longitudinal_timeline_rollout_reviews`.
9. Service contains `normalizeVisitLongitudinalTimelineRolloutPayload` and `reviewVisitLongitudinalTimelineRollout`; protected/clinical keys are rejected.
10. Service downgrades requested `approved_for_clinical_operations` to `review_required` when current validation is not `ready_for_rollout`, adding reason `timeline_dataset_not_ready`.
11. Service audit action is `visit_longitudinal_timeline_rollout.review` and audit metadata is aggregate-only: no `pairKey`, `imageIds`, storage paths, signed URLs, reviewer identity, doctor/patient text, diagnosis/risk/prognosis/treatment, or dynamic conclusion.
12. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout` exists in `backend/self-hosted/routes.mjs`, returns Stage `5H`, `source: "postgres"`, and is documented in `openapi.stage5h.json` with schema `VisitLongitudinalTimelineRollout`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRollout`, `SelfHostedVisitLongitudinalTimelineRolloutDTO`, `VisitLongitudinalTimelineRolloutPayload`; normalizer forces `patientDeliveryAllowed`, `medicalMeasurementAllowed`, `protectedFieldsExposed`, `clinicalOutputGenerated` to `false`.
14. `VisitWorkspacePage` report tab contains region `Контур timeline rollout` inside `Готовность timeline QA`, shows copy `Rollout сохраняет только aggregate metadata`, `Clinical dynamic conclusion: выключен`, `Выдача пациенту: выключена`, button `Утвердить timeline rollout` disabled unless readiness is `ready_for_rollout`, button `Нужен разбор rollout`, and success copy `Timeline rollout governance сохранён`.

## Hygiene

Confirm no patient delivery is enabled; no medical measurement is enabled; no clinical dynamic conclusion is generated; no diagnosis/risk/prognosis/treatment copy is introduced; no pair keys/image IDs/storage/signed URL/token/QR/session/reviewer identity/doctor-only/patient-safe report text is exposed in UI, OpenAPI, service JSON, or audit metadata.

## Responsive

Confirm the new `Контур timeline rollout` block is compact inside the existing `Готовность timeline QA` section and does not introduce horizontal overflow at 1280px or 390px.

## Покрытие мозгового штурма

- `SD-MF-025` / хронология снимков очага: `частично решено`. Batch BR closes visit-level rollout governance over timeline validation. Осталось: validation on real clinical production datasets and rollout SOP.
- `SD-MF-026` / режим сравнения снимков: `частично решено`. Batch BR prevents clinical ops rollout until pair review/policy/assignment/second-review counters are ready. Осталось: production reviewer operations validation.
- `SD-MF-028` / достоверность анализа динамики: `частично решено`. Batch BR keeps `Clinical dynamic conclusion: выключен`; approval is governance metadata, not a medical conclusion. Осталось: approved production analysis procedure and clinical validation.
- `SD-MF-046` / пациентский протокол и история новообразований: `в работе`. Batch BR is doctor-side metadata-only timeline governance; patient delivery remains off until privacy/security/retention/session/approved-copy gates are closed.

## Формат отчёта

Верни:

- sync status: HEAD commit, mismatch yes/no;
- table 14/14 checks;
- hygiene status;
- responsive status;
- `Покрытие мозгового штурма`;
- whether extra GitHub/Lovable sync is required.

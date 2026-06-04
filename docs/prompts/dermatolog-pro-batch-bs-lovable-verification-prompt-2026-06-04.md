# Batch BS Lovable Verification Prompt

Проверь синхронизацию Batch BS `Timeline Rollout SOP`.

Пункт плана: `production dataset validation / timeline-level QA rollout -> timeline rollout SOP`.

Не вноси изменения. Только проверь код текущей ветки и дай отчёт.

## Проверки

1. HEAD commit соответствует Batch BS: `Build Batch BS timeline rollout SOP`.
2. Batch BR сохранён: `visit_longitudinal_timeline_rollout_reviews`, `buildReviewVisitLongitudinalTimelineRolloutSql`, `VisitLongitudinalTimelineRollout`, `Контур timeline rollout`, `Утвердить timeline rollout`, `Clinical dynamic conclusion: выключен` остаются в коде.
3. Есть migration `backend/self-hosted/db/migrations/0069_stage5h_timeline_rollout_sop.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_sop_reviews` и хранит только aggregate/checklist metadata: `lesion_count`, `ready_timeline_count`, `blocked_timeline_count`, `candidate_pair_count`, `reviewer_workflow_ready_count`, `dataset_validation_status`, `reviewer_operations_status`, `rollback_plan_status`, `monitoring_plan_status`, `rollout_window_status`, `owner_ack_status`.
5. Migration CHECK содержит forced-false boundaries: `patient_delivery_allowed=false`, `medical_measurement_allowed=false`, `protected_fields_exposed=false`, `clinical_output_generated=false`.
6. Migration CHECK `visit_longitudinal_timeline_rollout_sop_metadata_no_protected_keys` блокирует `pairKey`, `imageIds`, storage/object/signed URL keys, token/QR/session keys, reviewer identity keys, `doctorVersionText`, `patientSafeText`, `dynamicConclusion`, diagnosis/risk/prognosis/treatment and measurement value keys.
7. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutSopSql`, upsert по `visit_id`, clinic-scoped target visit, and returns no pair/image/storage/clinical text fields.
8. `buildGetVisitLongitudinalDatasetValidationSql` includes latest `timelineRolloutSop` read model from `visit_longitudinal_timeline_rollout_sop_reviews`.
9. Service contains `normalizeVisitLongitudinalTimelineRolloutSopPayload` and `reviewVisitLongitudinalTimelineRolloutSop`; protected/clinical keys are rejected.
10. Service downgrades requested `ready_for_operational_rollout` to `in_review` unless dataset validation is `ready_for_rollout`, Batch BR rollout is `approved_for_clinical_operations`, and all six SOP checklist statuses are `ready`, adding reason `timeline_rollout_sop_not_ready`.
11. Service audit action is `visit_longitudinal_timeline_rollout_sop.review` and audit metadata is aggregate-only: no `pairKey`, `imageIds`, storage paths, signed URLs, reviewer identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement values, or dynamic conclusion.
12. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/sop` exists in `backend/self-hosted/routes.mjs`, returns Stage `5H`, `source: "postgres"`, and is documented in `openapi.stage5h.json` with schemas `VisitLongitudinalTimelineRolloutSop` and `VisitLongitudinalTimelineRolloutSopPayload`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutSop`, `SelfHostedVisitLongitudinalTimelineRolloutSopDTO`, `VisitLongitudinalTimelineRolloutSopPayload`; normalizer forces `patientDeliveryAllowed`, `medicalMeasurementAllowed`, `protectedFieldsExposed`, `clinicalOutputGenerated` to `false`.
14. `VisitWorkspacePage` report tab contains region `SOP timeline rollout` inside `Готовность timeline QA`, shows copy `SOP фиксирует только operational checklist`, `Clinical dynamic conclusion: выключен`, `Выдача пациенту: выключена`, buttons `Зафиксировать SOP review` and `Утвердить SOP rollout`; approval is disabled unless dataset readiness is `ready_for_rollout` and Batch BR rollout governance is `approved_for_clinical_operations`.

## Hygiene

Confirm no patient delivery is enabled; no medical measurement is enabled; no clinical dynamic conclusion is generated; no diagnosis/risk/prognosis/treatment copy is introduced; no pair keys/image IDs/storage/signed URL/token/QR/session/reviewer identity/doctor-only/patient-safe report text is exposed in UI, OpenAPI, service JSON, or audit metadata.

## Responsive

Confirm the new `SOP timeline rollout` block is compact inside the existing `Готовность timeline QA` section and does not introduce horizontal overflow at 1280px or 390px.

## Покрытие мозгового штурма

- `SD-MF-025` / хронология снимков очага: `частично решено`. Batch BS closes the operational SOP receipt required before timeline QA rollout can be considered ready. Осталось: validation on real clinical production datasets and SOP usage monitoring.
- `SD-MF-026` / режим сравнения снимков: `частично решено`. Batch BS prevents operational rollout readiness unless reviewer operations and rollback/monitoring/owner checklist items are ready. Осталось: production reviewer operations validation on real assets.
- `SD-MF-028` / достоверность анализа динамики: `частично решено`. Batch BS keeps `Clinical dynamic conclusion: выключен`; SOP readiness is operational metadata, not a medical conclusion. Осталось: approved production analysis procedure and clinical validation.
- `SD-MF-046` / пациентский протокол и история новообразований: `в работе`. Batch BS is doctor-side metadata-only SOP governance; patient delivery remains off until privacy/security/retention/session/approved-copy gates are closed.

## Формат отчёта

Верни:

- sync status: HEAD commit, mismatch yes/no;
- table 14/14 checks;
- hygiene status;
- responsive status;
- `Покрытие мозгового штурма`;
- whether extra GitHub/Lovable sync is required.

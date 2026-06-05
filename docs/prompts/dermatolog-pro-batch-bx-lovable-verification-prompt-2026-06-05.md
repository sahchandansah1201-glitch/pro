# Dermatolog PRO · Batch BX Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch BX: `Build Batch BX post-validation monitoring`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch BX. Если HEAD не Batch BX, но Batch BX commit есть сразу под sync-trigger commit, это допустимо; явно укажи оба SHA.
3. Если HEAD всё ещё Batch BW или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch BX.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch BX commit.
2. Batch BW сохранён: migration `0073_stage5h_timeline_rollout_clinical_validation.sql`, `buildReviewVisitLongitudinalTimelineRolloutClinicalValidationSql`, `VisitLongitudinalTimelineRolloutClinicalValidation`, UI region `Clinical validation rollout`.
3. Есть migration `backend/self-hosted/db/migrations/0074_stage5h_timeline_rollout_post_validation_monitoring.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_post_validation_monitoring_reviews` с `post_validation_monitoring_status`, `post_validation_monitoring_reasons`, previous-layer statuses, six checklist statuses, real dataset / clinical validation sample / monitored timeline / sampled outcome / drift / incident follow-up / validator recheck / blocker aggregate counts.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, patient rows/IDs, case IDs, storage/object/signed URL fields, raw evidence/monitoring/outcome/validation/adjudication/drift/follow-up logs, clinical/post-validation payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutPostValidationMonitoringSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest post-validation monitoring read model and `timelineRolloutPostValidationMonitoring`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringPayload` и `reviewVisitLongitudinalTimelineRolloutPostValidationMonitoring`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_post_validation_monitoring` downgrades to `in_review` + reason `timeline_rollout_post_validation_monitoring_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, six checklist statuses, positive real dataset/sample/monitored/outcome counts, and zero unresolved drift/follow-up/blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_post_validation_monitoring.review` is aggregate-only; no pair/image/storage/patient rows/raw monitoring/drift/follow-up details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/post-validation-monitoring` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutPostValidationMonitoring`, `VisitLongitudinalTimelineRolloutPostValidationMonitoringPayload`, path `/longitudinal-timeline-rollout/post-validation-monitoring`, and `timelineRolloutPostValidationMonitoring` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutPostValidationMonitoring`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Post-validation monitoring rollout`, copy `Post-validation monitoring фиксирует только aggregate follow-up/drift metadata · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать post-validation monitoring` and `Утвердить post-validation monitoring`; approval disabled until previous gates through clinical validation are ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, patient rows, raw monitoring/drift/follow-up logs, post-validation payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто post-validation monitoring receipt after clinical validation, with follow-up and drift readiness before broader clinical use; осталось real longitudinal outcome observation over production datasets.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыто outcome review, drift review, incident follow-up, validator recheck, and owner signoff counters for reviewer workflow; осталось reviewer operations validation on real protected assets and ongoing SOP monitoring.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, post-validation monitoring remains aggregate operational metadata; осталось approved post-rollout outcome review procedure and clinical governance over time.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: production outcome monitoring on real clinical datasets / post-validation monitoring.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

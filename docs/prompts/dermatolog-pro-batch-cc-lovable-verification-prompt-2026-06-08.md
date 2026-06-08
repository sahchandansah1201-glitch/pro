# Dermatolog PRO · Batch CC Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch CC: `Build Batch CC protected reviewer validation`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch CC. Если HEAD не Batch CC, но Batch CC commit есть сразу под sync-trigger commit, это допустимо; явно укажи оба SHA.
3. Если HEAD всё ещё Batch CB или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch CC.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch CC commit.
2. Batch CB сохранён: migration `0078_stage5h_longitudinal_clinical_validation.sql`, `buildReviewVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationSql`, `VisitLongitudinalTimelineRolloutLongitudinalClinicalValidation`, UI region `Longitudinal clinical validation`.
3. Есть migration `backend/self-hosted/db/migrations/0079_stage5h_protected_reviewer_validation.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_protected_reviewer_validation_reviews` с `protected_reviewer_validation_status`, `protected_reviewer_validation_reasons`, previous-layer statuses, seven checklist statuses, and aggregate counts for protected asset timeline windows / render-ready protected windows / reviewer-assigned protected windows / second-reviewed protected windows / adjudicated protected windows / follow-up validated protected windows / unresolved protected review windows / blockers.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, asset/patient/case identifiers, storage/object/signed URL fields, raw protected reviewer logs, reviewer ops payload/details, adjudication payload/details, follow-up ops payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutProtectedReviewerValidationSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest protected reviewer validation read model and `timelineRolloutProtectedReviewerValidation`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutProtectedReviewerValidationPayload` и `reviewVisitLongitudinalTimelineRolloutProtectedReviewerValidation`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_protected_reviewer_validation` downgrades to `in_review` + reason `timeline_rollout_protected_reviewer_validation_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, post-validation monitoring, observation governance, exception governance, outcome governance, longitudinal clinical validation, seven checklist statuses, zero unresolved protected review windows, and zero blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_protected_reviewer_validation.review` is aggregate-only; no pair/image/storage/patient rows/raw protected review logs/reviewer identity details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/protected-reviewer-validation` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutProtectedReviewerValidation`, `VisitLongitudinalTimelineRolloutProtectedReviewerValidationPayload`, path `/longitudinal-timeline-rollout/protected-reviewer-validation`, and `timelineRolloutProtectedReviewerValidation` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerValidation`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Protected reviewer validation`, copy `Protected reviewer validation фиксирует только aggregate reviewer operations metadata on protected assets · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать protected reviewer validation` and `Утвердить protected reviewer validation`; approval disabled until longitudinal clinical validation is ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, asset/patient/case rows, raw protected reviewer logs, reviewer ops payload/details, adjudication payload/details, follow-up ops payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто protected reviewer validation receipt over real protected longitudinal assets; осталось long-running production dataset evidence on real clinical operations.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыт reviewer operations validation layer on real protected assets; осталось approved reviewer operations governance over time on production assets.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, protected reviewer validation remains aggregate-only operational metadata; осталось approved longitudinal clinical validation and monitored reviewer operations on real protected assets over time.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: reviewer operations validation on real protected assets.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

# Dermatolog PRO · Batch CB Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch CB: `Build Batch CB longitudinal clinical validation`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch CB. Если HEAD не Batch CB, но Batch CB commit есть сразу под sync-trigger commit, это допустимо; явно укажи оба SHA.
3. Если HEAD всё ещё Batch CA или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch CB.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch CB commit.
2. Batch CA сохранён: migration `0077_stage5h_longitudinal_outcome_governance.sql`, `buildReviewVisitLongitudinalTimelineRolloutOutcomeGovernanceSql`, `VisitLongitudinalTimelineRolloutOutcomeGovernance`, UI region `Longitudinal outcome governance`.
3. Есть migration `backend/self-hosted/db/migrations/0078_stage5h_longitudinal_clinical_validation.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_reviews` с `longitudinal_clinical_validation_status`, `longitudinal_clinical_validation_reasons`, previous-layer statuses, seven checklist statuses, and aggregate counts for real outcome windows / clinically validated windows / adjudicated windows / follow-up validated windows / consensus / governance review / blockers.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, asset/patient/case identifiers, storage/object/signed URL fields, raw longitudinal validation logs, adjudication payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest longitudinal clinical validation read model and `timelineRolloutLongitudinalClinicalValidation`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationPayload` и `reviewVisitLongitudinalTimelineRolloutLongitudinalClinicalValidation`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_longitudinal_clinical_validation` downgrades to `in_review` + reason `timeline_rollout_longitudinal_clinical_validation_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, post-validation monitoring, observation governance, exception governance, outcome governance, seven checklist statuses, zero unresolved consensus cases, governance review, and zero blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_longitudinal_clinical_validation.review` is aggregate-only; no pair/image/storage/patient rows/raw longitudinal validation/adjudication details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/longitudinal-clinical-validation` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutLongitudinalClinicalValidation`, `VisitLongitudinalTimelineRolloutLongitudinalClinicalValidationPayload`, path `/longitudinal-timeline-rollout/longitudinal-clinical-validation`, and `timelineRolloutLongitudinalClinicalValidation` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutLongitudinalClinicalValidation`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Longitudinal clinical validation`, copy `Clinical longitudinal validation фиксирует только aggregate clinical longitudinal metadata over time · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать longitudinal clinical validation` and `Утвердить longitudinal clinical validation`; approval disabled until outcome governance is ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, asset/patient/case rows, raw longitudinal validation logs, adjudication payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто real clinical longitudinal validation receipt over time after outcome governance; осталось long-running production dataset evidence on real clinical operations.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыт longitudinal validation layer around comparison workflows; осталось reviewer operations validation on real protected assets.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, validation remains aggregate-only clinical longitudinal metadata; осталось approved longitudinal clinical validation over real protected assets over time.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: real clinical longitudinal validation over time.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

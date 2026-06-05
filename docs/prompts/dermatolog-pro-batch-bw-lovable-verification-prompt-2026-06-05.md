# Dermatolog PRO · Batch BW Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch BW: `Build Batch BW clinical validation review`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch BW. Если HEAD не Batch BW, но Batch BW commit есть сразу под sync-trigger commit, это допустимо; явно укажи оба SHA.
3. Если HEAD всё ещё Batch BV или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch BW.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch BW commit.
2. Batch BV сохранён: migration `0072_stage5h_timeline_rollout_incident_procedure.sql`, `buildReviewVisitLongitudinalTimelineRolloutIncidentProcedureSql`, `VisitLongitudinalTimelineRolloutIncidentProcedure`, UI region `Incident procedure rollout`.
3. Есть migration `backend/self-hosted/db/migrations/0073_stage5h_timeline_rollout_clinical_validation.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_clinical_validation_reviews` с `clinical_validation_status`, `clinical_validation_reasons`, previous-layer statuses, six checklist statuses, real dataset / validation sample / disagreement / adjudication / follow-up / blocker aggregate counts.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, patient rows/IDs, case IDs, storage/object/signed URL fields, raw evidence/monitoring/outcome/validation/adjudication logs, clinical validation payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutClinicalValidationSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest clinical validation read model and `timelineRolloutClinicalValidation`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutClinicalValidationPayload` и `reviewVisitLongitudinalTimelineRolloutClinicalValidation`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_clinical_validation` downgrades to `in_review` + reason `timeline_rollout_clinical_validation_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, six checklist statuses, positive real dataset/sample counts, adjudicated >= disagreement, and zero blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_clinical_validation.review` is aggregate-only; no pair/image/storage/patient rows/raw validation/adjudication details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/clinical-validation` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutClinicalValidation`, `VisitLongitudinalTimelineRolloutClinicalValidationPayload`, path `/longitudinal-timeline-rollout/clinical-validation`, and `timelineRolloutClinicalValidation` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutClinicalValidation`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Clinical validation rollout`, copy `Clinical validation фиксирует только aggregate validation metadata · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать clinical validation` and `Утвердить clinical validation`; approval disabled until previous gates are ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, patient rows, raw validation/adjudication logs, clinical validation payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `rawValidationLogsExposed:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто clinical-validation receipt over real dataset/sample/adjudication counters after incident-procedure readiness; осталось real production dataset validation results and post-validation monitoring over time.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыто validator training, blinded sample review, adjudication, decision log, owner acceptance gates; осталось clinical operations validation on real assets and reviewer governance.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, validation approval remains operational metadata only; осталось approved clinical validation procedure and monitored post-rollout outcome review.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: production outcome monitoring on real clinical datasets / clinical validation review.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

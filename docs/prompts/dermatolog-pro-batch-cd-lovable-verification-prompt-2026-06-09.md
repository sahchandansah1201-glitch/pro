# Dermatolog PRO · Batch CD Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch CD: `Build Batch CD protected reviewer governance`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать Batch CD commit либо sync-trigger commit поверх него; если поверх Batch CD есть только технический sync commit, явно укажи оба SHA.
3. Если HEAD всё ещё Batch CC или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch CD.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch CD commit.
2. Batch CC сохранён: migration `0079_stage5h_protected_reviewer_validation.sql`, `buildReviewVisitLongitudinalTimelineRolloutProtectedReviewerValidationSql`, `VisitLongitudinalTimelineRolloutProtectedReviewerValidation`, UI region `Protected reviewer validation`.
3. Есть migration `backend/self-hosted/db/migrations/0080_stage5h_protected_reviewer_governance.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_protected_reviewer_governance_reviews` с `protected_reviewer_governance_status`, `protected_reviewer_governance_reasons`, previous-layer statuses, seven checklist statuses, and aggregate counts for protected review windows / monitored protected reviews / escalated protected reviews / adjudicated protected governance / follow-up closed protected reviews / rollback-ready protected reviews / archived protected reviews / unresolved governance review windows / blockers.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, asset/patient/case identifiers, storage/object/signed URL fields, raw protected reviewer logs, reviewer monitoring payload/details, reviewer exception/adjudication/follow-up/rollback/archive payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutProtectedReviewerGovernanceSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest protected reviewer governance read model and `timelineRolloutProtectedReviewerGovernance`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutProtectedReviewerGovernancePayload` и `reviewVisitLongitudinalTimelineRolloutProtectedReviewerGovernance`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_protected_reviewer_governance` downgrades to `in_review` + reason `timeline_rollout_protected_reviewer_governance_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, post-validation monitoring, observation governance, exception governance, outcome governance, longitudinal clinical validation, protected reviewer validation, seven checklist statuses, zero unresolved governance review windows, and zero blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_protected_reviewer_governance.review` is aggregate-only; no pair/image/storage/patient rows/raw reviewer logs/reviewer identity details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/protected-reviewer-governance` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutProtectedReviewerGovernance`, `VisitLongitudinalTimelineRolloutProtectedReviewerGovernancePayload`, path `/longitudinal-timeline-rollout/protected-reviewer-governance`, and `timelineRolloutProtectedReviewerGovernance` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerGovernance`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Protected reviewer governance`, copy `Protected reviewer governance фиксирует только aggregate monitored reviewer operations metadata on protected assets · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать protected reviewer governance` and `Утвердить protected reviewer governance`; approval disabled until protected reviewer validation is ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, asset/patient/case rows, raw reviewer logs, reviewer monitoring/exception/adjudication/follow-up/rollback/archive payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто protected reviewer governance receipt over time on real protected longitudinal assets; осталось long-running production dataset evidence on real clinical operations.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыт reviewer-operations governance layer over validated protected assets; осталось approved reviewer-ops governance over time on production assets.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, protected reviewer governance remains aggregate-only operational metadata; осталось approved longitudinal clinical validation and monitored reviewer operations over time on real protected assets.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: reviewer operations governance over time on real protected assets.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

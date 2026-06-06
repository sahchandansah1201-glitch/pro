# Dermatolog PRO · Batch BZ Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch BZ: `Build Batch BZ exception governance`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch BZ. Если HEAD не Batch BZ, но Batch BZ commit есть сразу под sync-trigger commit, это допустимо; явно укажи оба SHA.
3. Если HEAD всё ещё Batch BY или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch BZ.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch BZ commit.
2. Batch BY сохранён: migration `0075_stage5h_timeline_rollout_observation_governance.sql`, `buildReviewVisitLongitudinalTimelineRolloutObservationGovernanceSql`, `VisitLongitudinalTimelineRolloutObservationGovernance`, UI region `Outcome observation governance`.
3. Есть migration `backend/self-hosted/db/migrations/0076_stage5h_timeline_rollout_exception_governance.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_exception_governance_reviews` с `exception_governance_status`, `exception_governance_reasons`, previous-layer statuses, seven checklist statuses, real dataset / observed timeline / governance exception / resolved exception / recurrence signal / rollback drill / blocker aggregate counts.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, asset/patient/case identifiers, storage/object/signed URL fields, raw evidence/monitoring/outcome/validation/adjudication/drift/follow-up/observation/outcome-review/incident-outcome/exception/recurrence/rollback logs, clinical/post-validation/observation/governance/exception/recurrence/rollback payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutExceptionGovernanceSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest exception governance read model and `timelineRolloutExceptionGovernance`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutExceptionGovernancePayload` и `reviewVisitLongitudinalTimelineRolloutExceptionGovernance`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_exception_governance` downgrades to `in_review` + reason `timeline_rollout_exception_governance_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, post-validation monitoring, observation governance, seven checklist statuses, positive real dataset/observed counts, exception closure, recurrence closure, rollback drill, and zero blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_exception_governance.review` is aggregate-only; no pair/image/storage/patient rows/raw exception/recurrence/rollback details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/exception-governance` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutExceptionGovernance`, `VisitLongitudinalTimelineRolloutExceptionGovernancePayload`, path `/longitudinal-timeline-rollout/exception-governance`, and `timelineRolloutExceptionGovernance` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutExceptionGovernance`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Exception governance closure`, copy `Exception governance фиксирует только aggregate exception closure · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать exception governance` and `Утвердить exception governance`; approval disabled until previous gates through observation governance are ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, asset/patient/case rows, raw exception/recurrence/rollback logs, exception/governance payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто exception-governance closure after observation governance with exception register, triage SLA, resolution evidence, recurrence review, rollback readiness, archive, and owner signoff; осталось longitudinal outcome governance over real datasets over time.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыто aggregate exception closure layer for reviewer workflow governance; осталось reviewer operations validation on real protected assets and long-running monitoring.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, exception governance remains aggregate operational metadata; осталось approved longitudinal outcome procedure and clinical validation over time.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: production outcome monitoring on real clinical datasets / exception governance closure.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

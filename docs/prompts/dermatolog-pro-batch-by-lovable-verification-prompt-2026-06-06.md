# Dermatolog PRO · Batch BY Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch BY: `Build Batch BY observation governance`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch BY. Если HEAD не Batch BY, но Batch BY commit есть сразу под sync-trigger commit, это допустимо; явно укажи оба SHA.
3. Если HEAD всё ещё Batch BX или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch BY.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch BY commit.
2. Batch BX сохранён: migration `0074_stage5h_timeline_rollout_post_validation_monitoring.sql`, `buildReviewVisitLongitudinalTimelineRolloutPostValidationMonitoringSql`, `VisitLongitudinalTimelineRolloutPostValidationMonitoring`, UI region `Post-validation monitoring rollout`.
3. Есть migration `backend/self-hosted/db/migrations/0075_stage5h_timeline_rollout_observation_governance.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_observation_governance_reviews` с `observation_governance_status`, `observation_governance_reasons`, previous-layer statuses, seven checklist statuses, real dataset / post-validation sample / observed timeline / follow-up / drift / incident outcome / governance exception / blocker aggregate counts.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, patient rows/IDs, case IDs, storage/object/signed URL fields, raw evidence/monitoring/outcome/validation/adjudication/drift/follow-up/observation/outcome-review/incident-outcome logs, clinical/post-validation/observation/governance payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutObservationGovernanceSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest observation governance read model and `timelineRolloutObservationGovernance`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutObservationGovernancePayload` и `reviewVisitLongitudinalTimelineRolloutObservationGovernance`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_observation_governance` downgrades to `in_review` + reason `timeline_rollout_observation_governance_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, post-validation monitoring, seven checklist statuses, positive real dataset/sample/observed/follow-up counts, completed follow-up coverage, and zero unresolved drift/incident/governance/blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_observation_governance.review` is aggregate-only; no pair/image/storage/patient rows/raw observation/outcome/incident/governance details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/observation-governance` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutObservationGovernance`, `VisitLongitudinalTimelineRolloutObservationGovernancePayload`, path `/longitudinal-timeline-rollout/observation-governance`, and `timelineRolloutObservationGovernance` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutObservationGovernance`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Outcome observation governance`, copy `Observation governance фиксирует только aggregate outcome metadata · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать observation governance` and `Утвердить observation governance`; approval disabled until previous gates through post-validation monitoring are ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, patient rows, raw observation/outcome/incident/governance logs, observation/governance payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто ongoing observation-governance receipt after post-validation monitoring with observed timelines and follow-up closure; осталось longitudinal outcome observation over real clinical datasets plus operational exception handling over time.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыто outcome observation, drift-signal review, incident outcome review, governance exceptions, and owner signoff as aggregate reviewer-workflow governance; осталось reviewer operations validation on real protected assets and ongoing SOP monitoring.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, observation governance remains aggregate operational metadata; осталось approved longitudinal outcome governance and clinical review procedure over time.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: production outcome monitoring on real clinical datasets / ongoing outcome observation governance.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

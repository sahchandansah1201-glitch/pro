# Dermatolog PRO · Batch CA Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch CA: `Build Batch CA longitudinal outcome governance`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch CA. Если HEAD не Batch CA, но Batch CA commit есть сразу под sync-trigger commit, это допустимо; явно укажи оба SHA.
3. Если HEAD всё ещё Batch BZ или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch CA.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch CA commit.
2. Batch BZ сохранён: migration `0076_stage5h_timeline_rollout_exception_governance.sql`, `buildReviewVisitLongitudinalTimelineRolloutExceptionGovernanceSql`, `VisitLongitudinalTimelineRolloutExceptionGovernance`, UI region `Exception governance closure`.
3. Есть migration `backend/self-hosted/db/migrations/0077_stage5h_longitudinal_outcome_governance.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_outcome_governance_reviews` с `outcome_governance_status`, `outcome_governance_reasons`, previous-layer statuses, seven checklist statuses, real dataset / observed timeline / follow-up / governance exception / recurrence / governance review / blocker aggregate counts.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, asset/patient/case identifiers, storage/object/signed URL fields, raw outcome/follow-up/governance logs, clinical/post-validation/observation/governance/outcome payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutOutcomeGovernanceSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest outcome governance read model and `timelineRolloutOutcomeGovernance`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutOutcomeGovernancePayload` и `reviewVisitLongitudinalTimelineRolloutOutcomeGovernance`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_outcome_governance` downgrades to `in_review` + reason `timeline_rollout_outcome_governance_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, post-validation monitoring, observation governance, exception governance, seven checklist statuses, follow-up closure, recurrence closure, governance review, and zero blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_outcome_governance.review` is aggregate-only; no pair/image/storage/patient rows/raw outcome/follow-up/governance details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/outcome-governance` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutOutcomeGovernance`, `VisitLongitudinalTimelineRolloutOutcomeGovernancePayload`, path `/longitudinal-timeline-rollout/outcome-governance`, and `timelineRolloutOutcomeGovernance` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutOutcomeGovernance`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Longitudinal outcome governance`, copy `Outcome governance фиксирует только aggregate longitudinal metadata over time · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать outcome governance` and `Утвердить outcome governance`; approval disabled until previous gates through exception governance are ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, asset/patient/case rows, raw outcome/follow-up/governance logs, payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто longitudinal outcome governance receipt after exception governance with real dataset window, coverage, reviewer ops validation, trend review, follow-up cadence, governance cadence, and owner signoff; осталось long-running production dataset evidence on real clinical operations.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыто longitudinal reviewer-operations validation layer around comparison workflows; осталось reviewer operations validation on real protected assets over time.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, outcome governance remains aggregate operational metadata over time; осталось approved longitudinal clinical validation over real outcome windows.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: production outcome monitoring on real clinical datasets / longitudinal outcome governance over time.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

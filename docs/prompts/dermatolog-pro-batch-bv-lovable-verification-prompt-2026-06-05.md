# Dermatolog PRO · Batch BV Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch BV: `Build Batch BV incident procedure monitoring`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch BV. Если HEAD не Batch BV, но Batch BV commit есть сразу под sync-trigger commit, это допустимо; явно укажи оба SHA.
3. Если HEAD всё ещё Batch BU или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch BV.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch BV commit.
2. Batch BU сохранён: migration `0071_stage5h_timeline_rollout_monitoring.sql`, `buildReviewVisitLongitudinalTimelineRolloutMonitoringSql`, `VisitLongitudinalTimelineRolloutMonitoring`, UI region `Monitoring outcomes rollout`.
3. Есть migration `backend/self-hosted/db/migrations/0072_stage5h_timeline_rollout_incident_procedure.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_incident_procedure_reviews` с `procedure_status`, `procedure_reasons`, previous-layer statuses, six checklist statuses, real/monitored/sampled/incident/escalation/rollback aggregate counts.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, patient rows/IDs, case IDs, storage/object/signed URL fields, raw evidence/monitoring/outcome logs, incident payload/details/timeline, QR/session/credential, reviewer identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutIncidentProcedureSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest incident procedure read model and `timelineRolloutIncidentProcedure`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutIncidentProcedurePayload` и `reviewVisitLongitudinalTimelineRolloutIncidentProcedure`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_clinic_monitoring` downgrades to `in_review` + reason `timeline_rollout_incident_procedure_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, six checklist statuses, positive real/monitored/sampled counts, and zero unresolved incidents are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_incident_procedure.review` is aggregate-only; no pair/image/storage/patient rows/raw incident details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/incident-procedure` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutIncidentProcedure`, `VisitLongitudinalTimelineRolloutIncidentProcedurePayload`, path `/longitudinal-timeline-rollout/incident-procedure`, and `timelineRolloutIncidentProcedure` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutIncidentProcedure`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Incident procedure rollout`, copy `Incident procedure фиксирует только aggregate production outcomes · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать incident procedure` and `Утвердить clinic monitoring`; approval disabled until previous gates are ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, patient rows, raw incident/outcome/monitoring logs, storage/object/signed URL, QR/session/credential, reviewer identity, doctor-only/patient-safe text in API/UI/audit/OpenAPI examples.
- Boolean flags like `rawIncidentDetailsExposed:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто incident-procedure receipt после monitored timeline rollout; осталось real production datasets + ongoing monitoring evidence.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыто triage/escalation/rollback/owner review procedure gate; осталось clinical operations validation and reviewer governance.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, clinic monitoring blocked until procedure ready; осталось approved production analysis procedure, clinical validation, post-rollout monitoring over time.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: production outcome monitoring on real clinical datasets / incident monitoring procedure.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

# Batch BU Verification Prompt · Timeline Rollout Monitoring Outcomes

Проверь, что Batch BU синхронизирован в текущей Lovable-кодовой базе.

Ожидаемый commit:

```text
Build Batch BU timeline rollout monitoring
```

Пункт плана, который решается:

```text
production dataset validation / timeline-level QA rollout -> monitoring outcomes / rollout incident evidence
```

Проверь 14 пунктов:

| # | Проверка |
|---|---|
| 1 | HEAD содержит Batch BU commit `Build Batch BU timeline rollout monitoring`, без sync mismatch / reconnect / fallback warning. |
| 2 | Batch BT сохранён: `visit_longitudinal_timeline_rollout_evidence_reviews`, `buildReviewVisitLongitudinalTimelineRolloutEvidenceSql`, `VisitLongitudinalTimelineRolloutEvidence`, region `Evidence timeline rollout`, кнопки `Зафиксировать evidence review` / `Утвердить monitored rollout`. |
| 3 | Есть migration `backend/self-hosted/db/migrations/0071_stage5h_timeline_rollout_monitoring.sql`. |
| 4 | Migration создаёт `visit_longitudinal_timeline_rollout_monitoring_reviews` с `monitoring_status`, `monitoring_reasons`, `evidence_status`, `sop_status`, `validation_status`, `rollout_status`, five monitoring checklist statuses, monitoring/sample/incident/exception/rollback counts. |
| 5 | Migration forces `patient_delivery_allowed=false`, `medical_measurement_allowed=false`, `protected_fields_exposed=false`, `clinical_output_generated=false` и CHECK `visit_longitudinal_timeline_rollout_monitoring_metadata_no_protected_keys`. |
| 6 | Repository содержит `buildReviewVisitLongitudinalTimelineRolloutMonitoringSql`, upsert по `visit_id`, clinic-scoped, metadata-only, без pair/image/storage/clinical text. |
| 7 | `buildGetVisitLongitudinalDatasetValidationSql` включает `latest_monitoring` и field `timelineRolloutMonitoring`. |
| 8 | Service содержит `normalizeVisitLongitudinalTimelineRolloutMonitoringPayload` и `reviewVisitLongitudinalTimelineRolloutMonitoring`; protected/clinical keys отклоняются. |
| 9 | Service downgrade: requested `ready_for_production_rollout` становится `in_review` + reason `timeline_rollout_monitoring_not_ready`, если не готовы dataset validation + BR rollout + BS SOP + BT evidence + checklist/count monitoring outcomes. |
| 10 | Audit action `visit_longitudinal_timeline_rollout_monitoring.review` aggregate-only: visit/status/counts/checklist readiness/boundary flags, без pairKey/imageIds/patient rows/raw incident payload. |
| 11 | Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/monitoring` есть в `routes.mjs`, Stage `5H`, `source: "postgres"`, объявлен до generic rollout route. |
| 12 | OpenAPI содержит path `/longitudinal-timeline-rollout/monitoring`, schemas `VisitLongitudinalTimelineRolloutMonitoring` и `VisitLongitudinalTimelineRolloutMonitoringPayload`, field `timelineRolloutMonitoring` в `VisitLongitudinalDatasetValidation`. |
| 13 | Frontend client содержит `reviewSelfHostedVisitLongitudinalTimelineRolloutMonitoring`, DTO/payload types и normalizer с forced false boundary flags. |
| 14 | `VisitWorkspacePage` содержит region `Monitoring outcomes rollout`, copy `Monitoring фиксирует только aggregate outcomes · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать monitoring review` и `Утвердить production rollout`; approval disabled до готовности validation + BR rollout + BS SOP + BT evidence. |

Hygiene:

- Подтверди, что в Batch BU API/UI/audit/OpenAPI нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment, pairKey/imageIds, patient rows, raw monitoring logs, raw incident payload, object bucket/key, storage path, checksum, signed URL, QR/session/credential, reviewer identity, doctor-only text, patient-safe report text.
- Boolean boundary-флаги `*Allowed/*Exposed/*Generated` должны быть metadata, а не утечкой.

Responsive:

- `/patients/:id/visits/:id?tab=report` не получает horizontal overflow на 1280px и 390px.
- Новый block встроен в существующую `Готовность timeline QA` через compact grid/flex-wrap; нет новых широких таблиц.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: частично решено. Закрыто: production rollout monitoring outcomes после BT evidence, включая monitored/sample/incident/exception/rollback aggregate state. Осталось: проверка на реальных production datasets и outcome monitoring в реальной клинике.
- `SD-MF-026` / сравнение снимков очага: частично решено. Закрыто: post-rollout outcome/incident closure gate перед production rollout. Осталось: reviewer ops validation на реальных assets.
- `SD-MF-028` / достоверность анализа динамики: частично решено. Закрыто: dynamic conclusion остаётся выключен, production rollout блокируется до закрытия monitoring outcomes/incidents. Осталось: approved production analysis procedure + clinical validation + post-rollout incident monitoring.
- `SD-MF-046` / пациентский протокол и история новообразований: в работе. Закрыто: doctor-side metadata-only monitoring outcomes. Осталось: patient delivery off до privacy/security/retention/session/approved-copy gates.

В отчёте укажи:

```text
Sync:
Checks: 14/14 или список отсутствующих
Hygiene:
Responsive:
Покрытие мозгового штурма:
Нужна ли дополнительная синхронизация:
```

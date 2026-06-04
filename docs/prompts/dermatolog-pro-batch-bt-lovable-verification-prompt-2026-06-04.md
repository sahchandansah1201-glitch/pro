# Batch BT Verification Prompt · Timeline Rollout Evidence

Проверь, что Batch BT синхронизирован в текущей Lovable-кодовой базе.

Ожидаемый commit:

```text
Build Batch BT timeline rollout evidence
```

Пункт плана, который решается:

```text
production dataset validation / timeline-level QA rollout -> SOP monitoring / rollout evidence
```

Проверь 14 пунктов:

| # | Проверка |
|---|---|
| 1 | HEAD содержит Batch BT commit `Build Batch BT timeline rollout evidence`, без sync mismatch / reconnect / fallback warning. |
| 2 | Batch BS сохранён: `visit_longitudinal_timeline_rollout_sop_reviews`, `buildReviewVisitLongitudinalTimelineRolloutSopSql`, `VisitLongitudinalTimelineRolloutSop`, region `SOP timeline rollout`, кнопки `Зафиксировать SOP review` / `Утвердить SOP rollout`. |
| 3 | Есть migration `backend/self-hosted/db/migrations/0070_stage5h_timeline_rollout_evidence.sql`. |
| 4 | Migration создаёт `visit_longitudinal_timeline_rollout_evidence_reviews` с `evidence_status`, `evidence_reasons`, `sop_status`, `validation_status`, `rollout_status`, five checklist statuses, monitoring/sample/exception/rollback counts. |
| 5 | Migration forces `patient_delivery_allowed=false`, `medical_measurement_allowed=false`, `protected_fields_exposed=false`, `clinical_output_generated=false` и CHECK `visit_longitudinal_timeline_rollout_evidence_metadata_no_protected_keys`. |
| 6 | Repository содержит `buildReviewVisitLongitudinalTimelineRolloutEvidenceSql`, upsert по `visit_id`, clinic-scoped, metadata-only, без pair/image/storage/clinical text. |
| 7 | `buildGetVisitLongitudinalDatasetValidationSql` включает `latest_evidence` и field `timelineRolloutEvidence`. |
| 8 | Service содержит `normalizeVisitLongitudinalTimelineRolloutEvidencePayload` и `reviewVisitLongitudinalTimelineRolloutEvidence`; protected/clinical keys отклоняются. |
| 9 | Service downgrade: requested `ready_for_monitored_rollout` становится `in_review` + reason `timeline_rollout_evidence_not_ready`, если не готовы dataset validation + BR rollout + BS SOP + checklist/count evidence. |
| 10 | Audit action `visit_longitudinal_timeline_rollout_evidence.review` aggregate-only: visit/status/counts/checklist readiness/boundary flags, без pairKey/imageIds/patient rows. |
| 11 | Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/evidence` есть в `routes.mjs`, Stage `5H`, `source: "postgres"`, объявлен до generic rollout route. |
| 12 | OpenAPI содержит path `/longitudinal-timeline-rollout/evidence`, schemas `VisitLongitudinalTimelineRolloutEvidence` и `VisitLongitudinalTimelineRolloutEvidencePayload`, field `timelineRolloutEvidence` в `VisitLongitudinalDatasetValidation`. |
| 13 | Frontend client содержит `reviewSelfHostedVisitLongitudinalTimelineRolloutEvidence`, DTO/payload types и normalizer с forced false boundary flags. |
| 14 | `VisitWorkspacePage` содержит region `Evidence timeline rollout`, copy `Evidence фиксирует только aggregate monitoring · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать evidence review` и `Утвердить monitored rollout`; approval disabled до готовности validation + BR rollout + BS SOP. |

Hygiene:

- Подтверди, что в Batch BT API/UI/audit/OpenAPI нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment, pairKey/imageIds, patient rows, raw evidence logs, object bucket/key, storage path, checksum, signed URL, QR/session/credential, reviewer identity, doctor-only text, patient-safe report text.
- Boolean boundary-флаги `*Allowed/*Exposed/*Generated` должны быть metadata, а не утечкой.

Responsive:

- `/patients/:id/visits/:id?tab=report` не получает horizontal overflow на 1280px и 390px.
- Новый block встроен в существующую `Готовность timeline QA` через compact grid/flex-wrap; нет новых широких таблиц.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: частично решено. Закрыто: monitored-rollout evidence receipt после SOP. Осталось: проверка на реальных production datasets и мониторинг outcomes.
- `SD-MF-026` / сравнение снимков очага: частично решено. Закрыто: sample audit / exception log / rollback drill / owner signoff перед monitored rollout. Осталось: reviewer ops validation на реальных assets.
- `SD-MF-028` / достоверность анализа динамики: частично решено. Закрыто: dynamic conclusion остаётся выключен, rollout evidence — только operational metadata. Осталось: approved production analysis procedure + clinical validation + post-rollout incident monitoring.
- `SD-MF-046` / пациентский протокол и история новообразований: в работе. Закрыто: doctor-side metadata-only rollout evidence. Осталось: patient delivery off до privacy/security/retention/session/approved-copy gates.

В отчёте укажи:

```text
Sync:
Checks: 14/14 или список отсутствующих
Hygiene:
Responsive:
Покрытие мозгового штурма:
Нужна ли дополнительная синхронизация:
```

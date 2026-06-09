# Batch CG · Lovable Verification Prompt

Проверь синхронизацию Batch CG: `Build Batch CG production reviewer governance`.

Пункт плана: `approved reviewer-ops governance over time on production assets`.

Не исправляй код. Только проверь фактическое состояние текущего Lovable worktree и дай отчёт.

## Sync

1. Проверь `git log -1 --oneline`.
2. Если HEAD не Batch CG, но Batch CG виден в истории и файлы есть в дереве, укажи mismatch, но продолжай проверку.
3. Если Batch CG отсутствует в дереве, остановись и напиши sync warning.

## Checks

Подтверди 14 пунктов:

1. Batch CG присутствует в дереве.
2. Batch CF сохранён: `0082_stage5h_production_dataset_evidence.sql`, `buildReviewVisitLongitudinalTimelineRolloutProductionDatasetEvidenceSql`, `VisitLongitudinalTimelineRolloutProductionDatasetEvidence`, UI region `Production dataset evidence`.
3. Есть migration `backend/self-hosted/db/migrations/0083_stage5h_production_reviewer_governance.sql`.
4. Migration создаёт таблицу `visit_longitudinal_timeline_rollout_production_reviewer_governance_reviews` со status/reasons, previous-layer statuses, 7 checklist statuses и aggregate counts для production review windows, assigned reviewers, second reviews, adjudication, follow-up, exceptions, rollback, unresolved governance, blockers.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK `metadata_no_protected_keys` блокирует pairKey/imageIds/storage/signed URL/raw reviewer logs/reviewer identity/doctor text/patient text/diagnosis/risk/prognosis/treatment/measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutProductionReviewerGovernanceSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает `latest_production_reviewer_governance` и `timelineRolloutProductionReviewerGovernance`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutProductionReviewerGovernancePayload` и `reviewVisitLongitudinalTimelineRolloutProductionReviewerGovernance`; protected/clinical keys rejected.
9. Requested `ready_for_production_reviewer_governance` downgrade → `in_review` + reason `timeline_rollout_production_reviewer_governance_not_ready`, если prior gates/checklist/counts не готовы.
10. Audit action `visit_longitudinal_timeline_rollout_production_reviewer_governance.review` aggregate-only.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/production-reviewer-governance` в `routes.mjs`, response envelope Stage `5H`, source `postgres`.
12. OpenAPI содержит path, schemas `VisitLongitudinalTimelineRolloutProductionReviewerGovernance` и `VisitLongitudinalTimelineRolloutProductionReviewerGovernancePayload`, плюс поле `timelineRolloutProductionReviewerGovernance` в `VisitLongitudinalDatasetValidation`.
13. Client содержит `reviewSelfHostedVisitLongitudinalTimelineRolloutProductionReviewerGovernance`, DTO/payload types, normalizer с forced false boundary flags.
14. `VisitWorkspacePage` содержит region `Production reviewer governance`, copy `Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать production reviewer governance` / `Утвердить production reviewer governance`, approval gated by production dataset evidence.

## Hygiene

Отдельно проверь и явно напиши: нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment, pairKey/imageIds, patient rows, storage/object fields, signed URLs, QR/session/credential, reviewer identity, doctor-only/patient-safe text, raw reviewer logs in API/UI/audit/OpenAPI.

## Responsive

Проверь, что UI block встроен в existing compact-grid `Готовность timeline QA`, без новых широких таблиц и без horizontal overflow на 1280px/390px.

## Покрытие мозгового штурма

Добавь раздел:

- `SD-MF-025` · хронология снимков очага: статус, что закрыто Batch CG, что осталось.
- `SD-MF-026` · сравнение снимков: статус, что закрыто Batch CG, что осталось.
- `SD-MF-028` · достоверность динамики: статус, что закрыто Batch CG, что осталось.
- `SD-MF-046` · пациентский протокол / история новообразований: статус, что закрыто Batch CG, что осталось.

Формат ответа: краткая таблица 14/14, затем Hygiene, Responsive, Покрытие мозгового штурма, нужна ли дополнительная синхронизация.

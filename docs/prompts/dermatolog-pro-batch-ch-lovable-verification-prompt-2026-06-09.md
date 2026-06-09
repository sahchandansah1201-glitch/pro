# Batch CH Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch CH.

Expected commit title: `Build Batch CH production reviewer evidence`.

Пункт плана: reviewer-ops evidence/monitoring over time on production assets.

Проверь 14 пунктов:

1. HEAD содержит Batch CH commit, sync mismatch/reconnect/fallback warning отсутствует.
2. Batch CG сохранён: migration `0083_stage5h_production_reviewer_governance.sql`, `buildReviewVisitLongitudinalTimelineRolloutProductionReviewerGovernanceSql`, `VisitLongitudinalTimelineRolloutProductionReviewerGovernance`, UI region `Production reviewer governance`.
3. Есть migration `backend/self-hosted/db/migrations/0084_stage5h_production_reviewer_evidence.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_production_reviewer_evidence_reviews` со status/reasons, previous-layer statuses, 7 checklist statuses и aggregate counts.
5. Migration force-false boundary flags: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует pairKey/imageIds/patient rows/storage/signed URL/raw reviewer evidence logs/QR/session/credential/reviewer identity/doctor text/patient text/diagnosis/risk/prognosis/treatment/measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutProductionReviewerEvidenceSql`, upsert by `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает `latest_production_reviewer_evidence` и `timelineRolloutProductionReviewerEvidence`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutProductionReviewerEvidencePayload` и `reviewVisitLongitudinalTimelineRolloutProductionReviewerEvidence`; protected/clinical keys rejected.
9. Requested `ready_for_production_reviewer_evidence` downgrade to `in_review` + reason `timeline_rollout_production_reviewer_evidence_not_ready`, если prior gates не ready, включая `ready_for_production_reviewer_governance`.
10. Audit action `visit_longitudinal_timeline_rollout_production_reviewer_evidence.review` aggregate-only.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/production-reviewer-evidence` в `routes.mjs`, Stage 5H/postgres.
12. OpenAPI содержит schemas/path и `timelineRolloutProductionReviewerEvidence` в `VisitLongitudinalDatasetValidation`.
13. Client содержит `reviewSelfHostedVisitLongitudinalTimelineRolloutProductionReviewerEvidence`, DTO/payload/status types, normalizer с force-false boundary flags.
14. `VisitWorkspacePage` содержит region `Production reviewer evidence`, кнопки `Зафиксировать production reviewer evidence` / `Утвердить production reviewer evidence`, approval gated by `ready_for_production_reviewer_governance`.

Hygiene:
- только metadata/aggregates;
- boolean force-false flags являются boundary metadata, не утечкой;
- нет PHI/storage/raw logs/diagnosis/risk/prognosis/treatment/measurement/dynamic conclusion/patient delivery.

Responsive:
- блок встроен в existing compact-grid `Готовность timeline QA`, без horizontal overflow на 1280px/390px.

Покрытие мозгового штурма:
- `SD-MF-025`: частично решено; закрыт production reviewer evidence receipt over longitudinal production timelines; осталось long-running cross-clinic operational evidence accumulation and trend validation.
- `SD-MF-026`: частично решено; закрыт aggregate evidence layer for reviewer operations over production assets; осталось multi-clinic comparative governance and reviewer-ops trend rollups.
- `SD-MF-028`: частично решено; clinical dynamic conclusion выключен, evidence aggregate-only; осталось approved longitudinal clinical validation / production policy before clinical output.
- `SD-MF-046`: в работе; doctor-side metadata-only, patient delivery off.

В отчёте укажи:
- sync status;
- 14/14 checklist;
- hygiene;
- responsive;
- покрытие мозгового штурма;
- нужна ли дополнительная синхронизация GitHub/Lovable.

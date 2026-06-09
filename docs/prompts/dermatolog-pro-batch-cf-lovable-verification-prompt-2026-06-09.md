# Dermatolog PRO · Batch CF Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch CF: `Build Batch CF production dataset evidence`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch CF либо sync-trigger commit поверх него; если поверх Batch CF есть только технический sync commit, явно укажи оба SHA.
3. Если HEAD всё ещё Batch CE или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch CF.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch CF commit.
2. Batch CE сохранён: migration `0081_stage5h_protected_reviewer_evidence.sql`, `buildReviewVisitLongitudinalTimelineRolloutProtectedReviewerEvidenceSql`, `VisitLongitudinalTimelineRolloutProtectedReviewerEvidence`, UI region `Protected reviewer evidence`.
3. Есть migration `backend/self-hosted/db/migrations/0082_stage5h_production_dataset_evidence.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_production_dataset_evidence_reviews` с `production_dataset_evidence_status`, `production_dataset_evidence_reasons`, previous-layer statuses, seven checklist statuses, and aggregate counts for real clinic windows / monitored clinic operations / sampled clinic operations / longitudinal follow-up / protected reviewer linkage / observed outcomes / incident linkage / unresolved production dataset evidence / blockers.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, asset/patient/case identifiers, clinic-operation identifiers, longitudinal-window identifiers, storage/object/signed URL fields, raw production dataset logs, clinic-operation / longitudinal follow-up / protected reviewer linkage / outcome observation / incident linkage payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutProductionDatasetEvidenceSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest production dataset evidence read model and `timelineRolloutProductionDatasetEvidence`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutProductionDatasetEvidencePayload` и `reviewVisitLongitudinalTimelineRolloutProductionDatasetEvidence`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_production_dataset_evidence` downgrades to `in_review` + reason `timeline_rollout_production_dataset_evidence_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, post-validation monitoring, observation governance, exception governance, outcome governance, longitudinal clinical validation, protected reviewer validation, protected reviewer governance, protected reviewer evidence, seven checklist statuses, zero unresolved production dataset evidence, and zero blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_production_dataset_evidence.review` is aggregate-only; no pair/image/storage/patient rows/raw production dataset logs/reviewer identity details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/production-dataset-evidence` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutProductionDatasetEvidence`, `VisitLongitudinalTimelineRolloutProductionDatasetEvidencePayload`, path `/longitudinal-timeline-rollout/production-dataset-evidence`, and `timelineRolloutProductionDatasetEvidence` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutProductionDatasetEvidence`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Production dataset evidence`, copy `Production dataset evidence фиксирует только aggregate longitudinal evidence metadata across real clinical operations · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать production dataset evidence` and `Утвердить production dataset evidence`; approval disabled until protected reviewer evidence is ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, asset/patient/case rows, clinic-operation identifiers, longitudinal-window identifiers, raw production dataset logs, clinic-operation / longitudinal follow-up / protected reviewer linkage / outcome observation / incident linkage payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text в API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто long-running production dataset evidence receipt across real clinical operations; осталось approved reviewer-ops governance over time on production assets.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыт production evidence layer plus protected reviewer linkage over longitudinal timelines; осталось approved reviewer-ops governance over time on production assets.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; clinical dynamic conclusion выключен, production dataset evidence remains aggregate-only operational metadata; осталось approved longitudinal clinical validation plus reviewer-ops governance over time on production assets.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: long-running production dataset evidence on real clinical operations.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

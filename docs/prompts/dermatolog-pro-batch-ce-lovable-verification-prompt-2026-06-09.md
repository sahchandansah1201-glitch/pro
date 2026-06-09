# Dermatolog PRO · Batch CE Lovable Verification Prompt

Проверь синхронизацию и реализацию Batch CE: `Build Batch CE protected reviewer evidence`.

Сначала проверь sync:

1. Connected repo должен быть `sahchandansah1201-glitch/pro`, branch `main`, либо Lovable internal mirror, синхронизированный с этим repo.
2. `git log -1 --oneline` должен показывать commit Batch CE либо sync-trigger commit поверх него; если поверх Batch CE есть только технический sync commit, явно укажи оба SHA.
3. Если HEAD всё ещё Batch CD или более ранний commit, verification не запускай. Верни sync warning с latest visible SHA/title и ожидаемым Batch CE.

Если sync OK, проверь 14 пунктов:

1. HEAD/visible history содержит Batch CE commit.
2. Batch CD сохранён: migration `0080_stage5h_protected_reviewer_governance.sql`, `buildReviewVisitLongitudinalTimelineRolloutProtectedReviewerGovernanceSql`, `VisitLongitudinalTimelineRolloutProtectedReviewerGovernance`, UI region `Protected reviewer governance`.
3. Есть migration `backend/self-hosted/db/migrations/0081_stage5h_protected_reviewer_evidence.sql`.
4. Migration создаёт `visit_longitudinal_timeline_rollout_protected_reviewer_evidence_reviews` с `protected_reviewer_evidence_status`, `protected_reviewer_evidence_reasons`, previous-layer statuses, seven checklist statuses, and aggregate counts for protected review windows / monitored protected reviews / sampled protected reviews / adjudicated protected evidence / follow-up closed protected reviews / rollback drill protected reviews / archived protected reviews / unresolved protected evidence / blockers.
5. Migration force-false boundary: `patient_delivery_allowed`, `medical_measurement_allowed`, `protected_fields_exposed`, `clinical_output_generated`; CHECK блокирует `pairKey`, `imageIds`, asset/patient/case identifiers, storage/object/signed URL fields, raw protected reviewer evidence logs, reviewer monitoring / exception / adjudication / follow-up / rollback / archive payload/details, QR/session/credential, reviewer/validator identity, doctor/patient text, diagnosis/risk/prognosis/treatment, measurement/dynamic conclusion.
6. Repository содержит `buildReviewVisitLongitudinalTimelineRolloutProtectedReviewerEvidenceSql`, upsert по `visit_id`, clinic-scoped, metadata-only.
7. `buildGetVisitLongitudinalDatasetValidationSql` включает latest protected reviewer evidence read model and `timelineRolloutProtectedReviewerEvidence`.
8. Service содержит `normalizeVisitLongitudinalTimelineRolloutProtectedReviewerEvidencePayload` и `reviewVisitLongitudinalTimelineRolloutProtectedReviewerEvidence`; protected/clinical keys rejected.
9. Ready downgrade: requested `ready_for_protected_reviewer_evidence` downgrades to `in_review` + reason `timeline_rollout_protected_reviewer_evidence_not_ready` unless dataset validation, rollout, SOP, evidence, monitoring, incident procedure, clinical validation, post-validation monitoring, observation governance, exception governance, outcome governance, longitudinal clinical validation, protected reviewer validation, protected reviewer governance, seven checklist statuses, zero unresolved protected evidence, and zero blockers are satisfied.
10. Audit action `visit_longitudinal_timeline_rollout_protected_reviewer_evidence.review` is aggregate-only; no pair/image/storage/patient rows/raw protected reviewer evidence logs/reviewer identity details.
11. Route `PATCH /api/v1/visits/{visitId}/longitudinal-timeline-rollout/protected-reviewer-evidence` exists in `routes.mjs`, Stage `5H`, source `postgres`.
12. OpenAPI `openapi.stage5h.json` has schemas `VisitLongitudinalTimelineRolloutProtectedReviewerEvidence`, `VisitLongitudinalTimelineRolloutProtectedReviewerEvidencePayload`, path `/longitudinal-timeline-rollout/protected-reviewer-evidence`, and `timelineRolloutProtectedReviewerEvidence` in `VisitLongitudinalDatasetValidation`.
13. Frontend client exports `reviewSelfHostedVisitLongitudinalTimelineRolloutProtectedReviewerEvidence`, DTO/payload types, and normalizer force-false boundary flags.
14. `VisitWorkspacePage` report tab contains region `Protected reviewer evidence`, copy `Protected reviewer evidence фиксирует только aggregate monitored reviewer evidence metadata on protected assets · Clinical dynamic conclusion: выключен · Выдача пациенту: выключена`, buttons `Зафиксировать protected reviewer evidence` and `Утвердить protected reviewer evidence`; approval disabled until protected reviewer governance is ready.

Отдельно проверь hygiene:

- Нет patient delivery, medical measurement, clinical dynamic conclusion, diagnosis/risk/prognosis/treatment.
- Нет `pairKey`, `imageIds`, asset/patient/case rows, raw protected reviewer evidence logs, reviewer monitoring/exception/adjudication/follow-up/rollback/archive payload/details, storage/object/signed URL, QR/session/credential, reviewer/validator identity, doctor-only/patient-safe text в API/UI/audit/OpenAPI examples.
- Boolean flags like `patientDeliveryAllowed:false`, `medicalMeasurementAllowed:false`, `protectedFieldsExposed:false`, `clinicalOutputGenerated:false` are metadata boundary flags and are not leaks.

Responsive:

- Новый блок встроен в existing `Готовность timeline QA` compact grid/flex layout.
- Не должно быть horizontal overflow на 1280px и 390px.

Покрытие мозгового штурма:

- `SD-MF-025` / хронология снимков очага: статус `частично решено`; закрыто protected reviewer evidence receipt over time on real protected longitudinal assets; осталось long-running production dataset evidence on real clinical operations.
- `SD-MF-026` / режим сравнения снимков: статус `частично решено`; закрыт monitored reviewer evidence layer over validated protected assets; осталось approved reviewer-ops governance over time on production assets.
- `SD-MF-028` / достоверность динамики: статус `частично решено`; dynamic conclusion выключен, protected reviewer evidence remains aggregate-only operational metadata; осталось approved longitudinal clinical validation and monitored reviewer operations over time on real protected assets.
- `SD-MF-046` / пациентский протокол и история новообразований: статус `в работе`; doctor-side metadata-only, patient delivery off.

Формат ответа:

```text
Sync: HEAD = <sha> <title>; mismatch: yes/no.
Пункт плана: reviewer operations evidence over time on real protected assets.
Checks: 14/14
...
Hygiene: clean/issue.
Responsive: clean/issue.
Покрытие мозгового штурма: ...
Нужна ли дополнительная синхронизация: да/нет.
```

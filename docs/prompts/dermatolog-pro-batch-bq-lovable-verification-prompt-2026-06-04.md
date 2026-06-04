# Batch BQ Lovable Verification Prompt

Проверь синхронизацию Batch BQ `Build Batch BQ production analysis policy`.

Сначала выведи sync status:

- текущий HEAD commit SHA и message;
- есть ли sync mismatch / reconnect / fallback warning;
- виден ли commit `Build Batch BQ production analysis policy`.

Проверь 14 пунктов:

| # | Проверка |
|---|---|
| 1 | HEAD соответствует Batch BQ commit `Build Batch BQ production analysis policy`. |
| 2 | Batch BP сохранён: reviewer assignment / second review, `reviewer_assignment_required`, `second_review_required`, `Назначение reviewer`, `Assign`, `Second`. |
| 3 | Migration `0067_stage5h_production_analysis_policy_gate.sql` существует. |
| 4 | Migration добавляет `production_analysis_policy_status`, `production_analysis_policy_reasons`, `production_analysis_policy_reviewed_by_user_id`, `production_analysis_policy_reviewed_at`. |
| 5 | Migration CHECK блокирует `dynamicConclusion`, `clinicalDynamicConclusion`, diagnosis/risk/prognosis/treatment, measurement values, protected storage/object fields, QR/session/token fields, doctor/patient report text, patient delivery payload. |
| 6 | Repository содержит `buildReviewLesionComparisonProductionAnalysisPolicySql`; reviewer workflow acceptance требует `production_analysis_policy_status = 'approved_for_production_analysis'`; иначе blocker/reason `production_analysis_policy_required`. |
| 7 | Lesion longitudinal QA и visit longitudinal dataset validation возвращают `productionAnalysisPolicyNotReadyCount`, blocker `production_analysis_policy_required`, next action `approve_production_analysis_policy`. |
| 8 | Service содержит `normalizeLesionComparisonProductionAnalysisPolicyPayload`, `reviewLesionComparisonProductionAnalysisPolicy`, audit action `lesion_comparison_production_analysis_policy.review`; audit metadata aggregate-only, без pairKey/imageIds. |
| 9 | Route `PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/production-analysis-policy` объявлен до generic viewer QA routes и возвращает Stage 5H envelope. |
| 10 | OpenAPI `openapi.stage5h.json` содержит path `/production-analysis-policy`, schema `LesionComparisonProductionAnalysisPolicy`, `productionAnalysisPolicyApproved`, `productionAnalysisPolicyRequired`, `productionAnalysisPolicyNotReadyCount`. |
| 11 | Frontend client содержит `LesionComparisonProductionAnalysisPolicyPayload` и `reviewSelfHostedLesionComparisonProductionAnalysisPolicy`; normalizers forced-false для `medicalMeasurementAllowed`, `patientDeliveryAllowed`, `protectedFieldsExposed`, `clinicalOutputGenerated`. |
| 12 | `LesionDetailPage` содержит region `Production analysis policy`, кнопки `Утвердить analysis policy` / `Нужен разбор analysis policy`, copy `Clinical dynamic conclusion: выключен`, и блокирует clinical-grade workflow до approval. |
| 13 | `VisitWorkspacePage` содержит compact counter `Analysis`, per-lesion `analysis:`, action label `Утвердить analysis policy`. |
| 14 | Stage 5H guard и tests обновлены: `npm run preflight:stage5h` должен покрывать migration, repository/service/routes/client/UI/docs markers. |

Hygiene requirements:

- Нет patient delivery.
- Нет medical measurement values.
- Нет clinical dynamic conclusion output.
- Нет diagnosis/risk/prognosis/treatment copy.
- Нет pairKey/imageIds в rollup UI или audit metadata.
- Нет reviewer identity exposure.
- Нет object bucket/key, storage path, checksum, signed URL, raw image bytes.
- Нет QR/session/credential/token material.
- Нет doctor-only text или patient report text.

Responsive check:

- `/patients/:patientId/lesions/:lesionId` full-screen compare: новый блок `Production analysis policy` находится внутри существующего overflow dialog и не создаёт horizontal overflow на 1280px/390px.
- `/patients/:patientId/visits/:visitId?tab=report`: новые `Analysis` counters/fragments остаются compact и не создают horizontal overflow на 1280px/390px.

Покрытие мозгового штурма:

- `SD-MF-025` — Хронология снимков очага — частично решено: production analysis policy теперь участвует в lesion/timeline readiness. Осталось: validation на реальном production dataset и clinical operations rollout.
- `SD-MF-026` — Режим сравнения снимков — частично решено: clinical-grade workflow нельзя принять без production analysis policy. Осталось: production reviewer operations validation и approved analysis procedure.
- `SD-MF-028` — Достоверность анализа динамики — частично решено: dynamic interpretation заблокирована до policy approval; clinical dynamic conclusion остаётся выключен. Осталось: clinical validation/governance.
- `SD-MF-046` — Пациентский протокол / история новообразований — в работе: doctor-side metadata-only gate; patient delivery off до privacy/security/retention/session/approved-copy gates.

Ответь кратко:

```text
Sync: HEAD = <sha> <message>; mismatch: <yes/no>.
Checks: 14/14 или список отсутствующих пунктов.
Hygiene: clean/не clean + детали.
Responsive: clean/не clean + детали.
Покрытие мозгового штурма: кратко по SD-MF-025/026/028/046.
Дополнительная синхронизация: нужна/не нужна.
```

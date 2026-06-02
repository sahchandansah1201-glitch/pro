import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGetVisitAssessmentSql,
  buildGetVisitConclusionSql,
  buildGetLesionLongitudinalHistorySql,
  buildGetVisitReportSql,
  buildUpsertLesionComparisonDraftSql,
  buildUpsertVisitAssessmentSql,
  buildUpsertVisitConclusionSql,
  createClinicalWorkspaceRepository,
} from "./clinical-workspace-repository.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

test("Stage 5H repository builders scope assessment, conclusion and report reads", () => {
  const assessment = buildGetVisitAssessmentSql({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.match(assessment, /from clinical_assessments a/);
  assert.match(assessment, /where a\.visit_id =/);
  assert.match(assessment, /and a\.clinic_id in/);

  const conclusion = buildGetVisitConclusionSql({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.match(conclusion, /from clinical_conclusions c/);
  assert.match(conclusion, /and c\.clinic_id in/);

  const report = buildGetVisitReportSql({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.match(report, /from reports r/);
  assert.match(report, /physician_text as "physicianText"/);
});

test("Batch AW Stage 5H repository builds metadata-only lesion longitudinal history SQL", () => {
  const sql = buildGetLesionLongitudinalHistorySql({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from lesions l/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /left join clinical_assessments ca/);
  assert.match(sql, /patient_delivery_allowed/i);
  assert.match(sql, /protected_fields_exposed/i);
  assert.match(sql, /and l\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /object_bucket|object_key|checksum_sha256|signed_url\b|storage_object_path|physician_text|patient_safe_text/i,
  );
});

test("Stage 5H assessment/conclusion upserts use visit_id conflict and do not expose managed storage fields", () => {
  const assessment = buildUpsertVisitAssessmentSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      status: "ready",
      riskLevel: "moderate",
      abcdTotal: 3.7,
      sevenPointTotal: 2,
      summary: "контроль",
      recommendation: "наблюдение",
    },
  });
  assert.match(assessment, /insert into clinical_assessments/);
  assert.match(assessment, /on conflict \(visit_id\) do update/);
  assert.match(assessment, /risk_level = 'moderate'/);

  const conclusion = buildUpsertVisitConclusionSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { status: "ready", summary: "заключение", nextStep: "контроль" },
  });
  assert.match(conclusion, /insert into clinical_conclusions/);
  assert.match(conclusion, /next_step = 'контроль'/);
  assert.doesNotMatch(`${assessment}\n${conclusion}`, /storage_object_path|signed_url|access_token/i);
});

test("Stage 5H repository normalizes assessment rows", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "10000000-0000-4000-8000-000000000701",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          doctorUserId: USER_ID,
          status: "ready",
          riskLevel: "moderate",
          abcdTotal: "3.70",
          sevenPointTotal: 2,
          summary: "контроль",
          recommendation: "наблюдение",
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const assessment = await repo.getAssessment({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(assessment.visitId, VISIT_ID);
  assert.equal(assessment.abcdTotal, 3.7);
  assert.equal(assessment.sevenPointTotal, 2);
});

test("Stage 5H lesion comparison draft upsert is clinic-scoped and metadata-only", () => {
  const sql = buildUpsertLesionComparisonDraftSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    draft: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      action: "retake",
      comparability: "not_comparable",
      reasons: ["Разные условия съёмки", "Есть технические замечания"],
    },
  });

  assert.match(sql, /insert into lesion_comparison_decision_drafts/);
  assert.match(sql, /on conflict \(visit_id, lesion_id, pair_key\) do update/);
  assert.match(sql, /patient_delivery_allowed,\s+protected_fields_exposed/);
  assert.match(sql, /false,\s+false/);
  assert.match(sql, /where true and lesion_comparison_decision_drafts\.clinic_id in/);
  assert.doesNotMatch(sql, /storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion/i);
});

test("Stage 5H repository normalizes lesion comparison draft rows", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "10000000-0000-4000-8000-000000000704",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          doctorUserId: USER_ID,
          lesionId: "l-008",
          pairKey: "l-008:i-011+i-012",
          imageIds: ["i-011", "i-012"],
          action: "retake",
          comparability: "not_comparable",
          reasons: ["Разные условия съёмки"],
          patientDeliveryAllowed: true,
          protectedFieldsExposed: true,
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const draft = await repo.upsertLesionComparisonDraft({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    draft: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      action: "retake",
      comparability: "not_comparable",
      reasons: ["Разные условия съёмки"],
    },
  });

  assert.equal(draft.visitId, VISIT_ID);
  assert.deepEqual(draft.imageIds, ["i-011", "i-012"]);
  assert.equal(draft.patientDeliveryAllowed, false);
  assert.equal(draft.protectedFieldsExposed, false);
});

test("Batch AW Stage 5H repository normalizes longitudinal history with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          lesionId: "10000000-0000-4000-8000-000000000801",
          label: "Очаг A",
          bodyZone: "Плечо",
          bodySurface: "перед",
          status: "active",
          summary: {
            visitCount: 2,
            imageCount: 4,
            candidatePairCount: 2,
            comparablePairCount: 1,
            warningPairCount: 1,
            blockedPairCount: 0,
            assessmentCount: 1,
          },
          visits: [
            {
              visitId: VISIT_ID,
              startedAt: "2026-05-19T10:31:25.000Z",
              status: "signed",
              imageCount: 2,
              dermoscopyCount: 1,
              overviewCount: 1,
              assessmentCount: 1,
              capturedAtFirst: "2026-05-19T10:40:00.000Z",
              capturedAtLast: "2026-05-19T10:45:00.000Z",
            },
          ],
          candidatePairs: [
            {
              previousVisitId: "10000000-0000-4000-8000-000000000302",
              currentVisitId: VISIT_ID,
              previousImageId: "10000000-0000-4000-8000-000000000901",
              currentImageId: "10000000-0000-4000-8000-000000000902",
              kind: "dermoscopy",
              status: "warning",
              reasons: ["missing_capture_time"],
            },
          ],
          boundaries: {
            patientDeliveryAllowed: true,
            protectedFieldsExposed: true,
            storagePathsExposed: true,
            signedUrlsIssued: true,
            rawImageBytesExposed: true,
            doctorOnlyTextExposed: true,
            clinicalConclusionGenerated: true,
          },
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const history = await repo.getLesionLongitudinalHistory({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.equal(history.lesionId, "10000000-0000-4000-8000-000000000801");
  assert.equal(history.summary.visitCount, 2);
  assert.equal(history.candidatePairs[0].status, "warning");
  assert.equal(history.boundaries.patientDeliveryAllowed, false);
  assert.equal(history.boundaries.protectedFieldsExposed, false);
  assert.equal(history.boundaries.storagePathsExposed, false);
  assert.equal(history.boundaries.signedUrlsIssued, false);
  assert.equal(history.boundaries.rawImageBytesExposed, false);
  assert.equal(history.boundaries.doctorOnlyTextExposed, false);
  assert.equal(history.boundaries.clinicalConclusionGenerated, false);
});

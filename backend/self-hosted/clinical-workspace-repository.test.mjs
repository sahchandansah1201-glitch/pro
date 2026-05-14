import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGetVisitAssessmentSql,
  buildGetVisitConclusionSql,
  buildGetVisitReportSql,
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

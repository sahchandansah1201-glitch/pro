import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGetClinicalReportPackageSql,
  createClinicalReportPackageRepository,
} from "./clinical-report-package-repository.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";

test("Stage 8G-8I repository builds scoped report package SQL without protected fields", () => {
  const sql = buildGetClinicalReportPackageSql({
    visitId: VISIT_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /from visits v/);
  assert.match(sql, /from clinical_assessments a/);
  assert.match(sql, /from clinical_conclusions c/);
  assert.match(sql, /from reports r/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /and v\.clinic_id in/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token/i);
});

test("Stage 8G-8I repository normalizes readiness from safe counts and statuses", async () => {
  const repository = createClinicalReportPackageRepository({
    async queryJson() {
      return [{
        visitId: VISIT_ID,
        clinicId: CLINIC_ID,
        patientId: "10000000-0000-4000-8000-000000000201",
        visitStatus: "signed",
        assessmentId: "assessment-1",
        assessmentStatus: "ready",
        assessmentRiskLevel: "moderate",
        assessmentAbcdTotal: "3.4",
        assessmentSevenPointTotal: 2,
        assessmentSummaryPresent: true,
        assessmentRecommendationPresent: true,
        conclusionId: "conclusion-1",
        conclusionStatus: "signed",
        conclusionSummaryPresent: true,
        conclusionNextStepPresent: true,
        reportId: "report-1",
        reportStatus: "signed",
        reportPhysicianTextPresent: true,
        reportPatientSafeTextPresent: true,
        lesionCount: 2,
        assetCount: 3,
      }];
    },
  });
  const reportPackage = await repository.getReportPackage({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(reportPackage.readiness.status, "ready");
  assert.equal(reportPackage.readiness.completionPercent, 100);
  assert.deepEqual(reportPackage.readiness.missing, []);
  assert.equal(reportPackage.assessment.abcdTotal, 3.4);
  assert.equal(reportPackage.counts.assets, 3);
});

test("Stage 8G-8I repository reports missing clinical pieces as blocked", async () => {
  const repository = createClinicalReportPackageRepository({
    async queryJson() {
      return [{
        visitId: VISIT_ID,
        clinicId: CLINIC_ID,
        patientId: "10000000-0000-4000-8000-000000000201",
        visitStatus: "in_progress",
        assessmentId: null,
        conclusionId: null,
        reportId: "report-1",
        reportStatus: "draft",
        reportPhysicianTextPresent: true,
        reportPatientSafeTextPresent: false,
        lesionCount: 1,
        assetCount: 1,
      }];
    },
  });
  const reportPackage = await repository.getReportPackage({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(reportPackage.readiness.status, "blocked");
  assert.ok(reportPackage.readiness.missing.includes("assessment_missing"));
  assert.ok(reportPackage.readiness.missing.includes("patient_safe_text_missing"));
  assert.equal(reportPackage.productBoundary.externalRuntimeCalls, false);
});

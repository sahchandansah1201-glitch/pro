import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGetVisitAssessmentSql,
  buildGetVisitConclusionSql,
  buildGetLesionCaptureMetadataSql,
  buildGetLesionLongitudinalHistorySql,
  buildGetProtectedLesionImageAssetSql,
  buildGetVisitReportSql,
  buildReviewLesionComparisonViewerQaSql,
  buildUpsertAssetCaptureMetadataSql,
  buildUpsertLesionComparisonDraftSql,
  buildUpsertLesionComparisonViewerQaSql,
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

test("Batch AX Stage 5H repository builds internal protected lesion image proxy SQL", () => {
  const sql = buildGetProtectedLesionImageAssetSql({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    assetId: "10000000-0000-4000-8000-000000000901",
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /join lesions l/);
  assert.match(sql, /a\.object_bucket as "objectBucket"/);
  assert.match(sql, /a\.object_key as "objectKey"/);
  assert.match(sql, /a\.kind in \('overview_photo', 'dermoscopy'\)/);
  assert.match(sql, /a\.content_type like 'image\/%'/);
  assert.match(sql, /and a\.clinic_id in/);
  assert.doesNotMatch(sql, /signed_url\b|storage_object_path|physician_text|patient_safe_text|access_token|qrToken/i);
});

test("Batch BC Stage 5H repository builds production capture metadata SQL without protected storage fields", () => {
  const sql = buildGetLesionCaptureMetadataSql({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /clinical_asset_capture_metadata m/);
  assert.match(sql, /frame_width/);
  assert.match(sql, /scale_marker_detected/);
  assert.match(sql, /patient_delivery_allowed/i);
  assert.match(sql, /and a\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /object_bucket|object_key|checksum_sha256|signed_url\b|storage_object_path|physician_text|patient_safe_text|access_token|qrToken/i,
  );
});

test("Batch BC Stage 5H repository upserts capture metadata as metadata-only asset state", () => {
  const sql = buildUpsertAssetCaptureMetadataSql({
    visitId: VISIT_ID,
    assetId: "10000000-0000-4000-8000-000000000901",
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    capturedByUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    metadata: {
      captureSource: "device_bridge",
      deviceId: "10000000-0000-4000-8000-000000000501",
      frameWidth: 2048,
      frameHeight: 2048,
      qualityScore: 91,
      qualityIssues: [],
      scaleMarkerDetected: false,
      millimetersAvailable: false,
    },
  });

  assert.match(sql, /insert into clinical_asset_capture_metadata/);
  assert.match(sql, /on conflict \(asset_id\) do update/);
  assert.match(sql, /patient_delivery_allowed,\s+protected_fields_exposed/);
  assert.match(sql, /false,\s+false/);
  assert.match(sql, /where true and clinical_asset_capture_metadata\.clinic_id in/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token|qrToken/i);
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

test("Batch AX Stage 5H repository normalizes protected lesion image asset internally", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "10000000-0000-4000-8000-000000000901",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          lesionId: "10000000-0000-4000-8000-000000000801",
          kind: "dermoscopy",
          contentType: "image/png",
          byteSize: "12",
          capturedAt: "2026-05-19T10:40:00.000Z",
          objectBucket: "clinical-assets",
          objectKey: "clinics/demo/protected.png",
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const asset = await repo.getProtectedLesionImageAsset({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    assetId: "10000000-0000-4000-8000-000000000901",
    clinicIds: [CLINIC_ID],
  });

  assert.equal(asset.id, "10000000-0000-4000-8000-000000000901");
  assert.equal(asset.contentType, "image/png");
  assert.equal(asset.objectBucket, "clinical-assets");
  assert.equal(asset.objectKey, "clinics/demo/protected.png");
  assert.equal(asset.patientDeliveryAllowed, false);
  assert.equal(asset.signedUrlsIssued, false);
  assert.equal(asset.storagePathsExposed, false);
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

test("Batch BD Stage 5H viewer QA upsert is clinic-scoped and disables medical measurement", () => {
  const sql = buildUpsertLesionComparisonViewerQaSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    qa: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
      calibrationStatus: "not_ready",
      calibrationReasons: ["scale_marker_missing"],
      captureMetadataStatus: "needs_review",
    },
  });

  assert.match(sql, /insert into lesion_comparison_viewer_qa_drafts/);
  assert.match(sql, /from lesions l/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /a\.id::text = any/);
  assert.match(sql, /a\.kind in \('overview_photo', 'dermoscopy'\)/);
  assert.match(sql, /a\.content_type like 'image\/%'/);
  assert.match(sql, /where a\.asset_count = 2/);
  assert.match(sql, /on conflict \(visit_id, lesion_id, pair_key\) do update/);
  assert.match(sql, /medical_measurement_allowed,\s+patient_delivery_allowed,\s+protected_fields_exposed/);
  assert.match(sql, /false,\s+false,\s+false/);
  assert.match(sql, /and l\.clinic_id in/);
  assert.match(sql, /and a\.clinic_id in/);
  assert.match(sql, /where true and lesion_comparison_viewer_qa_drafts\.clinic_id in/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion|qrToken/i);
});

test("Batch BE Stage 5H viewer QA review updates an existing metadata-only draft", () => {
  const sql = buildReviewLesionComparisonViewerQaSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    review: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      reviewStatus: "needs_recapture",
      reviewReasons: ["repeat_capture_required"],
    },
  });

  assert.match(sql, /update lesion_comparison_viewer_qa_drafts q/);
  assert.match(sql, /from lesions l/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /review_status = 'needs_recapture'/);
  assert.match(sql, /review_reasons = '\["repeat_capture_required"\]'::jsonb/);
  assert.match(sql, /reviewed_by_user_id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.match(sql, /reviewed_at = now\(\)/);
  assert.match(sql, /medical_measurement_allowed = false/);
  assert.match(sql, /patient_delivery_allowed = false/);
  assert.match(sql, /protected_fields_exposed = false/);
  assert.match(sql, /and q\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /object_bucket|object_key|storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion|qrToken|sessionId|doctorVersionText|patientSafeText/i,
  );
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

test("Batch BE Stage 5H repository normalizes viewer QA review with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "viewer-qa-1",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          doctorUserId: USER_ID,
          lesionId: "l-008",
          pairKey: "l-008:i-011+i-012",
          imageIds: ["i-011", "i-012"],
          technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
          calibrationStatus: "not_ready",
          calibrationReasons: ["scale_marker_missing"],
          captureMetadataStatus: "needs_review",
          reviewStatus: "needs_recapture",
          reviewReasons: ["repeat_capture_required"],
          reviewedByUserId: USER_ID,
          reviewedAt: "2026-05-19T10:50:00.000Z",
          medicalMeasurementAllowed: true,
          patientDeliveryAllowed: true,
          protectedFieldsExposed: true,
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const qa = await repo.reviewLesionComparisonViewerQa({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    review: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      reviewStatus: "needs_recapture",
      reviewReasons: ["repeat_capture_required"],
    },
  });

  assert.equal(qa.review.status, "needs_recapture");
  assert.deepEqual(qa.review.reasons, ["repeat_capture_required"]);
  assert.equal(qa.review.reviewedByUserId, USER_ID);
  assert.equal(qa.medicalMeasurementAllowed, false);
  assert.equal(qa.patientDeliveryAllowed, false);
  assert.equal(qa.protectedFieldsExposed, false);
});

test("Batch BC Stage 5H repository normalizes capture metadata with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          lesionId: "10000000-0000-4000-8000-000000000801",
          summary: {
            assetCount: 2,
            metadataCount: 1,
            missingMetadataCount: 1,
            readyForTechnicalCompareCount: 1,
            scaleReadyCount: 0,
          },
          items: [
            {
              assetId: "10000000-0000-4000-8000-000000000901",
              visitId: VISIT_ID,
              kind: "dermoscopy",
              contentType: "image/png",
              capturedAt: "2026-05-19T10:40:00.000Z",
              captureSource: "device_bridge",
              deviceId: "10000000-0000-4000-8000-000000000501",
              deviceProfile: "FotoFinder Handyscope · FF-screen",
              frameWidth: 2048,
              frameHeight: 2048,
              qualityScore: "91.00",
              qualityIssues: [],
              scaleMarkerDetected: false,
              millimetersAvailable: false,
              technicalStatus: "ready",
              technicalReasons: [],
            },
          ],
          boundaries: {
            patientDeliveryAllowed: true,
            protectedFieldsExposed: true,
            storagePathsExposed: true,
            signedUrlsIssued: true,
            rawImageBytesExposed: true,
          },
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const metadata = await repo.getLesionCaptureMetadata({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.equal(metadata.summary.assetCount, 2);
  assert.equal(metadata.items[0].frame.width, 2048);
  assert.equal(metadata.items[0].quality.score, 91);
  assert.equal(metadata.items[0].calibration.millimetersAvailable, false);
  assert.equal(metadata.boundaries.patientDeliveryAllowed, false);
  assert.equal(metadata.boundaries.storagePathsExposed, false);
});

test("Batch BD Stage 5H repository normalizes viewer QA drafts with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "10000000-0000-4000-8000-000000000705",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          doctorUserId: USER_ID,
          lesionId: "l-008",
          pairKey: "l-008:i-011+i-012",
          imageIds: ["i-011", "i-012"],
          technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
          calibrationStatus: "not_ready",
          calibrationReasons: ["scale_marker_missing"],
          captureMetadataStatus: "needs_review",
          medicalMeasurementAllowed: true,
          patientDeliveryAllowed: true,
          protectedFieldsExposed: true,
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const qa = await repo.upsertLesionComparisonViewerQa({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    qa: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
      calibrationStatus: "not_ready",
      calibrationReasons: ["scale_marker_missing"],
      captureMetadataStatus: "needs_review",
    },
  });

  assert.equal(qa.visitId, VISIT_ID);
  assert.deepEqual(qa.technicalMarkers, [{ target: "A", xPercent: 48, yPercent: 52 }]);
  assert.equal(qa.medicalMeasurementAllowed, false);
  assert.equal(qa.patientDeliveryAllowed, false);
  assert.equal(qa.protectedFieldsExposed, false);
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

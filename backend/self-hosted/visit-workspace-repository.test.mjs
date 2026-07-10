import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildListVisitsByPatientSql,
  buildGetVisitSql,
  buildListVisitLesionsSql,
  buildListVisitAssetsSql,
  createVisitWorkspaceRepository,
} from "./visit-workspace-repository.mjs";

const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";

test("buildListVisitsByPatientSql scopes to clinic ids", () => {
  const sql = buildListVisitsByPatientSql({
    patientId: PATIENT_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /from visits v/);
  assert.match(sql, new RegExp(`v\\.patient_id = '${PATIENT_ID}'::uuid`));
  assert.match(sql, new RegExp(`v\\.clinic_id in \\('${CLINIC_ID}'::uuid\\)`));
  assert.match(sql, /jsonb_agg\(row_to_json\(result\) order by result\."startedAt" desc nulls last\)/);
});

test("buildListVisitsByPatientSql denies access without clinic scope", () => {
  const sql = buildListVisitsByPatientSql({ patientId: PATIENT_ID, clinicIds: [] });
  assert.match(sql, /and false/);
});

test("buildGetVisitSql joins patient and clinic for detail rendering", () => {
  const sql = buildGetVisitSql({
    visitId: VISIT_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /join patients p/);
  assert.match(sql, /join clinics c/);
  assert.match(sql, new RegExp(`v\\.id = '${VISIT_ID}'::uuid`));
});

test("buildListVisitLesionsSql filters by visit id", () => {
  const sql = buildListVisitLesionsSql({
    visitId: VISIT_ID,
    allClinics: true,
  });
  assert.match(sql, /from lesions l/);
  assert.match(sql, new RegExp(`l\\.visit_id = '${VISIT_ID}'::uuid`));
  assert.doesNotMatch(sql, /and l\.clinic_id in/);
  assert.match(sql, /jsonb_agg\(row_to_json\(result\) order by result\."createdAt" asc\)/);
});

test("buildListVisitAssetsSql exposes only metadata, never object paths", () => {
  const sql = buildListVisitAssetsSql({
    visitId: VISIT_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /clinical_asset_capture_metadata m/);
  assert.match(sql, /coalesce\(m\.capture_source, 'file_import'\) as "captureSource"/);
  assert.doesNotMatch(sql, /object_bucket|object_key|checksum/);
  assert.match(sql, /a\.kind/);
  assert.match(sql, /a\.captured_at/);
  assert.match(sql, /jsonb_agg\(row_to_json\(result\) order by result\."capturedAt" asc nulls last\)/);
});

test("createVisitWorkspaceRepository normalizes rows from queryJson", async () => {
  const calls = [];
  const dbClient = {
    async queryJson(sql) {
      calls.push(sql);
      if (sql.includes("from visits v\n  where")) {
        return [
          {
            id: VISIT_ID,
            clinicId: CLINIC_ID,
            patientId: PATIENT_ID,
            doctorUserId: "10000000-0000-4000-8000-000000000101",
            status: "in_progress",
            startedAt: "2026-05-12T09:00:00.000Z",
            signedAt: null,
            chiefComplaint: "follow-up",
            createdAt: "2026-05-12T09:00:00.000Z",
            updatedAt: "2026-05-12T09:00:00.000Z",
          },
        ];
      }
      if (sql.includes("join patients p")) {
        return [
          {
            id: VISIT_ID,
            clinicId: CLINIC_ID,
            patientId: PATIENT_ID,
            doctorUserId: null,
            status: "in_progress",
            startedAt: "2026-05-12T09:00:00.000Z",
            signedAt: null,
            chiefComplaint: null,
            createdAt: "2026-05-12T09:00:00.000Z",
            updatedAt: "2026-05-12T09:00:00.000Z",
            patientFullName: "Demo Patient One",
            patientCode: "DP-DEMO-0001",
            clinicSlug: "demo-clinic",
            clinicName: "Dermatolog Pro Demo Clinic",
          },
        ];
      }
      if (sql.includes("from lesions l")) {
        return [
          {
            id: "lesion-1",
            clinicId: CLINIC_ID,
            patientId: PATIENT_ID,
            visitId: VISIT_ID,
            label: "L1",
            bodyZone: "спина",
            bodySurface: null,
            status: "active",
            riskLevel: "moderate",
            createdAt: "2026-05-12T09:00:00.000Z",
            updatedAt: "2026-05-12T09:00:00.000Z",
          },
        ];
      }
      if (sql.includes("from clinical_assets a")) {
        return [
          {
            id: "asset-1",
            clinicId: CLINIC_ID,
            patientId: PATIENT_ID,
            visitId: VISIT_ID,
            lesionId: "lesion-1",
            kind: "dermoscopy",
            contentType: "image/jpeg",
            byteSize: 1024,
            capturedAt: "2026-05-12T09:00:00.000Z",
            uploadedBy: "10000000-0000-4000-8000-000000000101",
            createdAt: "2026-05-12T09:00:00.000Z",
            captureSource: "device_bridge",
          },
        ];
      }
      return [];
    },
  };
  const repo = createVisitWorkspaceRepository(dbClient);

  const visits = await repo.listVisitsByPatient({ patientId: PATIENT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(visits[0].status, "in_progress");

  const visit = await repo.getVisit({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(visit.patient.fullName, "Demo Patient One");
  assert.equal(visit.clinic.slug, "demo-clinic");

  const lesions = await repo.listVisitLesions({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(lesions[0].riskLevel, "moderate");

  const assets = await repo.listVisitAssets({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(assets[0].kind, "dermoscopy");
  assert.equal(assets[0].byteSize, 1024);
  assert.equal(assets[0].captureSource, "device_bridge");

  assert.equal(calls.length, 4);
});

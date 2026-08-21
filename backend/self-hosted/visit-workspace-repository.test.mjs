import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildListVisitsByPatientSql,
  buildGetLesionContextSql,
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
  assert.match(sql, /p\.birth_date as "patientBirthDate"/);
  assert.match(sql, /p\.sex as "patientSex"/);
  assert.match(sql, /p\.phototype as "patientPhototype"/);
  assert.match(sql, /p\.imaging_consent as "patientImagingConsent"/);
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
  assert.match(sql, /l\.body_region_id as "bodyRegionId"/);
  assert.match(sql, /l\.body_map_x::float8 as "bodyMapX"/);
  assert.match(sql, /l\.body_atlas_source as "bodyAtlasSource"/);
  assert.match(sql, /l\.body_region_map_sha256 as "bodyRegionMapSha256"/);
  assert.match(sql, /and l\.deleted_at is null/);
  assert.match(sql, /jsonb_agg\(row_to_json\(result\) order by result\."createdAt" asc\)/);
});

test("buildGetLesionContextSql derives the scoped patient profile at visit time", () => {
  const sql = buildGetLesionContextSql({ lesionId: "10000000-0000-4000-8000-000000000401", clinicIds: [CLINIC_ID] });
  assert.match(sql, /from lesions l/);
  assert.match(sql, /join visits v on v\.id = l\.visit_id/);
  assert.match(sql, /join patients p on p\.id = l\.patient_id/);
  assert.match(sql, /p\.birth_date as "patientBirthDate"/);
  assert.match(sql, /p\.sex as "patientSex"/);
  assert.match(sql, /v\.started_at as "startedAt"/);
  assert.match(sql, /and l\.clinic_id in/);
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
            patientBirthDate: "1990-01-02",
            patientSex: "male",
            patientPhototype: "III",
            patientImagingConsent: true,
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
            bodyMapView: "front",
            bodyMapX: 0.35083,
            bodyMapY: 0.99001,
            bodyRegionId: "front-right-toes",
            bodyRegionDetailId: "digit-5",
            bodyAtlasSource: "makehuman-cc0",
            bodyAtlasProfileId: "adult_female_30",
            bodyAtlasManifestSha256: "a".repeat(64),
            bodyRegionMapSha256: "b".repeat(64),
            placementRevision: 1,
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
  assert.equal(visit.patient.birthDate, "1990-01-02");
  assert.equal(visit.patient.sex, "male");
  assert.equal(visit.patient.phototype, "III");
  assert.equal(visit.patient.imagingConsent, true);
  assert.equal(visit.clinic.slug, "demo-clinic");

  const lesions = await repo.listVisitLesions({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(lesions[0].riskLevel, "moderate");
  assert.deepEqual(lesions[0].mapPoint, { view: "front", x: 0.35083, y: 0.99001 });
  assert.equal(lesions[0].bodyRegionDetailId, "digit-5");
  assert.equal(lesions[0].bodyAtlasSource, "makehuman-cc0");
  assert.equal(lesions[0].bodyAtlasProfileId, "adult_female_30");
  assert.equal(lesions[0].bodyAtlasManifestSha256, "a".repeat(64));
  assert.equal(lesions[0].bodyRegionMapSha256, "b".repeat(64));

  const assets = await repo.listVisitAssets({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(assets[0].kind, "dermoscopy");
  assert.equal(assets[0].byteSize, 1024);
  assert.equal(assets[0].captureSource, "device_bridge");

  assert.equal(calls.length, 4);
});

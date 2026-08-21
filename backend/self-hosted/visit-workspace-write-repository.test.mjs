import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildArchiveLesionSql,
  buildCreateLesionSql,
  buildUpdateLesionSql,
  buildUpdateVisitSql,
  buildUpsertReportSql,
  createVisitWorkspaceWriteRepository,
  LesionIdempotencyConflictError,
  LesionPlacementConflictError,
} from "./visit-workspace-write-repository.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const LESION_ID = "10000000-0000-4000-8000-000000000401";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

test("buildUpdateVisitSql scopes visit update and escapes text", () => {
  const sql = buildUpdateVisitSql({
    visitId: VISIT_ID,
    changes: { status: "in_progress", chiefComplaint: "контроль 'невуса'" },
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /update visits v/);
  assert.match(sql, /status = 'in_progress'::visit_status/);
  assert.match(sql, /chief_complaint = 'контроль ''невуса'''/);
  assert.match(sql, /and v\.clinic_id in/);
  assert.match(sql, /^with updated as \(/);
});

test("buildCreateVisitLesionSql inserts from scoped visit", () => {
  const sql = buildCreateLesionSql({
    visitId: VISIT_ID,
    patientId: "10000000-0000-4000-8000-000000000201",
    clinicId: CLINIC_ID,
    label: "L1",
    bodyZone: "спина",
    status: "active",
    riskLevel: "moderate",
    bodyMap: {
      atlasSource: "makehuman-cc0",
      atlasProfileId: "adult_female_30",
      atlasManifestSha256: "a".repeat(64),
      bodyRegionMapSha256: "b".repeat(64),
      view: "front",
      x: 0.35083,
      y: 0.96001,
      regionId: "front-right-toes",
      detailId: "digit-5",
    },
    idempotencyKey: "019ffbca-f316-7f81-80db-9e1792daa4d5",
    requestHash: "a".repeat(64),
    auditEvent: {
      actorUserId: USER_ID,
      correlationId: "c-map",
      metadata: { bodyRegionId: "front-right-toes", placementRevision: 1 },
    },
  });
  assert.match(sql, /insert into lesions/);
  assert.match(sql, /clinic_id, patient_id, visit_id/);
  assert.match(sql, /'moderate'/);
  assert.match(sql, /body_map_view, body_map_x, body_map_y, body_region_id/);
  assert.match(sql, /body_atlas_source, body_atlas_profile_id/);
  assert.match(sql, /body_atlas_manifest_sha256, body_region_map_sha256/);
  assert.match(sql, /creation_idempotency_key, creation_request_hash/);
  assert.match(sql, /insert into audit_log/);
  assert.match(sql, /'lesion\.create'/);
});

test("lesion update and archive use soft archive constraints", () => {
  const update = buildUpdateLesionSql({
    lesionId: LESION_ID,
    changes: {
      label: "L2",
      riskLevel: null,
      expectedPlacementRevision: 1,
      bodyMap: {
        atlasSource: "makehuman-cc0",
        atlasProfileId: "adult_female_30",
        atlasManifestSha256: "a".repeat(64),
        bodyRegionMapSha256: "b".repeat(64),
        view: "back",
        x: 0.45,
        y: 0.84,
        regionId: "back-left-calf",
        detailId: null,
      },
    },
    clinicIds: [CLINIC_ID],
    auditEvent: {
      actorUserId: USER_ID,
      correlationId: "c-update",
      metadata: { bodyRegionId: "back-left-calf", placementRevision: 2 },
    },
  });
  assert.match(update, /update lesions l/);
  assert.match(update, /and l\.deleted_at is null/);
  assert.match(update, /risk_level = null/);
  assert.match(update, /placement_revision = l\.placement_revision \+ 1/);
  assert.match(update, /body_atlas_profile_id = 'adult_female_30'/);
  assert.match(update, /body_region_map_sha256 = '[b]{64}'/);
  assert.match(update, /and l\.placement_revision = 1/);
  assert.match(update, /true as "placementConflict"/);
  assert.match(update, /insert into audit_log/);
  assert.match(update, /'lesion\.update'/);

  const archive = buildArchiveLesionSql({
    lesionId: LESION_ID,
    clinicIds: [CLINIC_ID],
    auditEvent: {
      actorUserId: USER_ID,
      correlationId: "c-archive",
      metadata: { softDelete: true },
    },
  });
  assert.match(archive, /set deleted_at = now\(\)/);
  assert.match(archive, /and l\.deleted_at is null/);
  assert.match(archive, /insert into audit_log/);
  assert.match(archive, /'lesion\.archive'/);
});

test("repository exposes an optimistic placement conflict instead of a false not-found", async () => {
  const dbClient = {
    async queryJson() {
      return [{ id: LESION_ID, placementRevision: 2, placementConflict: true }];
    },
  };
  const repo = createVisitWorkspaceWriteRepository(dbClient);
  await assert.rejects(
    () => repo.updateLesion({
      lesionId: LESION_ID,
      changes: {
        expectedPlacementRevision: 1,
        bodyMap: {
          atlasSource: "makehuman-cc0",
          atlasProfileId: "adult_female_30",
          atlasManifestSha256: "a".repeat(64),
          bodyRegionMapSha256: "b".repeat(64),
          view: "front",
          x: 0.4,
          y: 0.6,
          regionId: "front-face",
          detailId: null,
        },
      },
    }),
    LesionPlacementConflictError,
  );
});

test("repository replays the same body-map create and rejects key reuse with a different hash", async () => {
  const stored = {
    id: LESION_ID,
    clinicId: CLINIC_ID,
    visitId: VISIT_ID,
    label: "L1",
    bodyMapView: "front",
    bodyMapX: 0.35,
    bodyMapY: 0.99,
    bodyRegionId: "front-right-toes",
    placementRevision: 1,
    creationRequestHash: "a".repeat(64),
  };
  const dbClient = { async queryJson() { return [stored]; } };
  const repo = createVisitWorkspaceWriteRepository(dbClient);
  const replayed = await repo.createLesion({
    clinicId: CLINIC_ID,
    visitId: VISIT_ID,
    idempotencyKey: "019ffbca-f316-7f81-80db-9e1792daa4d5",
    requestHash: "a".repeat(64),
  });
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.lesion.mapPoint.x, 0.35);
  await assert.rejects(
    () => repo.createLesion({
      clinicId: CLINIC_ID,
      visitId: VISIT_ID,
      idempotencyKey: "019ffbca-f316-7f81-80db-9e1792daa4d5",
      requestHash: "b".repeat(64),
    }),
    LesionIdempotencyConflictError,
  );
});

test("buildUpsertVisitReportSql uses visit_id conflict", () => {
  const sql = buildUpsertReportSql({
    visitId: VISIT_ID,
    doctorUserId: USER_ID,
    patientId: "10000000-0000-4000-8000-000000000201",
    clinicId: CLINIC_ID,
    changes: { status: "draft", physicianText: "для врача", patientSafeText: "для пациента" },
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /insert into reports/);
  assert.match(sql, /on conflict \(visit_id\) do nothing/);
  assert.match(sql, /update reports r/);
  assert.match(sql, /^with upserted as \(/);
  assert.doesNotMatch(sql, /storage_object_path|object_key|access_token/i);
});

test("createVisitWorkspaceWriteRepository normalizes queryJson rows", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: VISIT_ID,
          clinicId: CLINIC_ID,
          patientId: "10000000-0000-4000-8000-000000000201",
          doctorUserId: USER_ID,
          status: "in_progress",
          chiefComplaint: "контроль",
          startedAt: null,
          signedAt: null,
          createdAt: "2026-05-13T00:00:00.000Z",
          updatedAt: "2026-05-13T00:00:00.000Z",
        },
      ];
    },
  };
  const repo = createVisitWorkspaceWriteRepository(dbClient);
  const visit = await repo.updateVisit({ visitId: VISIT_ID, changes: { chiefComplaint: "контроль" } });
  assert.equal(visit.id, VISIT_ID);
  assert.equal(visit.chiefComplaint, "контроль");
});

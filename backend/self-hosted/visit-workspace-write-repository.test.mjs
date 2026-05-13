import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildArchiveLesionSql,
  buildCreateLesionSql,
  buildUpdateLesionSql,
  buildUpdateVisitSql,
  buildUpsertReportSql,
  createVisitWorkspaceWriteRepository,
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
  });
  assert.match(sql, /insert into lesions/);
  assert.match(sql, /clinic_id, patient_id, visit_id/);
  assert.match(sql, /'moderate'/);
});

test("lesion update and archive use soft archive constraints", () => {
  const update = buildUpdateLesionSql({
    lesionId: LESION_ID,
    changes: { label: "L2", riskLevel: null },
    clinicIds: [CLINIC_ID],
  });
  assert.match(update, /update lesions l/);
  assert.match(update, /and l\.deleted_at is null/);
  assert.match(update, /risk_level = null/);

  const archive = buildArchiveLesionSql({ lesionId: LESION_ID, clinicIds: [CLINIC_ID] });
  assert.match(archive, /set deleted_at = now\(\)/);
  assert.match(archive, /and l\.deleted_at is null/);
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

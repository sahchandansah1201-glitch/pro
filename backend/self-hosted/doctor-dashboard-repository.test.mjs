import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDoctorDashboardSql,
  createDoctorDashboardRepository,
  normalizeDoctorDashboard,
} from "./doctor-dashboard-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

test("Stage 5I dashboard SQL aggregates only safe self-hosted tables", () => {
  const sql = buildDoctorDashboardSql({
    clinicIds: [CLINIC_ID],
    doctorUserId: USER_ID,
  });

  assert.match(sql, /from visits v/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /from medical_devices d/);
  assert.match(sql, /doctor_user_id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.match(sql, /doctor\.dashboard|dashboard/i);
  assert.doesNotMatch(sql, /object_key|object_bucket|password_hash|access_token|signed_url|storage_object_path/i);
  assert.doesNotMatch(sql, /supabase|api-read|api-write|edge function/i);
});

test("Stage 5I repository normalizes dashboard rows", async () => {
  const repository = createDoctorDashboardRepository({
    async queryJson(sql) {
      assert.match(sql, /scoped_visits/);
      return [
        {
          kpis: {
            visitsToday: 1,
            activeVisits: "2",
            awaitingConclusion: 3,
            patientsInScope: 4,
            assetsNeedReview: 5,
            devicesTotal: 6,
            devicesActive30d: 7,
          },
          upcoming: [
            {
              id: "visit-1",
              patientId: "patient-1",
              patientFullName: "Patient One",
              patientCode: "DP-1",
              status: "in_progress",
              startedAt: "2026-05-15T09:00:00Z",
            },
          ],
          awaitingConclusions: [],
          recentPatients: [
            {
              id: "patient-1",
              fullName: "Patient One",
              code: "DP-1",
              birthDate: "1984-02-14",
              sex: "female",
              lastVisitAt: "2026-05-15T09:00:00Z",
            },
          ],
          assetIssues: [
            {
              id: "asset-1",
              visitId: "visit-1",
              patientId: "patient-1",
              patientFullName: "Patient One",
              kind: "dermoscopy",
              contentType: "image/png",
              byteSize: null,
              issue: "size_missing",
            },
          ],
          devices: [{ id: "device-1", model: "DermLite", serial: "DL-1", status: "active" }],
        },
      ];
    },
  });

  const dashboard = await repository.getDashboard({ clinicIds: [CLINIC_ID] });
  assert.equal(dashboard.kpis.activeVisits, 2);
  assert.equal(dashboard.upcoming[0].patientFullName, "Patient One");
  assert.equal(dashboard.recentPatients[0].sex, "female");
  assert.equal(dashboard.assetIssues[0].issue, "size_missing");
  assert.equal(dashboard.devices[0].model, "DermLite");
});

test("Stage 5I normalizer returns an empty safe dashboard by default", () => {
  const dashboard = normalizeDoctorDashboard();
  assert.deepEqual(dashboard.kpis, {
    visitsToday: 0,
    activeVisits: 0,
    awaitingConclusion: 0,
    patientsInScope: 0,
    assetsNeedReview: 0,
    devicesTotal: 0,
    devicesActive30d: 0,
  });
  assert.deepEqual(dashboard.upcoming, []);
  assert.deepEqual(dashboard.devices, []);
});

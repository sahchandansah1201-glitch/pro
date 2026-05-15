import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildExternalIntakeImportBatchesSql,
  buildImportExternalIntakeSql,
  normalizeExternalIntakeImportBatch,
  normalizeExternalIntakeImportBatches,
  normalizeExternalIntakeImportParams,
} from "./external-intake-import-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const ACTOR_ID = "10000000-0000-4000-8000-000000000101";

test("Stage 5Q import SQL creates local booking requests, slots and metadata batch", () => {
  const sql = buildImportExternalIntakeSql({
    clinicId: CLINIC_ID,
    actorUserId: ACTOR_ID,
    sourceSystem: "clinic_crm",
    sourceReference: "daily-import",
    items: [
      {
        kind: "booking_request",
        externalId: "crm-request-1",
        patientCode: "DP-2026-0001",
        preferredFrom: "2026-06-01T09:00:00.000Z",
        reason: "Плановый контроль",
      },
      {
        kind: "available_slot",
        externalId: "slot-1",
        startedAt: "2026-06-01T10:00:00.000Z",
        durationMinutes: 30,
      },
    ],
  });

  assert.match(sql, /external_booking_import_batches/);
  assert.match(sql, /patient_portal_booking_requests/);
  assert.match(sql, /clinic_available_slots/);
  assert.match(sql, /jsonb_to_recordset/);
  assert.match(sql, /storedRawPayload/);
  assert.doesNotMatch(sql, /api-read|api-write|edge function|SUPABASE_|https:\/\//i);
});

test("Stage 5Q list SQL scopes batches by clinic and source system", () => {
  const sql = buildExternalIntakeImportBatchesSql({
    clinicIds: [CLINIC_ID],
    allClinics: false,
    sourceSystem: "ads",
    limit: 5,
  });

  assert.match(sql, /from external_booking_import_batches b/);
  assert.match(sql, /b\.clinic_id in/);
  assert.match(sql, /b\.source_system = 'ads'/);
  assert.match(sql, /limit 5/);
});

test("Stage 5Q normalizers sanitize params and rows", () => {
  const params = normalizeExternalIntakeImportParams(
    new URLSearchParams({
      sourceSystem: "DROP TABLE",
      limit: "9999",
      offset: "-10",
    }),
  );
  assert.equal(params.sourceSystem, "all");
  assert.equal(params.limit, 100);
  assert.equal(params.offset, 0);

  const batch = normalizeExternalIntakeImportBatch({
    id: "batch-1",
    sourceSystem: "clinic_crm",
    itemCount: "3",
    acceptedBookingCount: "1",
    acceptedSlotCount: 1,
    rejectedCount: "1",
    summary: { storedRawPayload: false },
  });
  assert.equal(batch.id, "batch-1");
  assert.equal(batch.itemCount, 3);
  assert.equal(batch.summary.storedRawPayload, false);

  const page = normalizeExternalIntakeImportBatches({
    items: [batch],
    count: "1",
    limit: "10",
    offset: "0",
    filters: { sourceSystem: "clinic_crm" },
  });
  assert.equal(page.items.length, 1);
  assert.equal(page.filters.sourceSystem, "clinic_crm");
});

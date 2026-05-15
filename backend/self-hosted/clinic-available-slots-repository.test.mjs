import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildClinicAvailableSlotsSql,
  createClinicAvailableSlotsRepository,
  normalizeClinicAvailableSlotParams,
  normalizeClinicAvailableSlots,
} from "./clinic-available-slots-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";

test("Stage 5R repository builds scoped local slot SQL with filters", () => {
  const sql = buildClinicAvailableSlotsSql({
    clinicIds: [CLINIC_ID],
    sourceSystem: "clinic_crm",
    status: "available",
    dateFrom: "2026-06-01T00:00:00.000Z",
    dateTo: "2026-06-02T00:00:00.000Z",
    limit: 10,
  });

  assert.match(sql, /clinic_available_slots/);
  assert.match(sql, /source_system = 'clinic_crm'/);
  assert.match(sql, /status = 'available'/);
  assert.match(sql, /started_at >= '2026-06-01T00:00:00.000Z'::timestamptz/);
  assert.match(sql, /clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assert.doesNotMatch(sql, /api-read|api-write|edge function|SUPABASE_|https?:\/\//i);
});

test("Stage 5R repository normalizes params and slot DTOs", () => {
  const params = normalizeClinicAvailableSlotParams(new URLSearchParams({
    sourceSystem: "clinic_crm",
    status: "held",
    dateFrom: "bad-date",
    limit: "999",
    offset: "2",
  }));

  assert.equal(params.sourceSystem, "clinic_crm");
  assert.equal(params.status, "held");
  assert.equal(params.dateFrom, null);
  assert.equal(params.limit, 100);
  assert.equal(params.offset, 2);

  const page = normalizeClinicAvailableSlots({
    items: [{
      id: "slot-1",
      clinicId: CLINIC_ID,
      sourceSystem: "clinic_crm",
      externalSlotId: "crm-slot-1",
      startedAt: "2026-06-01T09:00:00.000Z",
      durationMinutes: "30",
      status: "available",
      clinicName: "Live Clinic",
      doctorDisplayName: "Dr Live",
    }],
    count: "1",
    filters: { sourceSystem: "clinic_crm", status: "available" },
  });

  assert.equal(page.items[0].id, "slot-1");
  assert.equal(page.items[0].durationMinutes, 30);
  assert.equal(page.items[0].clinic.name, "Live Clinic");
  assert.equal(page.items[0].doctor.displayName, "Dr Live");
});

test("Stage 5R repository executes through queryJson", async () => {
  const repository = createClinicAvailableSlotsRepository({
    async queryJson(sql) {
      assert.match(sql, /clinic_available_slots/);
      return [{
        items: [{ id: "slot-1", sourceSystem: "clinic_crm", externalSlotId: "crm-slot-1" }],
        count: 1,
        limit: 20,
        offset: 0,
        filters: { sourceSystem: "clinic_crm", status: "available" },
      }];
    },
  });

  const result = await repository.listAvailableSlots({
    clinicIds: [CLINIC_ID],
    sourceSystem: "clinic_crm",
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.filters.sourceSystem, "clinic_crm");
});


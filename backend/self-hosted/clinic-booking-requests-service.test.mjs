import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertClinicBookingRequestUuid,
  createClinicBookingRequestsService,
  normalizeClinicBookingRequestSlotBookingPayload,
  normalizeClinicBookingRequestUpdatePayload,
} from "./clinic-booking-requests-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";
const REQUEST_ID = "10000000-0000-4000-8000-000000000501";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const SLOT_ID = "10000000-0000-4000-8000-000000000701";

function auth(roles = ["operator"]) {
  return { userId: USER_ID, roles, clinicIds: [CLINIC_ID] };
}

function createService({ row = null, queue = null, calls = [], audit = [] } = {}) {
  const item = row || {
    id: REQUEST_ID,
    status: "reviewing",
    assignedVisitId: null,
    clinicNote: "ok",
    clinic: { id: CLINIC_ID, name: "Clinic" },
  };
  return createClinicBookingRequestsService({
    clinicBookingRequestsRepository: {
      async listBookingRequests(params) {
        calls.push(["list", params]);
        return queue || { items: [item], count: 1, limit: 25, offset: 0, filters: { status: "all" } };
      },
      async getBookingRequest(params) {
        calls.push(["get", params]);
        return item;
      },
      async updateBookingRequest(params) {
        calls.push(["update", params]);
        return { ...item, status: params.status || item.status, assignedVisitId: params.assignedVisitId || null };
      },
      async bookBookingRequestFromSlot(params) {
        calls.push(["bookFromSlot", params]);
        return {
          ...item,
          status: "booked",
          assignedVisitId: VISIT_ID,
          clinicNote: params.clinicNote || item.clinicNote,
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        audit.push(event);
        return { id: "audit-1" };
      },
    },
  });
}

test("Stage 5P service validates update payload and UUIDs", () => {
  assert.equal(assertClinicBookingRequestUuid(REQUEST_ID), REQUEST_ID);
  assert.throws(() => assertClinicBookingRequestUuid("bad"), /requestId/);

  assert.deepEqual(
    normalizeClinicBookingRequestUpdatePayload({
      status: "booked",
      assignedVisitId: VISIT_ID,
      clinicNote: "Подтверждено",
    }),
    {
      status: "booked",
      assignedVisitId: VISIT_ID,
      clinicNote: "Подтверждено",
    },
  );
  assert.throws(() => normalizeClinicBookingRequestUpdatePayload({ status: "booked" }), (error) =>
    error.publicDetails?.some?.((detail) => /Booked requests/.test(detail.message)),
  );
  assert.throws(() => normalizeClinicBookingRequestUpdatePayload({ clinicNote: "x".repeat(1001) }), (error) =>
    error.publicDetails?.some?.((detail) => /too long/.test(detail.message)),
  );

  assert.deepEqual(
    normalizeClinicBookingRequestSlotBookingPayload({
      slotId: SLOT_ID,
      clinicNote: "Окно подтверждено",
    }),
    {
      slotId: SLOT_ID,
      clinicNote: "Окно подтверждено",
    },
  );
  assert.throws(() => normalizeClinicBookingRequestSlotBookingPayload({}), (error) =>
    error.publicDetails?.some?.((detail) => /slotId is required/.test(detail.message)),
  );
  assert.throws(() => normalizeClinicBookingRequestSlotBookingPayload({ slotId: "bad" }), (error) =>
    error.publicDetails?.some?.((detail) => /UUID/.test(detail.message)),
  );
});

test("Stage 5P/5S service lists, reads, updates, books from slot, and audits clinic-scoped requests", async () => {
  const calls = [];
  const audit = [];
  const service = createService({ calls, audit });

  const list = await service.listBookingRequests(auth(), { status: "requested" }, { correlationId: "corr-1" });
  const detail = await service.getBookingRequest(REQUEST_ID, auth(), { correlationId: "corr-2" });
  const updated = await service.updateBookingRequest(
    REQUEST_ID,
    { status: "reviewing", clinicNote: "Позвонить пациенту" },
    auth(),
    { correlationId: "corr-3" },
  );
  const booked = await service.bookBookingRequestFromSlot(
    REQUEST_ID,
    { slotId: SLOT_ID, clinicNote: "Подтверждено из окна" },
    auth(),
    { correlationId: "corr-4" },
  );

  assert.equal(list.queue.count, 1);
  assert.equal(detail.bookingRequest.id, REQUEST_ID);
  assert.equal(updated.bookingRequest.status, "reviewing");
  assert.equal(booked.bookingRequest.status, "booked");
  assert.equal(booked.bookingRequest.assignedVisitId, VISIT_ID);
  assert.equal(calls[0][1].clinicIds[0], CLINIC_ID);
  assert.equal(calls[3][1].slotId, SLOT_ID);
  assert.deepEqual(audit.map((event) => event.action), [
    "clinic_booking_request.list",
    "clinic_booking_request.read",
    "clinic_booking_request.update",
    "clinic_booking_request.book_from_slot",
  ]);
});

test("Stage 5P service denies doctor-only access and maps not found", async () => {
  const service = createService();
  await assert.rejects(
    () => service.listBookingRequests(auth(["doctor"]), {}, {}),
    /reserved for operators/,
  );

  const missing = createClinicBookingRequestsService({
    clinicBookingRequestsRepository: {
      async listBookingRequests() {
        return { items: [], count: 0, limit: 25, offset: 0, filters: { status: "all" } };
      },
      async getBookingRequest() {
        return null;
      },
      async updateBookingRequest() {
        return null;
      },
      async bookBookingRequestFromSlot() {
        return null;
      },
    },
    auditRepository: { async recordEvent() {} },
  });
  await assert.rejects(() => missing.getBookingRequest(REQUEST_ID, auth(), {}), /not found/i);
  await assert.rejects(() => missing.updateBookingRequest(REQUEST_ID, { status: "reviewing" }, auth(), {}), /not found/i);
  await assert.rejects(
    () => missing.bookBookingRequestFromSlot(REQUEST_ID, { slotId: SLOT_ID }, auth(), {}),
    /not found/i,
  );
});

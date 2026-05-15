import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import {
  ClinicBookingRequestNotFoundError,
  ClinicBookingRequestValidationError,
  createClinicBookingRequestsService,
  normalizeListClinicBookingRequestsParams,
  normalizeUpdateClinicBookingRequestPayload,
} from "./clinic-booking-requests-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const REQ_ID = "10000000-0000-4000-8000-000000000711";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const OPERATOR_ID = "10000000-0000-4000-8000-000000000111";

const operatorAuth = {
  userId: OPERATOR_ID,
  roles: ["operator"],
  clinicIds: [CLINIC_ID],
};

function bookingRequest(overrides = {}) {
  return {
    id: REQ_ID,
    clinicId: CLINIC_ID,
    patientId: "10000000-0000-4000-8000-000000000201",
    status: "requested",
    preferredFrom: "2026-06-01T10:00:00.000Z",
    preferredTo: null,
    reason: "Контроль родинки",
    clinicNote: null,
    assignedVisitId: null,
    reviewedByUserId: null,
    reviewedAt: null,
    createdAt: "2026-05-15T07:00:00.000Z",
    updatedAt: "2026-05-15T07:00:00.000Z",
    patient: { id: "10000000-0000-4000-8000-000000000201", fullName: "Live Patient", code: "DP-001" },
    clinic: { id: CLINIC_ID, slug: "live", name: "Live Clinic" },
    reviewer: { id: null, displayName: null },
    ...overrides,
  };
}

function createService({ overrides = {}, audit = [] } = {}) {
  return createClinicBookingRequestsService({
    clinicBookingRequestsRepository: {
      async listBookingRequests() {
        return [bookingRequest()];
      },
      async countBookingRequests() {
        return { total: 1, requested: 1, reviewing: 0, booked: 0, cancelled: 0 };
      },
      async getBookingRequest() {
        return bookingRequest();
      },
      async updateBookingRequest({ status, assignedVisitId }) {
        return bookingRequest({
          status,
          assignedVisitId: assignedVisitId || null,
          reviewedByUserId: OPERATOR_ID,
          reviewedAt: "2026-05-15T08:00:00.000Z",
        });
      },
      ...overrides,
    },
    auditRepository: {
      async recordEvent(event) {
        audit.push(event);
        return { id: "audit-1" };
      },
    },
  });
}

test("Stage 5P normalizes list params and rejects invalid status", () => {
  const params = new URLSearchParams("status=requested&limit=300&offset=10");
  const normalized = normalizeListClinicBookingRequestsParams(params);
  assert.equal(normalized.status, "requested");
  assert.equal(normalized.limit, 200);
  assert.equal(normalized.offset, 10);

  assert.throws(
    () => normalizeListClinicBookingRequestsParams(new URLSearchParams("status=garbage")),
    ClinicBookingRequestValidationError,
  );
});

test("Stage 5P normalizes update payload and enforces visit on booked", () => {
  const payload = normalizeUpdateClinicBookingRequestPayload({
    status: "booked",
    assignedVisitId: VISIT_ID,
    clinicNote: "Согласовано",
  });
  assert.equal(payload.status, "booked");
  assert.equal(payload.assignedVisitId, VISIT_ID);

  assert.throws(
    () => normalizeUpdateClinicBookingRequestPayload({ status: "booked" }),
    ClinicBookingRequestValidationError,
  );
  assert.throws(
    () => normalizeUpdateClinicBookingRequestPayload({ status: "garbage" }),
    ClinicBookingRequestValidationError,
  );
});

test("Stage 5P service lists, reads and updates booking requests with audit", async () => {
  const audit = [];
  const service = createService({ audit });
  const list = await service.listBookingRequests(operatorAuth, new URLSearchParams("status=requested"), {
    correlationId: "corr-5p",
  });
  assert.equal(list.items.length, 1);
  assert.equal(list.counts.total, 1);

  const detail = await service.getBookingRequest(REQ_ID, operatorAuth, { correlationId: "corr-5p" });
  assert.equal(detail.item.id, REQ_ID);

  const updated = await service.updateBookingRequest(
    REQ_ID,
    { status: "booked", assignedVisitId: VISIT_ID },
    operatorAuth,
    { correlationId: "corr-5p" },
  );
  assert.equal(updated.item.status, "booked");
  assert.equal(updated.item.assignedVisitId, VISIT_ID);

  assert.deepEqual(
    audit.map((event) => event.action),
    [
      "clinic_booking_requests.list",
      "clinic_booking_requests.read",
      "clinic_booking_requests.update",
    ],
  );
});

test("Stage 5P service rejects roles outside operator/clinic_admin/system_admin", async () => {
  const service = createService();
  await assert.rejects(
    () => service.listBookingRequests(
      { userId: "x", roles: ["doctor"], clinicIds: [CLINIC_ID] },
      new URLSearchParams(),
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateBookingRequest(
      REQ_ID,
      { status: "reviewing" },
      { userId: "x", roles: ["doctor"], clinicIds: [CLINIC_ID] },
    ),
    ForbiddenError,
  );
});

test("Stage 5P service translates missing booking request to 404", async () => {
  const service = createService({
    overrides: {
      async getBookingRequest() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.getBookingRequest(REQ_ID, operatorAuth),
    ClinicBookingRequestNotFoundError,
  );
});

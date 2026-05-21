import { describe, expect, it } from "vitest";

import { buildSelfHostedAvailabilitySyncSummary } from "@/lib/self-hosted-availability-sync";
import type { SelfHostedClinicAvailableSlotDTO } from "@/lib/self-hosted-clinic-availability-api";
import type { SelfHostedClinicBookingRequestDTO } from "@/lib/self-hosted-clinic-booking-api";
import type { SelfHostedExternalIntakeStatusDTO } from "@/lib/self-hosted-external-intake-api";

const importStatus: SelfHostedExternalIntakeStatusDTO = {
  sourceSystem: "all",
  recentBatchCount: 1,
  rejectedLast24h: 0,
  duplicateLast24h: 0,
  latestImportAt: "2026-05-21T09:00:00.000Z",
  openBookingRequestCount: 1,
  availableSlotCount: 1,
  storedRawPayload: false,
  runtimeCallsExternalSystems: false,
  hardeningVersion: "stage5t",
  latestBySource: [],
};

const request: SelfHostedClinicBookingRequestDTO = {
  id: "request-1",
  clinicId: "clinic-1",
  patientId: "patient-1",
  requestedByUserId: null,
  preferredFrom: "2026-06-04T09:00:00.000Z",
  preferredTo: "2026-06-04T11:00:00.000Z",
  reason: null,
  status: "requested",
  assignedVisitId: null,
  reviewedByUserId: null,
  reviewedAt: null,
  clinicNote: null,
  createdAt: null,
  updatedAt: null,
  patient: { id: "patient-1", fullName: null, code: null },
  clinic: { id: "clinic-1", slug: null, name: null },
  assignedVisit: null,
};

const slot: SelfHostedClinicAvailableSlotDTO = {
  id: "slot-1",
  clinicId: "clinic-1",
  doctorUserId: "doctor-1",
  sourceSystem: "clinic_crm",
  externalSlotId: "source-slot-1",
  startedAt: "2026-06-04T09:30:00.000Z",
  durationMinutes: 30,
  status: "available",
  importedAt: null,
  updatedAt: null,
  clinic: { id: "clinic-1", slug: null, name: null },
  doctor: { id: "doctor-1", displayName: "Doctor" },
};

describe("buildSelfHostedAvailabilitySyncSummary", () => {
  it("marks availability sync ready when an open request has a matching local slot", () => {
    const summary = buildSelfHostedAvailabilitySyncSummary({
      bookingRequests: [request],
      availableSlots: [slot],
      importStatus,
    });

    expect(summary.status).toBe("ready");
    expect(summary.confirmationCandidates).toEqual([
      { requestId: "request-1", slotId: "slot-1", reason: "preferred_window_match" },
    ]);
    expect(summary.issues).toEqual([]);
    expect(summary.nextActionLabel).toMatch(/Можно подтверждать/i);
  });

  it("warns when requests do not have compatible slots", () => {
    const summary = buildSelfHostedAvailabilitySyncSummary({
      bookingRequests: [request],
      availableSlots: [{ ...slot, startedAt: "2026-06-04T12:30:00.000Z" }],
      importStatus: { ...importStatus, duplicateLast24h: 1 },
    });

    expect(summary.status).toBe("attention");
    expect(summary.confirmationCandidates).toHaveLength(0);
    expect(summary.issues.map((issue) => issue.type)).toContain("requests_without_matching_slot");
    expect(summary.issues.map((issue) => issue.type)).toContain("import_duplicates_last_24h");
  });

  it("blocks confirmation when raw payload storage or external runtime calls are enabled", () => {
    const summary = buildSelfHostedAvailabilitySyncSummary({
      bookingRequests: [request],
      availableSlots: [slot],
      importStatus: {
        ...importStatus,
        storedRawPayload: true,
        runtimeCallsExternalSystems: true,
      },
    });

    expect(summary.status).toBe("blocked");
    expect(summary.issues.map((issue) => issue.type)).toContain("raw_payload_storage_enabled");
    expect(summary.issues.map((issue) => issue.type)).toContain("external_runtime_calls_enabled");
  });
});

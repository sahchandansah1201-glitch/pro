import { describe, it, expect } from "vitest";
import {
  APPOINTMENTS,
  ASSESSMENTS,
  AUDIT_LOGS,
  BOT_DIALOGS,
  BOT_MESSAGES,
  CLINICS,
  DEVICES,
  IMAGES,
  INTEGRATIONS,
  LEADS,
  LESIONS,
  PATIENTS,
  REPORTS,
  VISITS,
  assertMockDataIntegrity,
  getDialogById,
  getImagesByVisitId,
  getLesionsByPatientId,
  getPatientById,
  getReportsByPatientId,
  getVisitsByPatientId,
} from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";

describe("mock-data minimum sizes", () => {
  it("has required record counts", () => {
    expect(CLINICS.length).toBeGreaterThanOrEqual(3);
    expect(PATIENTS.length).toBeGreaterThanOrEqual(8);
    expect(VISITS.length).toBeGreaterThanOrEqual(10);
    expect(LESIONS.length).toBeGreaterThanOrEqual(14);
    expect(IMAGES.length).toBeGreaterThanOrEqual(20);
    expect(ASSESSMENTS.length).toBeGreaterThanOrEqual(8);
    expect(REPORTS.length).toBeGreaterThanOrEqual(5);
    expect(BOT_DIALOGS.length).toBeGreaterThanOrEqual(6);
    expect(BOT_MESSAGES.length).toBeGreaterThanOrEqual(12);
    expect(LEADS.length).toBeGreaterThanOrEqual(6);
    expect(APPOINTMENTS.length).toBeGreaterThanOrEqual(5);
    expect(DEVICES.length).toBeGreaterThanOrEqual(4);
    expect(INTEGRATIONS.length).toBeGreaterThanOrEqual(5);
    expect(AUDIT_LOGS.length).toBeGreaterThanOrEqual(12);
  });
});

describe("mock-data integrity", () => {
  it("passes assertMockDataIntegrity", () => {
    expect(() => assertMockDataIntegrity()).not.toThrow();
  });

  it("integrations never send photos, diagnosis, AI details or PHI", () => {
    for (const integ of INTEGRATIONS) {
      expect(integ.dataPolicy.sendPhotos).toBe(false);
      expect(integ.dataPolicy.sendDiagnosis).toBe(false);
      expect(integ.dataPolicy.sendAIDetails).toBe(false);
      expect(integ.dataPolicy.sendPHI).toBe(false);
    }
  });
});

describe("mock-data helpers", () => {
  it("returns patient by id", () => {
    expect(getPatientById("p-001")?.fullName).toBe("Иванова Наталья Олеговна");
    expect(getPatientById("missing")).toBeUndefined();
  });

  it("filters visits, lesions, images, reports by parent id", () => {
    expect(getVisitsByPatientId("p-001").length).toBeGreaterThan(0);
    expect(getLesionsByPatientId("p-001").length).toBeGreaterThan(0);
    expect(getImagesByVisitId("v-001").length).toBeGreaterThan(0);
    expect(getReportsByPatientId("p-001").length).toBeGreaterThan(0);
  });

  it("returns dialog by id", () => {
    expect(getDialogById("bd-001")?.channel).toBe("telegram");
  });
});

describe("demo users emails", () => {
  it("all demo users use @derma-pro.demo", () => {
    for (const u of Object.values(DEMO_USERS)) {
      expect(u.email.endsWith("@derma-pro.demo")).toBe(true);
    }
  });
});

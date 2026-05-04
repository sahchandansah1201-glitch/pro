import { describe, it, expect } from "vitest";
import {
  ANALYSIS_CARDS,
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
  PROTECTED_ANALYSIS_LINKS,
  REPORTS,
  VISITS,
  assertMockDataIntegrity,
  getAnalysisCardById,
  getAnalysisCardForLead,
  getAnalysisCardsByDialogId,
  getDialogById,
  getImagesByVisitId,
  getLesionsByPatientId,
  getPatientById,
  getProtectedAnalysisLinkById,
  getProtectedAnalysisLinkByToken,
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

describe("AnalysisCard and ProtectedAnalysisLink data layer", () => {
  const ALLOWED_RISK = new Set(["low", "moderate", "high", "urgent"]);

  it("AnalysisCard array is non-empty", () => {
    expect(ANALYSIS_CARDS.length).toBeGreaterThanOrEqual(5);
  });

  it("ProtectedAnalysisLink array is non-empty", () => {
    expect(PROTECTED_ANALYSIS_LINKS.length).toBeGreaterThanOrEqual(5);
  });

  it("every protected link points to an existing analysis card", () => {
    const ids = new Set(ANALYSIS_CARDS.map((a) => a.id));
    for (const link of PROTECTED_ANALYSIS_LINKS) {
      expect(ids.has(link.analysisCardId)).toBe(true);
    }
  });

  it("every Lead.protectedAnalysisLinkId points to an existing protected link", () => {
    const ids = new Set(PROTECTED_ANALYSIS_LINKS.map((p) => p.id));
    for (const ld of LEADS) {
      if (ld.protectedAnalysisLinkId) {
        expect(ids.has(ld.protectedAnalysisLinkId)).toBe(true);
      }
    }
    expect(LEADS.some((l) => !!l.protectedAnalysisLinkId)).toBe(true);
  });

  it("no Lead references a Report.sharedLink token", () => {
    const reportTokens = new Set(REPORTS.map((r) => r.sharedLink.token));
    for (const ld of LEADS) {
      if (ld.protectedAnalysisLinkId) {
        expect(reportTokens.has(ld.protectedAnalysisLinkId)).toBe(false);
      }
    }
    const palTokens = new Set(PROTECTED_ANALYSIS_LINKS.map((p) => p.token));
    for (const t of palTokens) {
      expect(reportTokens.has(t)).toBe(false);
    }
  });

  it("only uses allowed risk vocabulary", () => {
    for (const ac of ANALYSIS_CARDS) {
      expect(ALLOWED_RISK.has(ac.aiSupport.risk)).toBe(true);
      expect(ALLOWED_RISK.has(ac.routingRisk)).toBe(true);
    }
  });

  it("contains at least one expired and one active protected link", () => {
    const now = Date.parse("2026-05-04T00:00:00Z");
    const expired = PROTECTED_ANALYSIS_LINKS.filter((p) => Date.parse(p.expiresAt) < now);
    const active = PROTECTED_ANALYSIS_LINKS.filter((p) => Date.parse(p.expiresAt) >= now);
    expect(expired.length).toBeGreaterThanOrEqual(1);
    expect(active.length).toBeGreaterThanOrEqual(1);
  });

  it("safe summaries do not contain confirmed diagnoses", () => {
    for (const ac of ANALYSIS_CARDS) {
      expect(ac.safeSummary.toLowerCase()).not.toContain("меланома подтверждена");
      expect(ac.safeSummary.toLowerCase()).not.toContain("рак подтверждён");
      expect(ac.safeSummary.toLowerCase()).not.toContain("рак подтвержден");
    }
  });

  it("integration data policy still blocks photos, diagnosis, AI details, PHI", () => {
    for (const integ of INTEGRATIONS) {
      expect(integ.dataPolicy.sendPhotos).toBe(false);
      expect(integ.dataPolicy.sendDiagnosis).toBe(false);
      expect(integ.dataPolicy.sendAIDetails).toBe(false);
      expect(integ.dataPolicy.sendPHI).toBe(false);
    }
  });

  it("helpers resolve cards and links correctly", () => {
    expect(getAnalysisCardById("ac-001")?.dialogId).toBe("bd-001");
    expect(getAnalysisCardsByDialogId("bd-001").length).toBeGreaterThanOrEqual(1);
    expect(getProtectedAnalysisLinkById("pal-001")?.analysisCardId).toBe("ac-001");
    expect(getProtectedAnalysisLinkByToken("pal-tok-ac001-demo")?.id).toBe("pal-001");
    expect(getAnalysisCardForLead("ld-001")?.id).toBe("ac-001");
    expect(getAnalysisCardForLead("ld-005")).toBeUndefined();
  });
});

describe("demo users emails", () => {
  it("all demo users use @derma-pro.demo", () => {
    for (const u of Object.values(DEMO_USERS)) {
      expect(u.email.endsWith("@derma-pro.demo")).toBe(true);
    }
  });
});

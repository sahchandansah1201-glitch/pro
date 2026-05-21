import { describe, expect, it, vi } from "vitest";

import {
  clinicalReportMissingLabel,
  getSelfHostedClinicalReportPackage,
  toSelfHostedClinicalReportPackage,
} from "@/lib/self-hosted-clinical-report-package-api";

describe("self-hosted-clinical-report-package-api", () => {
  it("returns not_configured without bearer token", async () => {
    const result = await getSelfHostedClinicalReportPackage({
      apiBaseUrl: "http://localhost:3001",
      apiToken: null,
      visitId: "visit-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });

  it("maps readiness package and uses only self-hosted backend route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            visitId: "visit-1",
            assessment: { status: "ready", abcdTotal: "3.4", summaryPresent: true },
            conclusion: { status: "signed", summaryPresent: true },
            report: {
              status: "signed",
              physicianTextPresent: true,
              patientSafeTextPresent: true,
            },
            counts: { lesions: 2, assets: 3 },
            readiness: {
              ready: true,
              status: "ready",
              completionPercent: 100,
              missing: [],
              exportAllowed: true,
              patientDeliveryAllowed: true,
            },
            productBoundary: {
              managedRuntimeDependency: "none",
              managedDatabaseDependency: "none",
              externalRuntimeCalls: false,
              rawPatientDataInReport: false,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await getSelfHostedClinicalReportPackage({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value?.readiness.status).toBe("ready");
    expect(result.value?.assessment.abcdTotal).toBe(3.4);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/report-package",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
  });

  it("normalizes missing keys and labels without exposing raw values", () => {
    const dto = toSelfHostedClinicalReportPackage({
      visitId: "visit-1",
      readiness: {
        status: "blocked",
        missing: ["patient_safe_text_missing"],
      },
    });
    expect(dto.readiness.missing).toEqual(["patient_safe_text_missing"]);
    expect(clinicalReportMissingLabel("patient_safe_text_missing")).toBe("нет patient-safe текста");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSelfHostedDoctorDashboard,
  toSelfHostedDoctorDashboard,
} from "@/lib/self-hosted-dashboard-api";

describe("self-hosted-dashboard-api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes dashboard payloads safely", () => {
    const dashboard = toSelfHostedDoctorDashboard({
      kpis: { activeVisits: "2", devicesTotal: 3 },
      upcoming: [{ id: "v-1", patientFullName: "Patient One", status: "in_progress" }],
      awaitingConclusions: [],
      recentPatients: [{ id: "p-1", fullName: "Patient One", code: "DP-1" }],
      assetIssues: [{ id: "a-1", issue: "checksum_missing", byteSize: null }],
      devices: [{ id: "d-1", model: "DermLite", serial: "DL-1" }],
    });

    expect(dashboard.kpis.activeVisits).toBe(2);
    expect(dashboard.kpis.visitsToday).toBe(0);
    expect(dashboard.upcoming[0].patientFullName).toBe("Patient One");
    expect(dashboard.assetIssues[0].issue).toBe("checksum_missing");
    expect(dashboard.devices[0].model).toBe("DermLite");
  });

  it("calls /api/v1/doctor/dashboard with bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          dashboard: {
            kpis: { visitsToday: 1 },
            upcoming: [{ id: "v-1", patientFullName: "Patient One" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSelfHostedDoctorDashboard({
      apiBaseUrl: "https://clinic.local",
      apiToken: "token-123",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.kpis.visitsToday).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/doctor/dashboard", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer token-123",
      },
    });
  });

  it("returns not_configured without a token and maps http errors safely", async () => {
    const missing = await getSelfHostedDoctorDashboard({ apiBaseUrl: "", apiToken: null });
    expect(missing.ok).toBe(false);
    expect(missing.error?.kind).toBe("not_configured");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "forbidden", message: "No access" },
            correlationId: "corr-1",
          }),
          { status: 403, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    const denied = await getSelfHostedDoctorDashboard({ apiBaseUrl: "", apiToken: "token" });
    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe("forbidden");
    expect(denied.error?.correlationId).toBe("corr-1");
  });
});

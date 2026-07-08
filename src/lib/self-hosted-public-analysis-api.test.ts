import { describe, expect, it, vi } from "vitest";

import { getSelfHostedPublicAnalysis } from "./self-hosted-public-analysis-api";

describe("self-hosted public analysis API", () => {
  it("reads a public analysis link without authorization header", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        item: {
          status: "valid",
          safeSummary: "Покажите врачу на контрольном приёме.",
          clinicName: "Клиника",
          qualityPassed: true,
          expiresAt: "2026-07-09T10:00:00.000Z",
        },
      }), { status: 200 }),
    );

    const result = await getSelfHostedPublicAnalysis({
      apiBaseUrl: "https://pro.example.test",
      token: "public-token-value",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("valid");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://pro.example.test/api/v1/public/analysis/public-token-value",
      { headers: { Accept: "application/json" } },
    );

    fetchMock.mockRestore();
  });

  it("returns not_configured when production API base URL is missing", async () => {
    const result = await getSelfHostedPublicAnalysis({ apiBaseUrl: "", token: "x" });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });
});

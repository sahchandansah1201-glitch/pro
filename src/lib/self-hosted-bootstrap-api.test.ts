import { describe, expect, it, vi, afterEach } from "vitest";

import {
  buildProductionBootstrapChecklist,
  fetchSelfHostedBootstrapStatus,
} from "@/lib/self-hosted-bootstrap-api";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("self-hosted-bootstrap-api", () => {
  it("fetches public health/readiness/meta without auth headers", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "ok", service: "dermatolog-pro-backend" }))
      .mockResolvedValueOnce(
        jsonResponse({
          ready: true,
          status: "ready",
          dependencies: [
            { name: "postgres", configured: true, connected: true, status: "connected", detail: "ok" },
            { name: "jwt-signing-key", configured: true, status: "configured", detail: "ok" },
            { name: "object-storage", configured: true, status: "configured", detail: "ok" },
          ],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          stage: "4Z",
          deploymentMode: "self-hosted",
          capabilities: { auth: "local-jwt" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSelfHostedBootstrapStatus({ apiBaseUrl: "http://localhost:8080" });

    expect(result.ok).toBe(true);
    expect(result.value?.health?.status).toBe("ok");
    expect(result.value?.readiness?.ready).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const [, init] of fetchMock.mock.calls) {
      expect(JSON.stringify(init)).not.toContain("Authorization");
    }
  });

  it("builds a production bootstrap checklist", () => {
    const checklist = buildProductionBootstrapChecklist({
      health: { status: "ok", service: "dermatolog-pro-backend" },
      readiness: {
        ready: true,
        status: "ready",
        dependencies: [
          { name: "postgres", configured: true, connected: true, status: "connected", detail: "ok" },
          { name: "jwt-signing-key", configured: true, status: "configured", detail: "ok" },
          { name: "object-storage", configured: true, status: "configured", detail: "ok" },
        ],
      },
      meta: {
        stage: "4Z",
        deploymentMode: "self-hosted",
        capabilities: { auth: "local-jwt" },
      },
    });

    expect(checklist.map((item) => item.key)).toEqual([
      "backend",
      "postgres",
      "object-storage",
      "auth",
      "system-admin",
    ]);
    expect(checklist.filter((item) => item.status === "ready")).toHaveLength(4);
    expect(checklist.find((item) => item.key === "system-admin")?.detail).toContain(
      "Создайте первого администратора",
    );
  });

  it("rejects missing or invalid base URLs before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSelfHostedBootstrapStatus({ apiBaseUrl: "" });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("base_url_required");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

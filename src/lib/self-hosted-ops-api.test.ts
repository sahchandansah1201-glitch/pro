import { describe, expect, it, vi, afterEach } from "vitest";

import {
  buildStage4OAuditExportPreview,
  fetchSelfHostedOpsStatus,
  STAGE4O_AUDIT_EXPORT_COMMAND,
  toSelfHostedOpsStatus,
} from "@/lib/self-hosted-ops-api";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

const OPS_STATUS_BODY = {
  stage: "4N",
  source: "self-hosted",
  ready: true,
  status: "ready",
  dependencies: [
    { name: "postgres", configured: true, connected: true, status: "connected" },
  ],
  observability: {
    structuredJsonLogs: true,
    correlationHeader: "x-correlation-id",
    redaction: "enabled",
    requestPathLogging: "path-only",
  },
  audit: {
    mode: "append-only",
    safeExport: "scripts/stage4n-audit-export.mjs --dry-run",
    exportedFields: ["created_at", "action", "entity_type", "entity_id", "correlation_id"],
  },
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-1",
};

describe("self-hosted-ops-api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes ops status without exposing unsafe backend internals", () => {
    const status = toSelfHostedOpsStatus({
      ...OPS_STATUS_BODY,
      access_token: "secret",
      storage_object_path: "bucket/key",
    });

    expect(status?.stage).toBe("4N");
    expect(status?.dependencies[0].name).toBe("postgres");
    expect(JSON.stringify(status)).not.toContain("secret");
    expect(JSON.stringify(status)).not.toContain("bucket/key");
  });

  it("fetches /api/v1/ops/status with bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(OPS_STATUS_BODY));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchSelfHostedOpsStatus({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt-1",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/ops/status",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-1",
        }),
      }),
    );
  });

  it("returns not_configured without token", async () => {
    const result = await fetchSelfHostedOpsStatus({
      apiBaseUrl: "http://localhost:8080",
      apiToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.kind).toBe("not_configured");
  });

  it("builds safe audit export preview", () => {
    const preview = buildStage4OAuditExportPreview(toSelfHostedOpsStatus(OPS_STATUS_BODY));
    expect(preview).toContain(STAGE4O_AUDIT_EXPORT_COMMAND);
    expect(preview).toContain("created_at");
    expect(preview).not.toMatch(/access_token|storage_object_path|Bearer|password=/i);
  });
});

import { describe, expect, it, vi, afterEach } from "vitest";

import {
  buildStage4POperationsPreview,
  buildStage4OAuditExportPreview,
  buildStage4ZProductReadinessPreview,
  fetchSelfHostedProductReadiness,
  fetchSelfHostedOpsRuntimeChecks,
  fetchSelfHostedOpsStatus,
  STAGE4O_AUDIT_EXPORT_COMMAND,
  toSelfHostedProductReadiness,
  toSelfHostedOpsRuntimeChecks,
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

const RUNTIME_CHECKS_BODY = {
  stage: "4P",
  source: "self-hosted",
  ready: true,
  status: "ready",
  checks: [
    {
      key: "postgres_connectivity",
      label: "PostgreSQL connectivity",
      status: "ready",
      detail: "PostgreSQL connection verified",
      connected: true,
    },
    {
      key: "migration_bundle",
      label: "Migration bundle",
      status: "ready",
      detail: "Self-hosted PostgreSQL migration bundle is present",
      count: 7,
      expectedCount: 7,
      latest: "0007_stage4k_deploy_smoke_seed.sql",
    },
  ],
  commands: [
    {
      key: "backup_dry_run",
      label: "Backup dry-run",
      command: "npm run ops:stage4l:backup:dry-run",
      description: "Plan backup",
      status: "ready",
      dryRunOnly: true,
    },
    {
      key: "deploy_smoke_dry_run",
      label: "Deploy smoke dry-run",
      command: "npm run smoke:stage4k:dry-run",
      description: "Plan smoke",
      status: "ready",
      dryRunOnly: true,
    },
  ],
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-4p",
};

const PRODUCT_READINESS_BODY = {
  stage: "4Z",
  source: "self-hosted",
  status: "ready_for_server_deploy",
  productBoundary: {
    deployment: "single self-hosted product",
    frontend: "static React build served by nginx",
    backend: "Node self-hosted API",
    database: "operator-owned PostgreSQL",
    objectStorage: "operator-owned object storage",
    managedRuntime: "none",
    managedDatabase: "none",
    supabaseRuntimeCoupling: false,
    browserHardwareApis: false,
  },
  capabilities: [
    { key: "frontend", label: "React frontend", status: "ready", evidence: ["dist build"] },
    { key: "device_bridge", label: "Device Bridge worker operations", status: "ready", evidence: ["audit export"] },
  ],
  gates: [
    { key: "full_preflight", label: "Full deterministic preflight", command: "npm run preflight:all", required: true },
    { key: "compose_smoke", label: "Self-hosted compose smoke", command: "npm run smoke:stage4k", required: true },
  ],
  openapi: ["/openapi.stage4y.json", "/openapi.stage4z.json"],
  privacy: {
    redaction: "enabled",
    exportedData: "metadata-only operational readiness",
    excluded: ["tokens", "passwords", "patient names", "storage paths"],
  },
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-4z",
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

  it("normalizes and fetches /api/v1/ops/runtime-checks safely", async () => {
    const normalized = toSelfHostedOpsRuntimeChecks({
      ...RUNTIME_CHECKS_BODY,
      patient_full_name: "Ivanova Natalia",
      storage_object_path: "bucket/key",
    });
    expect(normalized?.stage).toBe("4P");
    expect(normalized?.checks[0].key).toBe("postgres_connectivity");
    expect(JSON.stringify(normalized)).not.toContain("Ivanova Natalia");
    expect(JSON.stringify(normalized)).not.toContain("bucket/key");

    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(RUNTIME_CHECKS_BODY));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchSelfHostedOpsRuntimeChecks({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value?.commands[0].command).toBe("npm run ops:stage4l:backup:dry-run");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/ops/runtime-checks",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-1",
        }),
      }),
    );
  });

  it("normalizes and fetches /api/v1/product/readiness safely", async () => {
    const normalized = toSelfHostedProductReadiness({
      ...PRODUCT_READINESS_BODY,
      access_token: "secret",
      storage_object_path: "bucket/key",
      patient_full_name: "Ivanova Natalia",
    });
    expect(normalized?.stage).toBe("4Z");
    expect(normalized?.productBoundary.managedRuntime).toBe("none");
    expect(normalized?.productBoundary.managedDatabase).toBe("none");
    expect(normalized?.productBoundary.supabaseRuntimeCoupling).toBe(false);
    expect(normalized?.capabilities.map((item) => item.key)).toContain("device_bridge");
    expect(JSON.stringify(normalized)).not.toContain("secret");
    expect(JSON.stringify(normalized)).not.toContain("bucket/key");
    expect(JSON.stringify(normalized)).not.toContain("Ivanova Natalia");

    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(PRODUCT_READINESS_BODY));
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchSelfHostedProductReadiness({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value?.gates[0].command).toBe("npm run preflight:all");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/product/readiness",
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

  it("builds safe operations preview for server-owned dry runs", () => {
    const preview = buildStage4POperationsPreview(
      toSelfHostedOpsRuntimeChecks(RUNTIME_CHECKS_BODY),
    );
    expect(preview).toContain("Stage 4P operations preview");
    expect(preview).toContain("npm run ops:stage4l:backup:dry-run");
    expect(preview).toContain("npm run smoke:stage4k:dry-run");
    expect(preview).not.toMatch(/access_token|storage_object_path|Bearer|password=|patient_full_name/i);
  });

  it("builds safe Stage 4Z product readiness preview", () => {
    const preview = buildStage4ZProductReadinessPreview(
      toSelfHostedProductReadiness(PRODUCT_READINESS_BODY),
    );
    expect(preview).toContain("Stage 4Z product readiness preview");
    expect(preview).toContain("npm run preflight:all");
    expect(preview).toContain("npm run smoke:stage4k");
    expect(preview).toContain("Managed runtime: none");
    expect(preview).not.toMatch(/access_token|storage_object_path|Bearer|password=|patient_full_name/i);
  });
});

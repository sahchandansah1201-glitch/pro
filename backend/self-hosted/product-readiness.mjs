// Stage 4Z · self-hosted product readiness manifest.
// This module is intentionally static and local: it describes the deployable
// product boundary without reading secrets or calling managed services.

export const SELF_HOSTED_PRODUCT_STAGE = "4Z";

export const SELF_HOSTED_PRODUCT_CAPABILITIES = [
  {
    key: "frontend",
    label: "React frontend",
    status: "ready",
    evidence: ["dist build", "self-hosted API clients", "system_admin ops UI"],
  },
  {
    key: "backend",
    label: "Node self-hosted API",
    status: "ready",
    evidence: ["/healthz", "/readyz", "/api/v1/meta", "/api/v1/product/readiness"],
  },
  {
    key: "postgres",
    label: "PostgreSQL persistence",
    status: "ready",
    evidence: ["db/migrations/0001-0013", "local auth seed", "append-only audit"],
  },
  {
    key: "object_storage",
    label: "Self-hosted object storage",
    status: "ready",
    evidence: ["OBJECT_STORAGE_LOCAL_DIR", "OBJECT_STORAGE_ENDPOINT", "backend download proxy"],
  },
  {
    key: "clinical_workflows",
    label: "Clinical patient/visit/asset workflows",
    status: "ready",
    evidence: ["patients CRUD", "visit workspace writes", "asset binary upload/download"],
  },
  {
    key: "device_bridge",
    label: "Device Bridge worker operations",
    status: "ready",
    evidence: ["registry", "command queue", "worker lifecycle", "audit replay/export"],
  },
  {
    key: "operations",
    label: "Server operations",
    status: "ready",
    evidence: ["backup/restore dry-runs", "deploy smoke", "runtime checks", "observability"],
  },
];

export const SELF_HOSTED_PRODUCT_GATES = [
  {
    key: "full_preflight",
    label: "Full deterministic preflight",
    command: "npm run preflight:all",
    required: true,
  },
  {
    key: "compose_smoke",
    label: "Self-hosted compose smoke",
    command: "npm run smoke:stage4k",
    required: true,
  },
  {
    key: "post_deploy",
    label: "Post-deploy verification",
    command: "npm run deploy:stage4m:post-deploy:dry-run",
    required: true,
  },
  {
    key: "backup_after_deploy",
    label: "Backup after deploy",
    command: "npm run deploy:stage4m:backup-after-deploy:dry-run",
    required: true,
  },
  {
    key: "rollback_drill",
    label: "Rollback drill",
    command: "npm run deploy:stage4m:rollback-drill:dry-run",
    required: true,
  },
];

export const SELF_HOSTED_PRODUCT_OPENAPI = [
  "/openapi.stage4a.json",
  "/openapi.stage4b.json",
  "/openapi.stage4c.json",
  "/openapi.stage4d.json",
  "/openapi.stage4g.json",
  "/openapi.stage4h.json",
  "/openapi.stage4i.json",
  "/openapi.stage4j.json",
  "/openapi.stage4n.json",
  "/openapi.stage4p.json",
  "/openapi.stage4q.json",
  "/openapi.stage4r.json",
  "/openapi.stage4s.json",
  "/openapi.stage4u.json",
  "/openapi.stage4v.json",
  "/openapi.stage4w.json",
  "/openapi.stage4x.json",
  "/openapi.stage4y.json",
  "/openapi.stage4z.json",
];

export function buildSelfHostedProductReadiness({ config, generatedAt, correlationId } = {}) {
  return {
    stage: SELF_HOSTED_PRODUCT_STAGE,
    source: "self-hosted",
    status: "ready_for_server_deploy",
    productBoundary: {
      deployment: "single self-hosted product",
      frontend: "static React build served by nginx",
      backend: "Node self-hosted API",
      database: "operator-owned PostgreSQL",
      objectStorage: "operator-owned object storage or local filesystem",
      managedRuntime: "none",
      managedDatabase: "none",
      supabaseRuntimeCoupling: false,
      browserHardwareApis: false,
    },
    service: {
      deploymentMode: config?.deploymentMode || "self-hosted",
      publicBaseUrl: config?.publicBaseUrl || null,
    },
    capabilities: SELF_HOSTED_PRODUCT_CAPABILITIES.map((item) => ({
      ...item,
      evidence: [...item.evidence],
    })),
    gates: SELF_HOSTED_PRODUCT_GATES.map((item) => ({ ...item })),
    openapi: [...SELF_HOSTED_PRODUCT_OPENAPI],
    privacy: {
      redaction: "enabled",
      exportedData: "metadata-only operational readiness",
      excluded: [
        "tokens",
        "passwords",
        "raw request bodies",
        "patient names",
        "object keys",
        "storage paths",
        "signed URLs",
        "raw environment values",
      ],
    },
    generatedAt: generatedAt || new Date().toISOString(),
    correlationId: correlationId || "",
  };
}

// Stage 4P · Self-hosted runtime operations checks.
// Server-owned status only: no secrets, no object keys, no patient data.

import { constants } from "node:fs";
import { access, mkdir, readdir, statfs } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "db/migrations");

const EXPECTED_MIGRATION_PREFIXES = [
  "0001_stage4a",
  "0002_stage4b",
  "0003_stage4c",
  "0004_stage4d",
  "0005_stage4h",
  "0006_stage4i",
  "0007_stage4k",
  "0008_stage4q",
];

const OPS_COMMANDS = [
  {
    key: "backup_dry_run",
    label: "Backup dry-run",
    command: "npm run ops:stage4l:backup:dry-run",
    description: "Планирует резервное копирование PostgreSQL и backend-owned object storage.",
  },
  {
    key: "restore_dry_run",
    label: "Restore dry-run",
    command: "npm run ops:stage4l:restore:dry-run",
    description: "Показывает destructive restore-план без выполнения восстановления.",
  },
  {
    key: "deploy_smoke_dry_run",
    label: "Deploy smoke dry-run",
    command: "npm run smoke:stage4k:dry-run",
    description: "Проверяет docker-compose smoke-план до запуска production stack.",
  },
  {
    key: "audit_export_dry_run",
    label: "Audit export dry-run",
    command: "npm run ops:stage4n:audit-export:dry-run",
    description: "Готовит metadata-only audit export без PHI и секретов.",
  },
];

function check(status, key, label, detail, extra = {}) {
  return {
    key,
    label,
    status,
    detail,
    ...extra,
  };
}

function overallStatus(checks) {
  if (checks.some((item) => item.status === "failed")) return "failed";
  if (checks.some((item) => item.status === "warning")) return "degraded";
  return "ready";
}

function safeErrorDetail(fallback) {
  return String(fallback || "check failed")
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgres://[redacted]@")
    .replace(/password=[^&\s]+/gi, "password=[redacted]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]");
}

async function databaseCheck(dbClient) {
  try {
    const result = await dbClient.checkConnection();
    return check(
      result.connected ? "ready" : "failed",
      "postgres_connectivity",
      "PostgreSQL connectivity",
      result.connected ? "PostgreSQL connection verified" : "PostgreSQL is unavailable",
      { connected: Boolean(result.connected) },
    );
  } catch (error) {
    return check(
      "failed",
      "postgres_connectivity",
      "PostgreSQL connectivity",
      safeErrorDetail(error?.message || "PostgreSQL check failed"),
      { connected: false },
    );
  }
}

async function objectStorageCheck(config) {
  if (config.objectStorageEndpoint) {
    return check(
      "ready",
      "object_storage_runtime",
      "Object storage runtime",
      "External S3-compatible endpoint configured behind backend proxy",
      { mode: "external-endpoint" },
    );
  }

  const root = config.objectStorageLocalDir || ".self-hosted/object-storage";
  try {
    await mkdir(root, { recursive: true });
    await access(root, constants.R_OK | constants.W_OK);
    const stats = await statfs(root);
    const totalBytes = Number(stats.blocks || 0) * Number(stats.bsize || 0);
    const availableBytes = Number(stats.bavail || 0) * Number(stats.bsize || 0);
    const usedPercent = totalBytes > 0
      ? Math.round(((totalBytes - availableBytes) / totalBytes) * 100)
      : null;
    const status = usedPercent != null && usedPercent >= 90 ? "warning" : "ready";
    return check(
      status,
      "object_storage_runtime",
      "Object storage runtime",
      status === "ready"
        ? "Local backend-owned object storage is writable"
        : "Local backend-owned object storage is nearly full",
      {
        mode: "local-filesystem",
        totalBytes,
        availableBytes,
        usedPercent,
      },
    );
  } catch {
    return check(
      "failed",
      "object_storage_runtime",
      "Object storage runtime",
      "Local backend-owned object storage is not writable",
      { mode: "local-filesystem" },
    );
  }
}

async function migrationsCheck({ migrationsDir = MIGRATIONS_DIR } = {}) {
  try {
    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();
    const missing = EXPECTED_MIGRATION_PREFIXES.filter(
      (prefix) => !files.some((file) => file.startsWith(prefix)),
    );
    return check(
      missing.length === 0 ? "ready" : "warning",
      "migration_bundle",
      "Migration bundle",
      missing.length === 0
        ? "Self-hosted PostgreSQL migration bundle is present"
        : "Self-hosted migration bundle is incomplete",
      {
        count: files.length,
        expectedCount: EXPECTED_MIGRATION_PREFIXES.length,
        latest: files.at(-1) || "",
        missing,
      },
    );
  } catch {
    return check(
      "failed",
      "migration_bundle",
      "Migration bundle",
      "Migration directory is not readable",
      { count: 0, expectedCount: EXPECTED_MIGRATION_PREFIXES.length, latest: "", missing: EXPECTED_MIGRATION_PREFIXES },
    );
  }
}

function commandChecks() {
  return OPS_COMMANDS.map((item) => ({
    ...item,
    status: "ready",
    dryRunOnly: true,
  }));
}

export async function collectSelfHostedOpsRuntimeChecks({
  config,
  dbClient,
  now = () => new Date().toISOString(),
  migrationsDir = MIGRATIONS_DIR,
  correlationId = "",
} = {}) {
  const checks = [
    await databaseCheck(dbClient),
    await objectStorageCheck(config || {}),
    await migrationsCheck({ migrationsDir }),
  ];
  const status = overallStatus(checks);
  return {
    stage: "4P",
    source: "self-hosted",
    status,
    ready: status === "ready",
    checks,
    commands: commandChecks(),
    generatedAt: now(),
    correlationId,
  };
}

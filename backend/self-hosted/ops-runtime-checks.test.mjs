import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectSelfHostedOpsRuntimeChecks } from "./ops-runtime-checks.mjs";

const NOW = () => "2026-05-14T00:00:00.000Z";

function dbClient({ connected = true, error = null } = {}) {
  return {
    async checkConnection() {
      if (error) throw error;
      return { connected, detail: connected ? "ok" : "unavailable" };
    },
  };
}

function writeMigrations(dir) {
  for (const name of [
    "0001_stage4a_core.sql",
    "0002_stage4b_runtime_seed.sql",
    "0003_stage4c_auth_seed.sql",
    "0004_stage4d_patient_writes.sql",
    "0005_stage4h_visit_workspace_writes.sql",
    "0006_stage4i_asset_write_contract.sql",
    "0007_stage4k_deploy_smoke_seed.sql",
    "0008_stage4q_device_registry.sql",
    "0009_stage4r_device_bridge_commands.sql",
    "0010_stage4s_device_bridge_worker_contract.sql",
  ]) {
    writeFileSync(join(dir, name), "-- migration");
  }
}

test("collects ready runtime checks without leaking paths or secrets", async () => {
  const root = mkdtempSync(join(tmpdir(), "stage4p-ready-"));
  try {
    const migrations = join(root, "migrations");
    const objectStore = join(root, "object-storage");
    mkdirSync(migrations, { recursive: true });
    writeMigrations(migrations);

    const result = await collectSelfHostedOpsRuntimeChecks({
      config: { objectStorageLocalDir: objectStore },
      dbClient: dbClient(),
      migrationsDir: migrations,
      now: NOW,
      correlationId: "corr-test",
    });

    assert.equal(result.stage, "4P");
    assert.equal(result.status, "ready");
    assert.equal(result.ready, true);
    assert.equal(result.checks.length, 3);
    assert.ok(result.commands.some((item) => item.command === "npm run ops:stage4l:backup:dry-run"));
    assert.ok(result.commands.some((item) => item.command === "npm run smoke:stage4k:dry-run"));
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /postgres:\/\/|password|Bearer|patient_full_name|storage_object_path|object_key/i);
    assert.doesNotMatch(serialized, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports degraded or failed checks while redacting database errors", async () => {
  const root = mkdtempSync(join(tmpdir(), "stage4p-fail-"));
  try {
    const migrations = join(root, "migrations");
    mkdirSync(migrations, { recursive: true });
    writeFileSync(join(migrations, "0001_stage4a_core.sql"), "-- migration");
    const result = await collectSelfHostedOpsRuntimeChecks({
      config: { objectStorageEndpoint: "http://minio:9000" },
      dbClient: dbClient({
        error: new Error("postgres://user:secret@postgres/app password=secret failed"),
      }),
      migrationsDir: migrations,
      now: NOW,
    });

    assert.equal(result.status, "failed");
    assert.equal(result.ready, false);
    assert.equal(
      result.checks.find((item) => item.key === "postgres_connectivity")?.status,
      "failed",
    );
    assert.equal(
      result.checks.find((item) => item.key === "migration_bundle")?.status,
      "warning",
    );
    assert.doesNotMatch(JSON.stringify(result), /secret|postgres:\/\/user:secret/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

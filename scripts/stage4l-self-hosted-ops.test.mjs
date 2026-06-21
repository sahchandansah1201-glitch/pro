import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildBackupPlan,
  buildRestorePlan,
  parseStage4LOpsArgs,
  renderPlan,
  runBackup,
  runRestore,
  verifyEnvText,
} from "./stage4l-self-hosted-ops.mjs";

test("Stage 4L backup dry-run includes database, object storage, and manifest without secrets", () => {
  const parsed = parseStage4LOpsArgs([
    "backup",
    "--dry-run",
    "--project-name=demo-project",
    "--compose-file=deploy/self-hosted/docker-compose.stage4a.yml",
    "--compose-file=deploy/self-hosted/docker-compose.production.example.yml",
    "--compose-env-file=deploy/self-hosted/.env.production",
    "--backup-dir",
    "backups/self-hosted/test-run",
  ]);
  assert.equal(parsed.command, "backup");
  assert.equal(parsed.dryRun, true);

  const plan = buildBackupPlan(parsed);
  const out = renderPlan(plan);
  assert.match(out, /--env-file deploy\/self-hosted\/\.env\.production/);
  assert.match(out, /-f deploy\/self-hosted\/docker-compose\.production\.example\.yml/);
  assert.match(out, /pg_dump/);
  assert.match(out, /backend-object-storage/);
  assert.match(out, /stage4l-backup-manifest\.json/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD=|JWT_SECRET=|DEVICE_BRIDGE_WORKER_TOKEN=|MINIO_ROOT_PASSWORD=/);
});

test("Stage 4L restore plan is explicit, destructive, and requires confirmation outside dry-run", () => {
  const plan = buildRestorePlan({
    command: "restore",
    backupDir: "backups/self-hosted/test-run",
    projectName: "demo-project",
  });
  const out = renderPlan(plan);
  assert.match(out, /RESTORE_SELF_HOSTED_DATA/);
  assert.match(out, /volume rm -f demo-project_postgres-data demo-project_backend-object-storage/);
  assert.match(out, /pg_restore/);
  assert.match(out, /smoke:stage4k/);
  assert.throws(
    () => runRestore({ command: "restore", backupDir: "backups/self-hosted/test-run" }),
    /requires --confirm=RESTORE_SELF_HOSTED_DATA/,
  );
});

test("Stage 4L backup runner writes a manifest and captures PostgreSQL dump bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-backup-"));
  try {
    const backupDir = join(root, "backup");
    const calls = [];
    const result = runBackup(
      {
        command: "backup",
        backupDir,
        projectName: "demo-project",
      },
      {
        spawn(cmd, args) {
          calls.push(`${cmd} ${args.join(" ")}`);
          if (args.includes("pg_dump")) {
            return { status: 0, stdout: Buffer.from("PGDUMP"), stderr: Buffer.from("") };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      },
    );
    assert.equal(result.ok, true);
    assert.match(readFileSync(join(backupDir, "postgres.dump"), "utf8"), /PGDUMP/);
    const manifest = JSON.parse(readFileSync(join(backupDir, "stage4l-backup-manifest.json"), "utf8"));
    assert.equal(manifest.stage, "4L");
    assert.ok(calls.some((cmd) => cmd.includes("alpine:3.20 tar -czf")));
    assert.doesNotMatch(JSON.stringify(manifest), /secret|password|object_key/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L env verifier checks required keys and warns on placeholders", () => {
  const ok = verifyEnvText(`
APP_PORT=8080
VITE_APP_MODE=production
VITE_SELF_HOSTED_API_BASE_URL=https://pro.example.test
POSTGRES_PASSWORD=replace-me-postgres
JWT_SECRET=replace-me-jwt-secret
DEVICE_BRIDGE_WORKER_TOKEN=replace-me-worker-token
JWT_EXPIRES_IN_SECONDS=3600
OBJECT_STORAGE_BUCKET=clinical-assets
MINIO_ROOT_USER=dermatolog_minio
MINIO_ROOT_PASSWORD=replace-me-minio
MINIO_CONSOLE_PORT=9001
BACKUP_RETENTION_DAYS=14
`);
  assert.equal(ok.ok, true);
  assert.ok(ok.warnings.some((item) => item.includes("POSTGRES_PASSWORD")));
  assert.ok(ok.warnings.some((item) => item.includes("JWT_SECRET")));
  assert.ok(ok.warnings.some((item) => item.includes("DEVICE_BRIDGE_WORKER_TOKEN")));

  const missing = verifyEnvText("APP_PORT=8080");
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.some((item) => item.includes("POSTGRES_PASSWORD")));
});

test("Stage 4L CLI dry-runs backup and verify-env exits cleanly", () => {
  const backup = spawnSync(
    process.execPath,
    ["scripts/stage4l-self-hosted-ops.mjs", "backup", "--dry-run", "--backup-dir", "backups/self-hosted/test"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(backup.status, 0, backup.stderr);
  assert.match(backup.stdout, /backup plan/);
  assert.doesNotMatch(backup.stdout, /Bearer\s+[A-Za-z0-9]/);

  const env = spawnSync(
    process.execPath,
    ["scripts/stage4l-self-hosted-ops.mjs", "verify-env", "--env-file", "deploy/self-hosted/.env.production.example"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(env.status, 0, env.stderr);
  assert.match(env.stdout, /env verification/);
});

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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

test("Stage 4L backup dry-run validates and archives both object-storage volumes without secrets", () => {
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
  assert.match(out, /mkdir -p -m 700 backups\/self-hosted\/test-run/);
  assert.match(out, /--env-file deploy\/self-hosted\/\.env\.production/);
  assert.match(out, /-f deploy\/self-hosted\/docker-compose\.stage4a\.yml/);
  assert.match(out, /-f deploy\/self-hosted\/docker-compose\.production\.example\.yml/);
  assert.match(out, /pg_dump/);
  assert.match(out, /volume inspect demo-project_backend-object-storage/);
  assert.match(out, /backend-object-storage/);
  assert.match(out, /volume inspect demo-project_object-storage-data/);
  assert.match(out, /minio-object-storage\.tgz/);
  assert.match(out, /pg_restore --list/);
  assert.match(out, /tar -tzf \/backup\/object-storage\.tgz/);
  assert.match(out, /tar -tzf \/backup\/minio-object-storage\.tgz/);
  assert.match(out, /stage4l-backup-manifest\.json/);
  assert.match(
    out,
    /sha256sum postgres\.dump object-storage\.tgz minio-object-storage\.tgz stage4l-backup-manifest\.json > .*SHA256SUMS/,
  );
  assert.match(
    out,
    /chmod 600 postgres\.dump object-storage\.tgz minio-object-storage\.tgz stage4l-backup-manifest\.json SHA256SUMS/,
  );
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
  assert.match(out, /sha256sum -c SHA256SUMS/);
  assert.ok(out.indexOf("sha256sum -c SHA256SUMS") < out.indexOf("compose -f"));
  assert.match(
    out,
    /volume rm -f demo-project_postgres-data demo-project_backend-object-storage demo-project_object-storage-data/,
  );
  assert.match(out, /minio-object-storage\.tgz/);
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
          if (cmd === "sha256sum") {
            return {
              status: 0,
              stdout: Buffer.from("abc  postgres.dump\ndef  object-storage.tgz\nghi  minio-object-storage.tgz\njkl  stage4l-backup-manifest.json\n"),
              stderr: Buffer.from(""),
            };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      },
    );
    assert.equal(result.ok, true);
    assert.equal(statSync(backupDir).mode & 0o777, 0o700);
    assert.match(readFileSync(join(backupDir, "postgres.dump"), "utf8"), /PGDUMP/);
    assert.match(readFileSync(join(backupDir, "SHA256SUMS"), "utf8"), /minio-object-storage\.tgz/);
    const manifest = JSON.parse(readFileSync(join(backupDir, "stage4l-backup-manifest.json"), "utf8"));
    assert.equal(manifest.stage, "4L");
    assert.equal(manifest.files.minioObjectStorageArchive, "minio-object-storage.tgz");
    assert.equal(manifest.files.checksums, "SHA256SUMS");
    assert.equal(calls.filter((cmd) => cmd.includes("alpine:3.20 tar -czf")).length, 2);
    assert.ok(calls.some((cmd) => cmd.includes("volume inspect demo-project_backend-object-storage")));
    assert.ok(calls.some((cmd) => cmd.includes("volume inspect demo-project_object-storage-data")));
    assert.ok(calls.some((cmd) => cmd.includes("pg_restore --list")));
    assert.doesNotMatch(JSON.stringify(manifest), /secret|password|object_key/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L backup fails closed before archive when a required object-storage volume is absent", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-missing-volume-"));
  try {
    const calls = [];
    assert.throws(
      () => runBackup(
        {
          command: "backup",
          backupDir: join(root, "backup"),
          projectName: "demo-project",
        },
        {
          spawn(cmd, args) {
            calls.push(`${cmd} ${args.join(" ")}`);
            if (args.includes("pg_dump")) {
              return { status: 0, stdout: Buffer.from("PGDUMP"), stderr: Buffer.from("") };
            }
            if (args.join(" ").includes("volume inspect demo-project_object-storage-data")) {
              return { status: 1, stdout: "", stderr: "missing volume" };
            }
            return { status: 0, stdout: "", stderr: "" };
          },
        },
      ),
      /Verify MinIO object storage volume exists failed: missing volume/,
    );
    assert.equal(calls.some((cmd) => cmd.includes("object-storage-data:/data:ro")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L backup refuses a corrupt object-storage archive", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-corrupt-archive-"));
  try {
    assert.throws(
      () => runBackup(
        {
          command: "backup",
          backupDir: join(root, "backup"),
          projectName: "demo-project",
        },
        {
          spawn(cmd, args) {
            if (args.includes("pg_dump")) {
              return { status: 0, stdout: Buffer.from("PGDUMP"), stderr: Buffer.from("") };
            }
            if (args.includes("-tzf") && args.includes("/backup/minio-object-storage.tgz")) {
              return { status: 1, stdout: "", stderr: "invalid archive" };
            }
            return { status: 0, stdout: "", stderr: "" };
          },
        },
      ),
      /Validate MinIO object storage archive failed: invalid archive/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L restore verifies checksums before stopping the stack", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-restore-checksum-"));
  try {
    for (const name of [
      "postgres.dump",
      "object-storage.tgz",
      "minio-object-storage.tgz",
      "stage4l-backup-manifest.json",
      "SHA256SUMS",
    ]) {
      writeFileSync(join(root, name), name);
    }
    const calls = [];
    assert.throws(
      () => runRestore(
        {
          command: "restore",
          backupDir: root,
          projectName: "demo-project",
          confirm: "RESTORE_SELF_HOSTED_DATA",
        },
        {
          spawn(cmd, args) {
            calls.push(`${cmd} ${args.join(" ")}`);
            if (cmd === "sha256sum") {
              return { status: 1, stdout: "postgres.dump: FAILED", stderr: "checksum mismatch" };
            }
            return { status: 0, stdout: "", stderr: "" };
          },
        },
      ),
      /Verify backup checksums before destructive restore failed: checksum mismatch/,
    );
    assert.equal(calls.some((cmd) => cmd.startsWith("docker ")), false);
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

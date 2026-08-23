import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { reconcileClinicalAssets } from "./stage4l-backup-consistency.mjs";
import {
  buildBackupPlan,
  buildRestorePlan,
  createProductionBackupIo,
  createProductionRestoreIo,
  parseStage4LOpsArgs,
  renderPlan,
  runBackup,
  runRestore,
  verifyEnvText,
} from "./stage4l-self-hosted-ops.mjs";

const PRODUCT_GIT_SHA = "59b49740feaea3667a75ca95b316965933152832";
const STAGE4L_GIT_SHA = "1c17f82a32a50115da2df7ad7c445fb93da551c9";

function backupOptions(backupDir, extra = {}) {
  return {
    command: "backup",
    backupDir,
    projectName: "demo-project",
    productGitSha: PRODUCT_GIT_SHA,
    stage4lGitSha: STAGE4L_GIT_SHA,
    ...extra,
  };
}

function cleanReconciliation() {
  return {
    danglingReferenceCount: 0,
    orphanPayloadCount: 0,
    payloadSidecarDefectCount: 0,
    checksumMismatchCount: 0,
    byteSizeMismatchCount: 0,
  };
}

function successfulLifecycle(events = []) {
  return {
    inventory() {
      events.push("inventory");
      return {
        writers: [{ id: "backend", kind: "compose", wasRunning: true }],
        unknownCount: 0,
      };
    },
    quiesce(inventory) {
      events.push("quiesce");
      return {
        writers: inventory.writers.map((writer) => ({ ...writer, stopped: true })),
        minio: { id: "object-storage", wasRunning: true, stopped: true },
        unknownCount: 0,
        forcedTerminationCount: 0,
        quiescedAt: "2026-08-20T10:00:00.000Z",
      };
    },
    resume() {
      events.push("resume");
      return { ok: true, resumedAt: "2026-08-20T10:01:00.000Z" };
    },
  };
}

test("Stage 4L cross-store reconciliation accepts matching asset payloads and sidecars", () => {
  const result = reconcileClinicalAssets({
    assets: [
      {
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/asset-a.jpg",
        checksumSha256: "aaaaaaaa",
        byteSize: 3,
      },
      {
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/asset-b.jpg",
        checksumSha256: null,
        byteSize: 4,
      },
    ],
    files: [
      {
        kind: "payload",
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/asset-a.jpg",
        checksumSha256: "aaaaaaaa",
        byteSize: 3,
      },
      { kind: "sidecar", objectBucket: "clinical-assets", objectKey: "clinics/demo/asset-a.jpg" },
      {
        kind: "payload",
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/asset-b.jpg",
        checksumSha256: "bbbbbbbb",
        byteSize: 4,
      },
      { kind: "sidecar", objectBucket: "clinical-assets", objectKey: "clinics/demo/asset-b.jpg" },
    ],
  });
  assert.deepEqual(result, {
    danglingReferenceCount: 0,
    orphanPayloadCount: 0,
    payloadSidecarDefectCount: 0,
    checksumMismatchCount: 0,
    byteSizeMismatchCount: 0,
  });
});

test("Stage 4L cross-store reconciliation reports all five defect classes deterministically", () => {
  const result = reconcileClinicalAssets({
    assets: [
      {
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/dangling.jpg",
        checksumSha256: "aaaaaaaa",
        byteSize: 1,
      },
      {
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/mismatch.jpg",
        checksumSha256: "bbbbbbbb",
        byteSize: 2,
      },
    ],
    files: [
      {
        kind: "payload",
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/mismatch.jpg",
        checksumSha256: "cccccccc",
        byteSize: 3,
      },
      { kind: "sidecar", objectBucket: "clinical-assets", objectKey: "clinics/demo/mismatch.jpg" },
      {
        kind: "payload",
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/orphan.jpg",
        checksumSha256: "dddddddd",
        byteSize: 4,
      },
      { kind: "sidecar", objectBucket: "clinical-assets", objectKey: "clinics/demo/orphan.jpg" },
      { kind: "sidecar", objectBucket: "clinical-assets", objectKey: "clinics/demo/sidecar-only.jpg" },
    ],
  });
  assert.deepEqual(result, {
    danglingReferenceCount: 1,
    orphanPayloadCount: 1,
    payloadSidecarDefectCount: 1,
    checksumMismatchCount: 1,
    byteSizeMismatchCount: 1,
  });
});

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
  assert.match(out, /Consistency: application_consistent_quiesced/);
  assert.match(out, /inventory -> quiesce writers -> stop MinIO -> capture -> reconcile -> resume/);
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

test("Stage 4L parser accepts explicit backup identity flags", () => {
  const parsed = parseStage4LOpsArgs([
    "backup",
    "--backup-set-id=q1-test-backup",
    `--product-git-sha=${PRODUCT_GIT_SHA}`,
    "--stage4l-git-sha",
    STAGE4L_GIT_SHA,
    "--quiescence-timeout-seconds=45",
  ]);
  assert.equal(parsed.backupSetId, "q1-test-backup");
  assert.equal(parsed.productGitSha, PRODUCT_GIT_SHA);
  assert.equal(parsed.stage4lGitSha, STAGE4L_GIT_SHA);
  assert.equal(parsed.quiescenceTimeoutSeconds, 45);
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
  assert.match(out, /verify-restored-app/);
  assert.doesNotMatch(out, /smoke:stage4k/);
  assert.throws(
    () => runRestore({ command: "restore", backupDir: "backups/self-hosted/test-run" }),
    /requires --confirm=RESTORE_SELF_HOSTED_DATA/,
  );
});

test("Stage 4L backup execution fails closed without a quiescence lifecycle adapter", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-quiescence-required-"));
  try {
    assert.throws(
      () => runBackup(
        {
          command: "backup",
          backupDir: join(root, "backup"),
          projectName: "demo-project",
        },
        {
          spawn() {
            return { status: 0, stdout: Buffer.from(""), stderr: Buffer.from("") };
          },
        },
      ),
      /quiescence lifecycle adapter is required/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L production adapter quiesces the live writers and reconciles stored assets", () => {
  const calls = [];
  let backendRunning = true;
  let minioRunning = true;
  const checksum = createHash("sha256").update("abc").digest("hex");
  const spawn = (cmd, args) => {
    const call = `${cmd} ${args.join(" ")}`;
    calls.push(call);
    if (call.includes("ps --services --status running")) {
      return { status: 0, stdout: "backend\nobject-storage\npostgres\nreverse-proxy\n", stderr: "" };
    }
    if (call.includes("ps -q --all backend")) {
      return { status: 0, stdout: "backend-container\n", stderr: "" };
    }
    if (call.includes("ps -q --all object-storage")) {
      return { status: 0, stdout: "minio-container\n", stderr: "" };
    }
    if (call.includes("inspect --format") && call.endsWith("backend-container")) {
      return {
        status: 0,
        stdout: `${backendRunning}\t${backendRunning ? 0 : 0}\tsha256:backend-image\n`,
        stderr: "",
      };
    }
    if (call.includes("inspect --format") && call.endsWith("minio-container")) {
      return {
        status: 0,
        stdout: `${minioRunning}\t${minioRunning ? 0 : 0}\tsha256:minio-image\n`,
        stderr: "",
      };
    }
    if (call.includes("compose") && call.includes("stop -t 30")) {
      backendRunning = false;
      minioRunning = false;
      return { status: 0, stdout: "", stderr: "" };
    }
    if (call.includes("compose") && call.includes("start backend object-storage")) {
      backendRunning = true;
      minioRunning = true;
      return { status: 0, stdout: "", stderr: "" };
    }
    if (call.includes("select object_bucket")) {
      return {
        status: 0,
        stdout: `clinical-assets\tclinics/demo/asset.jpg\t${checksum}\t3\n`,
        stderr: "",
      };
    }
    if (call.includes("sha256:backend-image node -e")) {
      return {
        status: 0,
        stdout: JSON.stringify([
          {
            kind: "payload",
            objectBucket: "clinical-assets",
            objectKey: "clinics/demo/asset.jpg",
            checksumSha256: checksum,
            byteSize: 3,
          },
          {
            kind: "sidecar",
            objectBucket: "clinical-assets",
            objectKey: "clinics/demo/asset.jpg",
          },
        ]),
        stderr: "",
      };
    }
    return { status: 0, stdout: "", stderr: "" };
  };
  const io = createProductionBackupIo(
    {
      command: "backup",
      projectName: "demo-project",
      composeFiles: ["compose.yml"],
      composeEnvFile: ".env.production",
    },
    { spawn, now: () => "2026-08-23T14:30:00.000Z" },
  );

  const inventory = io.lifecycle.inventory();
  assert.equal(inventory.unknownCount, 0);
  assert.deepEqual(inventory.writers.map((writer) => writer.id), ["backend"]);
  const evidence = io.lifecycle.quiesce(inventory, { timeoutSeconds: 30 });
  assert.equal(evidence.forcedTerminationCount, 0);
  assert.equal(backendRunning, false);
  assert.equal(minioRunning, false);
  assert.deepEqual(io.reconcile(), cleanReconciliation());
  assert.equal(io.lifecycle.resume().ok, true);
  assert.equal(backendRunning, true);
  assert.equal(minioRunning, true);
  assert.ok(calls.some((call) => call.includes("stop -t 30 backend object-storage")));
  assert.ok(calls.some((call) => call.includes("start backend object-storage")));
  assert.equal(calls.some((call) => call.includes("up -d --no-build")), false);
});

test("Stage 4L backup quiesces known writers and MinIO before capture, then resumes", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-quiesced-order-"));
  try {
    const events = [];
    const result = runBackup(
      backupOptions(join(root, "backup")),
      {
        lifecycle: {
          inventory() {
            events.push("inventory");
            return {
              writers: [{ id: "backend", kind: "compose", wasRunning: true }],
              unknownCount: 0,
            };
          },
          quiesce(inventory, context) {
            events.push("quiesce");
            assert.equal(context.timeoutSeconds, 30);
            return {
              writers: inventory.writers.map((writer) => ({ ...writer, stopped: true })),
              minio: { id: "object-storage", wasRunning: true, stopped: true },
              unknownCount: 0,
              forcedTerminationCount: 0,
              quiescedAt: "2026-08-20T10:00:00.000Z",
            };
          },
          resume() {
            events.push("resume");
            return { ok: true, resumedAt: "2026-08-20T10:01:00.000Z" };
          },
        },
        reconcile() {
          events.push("reconcile");
          return {
            danglingReferenceCount: 0,
            orphanPayloadCount: 0,
            payloadSidecarDefectCount: 0,
            checksumMismatchCount: 0,
            byteSizeMismatchCount: 0,
          };
        },
        spawn(cmd, args) {
          if (args.includes("pg_dump")) events.push("capture");
          if (args.includes("pg_dump")) {
            return { status: 0, stdout: Buffer.from("PGDUMP"), stderr: Buffer.from("") };
          }
          if (cmd === "sha256sum") {
            return { status: 0, stdout: Buffer.from("checksums"), stderr: Buffer.from("") };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      },
    );
    assert.equal(result.ok, true);
    assert.ok(events.indexOf("inventory") < events.indexOf("quiesce"));
    assert.ok(events.indexOf("quiesce") < events.indexOf("capture"));
    assert.ok(events.indexOf("capture") < events.indexOf("reconcile"));
    assert.ok(events.indexOf("reconcile") < events.indexOf("resume"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L backup rejects an unknown writer before quiescence or capture", () => {
  const events = [];
  assert.throws(
    () => runBackup(
      backupOptions("backups/self-hosted/unknown-writer"),
      {
        lifecycle: {
          inventory() {
            events.push("inventory");
            return {
              writers: [{ id: "backend", kind: "compose", wasRunning: true }],
              unknownCount: 1,
            };
          },
          quiesce() {
            events.push("quiesce");
          },
          resume() {
            events.push("resume");
          },
        },
        reconcile() {
          events.push("reconcile");
        },
        spawn() {
          events.push("capture");
          return { status: 0, stdout: "", stderr: "" };
        },
      },
    ),
    /unknown writer/i,
  );
  assert.deepEqual(events, ["inventory"]);
});

test("Stage 4L backup requires exact product and Stage 4L Git SHAs before writer inventory", () => {
  const events = [];
  assert.throws(
    () => runBackup(
      { command: "backup", backupDir: "backups/self-hosted/missing-shas", projectName: "demo-project" },
      {
        lifecycle: {
          inventory() {
            events.push("inventory");
          },
          quiesce() {},
          resume() {},
        },
        reconcile() {},
      },
    ),
    /exact 40-character product and Stage 4L Git SHAs/i,
  );
  assert.deepEqual(events, []);
});

test("Stage 4L backup rejects forced termination and still resumes before capture", () => {
  const events = [];
  assert.throws(
    () => runBackup(
      backupOptions("backups/self-hosted/forced-stop"),
      {
        lifecycle: {
          inventory() {
            events.push("inventory");
            return {
              writers: [{ id: "backend", kind: "compose", wasRunning: true }],
              unknownCount: 0,
            };
          },
          quiesce(inventory) {
            events.push("quiesce");
            return {
              writers: inventory.writers.map((writer) => ({ ...writer, stopped: true })),
              minio: { id: "object-storage", wasRunning: true, stopped: true },
              unknownCount: 0,
              forcedTerminationCount: 1,
              quiescedAt: "2026-08-20T10:00:00.000Z",
            };
          },
          resume() {
            events.push("resume");
            return { ok: true, resumedAt: "2026-08-20T10:01:00.000Z" };
          },
        },
        reconcile() {
          events.push("reconcile");
        },
        spawn() {
          events.push("capture");
          return { status: 0, stdout: "", stderr: "" };
        },
      },
    ),
    /forced termination/i,
  );
  assert.deepEqual(events, ["inventory", "quiesce", "resume"]);
});

test("Stage 4L backup rejects reconciliation defects before writing a manifest and resumes", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-reconciliation-fail-"));
  const backupDir = join(root, "backup");
  const events = [];
  try {
    assert.throws(
      () => runBackup(
        backupOptions(backupDir),
        {
          lifecycle: {
            inventory() {
              return {
                writers: [{ id: "backend", kind: "compose", wasRunning: true }],
                unknownCount: 0,
              };
            },
            quiesce(inventory) {
              return {
                writers: inventory.writers.map((writer) => ({ ...writer, stopped: true })),
                minio: { id: "object-storage", wasRunning: true, stopped: true },
                unknownCount: 0,
                forcedTerminationCount: 0,
                quiescedAt: "2026-08-20T10:00:00.000Z",
              };
            },
            resume() {
              events.push("resume");
              return { ok: true, resumedAt: "2026-08-20T10:01:00.000Z" };
            },
          },
          reconcile() {
            return {
              danglingReferenceCount: 0,
              orphanPayloadCount: 1,
              payloadSidecarDefectCount: 0,
              checksumMismatchCount: 0,
              byteSizeMismatchCount: 0,
            };
          },
          spawn(cmd, args) {
            if (args.includes("pg_dump")) {
              return { status: 0, stdout: Buffer.from("PGDUMP"), stderr: Buffer.from("") };
            }
            return { status: 0, stdout: "", stderr: "" };
          },
        },
      ),
      /cross-store reconciliation failed.*orphanPayloadCount/i,
    );
    assert.equal(existsSync(join(backupDir, "stage4l-backup-manifest.json")), false);
    assert.deepEqual(events, ["resume"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L quiesced backup writes manifest v2 and a checksum-bound completion receipt", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-backup-"));
  try {
    const backupDir = join(root, "backup");
    const calls = [];
    const result = runBackup(
      backupOptions(backupDir, { backupSetId: "q1-test-backup" }),
      {
        lifecycle: {
          inventory() {
            return {
              writers: [{ id: "backend", kind: "compose", wasRunning: true }],
              unknownCount: 0,
            };
          },
          quiesce(inventory) {
            return {
              writers: inventory.writers.map((writer) => ({ ...writer, stopped: true })),
              minio: { id: "object-storage", wasRunning: true, stopped: true },
              unknownCount: 0,
              forcedTerminationCount: 0,
              quiescedAt: "2026-08-20T10:00:00.000Z",
            };
          },
          resume() {
            return { ok: true, resumedAt: "2026-08-20T10:01:00.000Z" };
          },
        },
        reconcile() {
          return {
            danglingReferenceCount: 0,
            orphanPayloadCount: 0,
            payloadSidecarDefectCount: 0,
            checksumMismatchCount: 0,
            byteSizeMismatchCount: 0,
          };
        },
        now: (() => {
          const values = ["2026-08-20T09:59:00.000Z", "2026-08-20T10:00:30.000Z"];
          return () => values.shift();
        })(),
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
    const completion = JSON.parse(readFileSync(join(backupDir, "stage4l-backup-completion.json"), "utf8"));
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.stage, "4L");
    assert.equal(manifest.backupSetId, "q1-test-backup");
    assert.equal(manifest.classification, "application_consistent_quiesced");
    assert.equal(manifest.state, "CAPTURE_VALIDATED");
    assert.equal(manifest.productGitSha, PRODUCT_GIT_SHA);
    assert.equal(manifest.stage4lGitSha, STAGE4L_GIT_SHA);
    assert.equal(manifest.startedAt, "2026-08-20T09:59:00.000Z");
    assert.equal(manifest.captureFinishedAt, "2026-08-20T10:00:30.000Z");
    assert.deepEqual(manifest.writers.expected, ["backend"]);
    assert.deepEqual(manifest.writers.stopped, ["backend"]);
    assert.equal(manifest.writers.drainTimeoutSeconds, 30);
    assert.deepEqual(manifest.reconciliation, {
      danglingReferenceCount: 0,
      orphanPayloadCount: 0,
      payloadSidecarDefectCount: 0,
      checksumMismatchCount: 0,
      byteSizeMismatchCount: 0,
    });
    assert.equal(manifest.files.minioObjectStorageArchive, "minio-object-storage.tgz");
    assert.equal(manifest.files.checksums, "SHA256SUMS");
    assert.equal(completion.backupSetId, "q1-test-backup");
    assert.equal(completion.state, "SEALED_RESTORE_POINT");
    assert.equal(completion.resumedAt, "2026-08-20T10:01:00.000Z");
    assert.match(completion.backupChecksumsSha256, /^[a-f0-9]{64}$/);
    assert.equal(calls.filter((cmd) => cmd.includes("alpine:3.20 tar -czf")).length, 2);
    assert.ok(calls.some((cmd) => cmd.includes("volume inspect demo-project_backend-object-storage")));
    assert.ok(calls.some((cmd) => cmd.includes("volume inspect demo-project_object-storage-data")));
    assert.ok(calls.some((cmd) => cmd.includes("pg_restore --list")));
    assert.doesNotMatch(JSON.stringify({ manifest, completion }), /secret|password|object_key/i);
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
        backupOptions(join(root, "backup")),
        {
          lifecycle: successfulLifecycle(),
          reconcile: cleanReconciliation,
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
        backupOptions(join(root, "backup")),
        {
          lifecycle: successfulLifecycle(),
          reconcile: cleanReconciliation,
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

test("Stage 4L backup does not seal a restore point when service resume is not proven", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-resume-fail-"));
  const backupDir = join(root, "backup");
  try {
    const lifecycle = successfulLifecycle();
    lifecycle.resume = () => ({ ok: false, resumedAt: "" });
    assert.throws(
      () => runBackup(backupOptions(backupDir), {
        lifecycle,
        reconcile: cleanReconciliation,
        spawn(cmd, args) {
          if (args.includes("pg_dump")) {
            return { status: 0, stdout: Buffer.from("PGDUMP"), stderr: Buffer.from("") };
          }
          if (cmd === "sha256sum") {
            return { status: 0, stdout: Buffer.from("checksums"), stderr: Buffer.from("") };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      }),
      /did not prove a successful service resume/i,
    );
    assert.equal(existsSync(join(backupDir, "stage4l-backup-completion.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L backup resumes services after capture failure and does not seal the backup", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-capture-fail-"));
  const backupDir = join(root, "backup");
  const events = [];
  try {
    assert.throws(
      () => runBackup(backupOptions(backupDir), {
        lifecycle: successfulLifecycle(events),
        reconcile: cleanReconciliation,
        spawn(cmd, args) {
          if (args.includes("pg_dump")) {
            events.push("capture-fail");
            return { status: 1, stdout: "", stderr: "pg dump failed" };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      }),
      /Dump PostgreSQL database failed: pg dump failed/,
    );
    assert.deepEqual(events, ["inventory", "quiesce", "capture-fail", "resume"]);
    assert.equal(existsSync(join(backupDir, "stage4l-backup-completion.json")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L restore rejects an unsealed manifest v2 before any destructive command", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-unsealed-restore-"));
  try {
    for (const name of ["postgres.dump", "object-storage.tgz", "minio-object-storage.tgz", "SHA256SUMS"]) {
      writeFileSync(join(root, name), name);
    }
    writeFileSync(join(root, "stage4l-backup-manifest.json"), JSON.stringify({
      schemaVersion: 2,
      backupSetId: "q1-test-backup",
      state: "CAPTURE_VALIDATED",
    }));
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
            return { status: 0, stdout: "", stderr: "" };
          },
        },
      ),
      /sealed completion receipt/i,
    );
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L restore fails closed without a restored-application verifier", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-restore-verifier-required-"));
  try {
    for (const name of ["postgres.dump", "object-storage.tgz", "minio-object-storage.tgz", "SHA256SUMS"]) {
      writeFileSync(join(root, name), name);
    }
    writeFileSync(join(root, "stage4l-backup-manifest.json"), "{}");
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
            return { status: 0, stdout: "", stderr: "" };
          },
        },
      ),
      /restored-application verifier is required/i,
    );
    assert.deepEqual(calls, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L production restore verifier checks live health and readiness", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-production-restore-verify-"));
  try {
    const envFile = join(root, ".env.production");
    writeFileSync(envFile, "APP_PORT=8123\n");
    const calls = [];
    const io = createProductionRestoreIo(
      { composeEnvFile: envFile },
      {
        spawn(cmd, args) {
          calls.push(`${cmd} ${args.join(" ")}`);
          return { status: 0, stdout: "ok", stderr: "" };
        },
      },
    );
    assert.deepEqual(io.verifyRestoredApp(), { ok: true });
    assert.ok(calls.some((call) => call.includes("http://127.0.0.1:8123/healthz")));
    assert.ok(calls.some((call) => call.includes("http://127.0.0.1:8123/readyz")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4L restore accepts a matching v2 seal and still verifies checksums before Docker", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4l-sealed-restore-"));
  try {
    for (const name of ["postgres.dump", "object-storage.tgz", "minio-object-storage.tgz"]) {
      writeFileSync(join(root, name), name);
    }
    const checksumText = "bad-checksum  postgres.dump\n";
    writeFileSync(join(root, "SHA256SUMS"), checksumText);
    writeFileSync(join(root, "stage4l-backup-manifest.json"), JSON.stringify({
      schemaVersion: 2,
      backupSetId: "q1-test-backup",
      state: "CAPTURE_VALIDATED",
    }));
    writeFileSync(join(root, "stage4l-backup-completion.json"), JSON.stringify({
      schemaVersion: 1,
      backupSetId: "q1-test-backup",
      state: "SEALED_RESTORE_POINT",
      backupChecksumsSha256: createHash("sha256").update(checksumText).digest("hex"),
      resumedAt: "2026-08-20T10:01:00.000Z",
    }));
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
          verifyRestoredApp() {
            return { ok: true };
          },
          spawn(cmd, args) {
            calls.push(`${cmd} ${args.join(" ")}`);
            return { status: 1, stdout: "", stderr: "checksum mismatch" };
          },
        },
      ),
      /Verify backup checksums before destructive restore failed: checksum mismatch/,
    );
    assert.deepEqual(calls, ["sha256sum -c SHA256SUMS"]);
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
      "SHA256SUMS",
    ]) {
      writeFileSync(join(root, name), name);
    }
    writeFileSync(join(root, "stage4l-backup-manifest.json"), "{}");
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
          verifyRestoredApp() {
            return { ok: true };
          },
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

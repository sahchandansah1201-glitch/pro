import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildStage4MPlan,
  parseStage4MArgs,
  renderStage4MPlan,
  runStage4M,
} from "./stage4m-production-deploy-verify.mjs";

test("Stage 4M parser supports deployment commands and validates app port", () => {
  const parsed = parseStage4MArgs([
    "rollback-drill",
    "--dry-run",
    "--project-name=prod",
    "--app-port",
    "18080",
    "--backup-dir",
    "backups/self-hosted/20260514",
    "--run-id",
    "run-001",
    "--receipt",
    "tmp/receipt.json",
  ]);
  assert.equal(parsed.command, "rollback-drill");
  assert.equal(parsed.projectName, "prod");
  assert.equal(parsed.appPort, "18080");
  assert.equal(parsed.runId, "run-001");
  assert.equal(parsed.receiptPath, "tmp/receipt.json");
  assert.throws(() => parseStage4MArgs(["first-boot", "--app-port=abc"]), /numeric/);
});

test("Stage 4M first-boot plan includes env, build, compose config, start, health and readiness", () => {
  const out = renderStage4MPlan({
    command: "first-boot",
    dryRun: true,
    projectName: "prod",
    appPort: "8080",
  });
  assert.match(out, /ops:stage4l:verify-env/);
  assert.match(out, /npm run build/);
  assert.match(out, /\.stage4m-build\/frontend-next/);
  assert.match(out, /VITE_APP_MODE=production/);
  assert.match(out, /docker compose --env-file deploy\/self-hosted\/\.env\.production/);
  assert.match(out, /config --quiet/);
  assert.match(out, /up -d --build/);
  assert.match(out, /\/healthz/);
  assert.match(out, /\/readyz/);
  assert.match(out, /--retry 24 --retry-all-errors --retry-delay 5/);
  assert.doesNotMatch(out, /POSTGRES_PASSWORD=|JWT_SECRET=|Bearer\s+[A-Za-z0-9]/);
});

test("Stage 4M update plan backs up, pulls, installs, builds and restarts", () => {
  const out = renderStage4MPlan({
    command: "update",
    dryRun: true,
    projectName: "prod",
    appPort: "8080",
    backupRoot: "/opt/dermatolog-pro/backups",
  });
  assert.match(out, /Create pre-update backup/);
  assert.match(out, /git fetch origin main/);
  assert.match(out, /git pull --ff-only origin main/);
  assert.match(out, /Apply production schema migrations/);
  assert.match(out, /stage4m-self-hosted-schema-migrations\.mjs apply/);
  assert.match(out, /Verify admin clinic create\/edit database journey/);
  assert.match(out, /stage4m-admin-management-db-smoke\.mjs verify/);
  assert.match(out, /Verify doctor lead create\/update\/book database journey/);
  assert.match(out, /stage4m-doctor-lead-db-smoke\.mjs verify/);
  assert.match(out, /Verify assistant capture asset database journey/);
  assert.match(out, /stage4m-assistant-capture-db-smoke\.mjs verify/);
  assert.match(out, /Verify patient portal booking\/reminder database journey/);
  assert.match(out, /stage4m-patient-portal-db-smoke\.mjs verify/);
  assert.match(out, /npm ci --no-audit --no-fund/);
  assert.match(out, /npm run build/);
  assert.match(out, /builds into staging/);
  assert.match(out, /up -d --build/);
  assert.match(out, /\/healthz/);
  assert.match(out, /\/readyz/);
  assert.match(out, /retries transient 5xx/);
});

test("Stage 4M all plan includes post-deploy smoke and backup after deploy", () => {
  const plan = buildStage4MPlan({ command: "all", projectName: "prod" });
  const labels = plan.steps.map(([label]) => label);
  assert.ok(labels.includes("Run Stage 4K smoke against production project"));
  assert.ok(labels.includes("Create deployment backup"));
  assert.ok(labels.includes("Capture safe deployment status"));
});

test("Stage 4M rollback drill is dry-run first and requires confirmation to execute", () => {
  const out = renderStage4MPlan({
    command: "rollback-drill",
    dryRun: true,
    backupDir: "backups/self-hosted/latest",
  });
  assert.match(out, /restore --dry-run/);
  assert.match(out, /ROLLBACK_TO_SELF_HOSTED_BACKUP/);
  assert.throws(
    () => runStage4M({ command: "rollback-drill", backupDir: "backups/self-hosted/latest" }),
    /requires --confirm=ROLLBACK_TO_SELF_HOSTED_BACKUP/,
  );
});

test("Stage 4M runner writes a sanitized summary on success", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-"));
  try {
    const summaryPath = join(root, "summary.md");
    const receiptPath = join(root, "receipt.json");
    const calls = [];
    const result = runStage4M(
      {
        command: "post-deploy",
        summaryPath,
        receiptPath,
        projectName: "prod",
        appPort: "8080",
        runId: "test-run",
      },
      {
        spawn(cmd, args) {
          calls.push(`${cmd} ${args.join(" ")}`);
          return { status: 0, stdout: "ok", stderr: "" };
        },
      },
    );
    assert.equal(result.ok, true);
    assert.ok(calls.some((cmd) => cmd.includes("smoke:stage4k")));
    const summary = readFileSync(summaryPath, "utf8");
    assert.match(summary, /Status: `ok`/);
    assert.match(summary, /Run ID: `test-run`/);
    assert.match(summary, /Git HEAD before: `ok`/);
    assert.doesNotMatch(summary, /access_token|Authorization|Cookie|patient_full_name|storage_object_path/);
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    assert.equal(receipt.schemaVersion, "stage4m-production-deploy-receipt/v1");
    assert.equal(receipt.runId, "test-run");
    assert.equal(receipt.status, "ok");
    assert.equal(receipt.boundaries.rawCommandOutputStored, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4M runner updates latest summary and status while running", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-running-"));
  try {
    const summaryPath = join(root, "run", "summary.md");
    const latestSummaryPath = join(root, "latest-summary.md");
    const receiptPath = join(root, "run", "receipt.json");
    const latestReceiptPath = join(root, "latest-receipt.json");
    const statusPath = join(root, "run", "status.json");
    const latestStatusPath = join(root, "latest-status.json");
    const result = runStage4M(
      {
        command: "post-deploy",
        summaryPath,
        latestSummaryPath,
        receiptPath,
        latestReceiptPath,
        statusPath,
        latestStatusPath,
        projectName: "prod",
        appPort: "8080",
        runId: "running-run",
      },
      {
        spawn(cmd, args) {
          if (cmd === "npm" && args.includes("smoke:stage4k")) {
            const latestStatus = JSON.parse(readFileSync(latestStatusPath, "utf8"));
            assert.equal(latestStatus.status, "running");
            assert.equal(latestStatus.runId, "running-run");
          }
          return { status: 0, stdout: "ok", stderr: "" };
        },
      },
    );
    assert.equal(result.ok, true);
    assert.match(readFileSync(latestSummaryPath, "utf8"), /Status: `ok`/);
    assert.equal(JSON.parse(readFileSync(latestReceiptPath, "utf8")).status, "ok");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4M production frontend build injects required Vite env from env file", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-env-"));
  try {
    const envFile = join(root, ".env.production");
    const summaryPath = join(root, "summary.md");
    writeFileSync(
      envFile,
      [
        "VITE_APP_MODE=production",
        "VITE_SELF_HOSTED_API_BASE_URL=https://pro.example.test",
      ].join("\n"),
    );
    const buildCalls = [];
    const result = runStage4M(
      {
        command: "first-boot",
        summaryPath,
        receiptPath: join(root, "receipt.json"),
        projectName: "prod",
        appPort: "8080",
        envFile,
        cwd: root,
      },
      {
        spawn(cmd, args, options) {
          if (cmd === "npm" && args.slice(0, 2).join(" ") === "run build") {
            buildCalls.push(options.env);
            const outDir = args[args.indexOf("--outDir") + 1];
            mkdirSync(join(options.cwd, outDir), { recursive: true });
            writeFileSync(join(options.cwd, outDir, "index.html"), "<html></html>");
          }
          return { status: 0, stdout: "ok", stderr: "" };
        },
      },
    );
    assert.equal(result.ok, true);
    assert.equal(buildCalls.length, 1);
    assert.equal(buildCalls[0].VITE_APP_MODE, "production");
    assert.equal(buildCalls[0].VITE_SELF_HOSTED_API_BASE_URL, "https://pro.example.test");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4M safe frontend build preserves current dist when staged build fails", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-safe-build-"));
  try {
    const envFile = join(root, ".env.production");
    const summaryPath = join(root, "summary.md");
    mkdirSync(join(root, "dist"), { recursive: true });
    writeFileSync(join(root, "dist", "index.html"), "current frontend");
    writeFileSync(
      envFile,
      [
        "VITE_APP_MODE=production",
        "VITE_SELF_HOSTED_API_BASE_URL=https://pro.example.test",
      ].join("\n"),
    );
    assert.throws(
      () => runStage4M(
        {
          command: "first-boot",
          summaryPath,
          receiptPath: join(root, "receipt.json"),
          projectName: "prod",
          appPort: "8080",
          envFile,
          cwd: root,
        },
        {
          spawn(cmd, args) {
            if (cmd === "npm" && args.slice(0, 2).join(" ") === "run build") {
              return { status: 1, stdout: "build failed", stderr: "" };
            }
            return { status: 0, stdout: "ok", stderr: "" };
          },
        },
      ),
      /Build frontend safely with production auth gate failed/,
    );
    assert.equal(readFileSync(join(root, "dist", "index.html"), "utf8"), "current frontend");
    assert.ok(readFileSync(summaryPath, "utf8").includes("Status: `fail`"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4M production frontend build rejects missing production mode", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-env-missing-"));
  try {
    const envFile = join(root, ".env.production");
    const summaryPath = join(root, "summary.md");
    writeFileSync(envFile, "VITE_SELF_HOSTED_API_BASE_URL=https://pro.example.test\n");
    assert.throws(
      () => runStage4M(
        {
          command: "first-boot",
          summaryPath,
          receiptPath: join(root, "receipt.json"),
          projectName: "prod",
          appPort: "8080",
          envFile,
        },
        {
          spawn() {
            return { status: 0, stdout: "ok", stderr: "" };
          },
        },
      ),
      /Production frontend build env is missing: VITE_APP_MODE/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4M CLI dry-run exits zero", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/stage4m-production-deploy-verify.mjs", "all", "--dry-run"],
    { cwd: process.cwd(), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /all plan/);
  assert.match(result.stdout, /smoke:stage4k/);
});

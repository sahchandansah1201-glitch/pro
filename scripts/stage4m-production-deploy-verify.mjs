#!/usr/bin/env node
// Stage 4M · Production deployment verification.
// Plans and optionally runs first-boot, post-deploy, backup-after-deploy,
// and rollback-drill checks for the self-hosted product.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_PROJECT_NAME = "dermatolog-pro-production";
const DEFAULT_APP_PORT = "8080";
const DEFAULT_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_BACKUP_ROOT = "backups/self-hosted";
const DEFAULT_SUMMARY_PATH = "test-results/stage4m-production-deploy-report.md";
const DEFAULT_RECEIPT_PATH = "test-results/stage4m-production-deploy-receipt.json";
const BASE_COMPOSE = "deploy/self-hosted/docker-compose.stage4a.yml";
const PROD_COMPOSE = "deploy/self-hosted/docker-compose.production.example.yml";
const DIST_DIR = "dist";
const SAFE_BUILD_OUT_DIR = ".stage4m-build/frontend-next";
const ROLLBACK_CONFIRM = "ROLLBACK_TO_SELF_HOSTED_BACKUP";
const REQUIRED_PRODUCTION_BUILD_ENV = {
  VITE_APP_MODE: "production",
};
const REQUIRED_PRODUCTION_FRONTEND_KEYS = ["VITE_APP_MODE", "VITE_SELF_HOSTED_API_BASE_URL"];

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function redact(value) {
  return String(value || "")
    .replace(/(POSTGRES_PASSWORD|JWT_SECRET|MINIO_ROOT_PASSWORD)=([^\s]+)/g, "$1=[redacted]")
    .replace(/postgres:\/\/([^:]+):([^@]+)@/g, "postgres://$1:[redacted]@")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]")
    .replace(/--confirm=ROLLBACK_TO_SELF_HOSTED_BACKUP/g, "--confirm=[required]");
}

function isoNow() {
  return new Date().toISOString();
}

function safeRunId() {
  return isoNow().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function safeGitValue(args, { cwd = process.cwd(), spawn = spawnSync } = {}) {
  const result = spawn("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
  });
  if (result.error || result.status !== 0) return "unknown";
  return String(result.stdout || "").trim() || "unknown";
}

function gitSnapshot({ cwd = process.cwd(), spawn = spawnSync } = {}) {
  return {
    head: safeGitValue(["rev-parse", "--short", "HEAD"], { cwd, spawn }),
    branch: safeGitValue(["branch", "--show-current"], { cwd, spawn }),
  };
}

function composeArgs(options, args) {
  return [
    "compose",
    "--env-file",
    options.envFile,
    "-f",
    BASE_COMPOSE,
    "-f",
    PROD_COMPOSE,
    "-p",
    options.projectName,
    ...args,
  ];
}

export function parseStage4MArgs(argv = []) {
  const parsed = {
    command: argv[0] || "help",
    dryRun: false,
    projectName: DEFAULT_PROJECT_NAME,
    appPort: DEFAULT_APP_PORT,
    envFile: DEFAULT_ENV_FILE,
    backupRoot: DEFAULT_BACKUP_ROOT,
    backupDir: `${DEFAULT_BACKUP_ROOT}/latest`,
    summaryPath: DEFAULT_SUMMARY_PATH,
    latestSummaryPath: "",
    receiptPath: DEFAULT_RECEIPT_PATH,
    latestReceiptPath: "",
    statusPath: "",
    latestStatusPath: "",
    runId: "",
    confirm: "",
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--project-name") {
      parsed.projectName = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--project-name=")) {
      parsed.projectName = arg.slice("--project-name=".length).trim();
      continue;
    }
    if (arg === "--app-port") {
      parsed.appPort = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--app-port=")) {
      parsed.appPort = arg.slice("--app-port=".length).trim();
      continue;
    }
    if (arg === "--env-file") {
      parsed.envFile = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--env-file=")) {
      parsed.envFile = arg.slice("--env-file=".length).trim();
      continue;
    }
    if (arg === "--backup-root") {
      parsed.backupRoot = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--backup-root=")) {
      parsed.backupRoot = arg.slice("--backup-root=".length).trim();
      continue;
    }
    if (arg === "--backup-dir") {
      parsed.backupDir = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--backup-dir=")) {
      parsed.backupDir = arg.slice("--backup-dir=".length).trim();
      continue;
    }
    if (arg === "--summary") {
      parsed.summaryPath = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--summary=")) {
      parsed.summaryPath = arg.slice("--summary=".length).trim();
      continue;
    }
    if (arg === "--latest-summary") {
      parsed.latestSummaryPath = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--latest-summary=")) {
      parsed.latestSummaryPath = arg.slice("--latest-summary=".length).trim();
      continue;
    }
    if (arg === "--receipt") {
      parsed.receiptPath = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--receipt=")) {
      parsed.receiptPath = arg.slice("--receipt=".length).trim();
      continue;
    }
    if (arg === "--latest-receipt") {
      parsed.latestReceiptPath = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--latest-receipt=")) {
      parsed.latestReceiptPath = arg.slice("--latest-receipt=".length).trim();
      continue;
    }
    if (arg === "--status-json") {
      parsed.statusPath = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--status-json=")) {
      parsed.statusPath = arg.slice("--status-json=".length).trim();
      continue;
    }
    if (arg === "--latest-status-json") {
      parsed.latestStatusPath = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--latest-status-json=")) {
      parsed.latestStatusPath = arg.slice("--latest-status-json=".length).trim();
      continue;
    }
    if (arg === "--run-id") {
      parsed.runId = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--run-id=")) {
      parsed.runId = arg.slice("--run-id=".length).trim();
      continue;
    }
    if (arg === "--confirm") {
      parsed.confirm = String(argv[++index] || "");
      continue;
    }
    if (arg.startsWith("--confirm=")) {
      parsed.confirm = arg.slice("--confirm=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["help", "first-boot", "post-deploy", "backup-after-deploy", "rollback-drill", "update", "all"].includes(parsed.command)) {
    throw new Error(`Unknown Stage 4M command: ${parsed.command}`);
  }
  if (!/^\d{2,5}$/.test(parsed.appPort)) throw new Error("APP port must be numeric.");
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.envFile) throw new Error("env file is required.");
  if (!parsed.backupRoot) throw new Error("backup root is required.");
  if (!parsed.summaryPath) throw new Error("summary path is required.");
  if (!parsed.receiptPath) throw new Error("receipt path is required.");
  return parsed;
}

function parseEnvText(text = "") {
  const entries = {};
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    entries[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
  return entries;
}

function readEnvFile(envFile) {
  if (!existsSync(envFile)) throw new Error(`Env file not found: ${envFile}`);
  return parseEnvText(readFileSync(envFile, "utf8"));
}

function productionBuildEnv(envFile) {
  const entries = readEnvFile(envFile);
  const missing = REQUIRED_PRODUCTION_FRONTEND_KEYS.filter((key) => !entries[key]);
  if (missing.length) {
    throw new Error(`Production frontend build env is missing: ${missing.join(", ")}`);
  }
  for (const [key, expected] of Object.entries(REQUIRED_PRODUCTION_BUILD_ENV)) {
    if (entries[key] !== expected) {
      throw new Error(`${key} must be ${expected} for production frontend builds.`);
    }
  }
  if (!/^https?:\/\//i.test(entries.VITE_SELF_HOSTED_API_BASE_URL)) {
    throw new Error("VITE_SELF_HOSTED_API_BASE_URL must start with http:// or https://.");
  }
  return { ...process.env, ...entries };
}

function buildFrontendStep(options) {
  return [
    "Build frontend safely with production auth gate",
    npmCmd(),
    ["run", "build", "--", "--outDir", SAFE_BUILD_OUT_DIR, "--emptyOutDir"],
    {
      envFromFile: options.envFile,
      safeFrontendBuild: true,
      note: "uses VITE_APP_MODE=production and VITE_SELF_HOSTED_API_BASE_URL, builds into staging, verifies index.html, then publishes to dist without erasing the current frontend on failure",
    },
  ];
}

function httpCheckStep(label, url) {
  return [
    label,
    "curl",
    ["--retry", "24", "--retry-all-errors", "--retry-delay", "5", "-fsS", url],
    {
      note: "retries transient 5xx/connection failures while containers finish starting",
    },
  ];
}

function firstBootSteps(options) {
  return [
    ["Verify production env", npmCmd(), ["run", "ops:stage4l:verify-env", "--", "--env-file", options.envFile]],
    buildFrontendStep(options),
    ["Validate compose config", "docker", composeArgs(options, ["config", "--quiet"])],
    ["Start production compose stack", "docker", composeArgs(options, ["up", "-d", "--build"])],
    httpCheckStep("Health check", `http://127.0.0.1:${options.appPort}/healthz`),
    httpCheckStep("Readiness check", `http://127.0.0.1:${options.appPort}/readyz`),
  ];
}

function updateSteps(options) {
  return [
    ["Verify production env", npmCmd(), ["run", "ops:stage4l:verify-env", "--", "--env-file", options.envFile]],
    ["Create pre-update backup", "node", [
      "scripts/stage4l-self-hosted-ops.mjs",
      "backup",
      "--project-name",
      options.projectName,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
      "--compose-env-file",
      options.envFile,
      "--backup-root",
      options.backupRoot,
    ]],
    ["Fetch latest main", "git", ["fetch", "origin", "main"]],
    ["Switch to main", "git", ["checkout", "main"]],
    ["Pull latest main", "git", ["pull", "--ff-only", "origin", "main"]],
    ["Apply production schema migrations", "node", [
      "scripts/stage4m-self-hosted-schema-migrations.mjs",
      "apply",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify admin clinic create/edit database journey", "node", [
      "scripts/stage4m-admin-management-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify admin service catalog database journey", "node", [
      "scripts/stage4m-admin-services-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify admin integrations and bot database journey", "node", [
      "scripts/stage4m-admin-integrations-bot-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify doctor lead create/update/book database journey", "node", [
      "scripts/stage4m-doctor-lead-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify doctor patient create/edit/archive database journey", "node", [
      "scripts/stage4m-doctor-patient-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify doctor visit/report database journey", "node", [
      "scripts/stage4m-doctor-visit-report-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify assistant capture asset database journey", "node", [
      "scripts/stage4m-assistant-capture-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify patient portal booking/reminder database journey", "node", [
      "scripts/stage4m-patient-portal-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Verify public analysis link database journey", "node", [
      "scripts/stage4m-public-analysis-db-smoke.mjs",
      "verify",
      "--project-name",
      options.projectName,
      "--compose-env-file",
      options.envFile,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
    ]],
    ["Install locked dependencies", npmCmd(), ["ci", "--no-audit", "--no-fund"]],
    buildFrontendStep(options),
    ["Validate compose config", "docker", composeArgs(options, ["config", "--quiet"])],
    ["Restart production compose stack", "docker", composeArgs(options, ["up", "-d", "--build"])],
    httpCheckStep("Health check", `http://127.0.0.1:${options.appPort}/healthz`),
    httpCheckStep("Readiness check", `http://127.0.0.1:${options.appPort}/readyz`),
    ["Frontend HTML check", "curl", ["-fsSI", `http://127.0.0.1:${options.appPort}/`]],
    ["Check compose services", "docker", composeArgs(options, ["ps"])],
  ];
}

function postDeploySteps(options) {
  return [
    ["Run Stage 4K smoke against production project", npmCmd(), [
      "run",
      "smoke:stage4k",
      "--",
      "--skip-build",
      "--app-port",
      options.appPort,
      "--project-name",
      options.projectName,
      "--summary",
      "test-results/stage4m-post-deploy-smoke.md",
    ]],
    ["Check compose services", "docker", composeArgs(options, ["ps"])],
    ["Capture safe deployment status", "docker", composeArgs(options, ["logs", "--tail", "80", "--no-color", "backend"])],
  ];
}

function backupAfterDeploySteps(options) {
  return [
    ["Create deployment backup", "node", [
      "scripts/stage4l-self-hosted-ops.mjs",
      "backup",
      "--project-name",
      options.projectName,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
      "--compose-env-file",
      options.envFile,
      "--backup-root",
      options.backupRoot,
    ]],
  ];
}

function rollbackDrillSteps(options) {
  return [
    ["Dry-run rollback restore plan", "node", [
      "scripts/stage4l-self-hosted-ops.mjs",
      "restore",
      "--dry-run",
      "--project-name",
      options.projectName,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
      "--compose-env-file",
      options.envFile,
      "--backup-dir",
      options.backupDir,
    ]],
    ["Run rollback restore", "node", [
      "scripts/stage4l-self-hosted-ops.mjs",
      "restore",
      "--project-name",
      options.projectName,
      "--compose-file",
      BASE_COMPOSE,
      "--compose-file",
      PROD_COMPOSE,
      "--compose-env-file",
      options.envFile,
      "--backup-dir",
      options.backupDir,
      `--confirm=${ROLLBACK_CONFIRM}`,
    ]],
  ];
}

export function buildStage4MPlan(options = {}) {
  const config = { ...parseStage4MArgs(["first-boot"]), ...options };
  const steps = [];
  if (config.command === "first-boot" || config.command === "all") steps.push(...firstBootSteps(config));
  if (config.command === "post-deploy" || config.command === "all") steps.push(...postDeploySteps(config));
  if (config.command === "backup-after-deploy" || config.command === "all") steps.push(...backupAfterDeploySteps(config));
  if (config.command === "update") steps.push(...updateSteps(config));
  if (config.command === "rollback-drill") steps.push(...rollbackDrillSteps(config));
  return { config, steps };
}

export function renderStage4MPlan(options = {}) {
  const { config, steps } = buildStage4MPlan(options);
  const lines = [
    `[stage4m-deploy] ${config.command} plan`,
    "",
    `- Project: ${config.projectName}`,
    `- App port: ${config.appPort}`,
    `- Env file: ${config.envFile}`,
    `- Backup dir: ${config.backupDir}`,
  ];
  if (config.command === "rollback-drill") {
    lines.push(`- Rollback confirmation required: ${ROLLBACK_CONFIRM}`);
  }
  lines.push("", "## Steps");
  for (const [label, cmd, args, meta] of steps) {
    const note = meta?.note ? ` (${meta.note})` : "";
    lines.push(`- ${label}: \`${cmd} ${args.join(" ")}\`${note}`);
  }
  lines.push("", "No raw tokens, passwords, object keys, storage paths, or patient names are printed.");
  return redact(lines.join("\n"));
}

function runStep([label, cmd, args, meta], { spawn = spawnSync } = {}) {
  console.log(`[stage4m-deploy] START — ${label}`);
  const env = meta?.envFromFile ? productionBuildEnv(meta.envFromFile) : process.env;
  const cwd = meta?.cwd || process.cwd();
  const result = meta?.safeFrontendBuild
    ? runSafeFrontendBuildStep({ label, cmd, args, cwd, env, spawn })
    : spawn(cmd, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "inherit", "inherit"],
      env,
      maxBuffer: 20 * 1024 * 1024,
    });
  if (result.error || result.status !== 0) {
    console.error(`[stage4m-deploy] FAIL — ${label}`);
    throw new Error(redact(`${label} failed: ${result.error?.message || result.stderr || result.stdout || `exit ${result.status}`}`));
  }
  console.log(`[stage4m-deploy] OK — ${label}`);
  return {
    label,
    ok: true,
    output: redact(`${result.stdout || ""}${result.stderr || ""}`.trim()).slice(0, 4000),
  };
}

function publishStagedFrontend({ cwd, stagingDir = SAFE_BUILD_OUT_DIR, distDir = DIST_DIR } = {}) {
  const stagingPath = join(cwd, stagingDir);
  const distPath = join(cwd, distDir);
  const stagingIndex = join(stagingPath, "index.html");
  if (!existsSync(stagingIndex)) {
    throw new Error(`staged frontend is missing index.html: ${stagingDir}/index.html`);
  }
  mkdirSync(distPath, { recursive: true });
  for (const entry of readdirSync(stagingPath, { withFileTypes: true })) {
    if (entry.name === "index.html") continue;
    cpSync(join(stagingPath, entry.name), join(distPath, entry.name), { recursive: true, force: true });
  }
  cpSync(stagingIndex, join(distPath, "index.html"), { force: true });
  if (!existsSync(join(distPath, "index.html"))) {
    throw new Error("published frontend is missing dist/index.html");
  }
}

function runSafeFrontendBuildStep({ label, cmd, args, cwd, env, spawn }) {
  const stagingPath = join(cwd, SAFE_BUILD_OUT_DIR);
  rmSync(stagingPath, { recursive: true, force: true });
  const result = spawn(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
    env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    rmSync(stagingPath, { recursive: true, force: true });
    return result;
  }
  try {
    publishStagedFrontend({ cwd });
  } catch (error) {
    rmSync(stagingPath, { recursive: true, force: true });
    throw new Error(`${label} failed: ${error.message}`);
  }
  rmSync(stagingPath, { recursive: true, force: true });
  return result;
}

function writeSummary(path, payload) {
  mkdirSync(dirname(path), { recursive: true });
  const lines = [
    "## Stage 4M production deployment verification",
    "",
    `- Status: \`${payload.status}\``,
    `- Run ID: \`${payload.runId}\``,
    `- Command: \`${payload.command}\``,
    `- Project: \`${payload.projectName}\``,
    `- Env file: \`${payload.envFile}\``,
    `- Started: \`${payload.startedAt}\``,
    `- Finished: \`${payload.finishedAt || "running"}\``,
    `- Git HEAD before: \`${payload.git?.before?.head || "unknown"}\``,
    `- Git HEAD after: \`${payload.git?.after?.head || "unknown"}\``,
    "",
    "## Results",
  ];
  for (const result of payload.results) {
    lines.push(`- ${result.ok ? "OK" : "FAIL"} — ${result.label}`);
  }
  lines.push("", "Secrets and patient data are redacted from this report.");
  writeFileSync(path, redact(lines.join("\n")));
}

function writeJson(path, payload) {
  if (!path) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, redact(`${JSON.stringify(payload, null, 2)}\n`));
}

function writeReceipt(config, payload) {
  const receipt = {
    schemaVersion: "stage4m-production-deploy-receipt/v1",
    runId: payload.runId,
    status: payload.status,
    command: payload.command,
    projectName: payload.projectName,
    envFile: payload.envFile,
    startedAt: payload.startedAt,
    finishedAt: payload.finishedAt || null,
    git: payload.git,
    results: payload.results.map((result) => ({
      label: result.label,
      ok: Boolean(result.ok),
    })),
    boundaries: {
      secretsRedacted: true,
      patientDataIncluded: false,
      rawEnvIncluded: false,
      rawCommandOutputStored: false,
    },
  };
  writeJson(config.receiptPath, receipt);
  if (config.latestReceiptPath) writeJson(config.latestReceiptPath, receipt);
  if (config.statusPath) writeJson(config.statusPath, receipt);
  if (config.latestStatusPath) writeJson(config.latestStatusPath, receipt);
}

function writeRunArtifacts(config, payload) {
  writeSummary(config.summaryPath, payload);
  if (config.latestSummaryPath) writeSummary(config.latestSummaryPath, payload);
  writeReceipt(config, payload);
}

export function runStage4M(options = {}, io = {}) {
  const config = { ...parseStage4MArgs(["first-boot"]), ...options };
  config.runId = config.runId || safeRunId();
  if (config.command === "rollback-drill" && !config.dryRun && config.confirm !== ROLLBACK_CONFIRM) {
    throw new Error(`rollback-drill requires --confirm=${ROLLBACK_CONFIRM}`);
  }
  const { steps } = buildStage4MPlan(config);
  if (config.dryRun) {
    return { ok: true, dryRun: true, output: renderStage4MPlan(config), steps };
  }
  const results = [];
  const startedAt = isoNow();
  const before = gitSnapshot({ cwd: config.cwd || process.cwd(), spawn: io.spawn || spawnSync });
  try {
    writeRunArtifacts(config, {
      status: "running",
      runId: config.runId,
      command: config.command,
      projectName: config.projectName,
      envFile: config.envFile,
      startedAt,
      finishedAt: "",
      git: { before, after: before },
      results,
    });
    for (const step of steps) {
      const [label, cmd, args, meta] = step;
      results.push(runStep([label, cmd, args, { ...meta, cwd: config.cwd || process.cwd() }], io));
      writeRunArtifacts(config, {
        status: "running",
        runId: config.runId,
        command: config.command,
        projectName: config.projectName,
        envFile: config.envFile,
        startedAt,
        finishedAt: "",
        git: { before, after: gitSnapshot({ cwd: config.cwd || process.cwd(), spawn: io.spawn || spawnSync }) },
        results,
      });
    }
    const after = gitSnapshot({ cwd: config.cwd || process.cwd(), spawn: io.spawn || spawnSync });
    writeRunArtifacts(config, {
      status: "ok",
      runId: config.runId,
      command: config.command,
      projectName: config.projectName,
      envFile: config.envFile,
      startedAt,
      finishedAt: isoNow(),
      git: { before, after },
      results,
    });
    return { ok: true, dryRun: false, results };
  } catch (error) {
    results.push({ label: "failure", ok: false });
    const after = gitSnapshot({ cwd: config.cwd || process.cwd(), spawn: io.spawn || spawnSync });
    writeRunArtifacts(config, {
      status: "fail",
      runId: config.runId,
      command: config.command,
      projectName: config.projectName,
      envFile: config.envFile,
      startedAt,
      finishedAt: isoNow(),
      git: { before, after },
      results,
    });
    throw error;
  }
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4m-production-deploy-verify.mjs first-boot --dry-run",
    "  node scripts/stage4m-production-deploy-verify.mjs post-deploy --dry-run",
    "  node scripts/stage4m-production-deploy-verify.mjs backup-after-deploy --dry-run",
    "  node scripts/stage4m-production-deploy-verify.mjs update --dry-run --backup-root /opt/dermatolog-pro/backups",
    "  node scripts/stage4m-production-deploy-verify.mjs rollback-drill --dry-run --backup-dir backups/self-hosted/<timestamp>",
    "  node scripts/stage4m-production-deploy-verify.mjs rollback-drill --backup-dir <dir> --confirm=ROLLBACK_TO_SELF_HOSTED_BACKUP",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseStage4MArgs(argv);
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    const result = runStage4M(options);
    if (result.dryRun) {
      console.log(result.output);
      return 0;
    }
    console.log(`[stage4m-deploy] ${options.command} OK`);
    return 0;
  } catch (error) {
    console.error(`[stage4m-deploy] failed: ${redact(error?.message || error)}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

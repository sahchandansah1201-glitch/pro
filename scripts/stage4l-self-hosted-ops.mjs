#!/usr/bin/env node
// Stage 4L · Self-hosted operations helpers.
// Dry-run-first backup/restore/env verification for the single-server product.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_COMPOSE_FILE = "deploy/self-hosted/docker-compose.stage4a.yml";
const DEFAULT_PROJECT_NAME = "dermatolog-pro-stage4l-ops";
const DEFAULT_BACKUP_ROOT = "backups/self-hosted";
const DEFAULT_ENV_FILE = "deploy/self-hosted/.env.production.example";
const RESTORE_CONFIRMATION = "RESTORE_SELF_HOSTED_DATA";

const REQUIRED_ENV_KEYS = [
  "APP_PORT",
  "POSTGRES_PASSWORD",
  "JWT_SECRET",
  "DEVICE_BRIDGE_WORKER_TOKEN",
  "JWT_EXPIRES_IN_SECONDS",
  "OBJECT_STORAGE_BUCKET",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
  "MINIO_CONSOLE_PORT",
  "BACKUP_RETENTION_DAYS",
];

const PLACEHOLDER_PATTERN = /(change-me|replace-me|example|local_password|password_here|secret_here)/i;

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function dockerComposeArgs(composeFiles, projectName, args, composeEnvFile = "") {
  const files = Array.isArray(composeFiles) ? composeFiles : [composeFiles];
  const prefix = ["compose"];
  if (composeEnvFile) prefix.push("--env-file", composeEnvFile);
  for (const file of files) prefix.push("-f", file);
  return [...prefix, "-p", projectName, ...args];
}

function redact(value) {
  return String(value || "")
    .replace(/(POSTGRES_PASSWORD|JWT_SECRET|DEVICE_BRIDGE_WORKER_TOKEN|MINIO_ROOT_PASSWORD)=([^\s]+)/g, "$1=[redacted]")
    .replace(/postgres:\/\/([^:]+):([^@]+)@/g, "postgres://$1:[redacted]@")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]");
}

function safePath(value, fallback) {
  const raw = String(value || fallback || "").trim();
  if (!raw || raw.includes("\0")) throw new Error("Path contains an unsafe value.");
  return raw;
}

export function parseStage4LOpsArgs(argv = []) {
  const parsed = {
    command: argv[0] || "help",
    dryRun: false,
    composeFile: DEFAULT_COMPOSE_FILE,
    composeFiles: [DEFAULT_COMPOSE_FILE],
    composeEnvFile: "",
    projectName: DEFAULT_PROJECT_NAME,
    backupRoot: DEFAULT_BACKUP_ROOT,
    backupDir: "",
    envFile: DEFAULT_ENV_FILE,
    confirm: "",
    summaryPath: "",
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--compose-file") {
      const value = safePath(argv[++index], DEFAULT_COMPOSE_FILE);
      parsed.composeFiles = parsed.composeFiles[0] === DEFAULT_COMPOSE_FILE && parsed.composeFiles.length === 1
        ? [value]
        : [...parsed.composeFiles, value];
      parsed.composeFile = parsed.composeFiles[0];
      continue;
    }
    if (arg.startsWith("--compose-file=")) {
      const value = safePath(arg.slice("--compose-file=".length), DEFAULT_COMPOSE_FILE);
      parsed.composeFiles = parsed.composeFiles[0] === DEFAULT_COMPOSE_FILE && parsed.composeFiles.length === 1
        ? [value]
        : [...parsed.composeFiles, value];
      parsed.composeFile = parsed.composeFiles[0];
      continue;
    }
    if (arg === "--compose-env-file") {
      parsed.composeEnvFile = safePath(argv[++index], "");
      continue;
    }
    if (arg.startsWith("--compose-env-file=")) {
      parsed.composeEnvFile = safePath(arg.slice("--compose-env-file=".length), "");
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
    if (arg === "--backup-root") {
      parsed.backupRoot = safePath(argv[++index], DEFAULT_BACKUP_ROOT);
      continue;
    }
    if (arg.startsWith("--backup-root=")) {
      parsed.backupRoot = safePath(arg.slice("--backup-root=".length), DEFAULT_BACKUP_ROOT);
      continue;
    }
    if (arg === "--backup-dir") {
      parsed.backupDir = safePath(argv[++index], "");
      continue;
    }
    if (arg.startsWith("--backup-dir=")) {
      parsed.backupDir = safePath(arg.slice("--backup-dir=".length), "");
      continue;
    }
    if (arg === "--env-file") {
      parsed.envFile = safePath(argv[++index], DEFAULT_ENV_FILE);
      continue;
    }
    if (arg.startsWith("--env-file=")) {
      parsed.envFile = safePath(arg.slice("--env-file=".length), DEFAULT_ENV_FILE);
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
    if (arg === "--summary") {
      parsed.summaryPath = safePath(argv[++index], "");
      continue;
    }
    if (arg.startsWith("--summary=")) {
      parsed.summaryPath = safePath(arg.slice("--summary=".length), "");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["help", "backup", "restore", "verify-env"].includes(parsed.command)) {
    throw new Error(`Unknown Stage 4L command: ${parsed.command}`);
  }
  if (!parsed.projectName) throw new Error("project name is required.");
  return parsed;
}

export function backupDirFor(options = {}) {
  if (options.backupDir) return options.backupDir;
  return `${options.backupRoot || DEFAULT_BACKUP_ROOT}/${timestamp()}`;
}

export function buildBackupPlan(options = {}) {
  const config = { ...parseStage4LOpsArgs(["backup"]), ...options };
  const backupDir = backupDirFor(config);
  const absBackupDir = resolve(backupDir);
  return {
    type: "backup",
    backupDir,
    files: {
      postgresDump: `${backupDir}/postgres.dump`,
      objectStorageArchive: `${backupDir}/object-storage.tgz`,
      manifest: `${backupDir}/stage4l-backup-manifest.json`,
    },
    steps: [
      {
        label: "Create backup directory",
        cmd: "mkdir",
        args: ["-p", backupDir],
      },
      {
        label: "Dump PostgreSQL database",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, [
          "exec",
          "-T",
          "postgres",
          "pg_dump",
          "-U",
          "dermatolog",
          "-d",
          "dermatolog_pro",
          "--format=custom",
          "--no-owner",
          "--no-acl",
        ], config.composeEnvFile),
        stdoutFile: `${backupDir}/postgres.dump`,
      },
      {
        label: "Archive backend-owned object storage volume",
        cmd: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          `${config.projectName}_backend-object-storage:/data:ro`,
          "-v",
          `${absBackupDir}:/backup`,
          "alpine:3.20",
          "tar",
          "-czf",
          "/backup/object-storage.tgz",
          "-C",
          "/data",
          ".",
        ],
      },
      {
        label: "Write backup manifest",
        cmd: "write-file",
        args: [`${backupDir}/stage4l-backup-manifest.json`],
      },
    ],
  };
}

export function buildRestorePlan(options = {}) {
  const config = { ...parseStage4LOpsArgs(["restore"]), ...options };
  const backupDir = config.backupDir;
  if (!backupDir) throw new Error("restore requires --backup-dir.");
  const absBackupDir = resolve(backupDir);
  return {
    type: "restore",
    backupDir,
    requiredConfirmation: RESTORE_CONFIRMATION,
    files: {
      postgresDump: `${backupDir}/postgres.dump`,
      objectStorageArchive: `${backupDir}/object-storage.tgz`,
      manifest: `${backupDir}/stage4l-backup-manifest.json`,
    },
    steps: [
      {
        label: "Stop compose stack before restore",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, ["down"], config.composeEnvFile),
      },
      {
        label: "Remove PostgreSQL and backend object-storage volumes",
        cmd: "docker",
        args: [
          "volume",
          "rm",
          "-f",
          `${config.projectName}_postgres-data`,
          `${config.projectName}_backend-object-storage`,
        ],
      },
      {
        label: "Start PostgreSQL to initialize schema",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, ["up", "-d", "postgres"], config.composeEnvFile),
      },
      {
        label: "Restore PostgreSQL dump",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, [
          "exec",
          "-T",
          "postgres",
          "pg_restore",
          "-U",
          "dermatolog",
          "-d",
          "dermatolog_pro",
          "--clean",
          "--if-exists",
          "--no-owner",
          "--no-acl",
        ], config.composeEnvFile),
        stdinFile: `${backupDir}/postgres.dump`,
      },
      {
        label: "Restore backend-owned object storage volume",
        cmd: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          `${config.projectName}_backend-object-storage:/data`,
          "-v",
          `${absBackupDir}:/backup:ro`,
          "alpine:3.20",
          "sh",
          "-c",
          "rm -rf /data/* && tar -xzf /backup/object-storage.tgz -C /data",
        ],
      },
      {
        label: "Start full compose stack",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, ["up", "-d", "--build"], config.composeEnvFile),
      },
      {
        label: "Run post-restore Stage 4K smoke",
        cmd: npmCmd(),
        args: ["run", "smoke:stage4k", "--", "--skip-build"],
      },
    ],
  };
}

export function parseEnvFile(text = "") {
  const entries = new Map();
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) entries.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
  }
  return entries;
}

export function verifyEnvText(text = "") {
  const entries = parseEnvFile(text);
  const errors = [];
  const warnings = [];
  for (const key of REQUIRED_ENV_KEYS) {
    if (!entries.has(key)) errors.push(`Missing required key: ${key}`);
  }
  for (const [key, value] of entries) {
    if (["POSTGRES_PASSWORD", "JWT_SECRET", "DEVICE_BRIDGE_WORKER_TOKEN", "MINIO_ROOT_PASSWORD"].includes(key) && PLACEHOLDER_PATTERN.test(value)) {
      warnings.push(`${key} still looks like a placeholder.`);
    }
  }
  const jwtSecret = entries.get("JWT_SECRET") || "";
  if (jwtSecret && jwtSecret.length < 32) warnings.push("JWT_SECRET should be at least 32 characters in production.");
  const workerToken = entries.get("DEVICE_BRIDGE_WORKER_TOKEN") || "";
  if (workerToken && workerToken.length < 32) {
    warnings.push("DEVICE_BRIDGE_WORKER_TOKEN should be at least 32 characters in production.");
  }
  return { ok: errors.length === 0, errors, warnings, keys: [...entries.keys()] };
}

export function renderPlan(plan) {
  const lines = [
    `[stage4l-ops] ${plan.type} plan`,
    "",
    `- Backup dir: ${plan.backupDir}`,
  ];
  if (plan.requiredConfirmation) {
    lines.push(`- Restore confirmation required: ${plan.requiredConfirmation}`);
  }
  lines.push("", "## Steps");
  for (const step of plan.steps) {
    const suffix = step.stdoutFile
      ? ` > ${step.stdoutFile}`
      : step.stdinFile
        ? ` < ${step.stdinFile}`
        : "";
    lines.push(`- ${step.label}: \`${step.cmd} ${step.args.join(" ")}${suffix}\``);
  }
  return redact(lines.join("\n"));
}

function runStep(step, { spawn = spawnSync } = {}) {
  if (step.cmd === "mkdir") {
    mkdirSync(step.args[1], { recursive: true });
    return;
  }
  if (step.cmd === "write-file") return;
  const result = spawn(step.cmd, step.args, {
    cwd: process.cwd(),
    encoding: step.stdoutFile ? null : "utf8",
    input: step.stdinFile ? readFileSync(step.stdinFile) : undefined,
    stdio: step.stdoutFile ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout;
    throw new Error(redact(`${step.label} failed: ${stderr || stdout || `exit ${result.status}`}`));
  }
  if (step.stdoutFile) writeFileSync(step.stdoutFile, result.stdout);
}

function writeManifest(plan) {
  const manifestPath = plan.files.manifest;
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        stage: "4L",
        type: "self-hosted-backup",
        createdAt: new Date().toISOString(),
        backupDir: plan.backupDir,
        files: {
          postgresDump: basename(plan.files.postgresDump),
          objectStorageArchive: basename(plan.files.objectStorageArchive),
        },
        privacy: "No raw credentials, tokens, patient names, object keys, or storage paths are written to this manifest.",
      },
      null,
      2,
    ),
  );
}

export function runBackup(options = {}, io = {}) {
  const plan = buildBackupPlan(options);
  if (options.dryRun) return { ok: true, dryRun: true, output: renderPlan(plan), plan };
  for (const step of plan.steps) {
    runStep(step, io);
    if (step.cmd === "write-file") writeManifest(plan);
  }
  return { ok: true, dryRun: false, plan };
}

export function runRestore(options = {}, io = {}) {
  const plan = buildRestorePlan(options);
  if (options.dryRun) return { ok: true, dryRun: true, output: renderPlan(plan), plan };
  if (options.confirm !== RESTORE_CONFIRMATION) {
    throw new Error(`restore requires --confirm=${RESTORE_CONFIRMATION}`);
  }
  for (const file of [plan.files.postgresDump, plan.files.objectStorageArchive, plan.files.manifest]) {
    if (!existsSync(file)) throw new Error(`Missing backup file: ${file}`);
  }
  for (const step of plan.steps) runStep(step, io);
  return { ok: true, dryRun: false, plan };
}

export function runVerifyEnv(options = {}) {
  const envFile = options.envFile || DEFAULT_ENV_FILE;
  if (!existsSync(envFile)) throw new Error(`Env file not found: ${envFile}`);
  const result = verifyEnvText(readFileSync(envFile, "utf8"));
  return { ...result, envFile };
}

function renderEnvResult(result) {
  const lines = [
    "[stage4l-ops] env verification",
    "",
    `- File: ${result.envFile}`,
    `- Status: ${result.ok ? "ok" : "fail"}`,
    `- Keys: ${result.keys.length}`,
  ];
  if (result.errors.length) {
    lines.push("", "## Errors", ...result.errors.map((item) => `- ${item}`));
  }
  if (result.warnings.length) {
    lines.push("", "## Warnings", ...result.warnings.map((item) => `- ${item}`));
  }
  return redact(lines.join("\n"));
}

function usage() {
  return [
    "Usage:",
    "  node scripts/stage4l-self-hosted-ops.mjs backup --dry-run",
    "  node scripts/stage4l-self-hosted-ops.mjs backup --backup-root backups/self-hosted",
    "  node scripts/stage4l-self-hosted-ops.mjs restore --dry-run --backup-dir backups/self-hosted/20260514000000",
    `  node scripts/stage4l-self-hosted-ops.mjs restore --backup-dir <dir> --confirm=${RESTORE_CONFIRMATION}`,
    "  node scripts/stage4l-self-hosted-ops.mjs verify-env --env-file deploy/self-hosted/.env.production.example",
  ].join("\n");
}

export function main(argv = process.argv.slice(2)) {
  const options = parseStage4LOpsArgs(argv);
  try {
    if (options.command === "help") {
      console.log(usage());
      return 0;
    }
    if (options.command === "backup") {
      const result = runBackup(options);
      console.log(result.dryRun ? result.output : `[stage4l-ops] backup OK: ${result.plan.backupDir}`);
      return 0;
    }
    if (options.command === "restore") {
      const result = runRestore(options);
      console.log(result.dryRun ? result.output : `[stage4l-ops] restore OK: ${result.plan.backupDir}`);
      return 0;
    }
    if (options.command === "verify-env") {
      const result = runVerifyEnv(options);
      console.log(renderEnvResult(result));
      return result.ok ? 0 : 1;
    }
  } catch (error) {
    console.error(`[stage4l-ops] failed: ${redact(error?.message || error)}`);
    return 1;
  }
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

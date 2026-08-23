#!/usr/bin/env node
// Stage 4L · Self-hosted operations helpers.
// Dry-run-first backup/restore/env verification for the single-server product.

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertReconciliationClean, reconcileClinicalAssets } from "./stage4l-backup-consistency.mjs";

const DEFAULT_COMPOSE_FILE = "deploy/self-hosted/docker-compose.stage4a.yml";
const DEFAULT_PROJECT_NAME = "dermatolog-pro-stage4l-ops";
const DEFAULT_BACKUP_ROOT = "backups/self-hosted";
const DEFAULT_ENV_FILE = "deploy/self-hosted/.env.production.example";
const RESTORE_CONFIRMATION = "RESTORE_SELF_HOSTED_DATA";

const REQUIRED_ENV_KEYS = [
  "APP_PORT",
  "VITE_APP_MODE",
  "VITE_SELF_HOSTED_API_BASE_URL",
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
    backupSetId: "",
    productGitSha: "",
    stage4lGitSha: "",
    quiescenceTimeoutSeconds: 30,
  };
  let hasExplicitComposeFile = false;

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--compose-file") {
      const value = safePath(argv[++index], DEFAULT_COMPOSE_FILE);
      if (!hasExplicitComposeFile) parsed.composeFiles = [];
      hasExplicitComposeFile = true;
      parsed.composeFiles.push(value);
      parsed.composeFile = parsed.composeFiles[0];
      continue;
    }
    if (arg.startsWith("--compose-file=")) {
      const value = safePath(arg.slice("--compose-file=".length), DEFAULT_COMPOSE_FILE);
      if (!hasExplicitComposeFile) parsed.composeFiles = [];
      hasExplicitComposeFile = true;
      parsed.composeFiles.push(value);
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
    if (arg === "--backup-set-id") {
      parsed.backupSetId = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--backup-set-id=")) {
      parsed.backupSetId = arg.slice("--backup-set-id=".length).trim();
      continue;
    }
    if (arg === "--product-git-sha") {
      parsed.productGitSha = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--product-git-sha=")) {
      parsed.productGitSha = arg.slice("--product-git-sha=".length).trim();
      continue;
    }
    if (arg === "--stage4l-git-sha") {
      parsed.stage4lGitSha = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--stage4l-git-sha=")) {
      parsed.stage4lGitSha = arg.slice("--stage4l-git-sha=".length).trim();
      continue;
    }
    if (arg === "--quiescence-timeout-seconds") {
      parsed.quiescenceTimeoutSeconds = Number(argv[++index]);
      continue;
    }
    if (arg.startsWith("--quiescence-timeout-seconds=")) {
      parsed.quiescenceTimeoutSeconds = Number(arg.slice("--quiescence-timeout-seconds=".length));
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
    consistencyMode: "application_consistent_quiesced",
    requiredLifecycle: "inventory -> quiesce writers -> stop MinIO -> capture -> reconcile -> resume",
    backupSetId: config.backupSetId || basename(backupDir),
    productGitSha: config.productGitSha || "",
    stage4lGitSha: config.stage4lGitSha || "",
    quiescenceTimeoutSeconds: config.quiescenceTimeoutSeconds,
    projectName: config.projectName,
    files: {
      postgresDump: `${backupDir}/postgres.dump`,
      objectStorageArchive: `${backupDir}/object-storage.tgz`,
      minioObjectStorageArchive: `${backupDir}/minio-object-storage.tgz`,
      manifest: `${backupDir}/stage4l-backup-manifest.json`,
      checksums: `${backupDir}/SHA256SUMS`,
      completionReceipt: `${backupDir}/stage4l-backup-completion.json`,
    },
    steps: [
      {
        label: "Create backup directory",
        cmd: "mkdir",
        args: ["-p", "-m", "700", backupDir],
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
        label: "Verify backend-owned object storage volume exists",
        cmd: "docker",
        args: ["volume", "inspect", `${config.projectName}_backend-object-storage`],
      },
      {
        label: "Verify MinIO object storage volume exists",
        cmd: "docker",
        args: ["volume", "inspect", `${config.projectName}_object-storage-data`],
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
        label: "Archive MinIO object storage volume",
        cmd: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          `${config.projectName}_object-storage-data:/data:ro`,
          "-v",
          `${absBackupDir}:/backup`,
          "alpine:3.20",
          "tar",
          "-czf",
          "/backup/minio-object-storage.tgz",
          "-C",
          "/data",
          ".",
        ],
      },
      {
        label: "Validate PostgreSQL backup catalog",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, [
          "exec",
          "-T",
          "postgres",
          "pg_restore",
          "--list",
        ], config.composeEnvFile),
        stdinFile: `${backupDir}/postgres.dump`,
      },
      {
        label: "Validate backend-owned object storage archive",
        cmd: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          `${absBackupDir}:/backup:ro`,
          "alpine:3.20",
          "tar",
          "-tzf",
          "/backup/object-storage.tgz",
        ],
      },
      {
        label: "Validate MinIO object storage archive",
        cmd: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          `${absBackupDir}:/backup:ro`,
          "alpine:3.20",
          "tar",
          "-tzf",
          "/backup/minio-object-storage.tgz",
        ],
      },
      {
        label: "Write backup manifest",
        cmd: "write-file",
        args: [`${backupDir}/stage4l-backup-manifest.json`],
      },
      {
        label: "Write backup checksums",
        cmd: "sha256sum",
        args: [
          "postgres.dump",
          "object-storage.tgz",
          "minio-object-storage.tgz",
          "stage4l-backup-manifest.json",
        ],
        cwd: absBackupDir,
        stdoutFile: `${backupDir}/SHA256SUMS`,
      },
      {
        label: "Restrict backup file permissions",
        cmd: "chmod",
        args: [
          "600",
          "postgres.dump",
          "object-storage.tgz",
          "minio-object-storage.tgz",
          "stage4l-backup-manifest.json",
          "SHA256SUMS",
        ],
        cwd: absBackupDir,
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
      minioObjectStorageArchive: `${backupDir}/minio-object-storage.tgz`,
      manifest: `${backupDir}/stage4l-backup-manifest.json`,
      checksums: `${backupDir}/SHA256SUMS`,
      completionReceipt: `${backupDir}/stage4l-backup-completion.json`,
    },
    steps: [
      {
        label: "Verify backup checksums before destructive restore",
        cmd: "sha256sum",
        args: ["-c", "SHA256SUMS"],
        cwd: absBackupDir,
      },
      {
        label: "Stop compose stack before restore",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, ["down"], config.composeEnvFile),
      },
      {
        label: "Remove PostgreSQL and object-storage volumes",
        cmd: "docker",
        args: [
          "volume",
          "rm",
          "-f",
          `${config.projectName}_postgres-data`,
          `${config.projectName}_backend-object-storage`,
          `${config.projectName}_object-storage-data`,
        ],
      },
      {
        label: "Start PostgreSQL to initialize schema",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, ["up", "-d", "--wait", "postgres"], config.composeEnvFile),
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
        label: "Restore MinIO object storage volume",
        cmd: "docker",
        args: [
          "run",
          "--rm",
          "-v",
          `${config.projectName}_object-storage-data:/data`,
          "-v",
          `${absBackupDir}:/backup:ro`,
          "alpine:3.20",
          "sh",
          "-c",
          "rm -rf /data/* && tar -xzf /backup/minio-object-storage.tgz -C /data",
        ],
      },
      {
        label: "Start full compose stack",
        cmd: "docker",
        args: dockerComposeArgs(config.composeFiles || config.composeFile, config.projectName, ["up", "-d", "--build"], config.composeEnvFile),
      },
      {
        label: "Verify restored application without mutating it",
        cmd: "verify-restored-app",
        args: [],
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
  const viteAppMode = entries.get("VITE_APP_MODE") || "";
  if (viteAppMode && viteAppMode !== "production") {
    errors.push("VITE_APP_MODE must be production for self-hosted production deploys.");
  }
  const viteBaseUrl = entries.get("VITE_SELF_HOSTED_API_BASE_URL") || "";
  if (viteBaseUrl && !/^https?:\/\//i.test(viteBaseUrl)) {
    errors.push("VITE_SELF_HOSTED_API_BASE_URL must start with http:// or https://.");
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
  if (plan.consistencyMode) {
    lines.push(`- Consistency: ${plan.consistencyMode}`);
    lines.push(`- Required lifecycle: ${plan.requiredLifecycle}`);
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
    const target = step.args.at(-1);
    mkdirSync(target, { recursive: true, mode: 0o700 });
    chmodSync(target, 0o700);
    return;
  }
  if (step.cmd === "write-file") return;
  const result = spawn(step.cmd, step.args, {
    cwd: step.cwd || process.cwd(),
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

function checkedOutput(label, cmd, args, { spawn = spawnSync } = {}) {
  const result = spawn(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    throw new Error(redact(`${label} failed: ${result.stderr || result.error?.message || `exit ${result.status}`}`));
  }
  return Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : String(result.stdout || "");
}

function productionComposeArgs(options, args) {
  return dockerComposeArgs(
    options.composeFiles || options.composeFile,
    options.projectName,
    args,
    options.composeEnvFile,
  );
}

function parseServiceState(value, id) {
  const [running, exitCode, image] = String(value || "").trim().split("\t");
  return {
    id,
    running: running === "true",
    exitCode: Number.isInteger(Number(exitCode)) ? Number(exitCode) : null,
    image: String(image || "").trim(),
  };
}

function parseClinicalAssetsTsv(value) {
  return String(value || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [objectBucket, objectKey, checksumSha256, byteSize] = line.split("\t");
      if (!objectBucket || !objectKey) throw new Error("clinical asset inventory contains an invalid object identity.");
      return {
        objectBucket,
        objectKey,
        checksumSha256: checksumSha256 || null,
        byteSize: byteSize === "" || byteSize == null ? null : Number(byteSize),
      };
    });
}

const OBJECT_STORAGE_INVENTORY_SCRIPT = [
  'const { createHash } = require("node:crypto");',
  'const { readdirSync, readFileSync, statSync } = require("node:fs");',
  'const { join, relative, sep } = require("node:path");',
  'const root = "/data";',
  'const files = [];',
  'function walk(dir) { for (const item of readdirSync(dir, { withFileTypes: true })) { const path = join(dir, item.name); if (item.isDirectory()) walk(path); else if (item.isFile()) files.push(path); } }',
  'walk(root);',
  'const result = files.sort().map((path) => {',
  '  const rel = relative(root, path).split(sep).join("/");',
  '  const sidecar = rel.endsWith(".metadata.json");',
  '  const identity = sidecar ? rel.slice(0, -".metadata.json".length) : rel;',
  '  const slash = identity.indexOf("/");',
  '  if (slash < 1 || slash === identity.length - 1) throw new Error("invalid stored object identity");',
  '  const entry = { kind: sidecar ? "sidecar" : "payload", objectBucket: identity.slice(0, slash), objectKey: identity.slice(slash + 1) };',
  '  if (!sidecar) { const bytes = readFileSync(path); entry.byteSize = statSync(path).size; entry.checksumSha256 = createHash("sha256").update(bytes).digest("hex"); }',
  '  return entry;',
  '});',
  'process.stdout.write(JSON.stringify(result));',
].join(" ");

export function createProductionBackupIo(options = {}, dependencies = {}) {
  const spawn = dependencies.spawn || spawnSync;
  const now = dependencies.now || (() => new Date().toISOString());
  const allowedServices = new Set(["backend", "object-storage", "postgres", "reverse-proxy"]);
  let latestInventory = null;

  function composeOutput(label, args) {
    return checkedOutput(label, "docker", productionComposeArgs(options, args), { spawn });
  }

  function serviceState(service) {
    const containerId = composeOutput(`Inspect ${service} container id`, ["ps", "-q", "--all", service]).trim();
    if (!containerId) return { id: service, running: false, exitCode: null, image: "" };
    return parseServiceState(
      checkedOutput(
        `Inspect ${service} state`,
        "docker",
        ["inspect", "--format", "{{.State.Running}}\t{{.State.ExitCode}}\t{{.Image}}", containerId],
        { spawn },
      ),
      service,
    );
  }

  const lifecycle = {
    inventory() {
      const runningServices = composeOutput("Inventory running compose services", [
        "ps",
        "--services",
        "--status",
        "running",
      ]).split(/\r?\n/).filter(Boolean);
      const backend = serviceState("backend");
      const objectStorage = serviceState("object-storage");
      latestInventory = {
        writers: [{ id: "backend", kind: "compose", wasRunning: backend.running }],
        unknownCount: runningServices.filter((service) => !allowedServices.has(service)).length,
        backend,
        objectStorage,
      };
      return latestInventory;
    },
    quiesce(inventory, { timeoutSeconds }) {
      const services = [];
      if (inventory.backend?.running) services.push("backend");
      if (inventory.objectStorage?.running) services.push("object-storage");
      if (services.length) {
        composeOutput("Quiesce production writers", ["stop", "-t", String(timeoutSeconds), ...services]);
      }
      const backend = serviceState("backend");
      const objectStorage = serviceState("object-storage");
      return {
        writers: inventory.writers.map((writer) => ({
          ...writer,
          stopped: writer.id === "backend" ? !backend.running : false,
        })),
        minio: {
          id: "object-storage",
          wasRunning: Boolean(inventory.objectStorage?.running),
          stopped: !objectStorage.running,
        },
        unknownCount: inventory.unknownCount,
        forcedTerminationCount: [backend, objectStorage].filter((service) => service.exitCode === 137).length,
        quiescedAt: now(),
      };
    },
    resume() {
      if (!latestInventory) throw new Error("production writer inventory is missing before resume.");
      const services = [];
      if (latestInventory.backend?.running) services.push("backend");
      if (latestInventory.objectStorage?.running) services.push("object-storage");
      if (services.length) {
        composeOutput("Resume production writers", ["start", ...services]);
      }
      const states = services.map(serviceState);
      return { ok: states.every((service) => service.running), resumedAt: now() };
    },
  };

  function reconcile() {
    if (!latestInventory?.backend?.image) {
      throw new Error("backend image is required for object-storage reconciliation.");
    }
    const assets = parseClinicalAssetsTsv(composeOutput("Inventory clinical asset references", [
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "dermatolog",
      "-d",
      "dermatolog_pro",
      "-At",
      "-F",
      "\t",
      "-c",
      "select object_bucket, object_key, coalesce(checksum_sha256, ''), coalesce(byte_size::text, '') from clinical_assets order by object_bucket, object_key",
    ]));
    const filesOutput = checkedOutput(
      "Inventory backend object-storage files",
      "docker",
      [
        "run",
        "--rm",
        "-v",
        `${options.projectName}_backend-object-storage:/data:ro`,
        latestInventory.backend.image,
        "node",
        "-e",
        OBJECT_STORAGE_INVENTORY_SCRIPT,
      ],
      { spawn },
    );
    let files;
    try {
      files = JSON.parse(filesOutput || "[]");
    } catch {
      throw new Error("object-storage inventory is not valid JSON.");
    }
    return reconcileClinicalAssets({ assets, files });
  }

  return { spawn, lifecycle, reconcile, now };
}

export function createProductionRestoreIo(options = {}, dependencies = {}) {
  const spawn = dependencies.spawn || spawnSync;
  const envFile = options.composeEnvFile || options.envFile;
  let appPort = "8080";
  if (envFile && existsSync(envFile)) {
    appPort = parseEnvFile(readFileSync(envFile, "utf8")).get("APP_PORT") || appPort;
  }
  if (!/^\d{2,5}$/.test(String(appPort))) {
    throw new Error("production restore verifier requires a valid APP_PORT.");
  }
  return {
    spawn,
    verifyRestoredApp() {
      for (const path of ["healthz", "readyz"]) {
        checkedOutput(
          `Verify restored application ${path}`,
          "curl",
          ["--retry", "24", "--retry-all-errors", "--retry-delay", "5", "-fsS", `http://127.0.0.1:${appPort}/${path}`],
          { spawn },
        );
      }
      return { ok: true };
    },
  };
}

function writeManifest(plan, { inventory, evidence, reconciliation, startedAt, captureFinishedAt }) {
  const manifestPath = plan.files.manifest;
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        schemaVersion: 2,
        stage: "4L",
        type: "self-hosted-backup",
        backupSetId: plan.backupSetId,
        classification: "application_consistent_quiesced",
        state: "CAPTURE_VALIDATED",
        productGitSha: plan.productGitSha,
        stage4lGitSha: plan.stage4lGitSha,
        composeProject: plan.projectName,
        startedAt,
        quiescedAt: evidence.quiescedAt,
        captureFinishedAt,
        writers: {
          expected: inventory.writers.map((writer) => writer.id),
          stopped: evidence.writers.filter((writer) => writer.stopped === true).map((writer) => writer.id),
          expectedCount: inventory.writers.length,
          stoppedCount: evidence.writers.filter((writer) => writer.stopped === true).length,
          unknownCount: evidence.unknownCount,
          forcedTerminationCount: evidence.forcedTerminationCount,
          drainTimeoutSeconds: plan.quiescenceTimeoutSeconds,
        },
        stores: {
          postgres: { role: "authoritative", validated: true },
          backendObjectStorage: { role: "authoritative", validated: true },
          minio: { role: "operational_not_runtime_authoritative", validated: true },
        },
        reconciliation,
        files: {
          postgresDump: basename(plan.files.postgresDump),
          objectStorageArchive: basename(plan.files.objectStorageArchive),
          minioObjectStorageArchive: basename(plan.files.minioObjectStorageArchive),
          checksums: basename(plan.files.checksums),
          completionReceipt: basename(plan.files.completionReceipt),
        },
        privacy: "No raw credentials, tokens, patient names, object keys, or storage paths are written to this manifest.",
      },
      null,
      2,
    ),
  );
}

function validateResumeEvidence(evidence) {
  if (evidence?.ok !== true || !evidence.resumedAt || Number.isNaN(Date.parse(evidence.resumedAt))) {
    throw new Error("quiescence lifecycle did not prove a successful service resume.");
  }
  return evidence;
}

function writeCompletionReceipt(plan, resumeEvidence) {
  const receipt = {
    schemaVersion: 1,
    stage: "4L",
    type: "self-hosted-backup-completion",
    backupSetId: plan.backupSetId,
    state: "SEALED_RESTORE_POINT",
    backupChecksumsSha256: createHash("sha256").update(readFileSync(plan.files.checksums)).digest("hex"),
    resumedAt: resumeEvidence.resumedAt,
    privacy: "No raw credentials, tokens, patient names, object keys, or storage paths are written to this receipt.",
  };
  writeFileSync(plan.files.completionReceipt, JSON.stringify(receipt, null, 2));
  chmodSync(plan.files.completionReceipt, 0o600);
  return receipt;
}

function parseJsonFile(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error?.message || error}`);
  }
}

function verifyBackupSetSeal(plan) {
  const manifest = parseJsonFile(plan.files.manifest, "backup manifest");
  if (manifest.schemaVersion !== 2) {
    return { classification: "legacy_storage_level", manifest };
  }
  if (manifest.state !== "CAPTURE_VALIDATED" || !manifest.backupSetId) {
    throw new Error("manifest v2 is not a validated backup capture.");
  }
  if (!existsSync(plan.files.completionReceipt)) {
    throw new Error("manifest v2 requires a sealed completion receipt before restore.");
  }
  const receipt = parseJsonFile(plan.files.completionReceipt, "backup completion receipt");
  const checksumsSha256 = createHash("sha256").update(readFileSync(plan.files.checksums)).digest("hex");
  if (
    receipt.schemaVersion !== 1
    || receipt.state !== "SEALED_RESTORE_POINT"
    || receipt.backupSetId !== manifest.backupSetId
    || receipt.backupChecksumsSha256 !== checksumsSha256
    || !receipt.resumedAt
    || Number.isNaN(Date.parse(receipt.resumedAt))
  ) {
    throw new Error("backup completion receipt does not seal this manifest and checksum set.");
  }
  return { classification: "application_consistent_quiesced", manifest, receipt };
}

function validateWriterInventory(inventory) {
  const writers = Array.isArray(inventory?.writers) ? inventory.writers : [];
  if (!Number.isInteger(inventory?.unknownCount) || inventory.unknownCount !== 0) {
    throw new Error("writer inventory contains an unknown writer.");
  }
  if (writers.length === 0) throw new Error("writer inventory must include the backend writer.");
  const ids = new Set();
  for (const writer of writers) {
    const id = String(writer?.id || "");
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(id)) {
      throw new Error("writer inventory contains an unsafe writer id.");
    }
    if (ids.has(id)) throw new Error("writer inventory contains a duplicate writer id.");
    if (typeof writer.wasRunning !== "boolean") {
      throw new Error("writer inventory must record whether each writer was running.");
    }
    ids.add(id);
  }
  if (!ids.has("backend")) throw new Error("writer inventory must include the backend writer.");
  return inventory;
}

function validateBackupIdentity(plan) {
  const shaPattern = /^[a-f0-9]{40}$/;
  if (!shaPattern.test(plan.productGitSha) || !shaPattern.test(plan.stage4lGitSha)) {
    throw new Error("backup execution requires exact 40-character product and Stage 4L Git SHAs.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(plan.backupSetId)) {
    throw new Error("backup execution requires a safe backup set id.");
  }
  if (
    !Number.isInteger(plan.quiescenceTimeoutSeconds)
    || plan.quiescenceTimeoutSeconds < 1
    || plan.quiescenceTimeoutSeconds > 300
  ) {
    throw new Error("backup execution requires a quiescence timeout from 1 to 300 seconds.");
  }
  return plan;
}

function validateQuiescenceEvidence(inventory, evidence) {
  if (!Number.isInteger(evidence?.unknownCount) || evidence.unknownCount !== 0) {
    throw new Error("quiescence evidence contains an unknown writer.");
  }
  if (!Number.isInteger(evidence?.forcedTerminationCount) || evidence.forcedTerminationCount !== 0) {
    throw new Error("quiescence evidence contains a forced termination.");
  }
  if (!evidence?.quiescedAt || Number.isNaN(Date.parse(evidence.quiescedAt))) {
    throw new Error("quiescence evidence must contain a valid quiescedAt timestamp.");
  }
  const stoppedById = new Map(
    (Array.isArray(evidence.writers) ? evidence.writers : []).map((writer) => [String(writer?.id || ""), writer]),
  );
  for (const writer of inventory.writers) {
    const stopped = stoppedById.get(writer.id);
    if (!stopped || (writer.wasRunning && stopped.stopped !== true)) {
      throw new Error(`writer ${writer.id} was not proven stopped.`);
    }
  }
  if (stoppedById.size !== inventory.writers.length) {
    throw new Error("quiescence evidence writer set does not match the inventory.");
  }
  if (evidence?.minio?.id !== "object-storage" || typeof evidence.minio.wasRunning !== "boolean") {
    throw new Error("quiescence evidence must include the MinIO object-storage service.");
  }
  if (evidence.minio.wasRunning && evidence.minio.stopped !== true) {
    throw new Error("MinIO was not proven stopped before capture.");
  }
  return evidence;
}

export function runBackup(options = {}, io = {}) {
  const plan = buildBackupPlan(options);
  if (options.dryRun) return { ok: true, dryRun: true, output: renderPlan(plan), plan };
  const lifecycle = io.lifecycle;
  if (!lifecycle) {
    throw new Error("a quiescence lifecycle adapter is required for backup execution.");
  }
  if (![lifecycle.inventory, lifecycle.quiesce, lifecycle.resume].every((method) => typeof method === "function")) {
    throw new Error("the quiescence lifecycle adapter must provide inventory, quiesce, and resume.");
  }
  if (typeof io.reconcile !== "function") {
    throw new Error("a cross-store reconciliation adapter is required for backup execution.");
  }

  validateBackupIdentity(plan);
  const now = io.now || (() => new Date().toISOString());
  const startedAt = now();
  if (!startedAt || Number.isNaN(Date.parse(startedAt))) {
    throw new Error("backup execution requires a valid startedAt timestamp.");
  }
  const inventory = validateWriterInventory(lifecycle.inventory({ plan }));
  let quiescenceStarted = false;
  let evidence;
  let reconciliation;
  let resumeEvidence;
  try {
    quiescenceStarted = true;
    evidence = validateQuiescenceEvidence(inventory, lifecycle.quiesce(inventory, {
      plan,
      timeoutSeconds: plan.quiescenceTimeoutSeconds,
    }));
    for (const step of plan.steps) {
      runStep(step, io);
      if (step.cmd === "write-file") {
        reconciliation = assertReconciliationClean(io.reconcile({ plan, inventory, evidence }));
        writeManifest(plan, {
          inventory,
          evidence,
          reconciliation,
          startedAt,
          captureFinishedAt: now(),
        });
      }
    }
  } finally {
    if (quiescenceStarted) resumeEvidence = lifecycle.resume({ plan, inventory, evidence });
  }
  validateResumeEvidence(resumeEvidence);
  const completionReceipt = writeCompletionReceipt(plan, resumeEvidence);
  return { ok: true, dryRun: false, plan, reconciliation, completionReceipt };
}

export function runRestore(options = {}, io = {}) {
  const plan = buildRestorePlan(options);
  if (options.dryRun) return { ok: true, dryRun: true, output: renderPlan(plan), plan };
  if (options.confirm !== RESTORE_CONFIRMATION) {
    throw new Error(`restore requires --confirm=${RESTORE_CONFIRMATION}`);
  }
  for (const file of [
    plan.files.postgresDump,
    plan.files.objectStorageArchive,
    plan.files.minioObjectStorageArchive,
    plan.files.manifest,
    plan.files.checksums,
  ]) {
    if (!existsSync(file)) throw new Error(`Missing backup file: ${file}`);
  }
  const backupSet = verifyBackupSetSeal(plan);
  if (typeof io.verifyRestoredApp !== "function") {
    throw new Error("a restored-application verifier is required before restore execution.");
  }
  let restoredApplication;
  for (const step of plan.steps) {
    if (step.cmd === "verify-restored-app") {
      restoredApplication = io.verifyRestoredApp({ plan, backupSet });
      if (restoredApplication?.ok !== true) {
        throw new Error("restored-application verification did not pass.");
      }
      continue;
    }
    runStep(step, io);
  }
  return { ok: true, dryRun: false, plan, backupSet, restoredApplication };
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
    "  node scripts/stage4l-self-hosted-ops.mjs backup --backup-root backups/self-hosted --backup-set-id <id> --product-git-sha <40-hex> --stage4l-git-sha <40-hex> --quiescence-timeout-seconds 30",
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
      if (!options.dryRun) {
        const headResult = spawnSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
        const currentGitSha = headResult.status === 0 ? String(headResult.stdout || "").trim() : "";
        options.productGitSha ||= currentGitSha;
        options.stage4lGitSha ||= currentGitSha;
      }
      const result = runBackup(options, options.dryRun ? {} : createProductionBackupIo(options));
      console.log(result.dryRun ? result.output : `[stage4l-ops] backup OK: ${result.plan.backupDir}`);
      return 0;
    }
    if (options.command === "restore") {
      const result = runRestore(options, options.dryRun ? {} : createProductionRestoreIo(options));
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

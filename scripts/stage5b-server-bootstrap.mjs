#!/usr/bin/env node
// Stage 5B · production server bootstrap.
// Dry-run-first host/env/admin bootstrap planning for the self-hosted product.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hashPassword } from "../backend/self-hosted/auth-crypto.mjs";

const DEFAULT_ENV_FILE = "deploy/self-hosted/.env.production";
const DEFAULT_ENV_TEMPLATE = "deploy/self-hosted/release-candidate.stage5a.env.example";
const DEFAULT_SUMMARY_PATH = "test-results/stage5b-server-bootstrap.md";
const DEFAULT_ADMIN_SQL_PATH = "test-results/stage5b-bootstrap-system-admin.sql";
const DEFAULT_CLINIC_ID = "10000000-0000-4000-8000-000000000001";

const REQUIRED_ENV_KEYS = [
  "APP_PORT",
  "PUBLIC_BASE_URL",
  "BACKEND_PORT",
  "CORS_ORIGINS",
  "JWT_ISSUER",
  "JWT_SECRET",
  "JWT_EXPIRES_IN_SECONDS",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "DATABASE_URL",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_LOCAL_DIR",
  "DEVICE_BRIDGE_WORKER_TOKEN",
  "SELF_HOSTED_API_BASE_URL",
  "VITE_SELF_HOSTED_API_BASE_URL",
  "BACKUP_ROOT",
  "BACKUP_RETENTION_DAYS",
  "THIRD_PARTY_MANAGED_SERVICES_REQUIRED",
];

const SECRET_KEYS = new Set([
  "POSTGRES_PASSWORD",
  "DATABASE_URL",
  "JWT_SECRET",
  "DEVICE_BRIDGE_WORKER_TOKEN",
  "MINIO_ROOT_PASSWORD",
]);

const PLACEHOLDER_PATTERN = /(replace-me|change-me|example\.test|example|local_password|password|secret|token)/i;

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function redact(value) {
  return String(value ?? "")
    .replace(/(POSTGRES_PASSWORD|JWT_SECRET|DEVICE_BRIDGE_WORKER_TOKEN|MINIO_ROOT_PASSWORD)=([^\s]+)/g, "$1=[redacted]")
    .replace(/DATABASE_URL=postgres:\/\/([^:]+):([^@]+)@/g, "DATABASE_URL=postgres://$1:[redacted]@")
    .replace(/postgres:\/\/([^:]+):([^@]+)@/g, "postgres://$1:[redacted]@")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]")
    .replace(/\$scrypt\$[A-Za-z0-9_./$-]+/g, "[redacted-password-hash]");
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

function safeInteger(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function validateStage5BEnvText(text = "", options = {}) {
  const allowPlaceholders = Boolean(options.allowPlaceholders);
  const entries = parseEnvFile(text);
  const errors = [];
  const warnings = [];

  for (const key of REQUIRED_ENV_KEYS) {
    if (!entries.has(key)) errors.push(`Missing required key: ${key}`);
  }

  for (const [key, value] of entries) {
    if (!value) {
      warnings.push(`${key} is empty.`);
      continue;
    }
    if (SECRET_KEYS.has(key) && PLACEHOLDER_PATTERN.test(value)) {
      const message = `${key} still looks like a placeholder.`;
      if (allowPlaceholders) warnings.push(message);
      else errors.push(message);
    }
  }

  const appPort = safeInteger(entries.get("APP_PORT"));
  const backendPort = safeInteger(entries.get("BACKEND_PORT"));
  if (appPort <= 0 || appPort > 65535) errors.push("APP_PORT must be a valid TCP port.");
  if (backendPort <= 0 || backendPort > 65535) errors.push("BACKEND_PORT must be a valid TCP port.");
  if (appPort === backendPort) errors.push("APP_PORT and BACKEND_PORT must be different.");

  const jwtSecret = entries.get("JWT_SECRET") || "";
  if (jwtSecret && jwtSecret.length < 32) errors.push("JWT_SECRET must be at least 32 characters.");
  const workerToken = entries.get("DEVICE_BRIDGE_WORKER_TOKEN") || "";
  if (workerToken && workerToken.length < 32) {
    errors.push("DEVICE_BRIDGE_WORKER_TOKEN must be at least 32 characters.");
  }
  if (entries.get("THIRD_PARTY_MANAGED_SERVICES_REQUIRED") !== "false") {
    errors.push("THIRD_PARTY_MANAGED_SERVICES_REQUIRED must be false.");
  }
  const databaseUrl = entries.get("DATABASE_URL") || "";
  if (databaseUrl && !databaseUrl.startsWith("postgres://") && !databaseUrl.startsWith("postgresql://")) {
    errors.push("DATABASE_URL must use postgres:// or postgresql://.");
  }

  return {
    ok: errors.length === 0,
    entries,
    errors,
    warnings,
    keys: [...entries.keys()].sort(),
  };
}

function migrationFiles(root) {
  const dir = join(root, "backend/self-hosted/db/migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d+_stage.+\.sql$/.test(name))
    .sort();
}

export function buildStage5BPlan(options = {}) {
  const envFile = options.envFile || DEFAULT_ENV_FILE;
  const envTemplate = options.envTemplate || DEFAULT_ENV_TEMPLATE;
  const migrations = migrationFiles(options.root || process.cwd());
  return {
    stage: "5B",
    command: "production-server-bootstrap",
    envFile,
    envTemplate,
    migrations,
    managedRuntime: "none",
    managedDatabase: "none",
    steps: [
      ["Check host Node.js", "node --version"],
      ["Check npm", "npm --version"],
      ["Check Docker", "docker --version"],
      ["Check Docker Compose", "docker compose version"],
      ["Validate production env", `node scripts/stage5b-server-bootstrap.mjs verify-env --env-file ${envFile}`],
      ["Validate compose config", `docker compose --env-file ${envFile} -f deploy/self-hosted/docker-compose.stage4a.yml -f deploy/self-hosted/docker-compose.production.example.yml config --quiet`],
      ["Verify PostgreSQL migrations", "ls backend/self-hosted/db/migrations/*.sql"],
      ["Prepare backup root", "mkdir -p ${BACKUP_ROOT}"],
      ["Prepare object storage root", "mkdir -p ${OBJECT_STORAGE_LOCAL_DIR}"],
      ["Build frontend", "npm run build"],
      ["Start production compose stack", `docker compose --env-file ${envFile} -f deploy/self-hosted/docker-compose.stage4a.yml -f deploy/self-hosted/docker-compose.production.example.yml up -d --build`],
      ["Bootstrap first system_admin", "node scripts/stage5b-server-bootstrap.mjs admin-sql --email <admin-email> --password <admin-password> --output <secure-sql-path>"],
      ["Run health/readiness checks", "curl -fsS http://127.0.0.1:${APP_PORT}/healthz && curl -fsS http://127.0.0.1:${APP_PORT}/readyz"],
      ["Run product readiness check", "curl -fsS http://127.0.0.1:${APP_PORT}/api/v1/product/readiness"],
      ["Run full compose smoke", "npm run smoke:stage4k"],
      ["Create first backup plan", "npm run deploy:stage4m:backup-after-deploy:dry-run"],
      ["Run rollback drill plan", "npm run deploy:stage4m:rollback-drill:dry-run"],
    ],
  };
}

export function renderStage5BPlan(plan) {
  const lines = [
    "## Stage 5B production server bootstrap",
    "",
    `- Env file: \`${plan.envFile}\``,
    `- Env template: \`${plan.envTemplate}\``,
    `- Managed runtime: \`${plan.managedRuntime}\``,
    `- Managed database: \`${plan.managedDatabase}\``,
    `- PostgreSQL migrations: ${plan.migrations.length}`,
    "",
    "### Bootstrap Steps",
    "",
  ];
  for (const [index, [label, command]] of plan.steps.entries()) {
    lines.push(`${index + 1}. ${label}: \`${command}\``);
  }
  lines.push(
    "",
    "### Safety Rules",
    "",
    "- Run in dry-run mode first.",
    "- Replace every placeholder in the production env before starting the stack.",
    "- Generate the first system_admin SQL on the server and store it outside git.",
    "- Do not print passwords, bearer tokens, password hashes, raw env values, patient names, object keys, object paths, or signed URLs.",
  );
  return redact(lines.join("\n"));
}

function sqlQuote(value) {
  return String(value ?? "").replaceAll("'", "''");
}

function validateEmail(email) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || ""));
}

export function buildSystemAdminBootstrapSql(options = {}) {
  const email = String(options.email || "").trim().toLowerCase();
  const displayName = String(options.displayName || "System Administrator").trim();
  const clinicId = String(options.clinicId || DEFAULT_CLINIC_ID).trim();
  const clinicSlug = String(options.clinicSlug || "primary-clinic").trim();
  const clinicName = String(options.clinicName || "Dermatolog Pro Clinic").trim();
  const passwordHash = String(options.passwordHash || "").trim();

  if (!validateEmail(email)) throw new Error("admin email is required and must be valid.");
  if (!displayName) throw new Error("admin display name is required.");
  if (!passwordHash.startsWith("$scrypt$")) throw new Error("admin password hash must be a scrypt hash.");

  return [
    "-- Stage 5B first system_admin bootstrap.",
    "-- Generated locally. Review, apply once, then remove from disk.",
    "begin;",
    "",
    "insert into clinics (id, slug, name, timezone)",
    `values ('${sqlQuote(clinicId)}', '${sqlQuote(clinicSlug)}', '${sqlQuote(clinicName)}', 'Europe/Moscow')`,
    "on conflict (slug) do update",
    "set name = excluded.name, updated_at = now();",
    "",
    "with upserted_user as (",
    "  insert into app_users (email, display_name, password_hash, disabled_at)",
    `  values ('${sqlQuote(email)}', '${sqlQuote(displayName)}', '${sqlQuote(passwordHash)}', null)`,
    "  on conflict (email) do update",
    "  set display_name = excluded.display_name,",
    "      password_hash = excluded.password_hash,",
    "      disabled_at = null,",
    "      updated_at = now()",
    "  returning id",
    ")",
    "insert into user_roles (user_id, clinic_id, role)",
    `select id, '${sqlQuote(clinicId)}', 'system_admin'::app_role from upserted_user`,
    "on conflict (user_id, clinic_id, role) do nothing;",
    "",
    "insert into audit_log (clinic_id, actor_user_id, action, entity_type, correlation_id, metadata_json)",
    `values ('${sqlQuote(clinicId)}', null, 'stage5b.system_admin_bootstrap', 'app_user', 'stage5b-bootstrap', '{"role":"system_admin","source":"server-bootstrap"}'::jsonb);`,
    "",
    "commit;",
    "",
  ].join("\n");
}

export function renderEnvValidation(result, envFile) {
  const lines = [
    "## Stage 5B env validation",
    "",
    `- File: \`${envFile}\``,
    `- Status: \`${result.ok ? "ok" : "fail"}\``,
    `- Keys: ${result.keys.length}`,
  ];
  if (result.errors.length) {
    lines.push("", "### Errors", ...result.errors.map((item) => `- ${item}`));
  }
  if (result.warnings.length) {
    lines.push("", "### Warnings", ...result.warnings.map((item) => `- ${item}`));
  }
  return redact(lines.join("\n"));
}

function checkHostCommand(cmd, args, spawn = spawnSync) {
  const result = spawn(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    command: `${cmd} ${args.join(" ")}`.trim(),
    ok: result.status === 0,
    output: redact(`${result.stdout || ""}${result.stderr || ""}`.trim()).slice(0, 400),
  };
}

export function runHostCheck({ dryRun = false, spawn = spawnSync } = {}) {
  const checks = [
    ["node", ["--version"]],
    [npmCmd(), ["--version"]],
    ["docker", ["--version"]],
    ["docker", ["compose", "version"]],
  ];
  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      checks: checks.map(([cmd, args]) => ({ command: `${cmd} ${args.join(" ")}`, ok: true })),
    };
  }
  const results = checks.map(([cmd, args]) => checkHostCommand(cmd, args, spawn));
  return {
    ok: results.every((item) => item.ok),
    dryRun: false,
    checks: results,
  };
}

function writeSummary(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function parseArgs(argv = []) {
  const parsed = {
    command: argv[0] || "plan",
    dryRun: false,
    allowPlaceholders: false,
    envFile: DEFAULT_ENV_FILE,
    summaryPath: "",
    outputPath: "",
    email: "",
    displayName: "System Administrator",
    password: "",
    passwordHash: "",
    clinicId: DEFAULT_CLINIC_ID,
    clinicSlug: "primary-clinic",
    clinicName: "Dermatolog Pro Clinic",
  };

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--allow-placeholders") {
      parsed.allowPlaceholders = true;
      continue;
    }
    const readValue = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      return String(value);
    };
    if (arg === "--env-file") {
      parsed.envFile = readValue();
      continue;
    }
    if (arg.startsWith("--env-file=")) {
      parsed.envFile = arg.slice("--env-file=".length);
      continue;
    }
    if (arg === "--summary") {
      parsed.summaryPath = readValue();
      continue;
    }
    if (arg.startsWith("--summary=")) {
      parsed.summaryPath = arg.slice("--summary=".length);
      continue;
    }
    if (arg === "--output") {
      parsed.outputPath = readValue();
      continue;
    }
    if (arg.startsWith("--output=")) {
      parsed.outputPath = arg.slice("--output=".length);
      continue;
    }
    if (arg === "--email") {
      parsed.email = readValue();
      continue;
    }
    if (arg.startsWith("--email=")) {
      parsed.email = arg.slice("--email=".length);
      continue;
    }
    if (arg === "--display-name") {
      parsed.displayName = readValue();
      continue;
    }
    if (arg.startsWith("--display-name=")) {
      parsed.displayName = arg.slice("--display-name=".length);
      continue;
    }
    if (arg === "--password") {
      parsed.password = readValue();
      continue;
    }
    if (arg === "--password-hash") {
      parsed.passwordHash = readValue();
      continue;
    }
    if (arg === "--clinic-id") {
      parsed.clinicId = readValue();
      continue;
    }
    if (arg === "--clinic-slug") {
      parsed.clinicSlug = readValue();
      continue;
    }
    if (arg === "--clinic-name") {
      parsed.clinicName = readValue();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!["plan", "verify-env", "admin-sql", "host-check"].includes(parsed.command)) {
    throw new Error(`Unknown Stage 5B command: ${parsed.command}`);
  }
  return parsed;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.command === "plan") {
      const report = renderStage5BPlan(buildStage5BPlan({ envFile: options.envFile }));
      if (options.summaryPath) writeSummary(options.summaryPath, report);
      process.stdout.write(`${report}\n`);
      return 0;
    }
    if (options.command === "verify-env") {
      if (!existsSync(options.envFile)) throw new Error(`Env file not found: ${options.envFile}`);
      const result = validateStage5BEnvText(readFileSync(options.envFile, "utf8"), {
        allowPlaceholders: options.allowPlaceholders,
      });
      const report = renderEnvValidation(result, options.envFile);
      if (options.summaryPath) writeSummary(options.summaryPath, report);
      process.stdout.write(`${report}\n`);
      return result.ok ? 0 : 1;
    }
    if (options.command === "admin-sql") {
      if (!options.passwordHash && String(options.password || "").length < 12) {
        throw new Error("admin-sql requires --password with at least 12 characters or --password-hash.");
      }
      const passwordHash = options.passwordHash || hashPassword(options.password);
      const sql = buildSystemAdminBootstrapSql({ ...options, passwordHash });
      const outputPath = options.outputPath || DEFAULT_ADMIN_SQL_PATH;
      writeSummary(outputPath, sql);
      process.stdout.write(`[stage5b-bootstrap] system_admin SQL written to ${outputPath}\n`);
      process.stdout.write("Password and password hash were not printed.\n");
      return 0;
    }
    if (options.command === "host-check") {
      const result = runHostCheck({ dryRun: options.dryRun });
      const lines = ["## Stage 5B host check", "", `- Status: \`${result.ok ? "ok" : "fail"}\``];
      for (const check of result.checks) {
        lines.push(`- ${check.ok ? "OK" : "FAIL"}: \`${check.command}\``);
      }
      const report = lines.join("\n");
      if (options.summaryPath) writeSummary(options.summaryPath, report);
      process.stdout.write(`${report}\n`);
      return result.ok ? 0 : 1;
    }
  } catch (error) {
    console.error(`[stage5b-bootstrap] failed: ${redact(error?.message || error)}`);
    return 1;
  }
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildStage5BPlan,
  buildSystemAdminBootstrapSql,
  parseEnvFile,
  renderEnvValidation,
  renderStage5BPlan,
  runHostCheck,
  validateStage5BEnvText,
} from "./stage5b-server-bootstrap.mjs";

const VALID_ENV = `
APP_PORT=8080
PUBLIC_BASE_URL=https://clinic.example
BACKEND_PORT=3001
CORS_ORIGINS=https://clinic.example
JWT_ISSUER=dermatolog-pro-self-hosted
JWT_SECRET=abcdefghijklmnopqrstuvwxyz123456
JWT_EXPIRES_IN_SECONDS=3600
POSTGRES_DB=dermatolog_pro
POSTGRES_USER=dermatolog
POSTGRES_PASSWORD=real-postgres-value-123456
DATABASE_URL=postgres://dermatolog:real-postgres-value-123456@postgres:5432/dermatolog_pro
OBJECT_STORAGE_BUCKET=clinical-assets
OBJECT_STORAGE_LOCAL_DIR=/var/lib/dermatolog-pro/object-storage
DEVICE_BRIDGE_WORKER_TOKEN=abcdefghijklmnopqrstuvwxyz1234567890
SELF_HOSTED_API_BASE_URL=https://clinic.example
VITE_SELF_HOSTED_API_BASE_URL=https://clinic.example
BACKUP_ROOT=/var/backups/dermatolog-pro
BACKUP_RETENTION_DAYS=14
THIRD_PARTY_MANAGED_SERVICES_REQUIRED=false
`;

test("parseEnvFile parses simple key/value production env", () => {
  const parsed = parseEnvFile("APP_PORT=8080\n# comment\nJWT_SECRET='abc'\n");
  assert.equal(parsed.get("APP_PORT"), "8080");
  assert.equal(parsed.get("JWT_SECRET"), "abc");
});

test("validateStage5BEnvText accepts production-shaped env and rejects placeholders", () => {
  const ok = validateStage5BEnvText(VALID_ENV);
  assert.equal(ok.ok, true, ok.errors.join("\n"));
  assert.equal(ok.keys.includes("DATABASE_URL"), true);

  const bad = validateStage5BEnvText(VALID_ENV.replace("THIRD_PARTY_MANAGED_SERVICES_REQUIRED=false", "THIRD_PARTY_MANAGED_SERVICES_REQUIRED=true"));
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join("\n"), /THIRD_PARTY_MANAGED_SERVICES_REQUIRED must be false/);

  const placeholder = validateStage5BEnvText(VALID_ENV.replace("abcdefghijklmnopqrstuvwxyz123456", "replace-me-secret"));
  assert.equal(placeholder.ok, false);
  assert.match(placeholder.errors.join("\n"), /JWT_SECRET still looks like a placeholder/);
});

test("validateStage5BEnvText can allow placeholders for checked-in templates", () => {
  const result = validateStage5BEnvText(readFileSync("deploy/self-hosted/release-candidate.stage5a.env.example", "utf8"), {
    allowPlaceholders: true,
  });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.ok(result.warnings.length > 0);
});

test("renders bootstrap plan without leaking secret-shaped values", () => {
  const plan = buildStage5BPlan({ envFile: "deploy/self-hosted/.env.production" });
  const out = renderStage5BPlan(plan);

  assert.match(out, /Stage 5B production server bootstrap/);
  assert.match(out, /Managed runtime: `none`/);
  assert.match(out, /Bootstrap first system_admin/);
  assert.match(out, /npm run smoke:stage4k/);
  assert.doesNotMatch(out, /Bearer\s+[A-Za-z0-9]|password=|access_token|patient_full_name|storage_object_path|signed_url/);
});

test("buildSystemAdminBootstrapSql creates role bootstrap SQL without raw password", () => {
  const sql = buildSystemAdminBootstrapSql({
    email: "Admin@Example.test",
    displayName: "Primary Admin",
    passwordHash: "$scrypt$16384$8$1$c2FsdA$ZGVyaXZlZA",
  });

  assert.match(sql, /stage5b.system_admin_bootstrap/);
  assert.match(sql, /'admin@example.test'/);
  assert.match(sql, /'system_admin'::app_role/);
  assert.doesNotMatch(sql, /admin-password|plain/i);
});

test("renderEnvValidation redacts database credentials", () => {
  const result = validateStage5BEnvText(VALID_ENV);
  const out = renderEnvValidation(result, "deploy/self-hosted/.env.production");
  assert.match(out, /Status: `ok`/);
  assert.doesNotMatch(out, /real-postgres-value/);
});

test("host check dry-run returns command list without executing", () => {
  const result = runHostCheck({ dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.checks.some((item) => item.command.includes("docker compose version")), true);
});

test("cli plan dry-run and admin-sql output work", () => {
  const plan = spawnSync(process.execPath, ["scripts/stage5b-server-bootstrap.mjs", "plan", "--dry-run"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(plan.status, 0, plan.stderr);
  assert.match(plan.stdout, /Stage 5B production server bootstrap/);

  const dir = mkdtempSync(join(tmpdir(), "stage5b-"));
  try {
    const output = join(dir, "admin.sql");
    const admin = spawnSync(process.execPath, [
      "scripts/stage5b-server-bootstrap.mjs",
      "admin-sql",
      "--email",
      "admin@example.test",
      "--password",
      "local-only-password",
      "--output",
      output,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(admin.status, 0, admin.stderr);
    assert.match(admin.stdout, /system_admin SQL written/);
    assert.doesNotMatch(admin.stdout, /local-only-password|\$scrypt/);
    assert.match(readFileSync(output, "utf8"), /stage5b.system_admin_bootstrap/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli admin-sql rejects missing short password before writing SQL", () => {
  const result = spawnSync(process.execPath, [
    "scripts/stage5b-server-bootstrap.mjs",
    "admin-sql",
    "--email",
    "admin@example.test",
    "--password",
    "short",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /requires --password with at least 12 characters/);
  assert.doesNotMatch(result.stderr, /short|\$scrypt/);
});

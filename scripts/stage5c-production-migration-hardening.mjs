#!/usr/bin/env node
// Stage 5C · production migration and bootstrap hardening.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_MIGRATIONS_DIR = "backend/self-hosted/db/migrations";
const DEFAULT_SUMMARY_PATH = "test-results/stage5c-production-migration-hardening.md";
const DEFAULT_SCHEMA_SQL_PATH = "test-results/stage5c-prestart-schema-check.sql";

const PRODUCTION_EXCLUDED_SEEDS = new Set([
  "0002_stage4b_runtime_seed.sql",
  "0003_stage4c_auth_seed.sql",
  "0007_stage4k_deploy_smoke_seed.sql",
]);

const REQUIRED_SCHEMA_OBJECTS = [
  "clinics",
  "app_users",
  "user_roles",
  "patients",
  "visits",
  "lesions",
  "clinical_assets",
  "reports",
  "audit_log",
  "device_bridge_workers",
  "device_bridge_commands",
];

const REQUIRED_AUDIT_TRIGGER = "audit_log_no_update";
const REQUIRED_ROLES = ["system_admin", "clinic_admin", "doctor", "assistant", "operator"];

function migrationFiles(root = process.cwd()) {
  const dir = join(root, DEFAULT_MIGRATIONS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d+_stage.+\.sql$/.test(name))
    .sort();
}

function fileText(root, file) {
  return readFileSync(join(root, DEFAULT_MIGRATIONS_DIR, file), "utf8");
}

function classifyMigration(root, file) {
  const content = fileText(root, file);
  const isSeed = PRODUCTION_EXCLUDED_SEEDS.has(file);
  const hasSchemaChange = /\b(create|alter)\s+(table|type|index|trigger|function)\b/i.test(content);
  return {
    file,
    productionPolicy: isSeed ? "exclude-from-production" : "apply-in-production",
    category: isSeed ? "demo-or-smoke-seed" : hasSchemaChange ? "schema" : "metadata",
  };
}

export function buildStage5CMigrationInventory({ root = process.cwd() } = {}) {
  const files = migrationFiles(root);
  const migrations = files.map((file) => classifyMigration(root, file));
  return {
    stage: "5C",
    managedRuntime: "none",
    managedDatabase: "none",
    migrations,
    applyInProduction: migrations.filter((item) => item.productionPolicy === "apply-in-production"),
    excludeFromProduction: migrations.filter((item) => item.productionPolicy === "exclude-from-production"),
    requiredSchemaObjects: REQUIRED_SCHEMA_OBJECTS,
    requiredRoles: REQUIRED_ROLES,
    requiredAuditTrigger: REQUIRED_AUDIT_TRIGGER,
  };
}

function renderTable(rows) {
  const lines = [
    "| Migration | Category | Production policy |",
    "| --- | --- | --- |",
  ];
  for (const row of rows) {
    lines.push(`| \`${row.file}\` | ${row.category} | ${row.productionPolicy} |`);
  }
  return lines;
}

export function renderStage5CPlan(inventory) {
  const lines = [
    "## Stage 5C production migration and bootstrap hardening",
    "",
    `- Managed runtime: \`${inventory.managedRuntime}\``,
    `- Managed database: \`${inventory.managedDatabase}\``,
    `- Migrations total: ${inventory.migrations.length}`,
    `- Apply in production: ${inventory.applyInProduction.length}`,
    `- Exclude from production: ${inventory.excludeFromProduction.length}`,
    "",
    "### Migration Inventory",
    "",
    ...renderTable(inventory.migrations),
    "",
    "### Production Seed Policy",
    "",
    "- Demo/smoke seed files are excluded from production bootstrap.",
    "- Production installs must create the first system_admin through Stage 5B generated SQL.",
    "- Demo patient rows and demo doctor credentials must not be present after production bootstrap.",
    "",
    "### Pre-start Database Guard",
    "",
    "- Verify required tables and enum roles exist.",
    "- Verify audit_log remains append-only through its no-update trigger.",
    "- Verify demo seed rows are absent unless the operator is running local smoke only.",
    "- Verify at least one system_admin role exists before real clinical use.",
    "",
    "### Commands",
    "",
    "- `npm run migrate:stage5c:dry-run`",
    "- `npm run migrate:stage5c:schema-sql`",
    "- `npm run migrate:stage5c:seed-policy`",
    "- `npm run preflight:stage5c`",
  ];
  return lines.join("\n");
}

export function buildStage5CPrestartSchemaSql(inventory = buildStage5CMigrationInventory()) {
  const tableArray = inventory.requiredSchemaObjects.map((name) => `'${name}'`).join(", ");
  const roleArray = inventory.requiredRoles.map((role) => `'${role}'`).join(", ");
  return [
    "-- Stage 5C production pre-start schema check.",
    "-- Safe to run manually against the operator-owned PostgreSQL database.",
    "",
    "do $$",
    "declare",
    "  missing_tables text[];",
    "  missing_roles text[];",
    "  demo_rows integer;",
    "  admin_roles integer;",
    "begin",
    `  select array_agg(required_name) into missing_tables`,
    `  from unnest(array[${tableArray}]) as required_name`,
    "  where not exists (",
    "    select 1 from information_schema.tables",
    "    where table_schema = 'public' and table_name = required_name",
    "  );",
    "",
    "  if missing_tables is not null then",
    "    raise exception 'Stage 5C schema check failed: missing tables %', missing_tables;",
    "  end if;",
    "",
    `  select array_agg(required_role) into missing_roles`,
    `  from unnest(array[${roleArray}]) as required_role`,
    "  where not exists (",
    "    select 1",
    "    from pg_enum e",
    "    join pg_type t on t.oid = e.enumtypid",
    "    where t.typname = 'app_role' and e.enumlabel = required_role",
    "  );",
    "",
    "  if missing_roles is not null then",
    "    raise exception 'Stage 5C schema check failed: missing roles %', missing_roles;",
    "  end if;",
    "",
    `  if not exists (select 1 from pg_trigger where tgname = '${inventory.requiredAuditTrigger}') then`,
    "    raise exception 'Stage 5C schema check failed: audit append-only trigger missing';",
    "  end if;",
    "",
    "  select count(*) into demo_rows",
    "  from app_users",
    "  where email = 'doctor.demo@example.invalid';",
    "",
    "  if demo_rows > 0 then",
    "    raise exception 'Stage 5C production seed policy failed: demo auth seed is present';",
    "  end if;",
    "",
    "  select count(*) into admin_roles",
    "  from user_roles",
    "  where role = 'system_admin'::app_role;",
    "",
    "  if admin_roles = 0 then",
    "    raise exception 'Stage 5C bootstrap check failed: no system_admin role found';",
    "  end if;",
    "end $$;",
    "",
  ].join("\n");
}

export function renderStage5CSeedPolicy(inventory) {
  const lines = [
    "## Stage 5C production seed policy",
    "",
    "### Apply In Production",
    "",
  ];
  for (const item of inventory.applyInProduction) lines.push(`- \`${item.file}\``);
  lines.push("", "### Exclude From Production", "");
  for (const item of inventory.excludeFromProduction) lines.push(`- \`${item.file}\` (${item.category})`);
  lines.push(
    "",
    "Production bootstrap must use Stage 5B generated first-admin SQL instead of checked-in demo credentials.",
  );
  return lines.join("\n");
}

function writeOutput(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export function parseStage5CArgs(argv = []) {
  const parsed = {
    command: argv[0] || "plan",
    summaryPath: "",
    outputPath: "",
  };
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      return String(value);
    };
    if (arg === "--summary") {
      parsed.summaryPath = next();
      continue;
    }
    if (arg.startsWith("--summary=")) {
      parsed.summaryPath = arg.slice("--summary=".length);
      continue;
    }
    if (arg === "--output") {
      parsed.outputPath = next();
      continue;
    }
    if (arg.startsWith("--output=")) {
      parsed.outputPath = arg.slice("--output=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["plan", "schema-sql", "seed-policy"].includes(parsed.command)) {
    throw new Error(`Unknown Stage 5C command: ${parsed.command}`);
  }
  return parsed;
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage5CArgs(argv);
    const inventory = buildStage5CMigrationInventory();
    if (args.command === "plan") {
      const out = renderStage5CPlan(inventory);
      if (args.summaryPath) writeOutput(args.summaryPath, out);
      process.stdout.write(`${out}\n`);
      return inventory.migrations.length > 0 ? 0 : 1;
    }
    if (args.command === "schema-sql") {
      const out = buildStage5CPrestartSchemaSql(inventory);
      const outputPath = args.outputPath || DEFAULT_SCHEMA_SQL_PATH;
      writeOutput(outputPath, out);
      process.stdout.write(`[stage5c-migration-hardening] pre-start schema SQL written to ${outputPath}\n`);
      return 0;
    }
    if (args.command === "seed-policy") {
      const out = renderStage5CSeedPolicy(inventory);
      if (args.summaryPath) writeOutput(args.summaryPath, out);
      process.stdout.write(`${out}\n`);
      return 0;
    }
  } catch (error) {
    console.error(`[stage5c-migration-hardening] failed: ${error?.message || error}`);
    return 1;
  }
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

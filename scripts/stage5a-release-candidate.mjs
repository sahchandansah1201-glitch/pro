#!/usr/bin/env node
// Stage 5A · self-hosted release candidate manifest.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SUMMARY_PATH = "test-results/stage5a-release-candidate.md";

const REQUIRED_RELEASE_FILES = [
  "PRODUCT.md",
  "DESIGN.md",
  "backend/self-hosted/Dockerfile",
  "backend/self-hosted/server.mjs",
  "backend/self-hosted/openapi.stage4z.json",
  "deploy/self-hosted/docker-compose.stage4a.yml",
  "deploy/self-hosted/docker-compose.production.example.yml",
  "deploy/self-hosted/nginx.stage4a.conf",
  "deploy/self-hosted/.env.production.example",
  "deploy/self-hosted/release-candidate.stage5a.env.example",
  "deploy/self-hosted/device-bridge-worker.stage4t.env.example",
  "deploy/self-hosted/device-bridge-worker.stage4t.service",
  "scripts/stage4k-self-hosted-compose-smoke.mjs",
  "scripts/stage4l-self-hosted-ops.mjs",
  "scripts/stage4m-production-deploy-verify.mjs",
  "scripts/check-no-deno-locks.mjs",
  "docs/backend/stage-5a-self-hosted-release-candidate.md",
];

const RELEASE_GATES = [
  ["Stage 5A release candidate preflight", "npm run preflight:stage5a"],
  ["Stage 4Z product readiness preflight", "npm run preflight:stage4z"],
  ["Full deterministic preflight", "npm run preflight:all"],
  ["Frontend production build", "npm run build"],
  ["Compose config validation", "docker compose --env-file deploy/self-hosted/.env.production -f deploy/self-hosted/docker-compose.stage4a.yml -f deploy/self-hosted/docker-compose.production.example.yml config --quiet"],
  ["Full compose smoke", "npm run smoke:stage4k"],
  ["Post-deploy smoke plan", "npm run deploy:stage4m:post-deploy:dry-run"],
  ["Backup after deploy plan", "npm run deploy:stage4m:backup-after-deploy:dry-run"],
  ["Rollback drill plan", "npm run deploy:stage4m:rollback-drill:dry-run"],
];

function migrationFiles(root) {
  const dir = join(root, "backend/self-hosted/db/migrations");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d+_stage.+\.sql$/.test(name))
    .sort();
}

function fileState(root, file) {
  return {
    file,
    present: existsSync(join(root, file)),
  };
}

export function buildStage5AReleaseCandidate({
  root = process.cwd(),
  generatedAt = new Date().toISOString(),
} = {}) {
  const files = REQUIRED_RELEASE_FILES.map((file) => fileState(root, file));
  const missingFiles = files.filter((item) => !item.present).map((item) => item.file);
  const migrations = migrationFiles(root);
  const missingMigrations = migrations.length === 0;

  return {
    stage: "5A",
    status: missingFiles.length === 0 && !missingMigrations ? "ready" : "incomplete",
    generatedAt,
    productBoundary: {
      runtime: "self-hosted Node backend",
      frontend: "static frontend served by nginx",
      database: "operator-owned PostgreSQL",
      objectStorage: "operator-owned object storage or local filesystem volume",
      worker: "operator-owned Device Bridge worker",
      managedRuntime: "none",
      managedDatabase: "none",
      browserHardwareApis: false,
    },
    files,
    missingFiles,
    migrations,
    releaseGates: RELEASE_GATES.map(([label, command]) => ({ label, command })),
  };
}

function escapePipe(value) {
  return String(value).replaceAll("|", "\\|");
}

export function renderStage5AReleaseCandidate(candidate) {
  const lines = [
    "## Stage 5A self-hosted release candidate",
    "",
    `- Status: \`${candidate.status}\``,
    `- Generated at: \`${candidate.generatedAt}\``,
    `- Managed runtime: \`${candidate.productBoundary.managedRuntime}\``,
    `- Managed database: \`${candidate.productBoundary.managedDatabase}\``,
    `- Browser hardware APIs from UI: \`${candidate.productBoundary.browserHardwareApis}\``,
    "",
    "### Product Boundary",
    "",
    `- Frontend: ${candidate.productBoundary.frontend}`,
    `- Backend: ${candidate.productBoundary.runtime}`,
    `- Database: ${candidate.productBoundary.database}`,
    `- Object storage: ${candidate.productBoundary.objectStorage}`,
    `- Worker: ${candidate.productBoundary.worker}`,
    "",
    "### Required Files",
    "",
    "| Status | File |",
    "| --- | --- |",
  ];

  for (const item of candidate.files) {
    lines.push(`| ${item.present ? "OK" : "MISSING"} | \`${escapePipe(item.file)}\` |`);
  }

  lines.push("", "### PostgreSQL Migration Order", "");
  if (candidate.migrations.length === 0) {
    lines.push("- MISSING: backend/self-hosted/db/migrations contains no stage SQL files.");
  } else {
    candidate.migrations.forEach((file, index) => {
      lines.push(`${index + 1}. \`${file}\``);
    });
  }

  lines.push("", "### Release Gates", "");
  for (const gate of candidate.releaseGates) {
    lines.push(`- ${gate.label}: \`${gate.command}\``);
  }

  lines.push(
    "",
    "### Server Install Outline",
    "",
    "1. Copy `deploy/self-hosted/release-candidate.stage5a.env.example` to the server and replace all placeholder secrets.",
    "2. Copy the production env into `deploy/self-hosted/.env.production` on the server.",
    "3. Run `npm run build` before starting the nginx/frontend container.",
    "4. Start the stack with the base compose file plus `docker-compose.production.example.yml`.",
    "5. Run post-deploy smoke, backup-after-deploy, and rollback-drill dry-runs before promoting the release.",
    "",
    "### Privacy and Operations",
    "",
    "- The release candidate report prints file names, gates, and migration names only.",
    "- It never prints passwords, bearer tokens, raw env values, patient names, object keys, object paths, or signed URLs.",
    "- The product is designed to keep runtime, database, object storage, and worker control on the operator-owned server.",
  );

  return lines.join("\n");
}

export function parseStage5AArgs(argv = []) {
  const parsed = {
    dryRun: false,
    summaryPath: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--summary") {
      const value = argv[index + 1];
      if (!value) throw new Error("--summary requires a path");
      parsed.summaryPath = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--summary=")) {
      parsed.summaryPath = arg.slice("--summary=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

export function runStage5AReleaseCandidate(options = {}) {
  const candidate = buildStage5AReleaseCandidate(options);
  const report = renderStage5AReleaseCandidate(candidate);
  const summaryPath = options.summaryPath || null;

  if (summaryPath) {
    mkdirSync(dirname(summaryPath), { recursive: true });
    writeFileSync(summaryPath, report);
  }

  return {
    ok: candidate.status === "ready",
    candidate,
    report,
  };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const args = parseStage5AArgs(argv);
    const result = runStage5AReleaseCandidate({
      root: process.cwd(),
      summaryPath: args.summaryPath || (args.dryRun ? null : DEFAULT_SUMMARY_PATH),
    });
    process.stdout.write(`${result.report}\n`);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(`[stage5a-release-candidate] failed: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

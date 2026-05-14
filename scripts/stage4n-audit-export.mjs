#!/usr/bin/env node
// Stage 4N · Safe audit export planner.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { redactOpsText } from "../backend/self-hosted/ops-logger.mjs";

const DEFAULT_OUTPUT = "reports/stage4n/audit-export-plan.md";
const DEFAULT_LIMIT = 1000;
const SAFE_COLUMNS = [
  "created_at",
  "action",
  "entity_type",
  "entity_id",
  "correlation_id",
];

export function parseStage4NAuditArgs(argv = []) {
  const args = {
    dryRun: false,
    output: null,
    limit: DEFAULT_LIMIT,
    projectName: "dermatolog-pro-production",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error("--output requires a path");
      args.output = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--output=")) {
      args.output = arg.slice("--output=".length);
      continue;
    }
    if (arg === "--limit") {
      const value = argv[index + 1];
      if (!value) throw new Error("--limit requires a number");
      args.limit = parseLimit(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      args.limit = parseLimit(arg.slice("--limit=".length));
      continue;
    }
    if (arg === "--project-name") {
      const value = argv[index + 1];
      if (!value) throw new Error("--project-name requires a value");
      args.projectName = sanitizeProjectName(value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--project-name=")) {
      args.projectName = sanitizeProjectName(arg.slice("--project-name=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function parseLimit(value) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10000) {
    throw new Error("--limit must be an integer between 1 and 10000");
  }
  return parsed;
}

function sanitizeProjectName(value) {
  const text = String(value || "").trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(text)) {
    throw new Error("--project-name contains unsupported characters");
  }
  return text;
}

export function buildStage4NAuditExportPlan({
  projectName = "dermatolog-pro-production",
  limit = DEFAULT_LIMIT,
} = {}) {
  const safeProjectName = sanitizeProjectName(projectName);
  const safeLimit = parseLimit(limit);
  const query = [
    "select",
    SAFE_COLUMNS.join(", "),
    "from audit_logs",
    "order by created_at desc",
    `limit ${safeLimit}`,
  ].join(" ");
  return {
    stage: "4N",
    mode: "dry-run",
    columns: [...SAFE_COLUMNS],
    command: [
      "docker",
      "compose",
      "-p",
      safeProjectName,
      "exec",
      "-T",
      "postgres",
      "psql",
      "-U",
      "dermatolog",
      "-d",
      "dermatolog_pro",
      "-c",
      `\\copy (${query}) to stdout with csv header`,
    ],
  };
}

export function renderStage4NAuditExportPlan(plan) {
  const lines = [
    "# Stage 4N audit export dry-run",
    "",
    "- Status: `planned`",
    "- Output type: CSV on stdout",
    `- Safe columns: ${plan.columns.map((column) => `\`${column}\``).join(", ")}`,
    "- Excluded: request bodies, tokens, passwords, patient names, object keys, storage paths, raw env values",
    "",
    "```bash",
    redactOpsText(plan.command.join(" ")),
    "```",
    "",
  ];
  return lines.join("\n");
}

export function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseStage4NAuditArgs(argv);
  } catch (error) {
    console.error(`[stage4n-audit-export] ${error.message}`);
    return 1;
  }

  const plan = buildStage4NAuditExportPlan({
    projectName: args.projectName,
    limit: args.limit,
  });
  const report = renderStage4NAuditExportPlan(plan);
  if (args.output) {
    mkdirSync(dirname(args.output), { recursive: true });
    writeFileSync(args.output, report);
    console.log(`[stage4n-audit-export] wrote ${args.output}`);
    return 0;
  }
  process.stdout.write(report);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

export { DEFAULT_OUTPUT, SAFE_COLUMNS };

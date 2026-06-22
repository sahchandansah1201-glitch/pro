#!/usr/bin/env node
// Stage 4M · Safe deployment status reader.

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEFAULT_STATUS_PATH = "/opt/dermatolog-pro/logs/update-production-status.json";
const DEFAULT_SUMMARY_PATH = "/opt/dermatolog-pro/logs/update-production-summary.md";
const RECEIPT_SCHEMA_VERSION = "stage4m-production-deploy-receipt/v1";

function parseArgs(argv = []) {
  const parsed = {
    statusPath: DEFAULT_STATUS_PATH,
    summaryPath: DEFAULT_SUMMARY_PATH,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      parsed.json = true;
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
    if (arg === "--summary") {
      parsed.summaryPath = String(argv[++index] || "").trim();
      continue;
    }
    if (arg.startsWith("--summary=")) {
      parsed.summaryPath = arg.slice("--summary=".length).trim();
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!parsed.statusPath) throw new Error("status json path is required.");
  return parsed;
}

function readJson(path) {
  if (!existsSync(path)) {
    return {
      ok: false,
      error: `Status file not found: ${path}`,
    };
  }
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (value.schemaVersion && value.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
      return {
        ok: false,
        error: `Unsupported status schema: ${value.schemaVersion}`,
      };
    }
    return {
      ok: true,
      value,
    };
  } catch (error) {
    return {
      ok: false,
      error: `Status file is not valid JSON: ${error.message}`,
    };
  }
}

function renderStatus(status, { summaryPath } = {}) {
  const lines = [
    "## Stage 4M deployment status",
    "",
    `- Status: \`${status.status || "unknown"}\``,
    `- Run ID: \`${status.runId || "unknown"}\``,
    `- Command: \`${status.command || "unknown"}\``,
    `- Project: \`${status.projectName || "unknown"}\``,
    `- Started: \`${status.startedAt || "unknown"}\``,
    `- Finished: \`${status.finishedAt || "running"}\``,
    `- Git HEAD before: \`${status.git?.before?.head || "unknown"}\``,
    `- Git HEAD after: \`${status.git?.after?.head || "unknown"}\``,
  ];
  if (Array.isArray(status.results) && status.results.length) {
    lines.push("", "## Results");
    for (const item of status.results) {
      lines.push(`- ${item.ok ? "OK" : "FAIL"} — ${item.label}`);
    }
  }
  if (summaryPath) {
    lines.push("", `Summary: \`${summaryPath}\``);
  }
  return lines.join("\n");
}

export function readDeployStatus(options = {}) {
  const result = readJson(options.statusPath || DEFAULT_STATUS_PATH);
  if (!result.ok) return result;
  return {
    ok: true,
    status: result.value,
    text: renderStatus(result.value, { summaryPath: options.summaryPath }),
  };
}

export function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    const result = readDeployStatus(options);
    if (!result.ok) {
      console.error(`[stage4m-status] ${result.error}`);
      return 2;
    }
    if (options.json) {
      console.log(JSON.stringify(result.status, null, 2));
      return 0;
    }
    console.log(result.text);
    return result.status.status === "fail" ? 1 : 0;
  } catch (error) {
    console.error(`[stage4m-status] failed: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

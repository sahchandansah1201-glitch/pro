#!/usr/bin/env node
// Stage 3M · Focused local preflight for release-status outputs.

import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const OUTPUT_DIR = "test-results";
const MARKDOWN_REPORT = `${OUTPUT_DIR}/release-status.md`;
const JSON_REPORT = `${OUTPUT_DIR}/release-status.json`;
const HTML_REPORT = `${OUTPUT_DIR}/release-status.html`;
const HISTORY_REPORT = `${OUTPUT_DIR}/release-history.jsonl`;

const steps = [
  ["release status tests", npmCmd, ["run", "test:release-status"]],
  [
    "release status privacy detector tests",
    npmCmd,
    ["run", "test:release-status-privacy"],
  ],
  [
    "release status smoke test",
    npmCmd,
    ["run", "test:release-status-smoke"],
  ],
  [
    "release status CI gate tests",
    npmCmd,
    ["run", "test:release-status-ci"],
  ],
  [
    "release status UI tests",
    npmCmd,
    [
      "test",
      "--",
      "--run",
      "src/lib/release-status-ui.test.ts",
      "src/pages/sys/SysReleaseStatusPage.test.tsx",
    ],
  ],
  [
    "release status sync checker",
    npmCmd,
    ["run", "check:release-status-sync"],
  ],
  [
    "write markdown report and history",
    process.execPath,
    [
      "scripts/release-status.mjs",
      "--offline",
      "--output",
      MARKDOWN_REPORT,
      "--history",
      HISTORY_REPORT,
    ],
  ],
  [
    "write JSON report",
    process.execPath,
    [
      "scripts/release-status.mjs",
      "--offline",
      "--json",
      "--output",
      JSON_REPORT,
    ],
  ],
  [
    "write HTML visual report",
    process.execPath,
    [
      "scripts/release-status.mjs",
      "--offline",
      "--html",
      "--output",
      HTML_REPORT,
    ],
  ],
  [
    "privacy scan generated release-status artifacts",
    process.execPath,
    [
      "scripts/check-release-status-privacy.mjs",
      MARKDOWN_REPORT,
      JSON_REPORT,
      HTML_REPORT,
      HISTORY_REPORT,
    ],
  ],
  ["Stage 3 docs guard", process.execPath, ["scripts/check-stage3-docs.mjs"]],
  ["No deno.lock files", process.execPath, ["scripts/check-no-deno-locks.mjs"]],
];

const results = [];

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printResults() {
  console.log("\n========== [preflight-release-status] Results ==========");
  if (results.length === 0) {
    console.log("- no steps completed");
    return;
  }
  for (const result of results) {
    console.log(
      `${result.ok ? "✓" : "✗"} ${result.label} (${formatMs(result.durationMs)})`,
    );
  }
}

mkdirSync(OUTPUT_DIR, { recursive: true });
rmSync(HISTORY_REPORT, { force: true });

for (const [label, cmd, args] of steps) {
  console.log(`\n========== [preflight-release-status] ${label} ==========`);
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const started = Date.now();
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  const durationMs = Date.now() - started;
  if (result.error) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(`[preflight-release-status] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  error:   ${result.error.message}`);
    process.exit(1);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(`[preflight-release-status] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  exit:    ${result.status}`);
    process.exit(result.status);
  }
  if (result.signal) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(
      `[preflight-release-status] FAILED: ${label} (signal ${result.signal})`,
    );
    process.exit(1);
  }
  results.push({ label, ok: true, durationMs });
}

printResults();
console.log("\n[preflight-release-status] OK");

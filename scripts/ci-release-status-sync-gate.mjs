#!/usr/bin/env node
// Stage 3M · CI/local gate for release-status UI/docs/workflow sync.

import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const steps = [
  [
    "release status workflow gate",
    npmCmd,
    ["run", "check:release-status-workflow-gate"],
  ],
  [
    "release status sync checker",
    npmCmd,
    ["run", "check:release-status-sync"],
  ],
  [
    "Stage 3 docs guard",
    process.execPath,
    ["scripts/check-stage3-docs.mjs"],
  ],
  [
    "No deno.lock files",
    process.execPath,
    ["scripts/check-no-deno-locks.mjs"],
  ],
  ["git diff whitespace check", "git", ["diff", "--check"]],
];

const results = [];

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printResults() {
  console.log("\n========== [ci-release-status-sync-gate] Results ==========");
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

for (const [label, cmd, args] of steps) {
  console.log(`\n========== [ci-release-status-sync-gate] ${label} ==========`);
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const started = Date.now();
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  const durationMs = Date.now() - started;
  if (result.error) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(`[ci-release-status-sync-gate] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  error:   ${result.error.message}`);
    process.exit(1);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(`[ci-release-status-sync-gate] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  exit:    ${result.status}`);
    process.exit(result.status);
  }
  if (result.signal) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(
      `[ci-release-status-sync-gate] FAILED: ${label} (signal ${result.signal})`,
    );
    process.exit(1);
  }
  results.push({ label, ok: true, durationMs });
}

printResults();
console.log("\n[ci-release-status-sync-gate] OK");

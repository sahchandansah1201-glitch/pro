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
const annotationsEnabled = process.env.GITHUB_ACTIONS === "true";

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function escapeGithubAnnotationProperty(value) {
  return String(value)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A")
    .replace(/:/g, "%3A")
    .replace(/,/g, "%2C");
}

function escapeGithubAnnotationMessage(value) {
  return String(value)
    .replace(/%/g, "%25")
    .replace(/\r/g, "%0D")
    .replace(/\n/g, "%0A");
}

function emitGithubAnnotation(type, title, message) {
  if (!annotationsEnabled) return;
  console.log(
    `::${type} title=${escapeGithubAnnotationProperty(title)}::${escapeGithubAnnotationMessage(message)}`,
  );
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
    emitGithubAnnotation(
      "error",
      "Release status gate failed",
      `${label} failed before release-status reports could be written: ${result.error.message}`,
    );
    console.error(`[ci-release-status-sync-gate] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  error:   ${result.error.message}`);
    process.exit(1);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    results.push({ label, ok: false, durationMs });
    printResults();
    emitGithubAnnotation(
      "error",
      "Release status gate failed",
      `${label} exited ${result.status}; generated release-status reports must stay unwritten.`,
    );
    console.error(`[ci-release-status-sync-gate] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  exit:    ${result.status}`);
    process.exit(result.status);
  }
  if (result.signal) {
    results.push({ label, ok: false, durationMs });
    printResults();
    emitGithubAnnotation(
      "error",
      "Release status gate failed",
      `${label} terminated by signal ${result.signal}; generated release-status reports must stay unwritten.`,
    );
    console.error(
      `[ci-release-status-sync-gate] FAILED: ${label} (signal ${result.signal})`,
    );
    process.exit(1);
  }
  results.push({ label, ok: true, durationMs });
  emitGithubAnnotation(
    "notice",
    "Release status gate passed",
    `${label} passed in ${formatMs(durationMs)}.`,
  );
}

printResults();
emitGithubAnnotation(
  "notice",
  "Release status reports may be written",
  "All release-status sync gates passed before report generation.",
);
console.log("\n[ci-release-status-sync-gate] OK");

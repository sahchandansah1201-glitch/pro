#!/usr/bin/env node
// Stage 3M · Focused preflight for TypeScript typecheck and BlobPart helpers.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const nodeCmd = process.execPath;

const DEFAULT_STEPS = [
  ["typecheck", npmCmd, ["run", "typecheck"]],
  [
    "blob-utils tests",
    npmCmd,
    ["test", "--", "--run", "src/lib/blob-utils.test.ts"],
  ],
  ["Stage 3 docs guard", nodeCmd, ["scripts/check-stage3-docs.mjs"]],
  ["No deno.lock files", nodeCmd, ["scripts/check-no-deno-locks.mjs"]],
  ["Whitespace diff check", "git", ["diff", "--check"]],
];

export function getTypecheckBlobPreflightSteps() {
  return DEFAULT_STEPS.map(([label, cmd, args]) => [
    label,
    cmd,
    [...args],
  ]);
}

export function formatCommand(cmd, args) {
  return `$ ${cmd} ${args.join(" ")}`;
}

export function renderTypecheckBlobDryRun(steps = getTypecheckBlobPreflightSteps()) {
  const lines = ["[preflight-typecheck-blob] dry run", ""];
  for (const [label, cmd, args] of steps) {
    lines.push(`- ${label}`);
    lines.push(`  ${formatCommand(cmd, args)}`);
  }
  return lines.join("\n");
}

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printResults(results) {
  console.log("\n========== [preflight-typecheck-blob] Results ==========");
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

export function runTypecheckBlobPreflight({
  steps = getTypecheckBlobPreflightSteps(),
  spawn = spawnSync,
} = {}) {
  const results = [];

  for (const [label, cmd, args] of steps) {
    console.log(`\n========== [preflight-typecheck-blob] ${label} ==========`);
    console.log(formatCommand(cmd, args));
    const started = Date.now();
    const result = spawn(cmd, args, { stdio: "inherit", shell: false });
    const durationMs = Date.now() - started;

    if (result.error) {
      results.push({ label, ok: false, durationMs });
      printResults(results);
      console.error(`[preflight-typecheck-blob] FAILED: ${label}`);
      console.error(`  command: ${cmd} ${args.join(" ")}`);
      console.error(`  error:   ${result.error.message}`);
      return 1;
    }

    if (typeof result.status === "number" && result.status !== 0) {
      results.push({ label, ok: false, durationMs });
      printResults(results);
      console.error(`[preflight-typecheck-blob] FAILED: ${label}`);
      console.error(`  command: ${cmd} ${args.join(" ")}`);
      console.error(`  exit:    ${result.status}`);
      return result.status;
    }

    if (result.signal) {
      results.push({ label, ok: false, durationMs });
      printResults(results);
      console.error(
        `[preflight-typecheck-blob] FAILED: ${label} (signal ${result.signal})`,
      );
      return 1;
    }

    results.push({ label, ok: true, durationMs });
  }

  printResults(results);
  console.log("\n[preflight-typecheck-blob] OK");
  return 0;
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes("--dry-run")) {
    console.log(renderTypecheckBlobDryRun());
    return 0;
  }
  return runTypecheckBlobPreflight();
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}

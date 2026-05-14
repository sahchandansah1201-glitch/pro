#!/usr/bin/env node
// Stage 3M · Full deterministic local/CI preflight orchestrator.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
const nodeCmd = process.execPath;

const DEFAULT_SUMMARY_PATH = "test-results/preflight-all.md";

const DEFAULT_STEPS = [
  ["auth/assets deterministic preflight", npmCmd, ["run", "preflight:auth-assets"]],
  ["e2e artifacts preflight", npmCmd, ["run", "preflight:e2e-artifacts"]],
  ["release-status preflight", npmCmd, ["run", "preflight:release-status"]],
  ["typecheck/blob preflight", npmCmd, ["run", "preflight:typecheck-blob"]],
  ["Stage 4A self-hosted preflight", npmCmd, ["run", "preflight:stage4a"]],
  ["Stage 4B backend runtime preflight", npmCmd, ["run", "preflight:stage4b"]],
  ["Stage 4C auth/RBAC preflight", npmCmd, ["run", "preflight:stage4c"]],
  ["Stage 4D patient writes preflight", npmCmd, ["run", "preflight:stage4d"]],
  ["Stage 4E frontend patient API preflight", npmCmd, ["run", "preflight:stage4e"]],
  ["Stage 4F self-hosted auth bridge preflight", npmCmd, ["run", "preflight:stage4f"]],
  ["Stage 4G self-hosted visit workspace preflight", npmCmd, ["run", "preflight:stage4g"]],
  ["Stage 4H visit workspace writes preflight", npmCmd, ["run", "preflight:stage4h"]],
  ["Stage 4I self-hosted assets preflight", npmCmd, ["run", "preflight:stage4i"]],
  ["Stage 4J self-hosted asset binaries preflight", npmCmd, ["run", "preflight:stage4j"]],
  ["Stage 4K self-hosted deploy smoke preflight", npmCmd, ["run", "preflight:stage4k"]],
  ["Stage 4L self-hosted ops hardening preflight", npmCmd, ["run", "preflight:stage4l"]],
  ["Stage 4M production deployment verification preflight", npmCmd, ["run", "preflight:stage4m"]],
  ["Stage 4N production observability preflight", npmCmd, ["run", "preflight:stage4n"]],
  ["Stage 4O self-hosted ops UI preflight", npmCmd, ["run", "preflight:stage4o"]],
  ["Stage 4P self-hosted ops controls preflight", npmCmd, ["run", "preflight:stage4p"]],
  ["Stage 4Q self-hosted device registry preflight", npmCmd, ["run", "preflight:stage4q"]],
  ["Stage 4R Device Bridge commands preflight", npmCmd, ["run", "preflight:stage4r"]],
  ["Stage 4S Device Bridge worker contract preflight", npmCmd, ["run", "preflight:stage4s"]],
  ["Stage 4T Device Bridge worker runtime preflight", npmCmd, ["run", "preflight:stage4t"]],
  ["Stage 4U Device Bridge worker observability preflight", npmCmd, ["run", "preflight:stage4u"]],
  ["Stage 4V Device Bridge production hardening preflight", npmCmd, ["run", "preflight:stage4v"]],
  ["Stage 4W Device Bridge command safety preflight", npmCmd, ["run", "preflight:stage4w"]],
  ["Stage 4X Device Bridge audit replay preflight", npmCmd, ["run", "preflight:stage4x"]],
  ["Stage 4Y Device Bridge audit export preflight", npmCmd, ["run", "preflight:stage4y"]],
  ["Stage 4Z self-hosted product readiness preflight", npmCmd, ["run", "preflight:stage4z"]],
  ["Stage 5A self-hosted release candidate preflight", npmCmd, ["run", "preflight:stage5a"]],
  ["Stage 5B production server bootstrap preflight", npmCmd, ["run", "preflight:stage5b"]],
  ["Stage 5C production migration hardening preflight", npmCmd, ["run", "preflight:stage5c"]],
  ["Stage 5D production mode cutover preflight", npmCmd, ["run", "preflight:stage5d"]],
  ["Stage 5E production auth/bootstrap UX preflight", npmCmd, ["run", "preflight:stage5e"]],
  ["release-status CI sync gate", npmCmd, ["run", "ci:release-status-sync"]],
  ["preflight-all workflow gate", npmCmd, ["run", "check:preflight-all-gate"]],
  ["No deno.lock files", nodeCmd, ["scripts/check-no-deno-locks.mjs"]],
  ["Whitespace diff check", "git", ["diff", "--check"]],
];

export function getPreflightAllSteps() {
  return DEFAULT_STEPS.map(([label, cmd, args]) => [
    label,
    cmd,
    [...args],
  ]);
}

export function formatCommand(cmd, args) {
  return `$ ${cmd} ${args.join(" ")}`;
}

export function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function parsePreflightAllArgs(argv = []) {
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

export function renderPreflightAllDryRun(steps = getPreflightAllSteps()) {
  const lines = ["[preflight-all] dry run", ""];
  for (const [label, cmd, args] of steps) {
    lines.push(`- ${label}`);
    lines.push(`  ${formatCommand(cmd, args)}`);
  }
  return lines.join("\n");
}

export function renderPreflightAllSummary({
  status,
  results,
  summaryPath = DEFAULT_SUMMARY_PATH,
} = {}) {
  const ok = status === "ok";
  const lines = [
    "## Preflight all report",
    "",
    `- Status: \`${status || "unknown"}\``,
    `- Summary path: \`${summaryPath}\``,
    `- Completed steps: ${results?.length ?? 0}`,
    "",
    "### Steps",
    "",
  ];

  if (!results || results.length === 0) {
    lines.push("- No steps completed.");
  } else {
    for (const result of results) {
      lines.push(
        `- ${result.ok ? "✓" : "✗"} ${result.label} (${formatMs(result.durationMs)})`,
      );
      lines.push(`  - Command: \`${formatCommand(result.cmd, result.args)}\``);
      if (!result.ok && result.failure) {
        lines.push(`  - Failure: \`${result.failure}\``);
      }
    }
  }

  lines.push("");
  lines.push("### Release Checklist");
  lines.push("");
  lines.push(`- ${ok ? "✓" : "✗"} All deterministic local preflights passed.`);
  lines.push(`- ${ok ? "✓" : "✗"} Stage docs, sync gates, deno-lock guard, and diff check passed.`);
  lines.push("- Real-auth smoke remains opt-in/local and is not part of this gate.");
  lines.push("- No secrets, signed URLs, patient identifiers, or raw env values are printed.");
  lines.push("");

  return lines.join("\n");
}

function printResults(results) {
  console.log("\n========== [preflight-all] Results ==========");
  if (results.length === 0) {
    console.log("- no steps completed");
    return;
  }
  for (const result of results) {
    console.log(`${result.ok ? "✓" : "✗"} ${result.label} (${formatMs(result.durationMs)})`);
  }
}

function writeSummary(path, summary) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, summary);
  console.log(`[preflight-all] wrote ${path}`);
}

export function runPreflightAll({
  steps = getPreflightAllSteps(),
  spawn = spawnSync,
  summaryPath = null,
} = {}) {
  const results = [];

  for (const [label, cmd, args] of steps) {
    console.log(`\n========== [preflight-all] ${label} ==========`);
    console.log(formatCommand(cmd, args));
    const started = Date.now();
    const result = spawn(cmd, args, { stdio: "inherit", shell: false });
    const durationMs = Date.now() - started;
    const base = { label, cmd, args, durationMs };

    if (result.error) {
      results.push({ ...base, ok: false, failure: result.error.message });
      printResults(results);
      if (summaryPath) {
        writeSummary(summaryPath, renderPreflightAllSummary({ status: "fail", results, summaryPath }));
      }
      console.error(`[preflight-all] FAILED: ${label}`);
      console.error(`  command: ${cmd} ${args.join(" ")}`);
      console.error(`  error:   ${result.error.message}`);
      return 1;
    }

    if (typeof result.status === "number" && result.status !== 0) {
      results.push({ ...base, ok: false, failure: `exit ${result.status}` });
      printResults(results);
      if (summaryPath) {
        writeSummary(summaryPath, renderPreflightAllSummary({ status: "fail", results, summaryPath }));
      }
      console.error(`[preflight-all] FAILED: ${label}`);
      console.error(`  command: ${cmd} ${args.join(" ")}`);
      console.error(`  exit:    ${result.status}`);
      return result.status;
    }

    if (result.signal) {
      results.push({ ...base, ok: false, failure: `signal ${result.signal}` });
      printResults(results);
      if (summaryPath) {
        writeSummary(summaryPath, renderPreflightAllSummary({ status: "fail", results, summaryPath }));
      }
      console.error(`[preflight-all] FAILED: ${label} (signal ${result.signal})`);
      return 1;
    }

    results.push({ ...base, ok: true });
  }

  printResults(results);
  if (summaryPath) {
    writeSummary(summaryPath, renderPreflightAllSummary({ status: "ok", results, summaryPath }));
  }
  console.log("\n[preflight-all] OK");
  return 0;
}

export function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parsePreflightAllArgs(argv);
  } catch (error) {
    console.error(`[preflight-all] ${error.message}`);
    return 1;
  }

  if (args.dryRun) {
    console.log(renderPreflightAllDryRun());
    return 0;
  }

  return runPreflightAll({ summaryPath: args.summaryPath });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}

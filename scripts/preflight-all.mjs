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
  ["Stage 5F production patient/workspace cutover preflight", npmCmd, ["run", "preflight:stage5f"]],
  ["Stage 5G production clinical workspace completion preflight", npmCmd, ["run", "preflight:stage5g"]],
  ["Stage 5H production clinical backend contracts preflight", npmCmd, ["run", "preflight:stage5h"]],
  ["Stage 5I production doctor dashboard contracts preflight", npmCmd, ["run", "preflight:stage5i"]],
  ["Stage 5J production visit schedule contracts preflight", npmCmd, ["run", "preflight:stage5j"]],
  ["Stage 5K production leads/appointments contracts preflight", npmCmd, ["run", "preflight:stage5k"]],
  ["Stage 5L production leads/appointments writes preflight", npmCmd, ["run", "preflight:stage5l"]],
  ["Stage 5M production intake operator workspace preflight", npmCmd, ["run", "preflight:stage5m"]],
  ["Stage 5N production patient portal contracts preflight", npmCmd, ["run", "preflight:stage5n"]],
  ["Stage 5O production patient portal writes preflight", npmCmd, ["run", "preflight:stage5o"]],
  ["Stage 5P production clinic booking requests intake preflight", npmCmd, ["run", "preflight:stage5p"]],
  ["Stage 5Q external intake import contracts preflight", npmCmd, ["run", "preflight:stage5q"]],
  ["Stage 5R clinic available slots contract preflight", npmCmd, ["run", "preflight:stage5r"]],
  ["Stage 5S booking slot confirmation preflight", npmCmd, ["run", "preflight:stage5s"]],
  ["Stage 5T external intake hardening preflight", npmCmd, ["run", "preflight:stage5t"]],
  ["Stage 5U external adapter delivery pack preflight", npmCmd, ["run", "preflight:stage5u"]],
  ["Stage 5V external adapter operations preflight", npmCmd, ["run", "preflight:stage5v"]],
  ["Stage 5W external adapter incident runbook preflight", npmCmd, ["run", "preflight:stage5w"]],
  ["Stage 5X external adapter audit package preflight", npmCmd, ["run", "preflight:stage5x"]],
  ["Stage 5Y external adapter reconciliation package preflight", npmCmd, ["run", "preflight:stage5y"]],
  ["Stage 5Z external adapter production handoff preflight", npmCmd, ["run", "preflight:stage5z"]],
  ["Stage 6A production acceptance baseline preflight", npmCmd, ["run", "preflight:stage6a"]],
  ["Stage 6B server install package preflight", npmCmd, ["run", "preflight:stage6b"]],
  ["Stage 6C production install verification preflight", npmCmd, ["run", "preflight:stage6c"]],
  ["Stage 6D live install evidence receipt preflight", npmCmd, ["run", "preflight:stage6d"]],
  ["Stage 6E production go-live handoff preflight", npmCmd, ["run", "preflight:stage6e"]],
  ["Stage 6F production go-live decision record preflight", npmCmd, ["run", "preflight:stage6f"]],
  ["Stage 6G production post-go-live observation preflight", npmCmd, ["run", "preflight:stage6g"]],
  ["Stage 6H production release memory closure preflight", npmCmd, ["run", "preflight:stage6h"]],
  ["Stage 6I production release archive index preflight", npmCmd, ["run", "preflight:stage6i"]],
  ["Stage 6J production release archive handoff receipt preflight", npmCmd, ["run", "preflight:stage6j"]],
  ["Stage 6K production release archive reconciliation preflight", npmCmd, ["run", "preflight:stage6k"]],
  ["Stage 6L production release archive reconciliation receipt preflight", npmCmd, ["run", "preflight:stage6l"]],
  ["Stage 6M production release archive final closure preflight", npmCmd, ["run", "preflight:stage6m"]],
  ["Stage 6N production release archive final closure receipt preflight", npmCmd, ["run", "preflight:stage6n"]],
  ["Stage 6O production release archive retention register preflight", npmCmd, ["run", "preflight:stage6o"]],
  ["Stage 6P production release archive retention register receipt preflight", npmCmd, ["run", "preflight:stage6p"]],
  ["Stage 6Q production release archive retention cycle index preflight", npmCmd, ["run", "preflight:stage6q"]],
  ["Stage 6R production release archive retention cycle index receipt preflight", npmCmd, ["run", "preflight:stage6r"]],
  ["Stage 6S production release archive retention cycle closure preflight", npmCmd, ["run", "preflight:stage6s"]],
  ["Stage 6T production release archive retention cycle closure receipt preflight", npmCmd, ["run", "preflight:stage6t"]],
  ["Stage 6U production release archive retention cycle final closure preflight", npmCmd, ["run", "preflight:stage6u"]],
  ["Stage 6V production release archive retention cycle final closure receipt preflight", npmCmd, ["run", "preflight:stage6v"]],
  ["Stage 6W production release archive retention cycle final closure reconciliation preflight", npmCmd, ["run", "preflight:stage6w"]],
  ["Stage 6X production release archive retention cycle final closure reconciliation receipt preflight", npmCmd, ["run", "preflight:stage6x"]],
  ["Stage 6Y production release archive retention next-cycle register preflight", npmCmd, ["run", "preflight:stage6y"]],
  ["Stage 6Z production release archive retention next-cycle register receipt preflight", npmCmd, ["run", "preflight:stage6z"]],
  ["Stage 7A-7C development workflow contract preflight", npmCmd, ["run", "preflight:stage7a-7c"]],
  ["Stage 7D-7F batch automation contract preflight", npmCmd, ["run", "preflight:stage7d-7f"]],
  ["Stage 7G-7I batch verification loop preflight", npmCmd, ["run", "preflight:stage7g-7i"]],
  ["Stage 7J-7L product roadmap preflight", npmCmd, ["run", "preflight:stage7j-7l"]],
  ["Stage 8A-8C CRM inbound adapter preflight", npmCmd, ["run", "preflight:stage8a-8c"]],
  ["Stage 8D-8F availability sync preflight", npmCmd, ["run", "preflight:stage8d-8f"]],
  ["Stage 8G-8I clinical reporting completion preflight", npmCmd, ["run", "preflight:stage8g-8i"]],
  ["Stage 8J-8O Device Bridge and operations handbook preflight", npmCmd, ["run", "preflight:stage8j-8o"]],
  ["Stage 8P-9A Device Bridge operations continuity preflight", npmCmd, ["run", "preflight:stage8p-9a"]],
  ["Stage 9B-9M Device Bridge fleet reliability preflight", npmCmd, ["run", "preflight:stage9b-9m"]],
  ["Stage 9N-9Z Device Bridge lifecycle assurance preflight", npmCmd, ["run", "preflight:stage9n-9z"]],
  ["Stage 10A-10Z error prevention preflight", npmCmd, ["run", "preflight:stage10a-10z"]],
  ["Stage 11A-11Z development quality ledger preflight", npmCmd, ["run", "preflight:stage11a-11z"]],
  ["Stage 12A-12Z execution evidence bundle preflight", npmCmd, ["run", "preflight:stage12a-12z"]],
  ["Stage 13A-13Z execution evidence closure preflight", npmCmd, ["run", "preflight:stage13a-13z"]],
  ["Stage 14A-14Z sync confirmation ledger preflight", npmCmd, ["run", "preflight:stage14a-14z"]],
  ["Stage 15A-15Z post-sync handoff readiness preflight", npmCmd, ["run", "preflight:stage15a-15z"]],
  ["Stage 16A-16Z product cycle readiness preflight", npmCmd, ["run", "preflight:stage16a-16z"]],
  ["Stage 17A-17Z clinical follow-up communication preflight", npmCmd, ["run", "preflight:stage17a-17z"]],
  ["Stage 18A-18Z clinical follow-up operations hardening preflight", npmCmd, ["run", "preflight:stage18a-18z"]],
  ["Stage 19A-19Z clinical follow-up outcome quality preflight", npmCmd, ["run", "preflight:stage19a-19z"]],
  ["Stage 20A-20Z clinical follow-up retention clinic review preflight", npmCmd, ["run", "preflight:stage20a-20z"]],
  ["Stage 21A-21Z clinical follow-up SOP validation preflight", npmCmd, ["run", "preflight:stage21a-21z"]],
  ["Stage 22A-22Z clinical follow-up SOP policy templates preflight", npmCmd, ["run", "preflight:stage22a-22z"]],
  ["Stage 23A-23Z clinical follow-up SOP policy application preflight", npmCmd, ["run", "preflight:stage23a-23z"]],
  ["Stage 24A-24Z clinical follow-up SOP policy exception closure preflight", npmCmd, ["run", "preflight:stage24a-24z"]],
  ["Stage 25A-25Z clinical follow-up SOP policy audit rollup preflight", npmCmd, ["run", "preflight:stage25a-25z"]],
  ["Stage 26A-26Z clinical follow-up SOP policy governance readiness preflight", npmCmd, ["run", "preflight:stage26a-26z"]],
  ["Stage 27A-27Z clinical follow-up SOP policy governance closure preflight", npmCmd, ["run", "preflight:stage27a-27z"]],
  ["Stage 28A-28Z clinical follow-up SOP policy governance evidence preflight", npmCmd, ["run", "preflight:stage28a-28z"]],
  ["Stage 29A-29Z clinical follow-up SOP policy governance evidence reconciliation preflight", npmCmd, ["run", "preflight:stage29a-29z"]],
  ["Stage 30A-30Z clinical follow-up SOP policy governance evidence reconciliation closure preflight", npmCmd, ["run", "preflight:stage30a-30z"]],
  ["Stage 31A-31Z clinical follow-up SOP policy governance evidence reconciliation closure receipt preflight", npmCmd, ["run", "preflight:stage31a-31z"]],
  ["Stage 32A-32Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive readiness preflight", npmCmd, ["run", "preflight:stage32a-32z"]],
  ["Stage 33A-33Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure preflight", npmCmd, ["run", "preflight:stage33a-33z"]],
  ["Stage 34A-34Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt preflight", npmCmd, ["run", "preflight:stage34a-34z"]],
  ["Stage 35A-35Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff preflight", npmCmd, ["run", "preflight:stage35a-35z"]],
  ["Stage 36A-36Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt preflight", npmCmd, ["run", "preflight:stage36a-36z"]],
  ["Stage 37A-37Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation preflight", npmCmd, ["run", "preflight:stage37a-37z"]],
  ["Stage 38A-38Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure preflight", npmCmd, ["run", "preflight:stage38a-38z"]],
  ["Stage 39A-39Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt preflight", npmCmd, ["run", "preflight:stage39a-39z"]],
  ["Stage 40A-40Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness preflight", npmCmd, ["run", "preflight:stage40a-40z"]],
  ["Stage 41A-41Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure preflight", npmCmd, ["run", "preflight:stage41a-41z"]],
  ["Stage 42A-42Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt preflight", npmCmd, ["run", "preflight:stage42a-42z"]],
  ["Stage 43A-43Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff preflight", npmCmd, ["run", "preflight:stage43a-43z"]],
  ["Stage 44A-44Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt preflight", npmCmd, ["run", "preflight:stage44a-44z"]],
  ["release-status CI sync gate", npmCmd, ["run", "ci:release-status-sync"]],
  ["preflight-all workflow gate", npmCmd, ["run", "check:preflight-all-gate"]],
  ["project-memory black box guard", npmCmd, ["run", "check:project-memory"]],
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

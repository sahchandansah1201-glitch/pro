#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  getPreflightAllSteps,
  parsePreflightAllArgs,
  renderPreflightAllDryRun,
  renderPreflightAllSummary,
  runPreflightAll,
} from "./preflight-all.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "preflight-all.mjs");

test("preflight all command list covers deterministic local gates", () => {
  const steps = getPreflightAllSteps();
  const labels = steps.map(([label]) => label);
  const commands = steps.map(([, cmd, args]) => `${cmd} ${args.join(" ")}`);

  assert.deepEqual(labels, [
    "auth/assets deterministic preflight",
    "e2e artifacts preflight",
    "release-status preflight",
    "typecheck/blob preflight",
    "Stage 4A self-hosted preflight",
    "Stage 4B backend runtime preflight",
    "Stage 4C auth/RBAC preflight",
    "Stage 4D patient writes preflight",
    "Stage 4E frontend patient API preflight",
    "Stage 4F self-hosted auth bridge preflight",
    "Stage 4G self-hosted visit workspace preflight",
    "Stage 4H visit workspace writes preflight",
    "Stage 4I self-hosted assets preflight",
    "Stage 4J self-hosted asset binaries preflight",
    "Stage 4K self-hosted deploy smoke preflight",
    "Stage 4L self-hosted ops hardening preflight",
    "Stage 4M production deployment verification preflight",
    "Stage 4N production observability preflight",
    "Stage 4O self-hosted ops UI preflight",
    "Stage 4P self-hosted ops controls preflight",
    "Stage 4Q self-hosted device registry preflight",
    "Stage 4R Device Bridge commands preflight",
    "Stage 4S Device Bridge worker contract preflight",
    "Stage 4T Device Bridge worker runtime preflight",
    "Stage 4U Device Bridge worker observability preflight",
    "Stage 4V Device Bridge production hardening preflight",
    "Stage 4W Device Bridge command safety preflight",
    "Stage 4X Device Bridge audit replay preflight",
    "Stage 4Y Device Bridge audit export preflight",
    "Stage 4Z self-hosted product readiness preflight",
    "Stage 5A self-hosted release candidate preflight",
    "Stage 5B production server bootstrap preflight",
    "Stage 5C production migration hardening preflight",
    "Stage 5D production mode cutover preflight",
    "Stage 5E production auth/bootstrap UX preflight",
    "Stage 5F production patient/workspace cutover preflight",
    "Stage 5G production clinical workspace completion preflight",
    "Stage 5H production clinical backend contracts preflight",
    "Stage 5I production doctor dashboard contracts preflight",
    "Stage 5J production visit schedule contracts preflight",
    "Stage 5K production leads/appointments contracts preflight",
    "Stage 5L production leads/appointments writes preflight",
    "Stage 5M production intake operator workspace preflight",
    "Stage 5N production patient portal contracts preflight",
    "Stage 5O production patient portal writes preflight",
    "Stage 5P production clinic booking requests intake preflight",
    "Stage 5Q external intake import contracts preflight",
    "Stage 5R clinic available slots contract preflight",
    "Stage 5S booking slot confirmation preflight",
    "Stage 5T external intake hardening preflight",
    "Stage 5U external adapter delivery pack preflight",
    "Stage 5V external adapter operations preflight",
    "Stage 5W external adapter incident runbook preflight",
    "Stage 5X external adapter audit package preflight",
    "Stage 5Y external adapter reconciliation package preflight",
    "Stage 5Z external adapter production handoff preflight",
    "Stage 6A production acceptance baseline preflight",
    "Stage 6B server install package preflight",
    "Stage 6C production install verification preflight",
    "Stage 6D live install evidence receipt preflight",
    "Stage 6E production go-live handoff preflight",
    "Stage 6F production go-live decision record preflight",
    "Stage 6G production post-go-live observation preflight",
    "Stage 6H production release memory closure preflight",
    "Stage 6I production release archive index preflight",
    "Stage 6J production release archive handoff receipt preflight",
    "Stage 6K production release archive reconciliation preflight",
    "Stage 6L production release archive reconciliation receipt preflight",
    "Stage 6M production release archive final closure preflight",
    "Stage 6N production release archive final closure receipt preflight",
    "Stage 6O production release archive retention register preflight",
    "Stage 6P production release archive retention register receipt preflight",
    "Stage 6Q production release archive retention cycle index preflight",
    "Stage 6R production release archive retention cycle index receipt preflight",
    "Stage 6S production release archive retention cycle closure preflight",
    "Stage 6T production release archive retention cycle closure receipt preflight",
    "Stage 6U production release archive retention cycle final closure preflight",
    "Stage 6V production release archive retention cycle final closure receipt preflight",
    "Stage 6W production release archive retention cycle final closure reconciliation preflight",
    "Stage 6X production release archive retention cycle final closure reconciliation receipt preflight",
    "Stage 6Y production release archive retention next-cycle register preflight",
    "release-status CI sync gate",
    "preflight-all workflow gate",
    "project-memory black box guard",
    "No deno.lock files",
    "Whitespace diff check",
  ]);
  assert.match(commands[0], /npm(\.cmd)? run preflight:auth-assets/);
  assert.match(commands[1], /npm(\.cmd)? run preflight:e2e-artifacts/);
  assert.match(commands[2], /npm(\.cmd)? run preflight:release-status/);
  assert.match(commands[3], /npm(\.cmd)? run preflight:typecheck-blob/);
  assert.match(commands[4], /npm(\.cmd)? run preflight:stage4a/);
  assert.match(commands[5], /npm(\.cmd)? run preflight:stage4b/);
  assert.match(commands[6], /npm(\.cmd)? run preflight:stage4c/);
  assert.match(commands[7], /npm(\.cmd)? run preflight:stage4d/);
  assert.match(commands[8], /npm(\.cmd)? run preflight:stage4e/);
  assert.match(commands[9], /npm(\.cmd)? run preflight:stage4f/);
  assert.match(commands[10], /npm(\.cmd)? run preflight:stage4g/);
  assert.match(commands[11], /npm(\.cmd)? run preflight:stage4h/);
  assert.match(commands[12], /npm(\.cmd)? run preflight:stage4i/);
  assert.match(commands[13], /npm(\.cmd)? run preflight:stage4j/);
  assert.match(commands[14], /npm(\.cmd)? run preflight:stage4k/);
  assert.match(commands[15], /npm(\.cmd)? run preflight:stage4l/);
  assert.match(commands[16], /npm(\.cmd)? run preflight:stage4m/);
  assert.match(commands[17], /npm(\.cmd)? run preflight:stage4n/);
  assert.match(commands[18], /npm(\.cmd)? run preflight:stage4o/);
  assert.match(commands[19], /npm(\.cmd)? run preflight:stage4p/);
  assert.match(commands[20], /npm(\.cmd)? run preflight:stage4q/);
  assert.match(commands[21], /npm(\.cmd)? run preflight:stage4r/);
  assert.match(commands[22], /npm(\.cmd)? run preflight:stage4s/);
  assert.match(commands[23], /npm(\.cmd)? run preflight:stage4t/);
  assert.match(commands[24], /npm(\.cmd)? run preflight:stage4u/);
  assert.match(commands[25], /npm(\.cmd)? run preflight:stage4v/);
  assert.match(commands[26], /npm(\.cmd)? run preflight:stage4w/);
  assert.match(commands[27], /npm(\.cmd)? run preflight:stage4x/);
  assert.match(commands[28], /npm(\.cmd)? run preflight:stage4y/);
  assert.match(commands[29], /npm(\.cmd)? run preflight:stage4z/);
  assert.match(commands[30], /npm(\.cmd)? run preflight:stage5a/);
  assert.match(commands[31], /npm(\.cmd)? run preflight:stage5b/);
  assert.match(commands[32], /npm(\.cmd)? run preflight:stage5c/);
  assert.match(commands[33], /npm(\.cmd)? run preflight:stage5d/);
  assert.match(commands[34], /npm(\.cmd)? run preflight:stage5e/);
  assert.match(commands[35], /npm(\.cmd)? run preflight:stage5f/);
  assert.match(commands[36], /npm(\.cmd)? run preflight:stage5g/);
  assert.match(commands[37], /npm(\.cmd)? run preflight:stage5h/);
  assert.match(commands[38], /npm(\.cmd)? run preflight:stage5i/);
  assert.match(commands[39], /npm(\.cmd)? run preflight:stage5j/);
  assert.match(commands[40], /npm(\.cmd)? run preflight:stage5k/);
  assert.match(commands[41], /npm(\.cmd)? run preflight:stage5l/);
  assert.match(commands[42], /npm(\.cmd)? run preflight:stage5m/);
  assert.match(commands[43], /npm(\.cmd)? run preflight:stage5n/);
  assert.match(commands[44], /npm(\.cmd)? run preflight:stage5o/);
  assert.match(commands[45], /npm(\.cmd)? run preflight:stage5p/);
  assert.match(commands[46], /npm(\.cmd)? run preflight:stage5q/);
  assert.match(commands[47], /npm(\.cmd)? run preflight:stage5r/);
  assert.match(commands[48], /npm(\.cmd)? run preflight:stage5s/);
  assert.match(commands[49], /npm(\.cmd)? run preflight:stage5t/);
  assert.match(commands[50], /npm(\.cmd)? run preflight:stage5u/);
  assert.match(commands[51], /npm(\.cmd)? run preflight:stage5v/);
  assert.match(commands[52], /npm(\.cmd)? run preflight:stage5w/);
  assert.match(commands[53], /npm(\.cmd)? run preflight:stage5x/);
  assert.match(commands[54], /npm(\.cmd)? run preflight:stage5y/);
  assert.match(commands[55], /npm(\.cmd)? run preflight:stage5z/);
  assert.match(commands[56], /npm(\.cmd)? run preflight:stage6a/);
  assert.match(commands[57], /npm(\.cmd)? run preflight:stage6b/);
  assert.match(commands[58], /npm(\.cmd)? run preflight:stage6c/);
  assert.match(commands[59], /npm(\.cmd)? run preflight:stage6d/);
  assert.match(commands[60], /npm(\.cmd)? run preflight:stage6e/);
  assert.match(commands[61], /npm(\.cmd)? run preflight:stage6f/);
  assert.match(commands[62], /npm(\.cmd)? run preflight:stage6g/);
  assert.match(commands[63], /npm(\.cmd)? run preflight:stage6h/);
  assert.match(commands[64], /npm(\.cmd)? run preflight:stage6i/);
  assert.match(commands[65], /npm(\.cmd)? run preflight:stage6j/);
  assert.match(commands[66], /npm(\.cmd)? run preflight:stage6k/);
  assert.match(commands[67], /npm(\.cmd)? run preflight:stage6l/);
  assert.match(commands[68], /npm(\.cmd)? run preflight:stage6m/);
  assert.match(commands[69], /npm(\.cmd)? run preflight:stage6n/);
  assert.match(commands[70], /npm(\.cmd)? run preflight:stage6o/);
  assert.match(commands[71], /npm(\.cmd)? run preflight:stage6p/);
  assert.match(commands[72], /npm(\.cmd)? run preflight:stage6q/);
  assert.match(commands[73], /npm(\.cmd)? run preflight:stage6r/);
  assert.match(commands[74], /npm(\.cmd)? run preflight:stage6s/);
  assert.match(commands[75], /npm(\.cmd)? run preflight:stage6t/);
  assert.match(commands[76], /npm(\.cmd)? run preflight:stage6u/);
  assert.match(commands[77], /npm(\.cmd)? run preflight:stage6v/);
  assert.match(commands[78], /npm(\.cmd)? run preflight:stage6w/);
  assert.match(commands[79], /npm(\.cmd)? run preflight:stage6x/);
  assert.match(commands[80], /npm(\.cmd)? run preflight:stage6y/);
  assert.match(commands[81], /npm(\.cmd)? run ci:release-status-sync/);
  assert.match(commands[82], /npm(\.cmd)? run check:preflight-all-gate/);
  assert.match(commands[83], /npm(\.cmd)? run check:project-memory/);
  assert.match(commands[84], /scripts\/check-no-deno-locks\.mjs/);
  assert.equal(commands[85], "git diff --check");
});

test("argument parser supports dry-run and summary path forms", () => {
  assert.deepEqual(parsePreflightAllArgs(["--dry-run"]), {
    dryRun: true,
    summaryPath: null,
  });
  assert.deepEqual(parsePreflightAllArgs(["--summary", "x.md"]), {
    dryRun: false,
    summaryPath: "x.md",
  });
  assert.deepEqual(parsePreflightAllArgs(["--summary=x.md"]), {
    dryRun: false,
    summaryPath: "x.md",
  });
  assert.throws(() => parsePreflightAllArgs(["--summary"]), /requires a path/);
  assert.throws(() => parsePreflightAllArgs(["--bad"]), /Unknown argument/);
});

test("dry-run output includes copyable commands", () => {
  const out = renderPreflightAllDryRun();
  assert.match(out, /\[preflight-all\] dry run/);
  assert.match(out, /preflight:auth-assets/);
  assert.match(out, /preflight:release-status/);
  assert.match(out, /preflight:typecheck-blob/);
  assert.match(out, /preflight:stage4a/);
  assert.match(out, /preflight:stage4b/);
  assert.match(out, /preflight:stage4c/);
  assert.match(out, /preflight:stage4d/);
  assert.match(out, /preflight:stage4e/);
  assert.match(out, /preflight:stage4f/);
  assert.match(out, /preflight:stage4g/);
  assert.match(out, /preflight:stage4h/);
  assert.match(out, /preflight:stage4i/);
  assert.match(out, /preflight:stage4j/);
  assert.match(out, /preflight:stage4k/);
  assert.match(out, /preflight:stage4l/);
  assert.match(out, /preflight:stage4m/);
  assert.match(out, /preflight:stage4n/);
  assert.match(out, /preflight:stage4o/);
  assert.match(out, /preflight:stage4p/);
  assert.match(out, /preflight:stage4q/);
  assert.match(out, /preflight:stage4r/);
  assert.match(out, /preflight:stage4s/);
  assert.match(out, /preflight:stage4t/);
  assert.match(out, /preflight:stage4u/);
  assert.match(out, /preflight:stage4v/);
  assert.match(out, /preflight:stage4w/);
  assert.match(out, /preflight:stage4x/);
  assert.match(out, /preflight:stage4y/);
  assert.match(out, /preflight:stage4z/);
  assert.match(out, /preflight:stage5a/);
  assert.match(out, /preflight:stage5b/);
  assert.match(out, /preflight:stage5c/);
  assert.match(out, /preflight:stage5d/);
  assert.match(out, /preflight:stage5e/);
  assert.match(out, /preflight:stage5f/);
  assert.match(out, /preflight:stage5g/);
  assert.match(out, /preflight:stage5h/);
  assert.match(out, /preflight:stage5i/);
  assert.match(out, /preflight:stage5j/);
  assert.match(out, /preflight:stage5k/);
  assert.match(out, /preflight:stage5l/);
  assert.match(out, /preflight:stage5m/);
  assert.match(out, /preflight:stage5n/);
  assert.match(out, /preflight:stage5o/);
  assert.match(out, /preflight:stage5p/);
  assert.match(out, /preflight:stage5q/);
  assert.match(out, /preflight:stage5r/);
  assert.match(out, /preflight:stage5s/);
  assert.match(out, /preflight:stage5t/);
  assert.match(out, /preflight:stage5u/);
  assert.match(out, /preflight:stage5v/);
  assert.match(out, /preflight:stage5w/);
  assert.match(out, /preflight:stage5x/);
  assert.match(out, /preflight:stage5y/);
  assert.match(out, /preflight:stage5z/);
  assert.match(out, /preflight:stage6a/);
  assert.match(out, /preflight:stage6b/);
  assert.match(out, /preflight:stage6c/);
  assert.match(out, /preflight:stage6d/);
  assert.match(out, /preflight:stage6e/);
  assert.match(out, /preflight:stage6f/);
  assert.match(out, /preflight:stage6g/);
  assert.match(out, /preflight:stage6h/);
  assert.match(out, /preflight:stage6i/);
  assert.match(out, /preflight:stage6j/);
  assert.match(out, /preflight:stage6k/);
  assert.match(out, /preflight:stage6l/);
  assert.match(out, /preflight:stage6m/);
  assert.match(out, /preflight:stage6n/);
  assert.match(out, /preflight:stage6o/);
  assert.match(out, /preflight:stage6p/);
  assert.match(out, /preflight:stage6q/);
  assert.match(out, /preflight:stage6r/);
  assert.match(out, /preflight:stage6s/);
  assert.match(out, /preflight:stage6t/);
  assert.match(out, /preflight:stage6u/);
  assert.match(out, /preflight:stage6v/);
  assert.match(out, /preflight:stage6w/);
  assert.match(out, /ci:release-status-sync/);
  assert.match(out, /check:preflight-all-gate/);
  assert.match(out, /check:project-memory/);
  assert.match(out, /git diff --check/);
});

test("summary renderer reports status, commands, checklist, and no secret-like values", () => {
  const out = renderPreflightAllSummary({
    status: "ok",
    summaryPath: "test-results/preflight-all.md",
    results: [
      {
        label: "typecheck",
        cmd: "npm",
        args: ["run", "typecheck"],
        ok: true,
        durationMs: 1500,
      },
    ],
  });

  assert.match(out, /## Preflight all report/);
  assert.match(out, /Status: `ok`/);
  assert.match(out, /npm run typecheck/);
  assert.match(out, /Release Checklist/);
  assert.doesNotMatch(out, /access_token|Authorization|Cookie|patient_full_name|storage_object_path/);
});

test("runner writes success summary and stops at first failing step", () => {
  const dir = mkdtempSync(join(tmpdir(), "preflight-all-"));
  try {
    const successPath = join(dir, "success.md");
    const originalLog = console.log;
    const originalError = console.error;
    console.log = () => undefined;
    console.error = () => undefined;
    let success;
    try {
      success = runPreflightAll({
        summaryPath: successPath,
        steps: [["ok", "cmd-ok", ["a"]]],
        spawn() {
          return { status: 0 };
        },
      });
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
    assert.equal(success, 0);
    assert.match(readFileSync(successPath, "utf8"), /Status: `ok`/);

    const calls = [];
    const failPath = join(dir, "fail.md");
    console.log = () => undefined;
    console.error = () => undefined;
    let failure;
    try {
      failure = runPreflightAll({
        summaryPath: failPath,
        steps: [
          ["ok", "cmd-ok", ["a"]],
          ["fail", "cmd-fail", ["b"]],
          ["never", "cmd-never", ["c"]],
        ],
        spawn(cmd, args) {
          calls.push([cmd, args]);
          return { status: cmd === "cmd-fail" ? 9 : 0 };
        },
      });
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }

    assert.equal(failure, 9);
    assert.deepEqual(calls.map(([cmd]) => cmd), ["cmd-ok", "cmd-fail"]);
    assert.match(readFileSync(failPath, "utf8"), /Status: `fail`/);
    assert.match(readFileSync(failPath, "utf8"), /Failure: `exit 9`/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli dry-run exits 0", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[preflight-all\] dry run/);
  assert.match(result.stdout, /preflight:auth-assets/);
});

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
    "release-status CI sync gate",
    "preflight-all workflow gate",
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
  assert.match(commands[25], /npm(\.cmd)? run ci:release-status-sync/);
  assert.match(commands[26], /npm(\.cmd)? run check:preflight-all-gate/);
  assert.match(commands[27], /scripts\/check-no-deno-locks\.mjs/);
  assert.equal(commands[28], "git diff --check");
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
  assert.match(out, /ci:release-status-sync/);
  assert.match(out, /check:preflight-all-gate/);
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

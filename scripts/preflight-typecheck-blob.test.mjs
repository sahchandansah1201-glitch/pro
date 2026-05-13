#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  formatCommand,
  getTypecheckBlobPreflightSteps,
  renderTypecheckBlobDryRun,
  runTypecheckBlobPreflight,
} from "./preflight-typecheck-blob.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "preflight-typecheck-blob.mjs");

test("preflight command list covers typecheck, blob-utils, docs, deno, and diff guards", () => {
  const steps = getTypecheckBlobPreflightSteps();
  const labels = steps.map(([label]) => label);
  const commands = steps.map(([, cmd, args]) => formatCommand(cmd, args));

  assert.deepEqual(labels, [
    "typecheck",
    "blob-utils tests",
    "Stage 3 docs guard",
    "No deno.lock files",
    "Whitespace diff check",
  ]);
  assert.match(commands[0], /npm(\.cmd)? run typecheck/);
  assert.match(
    commands[1],
    /npm(\.cmd)? test -- --run src\/lib\/blob-utils\.test\.ts/,
  );
  assert.match(commands[2], /node .*scripts\/check-stage3-docs\.mjs|scripts\/check-stage3-docs\.mjs/);
  assert.match(commands[3], /node .*scripts\/check-no-deno-locks\.mjs|scripts\/check-no-deno-locks\.mjs/);
  assert.equal(commands[4], "$ git diff --check");
});

test("dry run prints copyable commands without executing the guards", () => {
  const out = renderTypecheckBlobDryRun();
  assert.match(out, /\[preflight-typecheck-blob\] dry run/);
  assert.match(out, /npm(\.cmd)? run typecheck/);
  assert.match(out, /src\/lib\/blob-utils\.test\.ts/);
  assert.match(out, /scripts\/check-stage3-docs\.mjs/);
  assert.match(out, /scripts\/check-no-deno-locks\.mjs/);
  assert.match(out, /git diff --check/);
});

test("runner stops at first failing step and returns that exit code", () => {
  const calls = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = () => undefined;
  console.error = () => undefined;
  let exit;
  try {
    exit = runTypecheckBlobPreflight({
      steps: [
        ["ok", "cmd-ok", ["a"]],
        ["fail", "cmd-fail", ["b"]],
        ["never", "cmd-never", ["c"]],
      ],
      spawn(cmd, args) {
        calls.push([cmd, args]);
        return { status: cmd === "cmd-fail" ? 7 : 0 };
      },
    });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.equal(exit, 7);
  assert.deepEqual(
    calls.map(([cmd]) => cmd),
    ["cmd-ok", "cmd-fail"],
  );
});

test("cli dry-run exits 0 and includes the expected preflight name", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\[preflight-typecheck-blob\] dry run/);
  assert.match(result.stdout, /blob-utils tests/);
});

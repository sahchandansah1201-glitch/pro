// Log-safety tests for scripts/smoke-auth-assets.mjs.
// No external deps. Spawns the runner as a child process and asserts on
// exit code and stdout/stderr contents.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "smoke-auth-assets.mjs");

const REQUIRED = ["E2E_DOCTOR_EMAIL", "E2E_DOCTOR_PASSWORD", "E2E_VISIT_ROUTE"];

function runRunner(env) {
  // Build a clean env: start from process.env, strip required + dry-run
  // unless the caller explicitly sets them.
  const baseEnv = { ...process.env };
  for (const name of REQUIRED) delete baseEnv[name];
  delete baseEnv.SMOKE_AUTH_ASSETS_DRY_RUN;
  const finalEnv = { ...baseEnv, ...env };

  const result = spawnSync(process.execPath, [SCRIPT], {
    env: finalEnv,
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    combined: (result.stdout ?? "") + (result.stderr ?? ""),
  };
}

test("missing required env vars: exit 1, lists missing names, no fake secret leak", () => {
  const fakeSecret = "fake-leaky-secret-value-xyz";
  const out = runRunner({ NOT_A_REAL_VAR_FOR_LEAK_CHECK: fakeSecret });

  assert.equal(out.status, 1, `expected exit 1, got ${out.status}`);
  for (const name of REQUIRED) {
    assert.ok(
      out.combined.includes(name),
      `expected output to mention missing var ${name}`,
    );
  }
  assert.ok(
    !out.combined.includes(fakeSecret),
    "runner must not leak arbitrary env values",
  );
});

test("dry run with required env vars: exit 0, prints DRY RUN + command, no secret leak", () => {
  const email = "doctor@example.com";
  const password = "super-secret-password";
  const route = "/x";

  const out = runRunner({
    SMOKE_AUTH_ASSETS_DRY_RUN: "1",
    E2E_DOCTOR_EMAIL: email,
    E2E_DOCTOR_PASSWORD: password,
    E2E_VISIT_ROUTE: route,
  });

  assert.equal(out.status, 0, `expected exit 0, got ${out.status}`);
  assert.ok(
    out.combined.includes("[smoke-auth-assets] DRY RUN: would run Playwright smoke."),
    "expected DRY RUN banner",
  );
  assert.ok(
    out.combined.includes("npx playwright test e2e/auth-assets-smoke.pw.ts"),
    "expected playwright command in dry-run output",
  );
  assert.ok(
    !out.combined.includes(password),
    "runner must not print the password value",
  );
  assert.ok(
    !out.combined.includes(email),
    "runner must not print the email value",
  );
});

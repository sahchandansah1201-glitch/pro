#!/usr/bin/env node
// Local opt-in real-auth smoke runner for the auth/assets surface.
// Requires E2E_DOCTOR_* credentials in the local environment.
// Never run with real credentials in CI.

import { spawnSync } from "node:child_process";

const REQUIRED = ["E2E_DOCTOR_EMAIL", "E2E_DOCTOR_PASSWORD", "E2E_VISIT_ROUTE"];
const OPTIONAL = ["E2E_EXPECT_ASSET_ROW", "E2E_TRY_PREVIEW", "PW_CHROMIUM_PATH"];

const missing = REQUIRED.filter((name) => {
  const value = process.env[name];
  return value === undefined || value === "";
});

if (missing.length > 0) {
  console.error("[smoke-auth-assets] Missing required environment variables:");
  for (const name of missing) {
    console.error(`  - ${name}`);
  }
  console.error("");
  console.error("Optional environment variables (passed through unchanged):");
  for (const name of OPTIONAL) {
    console.error(`  - ${name}`);
  }
  console.error("");
  console.error("Example:");
  console.error(
    "  E2E_DOCTOR_EMAIL=doctor@example.com \\\n" +
      "  E2E_DOCTOR_PASSWORD='***' \\\n" +
      "  E2E_VISIT_ROUTE=/doctor/visits/<visit-id> \\\n" +
      "  npm run smoke:auth-assets",
  );
  console.error("");
  console.error(
    "[smoke-auth-assets] Refusing to run Playwright without credentials.",
  );
  process.exit(1);
}

const isWindows = process.platform === "win32";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const args = ["playwright", "test", "e2e/auth-assets-smoke.pw.ts"];

console.log(`[smoke-auth-assets] $ ${npxCmd} ${args.join(" ")}`);
const result = spawnSync(npxCmd, args, { stdio: "inherit", shell: false });

if (result.error) {
  console.error(`[smoke-auth-assets] Failed to spawn Playwright: ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  console.error(`[smoke-auth-assets] Playwright terminated by signal ${result.signal}`);
  process.exit(1);
}
process.exit(typeof result.status === "number" ? result.status : 1);

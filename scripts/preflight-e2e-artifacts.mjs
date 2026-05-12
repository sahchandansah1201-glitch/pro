#!/usr/bin/env node
// Focused local preflight for the nightly e2e artifact-reporting surface.

import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const steps = [
  ["e2e artifact summary log-safety", npmCmd, ["run", "test:e2e-artifacts"]],
  ["Stage 3 docs guard", process.execPath, ["scripts/check-stage3-docs.mjs"]],
  ["No deno.lock files", process.execPath, ["scripts/check-no-deno-locks.mjs"]],
];

for (const [label, cmd, args] of steps) {
  console.log(`\n========== [preflight-e2e-artifacts] ${label} ==========`);
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (result.error) {
    console.error(`[preflight-e2e-artifacts] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  error:   ${result.error.message}`);
    process.exit(1);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    console.error(`[preflight-e2e-artifacts] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  exit:    ${result.status}`);
    process.exit(result.status);
  }
  if (result.signal) {
    console.error(`[preflight-e2e-artifacts] FAILED: ${label} (signal ${result.signal})`);
    process.exit(1);
  }
}

console.log("\n[preflight-e2e-artifacts] OK");

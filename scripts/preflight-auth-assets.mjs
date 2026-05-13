#!/usr/bin/env node
// Local preflight for the auth/assets surface. Mirrors the deterministic
// CI guard `frontend-auth-assets`. No network, no Deno, no Playwright.

import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const steps = [
  ["supabase-client",          npmCmd, ["test", "--", "--run", "src/lib/supabase-client.test.ts"]],
  ["AuthContext",              npmCmd, ["test", "--", "--run", "src/context/AuthContext.test.tsx"]],
  ["LoginForm",                npmCmd, ["test", "--", "--run", "src/components/auth/LoginForm.test.tsx"]],
  ["Login page",               npmCmd, ["test", "--", "--run", "src/pages/Login.test.tsx"]],
  ["RoleGuard",                npmCmd, ["test", "--", "--run", "src/components/shell/RoleGuard.test.tsx"]],
  ["RoleSwitcher",             npmCmd, ["test", "--", "--run", "src/components/shell/RoleSwitcher.test.tsx"]],
  ["use-api-session",          npmCmd, ["test", "--", "--run", "src/lib/use-api-session.test.tsx"]],
  ["auth-role",                npmCmd, ["test", "--", "--run", "src/lib/auth-role.test.ts"]],
  ["clinical-assets-api",      npmCmd, ["test", "--", "--run", "src/lib/clinical-assets-api.test.ts"]],
  ["PatientsPage",             npmCmd, ["test", "--", "--run", "src/pages/doctor/PatientsPage.test.tsx"]],
  ["VisitWorkspacePage",       npmCmd, ["test", "--", "--run", "src/pages/doctor/VisitWorkspacePage.test.tsx"]],
  ["VisitImagingTab",          npmCmd, ["test", "--", "--run", "src/pages/doctor/VisitImagingTab.test.tsx"]],
  ["VisitImagingTab hygiene",  npmCmd, ["test", "--", "--run", "src/pages/doctor/VisitImagingTab.hygiene.test.ts"]],
  ["Doctor forbidden scan",    process.execPath, ["scripts/scan-doctor-forbidden.mjs"]],
  ["smoke runner log-safety",  npmCmd, ["run", "test:smoke-auth-assets"]],
  ["e2e artifact summary log-safety", npmCmd, ["run", "test:e2e-artifacts"]],
  ["TypeScript typecheck",     npmCmd, ["run", "typecheck"]],
  ["Build",                    npmCmd, ["run", "build"]],
  ["No deno.lock files",       process.execPath, ["scripts/check-no-deno-locks.mjs"]],
];

const results = [];

function formatMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printResults() {
  console.log("\n========== [preflight-auth-assets] Results ==========");
  if (results.length === 0) {
    console.log("- no steps completed");
    return;
  }
  for (const result of results) {
    console.log(`${result.ok ? "✓" : "✗"} ${result.label} (${formatMs(result.durationMs)})`);
  }
}

for (const [label, cmd, args] of steps) {
  const header = `\n========== [preflight-auth-assets] ${label} ==========`;
  console.log(header);
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const started = Date.now();
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  const durationMs = Date.now() - started;
  if (result.error) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(`[preflight-auth-assets] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  error:   ${result.error.message}`);
    process.exit(1);
  }
  if (typeof result.status === "number" && result.status !== 0) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(`[preflight-auth-assets] FAILED: ${label}`);
    console.error(`  command: ${cmd} ${args.join(" ")}`);
    console.error(`  exit:    ${result.status}`);
    process.exit(result.status);
  }
  if (result.signal) {
    results.push({ label, ok: false, durationMs });
    printResults();
    console.error(`[preflight-auth-assets] FAILED: ${label} (signal ${result.signal})`);
    process.exit(1);
  }
  results.push({ label, ok: true, durationMs });
}

printResults();
console.log("\n[preflight-auth-assets] OK");

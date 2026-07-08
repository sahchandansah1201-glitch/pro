#!/usr/bin/env node
// Stage 6 · live browser client journey for public analysis links.
// Runs Playwright against a real deployed frontend and backend API.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { deployStatusBlocksLiveE2E } from "./run-production-admin-management-live-e2e.mjs";
import { CREATE_TEST_CLINIC_CONFIRMATION } from "./stage4m-admin-management-api-smoke.mjs";

const DEFAULT_BASE_URL = "https://pro.skindoktor.ru";
const DEFAULT_DEPLOY_STATUS_FILE = "/opt/dermatolog-pro/logs/update-production-status.json";

function command(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

export function parseLivePublicAnalysisE2EArgs(argv = [], env = process.env) {
  const parsed = {
    baseUrl: env.STAGE4M_LIVE_PUBLIC_ANALYSIS_BASE_URL || env.STAGE4M_LIVE_ADMIN_BASE_URL || DEFAULT_BASE_URL,
    deployStatusFile: env.STAGE4M_DEPLOY_STATUS_FILE || DEFAULT_DEPLOY_STATUS_FILE,
    ignoreDeployStatus: env.STAGE4M_IGNORE_DEPLOY_STATUS === "1",
    confirmation: env.STAGE4M_CONFIRM_CREATE_TEST_CLINIC || "",
    headed: false,
    updateSnapshots: false,
    help: false,
    errors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--base-url") {
      if (!next) parsed.errors.push("--base-url requires a value");
      else {
        parsed.baseUrl = next;
        index += 1;
      }
    } else if (arg === "--deploy-status-json") {
      if (!next) parsed.errors.push("--deploy-status-json requires a value");
      else {
        parsed.deployStatusFile = next;
        index += 1;
      }
    } else if (arg === "--ignore-deploy-status") {
      parsed.ignoreDeployStatus = true;
    } else if (arg === "--confirm-create-test-clinic") {
      if (!next) parsed.errors.push("--confirm-create-test-clinic requires a value");
      else {
        parsed.confirmation = next;
        index += 1;
      }
    } else if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--update-snapshots") {
      parsed.updateSnapshots = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      parsed.errors.push(`Unknown argument: ${arg}`);
    }
  }

  if (!parsed.help) {
    if (!/^https?:\/\//i.test(parsed.baseUrl)) parsed.errors.push("--base-url must start with http:// or https://");
    if (parsed.confirmation !== CREATE_TEST_CLINIC_CONFIRMATION) {
      parsed.errors.push(`--confirm-create-test-clinic must equal ${CREATE_TEST_CLINIC_CONFIRMATION}`);
    }
  }

  return parsed;
}

function hasLocalPlaywrightTest(cwd) {
  return existsSync(`${cwd}/node_modules/@playwright/test/index.js`);
}

export function usage() {
  return [
    "Usage:",
    "  npm run e2e:public-analysis:live -- \\",
    "    --base-url https://pro.skindoktor.ru \\",
    `    --confirm-create-test-clinic ${CREATE_TEST_CLINIC_CONFIRMATION}`,
    "",
    "This test creates temporary signed report links in the self-hosted database,",
    "then opens public analysis links without authentication and verifies valid, expired, and missing states.",
  ].join("\n");
}

export function runLivePublicAnalysisE2E(argv = process.argv.slice(2), { spawn = spawnSync, cwd = process.cwd() } = {}) {
  const parsed = parseLivePublicAnalysisE2EArgs(argv);
  if (parsed.help) {
    console.log(usage());
    return 0;
  }
  if (parsed.errors.length) {
    console.error(parsed.errors.join("\n"));
    console.error("");
    console.error(usage());
    return 2;
  }
  const deployBlocker = deployStatusBlocksLiveE2E({
    deployStatusFile: parsed.deployStatusFile,
    ignoreDeployStatus: parsed.ignoreDeployStatus,
  });
  if (deployBlocker) {
    console.error(deployBlocker);
    return 2;
  }
  if (!hasLocalPlaywrightTest(cwd)) {
    console.error("Local dependency @playwright/test is missing. Wait for update-production.sh to finish npm ci, or run npm ci before live browser smoke.");
    return 2;
  }

  const args = ["playwright", "test", "e2e/production-public-analysis-live.pw.ts", "--project=chromium"];
  if (parsed.headed) args.push("--headed");
  if (parsed.updateSnapshots) args.push("--update-snapshots");

  const result = spawn(command("npx"), args, {
    cwd,
    env: {
      ...process.env,
      STAGE4M_LIVE_PUBLIC_ANALYSIS_BASE_URL: parsed.baseUrl.replace(/\/+$/, ""),
      STAGE4M_CONFIRM_CREATE_TEST_CLINIC: parsed.confirmation,
    },
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(runLivePublicAnalysisE2E());
}

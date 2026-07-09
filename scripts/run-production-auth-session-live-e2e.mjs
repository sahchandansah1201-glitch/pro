#!/usr/bin/env node
// Stage 4M · read-only live browser journey for production auth/session behavior.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { deployStatusBlocksLiveE2E } from "./run-production-admin-management-live-e2e.mjs";

const DEFAULT_BASE_URL = "https://pro.skindoktor.ru";
const DEFAULT_CREDENTIALS_FILE = "/root/dermatolog-pro-admin-credentials.txt";
const DEFAULT_DEPLOY_STATUS_FILE = "/opt/dermatolog-pro/logs/update-production-status.json";

function command(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function readCurrentHead(cwd) {
  const result = spawnSync(command("git"), ["rev-parse", "--short", "HEAD"], {
    cwd,
    encoding: "utf8",
  });
  return result.status === 0 ? String(result.stdout || "").trim() : "";
}

export function parseLiveAuthSessionE2EArgs(argv = [], env = process.env) {
  const parsed = {
    baseUrl: env.STAGE4M_LIVE_AUTH_BASE_URL || DEFAULT_BASE_URL,
    credentialsFile: env.STAGE4M_AUTH_CREDENTIALS_FILE || DEFAULT_CREDENTIALS_FILE,
    deployStatusFile: env.STAGE4M_DEPLOY_STATUS_FILE || DEFAULT_DEPLOY_STATUS_FILE,
    ignoreDeployStatus: env.STAGE4M_IGNORE_DEPLOY_STATUS === "1",
    headed: false,
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
    } else if (arg === "--credentials-file") {
      if (!next) parsed.errors.push("--credentials-file requires a value");
      else {
        parsed.credentialsFile = next;
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
    } else if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else {
      parsed.errors.push(`Unknown argument: ${arg}`);
    }
  }

  if (!parsed.help) {
    if (!/^https?:\/\//i.test(parsed.baseUrl)) parsed.errors.push("--base-url must start with http:// or https://");
    if (!parsed.credentialsFile) parsed.errors.push("--credentials-file is required");
  }
  return parsed;
}

export function usage() {
  return [
    "Usage:",
    "  npm run e2e:auth-session:live -- \\",
    "    --base-url https://pro.skindoktor.ru \\",
    "    --credentials-file /root/dermatolog-pro-admin-credentials.txt",
    "",
    "This read-only test verifies login validation, invalid credentials, valid login,",
    "logout, protected-route redirect, expired-session recovery, and desktop/mobile UI gates.",
  ].join("\n");
}

export function runLiveAuthSessionE2E(
  argv = process.argv.slice(2),
  {
    spawn = spawnSync,
    cwd = process.cwd(),
    currentHead = () => readCurrentHead(cwd),
    hasPlaywright = () => existsSync(`${cwd}/node_modules/@playwright/test/index.js`),
  } = {},
) {
  const parsed = parseLiveAuthSessionE2EArgs(argv);
  if (parsed.help) {
    console.log(usage());
    return 0;
  }
  if (parsed.errors.length) {
    console.error(parsed.errors.join("\n"));
    console.error(usage());
    return 2;
  }
  if (!existsSync(parsed.credentialsFile)) {
    console.error(`Credentials file not found: ${parsed.credentialsFile}`);
    return 2;
  }
  const head = currentHead();
  if (!head && !parsed.ignoreDeployStatus) {
    console.error("Current Git HEAD is unavailable. Run the live gate from the deployed application repository.");
    return 2;
  }
  const deployBlocker = deployStatusBlocksLiveE2E({
    deployStatusFile: parsed.deployStatusFile,
    ignoreDeployStatus: parsed.ignoreDeployStatus,
    expectedHead: head,
  });
  if (deployBlocker) {
    console.error(deployBlocker);
    return 2;
  }
  if (!hasPlaywright()) {
    console.error("Local dependency @playwright/test is missing. Wait for update-production.sh to finish npm ci, or run npm ci before live browser smoke.");
    return 2;
  }

  const args = ["playwright", "test", "e2e/production-auth-session-live.pw.ts", "--project=chromium"];
  if (parsed.headed) args.push("--headed");
  const result = spawn(command("npx"), args, {
    cwd,
    env: {
      ...process.env,
      STAGE4M_LIVE_AUTH_BASE_URL: parsed.baseUrl.replace(/\/+$/, ""),
      STAGE4M_AUTH_CREDENTIALS_FILE: parsed.credentialsFile,
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
  process.exit(runLiveAuthSessionE2E());
}

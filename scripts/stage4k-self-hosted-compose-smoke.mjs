#!/usr/bin/env node
// Stage 4K · Full self-hosted docker-compose smoke.

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_COMPOSE_FILE = "deploy/self-hosted/docker-compose.stage4a.yml";
const DEFAULT_PROJECT_NAME = "dermatolog-pro-stage4k-smoke";
const DEFAULT_APP_PORT = "18080";
const DEFAULT_SUMMARY_PATH = "test-results/stage4k-compose-smoke-report.md";
const DEFAULT_EMAIL = "doctor.demo@example.invalid";
const DEFAULT_PASSWORD = "demo-password";
const SMOKE_BYTES = Buffer.from("stage4k-smoke-asset", "utf8");

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function dockerComposeArgs(composeFile, projectName, args) {
  return ["compose", "-f", composeFile, "-p", projectName, ...args];
}

function redact(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]")
    .replace(/demo-password/g, "[redacted-password]")
    .replace(/password=[^@\s]+/gi, "password=[redacted]");
}

export function parseStage4KArgs(argv = []) {
  const parsed = {
    dryRun: false,
    skipBuild: false,
    keepUpOnFail: false,
    appPort: DEFAULT_APP_PORT,
    composeFile: DEFAULT_COMPOSE_FILE,
    projectName: DEFAULT_PROJECT_NAME,
    summaryPath: DEFAULT_SUMMARY_PATH,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--skip-build") {
      parsed.skipBuild = true;
      continue;
    }
    if (arg === "--keep-up-on-fail") {
      parsed.keepUpOnFail = true;
      continue;
    }
    if (arg === "--app-port") {
      parsed.appPort = String(argv[++index] || "");
      continue;
    }
    if (arg.startsWith("--app-port=")) {
      parsed.appPort = arg.slice("--app-port=".length);
      continue;
    }
    if (arg === "--compose-file") {
      parsed.composeFile = String(argv[++index] || "");
      continue;
    }
    if (arg.startsWith("--compose-file=")) {
      parsed.composeFile = arg.slice("--compose-file=".length);
      continue;
    }
    if (arg === "--project-name") {
      parsed.projectName = String(argv[++index] || "");
      continue;
    }
    if (arg.startsWith("--project-name=")) {
      parsed.projectName = arg.slice("--project-name=".length);
      continue;
    }
    if (arg === "--summary") {
      parsed.summaryPath = String(argv[++index] || "");
      continue;
    }
    if (arg.startsWith("--summary=")) {
      parsed.summaryPath = arg.slice("--summary=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!/^\d{2,5}$/.test(parsed.appPort)) throw new Error("APP port must be numeric.");
  if (!parsed.composeFile) throw new Error("compose file is required.");
  if (!parsed.projectName) throw new Error("project name is required.");
  if (!parsed.summaryPath) throw new Error("summary path is required.");
  return parsed;
}

export function buildStage4KPlan(options = {}) {
  const config = { ...parseStage4KArgs([]), ...options };
  const steps = [];
  if (!config.skipBuild) steps.push([npmCmd(), ["run", "build"]]);
  steps.push(["docker", dockerComposeArgs(config.composeFile, config.projectName, ["up", "-d", "--build"])]);
  steps.push(["wait", [`http://127.0.0.1:${config.appPort}/healthz`]]);
  steps.push(["wait", [`http://127.0.0.1:${config.appPort}/readyz`]]);
  steps.push(["http", ["GET", "/api/v1/patients", "expect 401"]]);
  steps.push(["http", ["POST", "/api/v1/auth/login"]]);
  steps.push(["http", ["GET", "/api/v1/patients"]]);
  steps.push(["http", ["GET", "/api/v1/patients/{id}/visits"]]);
  steps.push(["http", ["POST", "/api/v1/visits/{id}/assets"]]);
  steps.push(["http", ["GET", "/api/v1/assets/{id}/download-url"]]);
  steps.push(["http", ["GET", "/api/v1/assets/{id}/download"]]);
  steps.push(["docker", dockerComposeArgs(config.composeFile, config.projectName, ["down", "-v"])]);
  return { config, steps };
}

export function renderStage4KDryRun(options = {}) {
  const { config, steps } = buildStage4KPlan(options);
  const lines = [
    "[stage4k-compose-smoke] dry run",
    "",
    `- Base URL: http://127.0.0.1:${config.appPort}`,
    `- Compose file: ${config.composeFile}`,
    `- Project: ${config.projectName}`,
    "",
  ];
  for (const [cmd, args] of steps) {
    lines.push(`$ ${cmd} ${args.join(" ")}`);
  }
  return lines.join("\n");
}

function runCommand(cmd, args, { env = process.env, spawn = spawnSync } = {}) {
  const result = spawn(cmd, args, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(redact(`${cmd} ${args.join(" ")} failed: ${result.stderr || result.stdout}`));
  }
  return result;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOk(url, { fetchImpl = fetch, timeoutMs = 120_000, intervalMs = 2_000 } = {}) {
  const started = Date.now();
  let lastError = "";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetchImpl(url);
      if (response.ok) return response;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error?.message || String(error);
    }
    await sleep(intervalMs);
  }
  throw new Error(`${url} did not become ready: ${redact(lastError)}`);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson(url, init = {}, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, init);
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`${init.method || "GET"} ${url} failed with HTTP ${response.status}`);
  }
  return body;
}

function authHeaders(token) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function findPatientVisit(baseUrl, token, patients, { fetchImpl = fetch } = {}) {
  const items = Array.isArray(patients?.items) ? patients.items : [];
  for (const patient of items) {
    const candidatePatientId = String(patient?.id || "");
    if (!candidatePatientId) continue;
    const visits = await requestJson(`${baseUrl}/api/v1/patients/${candidatePatientId}/visits`, {
      headers: authHeaders(token),
    }, { fetchImpl });
    const candidateVisitId = String(visits?.items?.[0]?.id || "");
    if (candidateVisitId) {
      return { patientId: candidatePatientId, visitId: candidateVisitId };
    }
  }
  throw new Error("No patient with a seeded visit was found.");
}

function writeSummary(path, summary) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, summary);
}

function renderSummary({ status, baseUrl, patientId, visitId, assetId, summaryPath }) {
  return [
    "## Stage 4K self-hosted compose smoke",
    "",
    `- Status: \`${status}\``,
    `- Base URL: \`${baseUrl}\``,
    `- Patient route: \`${patientId ? "verified" : "not reached"}\``,
    `- Visit route: \`${visitId ? "verified" : "not reached"}\``,
    `- Asset upload/download: \`${assetId ? "verified" : "not reached"}\``,
    `- Summary path: \`${summaryPath}\``,
    "",
    "No raw tokens, passwords, object keys, storage paths, or patient names are printed.",
    "",
  ].join("\n");
}

export async function runStage4KSmoke({
  options = parseStage4KArgs([]),
  spawn = spawnSync,
  fetchImpl = fetch,
} = {}) {
  const baseUrl = `http://127.0.0.1:${options.appPort}`;
  const env = {
    ...process.env,
    APP_PORT: options.appPort,
  };
  let status = "fail";
  let patientId = "";
  let visitId = "";
  let assetId = "";
  let shouldDown = true;

  try {
    if (!options.skipBuild) runCommand(npmCmd(), ["run", "build"], { env, spawn });
    runCommand("docker", dockerComposeArgs(options.composeFile, options.projectName, ["up", "-d", "--build"]), {
      env,
      spawn,
    });
    await waitForOk(`${baseUrl}/healthz`, { fetchImpl });
    await waitForOk(`${baseUrl}/readyz`, { fetchImpl });

    const unauth = await fetchImpl(`${baseUrl}/api/v1/patients`, {
      headers: { Accept: "application/json" },
    });
    if (unauth.status !== 401) {
      throw new Error(`GET /api/v1/patients without token returned ${unauth.status}, expected 401.`);
    }

    const login = await requestJson(
      `${baseUrl}/api/v1/auth/login`,
      {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: DEFAULT_EMAIL, password: DEFAULT_PASSWORD }),
      },
      { fetchImpl },
    );
    const token = String(login?.accessToken || "");
    if (!token) throw new Error("Login response did not include an access token.");

    const patients = await requestJson(`${baseUrl}/api/v1/patients?limit=5`, {
      headers: authHeaders(token),
    }, { fetchImpl });
    const selected = await findPatientVisit(baseUrl, token, patients, { fetchImpl });
    patientId = selected.patientId;
    visitId = selected.visitId;

    const upload = await requestJson(
      `${baseUrl}/api/v1/visits/${visitId}/assets`,
      {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "overview_photo",
          contentType: "image/png",
          byteSize: SMOKE_BYTES.byteLength,
          dataBase64: SMOKE_BYTES.toString("base64"),
          originalFileName: "stage4k-smoke.png",
        }),
      },
      { fetchImpl },
    );
    assetId = String(upload?.item?.id || "");
    if (!assetId) throw new Error("Asset upload response did not include an asset id.");

    const downloadUrl = await requestJson(`${baseUrl}/api/v1/assets/${assetId}/download-url`, {
      headers: authHeaders(token),
    }, { fetchImpl });
    const route = String(downloadUrl?.item?.downloadUrl || "");
    if (!route.startsWith("/api/v1/assets/") || route.includes("access_token") || route.includes("sig=")) {
      throw new Error("Download URL route is not backend-owned or contains unsafe query data.");
    }

    const download = await fetchImpl(`${baseUrl}${route}`, {
      headers: authHeaders(token),
    });
    if (!download.ok) throw new Error(`Asset download failed with HTTP ${download.status}.`);
    const downloaded = Buffer.from(await download.arrayBuffer());
    if (!downloaded.equals(SMOKE_BYTES)) throw new Error("Downloaded asset bytes do not match uploaded bytes.");

    status = "ok";
    return { ok: true, status, baseUrl, patientId, visitId, assetId };
  } catch (error) {
    shouldDown = !options.keepUpOnFail;
    return {
      ok: false,
      status,
      baseUrl,
      patientId,
      visitId,
      assetId,
      error: redact(error?.message || error),
    };
  } finally {
    if (shouldDown) {
      try {
        runCommand("docker", dockerComposeArgs(options.composeFile, options.projectName, ["down", "-v"]), {
          env,
          spawn,
        });
      } catch {
        // Best-effort cleanup; surface the primary smoke failure instead.
      }
    }
    writeSummary(
      options.summaryPath,
      renderSummary({ status, baseUrl, patientId, visitId, assetId, summaryPath: options.summaryPath }),
    );
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseStage4KArgs(argv);
  if (options.dryRun) {
    console.log(renderStage4KDryRun(options));
    return 0;
  }
  const result = await runStage4KSmoke({ options });
  if (!result.ok) {
    console.error(`[stage4k-compose-smoke] failed: ${result.error}`);
    return 1;
  }
  console.log(
    `[stage4k-compose-smoke] OK (${result.patientId ? "patients" : "no-patient"}, ${result.visitId ? "visits" : "no-visit"}, ${result.assetId ? "asset-binary" : "no-asset"})`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}

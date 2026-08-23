#!/usr/bin/env node
// Stage 4L Q2 · Disposable synthetic writer-fence/backup/restore gate.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdir as mkdirAsync, writeFile as writeFileAsync } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { reconcileClinicalAssets } from "./stage4l-backup-consistency.mjs";
import { runBackup, runRestore } from "./stage4l-self-hosted-ops.mjs";

const DEFAULT_GATE_ID = "skindoctor-q2-dry-run";
const DEFAULT_COMPOSE_FILE = "deploy/self-hosted/docker-compose.stage4a.yml";
const PRODUCTION_LIKE = /(prod(?:uction)?|live|server|91[.]107[.]120[.]59|20260819163303)/i;

function optionValue(argv, index, name) {
  const arg = argv[index];
  if (arg === name) return { value: argv[index + 1], consumed: 1 };
  if (arg.startsWith(`${name}=`)) return { value: arg.slice(name.length + 1), consumed: 0 };
  return null;
}

function parsePort(value, name) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`${name} must be an integer from 1024 to 65535.`);
  }
  return port;
}

export function parseStage4LQ2Args(argv = []) {
  const parsed = {
    dryRun: true,
    execute: false,
    gateId: DEFAULT_GATE_ID,
    composeFile: DEFAULT_COMPOSE_FILE,
    sourcePort: 19121,
    sourceMinioPort: 19122,
    restorePort: 19123,
    restoreMinioPort: 19124,
  };
  const definitions = [
    ["--gate-id", "gateId"],
    ["--compose-file", "composeFile"],
    ["--source-port", "sourcePort"],
    ["--source-minio-port", "sourceMinioPort"],
    ["--restore-port", "restorePort"],
    ["--restore-minio-port", "restoreMinioPort"],
  ];

  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dry-run") {
      if (parsed.execute) throw new Error("--dry-run and --execute are mutually exclusive.");
      parsed.dryRun = true;
      continue;
    }
    if (argv[index] === "--execute") {
      if (argv.includes("--dry-run")) throw new Error("--dry-run and --execute are mutually exclusive.");
      parsed.execute = true;
      parsed.dryRun = false;
      continue;
    }
    let matched = false;
    for (const [name, field] of definitions) {
      const found = optionValue(argv, index, name);
      if (!found) continue;
      parsed[field] = found.value;
      index += found.consumed;
      matched = true;
      break;
    }
    if (!matched) throw new Error(`Unknown Q2 argument: ${argv[index]}`);
  }

  parsed.gateId = String(parsed.gateId || "").trim().toLowerCase();
  if (!/^skindoctor-q2-[a-z0-9][a-z0-9-]{2,47}$/.test(parsed.gateId)) {
    throw new Error("Q2 gate id must use the skindoctor-q2- prefix and safe lowercase characters.");
  }
  if (PRODUCTION_LIKE.test(parsed.gateId)) {
    throw new Error("Q2 gate id contains a production-like target marker.");
  }
  parsed.composeFile = String(parsed.composeFile || "").trim();
  if (parsed.composeFile !== DEFAULT_COMPOSE_FILE) {
    throw new Error(`Q2 compose file must be exactly ${DEFAULT_COMPOSE_FILE}.`);
  }
  for (const field of ["sourcePort", "sourceMinioPort", "restorePort", "restoreMinioPort"]) {
    parsed[field] = parsePort(parsed[field], field);
  }
  const ports = new Set([
    parsed.sourcePort,
    parsed.sourceMinioPort,
    parsed.restorePort,
    parsed.restoreMinioPort,
  ]);
  if (ports.size !== 4) throw new Error("Q2 requires four unique ports.");
  return parsed;
}

export function buildStage4LQ2Plan(options = parseStage4LQ2Args([])) {
  const sourceProject = `${options.gateId}-source`;
  const restoreProject = `${options.gateId}-restore`;
  return {
    ...options,
    sourceProject,
    restoreProject,
    backupDir: `backups/self-hosted/${options.gateId}`,
    resultPath: `test-results/${options.gateId}-result.json`,
    phases: [
      "preflight exact disposable resource names and protected local inventory",
      "start source stack with synthetic seed data",
      "start concurrent synthetic upload writer",
      "quiesced backup and five-counter reconciliation",
      "prove rejected writes inside the fence and successful resume",
      "sealed restore and read-only application verification",
      "down --volumes --remove-orphans --rmi local for both exact projects",
      "prove zero containers, volumes, networks, backup files and protected-resource drift",
    ],
  };
}

export function validateDisposableInventory(plan, inventory = {}) {
  const prefixes = [plan.sourceProject, plan.restoreProject];
  const collisions = [];
  for (const container of inventory.containers || []) {
    const name = String(container?.name || "");
    const project = String(container?.project || "");
    if (prefixes.some((prefix) => name.startsWith(prefix) || project === prefix)) collisions.push(name || project);
  }
  for (const name of [
    ...(inventory.volumes || []),
    ...(inventory.networks || []),
    ...(inventory.images || []),
  ].map(String)) {
    if (prefixes.some((prefix) => name.startsWith(prefix))) collisions.push(name);
  }
  if (collisions.length > 0) {
    throw new Error(`Q2 disposable resource already exists: ${collisions.join(", ")}`);
  }
  return { ok: true };
}

export function renderStage4LQ2DryRun(plan) {
  return [
    "[stage4l-q2] disposable synthetic plan",
    "",
    `- Gate: ${plan.gateId}`,
    `- Source project: ${plan.sourceProject}`,
    `- Restore project: ${plan.restoreProject}`,
    `- Backup dir: ${plan.backupDir}`,
    `- Ports: ${plan.sourcePort}, ${plan.sourceMinioPort}, ${plan.restorePort}, ${plan.restoreMinioPort}`,
    "",
    "## Phases",
    ...plan.phases.map((phase) => `- ${phase}`),
    "",
    "Production names, credentials, paths, volumes, containers and servers are forbidden targets.",
  ].join("\n");
}

const PRODUCT_BASELINE_SHA = "59b49740feaea3667a75ca95b316965933152832";
const Q1_STAGE4L_SHAS = Object.freeze([
  "3b7e27da1cc9800ce84c6c5c5d299bcf001afbe4",
  "27c54157c87f815cd917ac63a380ea8a75c63695",
]);
const RESTORE_CONFIRMATION = "RESTORE_SELF_HOSTED_DATA";

export function acceptsStage4LQ1Baseline(isAncestor) {
  return Q1_STAGE4L_SHAS.some((sha) => isAncestor(sha));
}

function redact(value) {
  return String(value || "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]")
    .replace(/demo-password/g, "[redacted-password]")
    .replace(/(POSTGRES_PASSWORD|JWT_SECRET|DEVICE_BRIDGE_WORKER_TOKEN|MINIO_ROOT_PASSWORD)=([^\s]+)/g, "$1=[redacted]");
}

function runCommand(cmd, args, { env = process.env, encoding = "utf8", input, cwd = process.cwd() } = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    env,
    encoding,
    input,
    stdio: [input == null ? "ignore" : "pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : result.stderr;
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString("utf8") : result.stdout;
    throw new Error(redact(`${cmd} ${args.join(" ")} failed: ${stderr || stdout || `exit ${result.status}`}`));
  }
  return result.stdout;
}

function runCommandAllowFailure(cmd, args, options) {
  try {
    runCommand(cmd, args, options);
    return true;
  } catch {
    return false;
  }
}

function composeArgs(plan, project, args) {
  return ["compose", "-f", plan.composeFile, "-p", project, ...args];
}

function composeRun(plan, project, args, env) {
  return runCommand("docker", composeArgs(plan, project, args), { env });
}

function q2Environment(plan, target) {
  const source = target === "source";
  return {
    ...process.env,
    APP_PORT: String(source ? plan.sourcePort : plan.restorePort),
    MINIO_CONSOLE_PORT: String(source ? plan.sourceMinioPort : plan.restoreMinioPort),
    POSTGRES_PASSWORD: "skindoctor-q2-synthetic-postgres",
    JWT_SECRET: "skindoctor-q2-synthetic-jwt-secret-64-characters-minimum-value",
    DEVICE_BRIDGE_WORKER_TOKEN: "skindoctor-q2-synthetic-device-bridge-token-64-characters",
    MINIO_ROOT_USER: "skindoctor_q2_synthetic",
    MINIO_ROOT_PASSWORD: "skindoctor-q2-synthetic-minio-password",
    OBJECT_STORAGE_BUCKET: "clinical-assets",
  };
}

function parseLines(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function dockerInventory() {
  const containers = parseLines(runCommand("docker", [
    "ps", "-a", "--format", "{{.Names}}\t{{.Label \"com.docker.compose.project\"}}",
  ])).map((line) => {
    const [name, project = ""] = line.split("\t");
    return { name, project };
  });
  return {
    containers,
    volumes: parseLines(runCommand("docker", ["volume", "ls", "--format", "{{.Name}}"])),
    networks: parseLines(runCommand("docker", ["network", "ls", "--format", "{{.Name}}"])),
    images: parseLines(runCommand("docker", ["image", "ls", "--format", "{{.Repository}}"])),
  };
}

function protectedSnapshot(plan) {
  const inventory = dockerInventory();
  const q2Prefixes = [plan.sourceProject, plan.restoreProject];
  const containers = inventory.containers
    .filter(({ name, project }) => !q2Prefixes.some((prefix) => name.startsWith(prefix) || project === prefix))
    .map(({ name }) => {
      const raw = runCommand("docker", ["inspect", "--format", "{{.Id}}\t{{.State.Running}}\t{{.RestartCount}}", name]);
      const [id, running, restartCount] = String(raw).trim().split("\t");
      return { name, id, running: running === "true", restartCount: Number(restartCount) };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    containers,
    volumes: inventory.volumes.filter((name) => !q2Prefixes.some((prefix) => name.startsWith(prefix))).sort(),
    networks: inventory.networks.filter((name) => !q2Prefixes.some((prefix) => name.startsWith(prefix))).sort(),
  };
}

function assertProtectedSnapshotUnchanged(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("protected non-Q2 Docker resources changed during the disposable gate.");
  }
}

async function assertPortAvailable(port) {
  await new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error(`Q2 port ${port} is already in use.`)));
    server.listen(port, "127.0.0.1", () => server.close(resolvePromise));
  });
}

async function waitForHttp(url, { timeoutMs = 120_000, intervalMs = 500, fetchImpl = fetch } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetchImpl(url);
      lastStatus = response.status;
      if (response.ok) return;
    } catch {
      lastStatus = 0;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, intervalMs));
  }
  throw new Error(`${url} did not become ready; last HTTP status ${lastStatus}.`);
}

function waitForHttpSync(url, timeoutSeconds = 120) {
  const script = `i=0; while [ "$i" -lt ${timeoutSeconds} ]; do curl -fsS ${url} >/dev/null 2>&1 && exit 0; i=$((i+1)); sleep 1; done; exit 1`;
  runCommand("sh", ["-c", script]);
}

async function responseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson(url, init, fetchImpl) {
  const response = await fetchImpl(url, init);
  const body = await responseJson(response);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return body;
}

async function openSyntheticSession(baseUrl, fetchImpl = fetch) {
  const login = await requestJson(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email: "doctor.demo@example.invalid", password: "demo-password" }),
  }, fetchImpl);
  const token = String(login?.accessToken || "");
  if (!token) throw new Error("Q2 login did not return a token.");
  const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
  const patients = await requestJson(`${baseUrl}/api/v1/patients?limit=5`, { headers }, fetchImpl);
  for (const patient of patients?.items || []) {
    const patientId = String(patient?.id || "");
    if (!patientId) continue;
    const visits = await requestJson(`${baseUrl}/api/v1/patients/${patientId}/visits`, { headers }, fetchImpl);
    const visitId = String(visits?.items?.[0]?.id || "");
    if (visitId) return { token, headers, patientId, visitId };
  }
  throw new Error("Q2 did not find a synthetic patient with a seeded visit.");
}

async function createSyntheticAsset(baseUrl, label, fetchImpl = fetch) {
  const session = await openSyntheticSession(baseUrl, fetchImpl);
  const bytes = Buffer.from(`stage4l-q2-${label}`, "utf8");
  const body = await requestJson(`${baseUrl}/api/v1/visits/${session.visitId}/assets`, {
    method: "POST",
    headers: { ...session.headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "overview_photo",
      contentType: "image/png",
      byteSize: bytes.byteLength,
      dataBase64: bytes.toString("base64"),
      originalFileName: "stage4l-q2-seed.png",
    }),
  }, fetchImpl);
  const assetId = String(body?.item?.id || "");
  if (!assetId) throw new Error("Q2 synthetic seed upload did not return an asset id.");
  return { assetId, bytes };
}

export async function verifyRestoredApplication({ baseUrl, assetId, expectedSha256, fetchImpl = fetch } = {}) {
  await waitForHttp(`${baseUrl}/healthz`, { fetchImpl });
  await waitForHttp(`${baseUrl}/readyz`, { fetchImpl });
  const session = await openSyntheticSession(baseUrl, fetchImpl);
  const download = await requestJson(`${baseUrl}/api/v1/assets/${assetId}/download-url`, {
    headers: session.headers,
  }, fetchImpl);
  const route = String(download?.item?.downloadUrl || "");
  if (!route.startsWith("/api/v1/assets/") || route.includes("?") || route.includes("access_token")) {
    throw new Error("restored asset download route is unsafe.");
  }
  const response = await fetchImpl(`${baseUrl}${route}`, { headers: session.headers });
  if (!response.ok) throw new Error(`restored asset download failed with HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualSha256 = createHash("sha256").update(bytes).digest("hex");
  if (actualSha256 !== expectedSha256) throw new Error("restored asset checksum does not match the source seed.");
  return { ok: true, healthz: 200, readyz: 200, assetChecksumMatch: true };
}

async function persistWriterResult(resultPath, attempts) {
  const result = {
    schemaVersion: 1,
    type: "stage4l-q2-synthetic-writer",
    acceptedCount: attempts.filter((attempt) => attempt.accepted).length,
    rejectedCount: attempts.filter((attempt) => !attempt.accepted).length,
    attempts,
    privacy: "No token, password, patient name, object key, storage path, or payload bytes are recorded.",
  };
  await mkdirAsync(dirname(resultPath), { recursive: true });
  await writeFileAsync(resultPath, JSON.stringify(result, null, 2));
  return result;
}

export async function runSyntheticWriter({
  baseUrl,
  resultPath,
  maxAttempts = Number.POSITIVE_INFINITY,
  intervalMs = 100,
  requestTimeoutMs = 250,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  shouldStop = () => false,
} = {}) {
  const session = await openSyntheticSession(baseUrl, fetchImpl);

  const attempts = [];
  for (let index = 0; index < maxAttempts && !shouldStop(); index += 1) {
    const bytes = Buffer.from(`stage4l-q2-writer-${index}`, "utf8");
    const startedAt = now();
    let status = 0;
    let accepted = false;
    try {
      const response = await fetchImpl(`${baseUrl}/api/v1/visits/${session.visitId}/assets`, {
        method: "POST",
        headers: { ...session.headers, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(requestTimeoutMs),
        body: JSON.stringify({
          kind: "overview_photo",
          contentType: "image/png",
          byteSize: bytes.byteLength,
          dataBase64: bytes.toString("base64"),
          originalFileName: `stage4l-q2-${index}.png`,
        }),
      });
      status = response.status;
      const body = await responseJson(response);
      accepted = response.status === 201 && Boolean(body?.item?.id);
    } catch {
      status = 0;
    }
    attempts.push({ startedAt, finishedAt: now(), httpStatus: status, accepted });
    await persistWriterResult(resultPath, attempts);
    if (index + 1 < maxAttempts && !shouldStop()) await sleep(intervalMs);
  }
  return persistWriterResult(resultPath, attempts);
}

export function analyzeWriterFence(writerResult, { quiescedAt, resumedAt } = {}) {
  if (!quiescedAt || !resumedAt || Number.isNaN(Date.parse(quiescedAt)) || Number.isNaN(Date.parse(resumedAt))) {
    throw new Error("Q2 writer-fence analysis requires valid quiescedAt and resumedAt timestamps.");
  }
  if (Date.parse(quiescedAt) >= Date.parse(resumedAt)) {
    throw new Error("Q2 writer-fence timestamps are not ordered.");
  }
  const attempts = Array.isArray(writerResult?.attempts) ? writerResult.attempts : [];
  const acceptedBeforeFence = attempts.filter(
    (attempt) => attempt.accepted === true && Date.parse(attempt.finishedAt) <= Date.parse(quiescedAt),
  ).length;
  const rejectedInsideFence = attempts.filter(
    (attempt) => attempt.accepted === false
      && Date.parse(attempt.startedAt) >= Date.parse(quiescedAt)
      && Date.parse(attempt.finishedAt) <= Date.parse(resumedAt),
  ).length;
  const acceptedAfterFence = attempts.filter(
    (attempt) => attempt.accepted === true && Date.parse(attempt.startedAt) >= Date.parse(resumedAt),
  ).length;
  if (acceptedBeforeFence < 1 || rejectedInsideFence < 1 || acceptedAfterFence < 1) {
    throw new Error(
      "Q2 did not prove accepted-before, rejected-inside, and accepted-after writer-fence behavior "
      + `(observed ${acceptedBeforeFence}/${rejectedInsideFence}/${acceptedAfterFence}).`,
    );
  }
  return { acceptedBeforeFence, rejectedInsideFence, acceptedAfterFence };
}

function exactArtifactPath(path, root) {
  const absolute = resolve(path);
  const absoluteRoot = resolve(root);
  if (!absolute.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error(`Q2 artifact path must remain under ${root}.`);
  }
  return absolute;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error?.message || error}`);
  }
}

function composeServices(plan, project, env, status = "running") {
  return parseLines(composeRun(plan, project, ["ps", "--services", "--status", status], env));
}

function serviceExitCode(plan, project, service, env) {
  const containerId = String(composeRun(plan, project, ["ps", "-aq", service], env)).trim();
  if (!containerId) throw new Error(`Q2 could not resolve the ${service} container.`);
  return Number(String(runCommand("docker", ["inspect", "--format", "{{.State.ExitCode}}", containerId])).trim());
}

function createDisposableLifecycle(plan, env) {
  let capturedInventory;
  return {
    inventory() {
      const running = composeServices(plan, plan.sourceProject, env).sort();
      const expected = ["backend", "object-storage", "postgres", "reverse-proxy"].sort();
      if (JSON.stringify(running) !== JSON.stringify(expected)) {
        throw new Error(`Q2 source service inventory is incomplete: ${running.join(", ")}.`);
      }
      capturedInventory = {
        writers: [{ id: "backend", wasRunning: true }],
        unknownCount: 0,
        minio: { id: "object-storage", wasRunning: true },
      };
      return capturedInventory;
    },
    quiesce(inventory, { timeoutSeconds }) {
      if (inventory !== capturedInventory) throw new Error("Q2 lifecycle inventory identity changed.");
      composeRun(plan, plan.sourceProject, ["stop", "-t", String(timeoutSeconds), "backend"], env);
      if (composeServices(plan, plan.sourceProject, env).includes("backend")) {
        throw new Error("Q2 backend writer is still running after stop.");
      }
      const backendExitCode = serviceExitCode(plan, plan.sourceProject, "backend", env);
      if (backendExitCode !== 0) {
        throw new Error(`Q2 backend did not stop gracefully; exit code ${backendExitCode}.`);
      }
      const quiescedAt = new Date().toISOString();
      composeRun(plan, plan.sourceProject, ["stop", "-t", String(timeoutSeconds), "object-storage"], env);
      if (composeServices(plan, plan.sourceProject, env).includes("object-storage")) {
        throw new Error("Q2 object storage is still running after stop.");
      }
      return {
        quiescedAt,
        writers: [{ id: "backend", stopped: true }],
        unknownCount: 0,
        forcedTerminationCount: 0,
        minio: { id: "object-storage", wasRunning: true, stopped: true },
      };
    },
    resume({ inventory }) {
      const effectiveInventory = inventory || capturedInventory;
      if (!effectiveInventory) throw new Error("Q2 cannot resume without the source inventory.");
      if (effectiveInventory.minio?.wasRunning) {
        composeRun(plan, plan.sourceProject, ["start", "object-storage"], env);
      }
      const resumedAt = new Date().toISOString();
      if (effectiveInventory.writers?.some((writer) => writer.id === "backend" && writer.wasRunning)) {
        composeRun(plan, plan.sourceProject, ["start", "backend"], env);
      }
      waitForHttpSync(`http://127.0.0.1:${plan.sourcePort}/healthz`);
      waitForHttpSync(`http://127.0.0.1:${plan.sourcePort}/readyz`);
      return { ok: true, resumedAt };
    },
  };
}

function psql(plan, project, env, sql) {
  return composeRun(plan, project, [
    "exec", "-T", "postgres", "psql", "-U", "dermatolog", "-d", "dermatolog_pro",
    "-At", "-F", "\t", "-c", sql,
  ], env);
}

function queryClinicalAssets(plan, project, env) {
  const output = psql(plan, project, env, [
    "select object_bucket, object_key, coalesce(checksum_sha256, '-'),",
    "coalesce(byte_size::text, '-') from clinical_assets order by object_bucket, object_key;",
  ].join(" "));
  return String(output || "").split(/\r?\n/).filter(Boolean).map((line) => {
    const [objectBucket, objectKey, checksumSha256, byteSize] = line.split("\t");
    if (!objectBucket || !objectKey || checksumSha256 == null || byteSize == null) {
      throw new Error("Q2 database asset inventory returned a malformed row.");
    }
    return {
      objectBucket,
      objectKey,
      checksumSha256: checksumSha256 === "-" ? null : checksumSha256,
      byteSize: byteSize === "-" ? null : Number(byteSize),
    };
  });
}

function scanBackendObjectFiles(plan, env) {
  const script = [
    "find /data -type f -print | sort | while IFS= read -r path; do",
    "rel=${path#/data/}; kind=payload; key=$rel;",
    "case \"$rel\" in *.metadata.json) kind=sidecar; key=${rel%.metadata.json};; esac;",
    "bucket=${key%%/*}; object_key=${key#*/}; checksum=-; size=-;",
    "if [ \"$kind\" = payload ]; then checksum=$(sha256sum \"$path\" | awk '{print $1}'); size=$(wc -c < \"$path\" | tr -d ' '); fi;",
    "printf '%s\\t%s\\t%s\\t%s\\t%s\\n' \"$kind\" \"$bucket\" \"$object_key\" \"$checksum\" \"$size\";",
    "done",
  ].join(" ");
  const output = runCommand("docker", [
    "run", "--rm", "-v", `${plan.sourceProject}_backend-object-storage:/data:ro`,
    "alpine:3.20", "sh", "-c", script,
  ], { env });
  return String(output || "").split(/\r?\n/).filter(Boolean).map((line) => {
    const [kind, objectBucket, objectKey, checksumSha256, byteSize] = line.split("\t");
    if (!kind || !objectBucket || !objectKey || checksumSha256 == null || byteSize == null) {
      throw new Error("Q2 backend object inventory returned a malformed row.");
    }
    return {
      kind,
      objectBucket,
      objectKey,
      checksumSha256: checksumSha256 === "-" ? null : checksumSha256,
      byteSize: byteSize === "-" ? null : Number(byteSize),
    };
  });
}

function createDisposableReconciler(plan, env) {
  let capturedAssetCount = null;
  return {
    reconcile() {
      const assets = queryClinicalAssets(plan, plan.sourceProject, env);
      const files = scanBackendObjectFiles(plan, env);
      capturedAssetCount = assets.length;
      return reconcileClinicalAssets({ assets, files });
    },
    capturedAssetCount() {
      if (!Number.isInteger(capturedAssetCount)) throw new Error("Q2 reconciliation did not capture an asset count.");
      return capturedAssetCount;
    },
  };
}

function queryAssetCount(plan, project, env) {
  const value = Number(String(psql(plan, project, env, "select count(*) from clinical_assets;")).trim());
  if (!Number.isInteger(value) || value < 0) throw new Error("Q2 database returned an invalid asset count.");
  return value;
}

function queryFenceWriteCount(plan, env, quiescedAt, resumedAt) {
  if (Number.isNaN(Date.parse(quiescedAt)) || Number.isNaN(Date.parse(resumedAt))) {
    throw new Error("Q2 fence-write query requires valid timestamps.");
  }
  const sql = [
    "select count(*) from clinical_assets",
    `where created_at >= '${quiescedAt}'::timestamptz`,
    `and created_at < '${resumedAt}'::timestamptz;`,
  ].join(" ");
  const value = Number(String(psql(plan, plan.sourceProject, env, sql)).trim());
  if (!Number.isInteger(value) || value < 0) throw new Error("Q2 fence-write query returned an invalid count.");
  return value;
}

function spawnWithEnvironment(env) {
  return (cmd, args, options = {}) => spawnSync(cmd, args, { ...options, env });
}

async function waitForWriterResult(path, child, predicate, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(path)) {
      try {
        const result = readJson(path, "Q2 writer result");
        if (predicate(result)) return result;
      } catch {
        // The writer replaces a small JSON file; retry if read races with a write.
      }
    }
    if (child.exitCode != null) throw new Error(`Q2 writer exited early with code ${child.exitCode}.`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error("Q2 writer did not produce the required evidence before timeout.");
}

async function stopChild(child) {
  if (!child || child.exitCode != null) return;
  child.kill("SIGTERM");
  await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error("Q2 writer did not stop after SIGTERM.")), 10_000);
    child.once("close", () => {
      clearTimeout(timeout);
      resolvePromise();
    });
  });
}

function assertGitBaseline() {
  const accepted = acceptsStage4LQ1Baseline((sha) => (
    runCommandAllowFailure("git", ["merge-base", "--is-ancestor", sha, "HEAD"])
  ));
  if (!accepted) {
    throw new Error("Q2 live execution requires an audited Stage 4L Q1 baseline.");
  }
  const status = String(runCommand("git", ["status", "--porcelain"])).trim();
  if (status) throw new Error("Q2 live execution requires a clean worktree.");
  const head = String(runCommand("git", ["rev-parse", "HEAD"])).trim();
  if (!/^[a-f0-9]{40}$/.test(head)) throw new Error("Q2 could not resolve the exact Stage 4L Git SHA.");
  return head;
}

function createExactRestoreVolumes(plan) {
  for (const suffix of ["postgres-data", "backend-object-storage", "object-storage-data"]) {
    runCommand("docker", [
      "volume", "create", "--label", `skindoctor.q2.gate=${plan.gateId}`,
      `${plan.restoreProject}_${suffix}`,
    ]);
  }
}

function cleanupExactProject(plan, project, env, errors) {
  if (!runCommandAllowFailure("docker", composeArgs(plan, project, [
    "down", "--volumes", "--remove-orphans", "--rmi", "local",
  ]), { env })) {
    errors.push(`${project} compose cleanup failed`);
  }
  const inventory = dockerInventory();
  for (const { name, project: composeProject } of inventory.containers) {
    if ((name.startsWith(project) || composeProject === project)
      && !runCommandAllowFailure("docker", ["rm", "-f", name])) {
      errors.push(`${project} container cleanup failed`);
    }
  }
  for (const name of inventory.volumes.filter((value) => value.startsWith(project))) {
    if (!runCommandAllowFailure("docker", ["volume", "rm", "-f", name])) {
      errors.push(`${project} volume cleanup failed`);
    }
  }
  for (const name of inventory.networks.filter((value) => value.startsWith(project))) {
    if (!runCommandAllowFailure("docker", ["network", "rm", name])) {
      errors.push(`${project} network cleanup failed`);
    }
  }
  for (const name of inventory.images.filter((value) => value.startsWith(project))) {
    if (!runCommandAllowFailure("docker", ["image", "rm", "-f", name])) {
      errors.push(`${project} image cleanup failed`);
    }
  }
}

function parseChildOptions(argv, names) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!names.includes(name) || !argv[index + 1]) throw new Error(`Unknown or incomplete Q2 child argument: ${name}`);
    result[name.slice(2)] = argv[++index];
  }
  for (const name of names) {
    if (!result[name.slice(2)]) throw new Error(`Q2 child argument ${name} is required.`);
  }
  return result;
}

function validateChildBaseUrl(value) {
  if (!/^http:\/\/127[.]0[.]0[.]1:\d{4,5}$/.test(value)) {
    throw new Error("Q2 child base URL must use an explicit loopback port.");
  }
  return value;
}

async function writerMain(argv) {
  const options = parseChildOptions(argv, ["--base-url", "--result"]);
  const resultPath = exactArtifactPath(options.result, "test-results");
  let stopped = false;
  process.on("SIGTERM", () => { stopped = true; });
  await runSyntheticWriter({
    baseUrl: validateChildBaseUrl(options["base-url"]),
    resultPath,
    shouldStop: () => stopped,
  });
  return 0;
}

async function verifierMain(argv) {
  const options = parseChildOptions(argv, ["--base-url", "--asset-id", "--expected-sha", "--result"]);
  if (!/^[a-f0-9-]{36}$/i.test(options["asset-id"])) throw new Error("Q2 verifier asset id is invalid.");
  if (!/^[a-f0-9]{64}$/.test(options["expected-sha"])) throw new Error("Q2 verifier checksum is invalid.");
  const resultPath = exactArtifactPath(options.result, "test-results");
  const result = await verifyRestoredApplication({
    baseUrl: validateChildBaseUrl(options["base-url"]),
    assetId: options["asset-id"],
    expectedSha256: options["expected-sha"],
  });
  mkdirSync(dirname(resultPath), { recursive: true });
  writeFileSync(resultPath, JSON.stringify(result, null, 2));
  return 0;
}

export async function runStage4LQ2(plan) {
  const sourceEnv = q2Environment(plan, "source");
  const restoreEnv = q2Environment(plan, "restore");
  const sourceBaseUrl = `http://127.0.0.1:${plan.sourcePort}`;
  const restoreBaseUrl = `http://127.0.0.1:${plan.restorePort}`;
  const modulePath = fileURLToPath(import.meta.url);
  const writerPath = exactArtifactPath(`test-results/${plan.gateId}-writer.json`, "test-results");
  const verifierPath = exactArtifactPath(`test-results/${plan.gateId}-verifier.json`, "test-results");
  const resultPath = exactArtifactPath(plan.resultPath, "test-results");
  const backupPath = exactArtifactPath(plan.backupDir, "backups/self-hosted");
  let writer;
  let protectedBefore;
  let ownsDisposableNames = false;
  let result = {
    schemaVersion: 1,
    type: "stage4l-q2-disposable-gate",
    gateId: plan.gateId,
    status: "failed",
    privacy: "Synthetic-only counts and checksums; no token, password, patient name, object key, storage path, or payload bytes.",
  };
  let gateError;

  try {
    validateDisposableInventory(plan, dockerInventory());
    ownsDisposableNames = true;
    protectedBefore = protectedSnapshot(plan);
    await Promise.all([
      assertPortAvailable(plan.sourcePort),
      assertPortAvailable(plan.sourceMinioPort),
      assertPortAvailable(plan.restorePort),
      assertPortAvailable(plan.restoreMinioPort),
    ]);
    const stage4lGitSha = assertGitBaseline();
    runCommand("npm", ["run", "build"]);
    composeRun(plan, plan.sourceProject, ["up", "-d", "--build"], sourceEnv);
    await waitForHttp(`${sourceBaseUrl}/healthz`);
    await waitForHttp(`${sourceBaseUrl}/readyz`);

    const seed = await createSyntheticAsset(sourceBaseUrl, "seed");
    const seedSha256 = createHash("sha256").update(seed.bytes).digest("hex");
    rmSync(writerPath, { force: true });
    writer = spawn(process.execPath, [modulePath, "writer", "--base-url", sourceBaseUrl, "--result", writerPath], {
      cwd: process.cwd(),
      stdio: ["ignore", "ignore", "ignore"],
    });
    await waitForWriterResult(writerPath, writer, (value) => value.acceptedCount >= 2);

    const reconciler = createDisposableReconciler(plan, sourceEnv);
    const backup = runBackup({
      command: "backup",
      backupDir: plan.backupDir,
      backupSetId: plan.gateId,
      projectName: plan.sourceProject,
      composeFile: plan.composeFile,
      composeFiles: [plan.composeFile],
      productGitSha: PRODUCT_BASELINE_SHA,
      stage4lGitSha,
      quiescenceTimeoutSeconds: 30,
    }, {
      lifecycle: createDisposableLifecycle(plan, sourceEnv),
      reconcile: () => reconciler.reconcile(),
      spawn: spawnWithEnvironment(sourceEnv),
    });
    const manifest = readJson(backup.plan.files.manifest, "Q2 backup manifest");
    const completion = readJson(backup.plan.files.completionReceipt, "Q2 completion receipt");
    const writerResult = await waitForWriterResult(
      writerPath,
      writer,
      (value) => value.attempts?.some(
        (attempt) => attempt.accepted === true && Date.parse(attempt.startedAt) >= Date.parse(completion.resumedAt),
      ),
    );
    await stopChild(writer);
    writer = null;
    const writerFence = analyzeWriterFence(writerResult, {
      quiescedAt: manifest.quiescedAt,
      resumedAt: completion.resumedAt,
    });
    const writesInsideFence = queryFenceWriteCount(plan, sourceEnv, manifest.quiescedAt, completion.resumedAt);
    if (writesInsideFence !== 0) throw new Error("Q2 database accepted a clinical asset inside the writer fence.");

    createExactRestoreVolumes(plan);
    rmSync(verifierPath, { force: true });
    const restore = runRestore({
      command: "restore",
      backupDir: plan.backupDir,
      confirm: RESTORE_CONFIRMATION,
      projectName: plan.restoreProject,
      composeFile: plan.composeFile,
      composeFiles: [plan.composeFile],
    }, {
      spawn: spawnWithEnvironment(restoreEnv),
      verifyRestoredApp: () => {
        waitForHttpSync(`${restoreBaseUrl}/healthz`);
        waitForHttpSync(`${restoreBaseUrl}/readyz`);
        runCommand(process.execPath, [
          modulePath, "verify", "--base-url", restoreBaseUrl,
          "--asset-id", seed.assetId, "--expected-sha", seedSha256,
          "--result", verifierPath,
        ], { env: restoreEnv });
        return readJson(verifierPath, "Q2 restored-application verification");
      },
    });
    const sourceAssetCountAtCapture = reconciler.capturedAssetCount();
    const restoredAssetCount = queryAssetCount(plan, plan.restoreProject, restoreEnv);
    if (sourceAssetCountAtCapture !== restoredAssetCount) {
      throw new Error("Q2 restored database asset count does not match the reconciled capture.");
    }
    result = {
      ...result,
      status: "passed_pending_cleanup",
      stage4lGitSha,
      productBaselineSha: PRODUCT_BASELINE_SHA,
      backup: {
        classification: restore.backupSet.classification,
        sealedState: restore.backupSet.receipt.state,
        reconciliation: backup.reconciliation,
      },
      writerFence: { ...writerFence, writesInsideFence },
      restoredApplication: restore.restoredApplication,
      counts: { sourceAssetCountAtCapture, restoredAssetCount },
    };
  } catch (error) {
    gateError = error;
    result.error = redact(error?.message || error);
  } finally {
    const cleanupErrors = [];
    try {
      await stopChild(writer);
    } catch (error) {
      cleanupErrors.push(redact(error?.message || error));
    }
    if (ownsDisposableNames) {
      cleanupExactProject(plan, plan.restoreProject, restoreEnv, cleanupErrors);
      cleanupExactProject(plan, plan.sourceProject, sourceEnv, cleanupErrors);
      rmSync(writerPath, { force: true });
      rmSync(verifierPath, { force: true });
      rmSync(backupPath, { recursive: true, force: true });
      try {
        validateDisposableInventory(plan, dockerInventory());
        if (existsSync(backupPath)) throw new Error("Q2 backup directory remains after cleanup.");
        if (protectedBefore) assertProtectedSnapshotUnchanged(protectedBefore, protectedSnapshot(plan));
      } catch (error) {
        cleanupErrors.push(redact(error?.message || error));
      }
    }
    if (cleanupErrors.length > 0) {
      gateError ||= new Error(`Q2 cleanup proof failed: ${cleanupErrors.join("; ")}`);
      result.cleanup = { ok: false, errors: cleanupErrors };
    } else {
      result.cleanup = { ok: true, disposableDockerResidueCount: 0, backupDirectoryPresent: false };
    }
    if (!gateError && result.status === "passed_pending_cleanup") result.status = "passed";
    else if (gateError) result.status = "failed";
    mkdirSync(dirname(resultPath), { recursive: true });
    writeFileSync(resultPath, JSON.stringify(result, null, 2));
  }
  if (gateError) throw gateError;
  return result;
}

export async function main(argv = process.argv.slice(2)) {
  try {
    if (argv[0] === "writer") return writerMain(argv.slice(1));
    if (argv[0] === "verify") return verifierMain(argv.slice(1));
    const options = parseStage4LQ2Args(argv);
    const plan = buildStage4LQ2Plan(options);
    if (options.dryRun) {
      console.log(renderStage4LQ2DryRun(plan));
      return 0;
    }
    if (!options.execute || options.gateId === DEFAULT_GATE_ID) {
      throw new Error("Q2 live execution requires --execute and an explicit non-default --gate-id.");
    }
    const result = await runStage4LQ2(plan);
    console.log(`[stage4l-q2] ${result.status}: ${result.gateId}`);
    return 0;
  } catch (error) {
    console.error(`[stage4l-q2] failed: ${error?.message || error}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}

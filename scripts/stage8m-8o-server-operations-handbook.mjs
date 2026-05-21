#!/usr/bin/env node
// Stage 8M-8O · server operations handbook renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/operations-handbook.stage8m-8o.json";

function readManifest(root = REPO_ROOT, manifestPath = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
}

function ensureNoLeaks(value) {
  const text = JSON.stringify(value);
  const forbidden = [
    /api-read/i,
    /api-write/i,
    /edge function/i,
    /SUPABASE_/i,
    /access_token/i,
    /signed_url/i,
    /storage_object_path/i,
    /payload_json/i,
    /result_json/i,
    /patient_full_name/i,
    /navigator\.(usb|bluetooth|serial)/i,
  ];
  return forbidden
    .filter((pattern) => pattern.test(text))
    .map((pattern) => String(pattern));
}

function commandList(items = []) {
  return items.map((item) => (typeof item === "string" ? item : item.command));
}

export function buildServerOperationsHandbook({ manifest = readManifest() } = {}) {
  const sections = manifest.serverOperationsHandbook.sections.map((section) => ({
    id: section.id,
    title: section.title,
    checks: [...section.checks],
  }));
  const gates = manifest.verificationGates.map((gate) => ({
    id: gate.id,
    command: gate.command,
    required: Boolean(gate.required),
  }));
  const leakFindings = ensureNoLeaks(manifest);
  const requiredGateCount = gates.filter((gate) => gate.required).length;
  const safeBoundary =
    manifest.productBoundary.managedRuntimeDependency === "none" &&
    manifest.productBoundary.managedDatabaseDependency === "none" &&
    manifest.productBoundary.browserHardwareApis === false &&
    manifest.productBoundary.externalRuntimeCalls === false &&
    manifest.productBoundary.workerPayloadVisibility === "backend-only";

  return {
    stage: manifest.stage,
    packageId: manifest.packageId,
    title: manifest.title,
    purpose: manifest.purpose,
    includedStages: manifest.includedStages.map((stage) => stage.id),
    sectionCount: sections.length,
    sections,
    gates,
    requiredGateCount,
    requiredCommands: commandList(gates),
    productBoundary: manifest.productBoundary,
    expectedLovableConfirmation: manifest.lovableSyncVerification.expectedConfirmation,
    requiredLovableFiles: manifest.lovableSyncVerification.requiredFiles,
    requiredLovableCommands: manifest.lovableSyncVerification.requiredCommands,
    nextStageHypothesis: manifest.nextStageHypothesis,
    leakFindings,
    status: safeBoundary && leakFindings.length === 0 && requiredGateCount === gates.length ? "ready" : "blocked",
  };
}

export function buildStage8J8OLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 8J-8O из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.lovableSyncVerification.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.lovableSyncVerification.requiredCommands.map((command) => `- ${command}`),
    "",
    "Проверь, что Device Bridge production readiness и server operations handbook не содержат managed runtime/database dependency, Supabase coupling, browser hardware API coupling, signed URLs, storage paths, raw worker payloads, raw patient names или tokens.",
    "Project-memory должен фиксировать Stage 8J-8O как confirmed и Stage 8P-8R как hypothesis.",
    "package-lock.json не должен измениться; deno.lock должен отсутствовать.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableSyncVerification.expectedConfirmation}`,
  ].join("\n");
}

export function renderServerOperationsHandbookMarkdown({
  handbook = buildServerOperationsHandbook(),
  lovablePrompt = buildStage8J8OLovablePrompt(),
} = {}) {
  const lines = [
    `# ${handbook.title}`,
    "",
    `- Stage: \`${handbook.stage}\``,
    `- Package: \`${handbook.packageId}\``,
    `- Included stages: ${handbook.includedStages.join(", ")}`,
    `- Status: \`${handbook.status}\``,
    `- Required gates: ${handbook.requiredGateCount}`,
    `- Next stage hypothesis: ${handbook.nextStageHypothesis}`,
    "",
    "## Purpose",
    "",
    handbook.purpose,
    "",
    "## Operations Sections",
    "",
  ];

  for (const section of handbook.sections) {
    lines.push(`### ${section.title}`, "");
    for (const check of section.checks) lines.push(`- ${check}`);
    lines.push("");
  }

  lines.push("## Verification Gates", "");
  for (const gate of handbook.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Managed runtime/database dependency: ${handbook.productBoundary.managedRuntimeDependency}/${handbook.productBoundary.managedDatabaseDependency}`,
    `- Database: ${handbook.productBoundary.database}`,
    `- Object storage: ${handbook.productBoundary.objectStorage}`,
    `- Browser hardware APIs: ${handbook.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${handbook.productBoundary.externalRuntimeCalls}`,
    `- Worker payload visibility: ${handbook.productBoundary.workerPayloadVisibility}`,
    `- Raw patient data in reports: ${handbook.productBoundary.rawPatientDataInReports}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${handbook.leakFindings.length}`,
    "- The handbook is repository-bundled metadata only; live secrets and raw runtime payloads stay outside Git.",
    "",
    "## Post-Merge Lovable Prompt",
    "",
    "```text",
    lovablePrompt,
    "```",
    "",
  );

  return lines.join("\n");
}

export function runStage8M8OServerOperationsHandbook({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const handbook = buildServerOperationsHandbook({ manifest });
  const lovablePrompt = buildStage8J8OLovablePrompt({ manifest });
  const markdown = renderServerOperationsHandbookMarkdown({ handbook, lovablePrompt });
  if (summaryPath) {
    mkdirSync(dirname(join(root, summaryPath)), { recursive: true });
    writeFileSync(join(root, summaryPath), markdown);
  }
  if (jsonPath) {
    mkdirSync(dirname(join(root, jsonPath)), { recursive: true });
    writeFileSync(join(root, jsonPath), `${JSON.stringify(handbook, null, 2)}\n`);
  }
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: handbook.status === "ready", handbook, lovablePrompt, markdown };
}

function parseArgs(argv = []) {
  const parsed = { dryRun: false, manifestPath: DEFAULT_MANIFEST_PATH, summaryPath: null, jsonPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--manifest") {
      parsed.manifestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--summary") {
      parsed.summaryPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--json-out") {
      parsed.jsonPath = argv[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

export function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);
  const result = runStage8M8OServerOperationsHandbook(parsed);
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

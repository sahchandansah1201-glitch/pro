#!/usr/bin/env node
// Stage 11A-11Z · Development quality ledger renderer.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_MANIFEST_PATH = "deploy/self-hosted/development-quality-ledger.stage11a-11z.json";

const FORBIDDEN = [
  /api-read/i,
  /api-write/i,
  /edge function/i,
  /SUPABASE_/i,
  /access_token/i,
  /signed_url/i,
  /storage_object_path/i,
  /payload_json/i,
  /result_json/i,
  /worker_metadata_json/i,
  /patient_full_name/i,
  /navigator\.(usb|bluetooth|serial)/i,
];

function readManifest(root = REPO_ROOT, manifestPath = DEFAULT_MANIFEST_PATH) {
  return JSON.parse(readFileSync(join(root, manifestPath), "utf8"));
}

function outputPath(root, target) {
  return isAbsolute(target) ? target : join(root, target);
}

function commandList(items = []) {
  return items.map((item) => (typeof item === "string" ? item : item.command));
}

function ensureNoLeaks(value) {
  const text = JSON.stringify(value);
  return FORBIDDEN.filter((pattern) => pattern.test(text)).map((pattern) => String(pattern));
}

function severityCounts(rules = []) {
  return rules.reduce((acc, rule) => {
    acc[rule.severity] = (acc[rule.severity] || 0) + 1;
    return acc;
  }, {});
}

export function buildStage11A11ZDevelopmentQualityLedger({ manifest = readManifest() } = {}) {
  const stages = manifest.includedStages.map((stage) => ({
    id: stage.id,
    title: stage.title,
    status: stage.status,
  }));
  const gates = manifest.verificationGates.map((gate) => ({
    id: gate.id,
    command: gate.command,
    required: Boolean(gate.required),
  }));
  const leakFindings = ensureNoLeaks(manifest);
  const requiredGateCount = gates.filter((gate) => gate.required).length;
  const scaleReady =
    manifest.batchScale.previousIncludedStages === 26 &&
    manifest.batchScale.currentIncludedStages === 26 &&
    stages.length === 26;
  const boundaryReady =
    manifest.productBoundary.runtimeBehaviorChanged === false &&
    manifest.productBoundary.managedRuntimeDependency === "none" &&
    manifest.productBoundary.managedDatabaseDependency === "none" &&
    manifest.productBoundary.browserHardwareApis === false &&
    manifest.productBoundary.externalRuntimeCalls === false;
  const ledgerReady =
    manifest.ledgerSections.length >= 4 &&
    manifest.ledgerSections.every((section) => section.requiredEvidence.length >= 5);
  const rulesReady =
    manifest.qualityRules.length >= 7 &&
    manifest.qualityRules.some((rule) => rule.id === "defect_requires_prevention") &&
    manifest.qualityRules.some((rule) => rule.id === "merge_before_lovable");
  const gatesReady = requiredGateCount === gates.length && requiredGateCount >= 10;
  const status =
    scaleReady && boundaryReady && ledgerReady && rulesReady && gatesReady && leakFindings.length === 0
      ? "ready"
      : "blocked";

  return {
    stage: manifest.stage,
    packageId: manifest.packageId,
    title: manifest.title,
    purpose: manifest.purpose,
    previousBatch: manifest.previousBatch,
    previousBatchCommit: manifest.previousBatchCommit,
    nextBatchHypothesis: manifest.nextBatchHypothesis,
    batchScale: manifest.batchScale,
    includedStages: stages.map((stage) => stage.id),
    stages,
    ledgerSections: manifest.ledgerSections,
    ledgerSectionCount: manifest.ledgerSections.length,
    qualityRules: manifest.qualityRules,
    qualityRuleCount: manifest.qualityRules.length,
    qualityRuleSeverityCounts: severityCounts(manifest.qualityRules),
    knownPreventionSources: manifest.knownPreventionSources,
    requiredFiles: manifest.requiredFiles,
    gates,
    requiredGateCount,
    requiredCommands: commandList(gates),
    productBoundary: manifest.productBoundary,
    expectedLovableConfirmation: manifest.lovableHandoff.expectedConfirmation,
    promptAllowedOnlyAfterMerge: manifest.lovableHandoff.promptAllowedOnlyAfterMerge,
    leakFindings,
    status,
  };
}

export function buildStage11A11ZLovablePrompt({ manifest = readManifest() } = {}) {
  return [
    "Проверь синхронизацию Stage 11A-11Z из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...manifest.requiredFiles.map((file, index) => `${index + 1}. ${file}`),
    "",
    "Команды должны проходить:",
    ...manifest.verificationGates.map((gate) => `- ${gate.command}`),
    "",
    "Проверь, что Stage 11A-11Z фиксирует development quality ledger на 26 stages после Stage 10A-10Z.",
    "Проверь, что ledger содержит batch intake, diagnostics, verification и handoff evidence sections.",
    "Проверь, что quality rules включают defect_requires_prevention, preflight_all_alignment и merge_before_lovable.",
    "Проверь, что package-lock.json не изменён и deno.lock отсутствует.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableHandoff.expectedConfirmation}`,
  ].join("\n");
}

export function renderStage11A11ZDevelopmentQualityLedgerMarkdown({
  ledger = buildStage11A11ZDevelopmentQualityLedger(),
  lovablePrompt = buildStage11A11ZLovablePrompt(),
} = {}) {
  const lines = [
    `# ${ledger.title}`,
    "",
    `- Stage: \`${ledger.stage}\``,
    `- Package: \`${ledger.packageId}\``,
    `- Status: \`${ledger.status}\``,
    `- Previous batch: ${ledger.previousBatch} (${ledger.previousBatchCommit})`,
    `- Next batch hypothesis: ${ledger.nextBatchHypothesis}`,
    `- Included stages: ${ledger.includedStages.length}`,
    `- Minimum related stages per batch: ${ledger.batchScale.minimumRelatedStagesPerBatch}`,
    `- Ledger sections: ${ledger.ledgerSectionCount}`,
    `- Quality rules: ${ledger.qualityRuleCount}`,
    "",
    "## Purpose",
    "",
    ledger.purpose,
    "",
    "## Stage Map",
    "",
  ];

  for (const stage of ledger.stages) {
    lines.push(`- ${stage.id}: ${stage.title} (${stage.status})`);
  }

  lines.push("", "## Ledger Sections", "");
  for (const section of ledger.ledgerSections) {
    lines.push(`- \`${section.id}\`: ${section.title}`);
    for (const evidence of section.requiredEvidence) lines.push(`  - ${evidence}`);
  }

  lines.push("", "## Quality Rules", "");
  for (const rule of ledger.qualityRules) {
    lines.push(`- ${rule.severity} \`${rule.id}\`: ${rule.rule}`);
  }

  lines.push("", "## Verification Gates", "");
  for (const gate of ledger.gates) {
    lines.push(`- ${gate.required ? "required" : "optional"} \`${gate.id}\`: \`${gate.command}\``);
  }

  lines.push(
    "",
    "## Product Boundary",
    "",
    `- Runtime behavior changed: ${ledger.productBoundary.runtimeBehaviorChanged}`,
    `- Managed runtime/database dependency: ${ledger.productBoundary.managedRuntimeDependency}/${ledger.productBoundary.managedDatabaseDependency}`,
    `- Browser hardware APIs: ${ledger.productBoundary.browserHardwareApis}`,
    `- External runtime calls: ${ledger.productBoundary.externalRuntimeCalls}`,
    `- Data visibility: ${ledger.productBoundary.dataVisibility}`,
    "",
    "## Privacy",
    "",
    `- Leak findings: ${ledger.leakFindings.length}`,
    "- The ledger stores repository quality metadata only.",
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

export function runStage11A11ZDevelopmentQualityLedger({
  root = REPO_ROOT,
  manifestPath = DEFAULT_MANIFEST_PATH,
  dryRun = false,
  summaryPath = null,
  jsonPath = null,
} = {}) {
  const manifest = readManifest(root, manifestPath);
  const ledger = buildStage11A11ZDevelopmentQualityLedger({ manifest });
  const lovablePrompt = buildStage11A11ZLovablePrompt({ manifest });
  const markdown = renderStage11A11ZDevelopmentQualityLedgerMarkdown({ ledger, lovablePrompt });
  if (summaryPath) {
    const path = outputPath(root, summaryPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown);
  }
  if (jsonPath) {
    const path = outputPath(root, jsonPath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(ledger, null, 2)}\n`);
  }
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: ledger.status === "ready", ledger, lovablePrompt, markdown };
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
  const result = runStage11A11ZDevelopmentQualityLedger(parsed);
  if (!result.ok) {
    console.error("[stage11a-11z-development-quality-ledger] blocked");
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

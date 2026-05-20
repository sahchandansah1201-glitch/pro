#!/usr/bin/env node
// Stage 7G-7I · batch readiness, Lovable sync prompt, and drift-loop helpers.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "deploy/self-hosted/batch-verification-loop.stage7g-7i.json";

function readManifest(root = REPO_ROOT) {
  return JSON.parse(readFileSync(join(root, MANIFEST_PATH), "utf8"));
}

function isTrue(value) {
  return value === true;
}

function commandList(items = []) {
  return items.map((item) => (typeof item === "string" ? item : item.command));
}

export function buildStage7G7IBatchReadiness({ manifest = readManifest() } = {}) {
  return {
    stage: manifest.stage,
    packageId: manifest.packageId,
    includedStages: manifest.stages.map((stage) => stage.id),
    minimumRelatedStagesPerBatch: manifest.batchPlanPolicy.minimumRelatedStagesPerBatch,
    samePullRequestJustification: manifest.batchPlanPolicy.samePullRequestJustification,
    requiredChecks: commandList(manifest.gates),
    requiredFiles: manifest.lovableSyncVerification.requiredFiles,
    requiredCommands: manifest.lovableSyncVerification.requiredCommands,
    driftGuardLabel: manifest.driftGuard.requiresPreflightAllLabel,
    nextStageHypothesis: manifest.nextStageHypothesis,
    productBoundary: manifest.productBoundary,
  };
}

export function evaluateStage7G7ISyncReadiness({
  pullRequestMerged = false,
  localMainVerified = false,
  stagePreflightPassed = false,
  projectMemoryPassed = false,
  driftGuardPassed = false,
  githubChecksPassed = false,
  denoLockGuardPassed = false,
  packageLockUnchanged = true,
  manifest = readManifest(),
} = {}) {
  const failedGates = [];
  if (!isTrue(pullRequestMerged)) failedGates.push("pull request must be merged into main");
  if (!isTrue(localMainVerified)) failedGates.push("local main must be verified");
  if (!isTrue(stagePreflightPassed)) failedGates.push("npm run preflight:stage7g-7i");
  if (!isTrue(projectMemoryPassed)) failedGates.push("npm run check:project-memory");
  if (!isTrue(driftGuardPassed)) failedGates.push("npm run check:stage7g-7i");
  if (!isTrue(githubChecksPassed)) failedGates.push("GitHub checks must pass");
  if (!isTrue(denoLockGuardPassed)) failedGates.push("node scripts/check-no-deno-locks.mjs");
  if (!isTrue(packageLockUnchanged)) failedGates.push("package-lock.json must remain unchanged");

  return {
    stage: manifest.stage,
    status: failedGates.length === 0 ? "ready" : "blocked",
    lovablePromptAllowed: failedGates.length === 0,
    expectedConfirmation: manifest.lovableSyncVerification.expectedConfirmation,
    failedGates,
  };
}

export function buildStage7G7ILovablePrompt({ manifest = readManifest() } = {}) {
  const files = manifest.lovableSyncVerification.requiredFiles.map((file, index) => `${index + 1}. ${file}`);
  const commands = manifest.lovableSyncVerification.requiredCommands.map((command) => `- ${command}`);
  return [
    `Проверь синхронизацию Stage ${manifest.stage} из main.`,
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...files,
    "",
    "Команды должны проходить:",
    ...commands,
    "",
    "Project-memory должен фиксировать Stage 7G-7I как confirmed и Stage 7J как hypothesis.",
    "package-lock.json не должен измениться; deno.lock должен отсутствовать.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableSyncVerification.expectedConfirmation}`,
  ].join("\n");
}

export function renderStage7G7IBatchReadinessMarkdown({
  readiness = buildStage7G7IBatchReadiness(),
  sync = evaluateStage7G7ISyncReadiness(),
  lovablePrompt = buildStage7G7ILovablePrompt(),
} = {}) {
  const lines = [
    `# Stage ${readiness.stage} Batch Readiness`,
    "",
    `- Package: \`${readiness.packageId}\``,
    `- Included stages: ${readiness.includedStages.join(", ")}`,
    `- Minimum related stages per PR: ${readiness.minimumRelatedStagesPerBatch}`,
    `- Same-PR justification: ${readiness.samePullRequestJustification}`,
    `- Drift guard label: ${readiness.driftGuardLabel}`,
    `- Next stage hypothesis: ${readiness.nextStageHypothesis}`,
    `- Lovable prompt status: \`${sync.status}\``,
    `- Lovable prompt allowed: ${sync.lovablePromptAllowed ? "yes" : "no"}`,
    "",
    "## Required Checks",
    "",
    ...readiness.requiredChecks.map((command) => `- \`${command}\``),
    "",
    "## Lovable Sync Verification Manifest",
    "",
    ...readiness.requiredFiles.map((file) => `- \`${file}\``),
    "",
    "## Batch Drift Guard",
    "",
    `- Preflight-all label: \`${readiness.driftGuardLabel}\``,
    "- Project-memory must point to Stage 7J as the next hypothesis.",
    "- Package scripts, workflow, docs, manifest, reporter, and guard must describe the same batch.",
    "",
    "## Product Boundary",
    "",
    `- Runtime product change: ${readiness.productBoundary.runtimeProductChange}`,
    `- Backend schema change: ${readiness.productBoundary.backendSchemaChange}`,
    `- Frontend runtime change: ${readiness.productBoundary.frontendRuntimeChange}`,
    `- Managed runtime/database dependency: ${readiness.productBoundary.managedRuntimeDependency}/${readiness.productBoundary.managedDatabaseDependency}`,
    "",
  ];

  if (sync.failedGates.length > 0) {
    lines.push("## Blocked Gates", "", ...sync.failedGates.map((gate) => `- ${gate}`), "");
  }

  lines.push("## Post-Merge Lovable Prompt", "", "```text", lovablePrompt, "```", "");
  return lines.join("\n");
}

export function runStage7G7IBatchReadiness({ root = REPO_ROOT, dryRun = false } = {}) {
  const manifest = readManifest(root);
  const readiness = buildStage7G7IBatchReadiness({ manifest });
  const sync = evaluateStage7G7ISyncReadiness({ manifest });
  const lovablePrompt = buildStage7G7ILovablePrompt({ manifest });
  const markdown = renderStage7G7IBatchReadinessMarkdown({ readiness, sync, lovablePrompt });
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: true, readiness, sync, lovablePrompt, markdown };
}

export function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  runStage7G7IBatchReadiness({ dryRun });
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

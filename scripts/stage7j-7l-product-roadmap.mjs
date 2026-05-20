#!/usr/bin/env node
// Stage 7J-7L · product gap register, product batch planner, and roadmap handoff.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "deploy/self-hosted/product-roadmap.stage7j-7l.json";

function readManifest(root = REPO_ROOT) {
  return JSON.parse(readFileSync(join(root, MANIFEST_PATH), "utf8"));
}

function commands(items = []) {
  return items.map((item) => (typeof item === "string" ? item : item.command));
}

function sortByPriority(items = []) {
  return [...items].sort((a, b) => Number(a.priority ?? 999) - Number(b.priority ?? 999));
}

export function buildStage7J7LProductRoadmap({ manifest = readManifest() } = {}) {
  const gaps = sortByPriority(manifest.productGapRegister.remainingGaps);
  const batches = manifest.nextProductBatches.map((batch) => ({
    ...batch,
    stageCount: batch.includedStages.length,
    validBatchSize: batch.includedStages.length >= manifest.batchPlanPolicy.minimumRelatedStagesPerBatch,
  }));
  const invalidBatches = batches.filter((batch) => !batch.validBatchSize);
  return {
    stage: manifest.stage,
    packageId: manifest.packageId,
    includedStages: manifest.stages.map((stage) => stage.id),
    purpose: manifest.purpose,
    confirmedProductAreaCount: manifest.productGapRegister.confirmedProductAreas.length,
    remainingGapCount: gaps.length,
    remainingGaps: gaps,
    nextProductBatches: batches,
    invalidBatches,
    nextStageHypothesis: manifest.nextStageHypothesis,
    minimumRelatedStagesPerBatch: manifest.batchPlanPolicy.minimumRelatedStagesPerBatch,
    samePullRequestJustification: manifest.batchPlanPolicy.samePullRequestJustification,
    requiredChecks: commands(manifest.gates),
    requiredFiles: manifest.lovableSyncVerification.requiredFiles,
    requiredCommands: manifest.lovableSyncVerification.requiredCommands,
    expectedConfirmation: manifest.lovableSyncVerification.expectedConfirmation,
    productBoundary: manifest.productBoundary,
    status: invalidBatches.length === 0 ? "ready" : "blocked",
  };
}

export function buildStage7J7LLovablePrompt({ manifest = readManifest() } = {}) {
  const files = manifest.lovableSyncVerification.requiredFiles.map((file, index) => `${index + 1}. ${file}`);
  const commandsToRun = manifest.lovableSyncVerification.requiredCommands.map((command) => `- ${command}`);
  return [
    "Проверь синхронизацию Stage 7J-7L из main.",
    "",
    "Ожидаю подтверждение без изменений:",
    "",
    ...files,
    "",
    "Команды должны проходить:",
    ...commandsToRun,
    "",
    "Product roadmap должен фиксировать Stage 7J-7L как confirmed и Stage 8A-8C как next hypothesis.",
    "Каждый следующий product batch должен содержать минимум 3 связанных stage.",
    "package-lock.json не должен измениться; deno.lock должен отсутствовать.",
    "",
    `Если всё совпадает, ответь: ${manifest.lovableSyncVerification.expectedConfirmation}`,
  ].join("\n");
}

export function renderStage7J7LProductRoadmapMarkdown({
  roadmap = buildStage7J7LProductRoadmap(),
  lovablePrompt = buildStage7J7LLovablePrompt(),
} = {}) {
  const lines = [
    `# Stage ${roadmap.stage} Product Roadmap`,
    "",
    `- Package: \`${roadmap.packageId}\``,
    `- Included stages: ${roadmap.includedStages.join(", ")}`,
    `- Status: \`${roadmap.status}\``,
    `- Confirmed product areas: ${roadmap.confirmedProductAreaCount}`,
    `- Remaining product gaps: ${roadmap.remainingGapCount}`,
    `- Minimum related stages per next batch: ${roadmap.minimumRelatedStagesPerBatch}`,
    `- Next stage hypothesis: ${roadmap.nextStageHypothesis}`,
    `- Same-PR justification: ${roadmap.samePullRequestJustification}`,
    "",
    "## Product Gaps",
    "",
  ];

  for (const gap of roadmap.remainingGaps) {
    lines.push(
      `- P${gap.priority} \`${gap.id}\` -> ${gap.nextBatch}: ${gap.summary}`,
    );
  }

  lines.push("", "## Next Product Batches", "");
  for (const batch of roadmap.nextProductBatches) {
    lines.push(
      `- ${batch.batch}: ${batch.title}`,
      `  - stages: ${batch.includedStages.join(", ")}`,
      `  - focus: ${batch.focus}`,
      `  - boundary: ${batch.boundary}`,
    );
  }

  if (roadmap.invalidBatches.length > 0) {
    lines.push("", "## Blocked Batches", "");
    for (const batch of roadmap.invalidBatches) {
      lines.push(`- ${batch.batch}: ${batch.stageCount} stages is below ${roadmap.minimumRelatedStagesPerBatch}`);
    }
  }

  lines.push(
    "",
    "## Required Checks",
    "",
    ...roadmap.requiredChecks.map((command) => `- \`${command}\``),
    "",
    "## Product Boundary",
    "",
    `- Runtime product change: ${roadmap.productBoundary.runtimeProductChange}`,
    `- Backend schema change: ${roadmap.productBoundary.backendSchemaChange}`,
    `- Frontend runtime change: ${roadmap.productBoundary.frontendRuntimeChange}`,
    `- Managed runtime/database dependency: ${roadmap.productBoundary.managedRuntimeDependency}/${roadmap.productBoundary.managedDatabaseDependency}`,
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

export function runStage7J7LProductRoadmap({ root = REPO_ROOT, dryRun = false } = {}) {
  const manifest = readManifest(root);
  const roadmap = buildStage7J7LProductRoadmap({ manifest });
  const lovablePrompt = buildStage7J7LLovablePrompt({ manifest });
  const markdown = renderStage7J7LProductRoadmapMarkdown({ roadmap, lovablePrompt });
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: roadmap.status === "ready", roadmap, lovablePrompt, markdown };
}

export function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const result = runStage7J7LProductRoadmap({ dryRun });
  return result.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

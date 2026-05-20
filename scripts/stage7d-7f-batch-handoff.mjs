#!/usr/bin/env node
// Stage 7D-7F · batch plan and Lovable handoff gate helpers.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "deploy/self-hosted/batch-automation-contract.stage7d-7f.json";

function readManifest(root = REPO_ROOT) {
  return JSON.parse(readFileSync(join(root, MANIFEST_PATH), "utf8"));
}

function bool(value) {
  return value === true;
}

export function buildStage7D7FBatchPlan({ manifest = readManifest() } = {}) {
  return {
    stage: manifest.stage,
    packageId: manifest.packageId,
    includedStages: manifest.stages.map((stage) => stage.id),
    justification: manifest.batchPlanPolicy.samePullRequestJustification,
    minimumRelatedStagesPerBatch: manifest.batchPlanPolicy.minimumRelatedStagesPerBatch,
    requiredChecks: manifest.gates.map((gate) => gate.command),
    productBoundary: manifest.productBoundary,
    nextStageHypothesis: manifest.nextStageHypothesis,
  };
}

export function evaluateStage7D7FHandoffReadiness({
  pullRequestMerged = false,
  baseBranch = "main",
  localBranch = "main",
  localMainVerified = false,
  stagePreflightPassed = false,
  projectMemoryPassed = false,
  denoLockGuardPassed = false,
  manifest = readManifest(),
} = {}) {
  const failedGates = [];
  if (!bool(pullRequestMerged)) failedGates.push("pull request must be merged");
  if (baseBranch !== "main") failedGates.push("base branch must be main");
  if (localBranch !== "main") failedGates.push("local branch must be main");
  if (!bool(localMainVerified)) failedGates.push("local main must be verified");
  if (!bool(stagePreflightPassed)) failedGates.push(manifest.handoffGate.stagePreflightRequired);
  if (!bool(projectMemoryPassed)) failedGates.push(manifest.handoffGate.projectMemoryCheckRequired);
  if (!bool(denoLockGuardPassed)) failedGates.push(manifest.handoffGate.denoLockGuardRequired);

  return {
    stage: manifest.stage,
    lovablePromptAllowed: failedGates.length === 0,
    status: failedGates.length === 0 ? "ready" : "blocked",
    failedGates,
    expectedConfirmation: manifest.lovableSyncPrompt.expectedConfirmation,
  };
}

export function renderStage7D7FBatchPlanMarkdown({ plan = buildStage7D7FBatchPlan(), readiness } = {}) {
  const result = readiness ?? evaluateStage7D7FHandoffReadiness();
  const lines = [
    `# Stage ${plan.stage} Batch Handoff`,
    "",
    `- Package: \`${plan.packageId}\``,
    `- Included stages: ${plan.includedStages.join(", ")}`,
    `- Minimum related stages per PR: ${plan.minimumRelatedStagesPerBatch}`,
    `- Same-PR justification: ${plan.justification}`,
    `- Next stage hypothesis: ${plan.nextStageHypothesis}`,
    `- Lovable prompt status: \`${result.status}\``,
    `- Lovable prompt allowed: ${result.lovablePromptAllowed ? "yes" : "no"}`,
    "",
    "## Required Checks",
    "",
    ...plan.requiredChecks.map((command) => `- \`${command}\``),
    "",
    "## Product Boundary",
    "",
    `- Runtime product change: ${plan.productBoundary.runtimeProductChange}`,
    `- Backend schema change: ${plan.productBoundary.backendSchemaChange}`,
    `- Frontend runtime change: ${plan.productBoundary.frontendRuntimeChange}`,
    `- Managed runtime/database dependency: ${plan.productBoundary.managedRuntimeDependency}/${plan.productBoundary.managedDatabaseDependency}`,
    "",
  ];
  if (result.failedGates.length > 0) {
    lines.push("## Blocked Gates", "", ...result.failedGates.map((gate) => `- ${gate}`), "");
  }
  return lines.join("\n");
}

export function runStage7D7FBatchHandoff({ root = REPO_ROOT, dryRun = false } = {}) {
  const manifest = readManifest(root);
  const plan = buildStage7D7FBatchPlan({ manifest });
  const readiness = evaluateStage7D7FHandoffReadiness({ manifest });
  const markdown = renderStage7D7FBatchPlanMarkdown({ plan, readiness });
  if (dryRun) process.stdout.write(`${markdown}\n`);
  return { ok: true, plan, readiness, markdown };
}

export function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  runStage7D7FBatchHandoff({ dryRun });
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}

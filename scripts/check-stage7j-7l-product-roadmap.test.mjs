#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectStage7J7LChecks } from "./check-stage7j-7l-product-roadmap.mjs";

function makeRoot() {
  const root = join(tmpdir(), `stage7j-7l-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(root, { recursive: true });
  return root;
}

function writeFixture(root) {
  const files = {
    "deploy/self-hosted/product-roadmap.stage7j-7l.json": `{
      "stage": "7J-7L",
      "packageId": "stage7j-7l-product-roadmap",
      "stages": [
        { "id": "Stage 7J", "title": "Product gap register" },
        { "id": "Stage 7K", "title": "Next product batch planner" },
        { "id": "Stage 7L", "title": "Product roadmap drift guard" }
      ],
      "batchPlanPolicy": { "minimumRelatedStagesPerBatch": 3 },
      "productGapRegister": {
        "confirmedProductAreas": [],
        "remainingGaps": [
          { "id": "crm", "priority": 1, "nextBatch": "Stage 8A-8C" }
        ]
      },
      "nextProductBatches": [
        { "batch": "Stage 8A-8C", "includedStages": ["Stage 8A", "Stage 8B", "Stage 8C"], "minimumRelatedStagesSatisfied": true },
        { "batch": "Stage 8D-8F", "includedStages": ["Stage 8D", "Stage 8E", "Stage 8F"], "minimumRelatedStagesSatisfied": true },
        { "batch": "Stage 8G-8I", "includedStages": ["Stage 8G", "Stage 8H", "Stage 8I"], "minimumRelatedStagesSatisfied": true },
        { "batch": "Stage 8J-8L", "includedStages": ["Stage 8J", "Stage 8K", "Stage 8L"], "minimumRelatedStagesSatisfied": true },
        { "batch": "Stage 8M-8O", "includedStages": ["Stage 8M", "Stage 8N", "Stage 8O"], "minimumRelatedStagesSatisfied": true }
      ],
      "lovableSyncVerification": {
        "validOnlyAfterMergeToMain": true,
        "expectedConfirmation": "Confirmed: Stage 7J-7L synced from main, no conflicts."
      },
      "productBoundary": {
        "runtimeProductChange": false,
        "backendSchemaChange": false,
        "frontendRuntimeChange": false,
        "managedRuntimeDependency": "none",
        "managedDatabaseDependency": "none"
      },
      "nextStageHypothesis": "Stage 8A-8C"
    }`,
    "scripts/stage7j-7l-product-roadmap.mjs": "buildStage7J7LProductRoadmap buildStage7J7LLovablePrompt renderStage7J7LProductRoadmapMarkdown runStage7J7LProductRoadmap Stage 8A-8C minimumRelatedStagesPerBatch",
    "scripts/stage7j-7l-product-roadmap.test.mjs": "ok",
    "scripts/check-stage7j-7l-product-roadmap.mjs": "ok",
    "scripts/check-stage7j-7l-product-roadmap.test.mjs": "ok",
    "docs/backend/stage-7j-7l-product-roadmap.md": "Stage 7J-7L npm run preflight:stage7j-7l Product gap register Next product batch planner Product roadmap drift guard Managed runtime/database dependency: none",
    ".github/workflows/stage7j-7l-product-roadmap.yml": "name: stage7j-7l-product-roadmap\n- run: npm run preflight:stage7j-7l\nGITHUB_STEP_SUMMARY",
    "docs/project-memory/PROJECT_STATE.yaml": "stage7j_7l_preflight\nproduct_gap_register_confirmed: true\nnext_product_batch_planner_confirmed: true\nproduct_roadmap_drift_guard_confirmed: true\ncommand: \"npm run preflight:stage7j-7l\"\nStage 8A-8C",
    "docs/project-memory/HANDOFF.md": "Stage 7J-7L product roadmap Stage 8A-8C",
    "docs/project-memory/NEXT_ACTIONS.md": "Stage 7J-7L Stage 8A-8C hypothesis",
    "docs/project-memory/WORKLOG.md": "Stage 7J-7L product gap register product roadmap drift guard",
    "docs/project-memory/RISKS.md": "Stage 7J-7L Stage 8A-8C hypothesis",
    "docs/project-memory/ARTIFACTS.md": "product-roadmap.stage7j-7l.json stage7j-7l-product-roadmap.mjs stage-7j-7l-product-roadmap.md",
    "docs/project-memory/WORKING_CONTRACT.md": "Stage 7J Stage 7K Stage 7L product gap register next product batch planner product roadmap drift guard",
    "docs/project-memory/BATCH_TEMPLATE.md": "Product Gap Register Next Product Batch Planner Roadmap Drift Guard",
    "package.json": "{\"scripts\":{\"test:stage7j-7l\":\"x\",\"check:stage7j-7l\":\"x\",\"roadmap:stage7j-7l:dry-run\":\"x\",\"preflight:stage7j-7l\":\"x\"}}",
    "scripts/preflight-all.mjs": "Stage 7J-7L product roadmap preflight",
  };
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), content);
  }
}

test("Stage 7J-7L guard passes for a complete fixture", () => {
  const root = makeRoot();
  writeFixture(root);
  const result = collectStage7J7LChecks({ root });
  assert.equal(result.ok, true, result.errors.join("\n"));
  rmSync(root, { recursive: true, force: true });
});

test("Stage 7J-7L guard reports missing files", () => {
  const root = makeRoot();
  writeFixture(root);
  rmSync(join(root, "docs/backend/stage-7j-7l-product-roadmap.md"));
  const result = collectStage7J7LChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing required file/);
  rmSync(root, { recursive: true, force: true });
});

test("Stage 7J-7L guard blocks too-small future batches", () => {
  const root = makeRoot();
  writeFixture(root);
  const manifestPath = join(root, "deploy/self-hosted/product-roadmap.stage7j-7l.json");
  const manifest = JSON.parse(readFixture(root, "deploy/self-hosted/product-roadmap.stage7j-7l.json"));
  manifest.nextProductBatches[0].includedStages = ["Stage 8A", "Stage 8B"];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const result = collectStage7J7LChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /fewer than 3 stages/);
  rmSync(root, { recursive: true, force: true });
});

test("Stage 7J-7L guard blocks runtime coupling in protected files", () => {
  const root = makeRoot();
  writeFixture(root);
  writeFileSync(
    join(root, "docs/backend/stage-7j-7l-product-roadmap.md"),
    "Stage 7J-7L npm run preflight:stage7j-7l Product gap register Next product batch planner Product roadmap drift guard Managed runtime/database dependency: none access_token",
  );
  const result = collectStage7J7LChecks({ root });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /forbidden Stage 7J-7L runtime coupling/);
  rmSync(root, { recursive: true, force: true });
});

function readFixture(root, file) {
  return readFileSync(join(root, file), "utf8");
}

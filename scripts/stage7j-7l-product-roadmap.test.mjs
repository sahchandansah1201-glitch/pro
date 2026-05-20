#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  buildStage7J7LProductRoadmap,
  buildStage7J7LLovablePrompt,
  renderStage7J7LProductRoadmapMarkdown,
  runStage7J7LProductRoadmap,
} from "./stage7j-7l-product-roadmap.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage7j-7l-product-roadmap.mjs");

test("builds the Stage 7J-7L product roadmap from the manifest", () => {
  const roadmap = buildStage7J7LProductRoadmap();
  assert.equal(roadmap.stage, "7J-7L");
  assert.equal(roadmap.status, "ready");
  assert.deepEqual(roadmap.includedStages, ["Stage 7J", "Stage 7K", "Stage 7L"]);
  assert.equal(roadmap.minimumRelatedStagesPerBatch, 3);
  assert.equal(roadmap.remainingGapCount, 5);
  assert.equal(roadmap.nextProductBatches.length, 5);
  assert.equal(roadmap.invalidBatches.length, 0);
  assert.equal(roadmap.nextStageHypothesis, "Stage 8A-8C");
});

test("sorts product gaps by priority and maps them to next batches", () => {
  const roadmap = buildStage7J7LProductRoadmap();
  assert.deepEqual(
    roadmap.remainingGaps.map((gap) => gap.nextBatch),
    ["Stage 8A-8C", "Stage 8D-8F", "Stage 8G-8I", "Stage 8J-8L", "Stage 8M-8O"],
  );
});

test("generates a Lovable prompt from repository-owned manifest data", () => {
  const prompt = buildStage7J7LLovablePrompt();
  assert.match(prompt, /Stage 7J-7L/);
  assert.match(prompt, /deploy\/self-hosted\/product-roadmap\.stage7j-7l\.json/);
  assert.match(prompt, /npm run preflight:stage7j-7l/);
  assert.match(prompt, /Confirmed: Stage 7J-7L synced from main, no conflicts/);
});

test("renders markdown with roadmap gaps, batches, and product boundary", () => {
  const markdown = renderStage7J7LProductRoadmapMarkdown();
  assert.match(markdown, /Stage 7J-7L Product Roadmap/);
  assert.match(markdown, /CRM inbound adapter implementation/);
  assert.match(markdown, /Appointment availability sync/);
  assert.match(markdown, /Managed runtime\/database dependency: none\/none/);
});

test("blocks invalid future batches below the minimum stage count", () => {
  const manifest = {
    stage: "7J-7L",
    packageId: "test",
    purpose: "test",
    stages: [{ id: "Stage 7J" }, { id: "Stage 7K" }, { id: "Stage 7L" }],
    batchPlanPolicy: {
      minimumRelatedStagesPerBatch: 3,
      samePullRequestJustification: "test",
    },
    productGapRegister: {
      confirmedProductAreas: [],
      remainingGaps: [],
    },
    nextProductBatches: [
      {
        batch: "Stage 8A-8B",
        title: "too small",
        includedStages: ["Stage 8A", "Stage 8B"],
        focus: "test",
        boundary: "test",
      },
    ],
    lovableSyncVerification: {
      expectedConfirmation: "Confirmed",
      requiredFiles: [],
      requiredCommands: [],
    },
    gates: [],
    productBoundary: {
      runtimeProductChange: false,
      backendSchemaChange: false,
      frontendRuntimeChange: false,
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
    },
    nextStageHypothesis: "Stage 8A-8B",
  };
  const roadmap = buildStage7J7LProductRoadmap({ manifest });
  assert.equal(roadmap.status, "blocked");
  assert.equal(roadmap.invalidBatches.length, 1);
});

test("CLI dry-run prints a safe roadmap report", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 7J-7L Product Roadmap/);
  assert.match(result.stdout, /Stage 8A-8C/);
  assert.doesNotMatch(result.stdout, /access_token|signed_url|storage_object_path/);
});

test("runner returns markdown and Lovable prompt", () => {
  const result = runStage7J7LProductRoadmap();
  assert.equal(result.ok, true);
  assert.match(result.markdown, /Product Gaps/);
  assert.match(result.lovablePrompt, /Stage 7J-7L/);
});

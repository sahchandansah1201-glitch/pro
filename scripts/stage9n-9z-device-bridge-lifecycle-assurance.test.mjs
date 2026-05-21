import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildDeviceBridgeLifecycleAssurancePackage,
  buildStage9N9ZLovablePrompt,
  renderDeviceBridgeLifecycleAssuranceMarkdown,
  runStage9N9ZDeviceBridgeLifecycleAssurance,
} from "./stage9n-9z-device-bridge-lifecycle-assurance.mjs";

test("Stage 9N-9Z package is ready and self-hosted", () => {
  const pkg = buildDeviceBridgeLifecycleAssurancePackage();

  assert.equal(pkg.stage, "9N-9Z");
  assert.equal(pkg.status, "ready");
  assert.equal(pkg.previousBatch, "Stage 9B-9M");
  assert.equal(pkg.nextBatchHypothesis, "Stage 10A-10L");
  assert.equal(pkg.includedStages.length, 13);
  assert.equal(pkg.requiredGateCount, pkg.gates.length);
  assert.equal(pkg.productBoundary.managedRuntimeDependency, "none");
  assert.equal(pkg.productBoundary.managedDatabaseDependency, "none");
  assert.equal(pkg.productBoundary.payloadVisibility, "backend-only");
  assert.deepEqual(pkg.leakFindings, []);
});

test("Stage 9N-9Z Lovable prompt is explicit and post-merge only", () => {
  const prompt = buildStage9N9ZLovablePrompt();

  assert.match(prompt, /Stage 9N-9Z/);
  assert.match(prompt, /npm run preflight:stage9n-9z/);
  assert.match(prompt, /Stage 10A-10L/);
  assert.match(prompt, /Confirmed: Stage 9N-9Z synced from main, no conflicts\./);
  assert.doesNotMatch(prompt, /SUPABASE_|api-read|api-write|access_token|storage_object_path/i);
});

test("Stage 9N-9Z renderer writes markdown and json outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage9n9z-"));
  const result = runStage9N9ZDeviceBridgeLifecycleAssurance({
    summaryPath: join(dir, "summary.md"),
    jsonPath: join(dir, "summary.json"),
  });

  assert.equal(result.ok, true);
  assert.match(result.markdown, /Device Bridge lifecycle assurance/);
  assert.match(result.markdown, /Post-Merge Lovable Prompt/);
  assert.equal(JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")).stage, "9N-9Z");
});

test("Stage 9N-9Z markdown remains sanitized", () => {
  const markdown = renderDeviceBridgeLifecycleAssuranceMarkdown();

  assert.match(markdown, /Managed runtime\/database dependency: none\/none/);
  assert.doesNotMatch(markdown, /SUPABASE_|api-read|api-write|signed_url|storage_object_path|access_token|payload_json|result_json|patient_full_name/i);
});

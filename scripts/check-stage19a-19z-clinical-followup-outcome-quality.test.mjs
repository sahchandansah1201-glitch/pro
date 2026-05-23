import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkStage19A19Z } from "./check-stage19a-19z-clinical-followup-outcome-quality.mjs";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const MANIFEST = "deploy/self-hosted/clinical-followup-outcome-quality.stage19a-19z.json";

test("Stage 19A-19Z guard passes for repository fixture", () => {
  const result = checkStage19A19Z(REPO_ROOT);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 24);
});

test("Stage 19A-19Z guard rejects managed notification dependency", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage19-guard-"));
  try {
    copyFixture(dir);
    const manifestPath = join(dir, MANIFEST);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.productBoundary.managedNotificationProviderDependency = "vendor";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage19A19Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /managed notification dependency/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 19A-19Z guard rejects forbidden protected markers", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage19-guard-"));
  try {
    copyFixture(dir);
    const file = join(dir, "src/lib/self-hosted-follow-up-api.ts");
    writeFileSync(file, `${readFileSync(file, "utf8")}\nconst forbidden = \"SUPABASE_FORBIDDEN\";\n`);

    const result = checkStage19A19Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function copyFixture(targetRoot) {
  const files = [
    MANIFEST,
    "backend/self-hosted/db/migrations/0026_stage19_followup_outcome_quality.sql",
    "backend/self-hosted/clinical-followup-repository.mjs",
    "backend/self-hosted/clinical-followup-repository.test.mjs",
    "backend/self-hosted/clinical-followup-service.mjs",
    "backend/self-hosted/clinical-followup-service.test.mjs",
    "backend/self-hosted/openapi.stage19a-19z.json",
    "backend/self-hosted/routes.mjs",
    "backend/self-hosted/routes.test.mjs",
    "deploy/self-hosted/nginx.stage4a.conf",
    "src/lib/self-hosted-follow-up-api.ts",
    "src/lib/self-hosted-follow-up-api.test.ts",
    "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
    "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
    "docs/backend/stage-19a-19z-clinical-followup-outcome-quality.md",
    ".github/workflows/stage19a-19z-clinical-followup-outcome-quality.yml",
    "package.json",
    "scripts/preflight-all.mjs",
    "docs/project-memory/PROJECT_STATE.yaml",
    "docs/project-memory/HANDOFF.md",
    "docs/project-memory/NEXT_ACTIONS.md",
    "docs/project-memory/WORKLOG.md",
    "docs/project-memory/RISKS.md",
    "docs/project-memory/ARTIFACTS.md",
  ];
  for (const file of files) {
    const target = join(targetRoot, file);
    mkdirSync(target.slice(0, target.lastIndexOf("/")), { recursive: true });
    writeFileSync(target, readFileSync(join(REPO_ROOT, file), "utf8"));
  }
}

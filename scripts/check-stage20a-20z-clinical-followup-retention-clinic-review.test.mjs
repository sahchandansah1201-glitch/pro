import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkStage20A20Z } from "./check-stage20a-20z-clinical-followup-retention-clinic-review.mjs";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const MANIFEST = "deploy/self-hosted/clinical-followup-retention-clinic-review.stage20a-20z.json";

test("Stage 20A-20Z guard passes for repository fixture", () => {
  const result = checkStage20A20Z(REPO_ROOT);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 24);
});

test("Stage 20A-20Z guard rejects managed notification dependency", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage20-guard-"));
  try {
    copyFixture(dir);
    const manifestPath = join(dir, MANIFEST);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.productBoundary.managedNotificationProviderDependency = "vendor";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage20A20Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /managed notification dependency/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 20A-20Z guard rejects forbidden protected markers", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage20-guard-"));
  try {
    copyFixture(dir);
    const file = join(dir, "src/lib/self-hosted-follow-up-api.ts");
    writeFileSync(file, `${readFileSync(file, "utf8")}\nconst forbidden = \"SUPABASE_FORBIDDEN\";\n`);

    const result = checkStage20A20Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function copyFixture(targetRoot) {
  const files = [
    MANIFEST,
    "backend/self-hosted/db/migrations/0027_stage20_followup_retention_clinic_review.sql",
    "backend/self-hosted/clinical-followup-repository.mjs",
    "backend/self-hosted/clinical-followup-repository.test.mjs",
    "backend/self-hosted/clinical-followup-service.mjs",
    "backend/self-hosted/clinical-followup-service.test.mjs",
    "backend/self-hosted/openapi.stage20a-20z.json",
    "backend/self-hosted/routes.mjs",
    "backend/self-hosted/routes.test.mjs",
    "deploy/self-hosted/nginx.stage4a.conf",
    "src/lib/self-hosted-follow-up-api.ts",
    "src/lib/self-hosted-follow-up-api.test.ts",
    "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
    "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
    "docs/backend/stage-20a-20z-clinical-followup-retention-clinic-review.md",
    ".github/workflows/stage20a-20z-clinical-followup-retention-clinic-review.yml",
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

#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  collectSelfHostedProductChecks,
  renderSelfHostedProductReport,
  summarizeSelfHostedProductChecks,
} from "./check-self-hosted-product.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "check-self-hosted-product.mjs");

function fixture(overrides = {}) {
  const files = {
    "PRODUCT.md": [
      "self-hosted",
      "frontend + backend + database + file storage",
      "Supabase Cloud **не считается** целевой зависимостью",
      "новые компоненты не должны добавлять зависимость от Supabase Cloud",
      "docs/architecture/stage-4a-self-hosted-product.md",
      "npm run check:self-hosted-product",
      "npm run preflight:all",
    ].join("\n"),
    "DESIGN.md": [
      "Продуктовый клинический UI",
      "React + TypeScript",
      "Никаких hero-секций",
      "Контраст AA",
    ].join("\n"),
    "docs/architecture/stage-4a-self-hosted-product.md": [
      "# Stage 4A - Self-hosted product architecture guardrail",
      "## 1. Purpose",
      "## 2. Target deployment shape",
      "## 3. Required runtime components",
      "## 4. Supabase transition rule",
      "## 5. Backend ownership rules",
      "## 6. Frontend integration rules",
      "## 7. Verification commands",
      "## 8. Lovable and Codex working rule",
      "## 9. Acceptance criteria",
      "frontend + backend API + database + object storage",
      "PostgreSQL-compatible relational database",
      "S3-compatible or local object storage",
      "Supabase Cloud is not the target architecture",
      "npm run check:self-hosted-product",
      "npm run test:self-hosted-product",
      "npm run preflight:all",
    ].join("\n"),
    "package.json": JSON.stringify({
      scripts: {
        "check:self-hosted-product": "node scripts/check-self-hosted-product.mjs",
        "test:self-hosted-product": "node --test scripts/check-self-hosted-product.test.mjs",
      },
    }),
    "scripts/preflight-all.mjs": "self-hosted product guard\ncheck:self-hosted-product",
    "scripts/check-self-hosted-product.mjs": "script",
    "scripts/check-self-hosted-product.test.mjs": "test",
    ".github/workflows/self-hosted-product.yml": [
      "name: self-hosted-product",
      "npm run test:self-hosted-product",
      "npm run check:self-hosted-product",
      "docs/architecture/**",
      "PRODUCT.md",
      "DESIGN.md",
    ].join("\n"),
    "docs/frontend/stage-1i-auth-assets-readiness.md": [
      "npm run check:self-hosted-product",
      "docs/architecture/stage-4a-self-hosted-product.md",
    ].join("\n"),
    "docs/frontend/stage-3i-final-documentation-index.md": [
      "npm run test:self-hosted-product",
      "npm run check:self-hosted-product",
      "Stage 4A self-hosted product guard",
      "PR #78",
    ].join("\n"),
    "docs/frontend/stage-3m-release-operations-dashboard.md": [
      "### 12.4 Self-hosted product guard",
      "docs/architecture/stage-4a-self-hosted-product.md",
      "npm run test:self-hosted-product",
      "npm run check:self-hosted-product",
      ".github/workflows/self-hosted-product.yml",
    ].join("\n"),
    "src/App.tsx": "export const ok = true;",
    ...overrides,
  };

  return {
    exists: (path) => Object.hasOwn(files, path),
    readFile: (path) => files[path],
    sourceFiles: Object.keys(files).filter((path) => path.startsWith("src/")),
  };
}

test("self-hosted guard passes with the required architecture contract", () => {
  const checks = collectSelfHostedProductChecks(fixture());
  const summary = summarizeSelfHostedProductChecks(checks);

  assert.equal(summary.ok, true);
  assert.equal(summary.failed.length, 0);
});

test("self-hosted guard reports missing product contract text", () => {
  const checks = collectSelfHostedProductChecks(fixture({
    "PRODUCT.md": "self-hosted\n",
  }));
  const summary = summarizeSelfHostedProductChecks(checks);

  assert.equal(summary.ok, false);
  assert(summary.failed.some((check) => check.label.includes("frontend + backend + database + file storage")));
  assert.match(renderSelfHostedProductReport(checks), /Status: `fail`/);
});

test("self-hosted guard blocks frontend service-role env reads", () => {
  const checks = collectSelfHostedProductChecks(fixture({
    "src/App.tsx": "const key = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;",
  }));
  const summary = summarizeSelfHostedProductChecks(checks);

  assert.equal(summary.ok, false);
  assert(summary.failed.some((check) => check.label.includes("SUPABASE_SERVICE_ROLE_KEY")));
});

test("self-hosted guard ignores redaction tests containing forbidden strings", () => {
  const checks = collectSelfHostedProductChecks(fixture({
    "src/App.tsx": "export const ok = true;",
    "src/redaction.test.ts": "expect(text).not.toContain('SUPABASE_SERVICE_ROLE_KEY=secret')",
  }));
  const summary = summarizeSelfHostedProductChecks(checks);

  assert.equal(summary.ok, true);
});

test("cli exits 0 in the current repository", () => {
  const result = spawnSync(process.execPath, [SCRIPT], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Self-hosted product guard/);
  assert.match(result.stdout, /Status: `ok`/);
});

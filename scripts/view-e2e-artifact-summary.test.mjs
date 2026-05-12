import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildE2eArtifactSummaryView } from "./view-e2e-artifact-summary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, "view-e2e-artifact-summary.mjs");

const SAMPLE_SUMMARY = `## e2e-nightly-full

- Command: \`npx playwright test\`
- Artifact upload expected: \`yes\`
- Artifact name: \`e2e-nightly-full-report-123\`
- Run: https://github.com/example/repo/actions/runs/123?token=run-token
- Report entry: \`playwright-report/index.html?sig=abc123\`
- Summary file: \`test-results/e2e-nightly-full-artifact-summary.md\`
- Result: \`failure\`

### Expected artifact bundle
- \`playwright-report/\`
- \`test-results/\`

### Artifact size check
- \`playwright-report/\`: 9.0 KiB
- \`test-results/missing.log\`: missing

### Privacy

- Cookie: session=secret
`;

test("builds a compact sanitized report view", () => {
  const view = buildE2eArtifactSummaryView(SAMPLE_SUMMARY, {
    source: "test-results/e2e-nightly-full-artifact-summary.md",
  });

  assert.match(view, /## E2E artifact report view/);
  assert.match(view, /Kind: `e2e-nightly-full`/);
  assert.match(view, /Missing artifact paths: `1`/);
  assert.match(view, /`playwright-report\/`: 9\.0 KiB/);
  assert.match(view, /`test-results\/missing\.log`: missing/);
  assert.match(view, /Report entry: `playwright-report\/index\.html\?sig=\[redacted\]`/);
  assert.doesNotMatch(view, /abc123/);
  assert.doesNotMatch(view, /run-token/);
  assert.doesNotMatch(view, /session=secret/);
  assert.match(view, /sig=\[redacted\]/);
});

test("cli prints a sanitized view for an existing summary file", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "e2e-artifact-view-"));
  const file = path.join(dir, "summary.md");
  try {
    writeFileSync(file, SAMPLE_SUMMARY, "utf8");
    const result = spawnSync(process.execPath, [SCRIPT, file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /E2E artifact report view/);
    assert.match(result.stdout, /Missing artifact paths: `1`/);
    assert.doesNotMatch(result.stdout, /abc123/);
    assert.doesNotMatch(result.stdout, /run-token/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli fails clearly when the summary file is missing", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "e2e-artifact-view-missing-"));
  const file = path.join(dir, "missing.md");
  try {
    const result = spawnSync(process.execPath, [SCRIPT, file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[view-e2e-artifact-summary\] missing file:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

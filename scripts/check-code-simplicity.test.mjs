#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { analyzeSimplicity } from "./check-code-simplicity.mjs";

function makeTempProject() {
  return mkdtempSync(join(tmpdir(), "skindoctor-simplicity-"));
}

function writeLines(root, relativePath, lineCount) {
  const path = join(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Array.from({ length: lineCount }, (_, index) => `export const line${index} = ${index};`).join("\n"));
}

test("passes for small focused source files", () => {
  const root = makeTempProject();
  try {
    writeLines(root, "src/pages/doctor/FocusedPage.tsx", 120);
    writeLines(root, "backend/self-hosted/focused-service.mjs", 180);

    const result = analyzeSimplicity({ root, scanDirs: ["src", "backend/self-hosted"] });

    assert.equal(result.status, "passed");
    assert.equal(result.metrics.violationCount, 0);
    assert.equal(result.metrics.scannedFileCount, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails when a new frontend page exceeds the file budget", () => {
  const root = makeTempProject();
  try {
    writeLines(root, "src/pages/doctor/NewHugePage.tsx", 1801);

    const result = analyzeSimplicity({ root, scanDirs: ["src"] });

    assert.equal(result.status, "failed");
    assert.equal(result.metrics.newOversizedFileCount, 1);
    assert.equal(result.violations[0].violation, "new_oversized_file");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails when a known oversized file grows beyond its baseline allowance", () => {
  const root = makeTempProject();
  try {
    writeLines(root, "src/pages/doctor/VisitWorkspacePage.tsx", 5187);

    const result = analyzeSimplicity({ root, scanDirs: ["src"] });

    assert.equal(result.status, "failed");
    assert.equal(result.metrics.knownFileGrowthViolationCount, 1);
    assert.equal(result.violations[0].violation, "known_file_growth");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

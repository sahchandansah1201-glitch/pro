import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkClinicalBodyRegionMaps } from "./check-clinical-body-region-maps.mjs";

test("all generated body region maps satisfy fail-closed invariants", async () => {
  const result = await checkClinicalBodyRegionMaps("public/clinical-body-atlas-regions");
  assert.deepEqual(result, { profiles: 14, views: 56, regions: 114 });
});

test("rejects a hit map whose bytes do not match the manifest", async () => {
  const root = mkdtempSync(join(tmpdir(), "skindoctor-region-validator-"));
  const atlasDir = join(root, "atlas");
  try {
    cpSync("public/clinical-body-atlas-regions", atlasDir, { recursive: true });
    writeFileSync(
      join(atlasDir, "adult_female_30-front.hitmap.svg"),
      '<svg viewBox="0 0 240 400"><path id="region-front-right-toes" d="M84 384h1v1H84z"/></svg>',
    );
    await assert.rejects(
      checkClinicalBodyRegionMaps(atlasDir),
      /hit-map SHA-256 mismatch/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a mask whose bytes do not match the manifest", async () => {
  const root = mkdtempSync(join(tmpdir(), "skindoctor-region-mask-validator-"));
  const atlasDir = join(root, "atlas");
  try {
    cpSync("public/clinical-body-atlas-regions", atlasDir, { recursive: true });
    writeFileSync(join(atlasDir, "adult_female_30-front.mask.png"), "tampered-mask");
    await assert.rejects(
      checkClinicalBodyRegionMaps(atlasDir),
      /mask SHA-256 mismatch/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a source image whose bytes do not match the manifest", async () => {
  const root = mkdtempSync(join(tmpdir(), "skindoctor-region-source-validator-"));
  const atlasDir = join(root, "atlas");
  try {
    cpSync("public/clinical-body-atlas-regions", atlasDir, { recursive: true });
    const manifestPath = join(atlasDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const record = manifest.records.find(
      (item) => item.profile === "adult_female_30" && item.view === "front",
    );
    record.sourcePath = join(root, "tampered-source.webp");
    writeFileSync(record.sourcePath, "tampered-source");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await assert.rejects(
      checkClinicalBodyRegionMaps(atlasDir),
      /source asset SHA-256 mismatch/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a public manifest that exposes an absolute source path", async () => {
  const root = mkdtempSync(join(tmpdir(), "skindoctor-region-private-path-"));
  const atlasDir = join(root, "atlas");
  try {
    cpSync("public/clinical-body-atlas-regions", atlasDir, { recursive: true });
    const manifestPath = join(atlasDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.records[0].sourcePath = "/Users/private/clinical-atlas.png";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    await assert.rejects(
      checkClinicalBodyRegionMaps(atlasDir),
      /absolute source path/i,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

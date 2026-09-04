import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  copyProductionPublicAssets,
  productionPublicAssetsPlugin,
} from "./copy-production-public-assets.mjs";

test("production public copy excludes MakeHuman images without deleting source history", () => {
  const root = mkdtempSync(join(tmpdir(), "skindoctor-public-copy-"));
  const publicDir = join(root, "public");
  const outDir = join(root, "dist");
  mkdirSync(join(publicDir, "clinical-body-atlas"), { recursive: true });
  mkdirSync(join(publicDir, "clinical-body-atlas-daz-local"), { recursive: true });
  mkdirSync(join(publicDir, "clinical-body-atlas-regions"), { recursive: true });
  writeFileSync(join(publicDir, "clinical-body-atlas", "adult_female_30-front.webp"), "legacy");
  writeFileSync(join(publicDir, "clinical-body-atlas-daz-local", "adult_female_30-front.png"), "approved");
  writeFileSync(join(publicDir, "clinical-body-atlas-regions", "manifest.json"), "historical metadata");
  writeFileSync(join(publicDir, "robots.txt"), "User-agent: *");

  const result = copyProductionPublicAssets({ publicDir, outDir });

  assert.deepEqual(result.excludedEntries, ["clinical-body-atlas"]);
  assert.equal(existsSync(join(outDir, "clinical-body-atlas")), false);
  assert.equal(readFileSync(join(outDir, "clinical-body-atlas-daz-local", "adult_female_30-front.png"), "utf8"), "approved");
  assert.equal(readFileSync(join(outDir, "clinical-body-atlas-regions", "manifest.json"), "utf8"), "historical metadata");
  assert.equal(readFileSync(join(outDir, "robots.txt"), "utf8"), "User-agent: *");
  assert.equal(
    readFileSync(join(publicDir, "clinical-body-atlas", "adult_female_30-front.webp"), "utf8"),
    "legacy",
  );
});

test("production public plugin copies into the resolved Vite build outDir", () => {
  const root = mkdtempSync(join(tmpdir(), "skindoctor-public-plugin-"));
  const publicDir = join(root, "public");
  const stagingOutDir = join(root, ".stage4m-build", "frontend-next");
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, "robots.txt"), "User-agent: *");

  const plugin = productionPublicAssetsPlugin({ rootDir: root });
  plugin.configResolved({ root, build: { outDir: stagingOutDir } });
  plugin.closeBundle();

  assert.equal(readFileSync(join(stagingOutDir, "robots.txt"), "utf8"), "User-agent: *");
  assert.equal(existsSync(join(root, "dist", "robots.txt")), false);
});

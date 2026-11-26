import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const EXCLUDED_PUBLIC_ENTRIES = new Set(["clinical-body-atlas"]);
const WEBP_ATLAS_DIR = "clinical-body-atlas-daz-local";

function generateAtlasWebpVariants(outDir) {
  const atlasDir = join(outDir, WEBP_ATLAS_DIR);
  if (!existsSync(atlasDir)) return [];

  const probe = spawnSync("cwebp", ["-version"], { stdio: "ignore" });
  if (probe.error || probe.status !== 0) return [];

  const generated = [];
  for (const entry of readdirSync(atlasDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".png")) continue;
    const srcPath = join(atlasDir, entry.name);
    const dstPath = `${srcPath}.webp`;
    const res = spawnSync("cwebp", ["-quiet", "-q", "85", "-alpha_q", "100", srcPath, "-o", dstPath], {
      stdio: "ignore",
    });
    if (res.status === 0 && existsSync(dstPath)) {
      generated.push(`${entry.name}.webp`);
    }
  }
  return generated.sort();
}

export function copyProductionPublicAssets({ publicDir, outDir }) {
  mkdirSync(outDir, { recursive: true });
  const copiedEntries = [];
  const excludedEntries = [];

  for (const entry of readdirSync(publicDir, { withFileTypes: true })) {
    if (EXCLUDED_PUBLIC_ENTRIES.has(entry.name)) {
      excludedEntries.push(entry.name);
      continue;
    }
    cpSync(join(publicDir, entry.name), join(outDir, entry.name), {
      recursive: entry.isDirectory(),
      force: true,
    });
    copiedEntries.push(entry.name);
  }

  generateAtlasWebpVariants(outDir);

  return {
    copiedEntries: copiedEntries.sort(),
    excludedEntries: excludedEntries.sort(),
  };
}

export function productionPublicAssetsPlugin({ rootDir, outDir = "dist" }) {
  let buildOutDir = resolve(rootDir, outDir);
  return {
    name: "skindoctor-production-public-assets",
    apply: "build",
    configResolved(config) {
      buildOutDir = resolve(config.root || rootDir, config.build?.outDir || outDir);
    },
    closeBundle() {
      copyProductionPublicAssets({
        publicDir: join(rootDir, "public"),
        outDir: buildOutDir,
      });
    },
  };
}

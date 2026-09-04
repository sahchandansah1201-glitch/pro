import { cpSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const EXCLUDED_PUBLIC_ENTRIES = new Set(["clinical-body-atlas"]);

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

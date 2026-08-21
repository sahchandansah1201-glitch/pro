import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function checkClinicalBodyRegionMaps(directory) {
  const root = resolve(directory);
  const manifest = JSON.parse(await readFile(resolve(root, "manifest.json"), "utf8"));
  const errors = [];

  if (manifest.profiles?.length !== 14) errors.push(`profiles=${manifest.profiles?.length ?? 0}`);
  if (manifest.records?.length !== 56) errors.push(`records=${manifest.records?.length ?? 0}`);
  if (!Array.isArray(manifest.regions) || manifest.regions.length !== 114) {
    errors.push(`regions=${manifest.regions?.length ?? 0}`);
  }
  if (manifest.terminologyStatus !== "technical_review_required") {
    errors.push("terminologyStatus must stay technical_review_required");
  }
  if (manifest.clinicalValidation !== "not_performed") errors.push("clinicalValidation must stay not_performed");
  const expectedCodesByView = new Map();
  for (const region of manifest.regions ?? []) {
    const codes = expectedCodesByView.get(region.view) ?? [];
    codes.push(String(region.code));
    expectedCodesByView.set(region.view, codes);
  }

  for (const record of manifest.records ?? []) {
    if (record.coveragePercent !== 100) errors.push(`${record.profile}/${record.view}: coverage`);
    if (record.coveredPixels !== record.bodyPixels) errors.push(`${record.profile}/${record.view}: uncovered`);
    if (record.backgroundFalsePositives !== 0) errors.push(`${record.profile}/${record.view}: background`);
    if (record.overlapPixels !== 0) errors.push(`${record.profile}/${record.view}: overlap`);
    for (const code of expectedCodesByView.get(record.view) ?? []) {
      if (!record.regionPixelCounts?.[code]) {
        errors.push(`${record.profile}/${record.view}: empty region code ${code}`);
      }
    }
    for (const file of [record.mask, record.hitMap]) {
      try {
        await access(resolve(root, file));
      } catch {
        errors.push(`${record.profile}/${record.view}: missing ${file}`);
      }
    }
    if (record.asset) {
      try {
        const assetBytes = await readFile(resolve(root, record.asset));
        const assetSha256 = createHash("sha256").update(assetBytes).digest("hex");
        if (assetSha256 !== record.sourceSha256) {
          errors.push(`${record.profile}/${record.view}: source asset SHA-256 mismatch`);
        }
      } catch {
        errors.push(`${record.profile}/${record.view}: missing ${record.asset}`);
      }
    }
  }

  if (errors.length) throw new Error(`Clinical body region map check failed: ${errors.join(", ")}`);
  return {
    profiles: manifest.profiles.length,
    views: manifest.records.length,
    regions: manifest.regions.length,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2] ?? "public/clinical-body-atlas-regions";
  const result = await checkClinicalBodyRegionMaps(directory);
  console.log(
    `PASS ${result.profiles}/14 profiles, ${result.views}/56 views, ${result.regions} regions; `
    + "100% silhouette coverage, 0 background, 0 overlap; clinical validation remains open",
  );
}

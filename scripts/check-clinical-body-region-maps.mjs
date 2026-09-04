import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function verifyFileSha256(path, expected, label, errors) {
  try {
    const bytes = await readFile(path);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== expected) errors.push(`${label} SHA-256 mismatch`);
  } catch {
    errors.push(`${label} SHA-256 unavailable`);
  }
}

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
    if (record.sourcePath && isAbsolute(record.sourcePath)) {
      errors.push(`${record.profile}/${record.view}: absolute source path is not allowed`);
    }
    if (record.coveragePercent !== 100) errors.push(`${record.profile}/${record.view}: coverage`);
    if (record.coveredPixels !== record.bodyPixels) errors.push(`${record.profile}/${record.view}: uncovered`);
    if (record.backgroundFalsePositives !== 0) errors.push(`${record.profile}/${record.view}: background`);
    if (record.overlapPixels !== 0) errors.push(`${record.profile}/${record.view}: overlap`);
    for (const code of expectedCodesByView.get(record.view) ?? []) {
      if (!record.regionPixelCounts?.[code]) {
        errors.push(`${record.profile}/${record.view}: empty region code ${code}`);
      }
    }
    const label = `${record.profile}/${record.view}`;
    await verifyFileSha256(resolve(root, record.mask), record.maskSha256, `${label}: mask`, errors);
    await verifyFileSha256(resolve(root, record.hitMap), record.hitMapSha256, `${label}: hit-map`, errors);
    const sourcePath = record.asset
      ? resolve(root, record.asset)
      : record.sourcePath
        ? resolve(record.sourcePath)
        : null;
    await verifyFileSha256(sourcePath, record.sourceSha256, `${label}: source asset`, errors);
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

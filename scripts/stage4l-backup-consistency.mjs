function objectIdentity(item, label) {
  const objectBucket = String(item?.objectBucket || "").trim();
  const objectKey = String(item?.objectKey || "").trim();
  if (!objectBucket || !objectKey || objectBucket.includes("\0") || objectKey.includes("\0")) {
    throw new Error(`${label} must include a safe object bucket and key.`);
  }
  return `${objectBucket}\0${objectKey}`;
}

function uniqueMap(items, label) {
  const result = new Map();
  for (const item of items) {
    const id = objectIdentity(item, label);
    if (result.has(id)) throw new Error(`${label} contains a duplicate object identity.`);
    result.set(id, item);
  }
  return result;
}

export function reconcileClinicalAssets({ assets = [], files = [] } = {}) {
  if (!Array.isArray(assets) || !Array.isArray(files)) {
    throw new Error("cross-store reconciliation requires asset and file arrays.");
  }
  const assetById = uniqueMap(assets, "asset inventory");
  const payloadById = uniqueMap(files.filter((item) => item?.kind === "payload"), "payload inventory");
  const sidecarById = uniqueMap(files.filter((item) => item?.kind === "sidecar"), "sidecar inventory");
  if (payloadById.size + sidecarById.size !== files.length) {
    throw new Error("file inventory contains an unsupported entry kind.");
  }

  let danglingReferenceCount = 0;
  let checksumMismatchCount = 0;
  let byteSizeMismatchCount = 0;
  for (const [id, asset] of assetById) {
    const payload = payloadById.get(id);
    if (!payload) {
      danglingReferenceCount += 1;
      continue;
    }
    if (asset.checksumSha256 != null && asset.checksumSha256 !== payload.checksumSha256) {
      checksumMismatchCount += 1;
    }
    if (asset.byteSize != null && Number(asset.byteSize) !== Number(payload.byteSize)) {
      byteSizeMismatchCount += 1;
    }
  }

  let orphanPayloadCount = 0;
  for (const id of payloadById.keys()) {
    if (!assetById.has(id)) orphanPayloadCount += 1;
  }

  const pairingDefects = new Set();
  for (const id of payloadById.keys()) {
    if (!sidecarById.has(id)) pairingDefects.add(id);
  }
  for (const id of sidecarById.keys()) {
    if (!payloadById.has(id)) pairingDefects.add(id);
  }

  return {
    danglingReferenceCount,
    orphanPayloadCount,
    payloadSidecarDefectCount: pairingDefects.size,
    checksumMismatchCount,
    byteSizeMismatchCount,
  };
}

export function assertReconciliationClean(result = {}) {
  const fields = [
    "danglingReferenceCount",
    "orphanPayloadCount",
    "payloadSidecarDefectCount",
    "checksumMismatchCount",
    "byteSizeMismatchCount",
  ];
  for (const field of fields) {
    if (!Number.isInteger(result[field]) || result[field] < 0) {
      throw new Error(`cross-store reconciliation returned an invalid ${field}.`);
    }
  }
  const defects = fields.filter((field) => result[field] !== 0);
  if (defects.length > 0) {
    throw new Error(`cross-store reconciliation failed: ${defects.join(", ")}.`);
  }
  return result;
}

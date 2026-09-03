function parseJsonArray(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseObjectArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === "object");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeSummary(value) {
  const source = parseJsonObject(value);
  return {
    visitCount: numberOrZero(source.visitCount),
    imageCount: numberOrZero(source.imageCount),
    candidatePairCount: numberOrZero(source.candidatePairCount),
    comparablePairCount: numberOrZero(source.comparablePairCount),
    warningPairCount: numberOrZero(source.warningPairCount),
    blockedPairCount: numberOrZero(source.blockedPairCount),
    assessmentCount: numberOrZero(source.assessmentCount),
  };
}

function normalizeVisit(row) {
  return {
    visitId: String(row.visitId ?? ""),
    startedAt: row.startedAt ?? null,
    signedAt: row.signedAt ?? null,
    status: String(row.status ?? "draft"),
    imageCount: numberOrZero(row.imageCount),
    dermoscopyCount: numberOrZero(row.dermoscopyCount),
    overviewCount: numberOrZero(row.overviewCount),
    assessmentCount: numberOrZero(row.assessmentCount),
    capturedAtFirst: row.capturedAtFirst ?? null,
    capturedAtLast: row.capturedAtLast ?? null,
  };
}

function normalizeImage(row) {
  return {
    id: String(row.id ?? ""),
    visitId: String(row.visitId ?? ""),
    kind: String(row.kind ?? ""),
    capturedAt: row.capturedAt ?? null,
  };
}

function normalizePair(row) {
  const status = String(row.status ?? "blocked");
  return {
    previousVisitId: String(row.previousVisitId ?? ""),
    currentVisitId: String(row.currentVisitId ?? ""),
    previousImageId: String(row.previousImageId ?? ""),
    currentImageId: String(row.currentImageId ?? ""),
    kind: String(row.kind ?? ""),
    status: status === "ready" || status === "warning" ? status : "blocked",
    reasons: parseJsonArray(row.reasons),
  };
}

export function normalizeLesionLongitudinalHistory(row) {
  return {
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    lesionId: String(row.lesionId ?? ""),
    label: row.label ?? null,
    bodyZone: row.bodyZone ?? null,
    bodySurface: row.bodySurface ?? null,
    status: String(row.status ?? "active"),
    summary: normalizeSummary(row.summary),
    visits: parseObjectArray(row.visits).map(normalizeVisit),
    images: parseObjectArray(row.images).map(normalizeImage),
    candidatePairs: parseObjectArray(row.candidatePairs).map(normalizePair),
    boundaries: {
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
      doctorOnlyTextExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

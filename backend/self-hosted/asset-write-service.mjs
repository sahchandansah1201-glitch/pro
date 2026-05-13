// Stage 4I · Self-hosted clinical asset write service.
// Registers asset metadata, enforces visit RBAC, and issues backend-owned
// download URLs without exposing object bucket/key to the browser.

import { randomUUID } from "node:crypto";

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { visitReadScope, visitWriteScope } from "./rbac.mjs";
import {
  assertUuid,
  VisitWorkspaceNotFoundError,
  VisitWorkspaceValidationError,
} from "./visit-workspace-write-service.mjs";

const ASSET_KIND_VALUES = new Set(["overview_photo", "dermoscopy", "report_attachment"]);
const KIND_ALIASES = {
  overview: "overview_photo",
  macro: "overview_photo",
  body_map: "overview_photo",
  overview_photo: "overview_photo",
  dermoscopy: "dermoscopy",
  report_attachment: "report_attachment",
};
const IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const REPORT_CONTENT_TYPES = new Set(["application/pdf"]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_REPORT_BYTES = 50 * 1024 * 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  if (value == null) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

function normalizeKind(value) {
  const raw = cleanString(value) || "overview_photo";
  return KIND_ALIASES[raw] || raw;
}

function extensionForContentType(contentType, fileName = "") {
  const nameExt = String(fileName || "").toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
  if (nameExt && /^[a-z0-9]+$/.test(nameExt)) return nameExt;
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/heic") return "heic";
  if (contentType === "image/heif") return "heif";
  if (contentType === "application/pdf") return "pdf";
  return "bin";
}

function normalizeCapturedAt(value, details) {
  const raw = cleanString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    details.push({ field: "capturedAt", message: "capturedAt must be an ISO date-time." });
    return null;
  }
  return parsed.toISOString();
}

function positiveByteSize(value, details) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    details.push({ field: "byteSize", message: "byteSize must be a non-negative integer." });
    return null;
  }
  return parsed;
}

function validateContentType(kind, contentType, byteSize, details) {
  if (kind === "report_attachment") {
    if (!REPORT_CONTENT_TYPES.has(contentType)) {
      details.push({ field: "contentType", message: "report_attachment requires application/pdf." });
    }
    if (byteSize != null && byteSize > MAX_REPORT_BYTES) {
      details.push({ field: "byteSize", message: "report_attachment is limited to 50 MB." });
    }
    return;
  }
  if (!IMAGE_CONTENT_TYPES.has(contentType)) {
    details.push({ field: "contentType", message: "Image assets require JPEG, PNG, WebP, HEIC, or HEIF." });
  }
  if (byteSize != null && byteSize > MAX_IMAGE_BYTES) {
    details.push({ field: "byteSize", message: "Image assets are limited to 25 MB." });
  }
}

export function normalizeCreateAssetPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  const kind = normalizeKind(input.kind);
  if (!ASSET_KIND_VALUES.has(kind)) {
    details.push({ field: "kind", message: "kind must be overview_photo, dermoscopy, or report_attachment." });
  }
  const contentType = cleanString(input.contentType)?.toLowerCase() || "";
  if (!contentType) details.push({ field: "contentType", message: "contentType is required." });
  const byteSize = positiveByteSize(input.byteSize, details);
  const capturedAt = normalizeCapturedAt(input.capturedAt, details);
  const checksumSha256 = cleanString(input.checksumSha256);
  if (checksumSha256 && !SHA256_PATTERN.test(checksumSha256)) {
    details.push({ field: "checksumSha256", message: "checksumSha256 must be a 64-character hex digest." });
  }
  const lesionId = cleanString(input.lesionId);
  if (lesionId) assertUuid(lesionId, "lesionId");
  if (contentType) validateContentType(kind, contentType, byteSize, details);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    kind,
    contentType,
    byteSize,
    capturedAt,
    checksumSha256: checksumSha256 ? checksumSha256.toLowerCase() : null,
    lesionId,
    originalFileName: cleanString(input.originalFileName),
  };
}

export function normalizeDownloadUrlParams(searchParams = new URLSearchParams()) {
  const raw = Number.parseInt(String(searchParams.get("expiresIn") || "300"), 10);
  if (!Number.isFinite(raw)) return 300;
  return Math.min(900, Math.max(60, raw));
}

export function buildObjectKey({
  clinicId,
  patientId,
  visitId,
  contentType,
  originalFileName,
  now = () => new Date().toISOString(),
  uuid = randomUUID,
}) {
  const stamp = now().replace(/[-:.TZ]/g, "").slice(0, 14);
  const ext = extensionForContentType(contentType, originalFileName);
  return [
    "clinics",
    clinicId,
    "patients",
    patientId,
    "visits",
    visitId,
    `${stamp}-${uuid()}.${ext}`,
  ].join("/");
}

function ensureLesionBelongsToVisit(lesions, lesionId) {
  if (!lesionId) return;
  if (!lesions.some((lesion) => lesion.id === lesionId)) {
    throw new VisitWorkspaceNotFoundError("Lesion was not found in the allowed visit scope.");
  }
}

export function createAssetWriteService({
  config,
  visitWorkspaceRepository,
  assetWriteRepository,
  auditRepository,
  now = () => new Date().toISOString(),
  uuid = randomUUID,
} = {}) {
  return {
    async createVisitAsset(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeCreateAssetPayload(input);
      const visit = await visitWorkspaceRepository.getVisit({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!visit) throw new VisitWorkspaceNotFoundError("Visit was not found in the allowed clinic scope.");
      if (payload.lesionId) {
        const lesions = await visitWorkspaceRepository.listVisitLesions({
          visitId: safeVisitId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
        ensureLesionBelongsToVisit(lesions, payload.lesionId);
      }
      const objectBucket = config?.objectStorageBucket || "clinical-assets";
      const objectKey = buildObjectKey({
        clinicId: visit.clinic.id,
        patientId: visit.patient.id,
        visitId: safeVisitId,
        contentType: payload.contentType,
        originalFileName: payload.originalFileName,
        now,
        uuid,
      });
      const asset = await assetWriteRepository.createVisitAsset({
        clinicId: visit.clinic.id,
        patientId: visit.patient.id,
        visitId: safeVisitId,
        lesionId: payload.lesionId,
        kind: payload.kind,
        objectBucket,
        objectKey,
        contentType: payload.contentType,
        byteSize: payload.byteSize,
        checksumSha256: payload.checksumSha256,
        capturedAt: payload.capturedAt,
        uploadedBy: authContext.userId,
      });
      if (!asset) throw new VisitWorkspaceNotFoundError("Asset metadata could not be registered.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: asset.clinicId,
        actorUserId: authContext.userId,
        action: "asset.create",
        entityType: "clinical_asset",
        entityId: asset.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          kind: asset.kind,
          contentType: asset.contentType,
          byteSize: asset.byteSize,
          hasChecksum: Boolean(payload.checksumSha256),
        },
      });
      return { asset, scope };
    },

    async getAssetDownloadUrl(assetId, authContext, { correlationId, expiresIn = 300 } = {}) {
      const safeAssetId = assertUuid(assetId, "assetId");
      const scope = visitReadScope(authContext);
      const asset = await assetWriteRepository.getAssetInternal({
        assetId: safeAssetId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!asset) throw new VisitWorkspaceNotFoundError("Asset was not found in the allowed clinic scope.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: asset.clinicId,
        actorUserId: authContext.userId,
        action: "asset.download_url",
        entityType: "clinical_asset",
        entityId: asset.id,
        correlationId,
        metadata: {
          visitId: asset.visitId,
          expiresIn,
          objectStorageBacked: Boolean(asset.objectBucket && asset.objectKey),
        },
      });
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
      return {
        asset: {
          id: asset.id,
          clinicId: asset.clinicId,
          patientId: asset.patientId,
          visitId: asset.visitId,
          lesionId: asset.lesionId,
          kind: asset.kind,
          contentType: asset.contentType,
          byteSize: asset.byteSize,
          capturedAt: asset.capturedAt,
          uploadedBy: asset.uploadedBy,
          createdAt: asset.createdAt,
        },
        download: {
          assetId: asset.id,
          clinicId: asset.clinicId,
          visitId: asset.visitId,
          downloadUrl: `/api/v1/assets/${asset.id}/download`,
          expiresIn,
          expiresAt,
        },
        scope,
      };
    },
  };
}

// Batch T · Patient photo/protocol secure backend proxy.
// Streams bytes only after patient identity, release, expiry/retention, consent,
// and explicit backend proxy enablement gates pass. It never returns storage
// paths, signed URLs, access tokens, or object identifiers to the browser.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { patientPortalScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class PatientPhotoProtocolProxyError extends Error {
  constructor({ code, status, message }) {
    super(message);
    this.name = "PatientPhotoProtocolProxyError";
    this.publicCode = code;
    this.publicStatus = status;
  }
}

function assertUuid(value, field = "id") {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) {
    const error = new Error(`${field} must be a valid UUID.`);
    error.publicCode = "invalid_uuid";
    error.publicStatus = 400;
    throw error;
  }
  return text;
}

function assertSequence(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 200) {
    const error = new Error("sequence must be an integer from 1 to 200.");
    error.publicCode = "invalid_sequence";
    error.publicStatus = 400;
    throw error;
  }
  return parsed;
}

function extensionForContentType(contentType) {
  const text = String(contentType || "").toLowerCase();
  if (text.includes("png")) return "png";
  if (text.includes("webp")) return "webp";
  if (text.includes("heic")) return "heic";
  if (text.includes("heif")) return "heif";
  if (text.includes("jpeg") || text.includes("jpg")) return "jpg";
  return "bin";
}

function publicError(code, status, message = "Photo protocol delivery is unavailable.") {
  return new PatientPhotoProtocolProxyError({ code, status, message });
}

async function auditProxyEvent(auditRepository, candidate, scope, {
  action,
  correlationId,
  reason = null,
  sequence,
} = {}) {
  await recordAuditBestEffort(auditRepository, {
    clinicId: candidate?.release?.clinicId || null,
    actorUserId: scope.userId,
    action,
    entityType: "patient_photo_protocol_release",
    entityId: candidate?.release?.id || null,
    correlationId,
    metadata: {
      visitId: candidate?.release?.visitId || null,
      assetId: candidate?.asset?.id || null,
      sequence,
      reason,
      deliveryMode: "backend_proxy",
      signedUrlsIssued: false,
      storagePathsExposed: false,
      tokensExposed: false,
      doctorOnlyTextExposed: false,
    },
  });
}

export function createPatientPhotoProtocolDeliveryService({
  patientPhotoProtocolDeliveryRepository,
  objectStore,
  auditRepository,
  now = () => new Date(),
} = {}) {
  return {
    async downloadPhoto({ visitId, sequence } = {}, authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const safeVisitId = assertUuid(visitId, "visitId");
      const safeSequence = assertSequence(sequence);
      const candidate = await patientPhotoProtocolDeliveryRepository.getDeliveryAsset({
        userId: scope.userId,
        visitId: safeVisitId,
        sequence: safeSequence,
      });
      if (!candidate) {
        throw publicError("photo_protocol_not_found", 404, "Photo protocol was not found.");
      }
      async function deny(code, status, reason) {
        await auditProxyEvent(auditRepository, candidate, scope, {
          action: "patient_portal.photo_protocol.proxy.denied",
          correlationId,
          reason,
          sequence: safeSequence,
        });
        throw publicError(code, status);
      }
      if (candidate.release.status === "revoked") {
        await deny("photo_protocol_revoked", 410, "revoked");
      }
      if (candidate.release.status !== "prepared") {
        await deny("photo_protocol_not_prepared", 423, "not_prepared");
      }
      if (!candidate.release.fileProxyEnabled) {
        await deny("photo_protocol_proxy_disabled", 423, "proxy_disabled");
      }
      if (!candidate.release.imagingConsent) {
        await deny("photo_protocol_consent_missing", 423, "consent_missing");
      }
      if (!candidate.release.expiresAt) {
        await deny("photo_protocol_retention_required", 423, "retention_required");
      }
      if (new Date(candidate.release.expiresAt).getTime() <= new Date(now()).getTime()) {
        await deny("photo_protocol_expired", 410, "expired");
      }
      if (!candidate.asset.id || !candidate.asset.objectBucket || !candidate.asset.objectKey) {
        await deny("photo_protocol_photo_not_found", 404, "photo_not_found");
      }
      if (!objectStore?.getObject) {
        await deny("photo_protocol_object_store_unavailable", 503, "object_store_unavailable");
      }
      let stored;
      try {
        stored = await objectStore.getObject({
          bucket: candidate.asset.objectBucket,
          key: candidate.asset.objectKey,
        });
      } catch {
        await deny("photo_protocol_binary_not_found", 404, "binary_not_found");
      }
      await auditProxyEvent(auditRepository, candidate, scope, {
        action: "patient_portal.photo_protocol.proxy.download",
        correlationId,
        sequence: safeSequence,
      });
      const contentType = stored.contentType || candidate.asset.contentType || "application/octet-stream";
      return {
        asset: {
          id: candidate.asset.id,
          sequence: candidate.asset.sequence,
          kind: candidate.asset.kind,
          contentType,
          byteSize: stored.byteSize ?? candidate.asset.byteSize,
          capturedAt: candidate.asset.capturedAt,
        },
        object: {
          bytes: stored.bytes,
          byteSize: stored.byteSize,
          contentType,
        },
        download: {
          fileName: `photo-protocol-${safeSequence}.${extensionForContentType(contentType)}`,
        },
        scope,
      };
    },
  };
}

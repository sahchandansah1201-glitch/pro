import { describe, expect, it, vi } from "vitest";

import {
  clinicalReportMissingLabel,
  executeSelfHostedPatientPhotoProtocolGovernanceBlockMissingExpiry,
  executeSelfHostedPatientPhotoProtocolGovernanceBlockUnapprovedRetention,
  executeSelfHostedPatientPhotoProtocolGovernanceBlockUnsafeSessionArtifacts,
  executeSelfHostedPatientPhotoProtocolGovernanceRevokeExpired,
  getSelfHostedPatientPhotoProtocolReleaseAudit,
  getSelfHostedPatientPhotoProtocolReleaseGovernance,
  getSelfHostedClinicalReportPackage,
  reviewSelfHostedPatientPhotoProtocolReleasePolicy,
  toSelfHostedPatientPhotoProtocolGovernanceOperationResult,
  toSelfHostedPatientPhotoProtocolReleaseAudit,
  toSelfHostedPatientPhotoProtocolReleaseGovernance,
  toSelfHostedClinicalReportPackage,
} from "@/lib/self-hosted-clinical-report-package-api";

describe("self-hosted-clinical-report-package-api", () => {
  it("returns not_configured without bearer token", async () => {
    const result = await getSelfHostedClinicalReportPackage({
      apiBaseUrl: "http://localhost:3001",
      apiToken: null,
      visitId: "visit-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });

  it("maps readiness package and uses only self-hosted backend route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            visitId: "visit-1",
            assessment: { status: "ready", abcdTotal: "3.4", summaryPresent: true },
            conclusion: { status: "signed", summaryPresent: true },
            report: {
              status: "signed",
              physicianTextPresent: true,
              patientSafeTextPresent: true,
            },
            counts: { lesions: 2, assets: 3 },
            readiness: {
              ready: true,
              status: "ready",
              completionPercent: 100,
              missing: [],
              exportAllowed: true,
              patientDeliveryAllowed: true,
            },
            patientPhotoProtocol: {
              brainstormTask: "SD-MF-046",
              status: "metadata_ready_backend_blocked",
              readyForBackendContract: true,
              selectedPhotoCount: 2,
              counts: {
                selectedPhotos: 2,
                overviewPhotos: 1,
                dermoscopyPhotos: 1,
                reportAttachments: 0,
              },
              missing: ["self_hosted_photo_delivery_contract_missing"],
              deliveryBoundary: {
                patientDeliveryAllowed: false,
                rawFilesExposed: false,
                signedUrlsIssued: false,
                storagePathsExposed: false,
                tokensExposed: false,
                physicianTextExposed: false,
                fileProxyReady: true,
                requiresSelfHostedFileProxy: true,
                requiresReleaseAudit: true,
                requiresRevoke: true,
                requiresIdentityCheck: true,
                requiresRetentionPolicy: false,
                requiresApprovedPatientCopy: false,
              },
              policy: {
                releasePrepared: true,
                patientFileProxyEnabled: true,
                patientCopyApproved: true,
                retentionPolicyApproved: true,
                expiresAt: "2026-06-10T10:00:00.000Z",
              },
            },
            productBoundary: {
              managedRuntimeDependency: "none",
              managedDatabaseDependency: "none",
              externalRuntimeCalls: false,
              rawPatientDataInReport: false,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await getSelfHostedClinicalReportPackage({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value?.readiness.status).toBe("ready");
    expect(result.value?.assessment.abcdTotal).toBe(3.4);
    expect(result.value?.patientPhotoProtocol.status).toBe("metadata_ready_backend_blocked");
    expect(result.value?.patientPhotoProtocol.selectedPhotoCount).toBe(2);
    expect(result.value?.patientPhotoProtocol.deliveryBoundary.patientDeliveryAllowed).toBe(false);
    expect(result.value?.patientPhotoProtocol.deliveryBoundary.fileProxyReady).toBe(true);
    expect(result.value?.patientPhotoProtocol.deliveryBoundary.requiresRetentionPolicy).toBe(false);
    expect(result.value?.patientPhotoProtocol.deliveryBoundary.requiresApprovedPatientCopy).toBe(false);
    expect(result.value?.patientPhotoProtocol.policy.patientCopyApproved).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/report-package",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
  });

  it("normalizes missing keys and labels without exposing raw values", () => {
    const dto = toSelfHostedClinicalReportPackage({
      visitId: "visit-1",
      readiness: {
        status: "blocked",
        missing: ["patient_safe_text_missing"],
      },
    });
    expect(dto.readiness.missing).toEqual(["patient_safe_text_missing"]);
    expect(clinicalReportMissingLabel("patient_safe_text_missing")).toBe("нет patient-safe текста");
    expect(clinicalReportMissingLabel("self_hosted_photo_delivery_contract_missing")).toBe(
      "нет backend-контракта выдачи фото",
    );
  });

  it("normalizes staff audit review without protected audit internals", () => {
    const audit = toSelfHostedPatientPhotoProtocolReleaseAudit({
      releaseId: "release-1",
      visitId: "visit-1",
      status: "revoked",
      summary: {
        eventCount: 2,
        preparedEvents: 1,
        policyReviewEvents: 1,
        revokedEvents: 1,
        patientReadEvents: 0,
        proxyDownloadEvents: 0,
        proxyDeniedEvents: 0,
      },
      events: [
        {
          kind: "release_prepared",
          label: "Подготовка выдачи",
          occurredAt: "2026-05-31T09:30:00.000Z",
          actorType: "staff",
          reasonPresent: false,
          correlationId: "hidden",
          actorUserId: "hidden",
          rawPayload: { unsafe: true },
        },
        {
          kind: "release_revoked",
          label: "Отзыв выдачи",
          occurredAt: "2026-05-31T09:35:00.000Z",
          actorType: "staff",
          reasonPresent: true,
          revokeReason: "hidden",
        },
      ],
      boundaries: {
        immutableLedger: true,
        rawPayloadExposed: false,
        revokeReasonExposed: false,
        actorIdsExposed: false,
        correlationIdsExposed: false,
      },
    });

    expect(audit.status).toBe("revoked");
    expect(audit.summary.eventCount).toBe(2);
    expect(audit.summary.policyReviewEvents).toBe(1);
    expect(audit.events[0].label).toBe("Подготовка выдачи");
    expect(audit.events[1].reasonPresent).toBe(true);
    expect(audit.boundaries.immutableLedger).toBe(true);
    expect(audit.events[0]).not.toHaveProperty("correlationId");
    expect(audit.events[0]).not.toHaveProperty("actorUserId");
    expect(audit.events[0]).not.toHaveProperty("rawPayload");
    expect(audit.events[1]).not.toHaveProperty("revokeReason");
  });

  it("fetches staff audit review from the self-hosted visit route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            visitId: "visit-1",
            status: "prepared",
            summary: { eventCount: 1, preparedEvents: 1, policyReviewEvents: 0 },
            events: [{ kind: "release_prepared", label: "Подготовка выдачи" }],
            boundaries: { immutableLedger: true },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await getSelfHostedPatientPhotoProtocolReleaseAudit({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value?.boundaries.immutableLedger).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/patient-photo-protocol-release/audit",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
  });

  it("posts policy-governance updates through the self-hosted release route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            id: "release-1",
            status: "prepared",
            deliveryBoundary: { patientDeliveryAllowed: false },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await reviewSelfHostedPatientPhotoProtocolReleasePolicy({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        expiresAt: "2026-06-10T10:00:00.000Z",
        patientFileProxyEnabled: true,
        patientCopyApproved: true,
        retentionPolicyApproved: true,
      },
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/patient-photo-protocol-release/policy",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
  });

  it("normalizes aggregate release governance without protected identifiers", () => {
    const governance = toSelfHostedPatientPhotoProtocolReleaseGovernance({
      summary: {
        releasesTotal: "4",
        prepared: 2,
        blocked: 1,
        revoked: 1,
        retentionMissing: 2,
        patientCopyMissing: 1,
        fileProxyMissing: 2,
        expiryMissing: 1,
        activeAccessWindows: 1,
        expiringIn24h: 1,
      },
      queue: [
        {
          queueNumber: "1",
          status: "prepared",
          policyStatus: "patient_copy_required",
          selectedPhotoCount: "3",
          blockerCount: "1",
          expiresAt: "2026-06-01T10:00:00.000Z",
          updatedAt: "2026-05-31T10:00:00.000Z",
          attention: ["patient_copy_required"],
          patientId: "hidden",
          visitId: "hidden",
          storagePath: "hidden",
          accessToken: "hidden",
        },
      ],
      operations: {
        retention: {
          reviewDue: "2",
          ready: 1,
          blocked: 1,
          requiresClinicSignoff: true,
          nextAction: "review_retention_policy",
        },
        revokeReadiness: {
          activeWindows: 1,
          expiringIn24h: 1,
          revoked: 1,
          canPrepareRevokeReview: 1,
          requiresManualReason: false,
          revokeReasonExposed: true,
        },
        sessionLifecycle: {
          active: 1,
          expiringIn24h: 1,
          missingExpiry: 1,
          revoked: 1,
          temporaryCredentialsExposed: true,
          qrTokensExposed: true,
          sessionIdsExposed: true,
        },
        allowedOperations: ["review_retention_policy", "prepare_revoke_review"],
        blockedOperations: ["block_secret_issue", "block_external_link_issue"],
      },
      boundaries: {
        metadataOnly: true,
        patientNamesExposed: true,
        rawIdentifiersExposed: true,
        rawTokensExposed: true,
        storagePathsExposed: true,
        signedUrlsIssued: true,
        doctorOnlyTextExposed: true,
      },
    });
    expect(governance.summary.releasesTotal).toBe(4);
    expect(governance.queue[0].policyStatus).toBe("patient_copy_required");
    expect(governance.operations.retention.reviewDue).toBe(2);
    expect(governance.operations.retention.nextAction).toBe("review_retention_policy");
    expect(governance.operations.revokeReadiness.canPrepareRevokeReview).toBe(1);
    expect(governance.operations.revokeReadiness.revokeReasonExposed).toBe(false);
    expect(governance.operations.sessionLifecycle.sessionIdsExposed).toBe(false);
    expect(governance.operations.sessionLifecycle.qrTokensExposed).toBe(false);
    expect(governance.operations.allowedOperations).toEqual(["review_retention_policy", "prepare_revoke_review"]);
    expect(governance.queue[0]).not.toHaveProperty("patientId");
    expect(governance.queue[0]).not.toHaveProperty("visitId");
    expect(governance.queue[0]).not.toHaveProperty("storagePath");
    expect(governance.boundaries.metadataOnly).toBe(true);
    expect(governance.boundaries.patientNamesExposed).toBe(false);
    expect(governance.boundaries.rawIdentifiersExposed).toBe(false);
    expect(governance.boundaries.rawTokensExposed).toBe(false);
  });

  it("fetches aggregate release governance from the self-hosted admin route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            summary: { releasesTotal: 1, prepared: 1 },
            queue: [{ queueNumber: 1, status: "prepared", policyStatus: "ready_for_access_window" }],
            operations: {
              retention: { reviewDue: 0, ready: 1 },
              revokeReadiness: { canPrepareRevokeReview: 1 },
              sessionLifecycle: { active: 1, sessionIdsExposed: false },
            },
            boundaries: { metadataOnly: true },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await getSelfHostedPatientPhotoProtocolReleaseGovernance({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
    });
    expect(result.ok).toBe(true);
    expect(result.value?.summary.releasesTotal).toBe(1);
    expect(result.value?.queue[0].policyStatus).toBe("ready_for_access_window");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patient-photo-protocol-release/governance",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
  });

  it("normalizes governance revoke execution as aggregate-only lifecycle result", () => {
    const operation = toSelfHostedPatientPhotoProtocolGovernanceOperationResult({
      operation: "revoke_expired_access_windows",
      status: "executed",
      affectedCount: "2",
      skippedActiveCount: 3,
      expiringIn24hCount: 1,
      skippedMissingExpiryCount: 4,
      limit: 50,
      auditAction: "patient_photo_protocol.release_governance.revoke_expired",
      patientId: "hidden",
      visitId: "hidden",
      releaseId: "hidden",
      revokeReason: "hidden",
      boundaries: {
        metadataOnly: false,
        patientRowsExposed: true,
        rawIdentifiersExposed: true,
        revokeReasonExposed: true,
        temporaryCredentialsExposed: true,
        qrTokensExposed: true,
        sessionIdsExposed: true,
        storagePathsExposed: true,
        signedUrlsIssued: true,
        patientDeliveryAllowed: true,
      },
    });
    expect(operation.affectedCount).toBe(2);
    expect(operation.skippedMissingExpiryCount).toBe(4);
    expect(operation.boundaries.metadataOnly).toBe(true);
    expect(operation.boundaries.patientRowsExposed).toBe(false);
    expect(operation.boundaries.rawIdentifiersExposed).toBe(false);
    expect(operation.boundaries.revokeReasonExposed).toBe(false);
    expect(operation.boundaries.temporaryCredentialsExposed).toBe(false);
    expect(operation.boundaries.qrTokensExposed).toBe(false);
    expect(operation.boundaries.sessionIdsExposed).toBe(false);
    expect(operation).not.toHaveProperty("patientId");
    expect(operation).not.toHaveProperty("visitId");
    expect(operation).not.toHaveProperty("releaseId");
    expect(operation).not.toHaveProperty("revokeReason");
  });

  it("executes expired access-window revoke through the self-hosted governance route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            operation: "revoke_expired_access_windows",
            status: "executed",
            affectedCount: 2,
            skippedActiveCount: 3,
            expiringIn24hCount: 1,
            skippedMissingExpiryCount: 4,
            limit: 50,
            boundaries: { metadataOnly: true, revokeReasonExposed: false },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceRevokeExpired({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      payload: { confirm: true, limit: 50 },
    });
    expect(result.ok).toBe(true);
    expect(result.value?.operation).toBe("revoke_expired_access_windows");
    expect(result.value?.affectedCount).toBe(2);
    expect(result.value?.boundaries.revokeReasonExposed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patient-photo-protocol-release/governance/revoke-expired",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
        body: JSON.stringify({ confirm: true, limit: 50 }),
      }),
    );
  });

  it("executes missing-expiry session blocking through the self-hosted governance route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            operation: "block_missing_expiry_access_windows",
            status: "executed",
            affectedCount: 4,
            skippedActiveCount: 2,
            expiringIn24hCount: 1,
            skippedMissingExpiryCount: 0,
            limit: 20,
            auditAction: "patient_photo_protocol.release_governance.block_missing_expiry",
            boundaries: {
              metadataOnly: true,
              temporaryCredentialsExposed: false,
              qrTokensExposed: false,
              sessionIdsExposed: false,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceBlockMissingExpiry({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      payload: { confirm: true, limit: 20 },
    });
    expect(result.ok).toBe(true);
    expect(result.value?.operation).toBe("block_missing_expiry_access_windows");
    expect(result.value?.affectedCount).toBe(4);
    expect(result.value?.boundaries.sessionIdsExposed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patient-photo-protocol-release/governance/block-missing-expiry",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
        body: JSON.stringify({ confirm: true, limit: 20 }),
      }),
    );
  });

  it("executes unapproved-retention blocking through the self-hosted governance route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            operation: "block_unapproved_retention_windows",
            status: "executed",
            affectedCount: 3,
            skippedActiveCount: 2,
            expiringIn24hCount: 1,
            skippedMissingExpiryCount: 0,
            limit: 15,
            auditAction: "patient_photo_protocol.release_governance.block_unapproved_retention",
            boundaries: {
              metadataOnly: true,
              patientDeliveryAllowed: false,
              temporaryCredentialsExposed: false,
              qrTokensExposed: false,
              sessionIdsExposed: false,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceBlockUnapprovedRetention({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      payload: { confirm: true, limit: 15 },
    });
    expect(result.ok).toBe(true);
    expect(result.value?.operation).toBe("block_unapproved_retention_windows");
    expect(result.value?.affectedCount).toBe(3);
    expect(result.value?.boundaries.patientDeliveryAllowed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patient-photo-protocol-release/governance/block-unapproved-retention",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
        body: JSON.stringify({ confirm: true, limit: 15 }),
      }),
    );
  });

  it("executes unsafe session artifact blocking through the self-hosted governance route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            operation: "block_unsafe_session_artifacts",
            status: "executed",
            affectedCount: 5,
            skippedActiveCount: 2,
            expiringIn24hCount: 1,
            skippedMissingExpiryCount: 0,
            limit: 12,
            auditAction: "patient_photo_protocol.release_governance.block_unsafe_session_artifacts",
            boundaries: {
              metadataOnly: true,
              patientDeliveryAllowed: false,
              temporaryCredentialsExposed: false,
              qrTokensExposed: false,
              sessionIdsExposed: false,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceBlockUnsafeSessionArtifacts({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      payload: { confirm: true, limit: 12 },
    });
    expect(result.ok).toBe(true);
    expect(result.value?.operation).toBe("block_unsafe_session_artifacts");
    expect(result.value?.affectedCount).toBe(5);
    expect(result.value?.boundaries.temporaryCredentialsExposed).toBe(false);
    expect(result.value?.boundaries.qrTokensExposed).toBe(false);
    expect(result.value?.boundaries.sessionIdsExposed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patient-photo-protocol-release/governance/block-unsafe-session-artifacts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
        body: JSON.stringify({ confirm: true, limit: 12 }),
      }),
    );
  });
});

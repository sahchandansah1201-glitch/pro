import { describe, expect, it, vi } from "vitest";

import {
  clinicalReportMissingLabel,
  getSelfHostedPatientPhotoProtocolReleaseAudit,
  getSelfHostedPatientPhotoProtocolReleaseGovernance,
  getSelfHostedClinicalReportPackage,
  reviewSelfHostedPatientPhotoProtocolReleasePolicy,
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
});

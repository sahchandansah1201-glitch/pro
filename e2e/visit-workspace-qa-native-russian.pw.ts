import { test, expect, type Page, type Route } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.skip(
  process.env.E2E_SELF_HOSTED_VISIT_QA !== "1",
  "Set E2E_SELF_HOSTED_VISIT_QA=1 and run a VITE_APP_MODE=production dev server to verify self-hosted visit QA.",
);

const APP_BASE_URL = process.env.E2E_APP_BASE_URL ?? "http://localhost:8080";
const API_BASE_URL = "http://localhost:19081";
const ROUTE = "/patients/live-patient/visits/live-visit?tab=report&lesion=live-lesion";

const SELF_HOSTED_API_BASE_URL_KEY = "derma-pro:self-hosted-api-base-url";
const SELF_HOSTED_API_TOKEN_KEY = "derma-pro:self-hosted-api-token";
const SELF_HOSTED_API_USER_KEY = "derma-pro:self-hosted-api-user";

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const FORBIDDEN_VISIBLE =
  /timeline QA|rollout|workflow|policy|evidence|governance|monitoring|validation|metadata|backend|self-hosted|production|Device Bridge|Protected|Reviewer|Dataset|Sample|Window|Owner|Blockers|File proxy|Release ledger|Patient copy|Retention|Review|Assign|Second|Analysis|Assets|Device|Protocol|raw ID|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i;

const json = (body: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

function baseTimelineReview(kind: string, status = "not_started") {
  return {
    id: `${kind}-1`,
    clinicId: "clinic-1",
    patientId: "live-patient",
    visitId: "live-visit",
    status,
    reasons: [],
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringStatus: "not_started",
    clinicalValidationStatus: "not_started",
    incidentProcedureStatus: "not_started",
    postValidationMonitoringStatus: "not_started",
    observationGovernanceStatus: "not_started",
    exceptionGovernanceStatus: "not_started",
    outcomeGovernanceStatus: "not_started",
    longitudinalClinicalValidationStatus: "not_started",
    protectedReviewerValidationStatus: "not_started",
    protectedReviewerGovernanceStatus: "not_started",
    protectedReviewerEvidenceStatus: "not_started",
    productionDatasetEvidenceStatus: "not_started",
    productionReviewerGovernanceStatus: "not_started",
    lesionCount: 2,
    readyTimelineCount: 1,
    needsReviewTimelineCount: 0,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    reviewedAt: "2026-06-04T00:00:00.000Z",
    createdAt: "2026-06-04T00:00:00.000Z",
    updatedAt: "2026-06-04T00:00:00.000Z",
  };
}

function longitudinalValidationResponse() {
  const checklist = {
    datasetValidationStatus: "needs_review",
    reviewerOperationsStatus: "needs_review",
    rollbackPlanStatus: "needs_review",
    monitoringPlanStatus: "needs_review",
    rolloutWindowStatus: "needs_review",
    ownerAckStatus: "needs_review",
    monitoringEvidenceStatus: "needs_review",
    sampleAuditStatus: "needs_review",
    exceptionLogStatus: "needs_review",
    rollbackDrillStatus: "needs_review",
    ownerSignoffStatus: "needs_review",
    outcomeSamplingStatus: "needs_review",
    incidentReviewStatus: "needs_review",
    exceptionClosureStatus: "needs_review",
    rollbackOutcomeStatus: "needs_review",
    ownerFinalReviewStatus: "needs_review",
    realDatasetStatus: "needs_review",
    outcomeSamplingProcedureStatus: "needs_review",
    incidentTriageStatus: "needs_review",
    escalationPathStatus: "needs_review",
    rollbackDecisionStatus: "needs_review",
    ownerReviewStatus: "needs_review",
  };
  const protectedReviewer = {
    protectedAssetWindowStatus: "needs_review",
    protectedRenderStatus: "needs_review",
    reviewerAssignmentStatus: "needs_review",
    secondReviewStatus: "needs_review",
    adjudicationOpsStatus: "needs_review",
    followupOpsStatus: "needs_review",
    reviewerMonitoringStatus: "needs_review",
    reviewerExceptionStatus: "needs_review",
    reviewerAdjudicationStatus: "needs_review",
    reviewerFollowupStatus: "needs_review",
    reviewerRollbackStatus: "needs_review",
    reviewerArchiveStatus: "needs_review",
    reviewerMonitoringEvidenceStatus: "needs_review",
    reviewerExceptionEvidenceStatus: "needs_review",
    reviewerAdjudicationEvidenceStatus: "needs_review",
    reviewerFollowupEvidenceStatus: "needs_review",
    reviewerRollbackEvidenceStatus: "needs_review",
    reviewerArchiveEvidenceStatus: "needs_review",
  };
  const productionReviewer = {
    productionReviewerAssignmentStatus: "needs_review",
    productionSecondReviewStatus: "needs_review",
    productionAdjudicationStatus: "needs_review",
    productionFollowupStatus: "needs_review",
    productionExceptionStatus: "needs_review",
    productionRollbackStatus: "needs_review",
  };
  return {
    item: {
      clinicId: "clinic-1",
      patientId: "live-patient",
      visitId: "live-visit",
      readiness: {
        status: "blocked",
        lesionCount: 2,
        timelineCandidateCount: 2,
        readyTimelineCount: 1,
        needsReviewTimelineCount: 0,
        blockedTimelineCount: 1,
        imageCount: 4,
        candidatePairCount: 3,
        reviewedPairCount: 1,
        technicalReadyPairCount: 1,
        productionAssetNotReadyCount: 1,
        missingCaptureMetadataCount: 1,
        deviceEvidenceNotReadyCount: 1,
        deviceBridgeQualityNotReadyCount: 1,
        captureProtocolNotReadyCount: 1,
        calibrationBlockedCount: 1,
        markerMissingCount: 1,
        measurementPolicyNotReadyCount: 1,
        productionAnalysisPolicyNotReadyCount: 1,
        reviewerAssignmentNotReadyCount: 1,
        secondReviewNotReadyCount: 1,
        reviewerWorkflowReadyCount: 1,
        dynamicConclusionAllowed: false,
      },
      blockers: [
        {
          code: "capture_metadata_missing",
          label: "Не хватает данных съёмки",
          count: 1,
          nextAction: "complete_capture_metadata",
        },
      ],
      nextActions: ["complete_capture_metadata", "verify_production_asset", "approve_production_analysis_policy"],
      items: [
        {
          queueNumber: 1,
          lesionId: "live-lesion",
          lesionLabel: "Очаг из клиники A",
          bodyZone: "висок левый",
          bodySurface: "left",
          status: "blocked",
          visitCount: 2,
          imageCount: 4,
          candidatePairCount: 3,
          productionAssetNotReadyCount: 1,
          missingCaptureMetadataCount: 1,
          deviceEvidenceNotReadyCount: 1,
          deviceBridgeQualityNotReadyCount: 1,
          captureProtocolNotReadyCount: 1,
          measurementPolicyNotReadyCount: 1,
          productionAnalysisPolicyNotReadyCount: 1,
          reviewerAssignmentNotReadyCount: 1,
          secondReviewNotReadyCount: 1,
          nextAction: "complete_capture_metadata",
        },
      ],
      timelineRollout: {
        ...baseTimelineReview("timeline-rollout", "review_required"),
        reasons: ["timeline_dataset_not_ready"],
      },
      timelineRolloutSop: {
        ...baseTimelineReview("timeline-rollout-sop"),
        ...checklist,
      },
      timelineRolloutEvidence: {
        ...baseTimelineReview("timeline-rollout-evidence"),
        ...checklist,
        monitoringWindowDays: 0,
      },
      timelineRolloutMonitoring: {
        ...baseTimelineReview("timeline-rollout-monitoring"),
        ...checklist,
        monitoringWindowDays: 0,
      },
      timelineRolloutIncidentProcedure: {
        ...baseTimelineReview("timeline-rollout-incident-procedure"),
        ...checklist,
      },
      timelineRolloutClinicalValidation: {
        ...baseTimelineReview("timeline-rollout-clinical-validation"),
        realDatasetLockStatus: "needs_review",
        validatorTrainingStatus: "needs_review",
        blindedSampleStatus: "needs_review",
        adjudicationStatus: "needs_review",
        decisionLogStatus: "needs_review",
        ownerAcceptanceStatus: "needs_review",
      },
      timelineRolloutPostValidationMonitoring: {
        ...baseTimelineReview("timeline-rollout-post-validation-monitoring"),
        monitoringWindowStatus: "needs_review",
        outcomeReviewStatus: "needs_review",
        driftReviewStatus: "needs_review",
        incidentFollowupStatus: "needs_review",
        validatorRecheckStatus: "needs_review",
        ownerSignoffStatus: "needs_review",
      },
      timelineRolloutObservationGovernance: {
        ...baseTimelineReview("timeline-rollout-observation-governance"),
        observationWindowStatus: "needs_review",
        outcomeObservationStatus: "needs_review",
        driftSignalReviewStatus: "needs_review",
        incidentOutcomeReviewStatus: "needs_review",
        followupClosureStatus: "needs_review",
        governanceReviewStatus: "needs_review",
        ownerSignoffStatus: "needs_review",
      },
      timelineRolloutExceptionGovernance: {
        ...baseTimelineReview("timeline-rollout-exception-governance"),
        exceptionRegisterStatus: "needs_review",
        triageSlaStatus: "needs_review",
        resolutionEvidenceStatus: "needs_review",
        recurrenceReviewStatus: "needs_review",
        rollbackReadinessStatus: "needs_review",
        governanceArchiveStatus: "needs_review",
        ownerSignoffStatus: "needs_review",
      },
      timelineRolloutOutcomeGovernance: {
        ...baseTimelineReview("timeline-rollout-outcome-governance"),
        longitudinalWindowStatus: "needs_review",
        realDatasetCoverageStatus: "needs_review",
        reviewerOperationsValidationStatus: "needs_review",
        exceptionTrendReviewStatus: "needs_review",
        followupCadenceStatus: "needs_review",
        governanceCadenceStatus: "needs_review",
        ownerSignoffStatus: "needs_review",
      },
      timelineRolloutLongitudinalClinicalValidation: {
        ...baseTimelineReview("timeline-rollout-longitudinal-clinical-validation"),
        outcomeWindowStatus: "needs_review",
        clinicianCoverageStatus: "needs_review",
        adjudicationStatus: "needs_review",
        consensusReviewStatus: "needs_review",
        followupValidationStatus: "needs_review",
        governanceCadenceStatus: "needs_review",
        ownerSignoffStatus: "needs_review",
      },
      timelineRolloutProtectedReviewerValidation: {
        ...baseTimelineReview("timeline-rollout-protected-reviewer-validation"),
        ...protectedReviewer,
      },
      timelineRolloutProtectedReviewerGovernance: {
        ...baseTimelineReview("timeline-rollout-protected-reviewer-governance"),
        ...protectedReviewer,
      },
      timelineRolloutProtectedReviewerEvidence: {
        ...baseTimelineReview("timeline-rollout-protected-reviewer-evidence"),
        ...protectedReviewer,
      },
      timelineRolloutProductionDatasetEvidence: {
        ...baseTimelineReview("timeline-rollout-production-dataset-evidence"),
        realClinicWindowStatus: "needs_review",
        datasetSamplingStatus: "needs_review",
        longitudinalFollowupStatus: "needs_review",
        protectedReviewerLinkageStatus: "needs_review",
        outcomeObservationStatus: "needs_review",
        incidentLinkageStatus: "needs_review",
        ownerSignoffStatus: "needs_review",
      },
      timelineRolloutProductionReviewerGovernance: {
        ...baseTimelineReview("timeline-rollout-production-reviewer-governance"),
        ...productionReviewer,
      },
      timelineRolloutProductionReviewerEvidence: {
        ...baseTimelineReview("timeline-rollout-production-reviewer-evidence"),
        ...productionReviewer,
      },
      boundaries: {
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        pairKeysExposed: false,
        imageIdsExposed: false,
        storagePathsExposed: false,
        signedUrlsIssued: false,
        rawImageBytesExposed: false,
        doctorOnlyTextExposed: false,
        clinicalConclusionGenerated: false,
      },
    },
  };
}

async function installMockBackend(page: Page) {
  await page.route(`${API_BASE_URL}/api/v1/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path === "/api/v1/visits/live-visit") {
      await route.fulfill(json({
        item: {
          id: "live-visit",
          clinicId: "clinic-1",
          patientId: "live-patient",
          doctorUserId: "doctor-1",
          status: "in_progress",
          startedAt: "2026-05-21T10:00:00.000Z",
          signedAt: null,
          chiefComplaint: "Проверка снимков",
          createdAt: "2026-05-21T10:00:00.000Z",
          updatedAt: "2026-05-21T10:00:00.000Z",
          patient: { id: "live-patient", fullName: "Петрова Анна", code: "DP-live-001" },
          clinic: { id: "clinic-1", slug: "demo", name: "Дерма-Про" },
        },
      }));
      return;
    }

    if (path === "/api/v1/visits/live-visit/lesions") {
      await route.fulfill(json({
        items: [
          {
            id: "live-lesion",
            clinicId: "clinic-1",
            patientId: "live-patient",
            visitId: "live-visit",
            label: "Очаг из клиники A",
            bodyZone: "висок левый",
            bodySurface: "left",
            status: "active",
            riskLevel: "moderate",
            createdAt: "2026-05-21T10:00:00.000Z",
            updatedAt: "2026-05-21T10:00:00.000Z",
          },
        ],
      }));
      return;
    }

    if (path === "/api/v1/visits/live-visit/lesion-comparison-viewer-qa/review-queue") {
      await route.fulfill(json({
        visitId: "live-visit",
        filters: { status: "actionable", limit: 20 },
        summary: {
          total: 1,
          unreviewed: 1,
          technicalReady: 0,
          needsRecapture: 1,
          notSuitableForComparison: 0,
          measurementPolicyRequired: 1,
          productionAnalysisPolicyRequired: 1,
          reviewerAssignmentRequired: 1,
          secondReviewRequired: 1,
          actionable: 1,
        },
        items: [
          {
            queueNumber: 1,
            lesionId: "live-lesion",
            lesionLabel: "Очаг из клиники A",
            bodyZone: "висок левый",
            review: { status: "needs_recapture", reasons: ["capture_conditions_not_ready"] },
            measurementPolicy: { status: "required", reasons: [] },
            productionAnalysisPolicy: { status: "required", reasons: [] },
            reviewerAssignment: { status: "required", reasons: [] },
            secondReview: { status: "required", reasons: [] },
            calibrationStatus: "not_ready",
            captureMetadataStatus: "needs_review",
            technicalMarkerCount: 0,
            nextAction: "request_recapture",
          },
        ],
      }));
      return;
    }

    if (path === "/api/v1/visits/live-visit/longitudinal-dataset-validation") {
      await route.fulfill(json(longitudinalValidationResponse()));
      return;
    }

    if (path === "/api/v1/visits/live-visit/assets") {
      await route.fulfill(json({ items: [] }));
      return;
    }

    if (path === "/api/v1/visits/live-visit/assessment") {
      await route.fulfill(json({
        item: {
          id: "live-assessment",
          status: "ready",
          riskLevel: "moderate",
          abcdTotal: 3.4,
          sevenPointTotal: 2,
          summary: "Рабочая оценка",
          recommendation: "Рабочая рекомендация",
        },
      }));
      return;
    }

    if (path === "/api/v1/visits/live-visit/conclusion") {
      await route.fulfill(json({
        item: { id: "live-conclusion", status: "draft", summary: "Рабочее заключение", nextStep: "Контроль" },
      }));
      return;
    }

    if (path === "/api/v1/visits/live-visit/report") {
      await route.fulfill(json({
        item: {
          id: "live-report",
          status: "draft",
          physicianText: "Рабочий текст отчёта",
          patientSafeText: "Текст отчёта для пациента",
        },
      }));
      return;
    }

    if (path === "/api/v1/visits/live-visit/report-package") {
      await route.fulfill(json({
        item: {
          visitId: "live-visit",
          visitStatus: "signed",
          assessment: { status: "ready", riskLevel: "moderate", summaryPresent: true, recommendationPresent: true },
          conclusion: { status: "signed", summaryPresent: true, nextStepPresent: true, followUpAt: null },
          report: { status: "signed", physicianTextPresent: true, patientTextPresent: true, signedAt: null },
          counts: { lesions: 1, assets: 0 },
          readiness: { ready: true, status: "ready", completionPercent: 100, missing: [], exportAllowed: true, patientDeliveryAllowed: false },
          patientPhotoProtocol: {
            brainstormTask: "SD-MF-046",
            status: "metadata_ready_backend_blocked",
            readyForBackendContract: true,
            selectedPhotoCount: 2,
            counts: { selectedPhotos: 2, overviewPhotos: 1, dermoscopyPhotos: 1, reportAttachments: 0 },
            missing: ["self_hosted_photo_delivery_contract_missing"],
            deliveryBoundary: {
              patientDeliveryAllowed: false,
              rawFilesExposed: false,
              signedUrlsIssued: false,
              storagePathsExposed: false,
              tokensExposed: false,
              physicianTextExposed: false,
              fileProxyReady: false,
              requiresSelfHostedFileProxy: true,
              requiresReleaseAudit: true,
              requiresRevoke: true,
              requiresIdentityCheck: true,
              requiresRetentionPolicy: true,
              requiresApprovedPatientCopy: true,
            },
            policy: {
              releasePrepared: true,
              patientFileProxyEnabled: false,
              patientCopyApproved: false,
              retentionPolicyApproved: false,
              expiresAt: "2026-06-20T10:00:00.000Z",
            },
          },
          productBoundary: {
            managedRuntimeDependency: "none",
            managedDatabaseDependency: "none",
            externalRuntimeCalls: false,
            rawPatientDataInReport: false,
          },
        },
      }));
      return;
    }

    if (path === "/api/v1/visits/live-visit/patient-photo-protocol-release/audit") {
      await route.fulfill(json({
        item: {
          releaseId: "release-live-1",
          visitId: "live-visit",
          status: "prepared",
          summary: {
            eventCount: 1,
            preparedEvents: 1,
            policyReviewEvents: 0,
            revokedEvents: 0,
            patientReadEvents: 0,
            proxyDownloadEvents: 0,
            proxyDeniedEvents: 0,
          },
          events: [],
          boundaries: {
            immutableLedger: true,
            rawPayloadExposed: false,
            revokeReasonExposed: false,
            actorIdsExposed: false,
            correlationIdsExposed: false,
            storagePathsExposed: false,
            tokensExposed: false,
            signedUrlsIssued: false,
            doctorOnlyTextExposed: false,
          },
        },
      }));
      return;
    }

    await route.fulfill(json({ item: null, items: [], summary: {}, path }));
  });
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));

  expect(overflow.docScroll, `${label}: document overflow`).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(overflow.bodyScroll, `${label}: body overflow`).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function expectMobileTapTargets(page: Page, label: string, rootSelector = "main") {
  const offenders = await page.evaluate((selector) => {
    const root = document.querySelector(selector) ?? document.body;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), [role="tab"]'));
    return nodes.flatMap((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return [];
      if (rect.height >= 44) return [];
      return [{
        tag: el.tagName.toLowerCase(),
        text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 80),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      }];
    });
  }, rootSelector);

  expect(
    offenders,
    `${label}: interactive targets under 44px\n${offenders
      .map((item) => `  • <${item.tag}> "${item.text}" ${item.width}x${item.height}`)
      .join("\n")}`,
  ).toEqual([]);
}

test.describe("Visit workspace self-hosted QA — native Russian UI", () => {
  for (const viewport of VIEWPORTS) {
    test(`/patients visit report @ ${viewport.name}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await installMockBackend(page);
      await setDemoRole(page, "doctor");
      await page.addInitScript(
        ({ baseKey, tokenKey, userKey, apiBaseUrl }) => {
          window.localStorage.setItem(baseKey, apiBaseUrl);
          window.localStorage.setItem(tokenKey, "local-jwt");
          window.localStorage.setItem(
            userKey,
            JSON.stringify({ id: "doctor-1", displayName: "Врач клиники", roles: ["doctor"] }),
          );
        },
        {
          baseKey: SELF_HOSTED_API_BASE_URL_KEY,
          tokenKey: SELF_HOSTED_API_TOKEN_KEY,
          userKey: SELF_HOSTED_API_USER_KEY,
          apiBaseUrl: API_BASE_URL,
        },
      );

      await page.goto(`${APP_BASE_URL}${ROUTE}`, { waitUntil: "networkidle" });

      await expect(page.getByRole("tab", { name: "Отчёт" })).toHaveAttribute("data-state", "active");
      const timelineRegion = page.getByRole("region", { name: "Готовность проверки истории" });
      await expect(timelineRegion).toBeVisible();
      await expect(timelineRegion.getByText("Краткая сводка проверки истории")).toBeVisible();
      await expect(timelineRegion.getByText("Данные снимков")).toBeVisible();
      await expect(timelineRegion.getByText("Условия сравнения")).toBeVisible();
      await expect(timelineRegion.getByText("Разбор врачом")).toBeVisible();
      await expect(timelineRegion.getByText("Рабочий контроль")).toBeVisible();
      await expect(timelineRegion.getByText("Что делать сейчас")).toBeVisible();
      await expect(timelineRegion.getByRole("link", { name: /Открыть/ })).toBeVisible();
      await expect(timelineRegion.getByText("Технический журнал проверки")).toBeVisible();
      await expect(timelineRegion.getByText("Открыть подробный контроль")).toBeVisible();
      await expect(timelineRegion.getByRole("region", { name: "Порядок инцидентов" })).toHaveCount(0);

      const timelineText = await timelineRegion.innerText();
      expect(timelineText).not.toMatch(FORBIDDEN_VISIBLE);
      expect(timelineText).not.toMatch(/меланома|прогноз|лечение|диагноз поставлен|динамический вывод включен/i);

      await expectNoHorizontalOverflow(page, `${viewport.name} report`);
      if (viewport.width < 640) {
        await expectMobileTapTargets(
          page,
          `${viewport.name} timeline QA`,
          '[aria-label="Готовность проверки истории"]',
        );
      }
      expect(errors, `${viewport.name}: console/page errors`).toEqual([]);

      await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
      await page.waitForTimeout(50);
      await page.screenshot({
        path: `test-results/visit-workspace-qa-native-russian-${viewport.name}.png`,
        fullPage: true,
      });
      await timelineRegion.screenshot({
        path: `test-results/visit-workspace-qa-native-russian-${viewport.name}-timeline-region.png`,
      });
    });
  }
});

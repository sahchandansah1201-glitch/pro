import { describe, expect, it } from "vitest";
import type { Patient } from "@/lib/domain";
import type { SelfHostedLesionLongitudinalHistoryDTO } from "@/lib/self-hosted-clinical-workspace-api";
import { projectLiveLesionBundle } from "@/lib/live-lesion-bundle";

const patient: Patient = {
  id: "patient-1",
  code: "TEST-001",
  fullName: "Тестовый пациент",
  birthDate: "1985-04-10",
  sex: "female",
  phototype: "II",
  riskFactors: [],
  consents: { pdn: true, imaging: true, telemed: false },
  createdBy: "doctor-1",
  createdAt: "2026-09-01T08:00:00.000Z",
};

const history = (overrides: Partial<SelfHostedLesionLongitudinalHistoryDTO> = {}) => ({
  clinicId: "clinic-1",
  patientId: patient.id,
  lesionId: "lesion-1",
  label: "Контрольный очаг",
  bodyZone: "Кисть правой руки",
  bodySurface: "front",
  status: "monitoring",
  summary: {
    visitCount: 1,
    imageCount: 1,
    candidatePairCount: 0,
    comparablePairCount: 0,
    warningPairCount: 0,
    blockedPairCount: 0,
    assessmentCount: 0,
  },
  visits: [{
    visitId: "visit-1",
    startedAt: "2026-09-01T08:00:00.000Z",
    signedAt: null,
    status: "in_progress",
    imageCount: 1,
    dermoscopyCount: 0,
    overviewCount: 1,
    assessmentCount: 0,
    capturedAtFirst: "2026-09-01T08:20:00.000Z",
    capturedAtLast: "2026-09-01T08:20:00.000Z",
  }],
  images: [{
    id: "image-single",
    visitId: "visit-1",
    kind: "overview_photo",
    capturedAt: "2026-09-01T08:20:00.000Z",
  }],
  candidatePairs: [],
  boundaries: {
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    storagePathsExposed: false,
    signedUrlsIssued: false,
    rawImageBytesExposed: false,
    doctorOnlyTextExposed: false,
    clinicalConclusionGenerated: false,
  },
  ...overrides,
} satisfies SelfHostedLesionLongitudinalHistoryDTO);

describe("projectLiveLesionBundle", () => {
  it("projects a single safe image even when no comparison pair exists", () => {
    const bundle = projectLiveLesionBundle(patient, history());

    expect(bundle.images.map((image) => image.id)).toEqual(["image-single"]);
    expect(bundle.images[0]).toMatchObject({
      visitId: "visit-1",
      lesionId: "lesion-1",
      kind: "overview",
      capturedAt: "2026-09-01T08:20:00.000Z",
    });
  });

  it("keeps blocked-pair images visible but excludes their pair from comparison candidates", () => {
    const bundle = projectLiveLesionBundle(patient, history({
      summary: {
        visitCount: 2,
        imageCount: 4,
        candidatePairCount: 2,
        comparablePairCount: 1,
        warningPairCount: 0,
        blockedPairCount: 1,
        assessmentCount: 0,
      },
      images: [
        { id: "ready-a", visitId: "visit-1", kind: "dermoscopy", capturedAt: "2026-09-01T08:20:00.000Z" },
        { id: "ready-b", visitId: "visit-2", kind: "dermoscopy", capturedAt: "2026-09-02T08:20:00.000Z" },
        { id: "blocked-a", visitId: "visit-1", kind: "overview_photo", capturedAt: "2026-09-01T08:25:00.000Z" },
        { id: "blocked-b", visitId: "visit-2", kind: "overview_photo", capturedAt: "2026-09-02T08:25:00.000Z" },
      ],
      candidatePairs: [
        {
          previousVisitId: "visit-1",
          currentVisitId: "visit-2",
          previousImageId: "ready-a",
          currentImageId: "ready-b",
          kind: "dermoscopy",
          status: "ready",
          reasons: [],
        },
        {
          previousVisitId: "visit-1",
          currentVisitId: "visit-2",
          previousImageId: "blocked-a",
          currentImageId: "blocked-b",
          kind: "overview_photo",
          status: "blocked",
          reasons: ["non_image_content_type"],
        },
      ],
    }));

    expect(bundle.images.map((image) => image.id)).toEqual([
      "ready-a",
      "blocked-a",
      "ready-b",
      "blocked-b",
    ]);
    expect(bundle.comparisonCandidatePairs).toEqual([["ready-a", "ready-b"]]);
  });
});

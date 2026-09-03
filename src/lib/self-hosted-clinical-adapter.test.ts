import { describe, expect, it } from "vitest";

import {
  selfHostedLesionToDomain,
  selfHostedPatientDetailToDomain,
  selfHostedVisitDetailToPatient,
  selfHostedVisitStatusToDomain,
  selfHostedVisitToDomain,
} from "@/lib/self-hosted-clinical-adapter";

describe("self-hosted clinical adapter", () => {
  it("maps backend visit statuses to UI domain statuses", () => {
    expect(selfHostedVisitStatusToDomain("signed")).toBe("closed");
    expect(selfHostedVisitStatusToDomain("in_progress")).toBe("in_progress");
    expect(selfHostedVisitStatusToDomain("cancelled")).toBe("cancelled");
    expect(selfHostedVisitStatusToDomain("draft")).toBe("scheduled");
  });

  it("converts visit detail into patient and visit domain records", () => {
    const visit = {
      id: "visit-1",
      clinicId: "clinic-1",
      patientId: "patient-1",
      doctorUserId: "doctor-1",
      status: "signed",
      startedAt: "2026-05-12T09:00:00.000Z",
      signedAt: "2026-05-12T09:30:00.000Z",
      chiefComplaint: "контроль",
      createdAt: "2026-05-12T08:59:00.000Z",
      updatedAt: "2026-05-12T09:30:00.000Z",
      patient: {
        id: "patient-1",
        fullName: "Live Patient",
        code: "DP-live",
        birthDate: "1990-01-02",
        sex: "male",
        phototype: "III",
        imagingConsent: true,
      },
      clinic: { id: "clinic-1", slug: "clinic", name: "Clinic" },
    };

    const patient = selfHostedVisitDetailToPatient(visit);
    expect(patient).toMatchObject({
      fullName: "Live Patient",
      birthDate: "1990-01-02",
      sex: "male",
      phototype: "III",
      consents: { imaging: true },
    });
    expect(patient.consents.pdn).toBeNull();
    expect(selfHostedVisitToDomain(visit)).toMatchObject({
      id: "visit-1",
      patientId: "patient-1",
      doctorId: "doctor-1",
      status: "closed",
      complaint: "контроль",
    });
  });

  it("keeps patient and lesion fields safe for production UI", () => {
    const patient = selfHostedPatientDetailToDomain({
      id: "patient-1",
      code: "DP-live",
      fullName: "Live Patient",
      birthDate: "1990-01-02",
      sex: "other",
      phototype: null,
      imagingConsent: true,
    });
    expect(patient.sex).toBe("female");
    expect(patient.phototype).toBe("II");

    const lesion = selfHostedLesionToDomain(
      {
        id: "lesion-1",
        clinicId: null,
        patientId: null,
        visitId: "visit-1",
        label: "Live lesion",
        bodyZone: null,
        bodySurface: null,
        status: "archived",
        riskLevel: null,
        bodyRegionId: "front-right-toes",
        bodyRegionDetailId: "digit-5",
        bodyAtlasSource: "makehuman-cc0",
        bodyAtlasProfileId: "adult_female_30",
        bodyAtlasManifestSha256: "a".repeat(64),
        bodyRegionMapSha256: "b".repeat(64),
        mapPoint: { view: "front", x: 0.35083, y: 0.99001 },
        placementRevision: 1,
        createdAt: "2026-05-12T09:00:00.000Z",
        updatedAt: null,
      },
      "patient-1",
    );
    expect(lesion).toMatchObject({
      patientId: "patient-1",
      bodyZone: "не указана",
      status: "archived",
      mapPoint: { view: "front", x: 0.35083, y: 0.99001 },
      bodyAtlasSource: "makehuman-cc0",
      bodyAtlasProfileId: "adult_female_30",
    });
  });
});

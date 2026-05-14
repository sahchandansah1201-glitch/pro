import type { BodyMapPoint, Lesion, LesionStatus, Patient, Phototype, Sex, Visit, VisitStatus } from "@/lib/domain";
import type { SelfHostedPatientDTO } from "@/lib/self-hosted-patient-api";
import type {
  SelfHostedVisitDTO,
  SelfHostedVisitDetailDTO,
  SelfHostedVisitLesionDTO,
} from "@/lib/self-hosted-visit-api";
import { selfHostedPatientToDomain } from "@/lib/self-hosted-patient-api";

export const SELF_HOSTED_LIVE_SOURCE_LABEL = "Источник данных: self-hosted backend";

function normalizeSex(input: unknown): Sex {
  return input === "male" ? "male" : "female";
}

function normalizePhototype(input: unknown): Phototype {
  return input === "I" || input === "II" || input === "III" || input === "IV" || input === "V" || input === "VI"
    ? input
    : "II";
}

export function selfHostedVisitStatusToDomain(status: string | null | undefined): VisitStatus {
  if (status === "signed") return "closed";
  if (status === "cancelled") return "cancelled";
  if (status === "in_progress") return "in_progress";
  return "scheduled";
}

export function selfHostedLesionStatusToDomain(status: string | null | undefined): LesionStatus {
  if (status === "monitoring") return "monitoring";
  if (status === "removed") return "removed";
  if (status === "archived") return "archived";
  return "active";
}

function fallbackPoint(): BodyMapPoint {
  return { view: "front", x: 0.5, y: 0.5 };
}

export function selfHostedVisitToDomain(dto: SelfHostedVisitDTO): Visit {
  const status = selfHostedVisitStatusToDomain(dto.status);
  const projectedPatientId = (dto as Partial<SelfHostedVisitDetailDTO>).patient?.id ?? null;
  return {
    id: dto.id,
    patientId: dto.patientId ?? projectedPatientId ?? "",
    doctorId: dto.doctorUserId ?? "self-hosted-backend",
    assistantId: null,
    clinicId: dto.clinicId ?? "self-hosted-clinic",
    status,
    startedAt: dto.startedAt ?? dto.createdAt ?? "",
    closedAt: status === "closed" ? dto.signedAt ?? dto.updatedAt ?? null : null,
    complaint: dto.chiefComplaint ?? "—",
  };
}

export function selfHostedVisitDetailToPatient(dto: SelfHostedVisitDetailDTO): Patient {
  return {
    id: dto.patient.id ?? dto.patientId ?? "",
    code: dto.patient.code ?? "—",
    fullName: dto.patient.fullName ?? "Пациент self-hosted",
    birthDate: "1900-01-01",
    sex: "female",
    phototype: "II",
    riskFactors: [],
    consents: {
      pdn: true,
      imaging: false,
      telemed: false,
    },
    createdBy: "self-hosted-backend",
    createdAt: dto.createdAt ?? "",
  };
}

export function selfHostedPatientDetailToDomain(dto: SelfHostedPatientDTO): Patient {
  const patient = selfHostedPatientToDomain(dto);
  return {
    ...patient,
    sex: normalizeSex(dto.sex),
    phototype: normalizePhototype(dto.phototype),
  };
}

export function selfHostedLesionToDomain(dto: SelfHostedVisitLesionDTO, patientId: string): Lesion {
  return {
    id: dto.id,
    patientId: dto.patientId ?? patientId,
    bodyZone: dto.bodyZone ?? "не указана",
    mapPoint: fallbackPoint(),
    label: dto.label || "Очаг",
    firstSeenAt: dto.createdAt ?? "",
    status: selfHostedLesionStatusToDomain(dto.status),
  };
}

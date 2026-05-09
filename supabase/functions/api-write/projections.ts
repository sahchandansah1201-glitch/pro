// Stage 1C · Strict camelCase DTO projections (write surface).
// Mirrors api-read style: NEW object, allow-listed keys only, never spread.

export interface PatientDTO {
  id: string;
  clinicId: string;
  code: string;
  fullName: string;
  birthDate: string;
  sex: "male" | "female";
  phototype: "I" | "II" | "III" | "IV" | "V" | "VI";
  riskFactors: string[];
  createdBy: string | null;
  createdAt: string;
}
export const PATIENT_COLS =
  "id, clinic_id, code, full_name, birth_date, sex, phototype, risk_factors, created_by, created_at";

export function toPatientDTO(row: Record<string, unknown>): PatientDTO {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    code: String(row.code),
    fullName: String(row.full_name),
    birthDate: String(row.birth_date),
    sex: row.sex as PatientDTO["sex"],
    phototype: row.phototype as PatientDTO["phototype"],
    riskFactors: Array.isArray(row.risk_factors) ? Array.from(row.risk_factors as string[]) : [],
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export interface VisitDTO {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string | null;
  assistantId: string | null;
  status: "scheduled" | "in_progress" | "closed" | "cancelled";
  startedAt: string;
  closedAt: string | null;
  complaint: string;
  createdAt: string;
}
export const VISIT_COLS =
  "id, clinic_id, patient_id, doctor_id, assistant_id, status, started_at, closed_at, complaint, created_at";

export function toVisitDTO(row: Record<string, unknown>): VisitDTO {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    patientId: String(row.patient_id),
    doctorId: (row.doctor_id as string | null) ?? null,
    assistantId: (row.assistant_id as string | null) ?? null,
    status: row.status as VisitDTO["status"],
    startedAt: String(row.started_at),
    closedAt: (row.closed_at as string | null) ?? null,
    complaint: String(row.complaint ?? ""),
    createdAt: String(row.created_at),
  };
}

export interface LesionDTO {
  id: string;
  clinicId: string;
  patientId: string;
  bodyZone: string;
  mapView: "front" | "back" | "left" | "right" | "scalp";
  mapX: number;
  mapY: number;
  label: string;
  firstSeenAt: string;
  status: "active" | "monitoring" | "removed" | "archived";
  createdAt: string;
}
export const LESION_COLS =
  "id, clinic_id, patient_id, body_zone, map_view, map_x, map_y, label, first_seen_at, status, created_at";

export function toLesionDTO(row: Record<string, unknown>): LesionDTO {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    patientId: String(row.patient_id),
    bodyZone: String(row.body_zone),
    mapView: row.map_view as LesionDTO["mapView"],
    mapX: Number(row.map_x),
    mapY: Number(row.map_y),
    label: String(row.label),
    firstSeenAt: String(row.first_seen_at),
    status: row.status as LesionDTO["status"],
    createdAt: String(row.created_at),
  };
}

export interface AssessmentDTO {
  id: string;
  clinicId: string;
  visitId: string;
  lesionId: string;
  abcd: unknown;
  sevenPoint: unknown;
  aiRisk: "low" | "moderate" | "high" | "urgent" | null;
  aiConfidence: number | null;
  aiFeatures: string[];
  aiUncertaintyNotes: string[];
  aiXaiNotes: string;
  decidedBy: string | null;
  decidedAt: string;
}
export const ASSESSMENT_COLS =
  "id, clinic_id, visit_id, lesion_id, abcd, seven_point, ai_risk, ai_confidence, ai_features, ai_uncertainty_notes, ai_xai_notes, decided_by, decided_at";

export function toAssessmentDTO(row: Record<string, unknown>): AssessmentDTO {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    visitId: String(row.visit_id),
    lesionId: String(row.lesion_id),
    abcd: row.abcd,
    sevenPoint: row.seven_point,
    aiRisk: (row.ai_risk as AssessmentDTO["aiRisk"]) ?? null,
    aiConfidence: row.ai_confidence === null || row.ai_confidence === undefined
      ? null
      : Number(row.ai_confidence),
    aiFeatures: Array.isArray(row.ai_features) ? Array.from(row.ai_features as string[]) : [],
    aiUncertaintyNotes: Array.isArray(row.ai_uncertainty_notes)
      ? Array.from(row.ai_uncertainty_notes as string[])
      : [],
    aiXaiNotes: String(row.ai_xai_notes ?? ""),
    decidedBy: (row.decided_by as string | null) ?? null,
    decidedAt: String(row.decided_at),
  };
}

export interface ConclusionDTO {
  id: string;
  clinicId: string;
  visitId: string;
  doctorText: string;
  followUpPlan: string;
  decidedBy: string | null;
  decidedAt: string;
}
export const CONCLUSION_COLS =
  "id, clinic_id, visit_id, doctor_text, follow_up_plan, decided_by, decided_at";

export function toConclusionDTO(row: Record<string, unknown>): ConclusionDTO {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    visitId: String(row.visit_id),
    doctorText: String(row.doctor_text),
    followUpPlan: String(row.follow_up_plan ?? ""),
    decidedBy: (row.decided_by as string | null) ?? null,
    decidedAt: String(row.decided_at),
  };
}

export interface ReportDTO {
  id: string;
  clinicId: string;
  visitId: string;
  currentVersionId: string | null;
  createdAt: string;
}
export const REPORT_COLS = "id, clinic_id, visit_id, current_version_id, created_at";

export function toReportDTO(row: Record<string, unknown>): ReportDTO {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    visitId: String(row.visit_id),
    currentVersionId: (row.current_version_id as string | null) ?? null,
    createdAt: String(row.created_at),
  };
}

export interface ReportVersionDTO {
  id: string;
  clinicId: string;
  reportId: string;
  version: number;
  status: "draft" | "final" | "amended" | "revoked";
  patientText: string;
  doctorText: string;
  createdBy: string | null;
  createdAt: string;
  signedBy: string | null;
  signedAt: string | null;
}
export const REPORT_VERSION_COLS =
  "id, clinic_id, report_id, version, status, patient_safe_text, doctor_text, created_by, created_at, signed_by, signed_at";

export function toReportVersionDTO(row: Record<string, unknown>): ReportVersionDTO {
  return {
    id: String(row.id),
    clinicId: String(row.clinic_id),
    reportId: String(row.report_id),
    version: Number(row.version),
    status: row.status as ReportVersionDTO["status"],
    patientText: String(row.patient_safe_text),
    doctorText: String(row.doctor_text),
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: String(row.created_at),
    signedBy: (row.signed_by as string | null) ?? null,
    signedAt: (row.signed_at as string | null) ?? null,
  };
}

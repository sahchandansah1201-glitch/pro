// Stage 1B-A · Projection (DTO) functions. STRICT allow-list.
//
// Rules:
//   * Each function returns a NEW object containing ONLY allow-listed keys.
//   * Never spread raw rows.
//   * Forbidden fields are never read. If they appear in the input row they
//     are silently dropped — but contract tests assert they never leak.
//
// Forbidden field reference (per surface) is mirrored in
// tests/contract/forbidden-fields.ts.

export type Role =
  | "patient"
  | "doctor"
  | "private_doctor"
  | "assistant"
  | "operator"
  | "clinic_admin"
  | "system_admin";

// ── /me ─────────────────────────────────────────────────────────────────────
export interface MeDTO {
  userId: string;
  email: string | null;
  displayName: string | null;
  roles: Role[];
  clinicId: string | null;
  hasPatientLink: boolean;
}

export function toMeDTO(input: {
  userId: string;
  email: string | null;
  profile: { full_name: string; clinic_id: string | null } | null;
  roles: { role: Role }[];
  hasPatientLink: boolean;
}): MeDTO {
  const roles = Array.from(new Set(input.roles.map((r) => r.role))).sort();
  return {
    userId: input.userId,
    email: input.email,
    displayName: input.profile?.full_name ?? null,
    roles,
    clinicId: input.profile?.clinic_id ?? null,
    hasPatientLink: input.hasPatientLink,
  };
}

// ── Patient surface DTOs ────────────────────────────────────────────────────
export interface PatientSelfDTO {
  id: string;
  code: string;
  fullName: string;
  birthDate: string;
  sex: "male" | "female";
  phototype: "I" | "II" | "III" | "IV" | "V" | "VI";
}

export function toPatientSelfDTO(row: {
  id: string;
  code: string;
  full_name: string;
  birth_date: string;
  sex: PatientSelfDTO["sex"];
  phototype: PatientSelfDTO["phototype"];
}): PatientSelfDTO {
  return {
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    birthDate: row.birth_date,
    sex: row.sex,
    phototype: row.phototype,
  };
}

export interface PatientReportSummaryDTO {
  id: string;
  visitId: string;
  generatedAt: string;
}

export function toPatientReportSummaryDTO(row: {
  id: string;
  visit_id: string;
  generated_at: string;
}): PatientReportSummaryDTO {
  return {
    id: row.id,
    visitId: row.visit_id,
    generatedAt: row.generated_at,
  };
}

export interface PatientReportVersionDTO {
  id: string;
  status: "final" | "amended";
  /** Patient-safe text. External DTO key is `text`; DB column is `patient_safe_text`. */
  text: string;
  createdAt: string;
}

export function toPatientReportVersionDTO(row: {
  id: string;
  status: PatientReportVersionDTO["status"];
  patient_safe_text: string;
  created_at: string;
}): PatientReportVersionDTO {
  return {
    id: row.id,
    status: row.status,
    text: row.patient_safe_text,
    createdAt: row.created_at,
  };
}

// ── Doctor surface DTOs ─────────────────────────────────────────────────────
export interface DoctorPatientListDTO {
  id: string;
  clinicId: string;
  code: string;
  fullName: string;
  birthDate: string;
  sex: "male" | "female";
  phototype: PatientSelfDTO["phototype"];
  createdAt: string;
}

export function toDoctorPatientListDTO(row: {
  id: string;
  clinic_id: string;
  code: string;
  full_name: string;
  birth_date: string;
  sex: DoctorPatientListDTO["sex"];
  phototype: DoctorPatientListDTO["phototype"];
  created_at: string;
}): DoctorPatientListDTO {
  return {
    id: row.id,
    clinicId: row.clinic_id,
    code: row.code,
    fullName: row.full_name,
    birthDate: row.birth_date,
    sex: row.sex,
    phototype: row.phototype,
    createdAt: row.created_at,
  };
}

export interface DoctorPatientDetailDTO extends DoctorPatientListDTO {
  riskFactors: string[];
}

export function toDoctorPatientDetailDTO(row: {
  id: string;
  clinic_id: string;
  code: string;
  full_name: string;
  birth_date: string;
  sex: DoctorPatientDetailDTO["sex"];
  phototype: DoctorPatientDetailDTO["phototype"];
  risk_factors: string[];
  created_at: string;
}): DoctorPatientDetailDTO {
  return {
    ...toDoctorPatientListDTO(row),
    riskFactors: Array.isArray(row.risk_factors) ? [...row.risk_factors] : [],
  };
}

export interface DoctorReportVersionDTO {
  id: string;
  reportId: string;
  version: number;
  status: "draft" | "final" | "amended" | "revoked";
  /** Patient-facing text. External key intentionally `patientText`. */
  patientText: string;
  doctorText: string;
  createdAt: string;
  signedAt: string | null;
}

export function toDoctorReportVersionDTO(row: {
  id: string;
  report_id: string;
  version: number;
  status: DoctorReportVersionDTO["status"];
  patient_safe_text: string;
  doctor_text: string;
  created_at: string;
  signed_at: string | null;
}): DoctorReportVersionDTO {
  return {
    id: row.id,
    reportId: row.report_id,
    version: row.version,
    status: row.status,
    patientText: row.patient_safe_text,
    doctorText: row.doctor_text,
    createdAt: row.created_at,
    signedAt: row.signed_at,
  };
}

// Stage 1C · camelCase → snake_case column maps for write operations.
// Single source of truth. Never spread raw bodies.

import {
  asDate,
  asEnum,
  asNumber,
  asObject,
  asString,
  asStringArray,
  asTimestamp,
} from "./validators.ts";

const SEX = ["male", "female"] as const;
const PHOTOTYPE = ["I", "II", "III", "IV", "V", "VI"] as const;
const VISIT_STATUS = ["scheduled", "in_progress", "closed", "cancelled"] as const;
const LESION_STATUS = ["active", "monitoring", "removed", "archived"] as const;
const MAP_VIEW = ["front", "back", "left", "right", "scalp"] as const;
const RISK = ["low", "moderate", "high", "urgent"] as const;
const ASSET_KIND = ["overview", "dermoscopy", "macro", "body_map"] as const;
const ASSET_SOURCE = [
  "phone", "file", "camera", "device_bridge", "local_transfer",
] as const;
const LESION_STATUS = ["active", "monitoring", "removed", "archived"] as const;
const MAP_VIEW = ["front", "back", "left", "right", "scalp"] as const;
const RISK = ["low", "moderate", "high", "urgent"] as const;
// Stage 1C accepts only final/amended on PATCH. draft is the implicit insert state.
const REPORT_VERSION_PATCH_STATUS = ["final", "amended"] as const;

export function mapPatientInsert(body: Record<string, unknown>) {
  return {
    code: asString(body, "code", { min: 1, max: 64 })!,
    full_name: asString(body, "fullName", { min: 1, max: 256 })!,
    birth_date: asDate(body, "birthDate")!,
    sex: asEnum(body, "sex", SEX)!,
    phototype: asEnum(body, "phototype", PHOTOTYPE)!,
    risk_factors: asStringArray(body, "riskFactors", { optional: true }) ?? [],
  };
}

export function mapPatientUpdate(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("fullName" in body) out.full_name = asString(body, "fullName", { min: 1, max: 256 });
  if ("birthDate" in body) out.birth_date = asDate(body, "birthDate");
  if ("sex" in body) out.sex = asEnum(body, "sex", SEX);
  if ("phototype" in body) out.phototype = asEnum(body, "phototype", PHOTOTYPE);
  if ("riskFactors" in body) out.risk_factors = asStringArray(body, "riskFactors");
  return out;
}

export function mapVisitInsert(
  patientId: string,
  body: Record<string, unknown>,
) {
  const out: Record<string, unknown> = {
    patient_id: patientId,
    started_at: asTimestamp(body, "startedAt")!,
  };
  if ("complaint" in body) out.complaint = asString(body, "complaint", { max: 4000 });
  if ("assistantId" in body) out.assistant_id = asString(body, "assistantId");
  return out;
}

export function mapVisitUpdate(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("status" in body) out.status = asEnum(body, "status", VISIT_STATUS);
  if ("closedAt" in body) {
    out.closed_at = body.closedAt === null ? null : asTimestamp(body, "closedAt");
  }
  if ("complaint" in body) out.complaint = asString(body, "complaint", { max: 4000 });
  if ("assistantId" in body) {
    out.assistant_id = body.assistantId === null
      ? null
      : asString(body, "assistantId");
  }
  return out;
}

export function mapLesionInsert(
  patientId: string,
  body: Record<string, unknown>,
) {
  const out: Record<string, unknown> = {
    patient_id: patientId,
    body_zone: asString(body, "bodyZone", { min: 1, max: 64 })!,
    map_view: asEnum(body, "mapView", MAP_VIEW)!,
    map_x: asNumber(body, "mapX", { min: 0, max: 1 })!,
    map_y: asNumber(body, "mapY", { min: 0, max: 1 })!,
    label: asString(body, "label", { min: 1, max: 256 })!,
    first_seen_at: asTimestamp(body, "firstSeenAt")!,
  };
  if ("status" in body) out.status = asEnum(body, "status", LESION_STATUS);
  return out;
}

export function mapLesionUpdate(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("bodyZone" in body) out.body_zone = asString(body, "bodyZone", { min: 1, max: 64 });
  if ("mapView" in body) out.map_view = asEnum(body, "mapView", MAP_VIEW);
  if ("mapX" in body) out.map_x = asNumber(body, "mapX", { min: 0, max: 1 });
  if ("mapY" in body) out.map_y = asNumber(body, "mapY", { min: 0, max: 1 });
  if ("label" in body) out.label = asString(body, "label", { min: 1, max: 256 });
  if ("status" in body) out.status = asEnum(body, "status", LESION_STATUS);
  return out;
}

export function mapAssessmentInsert(
  visitId: string,
  body: Record<string, unknown>,
) {
  const out: Record<string, unknown> = {
    visit_id: visitId,
    lesion_id: asString(body, "lesionId")!,
    abcd: asObject(body, "abcd")!,
    seven_point: asObject(body, "sevenPoint")!,
  };
  if ("aiRisk" in body) out.ai_risk = asEnum(body, "aiRisk", RISK, { optional: true }) ?? null;
  if ("aiConfidence" in body) {
    out.ai_confidence = body.aiConfidence === null
      ? null
      : asNumber(body, "aiConfidence", { min: 0, max: 1 });
  }
  if ("aiFeatures" in body) out.ai_features = asStringArray(body, "aiFeatures");
  if ("aiUncertaintyNotes" in body) {
    out.ai_uncertainty_notes = asStringArray(body, "aiUncertaintyNotes");
  }
  if ("aiXaiNotes" in body) out.ai_xai_notes = asString(body, "aiXaiNotes", { max: 8000 });
  return out;
}

export function mapConclusionInsert(
  visitId: string,
  body: Record<string, unknown>,
) {
  const out: Record<string, unknown> = {
    visit_id: visitId,
    doctor_text: asString(body, "doctorText", { min: 1, max: 16000 })!,
  };
  if ("followUpPlan" in body) {
    out.follow_up_plan = asString(body, "followUpPlan", { max: 8000 });
  }
  return out;
}

export function mapReportInsert(visitId: string) {
  return { visit_id: visitId };
}

export function mapReportUpdate(body: Record<string, unknown>) {
  return {
    current_version_id: asString(body, "currentVersionId")!,
  };
}

export function mapReportVersionInsert(
  reportId: string,
  body: Record<string, unknown>,
) {
  return {
    report_id: reportId,
    patient_safe_text: asString(body, "patientText", { min: 1, max: 32000 })!,
    doctor_text: asString(body, "doctorText", { min: 1, max: 32000 })!,
  };
}

export function mapReportVersionUpdate(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if ("status" in body) {
    out.status = asEnum(body, "status", REPORT_VERSION_PATCH_STATUS);
  }
  if ("patientText" in body) {
    out.patient_safe_text = asString(body, "patientText", { min: 1, max: 32000 });
  }
  if ("doctorText" in body) {
    out.doctor_text = asString(body, "doctorText", { min: 1, max: 32000 });
  }
  return out;
}

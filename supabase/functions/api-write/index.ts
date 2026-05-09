// Stage 1C · Single Edge Function for the controlled doctor write API.
//
// Routes (all under /doctor/...) require Authorization: Bearer <jwt>
// and a doctor or private_doctor role. RLS + write-guard triggers
// (Stage 1C migration) are the security boundary; this function never uses
// service-role credentials.
//
//   POST   /doctor/patients
//   PATCH  /doctor/patients/:patientId
//   POST   /doctor/patients/:patientId/visits
//   PATCH  /doctor/visits/:visitId
//   POST   /doctor/patients/:patientId/lesions
//   PATCH  /doctor/lesions/:lesionId
//   POST   /doctor/visits/:visitId/assessments
//   POST   /doctor/visits/:visitId/conclusions
//   POST   /doctor/visits/:visitId/reports
//   PATCH  /doctor/reports/:reportId
//   POST   /doctor/reports/:reportId/versions
//   PATCH  /doctor/report-versions/:versionId

import { corsHeaders } from "./cors.ts";
import { getCorrelationId } from "./correlation.ts";
import { authenticate, CallerContext } from "./auth.ts";
import { errorResponse, HttpError, jsonResponse } from "./errors.ts";
import { assertUuid, parseJsonBody, validateBody } from "./validators.ts";
import {
  mapAssessmentInsert,
  mapConclusionInsert,
  mapLesionInsert,
  mapLesionUpdate,
  mapPatientInsert,
  mapPatientUpdate,
  mapReportInsert,
  mapReportUpdate,
  mapReportVersionInsert,
  mapReportVersionUpdate,
  mapVisitInsert,
  mapVisitUpdate,
} from "./mapping.ts";
import {
  ASSESSMENT_COLS,
  CONCLUSION_COLS,
  LESION_COLS,
  PATIENT_COLS,
  REPORT_COLS,
  REPORT_VERSION_COLS,
  toAssessmentDTO,
  toConclusionDTO,
  toLesionDTO,
  toPatientDTO,
  toReportDTO,
  toReportVersionDTO,
  toVisitDTO,
  VISIT_COLS,
} from "./projections.ts";
import { insertRow, updateRow } from "./db.ts";
import { AuditAction, AuditEntity, recordWrite } from "./audit.ts";

type Method = "POST" | "PATCH";

interface RouteMeta {
  method: Method;
  path: string;            // canonical pattern, used in audit "route" field
  action: AuditAction;
  entity: AuditEntity;
}

type Handler = (
  ctx: CallerContext,
  params: Record<string, string>,
  body: Record<string, unknown>,
  meta: RouteMeta,
  correlationId: string,
) => Promise<{ status: number; data: unknown }>;

function changedFields(body: Record<string, unknown>): string[] {
  return Object.keys(body);
}

function rowClinicId(row: Record<string, unknown>): string {
  const c = row["clinic_id"];
  if (typeof c !== "string" || !c) {
    throw new HttpError("internal_error", "Missing clinic_id on returned row");
  }
  return c;
}

function rowId(row: Record<string, unknown>): string {
  const id = row["id"];
  if (typeof id !== "string" || !id) {
    throw new HttpError("internal_error", "Missing id on returned row");
  }
  return id;
}

interface Route {
  method: Method;
  pattern: RegExp;
  paramNames: string[];
  meta: RouteMeta;
  handler: Handler;
}

function route(
  method: Method,
  pattern: string,
  paramNames: string[],
  meta: Omit<RouteMeta, "method" | "path">,
  handler: Handler,
): Route {
  const re = "^" +
    pattern.replace(/:[a-zA-Z0-9_]+/g, "([^/]+)").replace(/\//g, "\\/") +
    "$";
  return {
    method,
    pattern: new RegExp(re),
    paramNames,
    meta: { method, path: pattern, action: meta.action, entity: meta.entity },
    handler,
  };
}

// ── Handlers ────────────────────────────────────────────────────────────────

const hCreatePatient: Handler = async (ctx, _p, body, meta, cid) => {
  validateBody(body, {
    allow: ["code", "fullName", "birthDate", "sex", "phototype", "riskFactors"],
    required: ["code", "fullName", "birthDate", "sex", "phototype"],
  });
  const cols = mapPatientInsert(body);
  const row = await insertRow(ctx.client, "patients", cols, PATIENT_COLS);
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "create",
    entity: "patient",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    changedFields: changedFields(body),
  });
  return { status: 201, data: toPatientDTO(row) };
};

const hUpdatePatient: Handler = async (ctx, p, body, meta, cid) => {
  const id = assertUuid(p.patientId, "patientId");
  validateBody(body, {
    allow: ["fullName", "birthDate", "sex", "phototype", "riskFactors"],
    atLeastOne: true,
  });
  const cols = mapPatientUpdate(body);
  const row = await updateRow(ctx.client, "patients", id, cols, PATIENT_COLS);
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "update",
    entity: "patient",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    changedFields: changedFields(body),
  });
  return { status: 200, data: toPatientDTO(row) };
};

const hCreateVisit: Handler = async (ctx, p, body, meta, cid) => {
  const patientId = assertUuid(p.patientId, "patientId");
  validateBody(body, {
    allow: ["startedAt", "complaint", "assistantId"],
    required: ["startedAt"],
  });
  const cols = mapVisitInsert(patientId, body);
  const row = await insertRow(ctx.client, "visits", cols, VISIT_COLS);
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "create",
    entity: "visit",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    changedFields: changedFields(body),
    parentIds: { patientId },
  });
  return { status: 201, data: toVisitDTO(row) };
};

const hUpdateVisit: Handler = async (ctx, p, body, meta, cid) => {
  const id = assertUuid(p.visitId, "visitId");
  validateBody(body, {
    allow: ["status", "closedAt", "complaint", "assistantId"],
    atLeastOne: true,
  });
  const cols = mapVisitUpdate(body);
  const row = await updateRow(ctx.client, "visits", id, cols, VISIT_COLS);
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "update",
    entity: "visit",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    changedFields: changedFields(body),
  });
  return { status: 200, data: toVisitDTO(row) };
};

const hCreateLesion: Handler = async (ctx, p, body, meta, cid) => {
  const patientId = assertUuid(p.patientId, "patientId");
  validateBody(body, {
    allow: ["bodyZone", "mapView", "mapX", "mapY", "label", "firstSeenAt", "status"],
    required: ["bodyZone", "mapView", "mapX", "mapY", "label", "firstSeenAt"],
  });
  const cols = mapLesionInsert(patientId, body);
  const row = await insertRow(ctx.client, "lesions", cols, LESION_COLS);
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "create",
    entity: "lesion",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    changedFields: changedFields(body),
    parentIds: { patientId },
  });
  return { status: 201, data: toLesionDTO(row) };
};

const hUpdateLesion: Handler = async (ctx, p, body, meta, cid) => {
  const id = assertUuid(p.lesionId, "lesionId");
  validateBody(body, {
    allow: ["bodyZone", "mapView", "mapX", "mapY", "label", "status"],
    atLeastOne: true,
  });
  const cols = mapLesionUpdate(body);
  const row = await updateRow(ctx.client, "lesions", id, cols, LESION_COLS);
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "update",
    entity: "lesion",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    changedFields: changedFields(body),
  });
  return { status: 200, data: toLesionDTO(row) };
};

const hCreateAssessment: Handler = async (ctx, p, body, meta, cid) => {
  const visitId = assertUuid(p.visitId, "visitId");
  validateBody(body, {
    allow: [
      "lesionId",
      "abcd",
      "sevenPoint",
      "aiRisk",
      "aiConfidence",
      "aiFeatures",
      "aiUncertaintyNotes",
      "aiXaiNotes",
    ],
    required: ["lesionId", "abcd", "sevenPoint"],
  });
  // Validate lesionId looks like a uuid.
  assertUuid(String(body.lesionId), "lesionId");
  const cols = mapAssessmentInsert(visitId, body);
  const row = await insertRow(ctx.client, "assessments", cols, ASSESSMENT_COLS);
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "create",
    entity: "assessment",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    changedFields: changedFields(body),
    parentIds: { visitId, lesionId: String(body.lesionId) },
  });
  return { status: 201, data: toAssessmentDTO(row) };
};

const hCreateConclusion: Handler = async (ctx, p, body, meta, cid) => {
  const visitId = assertUuid(p.visitId, "visitId");
  validateBody(body, {
    allow: ["doctorText", "followUpPlan"],
    required: ["doctorText"],
  });
  const cols = mapConclusionInsert(visitId, body);
  const row = await insertRow(ctx.client, "conclusions", cols, CONCLUSION_COLS);
  // changedFields is intentionally NOT passed: the request body keys for
  // conclusions are themselves clinical-text field names (doctorText,
  // followUpPlan) that the audit denylist forbids. Only metadata is logged.
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "create",
    entity: "conclusion",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    parentIds: { visitId },
  });
  return { status: 201, data: toConclusionDTO(row) };
};

const hCreateReport: Handler = async (ctx, p, body, meta, cid) => {
  const visitId = assertUuid(p.visitId, "visitId");
  validateBody(body, { allow: [] });
  const row = await insertRow(
    ctx.client,
    "reports",
    mapReportInsert(visitId),
    REPORT_COLS,
  );
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "create",
    entity: "report",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    parentIds: { visitId },
  });
  return { status: 201, data: toReportDTO(row) };
};

const hUpdateReport: Handler = async (ctx, p, body, meta, cid) => {
  const id = assertUuid(p.reportId, "reportId");
  validateBody(body, {
    allow: ["currentVersionId"],
    required: ["currentVersionId"],
    exempt: ["currentVersionId"],
  });
  assertUuid(String(body.currentVersionId), "currentVersionId");
  const row = await updateRow(
    ctx.client,
    "reports",
    id,
    mapReportUpdate(body),
    REPORT_COLS,
  );
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "set_current_version",
    entity: "report",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    parentIds: { reportVersionId: String(body.currentVersionId) },
  });
  return { status: 200, data: toReportDTO(row) };
};

const hCreateReportVersion: Handler = async (ctx, p, body, meta, cid) => {
  const reportId = assertUuid(p.reportId, "reportId");
  validateBody(body, {
    allow: ["patientText", "doctorText"],
    required: ["patientText", "doctorText"],
  });
  const cols = mapReportVersionInsert(reportId, body);
  const row = await insertRow(
    ctx.client,
    "report_versions",
    cols,
    REPORT_VERSION_COLS,
  );
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action: "create",
    entity: "report_version",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    parentIds: { reportId },
  });
  return { status: 201, data: toReportVersionDTO(row) };
};

const hUpdateReportVersion: Handler = async (ctx, p, body, meta, cid) => {
  const id = assertUuid(p.versionId, "versionId");
  validateBody(body, {
    allow: ["status", "patientText", "doctorText"],
    atLeastOne: true,
  });
  const cols = mapReportVersionUpdate(body);
  const row = await updateRow(
    ctx.client,
    "report_versions",
    id,
    cols,
    REPORT_VERSION_COLS,
  );
  const nextStatus = typeof body.status === "string" ? body.status : undefined;
  const action: AuditAction = nextStatus === "final"
    ? "finalize"
    : nextStatus === "amended"
      ? "amend"
      : "update";
  await recordWrite(ctx.client, ctx, {
    clinicId: rowClinicId(row),
    action,
    entity: "report_version",
    entityId: rowId(row),
    correlationId: cid,
    route: `${meta.method} ${meta.path}`,
    nextState: nextStatus,
  });
  return { status: 200, data: toReportVersionDTO(row) };
};

// ── Route table ─────────────────────────────────────────────────────────────
const routes: Route[] = [
  route("POST",  "/doctor/patients", [], { action: "create", entity: "patient" }, hCreatePatient),
  route("PATCH", "/doctor/patients/:patientId", ["patientId"], { action: "update", entity: "patient" }, hUpdatePatient),
  route("POST",  "/doctor/patients/:patientId/visits", ["patientId"], { action: "create", entity: "visit" }, hCreateVisit),
  route("PATCH", "/doctor/visits/:visitId", ["visitId"], { action: "update", entity: "visit" }, hUpdateVisit),
  route("POST",  "/doctor/patients/:patientId/lesions", ["patientId"], { action: "create", entity: "lesion" }, hCreateLesion),
  route("PATCH", "/doctor/lesions/:lesionId", ["lesionId"], { action: "update", entity: "lesion" }, hUpdateLesion),
  route("POST",  "/doctor/visits/:visitId/assessments", ["visitId"], { action: "create", entity: "assessment" }, hCreateAssessment),
  route("POST",  "/doctor/visits/:visitId/conclusions", ["visitId"], { action: "create", entity: "conclusion" }, hCreateConclusion),
  route("POST",  "/doctor/visits/:visitId/reports", ["visitId"], { action: "create", entity: "report" }, hCreateReport),
  route("PATCH", "/doctor/reports/:reportId", ["reportId"], { action: "set_current_version", entity: "report" }, hUpdateReport),
  route("POST",  "/doctor/reports/:reportId/versions", ["reportId"], { action: "create", entity: "report_version" }, hCreateReportVersion),
  route("PATCH", "/doctor/report-versions/:versionId", ["versionId"], { action: "update", entity: "report_version" }, hUpdateReportVersion),
];

// ── Path normalization ──────────────────────────────────────────────────────
function normalizePath(pathname: string): string {
  let p = pathname;
  const prefixes = ["/functions/v1/api-write", "/api-write"];
  for (const pre of prefixes) {
    if (p === pre || p === pre + "/") return "/";
    if (p.startsWith(pre + "/")) {
      p = p.slice(pre.length);
      break;
    }
  }
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

// ── Server ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const correlationId = getCorrelationId(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { ...corsHeaders, "x-correlation-id": correlationId },
    });
  }

  if (req.method !== "POST" && req.method !== "PATCH") {
    return errorResponse(
      "validation_error",
      "Only POST and PATCH are supported",
      correlationId,
      { method: req.method },
    );
  }

  const url = new URL(req.url);
  const path = normalizePath(url.pathname);

  let matched: { route: Route; params: Record<string, string> } | null = null;
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.pattern.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.paramNames.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
    matched = { route: r, params };
    break;
  }

  if (!matched) {
    return errorResponse("not_found", "Route not found", correlationId, {
      method: req.method,
      path,
    });
  }

  try {
    const ctx = await authenticate(req);
    const hasDoctorRole = ctx.roles.includes("doctor") ||
      ctx.roles.includes("private_doctor");
    if (!hasDoctorRole) {
      throw new HttpError("forbidden", "Doctor role required");
    }

    const text = await req.text();
    const body = parseJsonBody(text);

    const { status, data } = await matched.route.handler(
      ctx,
      matched.params,
      body,
      matched.route.meta,
      correlationId,
    );
    return jsonResponse(status, { data }, correlationId);
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.code, err.message, correlationId, err.details);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api-write]", correlationId, message);
    return errorResponse("internal_error", "Internal error", correlationId);
  }
});

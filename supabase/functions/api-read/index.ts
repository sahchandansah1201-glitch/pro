// Stage 1B-A · Single Edge Function exposing read-only routes.
//
// Routes (all require Authorization: Bearer <jwt>):
//   GET /me
//   GET /patient/me
//   GET /patient/reports
//   GET /patient/reports/:reportId/versions
//   GET /doctor/patients
//   GET /doctor/patients/:patientId
//   GET /doctor/reports/:reportId/versions
//
// All reads use the per-request Supabase client built from the caller JWT,
// so Stage 1A RLS is the enforced security boundary. The projection layer
// is the response-shape contract.

import { corsHeaders } from "./cors.ts";
import { getCorrelationId } from "./correlation.ts";
import { authenticate, CallerContext } from "./auth.ts";
import { errorResponse, HttpError, okResponse } from "./errors.ts";
import { assertUuid } from "./validators.ts";
import {
  toDoctorPatientDetailDTO,
  toDoctorPatientListDTO,
  toDoctorReportVersionDTO,
  toMeDTO,
  toPatientReportSummaryDTO,
  toPatientReportVersionDTO,
  toPatientSelfDTO,
} from "./projections.ts";

// ── Route table (regex → handler) ───────────────────────────────────────────
type Handler = (
  ctx: CallerContext,
  params: Record<string, string>,
) => Promise<unknown>;

interface Route {
  method: "GET";
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

function route(
  pattern: string,
  paramNames: string[],
  handler: Handler,
): Route {
  // Convert "/patient/reports/:reportId/versions" into a regex.
  const re = "^" +
    pattern.replace(/:[a-zA-Z0-9_]+/g, "([^/]+)").replace(/\//g, "\\/") +
    "$";
  return { method: "GET", pattern: new RegExp(re), paramNames, handler };
}

// ── Handlers ────────────────────────────────────────────────────────────────

const handleMe: Handler = async (ctx) => {
  const [profileRes, rolesRes, linkRes] = await Promise.all([
    ctx.client
      .from("profiles")
      .select("full_name, clinic_id")
      .eq("id", ctx.userId)
      .maybeSingle(),
    ctx.client.from("user_roles").select("role").eq("user_id", ctx.userId),
    ctx.client
      .from("patient_user_link")
      .select("id")
      .eq("user_id", ctx.userId)
      .is("revoked_at", null)
      .limit(1),
  ]);

  if (profileRes.error) throw new HttpError("internal_error", profileRes.error.message);
  if (rolesRes.error) throw new HttpError("internal_error", rolesRes.error.message);
  if (linkRes.error) throw new HttpError("internal_error", linkRes.error.message);

  const dto = toMeDTO({
    userId: ctx.userId,
    email: ctx.email,
    profile: profileRes.data
      ? {
        full_name: String(profileRes.data.full_name),
        clinic_id: profileRes.data.clinic_id as string | null,
      }
      : null,
    roles: (rolesRes.data ?? []).map((r) => ({
      role: r.role as ReturnType<typeof toMeDTO>["roles"][number],
    })),
    hasPatientLink: (linkRes.data ?? []).length > 0,
  });
  return { data: dto };
};

const handlePatientMe: Handler = async (ctx) => {
  // Patient surface: returns the linked patient row via patient_user_link → patients.
  const linkRes = await ctx.client
    .from("patient_user_link")
    .select("patient_id")
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (linkRes.error) throw new HttpError("internal_error", linkRes.error.message);
  if (!linkRes.data) throw new HttpError("not_found", "No linked patient");

  const patientRes = await ctx.client
    .from("patients")
    .select("id, code, full_name, birth_date, sex, phototype")
    .eq("id", linkRes.data.patient_id)
    .maybeSingle();
  if (patientRes.error) throw new HttpError("internal_error", patientRes.error.message);
  if (!patientRes.data) throw new HttpError("not_found", "Patient not visible");

  return {
    data: toPatientSelfDTO(patientRes.data as Parameters<typeof toPatientSelfDTO>[0]),
  };
};

const handlePatientReports: Handler = async (ctx) => {
  // RLS already restricts report_versions to final/amended for patients.
  // We also pass the explicit filter as defence-in-depth.
  const versions = await ctx.client
    .from("report_versions")
    .select("report_id")
    .in("status", ["final", "amended"]);
  if (versions.error) throw new HttpError("internal_error", versions.error.message);

  const reportIds = Array.from(
    new Set((versions.data ?? []).map((v) => v.report_id as string)),
  );
  if (reportIds.length === 0) return { data: [], nextCursor: null };

  const reports = await ctx.client
    .from("reports")
    .select("id, visit_id, created_at")
    .in("id", reportIds);
  if (reports.error) throw new HttpError("internal_error", reports.error.message);

  const data = (reports.data ?? []).map((r) =>
    toPatientReportSummaryDTO({
      id: r.id as string,
      visit_id: r.visit_id as string,
      generated_at: r.created_at as string,
    })
  );
  return { data, nextCursor: null };
};

const handlePatientReportVersions: Handler = async (ctx, params) => {
  const reportId = assertUuid(params.reportId, "reportId");
  const res = await ctx.client
    .from("report_versions")
    .select("id, status, patient_safe_text, created_at")
    .eq("report_id", reportId)
    .in("status", ["final", "amended"])
    .order("created_at", { ascending: false });
  if (res.error) throw new HttpError("internal_error", res.error.message);

  const data = (res.data ?? []).map((r) =>
    toPatientReportVersionDTO(r as Parameters<typeof toPatientReportVersionDTO>[0])
  );
  return { data, nextCursor: null };
};

const handleDoctorPatients: Handler = async (ctx) => {
  const res = await ctx.client
    .from("patients")
    .select("id, clinic_id, code, full_name, birth_date, sex, phototype, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (res.error) throw new HttpError("internal_error", res.error.message);

  const data = (res.data ?? []).map((r) =>
    toDoctorPatientListDTO(r as Parameters<typeof toDoctorPatientListDTO>[0])
  );
  return { data, nextCursor: null };
};

const handleDoctorPatientDetail: Handler = async (ctx, params) => {
  const patientId = assertUuid(params.patientId, "patientId");
  const res = await ctx.client
    .from("patients")
    .select(
      "id, clinic_id, code, full_name, birth_date, sex, phototype, risk_factors, created_at",
    )
    .eq("id", patientId)
    .maybeSingle();
  if (res.error) throw new HttpError("internal_error", res.error.message);
  if (!res.data) throw new HttpError("not_found", "Patient not visible");

  return {
    data: toDoctorPatientDetailDTO(
      res.data as Parameters<typeof toDoctorPatientDetailDTO>[0],
    ),
  };
};

const handleDoctorReportVersions: Handler = async (ctx, params) => {
  const reportId = assertUuid(params.reportId, "reportId");
  const res = await ctx.client
    .from("report_versions")
    .select(
      "id, report_id, version, status, patient_safe_text, doctor_text, created_at, signed_at",
    )
    .eq("report_id", reportId)
    .order("version", { ascending: false });
  if (res.error) throw new HttpError("internal_error", res.error.message);

  const data = (res.data ?? []).map((r) =>
    toDoctorReportVersionDTO(r as Parameters<typeof toDoctorReportVersionDTO>[0])
  );
  return { data, nextCursor: null };
};

// ── Route table ─────────────────────────────────────────────────────────────
const routes: Route[] = [
  route("/me", [], handleMe),
  route("/patient/me", [], handlePatientMe),
  route("/patient/reports", [], handlePatientReports),
  route(
    "/patient/reports/:reportId/versions",
    ["reportId"],
    handlePatientReportVersions,
  ),
  route("/doctor/patients", [], handleDoctorPatients),
  route(
    "/doctor/patients/:patientId",
    ["patientId"],
    handleDoctorPatientDetail,
  ),
  route(
    "/doctor/reports/:reportId/versions",
    ["reportId"],
    handleDoctorReportVersions,
  ),
];

// ── Path normalization ──────────────────────────────────────────────────────
// Edge Functions are invoked under /functions/v1/api-read[/...]. Strip that
// prefix so route patterns can be the public-facing paths.
function normalizePath(pathname: string): string {
  let p = pathname;
  const prefixes = ["/functions/v1/api-read", "/api-read"];
  for (const pre of prefixes) {
    if (p === pre || p === pre + "/") return "/";
    if (p.startsWith(pre + "/")) {
      p = p.slice(pre.length);
      break;
    }
  }
  if (!p.startsWith("/")) p = "/" + p;
  // Strip trailing slash (except root).
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

  if (req.method !== "GET") {
    return errorResponse(
      "validation_error",
      "Only GET is supported",
      correlationId,
      { method: req.method },
    );
  }

  const url = new URL(req.url);
  const path = normalizePath(url.pathname);

  let matched: { route: Route; params: Record<string, string> } | null = null;
  for (const r of routes) {
    const m = r.pattern.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.paramNames.forEach((n, i) => (params[n] = decodeURIComponent(m[i + 1])));
    matched = { route: r, params };
    break;
  }

  if (!matched) {
    return errorResponse("not_found", "Route not found", correlationId, {
      path,
    });
  }

  try {
    const ctx = await authenticate(req);
    if (path.startsWith("/doctor/") || path === "/doctor") {
      const hasDoctorRole = ctx.roles.includes("doctor") ||
        ctx.roles.includes("private_doctor");
      if (!hasDoctorRole) {
        throw new HttpError("forbidden", "Doctor role required");
      }
    }
    const body = await matched.route.handler(ctx, matched.params);
    return okResponse(body, correlationId);
  } catch (err) {
    if (err instanceof HttpError) {
      return errorResponse(err.code, err.message, correlationId, err.details);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api-read]", correlationId, message);
    return errorResponse("internal_error", "Internal error", correlationId);
  }
});

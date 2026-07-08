// Stage 6 · public analysis repository.
// Read-only public contract for protected summary links. The lookup uses a
// token hash and returns patient-safe text only.

import { createHash } from "node:crypto";

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function textOrNull(value) {
  return value == null ? null : String(value);
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeRow(row = {}) {
  if (!row || typeof row !== "object" || !row.status) return { status: "not_found" };
  if (row.status === "expired" || row.status === "not_found") {
    return {
      status: row.status,
      expiresAt: textOrNull(row.expiresAt),
    };
  }
  return {
    status: "valid",
    safeSummary: textOrNull(row.safeSummary),
    createdAt: textOrNull(row.createdAt),
    clinicName: textOrNull(row.clinicName),
    qualityPassed: bool(row.qualityPassed),
    expiresAt: textOrNull(row.expiresAt),
  };
}

export function hashPublicAnalysisToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function buildGetPublicAnalysisByTokenHashSql({ tokenHash, nowIso }) {
  return `
with matched_link as (
  select
    pal.id,
    pal.clinic_id,
    pal.report_id,
    pal.expires_at,
    pal.status,
    pal.revoked_at
  from public_analysis_links pal
  where pal.token_hash = ${sqlLiteral(tokenHash)}
  limit 1
),
safe_report as (
  select
    r.id,
    r.clinic_id,
    r.patient_id,
    r.visit_id,
    r.status,
    r.patient_safe_text,
    r.signed_at,
    c.name as clinic_name,
    exists (
      select 1
      from clinical_assets a
      where a.clinic_id = r.clinic_id
        and a.patient_id = r.patient_id
        and a.visit_id = r.visit_id
        and a.kind in ('overview_photo', 'dermoscopy')
    ) as has_image
  from matched_link ml
  join reports r on r.id = ml.report_id and r.clinic_id = ml.clinic_id
  join clinics c on c.id = r.clinic_id
  where r.status = 'signed'
    and nullif(trim(r.patient_safe_text), '') is not null
)
select coalesce((
  select jsonb_build_object(
    'status',
      case
        when ml.status <> 'active' or ml.revoked_at is not null then 'not_found'
        when ml.expires_at <= ${sqlLiteral(nowIso)}::timestamptz then 'expired'
        when sr.id is null then 'not_found'
        else 'valid'
      end,
    'safeSummary',
      case
        when ml.status = 'active'
          and ml.revoked_at is null
          and ml.expires_at > ${sqlLiteral(nowIso)}::timestamptz
          and sr.id is not null
        then left(trim(sr.patient_safe_text), 700)
        else null
      end,
    'createdAt',
      case
        when ml.status = 'active'
          and ml.revoked_at is null
          and ml.expires_at > ${sqlLiteral(nowIso)}::timestamptz
          and sr.id is not null
        then sr.signed_at
        else null
      end,
    'clinicName',
      case
        when ml.status = 'active'
          and ml.revoked_at is null
          and ml.expires_at > ${sqlLiteral(nowIso)}::timestamptz
          and sr.id is not null
        then sr.clinic_name
        else null
      end,
    'qualityPassed',
      case
        when ml.status = 'active'
          and ml.revoked_at is null
          and ml.expires_at > ${sqlLiteral(nowIso)}::timestamptz
          and sr.id is not null
        then sr.has_image
        else null
      end,
    'expiresAt', ml.expires_at
  )
  from matched_link ml
  left join safe_report sr on true
), jsonb_build_object('status', 'not_found'))::text;
`.trim();
}

export function createPublicAnalysisRepository(dbClient) {
  return {
    async getByTokenHash({ tokenHash, nowIso }) {
      const row = await dbClient.queryJson(buildGetPublicAnalysisByTokenHashSql({ tokenHash, nowIso }));
      return normalizeRow(row);
    },
  };
}

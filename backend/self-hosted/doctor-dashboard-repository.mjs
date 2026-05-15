// Stage 5I · Self-hosted doctor dashboard repository.
// Aggregates dashboard widgets from PostgreSQL only. No demo/mock tables and no
// managed runtime dependencies are allowed here.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlUuidList(values = []) {
  return values.map((value) => sqlUuid(value)).join(", ");
}

function safeClinicIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(String)
    .filter((value) => UUID_PATTERN.test(value))
    .slice(0, 100);
}

function clinicScopeWhere({ alias = "v", clinicIds = [], allClinics = false } = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function doctorScopeWhere({ alias = "v", doctorUserId = null } = {}) {
  return doctorUserId && UUID_PATTERN.test(String(doctorUserId))
    ? `and ${alias}.doctor_user_id = ${sqlUuid(doctorUserId)}`
    : "";
}

function safeLimit(value, fallback = 6, max = 20) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
}

export function buildDoctorDashboardSql({
  clinicIds = [],
  allClinics = false,
  doctorUserId = null,
  limit = 6,
} = {}) {
  const rowLimit = safeLimit(limit);
  const visitScope = `
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
    ${doctorScopeWhere({ alias: "v", doctorUserId })}
  `;
  const patientScope = clinicScopeWhere({ alias: "p", clinicIds, allClinics });
  const assetScope = clinicScopeWhere({ alias: "a", clinicIds, allClinics });
  const deviceScope = clinicScopeWhere({ alias: "d", clinicIds, allClinics });

  return `
with scoped_visits as (
  select
    v.id,
    v.clinic_id,
    v.patient_id,
    v.doctor_user_id,
    v.status,
    v.started_at,
    v.signed_at,
    v.chief_complaint,
    v.created_at,
    v.updated_at,
    p.full_name as patient_full_name,
    p.code as patient_code,
    p.birth_date as patient_birth_date,
    p.sex as patient_sex,
    c.name as clinic_name
  from visits v
  join patients p on p.id = v.patient_id and p.deleted_at is null
  join clinics c on c.id = v.clinic_id
  where true
    ${visitScope}
),
pending_report_visits as (
  select v.*
  from scoped_visits v
  where v.status = 'signed'
    and not exists (
      select 1
      from reports r
      where r.visit_id = v.id
        and r.signed_at is not null
    )
),
recent_patient_visits as (
  select distinct on (v.patient_id)
    v.patient_id,
    v.patient_full_name,
    v.patient_code,
    v.patient_birth_date,
    v.patient_sex,
    v.started_at as last_visit_at
  from scoped_visits v
  order by v.patient_id, v.started_at desc nulls last, v.created_at desc
),
dashboard as (
  select
    jsonb_build_object(
      'visitsToday', (
        select count(*)::int
        from scoped_visits v
        where v.started_at::date = current_date
          and v.status in ('draft', 'in_progress')
      ),
      'activeVisits', (
        select count(*)::int
        from scoped_visits v
        where v.status in ('draft', 'in_progress')
      ),
      'awaitingConclusion', (select count(*)::int from pending_report_visits),
      'patientsInScope', (
        select count(*)::int
        from patients p
        where p.deleted_at is null
          ${patientScope}
      ),
      'assetsNeedReview', (
        select count(*)::int
        from clinical_assets a
        join scoped_visits v on v.id = a.visit_id
        where a.byte_size is null or a.checksum_sha256 is null
          ${assetScope}
      ),
      'devicesTotal', (
        select count(*)::int
        from medical_devices d
        where true
          ${deviceScope}
      ),
      'devicesActive30d', (
        select count(*)::int
        from medical_devices d
        where d.last_seen_at >= now() - interval '30 days'
          ${deviceScope}
      )
    ) as kpis,
    (
      select coalesce(jsonb_agg(row_to_json(row) order by row."startedAt" asc nulls last), '[]'::jsonb)
      from (
        select
          v.id::text as "id",
          v.patient_id::text as "patientId",
          v.patient_full_name as "patientFullName",
          v.patient_code as "patientCode",
          v.clinic_id::text as "clinicId",
          v.clinic_name as "clinicName",
          v.status::text as "status",
          v.started_at as "startedAt",
          v.signed_at as "signedAt",
          v.chief_complaint as "chiefComplaint"
        from scoped_visits v
        where v.status in ('draft', 'in_progress')
        order by v.started_at asc nulls last, v.created_at desc
        limit ${rowLimit}
      ) row
    ) as upcoming,
    (
      select coalesce(jsonb_agg(row_to_json(row) order by row."signedAt" desc nulls last), '[]'::jsonb)
      from (
        select
          v.id::text as "id",
          v.patient_id::text as "patientId",
          v.patient_full_name as "patientFullName",
          v.patient_code as "patientCode",
          v.clinic_id::text as "clinicId",
          v.clinic_name as "clinicName",
          v.status::text as "status",
          v.started_at as "startedAt",
          v.signed_at as "signedAt",
          v.chief_complaint as "chiefComplaint"
        from pending_report_visits v
        order by v.signed_at desc nulls last, v.started_at desc nulls last
        limit ${rowLimit}
      ) row
    ) as "awaitingConclusions",
    (
      select coalesce(jsonb_agg(row_to_json(row) order by row."lastVisitAt" desc nulls last), '[]'::jsonb)
      from (
        select
          r.patient_id::text as "id",
          r.patient_full_name as "fullName",
          r.patient_code as "code",
          r.patient_birth_date as "birthDate",
          r.patient_sex as "sex",
          r.last_visit_at as "lastVisitAt"
        from recent_patient_visits r
        order by r.last_visit_at desc nulls last
        limit 5
      ) row
    ) as "recentPatients",
    (
      select coalesce(jsonb_agg(row_to_json(row) order by row."capturedAt" desc nulls last), '[]'::jsonb)
      from (
        select
          a.id::text as "id",
          a.visit_id::text as "visitId",
          a.patient_id::text as "patientId",
          v.patient_full_name as "patientFullName",
          a.kind::text as "kind",
          a.content_type as "contentType",
          a.byte_size as "byteSize",
          a.captured_at as "capturedAt",
          case
            when a.byte_size is null and a.checksum_sha256 is null then 'metadata_incomplete'
            when a.byte_size is null then 'size_missing'
            when a.checksum_sha256 is null then 'checksum_missing'
            else 'review'
          end as "issue"
        from clinical_assets a
        join scoped_visits v on v.id = a.visit_id
        where (a.byte_size is null or a.checksum_sha256 is null)
          ${assetScope}
        order by a.captured_at desc nulls last, a.created_at desc
        limit 5
      ) row
    ) as "assetIssues",
    (
      select coalesce(jsonb_agg(row_to_json(row) order by row."lastSeenAt" desc nulls last), '[]'::jsonb)
      from (
        select
          d.id::text as "id",
          d.model as "model",
          d.serial as "serial",
          d.status as "status",
          d.last_seen_at as "lastSeenAt"
        from medical_devices d
        where true
          ${deviceScope}
        order by d.last_seen_at desc nulls last, d.created_at desc
        limit 3
      ) row
    ) as devices
)
select coalesce(jsonb_agg(row_to_json(dashboard)), '[]'::jsonb)::text
from dashboard;
`.trim();
}

function asNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeVisit(row = {}) {
  return {
    id: String(row.id ?? ""),
    patientId: row.patientId == null ? null : String(row.patientId),
    patientFullName: row.patientFullName == null ? null : String(row.patientFullName),
    patientCode: row.patientCode == null ? null : String(row.patientCode),
    clinicId: row.clinicId == null ? null : String(row.clinicId),
    clinicName: row.clinicName == null ? null : String(row.clinicName),
    status: String(row.status ?? "draft"),
    startedAt: row.startedAt ?? null,
    signedAt: row.signedAt ?? null,
    chiefComplaint: row.chiefComplaint ?? null,
  };
}

function normalizeRecentPatient(row = {}) {
  return {
    id: String(row.id ?? ""),
    fullName: String(row.fullName ?? ""),
    code: String(row.code ?? ""),
    birthDate: row.birthDate ?? null,
    sex: row.sex == null ? null : String(row.sex),
    lastVisitAt: row.lastVisitAt ?? null,
  };
}

function normalizeAssetIssue(row = {}) {
  return {
    id: String(row.id ?? ""),
    visitId: row.visitId == null ? null : String(row.visitId),
    patientId: row.patientId == null ? null : String(row.patientId),
    patientFullName: row.patientFullName == null ? null : String(row.patientFullName),
    kind: String(row.kind ?? "overview_photo"),
    contentType: row.contentType == null ? null : String(row.contentType),
    byteSize: row.byteSize == null ? null : Number(row.byteSize),
    capturedAt: row.capturedAt ?? null,
    issue: String(row.issue ?? "review"),
  };
}

function normalizeDevice(row = {}) {
  return {
    id: String(row.id ?? ""),
    model: String(row.model ?? ""),
    serial: String(row.serial ?? ""),
    status: String(row.status ?? "unknown"),
    lastSeenAt: row.lastSeenAt ?? null,
  };
}

export function normalizeDoctorDashboard(row = {}) {
  const kpis = row.kpis && typeof row.kpis === "object" ? row.kpis : {};
  return {
    kpis: {
      visitsToday: asNumber(kpis.visitsToday),
      activeVisits: asNumber(kpis.activeVisits),
      awaitingConclusion: asNumber(kpis.awaitingConclusion),
      patientsInScope: asNumber(kpis.patientsInScope),
      assetsNeedReview: asNumber(kpis.assetsNeedReview),
      devicesTotal: asNumber(kpis.devicesTotal),
      devicesActive30d: asNumber(kpis.devicesActive30d),
    },
    upcoming: Array.isArray(row.upcoming) ? row.upcoming.map(normalizeVisit) : [],
    awaitingConclusions: Array.isArray(row.awaitingConclusions)
      ? row.awaitingConclusions.map(normalizeVisit)
      : [],
    recentPatients: Array.isArray(row.recentPatients)
      ? row.recentPatients.map(normalizeRecentPatient)
      : [],
    assetIssues: Array.isArray(row.assetIssues) ? row.assetIssues.map(normalizeAssetIssue) : [],
    devices: Array.isArray(row.devices) ? row.devices.map(normalizeDevice) : [],
  };
}

export function createDoctorDashboardRepository(dbClient) {
  return {
    async getDashboard(params) {
      const rows = await dbClient.queryJson(buildDoctorDashboardSql(params));
      return normalizeDoctorDashboard(Array.isArray(rows) && rows[0] ? rows[0] : {});
    },
  };
}

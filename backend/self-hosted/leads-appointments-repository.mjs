// Stage 5K · Self-hosted leads/appointments repository.
// Leads live in local PostgreSQL. Appointment rows are derived from visits.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEAD_STATUS_VALUES = new Set(["new", "qualified", "booked", "lost"]);
const APPOINTMENT_STATUS_VALUES = new Set(["planned", "confirmed", "completed", "cancelled"]);

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

function clinicScopeWhere({ alias = "l", clinicIds = [], allClinics = false } = {}) {
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

function safeLimit(value, fallback = 5, max = 20) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
}

function safeDate(value) {
  const text = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function safeLeadStatus(value) {
  const text = String(value ?? "").trim();
  return LEAD_STATUS_VALUES.has(text) ? text : "";
}

function safeAppointmentStatus(value) {
  const text = String(value ?? "").trim();
  return APPOINTMENT_STATUS_VALUES.has(text) ? text : "";
}

function safeSearch(value) {
  return String(value ?? "").trim().slice(0, 120);
}

export function normalizeLeadsAppointmentsParams(searchParams = new URLSearchParams()) {
  return {
    leadStatus: safeLeadStatus(searchParams.get?.("leadStatus")),
    appointmentStatus: safeAppointmentStatus(searchParams.get?.("appointmentStatus")),
    dateFrom: safeDate(searchParams.get?.("dateFrom")),
    dateTo: safeDate(searchParams.get?.("dateTo")),
    search: safeSearch(searchParams.get?.("search")),
    limit: safeLimit(searchParams.get?.("limit")),
  };
}

function leadFilterWhere(params = {}) {
  const where = [];
  if (params.leadStatus) where.push(`and l.status = ${sqlLiteral(params.leadStatus)}`);
  if (params.dateFrom) where.push(`and l.created_at::date >= ${sqlLiteral(params.dateFrom)}::date`);
  if (params.dateTo) where.push(`and l.created_at::date <= ${sqlLiteral(params.dateTo)}::date`);
  if (params.search) {
    const term = `%${params.search}%`;
    where.push(`and (
      coalesce(l.safe_summary, '') ilike ${sqlLiteral(term)}
      or coalesce(p.full_name, '') ilike ${sqlLiteral(term)}
      or coalesce(p.code, '') ilike ${sqlLiteral(term)}
    )`);
  }
  return where.join("\n    ");
}

function appointmentFilterWhere(params = {}) {
  const where = [];
  if (params.appointmentStatus) {
    where.push(`and case
      when v.status = 'draft' then 'planned'
      when v.status = 'in_progress' then 'confirmed'
      when v.status = 'signed' then 'completed'
      else 'cancelled'
    end = ${sqlLiteral(params.appointmentStatus)}`);
  }
  if (params.dateFrom) where.push(`and v.started_at::date >= ${sqlLiteral(params.dateFrom)}::date`);
  if (params.dateTo) where.push(`and v.started_at::date <= ${sqlLiteral(params.dateTo)}::date`);
  if (params.search) {
    const term = `%${params.search}%`;
    where.push(`and (
      coalesce(v.chief_complaint, '') ilike ${sqlLiteral(term)}
      or p.full_name ilike ${sqlLiteral(term)}
      or p.code ilike ${sqlLiteral(term)}
    )`);
  }
  return where.join("\n    ");
}

export function buildLeadsAppointmentsSql({
  clinicIds = [],
  allClinics = false,
  doctorUserId = null,
  leadStatus = "",
  appointmentStatus = "",
  dateFrom = "",
  dateTo = "",
  search = "",
  limit = 5,
} = {}) {
  const params = {
    leadStatus: safeLeadStatus(leadStatus),
    appointmentStatus: safeAppointmentStatus(appointmentStatus),
    dateFrom: safeDate(dateFrom),
    dateTo: safeDate(dateTo),
    search: safeSearch(search),
    limit: safeLimit(limit),
  };

  return `
with scoped_leads as (
  select
    l.id,
    l.clinic_id,
    l.patient_id,
    l.source,
    l.status,
    l.safe_summary,
    l.created_at,
    l.updated_at,
    p.full_name as patient_full_name,
    p.code as patient_code,
    c.slug as clinic_slug,
    c.name as clinic_name
  from leads l
  join clinics c on c.id = l.clinic_id
  left join patients p on p.id = l.patient_id and p.deleted_at is null
  where l.deleted_at is null
    ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
    ${leadFilterWhere(params)}
),
scoped_appointments as (
  select
    v.id,
    v.clinic_id,
    v.patient_id,
    v.doctor_user_id,
    v.status,
    case
      when v.status = 'draft' then 'planned'
      when v.status = 'in_progress' then 'confirmed'
      when v.status = 'signed' then 'completed'
      else 'cancelled'
    end as appointment_status,
    v.started_at,
    v.signed_at,
    v.chief_complaint,
    v.created_at,
    p.full_name as patient_full_name,
    p.code as patient_code,
    c.slug as clinic_slug,
    c.name as clinic_name
  from visits v
  join patients p on p.id = v.patient_id and p.deleted_at is null
  join clinics c on c.id = v.clinic_id
  where true
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
    ${doctorScopeWhere({ alias: "v", doctorUserId })}
    ${appointmentFilterWhere(params)}
)
select jsonb_build_object(
  'kpis', jsonb_build_object(
    'leadsTotal', (select count(*)::int from scoped_leads),
    'newLeads', (select count(*)::int from scoped_leads where status = 'new'),
    'qualifiedLeads', (select count(*)::int from scoped_leads where status = 'qualified'),
    'bookedLeads', (select count(*)::int from scoped_leads where status = 'booked'),
    'plannedAppointments', (
      select count(*)::int from scoped_appointments where appointment_status in ('planned', 'confirmed')
    ),
    'completedAppointments', (
      select count(*)::int from scoped_appointments where appointment_status = 'completed'
    )
  ),
  'leads', coalesce((
    select jsonb_agg(row_to_json(row) order by row."createdAt" desc)
    from (
      select
        l.id::text as "id",
        l.clinic_id::text as "clinicId",
        l.patient_id::text as "patientId",
        l.source as "source",
        l.status as "status",
        l.safe_summary as "safeSummary",
        l.created_at as "createdAt",
        l.updated_at as "updatedAt",
        l.patient_full_name as "patientFullName",
        l.patient_code as "patientCode",
        l.clinic_slug as "clinicSlug",
        l.clinic_name as "clinicName"
      from scoped_leads l
      order by l.created_at desc
      limit ${params.limit}
    ) row
  ), '[]'::jsonb),
  'appointments', coalesce((
    select jsonb_agg(row_to_json(row) order by row."slotAt" asc nulls last)
    from (
      select
        a.id::text as "id",
        a.id::text as "visitId",
        a.clinic_id::text as "clinicId",
        a.patient_id::text as "patientId",
        a.doctor_user_id::text as "doctorUserId",
        a.appointment_status as "status",
        'self_hosted' as "channel",
        a.started_at as "slotAt",
        a.signed_at as "signedAt",
        a.chief_complaint as "chiefComplaint",
        a.patient_full_name as "patientFullName",
        a.patient_code as "patientCode",
        a.clinic_slug as "clinicSlug",
        a.clinic_name as "clinicName"
      from scoped_appointments a
      order by a.started_at asc nulls last, a.created_at desc
      limit ${params.limit}
    ) row
  ), '[]'::jsonb),
  'filters', jsonb_build_object(
    'leadStatus', ${sqlLiteral(params.leadStatus || "all")},
    'appointmentStatus', ${sqlLiteral(params.appointmentStatus || "all")},
    'dateFrom', ${params.dateFrom ? sqlLiteral(params.dateFrom) : "null"},
    'dateTo', ${params.dateTo ? sqlLiteral(params.dateTo) : "null"},
    'search', ${params.search ? sqlLiteral(params.search) : "null"}
  )
)::text;
`.trim();
}

function asNumber(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLead(row = {}) {
  return {
    id: String(row.id ?? ""),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    source: String(row.source ?? "operator"),
    status: String(row.status ?? "new"),
    safeSummary: row.safeSummary == null ? null : String(row.safeSummary),
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    patient: {
      id: row.patientId ? String(row.patientId) : null,
      fullName: row.patientFullName == null ? null : String(row.patientFullName),
      code: row.patientCode == null ? null : String(row.patientCode),
    },
    clinic: {
      id: row.clinicId ? String(row.clinicId) : null,
      slug: row.clinicSlug == null ? null : String(row.clinicSlug),
      name: row.clinicName == null ? null : String(row.clinicName),
    },
  };
}

function normalizeAppointment(row = {}) {
  return {
    id: String(row.id ?? ""),
    visitId: row.visitId ? String(row.visitId) : String(row.id ?? ""),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    status: String(row.status ?? "planned"),
    channel: String(row.channel ?? "self_hosted"),
    slotAt: row.slotAt ?? null,
    signedAt: row.signedAt ?? null,
    chiefComplaint: row.chiefComplaint == null ? null : String(row.chiefComplaint),
    patient: {
      id: row.patientId ? String(row.patientId) : null,
      fullName: row.patientFullName == null ? null : String(row.patientFullName),
      code: row.patientCode == null ? null : String(row.patientCode),
    },
    clinic: {
      id: row.clinicId ? String(row.clinicId) : null,
      slug: row.clinicSlug == null ? null : String(row.clinicSlug),
      name: row.clinicName == null ? null : String(row.clinicName),
    },
  };
}

export function normalizeLeadsAppointments(input) {
  const source = input && typeof input === "object" ? input : {};
  const kpis = source.kpis && typeof source.kpis === "object" ? source.kpis : {};
  const filters = source.filters && typeof source.filters === "object" ? source.filters : {};
  return {
    kpis: {
      leadsTotal: asNumber(kpis.leadsTotal),
      newLeads: asNumber(kpis.newLeads),
      qualifiedLeads: asNumber(kpis.qualifiedLeads),
      bookedLeads: asNumber(kpis.bookedLeads),
      plannedAppointments: asNumber(kpis.plannedAppointments),
      completedAppointments: asNumber(kpis.completedAppointments),
    },
    leads: Array.isArray(source.leads) ? source.leads.map(normalizeLead).filter((lead) => lead.id) : [],
    appointments: Array.isArray(source.appointments)
      ? source.appointments.map(normalizeAppointment).filter((appointment) => appointment.id)
      : [],
    filters: {
      leadStatus: String(filters.leadStatus ?? "all"),
      appointmentStatus: String(filters.appointmentStatus ?? "all"),
      dateFrom: filters.dateFrom == null ? null : String(filters.dateFrom),
      dateTo: filters.dateTo == null ? null : String(filters.dateTo),
      search: filters.search == null ? null : String(filters.search),
    },
  };
}

export function createLeadsAppointmentsRepository(dbClient) {
  return {
    async getOverview(params) {
      const rows = await dbClient.queryJson(buildLeadsAppointmentsSql(params));
      return normalizeLeadsAppointments(Array.isArray(rows) ? rows[0] : rows);
    },
  };
}

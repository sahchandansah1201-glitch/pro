// Stage 5L · Self-hosted lead/appointment write repository.
// Writes local PostgreSQL leads and converts qualified leads into visit rows.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullableText(value) {
  return value == null || value === "" ? "null" : sqlLiteral(value);
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableUuid(value) {
  return value && UUID_PATTERN.test(String(value)) ? sqlUuid(value) : "null";
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

function leadSelect(alias = "l") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.source as "source",
    ${alias}.status as "status",
    ${alias}.safe_summary as "safeSummary",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt",
    p.full_name as "patientFullName",
    p.code as "patientCode",
    c.slug as "clinicSlug",
    c.name as "clinicName"
  `;
}

function appointmentSelect(alias = "v") {
  return `
    ${alias}.id::text as "id",
    ${alias}.id::text as "visitId",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.doctor_user_id::text as "doctorUserId",
    case
      when ${alias}.status = 'draft' then 'planned'
      when ${alias}.status = 'in_progress' then 'confirmed'
      when ${alias}.status = 'signed' then 'completed'
      else 'cancelled'
    end as "status",
    'self_hosted' as "channel",
    ${alias}.started_at as "slotAt",
    ${alias}.signed_at as "signedAt",
    ${alias}.chief_complaint as "chiefComplaint",
    p.full_name as "patientFullName",
    p.code as "patientCode",
    c.slug as "clinicSlug",
    c.name as "clinicName"
  `;
}

export function buildCreateLeadSql({
  clinicId,
  patientId = null,
  source = "operator",
  safeSummary,
  actorUserId,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with inserted as (
    insert into leads (
      clinic_id,
      patient_id,
      source,
      status,
      safe_summary,
      created_by
    )
    values (
      ${sqlUuid(clinicId)},
      ${sqlNullableUuid(patientId)},
      ${sqlLiteral(source)},
      'new',
      ${sqlLiteral(safeSummary)},
      ${sqlUuid(actorUserId)}
    )
    returning *
  )
  select
    ${leadSelect("l")}
  from inserted l
  join clinics c on c.id = l.clinic_id
  left join patients p on p.id = l.patient_id and p.deleted_at is null
) result;
`.trim();
}

export function buildUpdateLeadStatusSql({
  leadId,
  status,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with updated as (
    update leads l
    set status = ${sqlLiteral(status)},
        updated_at = now()
    where l.id = ${sqlUuid(leadId)}
      and l.deleted_at is null
      ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
    returning l.*
  )
  select
    ${leadSelect("l")}
  from updated l
  join clinics c on c.id = l.clinic_id
  left join patients p on p.id = l.patient_id and p.deleted_at is null
) result;
`.trim();
}

export function buildBookLeadAppointmentSql({
  leadId,
  clinicIds = [],
  allClinics = false,
  patientId = null,
  doctorUserId = null,
  startedAt,
  chiefComplaint = null,
} = {}) {
  const patientSql = sqlNullableUuid(patientId);
  return `
select jsonb_build_object(
  'lead', (
    select row_to_json(lead_row)
    from (
      select
        ${leadSelect("l")}
      from booked_lead l
      join clinics c on c.id = l.clinic_id
      left join patients p on p.id = l.patient_id and p.deleted_at is null
      limit 1
    ) lead_row
  ),
  'appointment', (
    select row_to_json(appointment_row)
    from (
      select
        ${appointmentSelect("v")}
      from inserted_visit v
      join clinics c on c.id = v.clinic_id
      join patients p on p.id = v.patient_id and p.deleted_at is null
      limit 1
    ) appointment_row
  )
)::text
from (
  with selected_lead as (
    select l.*
    from leads l
    where l.id = ${sqlUuid(leadId)}
      and l.deleted_at is null
      ${clinicScopeWhere({ alias: "l", clinicIds, allClinics })}
      and coalesce(${patientSql}, l.patient_id) is not null
    limit 1
  ),
  booked_lead as (
    update leads l
    set status = 'booked',
        patient_id = coalesce(${patientSql}, l.patient_id),
        updated_at = now()
    from selected_lead s
    where l.id = s.id
    returning l.*
  ),
  inserted_visit as (
    insert into visits (
      clinic_id,
      patient_id,
      doctor_user_id,
      status,
      started_at,
      chief_complaint
    )
    select
      l.clinic_id,
      l.patient_id,
      ${sqlNullableUuid(doctorUserId)},
      'draft'::visit_status,
      ${sqlLiteral(startedAt)}::timestamptz,
      ${sqlNullableText(chiefComplaint)}
    from booked_lead l
    returning *
  )
  select 1
) execution;
`.trim();
}

function normalizeLead(row = {}) {
  return {
    id: String(row.id ?? ""),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    source: String(row.source ?? "operator"),
    status: String(row.status ?? "new"),
    safeSummary: row.safeSummary ?? null,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    patient: {
      id: row.patientId ? String(row.patientId) : null,
      fullName: row.patientFullName ?? null,
      code: row.patientCode ?? null,
    },
    clinic: {
      id: row.clinicId ? String(row.clinicId) : null,
      slug: row.clinicSlug ?? null,
      name: row.clinicName ?? null,
    },
  };
}

function normalizeAppointment(row = {}) {
  return {
    id: String(row.id ?? ""),
    visitId: String(row.visitId ?? row.id ?? ""),
    clinicId: row.clinicId ? String(row.clinicId) : null,
    patientId: row.patientId ? String(row.patientId) : null,
    doctorUserId: row.doctorUserId ? String(row.doctorUserId) : null,
    status: String(row.status ?? "planned"),
    channel: String(row.channel ?? "self_hosted"),
    slotAt: row.slotAt ?? null,
    signedAt: row.signedAt ?? null,
    chiefComplaint: row.chiefComplaint ?? null,
    patient: {
      id: row.patientId ? String(row.patientId) : null,
      fullName: row.patientFullName ?? null,
      code: row.patientCode ?? null,
    },
    clinic: {
      id: row.clinicId ? String(row.clinicId) : null,
      slug: row.clinicSlug ?? null,
      name: row.clinicName ?? null,
    },
  };
}

function firstRow(rows) {
  return Array.isArray(rows) ? rows[0] : rows;
}

export function normalizeLeadMutation(input) {
  const row = firstRow(input);
  if (!row || typeof row !== "object" || !row.id) return null;
  return normalizeLead(row);
}

export function normalizeLeadBooking(input) {
  const row = firstRow(input);
  if (!row || typeof row !== "object") return null;
  const lead = row.lead && typeof row.lead === "object" ? normalizeLead(row.lead) : null;
  const appointment = row.appointment && typeof row.appointment === "object"
    ? normalizeAppointment(row.appointment)
    : null;
  return lead?.id && appointment?.id ? { lead, appointment } : null;
}

export function createLeadsAppointmentsWriteRepository(dbClient) {
  return {
    async createLead(params) {
      const rows = await dbClient.queryJson(buildCreateLeadSql(params));
      return normalizeLeadMutation(rows);
    },

    async updateLeadStatus(params) {
      const rows = await dbClient.queryJson(buildUpdateLeadStatusSql(params));
      return normalizeLeadMutation(rows);
    },

    async bookLeadAppointment(params) {
      const rows = await dbClient.queryJson(buildBookLeadAppointmentSql(params));
      return normalizeLeadBooking(rows);
    },
  };
}

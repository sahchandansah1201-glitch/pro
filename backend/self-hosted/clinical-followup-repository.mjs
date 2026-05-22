// Stage 17A-17Z · Clinical follow-up communication repository.
// SQL stays self-hosted PostgreSQL only and exposes patient-safe DTOs.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  if (!UUID_PATTERN.test(String(value || ""))) {
    throw new Error("Invalid UUID for clinical follow-up SQL.");
  }
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableUuid(value) {
  return value ? sqlUuid(value) : "null";
}

function sqlNullableText(value) {
  return value == null ? "null" : sqlLiteral(value);
}

function sqlTimestamp(value) {
  return `${sqlLiteral(value)}::timestamptz`;
}

function clampLimit(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function clampOffset(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function cleanText(value) {
  const text = value == null ? null : String(value).trim();
  return text || null;
}

function clinicScopeWhere(alias, { allClinics = false, clinicIds = [] } = {}) {
  if (allClinics) return "true";
  if (!Array.isArray(clinicIds) || clinicIds.length === 0) return "false";
  return `${alias}.clinic_id in (${clinicIds.map(sqlUuid).join(", ")})`;
}

function normalizeMessage(row = {}) {
  return {
    id: String(row.id ?? ""),
    followUpId: String(row.followUpId ?? row.follow_up_id ?? ""),
    senderRole: String(row.senderRole ?? row.sender_role ?? ""),
    direction: String(row.direction ?? ""),
    channel: String(row.channel ?? "portal"),
    deliveryState: String(row.deliveryState ?? row.delivery_state ?? "local_only"),
    patientVisible: Boolean(row.patientVisible ?? row.patient_visible ?? true),
    body: cleanText(row.body),
    createdAt: cleanText(row.createdAt ?? row.created_at),
  };
}

export function normalizeClinicalFollowUp(row = {}) {
  const latestMessage = row.latestMessage && typeof row.latestMessage === "object"
    ? normalizeMessage(row.latestMessage)
    : null;
  return {
    id: String(row.id ?? ""),
    clinicId: String(row.clinicId ?? row.clinic_id ?? ""),
    patientId: String(row.patientId ?? row.patient_id ?? ""),
    visitId: cleanText(row.visitId ?? row.visit_id),
    dueAt: cleanText(row.dueAt ?? row.due_at),
    status: String(row.status ?? "planned"),
    priority: String(row.priority ?? "normal"),
    reason: cleanText(row.reason),
    patientSummary: cleanText(row.patientSummary ?? row.patient_summary),
    internalNote: cleanText(row.internalNote ?? row.internal_note),
    lastMessageAt: cleanText(row.lastMessageAt ?? row.last_message_at),
    completedAt: cleanText(row.completedAt ?? row.completed_at),
    cancelledAt: cleanText(row.cancelledAt ?? row.cancelled_at),
    createdAt: cleanText(row.createdAt ?? row.created_at),
    updatedAt: cleanText(row.updatedAt ?? row.updated_at),
    patient: {
      id: String(row.patientId ?? row.patient_id ?? ""),
      code: cleanText(row.patientCode ?? row.patient_code),
      fullName: cleanText(row.patientFullName ?? row.patient_full_name),
    },
    visit: {
      id: cleanText(row.visitId ?? row.visit_id),
      startedAt: cleanText(row.visitStartedAt ?? row.visit_started_at),
      status: cleanText(row.visitStatus ?? row.visit_status),
    },
    latestMessage,
    messageCount: Number(row.messageCount ?? row.message_count ?? 0),
  };
}

export function normalizePatientFollowUp(row = {}) {
  const item = normalizeClinicalFollowUp(row);
  return {
    id: item.id,
    visitId: item.visitId,
    dueAt: item.dueAt,
    status: item.status,
    priority: item.priority,
    reason: item.reason,
    patientSummary: item.patientSummary,
    lastMessageAt: item.lastMessageAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    latestMessage: item.latestMessage,
    messageCount: item.messageCount,
  };
}

export function normalizeClinicalFollowUpParams(params = new URLSearchParams()) {
  return {
    limit: clampLimit(params.get("limit")),
    offset: clampOffset(params.get("offset")),
    status: cleanText(params.get("status")),
    patientId: cleanText(params.get("patientId")),
    visitId: cleanText(params.get("visitId")),
  };
}

function followUpSelect({ patientSafe = false } = {}) {
  const internalNote = patientSafe ? "null as \"internalNote\"" : "f.internal_note as \"internalNote\"";
  return `
    f.id,
    f.clinic_id as "clinicId",
    f.patient_id as "patientId",
    f.visit_id as "visitId",
    f.due_at as "dueAt",
    f.status,
    f.priority,
    f.reason,
    f.patient_summary as "patientSummary",
    ${internalNote},
    f.last_message_at as "lastMessageAt",
    f.completed_at as "completedAt",
    f.cancelled_at as "cancelledAt",
    f.created_at as "createdAt",
    f.updated_at as "updatedAt",
    p.code as "patientCode",
    p.full_name as "patientFullName",
    v.started_at as "visitStartedAt",
    v.status as "visitStatus",
    (
      select count(*)::int
      from clinical_follow_up_messages m
      where m.follow_up_id = f.id
        ${patientSafe ? "and m.patient_visible is true" : ""}
    ) as "messageCount",
    (
      select jsonb_build_object(
        'id', m.id,
        'followUpId', m.follow_up_id,
        'senderRole', m.sender_role,
        'direction', m.direction,
        'channel', m.channel,
        'deliveryState', m.delivery_state,
        'patientVisible', m.patient_visible,
        'body', m.body,
        'createdAt', m.created_at
      )
      from clinical_follow_up_messages m
      where m.follow_up_id = f.id
        ${patientSafe ? "and m.patient_visible is true" : ""}
      order by m.created_at desc
      limit 1
    ) as "latestMessage"
  `;
}

export function buildListClinicalFollowUpsSql({
  limit = 50,
  offset = 0,
  status = null,
  patientId = null,
  visitId = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const filters = [
    clinicScopeWhere("f", { allClinics, clinicIds }),
    status ? `f.status = ${sqlLiteral(status)}` : "true",
    patientId ? `f.patient_id = ${sqlUuid(patientId)}` : "true",
    visitId ? `f.visit_id = ${sqlUuid(visitId)}` : "true",
  ].join("\n    and ");
  return `
    select ${followUpSelect()}
    from clinical_follow_up_tasks f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
    where ${filters}
    order by f.due_at asc, f.created_at desc
    limit ${clampLimit(limit)}
    offset ${clampOffset(offset)}
  `;
}

export function buildCreateClinicalFollowUpSql({
  visitId,
  createdByUserId,
  dueAt,
  reason,
  patientSummary = null,
  internalNote = null,
  priority = "normal",
  assignedUserId = null,
  allClinics = false,
  clinicIds = [],
}) {
  return `
    with scoped_visit as (
      select v.id as visit_id, v.clinic_id, v.patient_id
      from visits v
      where v.id = ${sqlUuid(visitId)}
        and ${clinicScopeWhere("v", { allClinics, clinicIds })}
    ), inserted as (
      insert into clinical_follow_up_tasks (
        clinic_id,
        patient_id,
        visit_id,
        created_by_user_id,
        assigned_user_id,
        due_at,
        status,
        priority,
        reason,
        patient_summary,
        internal_note
      )
      select
        clinic_id,
        patient_id,
        visit_id,
        ${sqlUuid(createdByUserId)},
        ${sqlNullableUuid(assignedUserId)},
        ${sqlTimestamp(dueAt)},
        'planned',
        ${sqlLiteral(priority)},
        ${sqlLiteral(reason)},
        ${sqlNullableText(patientSummary)},
        ${sqlNullableText(internalNote)}
      from scoped_visit
      returning *
    )
    select ${followUpSelect()}
    from inserted f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpSql({
  followUpId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  if (changes.dueAt !== undefined) updates.push(`due_at = ${sqlTimestamp(changes.dueAt)}`);
  if (changes.status !== undefined) updates.push(`status = ${sqlLiteral(changes.status)}`);
  if (changes.priority !== undefined) updates.push(`priority = ${sqlLiteral(changes.priority)}`);
  if (changes.reason !== undefined) updates.push(`reason = ${sqlLiteral(changes.reason)}`);
  if (changes.patientSummary !== undefined) updates.push(`patient_summary = ${sqlNullableText(changes.patientSummary)}`);
  if (changes.internalNote !== undefined) updates.push(`internal_note = ${sqlNullableText(changes.internalNote)}`);
  if (changes.status === "completed") updates.push("completed_at = now()");
  if (changes.status === "cancelled") updates.push("cancelled_at = now()");
  if (updates.length === 0) updates.push("updated_at = now()");

  return `
    with updated as (
      update clinical_follow_up_tasks f
      set ${updates.join(",\n          ")}
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      returning *
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildCreateClinicalFollowUpMessageSql({
  followUpId,
  senderUserId,
  senderRole = "doctor",
  direction = "clinic_to_patient",
  channel = "portal",
  deliveryState = "local_only",
  patientVisible = true,
  body,
  allClinics = false,
  clinicIds = [],
}) {
  return `
    with scoped_follow_up as (
      select *
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
    ), inserted as (
      insert into clinical_follow_up_messages (
        follow_up_id,
        clinic_id,
        patient_id,
        visit_id,
        sender_user_id,
        sender_role,
        direction,
        channel,
        delivery_state,
        patient_visible,
        body
      )
      select
        id,
        clinic_id,
        patient_id,
        visit_id,
        ${sqlUuid(senderUserId)},
        ${sqlLiteral(senderRole)},
        ${sqlLiteral(direction)},
        ${sqlLiteral(channel)},
        ${sqlLiteral(deliveryState)},
        ${patientVisible ? "true" : "false"},
        ${sqlLiteral(body)}
      from scoped_follow_up
      returning *
    ), touched as (
      update clinical_follow_up_tasks f
      set last_message_at = (select created_at from inserted),
          status = case when f.status = 'planned' then 'sent' else f.status end
      where f.id = ${sqlUuid(followUpId)}
      returning f.*
    )
    select
      i.id,
      i.follow_up_id as "followUpId",
      i.sender_role as "senderRole",
      i.direction,
      i.channel,
      i.delivery_state as "deliveryState",
      i.patient_visible as "patientVisible",
      i.body,
      i.created_at as "createdAt"
    from inserted i
  `;
}

export function buildListPatientFollowUpsSql({ userId } = {}) {
  return `
    select ${followUpSelect({ patientSafe: true })}
    from clinical_follow_up_tasks f
    join patient_user_links pul on pul.patient_id = f.patient_id
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
    where pul.user_id = ${sqlUuid(userId)}
      and f.status <> 'cancelled'
    order by f.due_at asc, f.created_at desc
    limit 100
  `;
}

export function buildCreatePatientFollowUpMessageSql({
  userId,
  followUpId,
  body,
}) {
  return `
    with scoped_follow_up as (
      select f.*
      from clinical_follow_up_tasks f
      join patient_user_links pul on pul.patient_id = f.patient_id
      where pul.user_id = ${sqlUuid(userId)}
        and f.id = ${sqlUuid(followUpId)}
        and f.status <> 'cancelled'
    ), inserted as (
      insert into clinical_follow_up_messages (
        follow_up_id,
        clinic_id,
        patient_id,
        visit_id,
        sender_user_id,
        sender_role,
        direction,
        channel,
        delivery_state,
        patient_visible,
        body
      )
      select
        id,
        clinic_id,
        patient_id,
        visit_id,
        ${sqlUuid(userId)},
        'patient',
        'patient_to_clinic',
        'portal',
        'local_only',
        true,
        ${sqlLiteral(body)}
      from scoped_follow_up
      returning *
    ), touched as (
      update clinical_follow_up_tasks f
      set last_message_at = (select created_at from inserted),
          status = case when f.status in ('planned', 'sent') then 'acknowledged' else f.status end
      where f.id = ${sqlUuid(followUpId)}
      returning f.*
    )
    select
      i.id,
      i.follow_up_id as "followUpId",
      i.sender_role as "senderRole",
      i.direction,
      i.channel,
      i.delivery_state as "deliveryState",
      i.patient_visible as "patientVisible",
      i.body,
      i.created_at as "createdAt"
    from inserted i
  `;
}

export function createClinicalFollowUpRepository(dbClient) {
  return {
    async listClinicalFollowUps(params) {
      const rows = await dbClient.queryJson(buildListClinicalFollowUpsSql(params));
      return {
        items: rows.map(normalizeClinicalFollowUp).filter((item) => item.id),
        limit: clampLimit(params?.limit),
        offset: clampOffset(params?.offset),
        source: "postgres",
      };
    },
    async createClinicalFollowUp(params) {
      const rows = await dbClient.queryJson(buildCreateClinicalFollowUpSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUp(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async createClinicalFollowUpMessage(params) {
      const rows = await dbClient.queryJson(buildCreateClinicalFollowUpMessageSql(params));
      return rows[0] ? normalizeMessage(rows[0]) : null;
    },
    async listPatientFollowUps(params) {
      const rows = await dbClient.queryJson(buildListPatientFollowUpsSql(params));
      return {
        items: rows.map(normalizePatientFollowUp).filter((item) => item.id),
        source: "postgres",
      };
    },
    async createPatientFollowUpMessage(params) {
      const rows = await dbClient.queryJson(buildCreatePatientFollowUpMessageSql(params));
      return rows[0] ? normalizeMessage(rows[0]) : null;
    },
  };
}

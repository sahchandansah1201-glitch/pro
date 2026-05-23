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

function sqlNullableTimestamp(value) {
  return value ? sqlTimestamp(value) : "null";
}

function sqlTimestamp(value) {
  return `${sqlLiteral(value)}::timestamptz`;
}

function sqlJson(value) {
  return `${sqlLiteral(JSON.stringify(value && typeof value === "object" && !Array.isArray(value) ? value : {}))}::jsonb`;
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

function cleanObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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
    triageState: String(row.triageState ?? row.triage_state ?? "new"),
    escalationLevel: String(row.escalationLevel ?? row.escalation_level ?? "none"),
    slaDueAt: cleanText(row.slaDueAt ?? row.sla_due_at),
    deliveryState: String(row.deliveryState ?? row.delivery_state ?? "not_required"),
    deliveryAttempts: Number(row.deliveryAttempts ?? row.delivery_attempts ?? 0),
    lastDeliveryAttemptAt: cleanText(row.lastDeliveryAttemptAt ?? row.last_delivery_attempt_at),
    deliveryEvidence: cleanObject(row.deliveryEvidence ?? row.delivery_evidence),
    operationsNote: cleanText(row.operationsNote ?? row.operations_note),
    resolutionOutcome: cleanText(row.resolutionOutcome ?? row.resolution_outcome) || "not_reviewed",
    qualityReviewState: cleanText(row.qualityReviewState ?? row.quality_review_state) || "pending",
    qualityReviewNote: cleanText(row.qualityReviewNote ?? row.quality_review_note),
    qualityReviewedAt: cleanText(row.qualityReviewedAt ?? row.quality_reviewed_at),
    resolvedAt: cleanText(row.resolvedAt ?? row.resolved_at),
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

export function normalizeClinicalFollowUpOperationsParams(params = new URLSearchParams()) {
  return {
    limit: clampLimit(params.get("limit")),
    offset: clampOffset(params.get("offset")),
    triageState: cleanText(params.get("triageState")),
    escalationLevel: cleanText(params.get("escalationLevel")),
    deliveryState: cleanText(params.get("deliveryState")),
    patientId: cleanText(params.get("patientId")),
    visitId: cleanText(params.get("visitId")),
    overdueOnly: params.get("overdueOnly") === "true",
    now: cleanText(params.get("now")),
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
    f.triage_state as "triageState",
    f.escalation_level as "escalationLevel",
    f.sla_due_at as "slaDueAt",
    f.delivery_state as "deliveryState",
    f.delivery_attempts as "deliveryAttempts",
    f.last_delivery_attempt_at as "lastDeliveryAttemptAt",
    f.delivery_evidence as "deliveryEvidence",
    f.operations_note as "operationsNote",
    coalesce(f.resolution_outcome, 'not_reviewed') as "resolutionOutcome",
    coalesce(f.quality_review_state, 'pending') as "qualityReviewState",
    f.quality_review_note as "qualityReviewNote",
    f.quality_reviewed_at as "qualityReviewedAt",
    f.resolved_at as "resolvedAt",
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

export function buildListClinicalFollowUpOperationsSql({
  limit = 50,
  offset = 0,
  triageState = null,
  escalationLevel = null,
  deliveryState = null,
  patientId = null,
  visitId = null,
  overdueOnly = false,
  now = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const nowExpression = now ? sqlTimestamp(now) : "now()";
  const filters = [
    clinicScopeWhere("f", { allClinics, clinicIds }),
    "f.status not in ('completed', 'cancelled')",
    triageState ? `f.triage_state = ${sqlLiteral(triageState)}` : "true",
    escalationLevel ? `f.escalation_level = ${sqlLiteral(escalationLevel)}` : "true",
    deliveryState ? `f.delivery_state = ${sqlLiteral(deliveryState)}` : "true",
    patientId ? `f.patient_id = ${sqlUuid(patientId)}` : "true",
    visitId ? `f.visit_id = ${sqlUuid(visitId)}` : "true",
    overdueOnly ? `coalesce(f.sla_due_at, f.due_at) < ${nowExpression}` : "true",
  ].join("\n    and ");
  return `
    select ${followUpSelect()}
    from clinical_follow_up_tasks f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
    where ${filters}
    order by
      case when coalesce(f.sla_due_at, f.due_at) < ${nowExpression} then 0 else 1 end,
      coalesce(f.sla_due_at, f.due_at) asc,
      f.priority desc,
      f.created_at desc
    limit ${clampLimit(limit)}
    offset ${clampOffset(offset)}
  `;
}

export function buildClinicalFollowUpOperationsSummarySql({
  now = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const nowExpression = now ? sqlTimestamp(now) : "now()";
  return `
    select
      count(*)::int as "totalOpen",
      count(*) filter (where coalesce(f.sla_due_at, f.due_at) < ${nowExpression})::int as overdue,
      count(*) filter (where f.triage_state = 'waiting_patient')::int as "waitingPatient",
      count(*) filter (where f.triage_state = 'escalated' or f.escalation_level <> 'none')::int as escalated,
      count(*) filter (where f.delivery_state = 'failed')::int as "deliveryFailed",
      count(*) filter (where f.delivery_state = 'pending')::int as "deliveryPending"
    from clinical_follow_up_tasks f
    where ${clinicScopeWhere("f", { allClinics, clinicIds })}
      and f.status not in ('completed', 'cancelled')
  `;
}

export function buildClinicalFollowUpOutcomeQualitySummarySql({
  now = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const nowExpression = now ? sqlTimestamp(now) : "now()";
  return `
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where f.status = 'completed' or f.triage_state = 'resolved')::int as "closedFollowUps",
      count(*) filter (where f.status not in ('completed', 'cancelled') and coalesce(f.sla_due_at, f.due_at) < ${nowExpression})::int as "openOverdue",
      count(*) filter (where f.status not in ('completed', 'cancelled') and f.escalation_level <> 'none')::int as "openEscalated",
      count(*) filter (where f.status in ('completed', 'cancelled') and coalesce(f.delivery_evidence, '{}'::jsonb) <> '{}'::jsonb)::int as "closedWithEvidence",
      count(*) filter (where f.status in ('completed', 'cancelled') and coalesce(f.delivery_evidence, '{}'::jsonb) = '{}'::jsonb)::int as "closedMissingEvidence",
      count(*) filter (where coalesce(f.quality_review_state, 'pending') = 'reviewed')::int as "qualityReviewed",
      count(*) filter (where coalesce(f.quality_review_state, 'pending') = 'pending')::int as "qualityPending",
      count(*) filter (where coalesce(f.quality_review_state, 'pending') = 'needs_attention')::int as "qualityNeedsAttention",
      count(*) filter (where coalesce(f.resolution_outcome, 'not_reviewed') = 'patient_reached')::int as "patientReached",
      count(*) filter (where coalesce(f.resolution_outcome, 'not_reviewed') = 'clinical_escalation')::int as "clinicalEscalations",
      count(*) filter (where f.delivery_state = 'failed')::int as "deliveryFailures"
    from clinical_follow_up_tasks f
    where ${clinicScopeWhere("f", { allClinics, clinicIds })}
  `;
}

export function buildUpdateClinicalFollowUpOperationsSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  if (changes.triageState !== undefined) updates.push(`triage_state = ${sqlLiteral(changes.triageState)}`);
  if (changes.escalationLevel !== undefined) updates.push(`escalation_level = ${sqlLiteral(changes.escalationLevel)}`);
  if (changes.slaDueAt !== undefined) updates.push(`sla_due_at = ${sqlNullableTimestamp(changes.slaDueAt)}`);
  if (changes.deliveryState !== undefined) updates.push(`delivery_state = ${sqlLiteral(changes.deliveryState)}`);
  if (changes.deliveryEvidence !== undefined) updates.push(`delivery_evidence = ${sqlJson(changes.deliveryEvidence)}`);
  if (changes.operationsNote !== undefined) updates.push(`operations_note = ${sqlNullableText(changes.operationsNote)}`);
  if (changes.deliveryState !== undefined) {
    updates.push("delivery_attempts = delivery_attempts + 1");
    updates.push("last_delivery_attempt_at = now()");
  }
  if (changes.triageState === "resolved") {
    updates.push(`resolved_by_user_id = ${sqlUuid(actorUserId)}`);
    updates.push("resolved_at = now()");
    updates.push("status = case when status in ('planned', 'in_progress', 'sent', 'acknowledged') then 'completed' else status end");
    updates.push("completed_at = coalesce(completed_at, now())");
  }
  updates.push("updated_at = now()");

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set ${updates.join(",\n          ")}
      from previous p
      where f.id = p.id
      returning f.*, p.triage_state as previous_triage_state, p.escalation_level as previous_escalation_level, p.delivery_state as previous_delivery_state
    ), event as (
      insert into clinical_follow_up_operations_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        note
      )
      select
        id,
        clinic_id,
        ${sqlUuid(actorUserId)},
        'operations.update',
        jsonb_build_object(
          'triageState', previous_triage_state,
          'escalationLevel', previous_escalation_level,
          'deliveryState', previous_delivery_state
        ),
        jsonb_build_object(
          'triageState', triage_state,
          'escalationLevel', escalation_level,
          'deliveryState', delivery_state
        ),
        ${sqlNullableText(changes.operationsNote)}
      from updated
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpQualitySql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  if (changes.resolutionOutcome !== undefined) {
    updates.push(`resolution_outcome = ${sqlLiteral(changes.resolutionOutcome)}`);
  }
  if (changes.qualityReviewState !== undefined) {
    updates.push(`quality_review_state = ${sqlLiteral(changes.qualityReviewState)}`);
  }
  if (changes.qualityReviewNote !== undefined) {
    updates.push(`quality_review_note = ${sqlNullableText(changes.qualityReviewNote)}`);
  }
  updates.push(`quality_reviewed_by_user_id = ${sqlUuid(actorUserId)}`);
  updates.push("quality_reviewed_at = now()");
  updates.push("updated_at = now()");

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set ${updates.join(",\n          ")}
      from previous p
      where f.id = p.id
      returning f.*,
        p.resolution_outcome as previous_resolution_outcome,
        p.quality_review_state as previous_quality_review_state
    ), event as (
      insert into clinical_follow_up_quality_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        note
      )
      select
        id,
        clinic_id,
        ${sqlUuid(actorUserId)},
        'quality.update',
        jsonb_build_object(
          'resolutionOutcome', coalesce(previous_resolution_outcome, 'not_reviewed'),
          'qualityReviewState', coalesce(previous_quality_review_state, 'pending')
        ),
        jsonb_build_object(
          'resolutionOutcome', coalesce(resolution_outcome, 'not_reviewed'),
          'qualityReviewState', coalesce(quality_review_state, 'pending')
        ),
        ${sqlNullableText(changes.qualityReviewNote)}
      from updated
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
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
    async listClinicalFollowUpOperations(params) {
      const rows = await dbClient.queryJson(buildListClinicalFollowUpOperationsSql(params));
      return {
        items: rows.map(normalizeClinicalFollowUp).filter((item) => item.id),
        limit: clampLimit(params?.limit),
        offset: clampOffset(params?.offset),
        source: "postgres",
      };
    },
    async getClinicalFollowUpOperationsSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpOperationsSummarySql(params));
      const row = rows[0] || {};
      return {
        totalOpen: Number(row.totalOpen ?? row.total_open ?? 0),
        overdue: Number(row.overdue ?? 0),
        waitingPatient: Number(row.waitingPatient ?? row.waiting_patient ?? 0),
        escalated: Number(row.escalated ?? 0),
        deliveryFailed: Number(row.deliveryFailed ?? row.delivery_failed ?? 0),
        deliveryPending: Number(row.deliveryPending ?? row.delivery_pending ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpOutcomeQualitySummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpOutcomeQualitySummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        closedFollowUps: Number(row.closedFollowUps ?? row.closed_follow_ups ?? 0),
        openOverdue: Number(row.openOverdue ?? row.open_overdue ?? 0),
        openEscalated: Number(row.openEscalated ?? row.open_escalated ?? 0),
        closedWithEvidence: Number(row.closedWithEvidence ?? row.closed_with_evidence ?? 0),
        closedMissingEvidence: Number(row.closedMissingEvidence ?? row.closed_missing_evidence ?? 0),
        qualityReviewed: Number(row.qualityReviewed ?? row.quality_reviewed ?? 0),
        qualityPending: Number(row.qualityPending ?? row.quality_pending ?? 0),
        qualityNeedsAttention: Number(row.qualityNeedsAttention ?? row.quality_needs_attention ?? 0),
        patientReached: Number(row.patientReached ?? row.patient_reached ?? 0),
        clinicalEscalations: Number(row.clinicalEscalations ?? row.clinical_escalations ?? 0),
        deliveryFailures: Number(row.deliveryFailures ?? row.delivery_failures ?? 0),
        source: "postgres",
      };
    },
    async updateClinicalFollowUpOperations(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpOperationsSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpQuality(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpQualitySql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
  };
}

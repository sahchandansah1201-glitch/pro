// Stage 5N/5O · Self-hosted patient portal repository.
// Patient-facing reads and writes are scoped by patient_user_links. Reports
// expose only patient-safe text; physician-only report text is intentionally absent.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableText(value) {
  return value == null || value === "" ? "null" : sqlLiteral(value);
}

function sqlNullableTimestamp(value) {
  return value == null || value === "" ? "null" : `${sqlLiteral(value)}::timestamptz`;
}

function safeUuid(value) {
  const text = String(value || "");
  return UUID_PATTERN.test(text) ? text : "00000000-0000-4000-8000-000000000000";
}

function textOrNull(value) {
  return value == null ? null : String(value);
}

function safeNested(input, key) {
  return input && typeof input === "object" && input[key] && typeof input[key] === "object"
    ? input[key]
    : {};
}

function normalizePatient(input = {}) {
  const clinic = safeNested(input, "clinic");
  return {
    id: String(input.id ?? ""),
    code: textOrNull(input.code),
    fullName: textOrNull(input.fullName),
    birthDate: textOrNull(input.birthDate),
    sex: textOrNull(input.sex),
    phototype: textOrNull(input.phototype),
    imagingConsent: Boolean(input.imagingConsent),
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
  };
}

function normalizeAppointment(input = {}) {
  if (!input || typeof input !== "object" || !input.id) return null;
  const clinic = safeNested(input, "clinic");
  return {
    id: String(input.id),
    visitId: String(input.visitId ?? input.id),
    status: String(input.status ?? "planned"),
    startedAt: textOrNull(input.startedAt),
    signedAt: textOrNull(input.signedAt),
    chiefComplaint: textOrNull(input.chiefComplaint),
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
  };
}

function normalizeReport(input = {}) {
  if (!input || typeof input !== "object" || !input.id) return null;
  const clinic = safeNested(input, "clinic");
  const doctor = safeNested(input, "doctor");
  const safeText = textOrNull(input.patientSafeText);
  return {
    id: String(input.id),
    visitId: textOrNull(input.visitId),
    status: String(input.status ?? "signed"),
    visitDate: textOrNull(input.visitDate),
    signedAt: textOrNull(input.signedAt),
    summary: textOrNull(input.summary) || safeText?.slice(0, 160) || null,
    patientSafeText: safeText,
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
    doctor: {
      id: textOrNull(doctor.id),
      displayName: textOrNull(doctor.displayName),
    },
  };
}

function normalizeReminder(input = {}) {
  return {
    id: String(input.id ?? ""),
    source: String(input.source ?? "appointment"),
    title: String(input.title ?? "Напоминание"),
    dueAt: textOrNull(input.dueAt),
    status: String(input.status ?? "active"),
  };
}

function normalizeReminderPreferences(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    appointmentRemindersEnabled: source.appointmentRemindersEnabled == null
      ? true
      : Boolean(source.appointmentRemindersEnabled),
    reportNotificationsEnabled: source.reportNotificationsEnabled == null
      ? true
      : Boolean(source.reportNotificationsEnabled),
    preferredChannel: String(source.preferredChannel ?? "email"),
    updatedAt: textOrNull(source.updatedAt),
  };
}

function normalizeBookingRequest(input = {}) {
  if (!input || typeof input !== "object" || !input.id) return null;
  const clinic = safeNested(input, "clinic");
  return {
    id: String(input.id),
    status: String(input.status ?? "requested"),
    preferredFrom: textOrNull(input.preferredFrom),
    preferredTo: textOrNull(input.preferredTo),
    reason: textOrNull(input.reason),
    createdAt: textOrNull(input.createdAt),
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
  };
}

function numberOrZero(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanValue(value, fallback = false) {
  if (value == null) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizePhotoProtocolPhoto(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    sequence: numberOrZero(source.sequence),
    kind: String(source.kind ?? "photo"),
    contentType: textOrNull(source.contentType),
    capturedAt: textOrNull(source.capturedAt),
    lesionLabel: textOrNull(source.lesionLabel),
    bodyZone: textOrNull(source.bodyZone),
    bodySurface: textOrNull(source.bodySurface),
    previewAvailable: false,
  };
}

function normalizePhotoProtocolAuditEntry(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    kind: String(source.kind ?? "event"),
    label: String(source.label ?? "Событие доступа"),
    occurredAt: textOrNull(source.occurredAt),
  };
}

export function normalizePatientPortalPhotoProtocol(input) {
  if (!input || typeof input !== "object" || !input.id) return null;
  const clinic = safeNested(input, "clinic");
  const counts = safeNested(input, "counts");
  const deliveryBoundary = safeNested(input, "deliveryBoundary");
  const selectedPhotoCount = numberOrZero(input.selectedPhotoCount ?? counts.selectedPhotos);
  const overviewPhotoCount = numberOrZero(input.overviewPhotoCount ?? counts.overviewPhotos);
  const dermoscopyPhotoCount = numberOrZero(input.dermoscopyPhotoCount ?? counts.dermoscopyPhotos);
  const reportAttachmentCount = numberOrZero(input.reportAttachmentCount ?? counts.reportAttachments);
  const status = String(input.status ?? "prepared");
  const accessStatus = textOrNull(input.accessStatus) || (
    status === "prepared" ? "metadata_ready_delivery_blocked" : status
  );
  return {
    id: String(input.id),
    visitId: textOrNull(input.visitId),
    reportId: textOrNull(input.reportId),
    status,
    accessStatus,
    selectedPhotoCount,
    counts: {
      selectedPhotos: selectedPhotoCount,
      overviewPhotos: overviewPhotoCount,
      dermoscopyPhotos: dermoscopyPhotoCount,
      reportAttachments: reportAttachmentCount,
    },
    preparedAt: textOrNull(input.preparedAt),
    revokedAt: textOrNull(input.revokedAt),
    expiresAt: textOrNull(input.expiresAt),
    blockerCount: numberOrZero(input.blockerCount),
    patientSafeTextAvailable: Boolean(input.patientSafeTextAvailable),
    availabilityMessages: Array.isArray(input.availabilityMessages)
      ? input.availabilityMessages.map(String)
      : ["Файлы фото закрыты backend-контуром до включения защищённой выдачи."],
    auditTrail: Array.isArray(input.auditTrail)
      ? input.auditTrail.map(normalizePhotoProtocolAuditEntry)
      : [],
    deliveryBoundary: {
      patientDeliveryAllowed: false,
      rawFilesExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      tokensExposed: false,
      doctorOnlyTextExposed: false,
      fileProxyReady: booleanValue(deliveryBoundary.fileProxyReady),
      requiresIdentityCheck: deliveryBoundary.requiresIdentityCheck !== false,
      requiresRetentionPolicy: deliveryBoundary.requiresRetentionPolicy !== false,
      requiresApprovedPatientCopy: deliveryBoundary.requiresApprovedPatientCopy !== false,
    },
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
    photos: Array.isArray(input.photos)
      ? input.photos.map(normalizePhotoProtocolPhoto).filter((item) => item.sequence > 0)
      : [],
  };
}

export function normalizePatientPortalOverview(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    patient: normalizePatient(source.patient || {}),
    nextAppointment: normalizeAppointment(source.nextAppointment || null),
    reports: Array.isArray(source.reports)
      ? source.reports.map(normalizeReport).filter(Boolean)
      : [],
    reminders: Array.isArray(source.reminders)
      ? source.reminders.map(normalizeReminder).filter((item) => item.id)
      : [],
    reminderPreferences: normalizeReminderPreferences(source.reminderPreferences || {}),
    bookingRequests: Array.isArray(source.bookingRequests)
      ? source.bookingRequests.map(normalizeBookingRequest).filter(Boolean)
      : [],
  };
}

export function normalizePatientPortalReport(input) {
  return normalizeReport(input);
}

export function buildPatientPortalOverviewSql({ userId } = {}) {
  const safeUserId = safeUuid(userId);
  return `
with portal_patient as (
  select
    p.id,
    p.clinic_id,
    p.code,
    p.full_name,
    p.birth_date,
    p.sex,
    p.phototype,
    p.imaging_consent,
    c.slug as clinic_slug,
    c.name as clinic_name
  from patient_user_links pul
  join patients p on p.id = pul.patient_id and p.deleted_at is null
  join clinics c on c.id = p.clinic_id
  where pul.user_id = ${sqlUuid(safeUserId)}
  order by pul.created_at asc
  limit 1
),
next_visit as (
  select
    v.id,
    v.status,
    v.started_at,
    v.signed_at,
    v.chief_complaint,
    c.id as clinic_id,
    c.slug as clinic_slug,
    c.name as clinic_name
  from visits v
  join portal_patient pp on pp.id = v.patient_id
  join clinics c on c.id = v.clinic_id
  where v.started_at is not null
    and v.started_at >= now() - interval '1 day'
    and v.status in ('draft', 'in_progress')
  order by v.started_at asc
  limit 1
),
safe_reports as (
  select
    r.id,
    r.visit_id,
    r.status,
    v.started_at as visit_date,
    r.signed_at,
    r.patient_safe_text,
    left(coalesce(r.patient_safe_text, ''), 180) as summary,
    c.id as clinic_id,
    c.slug as clinic_slug,
    c.name as clinic_name,
    u.id as doctor_user_id,
    u.display_name as doctor_display_name
  from reports r
  join portal_patient pp on pp.id = r.patient_id
  left join visits v on v.id = r.visit_id
  left join clinics c on c.id = r.clinic_id
  left join app_users u on u.id = r.doctor_user_id
  where r.status = 'signed'
    and r.patient_safe_text is not null
  order by coalesce(r.signed_at, r.updated_at, r.created_at) desc
  limit 20
),
reminder_preferences as (
  select
    pref.appointment_reminders_enabled,
    pref.report_notifications_enabled,
    pref.preferred_channel,
    pref.updated_at
  from patient_portal_reminder_preferences pref
  join portal_patient pp on pp.id = pref.patient_id
  where pref.user_id = ${sqlUuid(safeUserId)}
  limit 1
),
booking_requests as (
  select
    br.id,
    br.status,
    br.preferred_from,
    br.preferred_to,
    br.reason,
    br.created_at,
    c.id as clinic_id,
    c.slug as clinic_slug,
    c.name as clinic_name
  from patient_portal_booking_requests br
  join portal_patient pp on pp.id = br.patient_id
  join clinics c on c.id = br.clinic_id
  order by br.created_at desc
  limit 10
)
select jsonb_build_object(
  'patient', coalesce((
    select jsonb_build_object(
      'id', pp.id::text,
      'code', pp.code,
      'fullName', pp.full_name,
      'birthDate', pp.birth_date,
      'sex', pp.sex,
      'phototype', pp.phototype,
      'imagingConsent', pp.imaging_consent,
      'clinic', jsonb_build_object(
        'id', pp.clinic_id::text,
        'slug', pp.clinic_slug,
        'name', pp.clinic_name
      )
    )
    from portal_patient pp
  ), '{}'::jsonb),
  'nextAppointment', (
    select jsonb_build_object(
      'id', nv.id::text,
      'visitId', nv.id::text,
      'status', nv.status,
      'startedAt', nv.started_at,
      'signedAt', nv.signed_at,
      'chiefComplaint', nv.chief_complaint,
      'clinic', jsonb_build_object(
        'id', nv.clinic_id::text,
        'slug', nv.clinic_slug,
        'name', nv.clinic_name
      )
    )
    from next_visit nv
  ),
  'reports', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', sr.id::text,
      'visitId', sr.visit_id::text,
      'status', sr.status,
      'visitDate', sr.visit_date,
      'signedAt', sr.signed_at,
      'patientSafeText', sr.patient_safe_text,
      'summary', sr.summary,
      'clinic', jsonb_build_object(
        'id', sr.clinic_id::text,
        'slug', sr.clinic_slug,
        'name', sr.clinic_name
      ),
      'doctor', jsonb_build_object(
        'id', sr.doctor_user_id::text,
        'displayName', sr.doctor_display_name
      )
    ) order by sr.signed_at desc nulls last)
    from safe_reports sr
  ), '[]'::jsonb),
  'reminders', coalesce((
    select jsonb_agg(item order by item->>'dueAt' asc)
    from (
      select jsonb_build_object(
        'id', 'appointment:' || nv.id::text,
        'source', 'appointment',
        'title', 'Ближайший приём',
        'dueAt', nv.started_at,
        'status', 'active'
      ) as item
      from next_visit nv
      union all
      select jsonb_build_object(
        'id', 'report:' || sr.id::text,
        'source', 'report',
        'title', 'Новое заключение доступно',
        'dueAt', sr.signed_at,
        'status', 'active'
      ) as item
      from safe_reports sr
      where sr.signed_at is not null
      limit 5
    ) reminders
  ), '[]'::jsonb),
  'reminderPreferences', coalesce((
    select jsonb_build_object(
      'appointmentRemindersEnabled', rp.appointment_reminders_enabled,
      'reportNotificationsEnabled', rp.report_notifications_enabled,
      'preferredChannel', rp.preferred_channel,
      'updatedAt', rp.updated_at
    )
    from reminder_preferences rp
  ), jsonb_build_object(
    'appointmentRemindersEnabled', true,
    'reportNotificationsEnabled', true,
    'preferredChannel', 'email',
    'updatedAt', null
  )),
  'bookingRequests', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', br.id::text,
      'status', br.status,
      'preferredFrom', br.preferred_from,
      'preferredTo', br.preferred_to,
      'reason', br.reason,
      'createdAt', br.created_at,
      'clinic', jsonb_build_object(
        'id', br.clinic_id::text,
        'slug', br.clinic_slug,
        'name', br.clinic_name
      )
    ) order by br.created_at desc)
    from booking_requests br
  ), '[]'::jsonb)
)::text;
`.trim();
}

export function buildPatientPortalReportSql({ userId, reportId } = {}) {
  const safeUserId = safeUuid(userId);
  const safeReportId = safeUuid(reportId);
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    r.id::text as "id",
    r.visit_id::text as "visitId",
    r.status as "status",
    v.started_at as "visitDate",
    r.signed_at as "signedAt",
    r.patient_safe_text as "patientSafeText",
    left(coalesce(r.patient_safe_text, ''), 180) as "summary",
    jsonb_build_object(
      'id', c.id::text,
      'slug', c.slug,
      'name', c.name
    ) as "clinic",
    jsonb_build_object(
      'id', u.id::text,
      'displayName', u.display_name
    ) as "doctor"
  from reports r
  join patient_user_links pul on pul.patient_id = r.patient_id
  left join visits v on v.id = r.visit_id
  left join clinics c on c.id = r.clinic_id
  left join app_users u on u.id = r.doctor_user_id
  where pul.user_id = ${sqlUuid(safeUserId)}
    and r.id = ${sqlUuid(safeReportId)}
    and r.status = 'signed'
    and r.patient_safe_text is not null
  limit 1
) result;
`.trim();
}

export function buildPatientPortalPhotoProtocolSql({ userId, visitId } = {}) {
  const safeUserId = safeUuid(userId);
  const safeVisitId = safeUuid(visitId);
  return `
with linked_release as (
  select
    r.id,
    r.clinic_id,
    r.patient_id,
    r.visit_id,
    r.report_id,
    r.status,
    r.selected_photo_count,
    r.overview_photo_count,
    r.dermoscopy_photo_count,
    r.report_attachment_count,
    cardinality(r.release_blockers) as blocker_count,
    r.prepared_at,
    r.revoked_at,
    r.expires_at,
    coalesce((r.metadata_json ->> 'patientFileProxyEnabled')::boolean, false) as file_proxy_enabled,
    coalesce((r.metadata_json ->> 'patientCopyApproved')::boolean, false) as patient_copy_approved,
    c.slug as clinic_slug,
    c.name as clinic_name,
    nullif(trim(coalesce(rep.patient_safe_text, '')), '') is not null as patient_safe_text_available
  from patient_photo_protocol_releases r
  join patient_user_links pul on pul.patient_id = r.patient_id
  join visits v on v.id = r.visit_id and v.patient_id = r.patient_id and v.clinic_id = r.clinic_id
  join clinics c on c.id = r.clinic_id
  left join reports rep on rep.id = r.report_id and rep.patient_id = r.patient_id and rep.clinic_id = r.clinic_id
  where pul.user_id = ${sqlUuid(safeUserId)}
    and r.visit_id = ${sqlUuid(safeVisitId)}
    and r.status in ('prepared', 'revoked')
  limit 1
),
safe_assets as (
  select
    row_number() over (order by a.captured_at asc nulls last, a.created_at asc) as sequence,
    a.kind::text as kind,
    a.content_type,
    a.captured_at,
    l.label as lesion_label,
    l.body_zone,
    l.body_surface
  from clinical_assets a
  join linked_release lr on lr.visit_id = a.visit_id and lr.patient_id = a.patient_id and lr.clinic_id = a.clinic_id
  left join lesions l on l.id = a.lesion_id and l.patient_id = a.patient_id and l.clinic_id = a.clinic_id
  where a.kind in ('overview_photo', 'dermoscopy', 'report_attachment')
  order by a.captured_at asc nulls last, a.created_at asc
  limit 200
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    lr.id::text as "id",
    lr.visit_id::text as "visitId",
    lr.report_id::text as "reportId",
    lr.status as "status",
    case
      when lr.status = 'revoked' then 'revoked'
      when lr.file_proxy_enabled
        and lr.expires_at is not null
        and lr.patient_copy_approved
        and lr.patient_safe_text_available
        then 'delivery_policy_ready'
      when lr.status = 'prepared' then 'metadata_ready_policy_blocked'
      else lr.status
    end as "accessStatus",
    lr.selected_photo_count as "selectedPhotoCount",
    lr.overview_photo_count as "overviewPhotoCount",
    lr.dermoscopy_photo_count as "dermoscopyPhotoCount",
    lr.report_attachment_count as "reportAttachmentCount",
    lr.blocker_count as "blockerCount",
    lr.prepared_at as "preparedAt",
    lr.revoked_at as "revokedAt",
    lr.expires_at as "expiresAt",
    lr.patient_safe_text_available as "patientSafeTextAvailable",
    jsonb_build_object(
      'id', lr.clinic_id::text,
      'slug', lr.clinic_slug,
      'name', lr.clinic_name
    ) as "clinic",
    array_remove(array[
      case when lr.status = 'revoked' then 'Доступ к фото отозван клиникой.' end,
      case when not lr.file_proxy_enabled then 'Клиника не включила защищённую выдачу фото.' end,
      case when lr.expires_at is null then 'Клиника не задала срок доступа к фото.' end,
      case
        when not lr.patient_copy_approved or not lr.patient_safe_text_available
          then 'Клиника не завершила проверку безопасного текста для пациента.'
      end,
      'Открытие фото выполняется только через защищённый backend-контур.'
    ], null)::text[] as "availabilityMessages",
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'kind', event.kind,
        'label', event.label,
        'occurredAt', event.occurred_at
      ) order by event.sort_order)
      from (
        values
          (1, 'prepared', lr.prepared_at, 'Фото-протокол подготовлен клиникой'),
          (2, 'expires', lr.expires_at, 'Срок доступа установлен backend'),
          (3, 'revoked', lr.revoked_at, 'Доступ отозван клиникой')
      ) as event(sort_order, kind, occurred_at, label)
      where event.occurred_at is not null
    ), '[]'::jsonb) as "auditTrail",
    jsonb_build_object(
      'patientDeliveryAllowed', false,
      'rawFilesExposed', false,
      'signedUrlsIssued', false,
      'storagePathsExposed', false,
      'tokensExposed', false,
      'doctorOnlyTextExposed', false,
      'fileProxyReady', lr.file_proxy_enabled,
      'requiresIdentityCheck', true,
      'requiresRetentionPolicy', lr.expires_at is null,
      'requiresApprovedPatientCopy', (not lr.patient_copy_approved) or (not lr.patient_safe_text_available)
    ) as "deliveryBoundary",
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'sequence', sa.sequence,
        'kind', sa.kind,
        'contentType', sa.content_type,
        'capturedAt', sa.captured_at,
        'lesionLabel', sa.lesion_label,
        'bodyZone', sa.body_zone,
        'bodySurface', sa.body_surface,
        'previewAvailable', false
      ) order by sa.sequence)
      from safe_assets sa
    ), '[]'::jsonb) as "photos"
  from linked_release lr
  limit 1
) result;
`.trim();
}

export function buildCreatePatientPortalBookingRequestSql({
  userId,
  preferredFrom,
  preferredTo = null,
  reason = null,
} = {}) {
  const safeUserId = safeUuid(userId);
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with portal_patient as (
    select
      p.id as patient_id,
      p.clinic_id
    from patient_user_links pul
    join patients p on p.id = pul.patient_id and p.deleted_at is null
    where pul.user_id = ${sqlUuid(safeUserId)}
    order by pul.created_at asc
    limit 1
  ),
  inserted as (
    insert into patient_portal_booking_requests (
      clinic_id,
      patient_id,
      requested_by_user_id,
      preferred_from,
      preferred_to,
      reason
    )
    select
      pp.clinic_id,
      pp.patient_id,
      ${sqlUuid(safeUserId)},
      ${sqlLiteral(preferredFrom)}::timestamptz,
      ${sqlNullableTimestamp(preferredTo)},
      ${sqlNullableText(reason)}
    from portal_patient pp
    returning *
  )
  select
    br.id::text as "id",
    br.status as "status",
    br.preferred_from as "preferredFrom",
    br.preferred_to as "preferredTo",
    br.reason as "reason",
    br.created_at as "createdAt",
    jsonb_build_object(
      'id', c.id::text,
      'slug', c.slug,
      'name', c.name
    ) as "clinic"
  from inserted br
  join clinics c on c.id = br.clinic_id
) result;
`.trim();
}

export function buildUpdatePatientPortalReminderPreferencesSql({
  userId,
  appointmentRemindersEnabled,
  reportNotificationsEnabled,
  preferredChannel,
} = {}) {
  const safeUserId = safeUuid(userId);
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with portal_patient as (
    select p.id as patient_id
    from patient_user_links pul
    join patients p on p.id = pul.patient_id and p.deleted_at is null
    where pul.user_id = ${sqlUuid(safeUserId)}
    order by pul.created_at asc
    limit 1
  ),
  upserted as (
    insert into patient_portal_reminder_preferences (
      user_id,
      patient_id,
      appointment_reminders_enabled,
      report_notifications_enabled,
      preferred_channel,
      updated_at
    )
    select
      ${sqlUuid(safeUserId)},
      pp.patient_id,
      ${appointmentRemindersEnabled ? "true" : "false"},
      ${reportNotificationsEnabled ? "true" : "false"},
      ${sqlLiteral(preferredChannel)},
      now()
    from portal_patient pp
    on conflict (user_id) do update
    set appointment_reminders_enabled = excluded.appointment_reminders_enabled,
        report_notifications_enabled = excluded.report_notifications_enabled,
        preferred_channel = excluded.preferred_channel,
        updated_at = now()
    returning *
  )
  select
    pref.appointment_reminders_enabled as "appointmentRemindersEnabled",
    pref.report_notifications_enabled as "reportNotificationsEnabled",
    pref.preferred_channel as "preferredChannel",
    pref.updated_at as "updatedAt"
  from upserted pref
) result;
`.trim();
}

export function createPatientPortalRepository(dbClient) {
  return {
    async getOverview({ userId }) {
      const rows = await dbClient.queryJson(buildPatientPortalOverviewSql({ userId }));
      return normalizePatientPortalOverview(Array.isArray(rows) ? rows[0] : rows);
    },
    async getReport({ userId, reportId }) {
      const rows = await dbClient.queryJson(buildPatientPortalReportSql({ userId, reportId }));
      const first = Array.isArray(rows) ? rows[0] : rows;
      return normalizePatientPortalReport(first);
    },
    async getPhotoProtocol({ userId, visitId }) {
      const rows = await dbClient.queryJson(buildPatientPortalPhotoProtocolSql({ userId, visitId }));
      const first = Array.isArray(rows) ? rows[0] : rows;
      return normalizePatientPortalPhotoProtocol(first);
    },
    async createBookingRequest(input) {
      const rows = await dbClient.queryJson(buildCreatePatientPortalBookingRequestSql(input));
      return normalizeBookingRequest(Array.isArray(rows) ? rows[0] : rows);
    },
    async updateReminderPreferences(input) {
      const rows = await dbClient.queryJson(buildUpdatePatientPortalReminderPreferencesSql(input));
      return normalizeReminderPreferences(Array.isArray(rows) ? rows[0] : rows);
    },
  };
}

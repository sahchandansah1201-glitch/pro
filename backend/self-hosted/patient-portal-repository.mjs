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

function lesionStateLabel(status) {
  switch (String(status || "")) {
    case "active":
      return "Врачебная проверка";
    case "monitoring":
      return "Плановое наблюдение";
    case "removed":
    case "archived":
      return "Архив";
    default:
      return "Под наблюдением";
  }
}

function visitStateLabel(status) {
  switch (String(status || "")) {
    case "scheduled":
      return "Запланирован";
    case "in_progress":
      return "Открыт";
    case "closed":
      return "Завершён";
    case "cancelled":
      return "Отменён";
    default:
      return "В работе";
  }
}

function normalizeHistoryLesion(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const status = String(source.status ?? "active");
  const snapshotCount = numberOrZero(source.snapshotCount);
  const comparableSnapshotCount = numberOrZero(source.comparableSnapshotCount);
  return {
    id: String(source.id ?? ""),
    title: String(source.title ?? source.label ?? "Очаг"),
    bodyZone: textOrNull(source.bodyZone),
    bodySurface: textOrNull(source.bodySurface),
    status,
    stateLabel: textOrNull(source.stateLabel) || lesionStateLabel(status),
    firstSeenAt: textOrNull(source.firstSeenAt),
    checkedAt: textOrNull(source.checkedAt),
    snapshotCount,
    comparableSnapshotCount,
    nextStep: textOrNull(source.nextStep) || "Покажите динамику врачу на контрольном визите.",
    comparisonState: textOrNull(source.comparisonState) || (
      comparableSnapshotCount >= 2
        ? "Есть серия снимков для врачебного сравнения."
        : "Динамика появится после следующего контрольного визита."
    ),
  };
}

function normalizeHistoryTimelineItem(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const visitStatus = String(source.visitStatus ?? source.status ?? "closed");
  return {
    id: String(source.id ?? ""),
    visitId: textOrNull(source.visitId) || textOrNull(source.id),
    visitDate: textOrNull(source.visitDate),
    clinicName: textOrNull(source.clinicName),
    visitStatus,
    stateLabel: textOrNull(source.stateLabel) || visitStateLabel(visitStatus),
    summary: textOrNull(source.summary),
    observedCount: numberOrZero(source.observedCount),
    snapshotCount: numberOrZero(source.snapshotCount),
  };
}

function normalizeHistoryRetentionGovernance(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const releasesTotal = numberOrZero(source.releasesTotal);
  const policyReady = numberOrZero(source.policyReady);
  return {
    releasesTotal,
    retentionApproved: numberOrZero(source.retentionApproved),
    patientCopyApproved: numberOrZero(source.patientCopyApproved),
    fileProxyEnabled: numberOrZero(source.fileProxyEnabled),
    expiresConfigured: numberOrZero(source.expiresConfigured),
    policyReady,
    status: releasesTotal === 0
      ? "no_releases"
      : policyReady >= releasesTotal
        ? "policy_ready"
        : "policy_in_progress",
  };
}

function normalizeHistoryComparisonOperations(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const lesionsTotal = numberOrZero(source.lesionsTotal);
  const readyForDoctorReview = numberOrZero(source.readyForDoctorReview);
  const requiresNextCapture = numberOrZero(source.requiresNextCapture);
  const visitsWithComparableSeries = numberOrZero(source.visitsWithComparableSeries);
  const comparableCoveragePercent = lesionsTotal === 0
    ? 0
    : Math.round((readyForDoctorReview / lesionsTotal) * 100);
  const status = lesionsTotal === 0
    ? "no_series"
    : readyForDoctorReview === 0
      ? "needs_capture"
      : readyForDoctorReview >= lesionsTotal
        ? "ready_for_review"
        : "partial_ready";
  return {
    lesionsTotal,
    readyForDoctorReview,
    requiresNextCapture,
    visitsWithComparableSeries,
    comparableCoveragePercent,
    status,
    doctorReviewRequired: true,
  };
}

function normalizeHistorySessionLifecycle(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  const preparedAccessWindows = numberOrZero(source.preparedAccessWindows);
  const revokedAccessWindows = numberOrZero(source.revokedAccessWindows);
  const activeAccessWindows = numberOrZero(source.activeAccessWindows);
  const expiringIn24h = numberOrZero(source.expiringIn24h);
  const expiredAccessWindows = numberOrZero(source.expiredAccessWindows);
  const missingExpiry = numberOrZero(source.missingExpiry);
  const identityCheckEnabled = numberOrZero(source.identityCheckEnabled);
  const policyReadyAccessWindows = numberOrZero(source.policyReadyAccessWindows);
  const status = preparedAccessWindows === 0 && revokedAccessWindows === 0
    ? "no_access_windows"
    : (
      missingExpiry > 0
      || policyReadyAccessWindows < preparedAccessWindows
      || identityCheckEnabled < preparedAccessWindows
    )
      ? "governance_attention"
      : "governance_ready";
  return {
    preparedAccessWindows,
    revokedAccessWindows,
    activeAccessWindows,
    expiringIn24h,
    expiredAccessWindows,
    missingExpiry,
    identityCheckEnabled,
    policyReadyAccessWindows,
    status,
    sessionBoundary: {
      temporaryCredentialsExposed: false,
      qrSessionExposed: false,
      rawTokensExposed: false,
    },
  };
}

function normalizeHistoryBoundary(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return {
    comparisonRequiresDoctorReview: source.comparisonRequiresDoctorReview !== false,
    clinicalDecisionExposed: false,
    rawFilesExposed: false,
    doctorOnlyTextExposed: false,
  };
}

export function normalizePatientPortalHistory(input) {
  const source = input && typeof input === "object" ? input : {};
  const clinic = safeNested(source, "clinic");
  return {
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
    lesions: Array.isArray(source.lesions)
      ? source.lesions.map(normalizeHistoryLesion).filter((item) => item.id)
      : [],
    timeline: Array.isArray(source.timeline)
      ? source.timeline.map(normalizeHistoryTimelineItem).filter((item) => item.id)
      : [],
    retentionGovernance: normalizeHistoryRetentionGovernance(source.retentionGovernance || {}),
    comparisonOperations: normalizeHistoryComparisonOperations(source.comparisonOperations || {}),
    sessionLifecycle: normalizeHistorySessionLifecycle(source.sessionLifecycle || {}),
    longitudinalBoundary: normalizeHistoryBoundary(source.longitudinalBoundary || {}),
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

export function normalizePatientPortalPhotoProtocolAccessExchange(input) {
  if (!input || typeof input !== "object" || !input.visitId) return null;
  const source = input && typeof input === "object" ? input : {};
  const sessionBoundary = safeNested(source, "sessionBoundary");
  const status = String(source.status ?? "denied");
  const deniedReason = textOrNull(source.deniedReason);
  return {
    visitId: textOrNull(source.visitId),
    status,
    accessStatus: textOrNull(source.accessStatus) || (
      status === "confirmed" ? "session_boundary_ready" : deniedReason || "photo_protocol_access_not_confirmed"
    ),
    deniedReason,
    sessionExpiresAt: textOrNull(source.sessionExpiresAt),
    sessionBoundary: {
      sessionEstablished: booleanValue(sessionBoundary.sessionEstablished),
      rawCredentialExposed: false,
      credentialHashExposed: false,
      credentialFingerprintExposed: false,
      rawSessionIdExposed: false,
      sessionHashExposed: false,
      sessionFingerprintExposed: false,
      qrTokenExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      doctorOnlyTextExposed: false,
    },
    clinic: safeNested(source, "clinic"),
  };
}

export function normalizePatientPortalPhotoProtocolAccessSessionEnd(input) {
  if (!input || typeof input !== "object" || !input.visitId) return null;
  const source = input && typeof input === "object" ? input : {};
  const status = source.status === "ended" ? "ended" : "no_active_session";
  return {
    visitId: textOrNull(source.visitId),
    status,
    accessStatus: status === "ended" ? "photo_protocol_access_session_ended" : "photo_protocol_access_no_active_session",
    sessionEnded: status === "ended" && booleanValue(source.sessionEnded),
    sessionBoundary: {
      sessionEstablished: false,
      rawSessionIdExposed: false,
      sessionHashExposed: false,
      sessionFingerprintExposed: false,
      qrTokenExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      doctorOnlyTextExposed: false,
    },
    clinic: safeNested(source, "clinic"),
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

export function buildPatientPortalHistorySql({ userId } = {}) {
  const safeUserId = safeUuid(userId);
  return `
with portal_patient as (
  select
    p.id as patient_id,
    p.clinic_id,
    c.slug as clinic_slug,
    c.name as clinic_name
  from patient_user_links pul
  join patients p on p.id = pul.patient_id and p.deleted_at is null
  join clinics c on c.id = p.clinic_id
  where pul.user_id = ${sqlUuid(safeUserId)}
  order by pul.created_at asc
  limit 1
),
lesion_history as (
  select
    l.id,
    l.label,
    l.body_zone,
    l.body_surface,
    l.status,
    min(coalesce(v.started_at, l.created_at)) as first_seen_at,
    max(coalesce(v.signed_at, v.started_at, l.updated_at)) as checked_at,
    count(a.id) filter (where a.kind in ('overview_photo', 'dermoscopy', 'report_attachment'))::int as snapshot_count,
    count(a.id) filter (where a.kind in ('overview_photo', 'dermoscopy') and a.captured_at is not null)::int as comparable_snapshot_count
  from lesions l
  join portal_patient pp on pp.patient_id = l.patient_id and pp.clinic_id = l.clinic_id
  left join visits v on v.id = l.visit_id and v.patient_id = l.patient_id and v.clinic_id = l.clinic_id
  left join clinical_assets a on a.lesion_id = l.id and a.patient_id = l.patient_id and a.clinic_id = l.clinic_id
  group by l.id, l.label, l.body_zone, l.body_surface, l.status
),
visit_timeline as (
  select
    v.id,
    v.status,
    v.started_at as visit_date,
    c.name as clinic_name,
    coalesce(
      left(nullif(trim(r.patient_safe_text), ''), 180),
      case
        when v.status = 'in_progress' then 'Визит в работе: итог появится после врачебной проверки.'
        when v.status = 'draft' then 'Визит запланирован: безопасный итог появится после проверки.'
        else 'Безопасный итог появится после врачебной проверки.'
      end
    ) as summary,
    count(distinct l.id)::int as observed_count,
    count(a.id) filter (where a.kind in ('overview_photo', 'dermoscopy', 'report_attachment'))::int as snapshot_count
  from visits v
  join portal_patient pp on pp.patient_id = v.patient_id and pp.clinic_id = v.clinic_id
  join clinics c on c.id = v.clinic_id
  left join reports r on r.visit_id = v.id and r.patient_id = v.patient_id and r.clinic_id = v.clinic_id
    and r.status = 'signed' and r.patient_safe_text is not null
  left join lesions l on l.visit_id = v.id and l.patient_id = v.patient_id and l.clinic_id = v.clinic_id
  left join clinical_assets a on a.visit_id = v.id and a.patient_id = v.patient_id and a.clinic_id = v.clinic_id
  where v.started_at is not null
  group by v.id, v.status, v.started_at, c.name, r.patient_safe_text
  order by v.started_at desc
  limit 20
),
compare_stats as (
  select
    count(*)::int as lesions_total,
    count(*) filter (where lh.comparable_snapshot_count >= 2)::int as ready_for_doctor_review,
    count(*) filter (where lh.comparable_snapshot_count < 2)::int as requires_next_capture,
    count(*) filter (where lh.snapshot_count >= 2)::int as lesions_with_series
  from lesion_history lh
),
release_stats as (
  select
    count(*)::int as releases_total,
    count(*) filter (where coalesce((r.metadata_json ->> 'retentionPolicyApproved')::boolean, false))::int as retention_approved,
    count(*) filter (where coalesce((r.metadata_json ->> 'patientCopyApproved')::boolean, false))::int as patient_copy_approved,
    count(*) filter (where coalesce((r.metadata_json ->> 'patientFileProxyEnabled')::boolean, false))::int as file_proxy_enabled,
    count(*) filter (where r.expires_at is not null)::int as expires_configured,
    count(*) filter (where r.status = 'prepared')::int as prepared_access_windows,
    count(*) filter (where r.status = 'revoked')::int as revoked_access_windows,
    count(*) filter (where r.status = 'prepared' and r.expires_at > now())::int as active_access_windows,
    count(*) filter (
      where r.status = 'prepared'
        and r.expires_at > now()
        and r.expires_at <= now() + interval '24 hours'
    )::int as expiring_in_24h,
    count(*) filter (where r.status = 'prepared' and r.expires_at <= now())::int as expired_access_windows,
    count(*) filter (where r.status = 'prepared' and r.expires_at is null)::int as missing_expiry,
    count(*) filter (
      where r.status = 'prepared'
        and coalesce((r.metadata_json ->> 'requiresIdentityCheck')::boolean, true)
    )::int as identity_check_enabled,
    count(*) filter (
      where r.status = 'prepared'
        and coalesce((r.metadata_json ->> 'patientFileProxyEnabled')::boolean, false)
        and coalesce((r.metadata_json ->> 'patientCopyApproved')::boolean, false)
        and coalesce((r.metadata_json ->> 'retentionPolicyApproved')::boolean, false)
        and r.expires_at is not null
    )::int as policy_ready,
    count(*) filter (
      where r.status = 'prepared'
        and coalesce((r.metadata_json ->> 'patientFileProxyEnabled')::boolean, false)
        and coalesce((r.metadata_json ->> 'patientCopyApproved')::boolean, false)
        and coalesce((r.metadata_json ->> 'retentionPolicyApproved')::boolean, false)
        and r.expires_at is not null
    )::int as policy_ready_access_windows
  from patient_photo_protocol_releases r
  join portal_patient pp on pp.patient_id = r.patient_id and pp.clinic_id = r.clinic_id
  where r.status in ('prepared', 'revoked')
)
select jsonb_build_object(
  'clinic', coalesce((
    select jsonb_build_object(
      'id', pp.clinic_id::text,
      'slug', pp.clinic_slug,
      'name', pp.clinic_name
    )
    from portal_patient pp
  ), '{}'::jsonb),
  'lesions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', lh.id::text,
      'title', lh.label,
      'bodyZone', lh.body_zone,
      'bodySurface', lh.body_surface,
      'status', lh.status,
      'firstSeenAt', lh.first_seen_at,
      'checkedAt', lh.checked_at,
      'snapshotCount', lh.snapshot_count,
      'comparableSnapshotCount', lh.comparable_snapshot_count,
      'nextStep', case
        when lh.comparable_snapshot_count >= 2 then 'Покажите серию врачу на контрольном визите.'
        else 'Добавьте следующий контрольный снимок на визите.'
      end,
      'comparisonState', case
        when lh.comparable_snapshot_count >= 2 then 'Есть серия снимков для врачебного сравнения.'
        else 'Динамика появится после следующего контрольного визита.'
      end
    ) order by lh.first_seen_at asc nulls last)
    from lesion_history lh
  ), '[]'::jsonb),
  'timeline', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', vt.id::text,
      'visitId', vt.id::text,
      'visitDate', vt.visit_date,
      'visitStatus', vt.status,
      'clinicName', vt.clinic_name,
      'summary', vt.summary,
      'observedCount', vt.observed_count,
      'snapshotCount', vt.snapshot_count
    ) order by vt.visit_date desc nulls last)
    from visit_timeline vt
  ), '[]'::jsonb),
  'retentionGovernance', coalesce((
    select jsonb_build_object(
      'releasesTotal', rs.releases_total,
      'retentionApproved', rs.retention_approved,
      'patientCopyApproved', rs.patient_copy_approved,
      'fileProxyEnabled', rs.file_proxy_enabled,
      'expiresConfigured', rs.expires_configured,
      'policyReady', rs.policy_ready
    )
    from release_stats rs
  ), jsonb_build_object(
    'releasesTotal', 0,
    'retentionApproved', 0,
    'patientCopyApproved', 0,
    'fileProxyEnabled', 0,
    'expiresConfigured', 0,
    'policyReady', 0
  )),
  'comparisonOperations', coalesce((
    select jsonb_build_object(
      'lesionsTotal', cs.lesions_total,
      'readyForDoctorReview', cs.ready_for_doctor_review,
      'requiresNextCapture', cs.requires_next_capture,
      'visitsWithComparableSeries', (
        select count(*)::int
        from visit_timeline vt
        where vt.snapshot_count >= 2
      ),
      'comparableCoveragePercent', case
        when cs.lesions_total = 0 then 0
        else round((cs.ready_for_doctor_review::numeric / cs.lesions_total::numeric) * 100)::int
      end,
      'doctorReviewRequired', true
    )
    from compare_stats cs
  ), jsonb_build_object(
    'lesionsTotal', 0,
    'readyForDoctorReview', 0,
    'requiresNextCapture', 0,
    'visitsWithComparableSeries', 0,
    'comparableCoveragePercent', 0,
    'doctorReviewRequired', true
  )),
  'sessionLifecycle', coalesce((
    select jsonb_build_object(
      'preparedAccessWindows', rs.prepared_access_windows,
      'revokedAccessWindows', rs.revoked_access_windows,
      'activeAccessWindows', rs.active_access_windows,
      'expiringIn24h', rs.expiring_in_24h,
      'expiredAccessWindows', rs.expired_access_windows,
      'missingExpiry', rs.missing_expiry,
      'identityCheckEnabled', rs.identity_check_enabled,
      'policyReadyAccessWindows', rs.policy_ready_access_windows,
      'sessionBoundary', jsonb_build_object(
        'temporaryCredentialsExposed', false,
        'qrSessionExposed', false,
        'rawTokensExposed', false
      )
    )
    from release_stats rs
  ), jsonb_build_object(
    'preparedAccessWindows', 0,
    'revokedAccessWindows', 0,
    'activeAccessWindows', 0,
    'expiringIn24h', 0,
    'expiredAccessWindows', 0,
    'missingExpiry', 0,
    'identityCheckEnabled', 0,
    'policyReadyAccessWindows', 0,
    'sessionBoundary', jsonb_build_object(
      'temporaryCredentialsExposed', false,
      'qrSessionExposed', false,
      'rawTokensExposed', false
    )
  )),
  'longitudinalBoundary', jsonb_build_object(
    'comparisonRequiresDoctorReview', true,
    'clinicalDecisionExposed', false,
    'rawFilesExposed', false,
    'doctorOnlyTextExposed', false
  )
)::text;
`.trim();
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
    coalesce((r.metadata_json ->> 'retentionPolicyApproved')::boolean, false) as retention_policy_approved,
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
        and lr.retention_policy_approved
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
      case when not lr.retention_policy_approved then 'Клиника не подтвердила политику срока доступа к фото.' end,
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
      'requiresRetentionPolicy', lr.expires_at is null or not lr.retention_policy_approved,
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

export function buildExchangePatientPortalPhotoProtocolAccessSql({
  userId,
  visitId,
  credentialHash,
  sessionHash,
  sessionFingerprint,
  sessionExpiresAt,
} = {}) {
  const safeUserId = safeUuid(userId);
  const safeVisitId = safeUuid(visitId);
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with linked_release as (
    select
      r.id,
      r.clinic_id,
      r.patient_id,
      r.visit_id,
      r.status,
      r.expires_at,
      coalesce((r.metadata_json ->> 'patientFileProxyEnabled')::boolean, false) as file_proxy_enabled,
      coalesce((r.metadata_json ->> 'patientCopyApproved')::boolean, false) as patient_copy_approved,
      coalesce((r.metadata_json ->> 'retentionPolicyApproved')::boolean, false) as retention_policy_approved,
      nullif(trim(coalesce(rep.patient_safe_text, '')), '') is not null as patient_safe_text_available,
      coalesce(p.imaging_consent, false) as imaging_consent,
      cred.id as credential_id
    from patient_photo_protocol_releases r
    join patient_user_links pul on pul.patient_id = r.patient_id
    join patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id and p.deleted_at is null
    join visits v on v.id = r.visit_id and v.patient_id = r.patient_id and v.clinic_id = r.clinic_id
    left join reports rep on rep.id = r.report_id and rep.patient_id = r.patient_id and rep.clinic_id = r.clinic_id
    left join patient_photo_protocol_access_credentials cred
      on cred.release_id = r.id
      and cred.clinic_id = r.clinic_id
      and cred.visit_id = r.visit_id
      and cred.credential_kind = 'patient_photo_protocol_access'
      and cred.status = 'active'
      and (cred.expires_at is null or cred.expires_at > now())
      and cred.credential_hash = ${sqlLiteral(credentialHash ?? "")}
    where pul.user_id = ${sqlUuid(safeUserId)}
      and r.visit_id = ${sqlUuid(safeVisitId)}
      and r.status in ('prepared', 'revoked', 'blocked')
    order by r.updated_at desc
    limit 1
  ),
  decision as (
    select
      lr.*,
      case
        when lr.status = 'revoked' then 'photo_protocol_access_revoked'
        when lr.status = 'blocked' then 'photo_protocol_access_policy_blocked'
        when lr.status <> 'prepared' then 'photo_protocol_access_not_prepared'
        when lr.expires_at is null or not lr.retention_policy_approved then 'photo_protocol_access_retention_required'
        when lr.expires_at <= now() then 'photo_protocol_access_expired'
        when not lr.file_proxy_enabled then 'photo_protocol_access_proxy_disabled'
        when not lr.patient_copy_approved or not lr.patient_safe_text_available then 'photo_protocol_access_policy_blocked'
        when not lr.imaging_consent then 'photo_protocol_access_consent_missing'
        when lr.credential_id is null then 'photo_protocol_access_credential_invalid'
        else null
      end as denied_reason
    from linked_release lr
  ),
  inserted_session as (
    insert into patient_photo_protocol_access_sessions (
      clinic_id,
      release_id,
      visit_id,
      patient_id,
      patient_user_id,
      credential_id,
      session_kind,
      status,
      session_hash,
      session_fingerprint,
      hash_algorithm,
      session_secret_version,
      expires_at,
      metadata_json
    )
    select
      d.clinic_id,
      d.id,
      d.visit_id,
      d.patient_id,
      ${sqlUuid(safeUserId)},
      d.credential_id,
      'patient_photo_protocol_access',
      'active',
      ${sqlLiteral(sessionHash ?? "")},
      ${sqlLiteral(sessionFingerprint ?? "")},
      'hmac-sha256-node-v1',
      'PATIENT_PHOTO_PROTOCOL_SESSION_PEPPER',
      ${sqlNullableTimestamp(sessionExpiresAt)},
      jsonb_build_object(
        'operation', 'access_exchange',
        'sessionBoundaryReady', true,
        'rawCredentialExposed', false,
        'credentialHashExposed', false,
        'credentialFingerprintExposed', false,
        'rawSessionIdExposed', false,
        'sessionHashExposed', false,
        'sessionFingerprintExposed', false,
        'qrTokenExposed', false,
        'signedUrlsIssued', false,
        'storagePathsExposed', false,
        'doctorOnlyTextExposed', false
      )
    from decision d
    where d.denied_reason is null
    on conflict (release_id, patient_user_id, session_kind)
      where status = 'active'
    do update
    set credential_id = excluded.credential_id,
        session_hash = excluded.session_hash,
        session_fingerprint = excluded.session_fingerprint,
        hash_algorithm = excluded.hash_algorithm,
        session_secret_version = excluded.session_secret_version,
        issued_at = now(),
        expires_at = excluded.expires_at,
        revoked_at = null,
        metadata_json = excluded.metadata_json,
        updated_at = now()
    returning expires_at
  )
  select
    d.visit_id::text as "visitId",
    case when d.denied_reason is null then 'confirmed' else 'denied' end as "status",
    coalesce(d.denied_reason, 'session_boundary_ready') as "accessStatus",
    d.denied_reason as "deniedReason",
    (select max(expires_at) from inserted_session) as "sessionExpiresAt",
    jsonb_build_object(
      'sessionEstablished', d.denied_reason is null,
      'rawCredentialExposed', false,
      'credentialHashExposed', false,
      'credentialFingerprintExposed', false,
      'rawSessionIdExposed', false,
      'sessionHashExposed', false,
      'sessionFingerprintExposed', false,
      'qrTokenExposed', false,
      'signedUrlsIssued', false,
      'storagePathsExposed', false,
      'doctorOnlyTextExposed', false
    ) as "sessionBoundary",
    jsonb_build_object(
      'id', d.clinic_id::text
    ) as "clinic"
  from decision d
  limit 1
) result;
`.trim();
}

export function buildEndPatientPortalPhotoProtocolAccessSessionSql({
  userId,
  visitId,
  sessionHash = "",
} = {}) {
  const safeUserId = safeUuid(userId);
  const safeVisitId = safeUuid(visitId);
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  with linked_release as (
    select
      r.id,
      r.clinic_id,
      r.patient_id,
      r.visit_id
    from patient_photo_protocol_releases r
    join patient_user_links pul on pul.patient_id = r.patient_id
    join patients p on p.id = r.patient_id and p.clinic_id = r.clinic_id and p.deleted_at is null
    where pul.user_id = ${sqlUuid(safeUserId)}
      and r.visit_id = ${sqlUuid(safeVisitId)}
    order by r.updated_at desc
    limit 1
  ),
  ended_session as (
    update patient_photo_protocol_access_sessions s
    set status = 'revoked',
        revoked_at = now(),
        metadata_json = coalesce(s.metadata_json, '{}'::jsonb) || jsonb_build_object(
          'operation', 'patient_end_access_session',
          'endedByPatient', true,
          'rawSessionIdExposed', false,
          'sessionHashExposed', false,
          'sessionFingerprintExposed', false,
          'qrTokenExposed', false,
          'signedUrlsIssued', false,
          'storagePathsExposed', false,
          'doctorOnlyTextExposed', false
        ),
        updated_at = now()
    from linked_release lr
    where s.release_id = lr.id
      and s.visit_id = lr.visit_id
      and s.patient_user_id = ${sqlUuid(safeUserId)}
      and s.session_kind = 'patient_photo_protocol_access'
      and s.status = 'active'
      and ${sqlLiteral(sessionHash ?? "")} <> ''
      and s.session_hash = ${sqlLiteral(sessionHash ?? "")}
    returning s.id
  )
  select
    lr.visit_id::text as "visitId",
    case when exists (select 1 from ended_session) then 'ended' else 'no_active_session' end as "status",
    case
      when exists (select 1 from ended_session) then 'photo_protocol_access_session_ended'
      else 'photo_protocol_access_no_active_session'
    end as "accessStatus",
    exists (select 1 from ended_session) as "sessionEnded",
    jsonb_build_object(
      'sessionEstablished', false,
      'rawSessionIdExposed', false,
      'sessionHashExposed', false,
      'sessionFingerprintExposed', false,
      'qrTokenExposed', false,
      'signedUrlsIssued', false,
      'storagePathsExposed', false,
      'doctorOnlyTextExposed', false
    ) as "sessionBoundary",
    jsonb_build_object(
      'id', lr.clinic_id::text
    ) as "clinic"
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
    async exchangePhotoProtocolAccess(input) {
      const rows = await dbClient.queryJson(buildExchangePatientPortalPhotoProtocolAccessSql(input));
      const first = Array.isArray(rows) ? rows[0] : rows;
      return normalizePatientPortalPhotoProtocolAccessExchange(first);
    },
    async endPhotoProtocolAccessSession(input) {
      const rows = await dbClient.queryJson(buildEndPatientPortalPhotoProtocolAccessSessionSql(input));
      const first = Array.isArray(rows) ? rows[0] : rows;
      return normalizePatientPortalPhotoProtocolAccessSessionEnd(first);
    },
    async getHistory({ userId }) {
      const rows = await dbClient.queryJson(buildPatientPortalHistorySql({ userId }));
      const first = Array.isArray(rows) ? rows[0] : rows;
      return normalizePatientPortalHistory(first);
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

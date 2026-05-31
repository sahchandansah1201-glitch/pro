// Batch R · Patient photo/protocol release ledger repository.
// Persists release/revoke metadata only. Raw file locations and temporary
// access artifacts never leave the backend through this contract.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SELF_HOSTED_DELIVERY_BLOCKER = "self_hosted_photo_delivery_contract_missing";

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableUuid(value) {
  return value == null ? "null" : sqlUuid(value);
}

function sqlNullableText(value) {
  return value == null ? "null" : sqlLiteral(value);
}

function sqlNullableTimestamp(value) {
  return value == null ? "null" : `${sqlLiteral(value)}::timestamptz`;
}

function sqlBoolean(value) {
  return value ? "true" : "false";
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
  return `and ${alias}.clinic_id in (${ids.map(sqlUuid).join(", ")})`;
}

function safeLimit(value, fallback = 20, max = 100) {
  const limit = Number(value ?? fallback);
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(Math.floor(limit), max);
}

function releaseSafeColumns(alias = "r") {
  return `
    ${alias}.id::text as "id",
    ${alias}.clinic_id::text as "clinicId",
    ${alias}.patient_id::text as "patientId",
    ${alias}.visit_id::text as "visitId",
    ${alias}.report_id::text as "reportId",
    ${alias}.status as "status",
    ${alias}.selected_photo_count as "selectedPhotoCount",
    ${alias}.overview_photo_count as "overviewPhotoCount",
    ${alias}.dermoscopy_photo_count as "dermoscopyPhotoCount",
    ${alias}.report_attachment_count as "reportAttachmentCount",
    ${alias}.release_blockers as "blockers",
    ${alias}.prepared_at as "preparedAt",
    ${alias}.revoked_at as "revokedAt",
    ${alias}.revoke_reason as "revokeReason",
    ${alias}.expires_at as "expiresAt",
    coalesce((${alias}.metadata_json ->> 'patientFileProxyEnabled')::boolean, false) as "patientFileProxyEnabled",
    coalesce((${alias}.metadata_json ->> 'patientCopyApproved')::boolean, false) as "patientCopyApproved",
    coalesce((${alias}.metadata_json ->> 'retentionPolicyApproved')::boolean, false) as "retentionPolicyApproved",
    ${alias}.created_at as "createdAt",
    ${alias}.updated_at as "updatedAt"
  `;
}

function contextCtes({ visitId, clinicIds = [], allClinics = false } = {}) {
  return `
with scoped_visit as (
  select
    v.id,
    v.clinic_id,
    v.patient_id,
    p.imaging_consent
  from visits v
  join patients p on p.id = v.patient_id and p.clinic_id = v.clinic_id
  where v.id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
),
report as (
  select
    r.id,
    r.status,
    nullif(trim(coalesce(r.patient_safe_text, '')), '') is not null as patient_safe_text_present
  from reports r
  join scoped_visit sv on sv.id = r.visit_id and sv.clinic_id = r.clinic_id
  limit 1
),
asset_counts as (
  select
    count(*) filter (where a.kind in ('overview_photo', 'dermoscopy'))::int as patient_photo_count,
    count(*) filter (where a.kind = 'overview_photo')::int as overview_photo_count,
    count(*) filter (where a.kind = 'dermoscopy')::int as dermoscopy_photo_count,
    count(*) filter (where a.kind = 'report_attachment')::int as report_attachment_count
  from clinical_assets a
  join scoped_visit sv on sv.id = a.visit_id and sv.clinic_id = a.clinic_id
),
gate as (
  select
    sv.clinic_id,
    sv.patient_id,
    sv.id as visit_id,
    r.id as report_id,
    coalesce(ac.patient_photo_count, 0) as patient_photo_count,
    coalesce(ac.overview_photo_count, 0) as overview_photo_count,
    coalesce(ac.dermoscopy_photo_count, 0) as dermoscopy_photo_count,
    coalesce(ac.report_attachment_count, 0) as report_attachment_count,
    array_remove(array[
      case when sv.imaging_consent then null else 'imaging_consent_missing' end,
      case when coalesce(ac.patient_photo_count, 0) > 0 then null else 'patient_photo_assets_missing' end,
      case when r.id is not null then null else 'report_missing' end,
      case when r.id is not null and r.status = 'signed' then null else 'report_not_signed' end,
      case when coalesce(r.patient_safe_text_present, false) then null else 'patient_safe_text_missing' end,
      '${SELF_HOSTED_DELIVERY_BLOCKER}'
    ], null)::text[] as blockers
  from scoped_visit sv
  left join report r on true
  left join asset_counts ac on true
)`;
}

export function buildPreparePatientPhotoProtocolReleaseSql({
  visitId,
  actorUserId,
  expiresAt = null,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
${contextCtes({ visitId, clinicIds, allClinics })},
upserted as (
  insert into patient_photo_protocol_releases (
    clinic_id,
    patient_id,
    visit_id,
    report_id,
    status,
    selected_photo_count,
    overview_photo_count,
    dermoscopy_photo_count,
    report_attachment_count,
    release_blockers,
    prepared_by_user_id,
    prepared_at,
    revoked_by_user_id,
    revoked_at,
    revoke_reason,
    expires_at,
    metadata_json
  )
  select
    g.clinic_id,
    g.patient_id,
    g.visit_id,
    g.report_id,
    case
      when cardinality(g.blockers) = 1 and g.blockers[1] = '${SELF_HOSTED_DELIVERY_BLOCKER}'
        then 'prepared'
      else 'blocked'
    end,
    g.patient_photo_count,
    g.overview_photo_count,
    g.dermoscopy_photo_count,
    g.report_attachment_count,
    g.blockers,
    ${sqlNullableUuid(actorUserId)},
    now(),
    null,
    null,
    null,
    ${sqlNullableTimestamp(expiresAt)},
    jsonb_build_object(
      'brainstormTask', 'SD-MF-046',
      'patientDeliveryAllowed', false,
      'rawFilesExposed', false,
      'signedUrlsIssued', false,
      'patientFileProxyEnabled', false,
      'patientCopyApproved', false,
      'retentionPolicyApproved', false
    )
  from gate g
  on conflict (visit_id) do update
  set
    report_id = excluded.report_id,
    status = excluded.status,
    selected_photo_count = excluded.selected_photo_count,
    overview_photo_count = excluded.overview_photo_count,
    dermoscopy_photo_count = excluded.dermoscopy_photo_count,
    report_attachment_count = excluded.report_attachment_count,
    release_blockers = excluded.release_blockers,
    prepared_by_user_id = excluded.prepared_by_user_id,
    prepared_at = excluded.prepared_at,
    revoked_by_user_id = null,
    revoked_at = null,
    revoke_reason = null,
    expires_at = excluded.expires_at,
    metadata_json = excluded.metadata_json,
    updated_at = now()
  returning *
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${releaseSafeColumns("r")}
  from upserted r
  limit 1
) result;
`.trim();
}

export function buildReviewPatientPhotoProtocolReleasePolicySql({
  visitId,
  expiresAtProvided = false,
  expiresAt = null,
  patientFileProxyEnabled,
  patientCopyApproved,
  retentionPolicyApproved,
  clinicIds = [],
  allClinics = false,
} = {}) {
  const metadataPatch = {
    ...(patientFileProxyEnabled === undefined ? {} : { patientFileProxyEnabled: Boolean(patientFileProxyEnabled) }),
    ...(patientCopyApproved === undefined ? {} : { patientCopyApproved: Boolean(patientCopyApproved) }),
    ...(retentionPolicyApproved === undefined ? {} : { retentionPolicyApproved: Boolean(retentionPolicyApproved) }),
  };
  return `
with scoped_release as (
  select r.id
  from patient_photo_protocol_releases r
  join visits v on v.id = r.visit_id and v.clinic_id = r.clinic_id
  where r.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
),
updated as (
  update patient_photo_protocol_releases r
  set
    expires_at = case
      when ${sqlBoolean(expiresAtProvided)} then ${sqlNullableTimestamp(expiresAt)}
      else r.expires_at
    end,
    metadata_json = coalesce(r.metadata_json, '{}'::jsonb)
      || ${sqlLiteral(JSON.stringify(metadataPatch))}::jsonb
      || jsonb_build_object('policyReviewedAt', now()),
    updated_at = now()
  from scoped_release s
  where r.id = s.id
  returning r.*
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${releaseSafeColumns("r")}
  from updated r
  limit 1
) result;
`.trim();
}

export function buildRevokePatientPhotoProtocolReleaseSql({
  visitId,
  actorUserId,
  reason,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
with scoped_release as (
  select r.id
  from patient_photo_protocol_releases r
  join visits v on v.id = r.visit_id and v.clinic_id = r.clinic_id
  where r.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
),
updated as (
  update patient_photo_protocol_releases r
  set
    status = 'revoked',
    revoked_by_user_id = ${sqlNullableUuid(actorUserId)},
    revoked_at = now(),
    revoke_reason = ${sqlNullableText(reason)},
    updated_at = now()
  from scoped_release s
  where r.id = s.id
  returning r.*
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select ${releaseSafeColumns("r")}
  from updated r
  limit 1
) result;
`.trim();
}

export function buildExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredSql({
  actorUserId,
  clinicIds = [],
  allClinics = false,
  limit = 50,
} = {}) {
  const operationLimit = safeLimit(limit, 50, 200);
  return `
with eligible as (
  select r.id
  from patient_photo_protocol_releases r
  join visits v on v.id = r.visit_id and v.clinic_id = r.clinic_id
  where r.status = 'prepared'
    and r.expires_at is not null
    and r.expires_at <= now()
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  order by r.expires_at asc, r.updated_at asc
  limit ${operationLimit}
),
updated as (
  update patient_photo_protocol_releases r
  set
    status = 'revoked',
    revoked_by_user_id = ${sqlNullableUuid(actorUserId)},
    revoked_at = now(),
    revoke_reason = 'expired_access_window',
    metadata_json = coalesce(r.metadata_json, '{}'::jsonb)
      || jsonb_build_object(
        'governanceOperation', 'revoke_expired_access_windows',
        'systemReasonStored', true,
        'revokeReasonExposed', false,
        'operationExecutedAt', now()
      ),
    updated_at = now()
  from eligible e
  where r.id = e.id
  returning r.id
),
scope_rollup as (
  select
    count(*) filter (
      where r.status = 'prepared'
        and r.expires_at is not null
        and r.expires_at > now()
    )::int as active_remaining_count,
    count(*) filter (
      where r.status = 'prepared'
        and r.expires_at is not null
        and r.expires_at > now()
        and r.expires_at <= now() + interval '24 hours'
    )::int as expiring_in_24h_count,
    count(*) filter (
      where r.status = 'prepared'
        and r.expires_at is null
    )::int as missing_expiry_count
  from patient_photo_protocol_releases r
  join visits v on v.id = r.visit_id and v.clinic_id = r.clinic_id
  where true
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
),
result as (
  select
    (select count(*)::int from updated) as affected_count,
    coalesce(sr.active_remaining_count, 0) as active_remaining_count,
    coalesce(sr.expiring_in_24h_count, 0) as expiring_in_24h_count,
    coalesce(sr.missing_expiry_count, 0) as missing_expiry_count
  from scope_rollup sr
)
select coalesce(jsonb_agg(row_to_json(output)), '[]'::jsonb)::text
from (
  select
    'revoke_expired_access_windows' as "operation",
    case when result.affected_count > 0 then 'executed' else 'no_op' end as "status",
    result.affected_count as "affectedCount",
    result.active_remaining_count as "skippedActiveCount",
    result.expiring_in_24h_count as "expiringIn24hCount",
    result.missing_expiry_count as "skippedMissingExpiryCount",
    ${operationLimit} as "limit",
    'patient_photo_protocol.release_governance.revoke_expired' as "auditAction",
    jsonb_build_object(
      'metadataOnly', true,
      'patientRowsExposed', false,
      'rawIdentifiersExposed', false,
      'revokeReasonExposed', false,
      'temporaryCredentialsExposed', false,
      'qrTokensExposed', false,
      'sessionIdsExposed', false,
      'storagePathsExposed', false,
      'signedUrlsIssued', false,
      'patientDeliveryAllowed', false
    ) as "boundaries"
  from result
  limit 1
) output;
`.trim();
}

export function buildGetPatientPhotoProtocolReleaseAuditSql({
  visitId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
with scoped_release as (
  select
    r.id,
    r.clinic_id,
    r.patient_id,
    r.visit_id,
    r.status
  from patient_photo_protocol_releases r
  join visits v on v.id = r.visit_id and v.clinic_id = r.clinic_id
  where r.visit_id = ${sqlUuid(visitId)}
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
  limit 1
),
scoped_events as (
  select
    a.created_at as "occurredAt",
    a.action as "action",
    a.entity_type as "entityType",
    coalesce(a.metadata_json->>'status', sr.status) as "status",
    nullif(a.metadata_json->>'selectedPhotoCount', '')::int as "selectedPhotoCount",
    nullif(a.metadata_json->>'blockerCount', '')::int as "blockerCount",
    case
      when a.metadata_json ? 'patientDeliveryAllowed'
        then (a.metadata_json->>'patientDeliveryAllowed')::boolean
      else false
    end as "patientDeliveryAllowed",
    case
      when a.metadata_json ? 'reasonPresent'
        then (a.metadata_json->>'reasonPresent')::boolean
      else false
    end as "reasonPresent"
  from audit_log a
  join scoped_release sr on a.clinic_id = sr.clinic_id
    and a.entity_type = 'patient_photo_protocol_release'
    and a.entity_id = sr.id
  where a.action in (
    'patient_photo_protocol.release.prepare',
    'patient_photo_protocol.release.policy_review',
    'patient_photo_protocol.release.revoke',
    'patient_portal.photo_protocol.read',
    'patient_portal.photo_protocol.proxy.download',
    'patient_portal.photo_protocol.proxy.denied'
  )
  order by a.created_at asc
  limit 100
),
rollup as (
  select
    count(*)::int as event_count,
    count(*) filter (where "action" = 'patient_photo_protocol.release.prepare')::int as prepared_event_count,
    count(*) filter (where "action" = 'patient_photo_protocol.release.policy_review')::int as policy_review_event_count,
    count(*) filter (where "action" = 'patient_photo_protocol.release.revoke')::int as revoked_event_count,
    count(*) filter (where "action" = 'patient_portal.photo_protocol.read')::int as patient_read_event_count,
    count(*) filter (where "action" = 'patient_portal.photo_protocol.proxy.download')::int as proxy_download_event_count,
    count(*) filter (where "action" = 'patient_portal.photo_protocol.proxy.denied')::int as proxy_denied_event_count
  from scoped_events
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    sr.id::text as "releaseId",
    sr.clinic_id::text as "clinicId",
    sr.patient_id::text as "patientId",
    sr.visit_id::text as "visitId",
    sr.status as "status",
    coalesce(ro.event_count, 0) as "eventCount",
    coalesce(ro.prepared_event_count, 0) as "preparedEventCount",
    coalesce(ro.policy_review_event_count, 0) as "policyReviewEventCount",
    coalesce(ro.revoked_event_count, 0) as "revokedEventCount",
    coalesce(ro.patient_read_event_count, 0) as "patientReadEventCount",
    coalesce(ro.proxy_download_event_count, 0) as "proxyDownloadEventCount",
    coalesce(ro.proxy_denied_event_count, 0) as "proxyDeniedEventCount",
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'occurredAt', se."occurredAt",
          'action', se."action",
          'entityType', se."entityType",
          'status', se."status",
          'selectedPhotoCount', se."selectedPhotoCount",
          'blockerCount', se."blockerCount",
          'patientDeliveryAllowed', se."patientDeliveryAllowed",
          'reasonPresent', se."reasonPresent"
        )
        order by se."occurredAt" asc
      ) filter (where se."action" is not null),
      '[]'::jsonb
    ) as "events"
  from scoped_release sr
  cross join rollup ro
  left join scoped_events se on true
  group by
    sr.id,
    sr.clinic_id,
    sr.patient_id,
    sr.visit_id,
    sr.status,
    ro.event_count,
    ro.prepared_event_count,
    ro.policy_review_event_count,
    ro.revoked_event_count,
    ro.patient_read_event_count,
    ro.proxy_download_event_count,
    ro.proxy_denied_event_count
  limit 1
) result;
`.trim();
}

export function buildGetPatientPhotoProtocolReleaseGovernanceSql({
  clinicIds = [],
  allClinics = false,
  limit = 20,
} = {}) {
  return `
with scoped_releases as (
  select
    row_number() over (order by r.updated_at desc, r.created_at desc)::int as queue_number,
    r.status,
    coalesce(r.selected_photo_count, 0)::int as selected_photo_count,
    cardinality(coalesce(r.release_blockers, '{}'::text[]))::int as blocker_count,
    r.expires_at,
    r.updated_at,
    coalesce((r.metadata_json ->> 'patientFileProxyEnabled')::boolean, false) as patient_file_proxy_enabled,
    coalesce((r.metadata_json ->> 'patientCopyApproved')::boolean, false) as patient_copy_approved,
    coalesce((r.metadata_json ->> 'retentionPolicyApproved')::boolean, false) as retention_policy_approved
  from patient_photo_protocol_releases r
  join visits v on v.id = r.visit_id and v.clinic_id = r.clinic_id
  where true
    ${clinicScopeWhere({ alias: "v", clinicIds, allClinics })}
),
queue as (
  select
    sr.queue_number,
    sr.status,
    case
      when sr.status = 'revoked' then 'revoked'
      when sr.status = 'blocked' then 'blocked'
      when not sr.patient_file_proxy_enabled then 'file_proxy_required'
      when not sr.retention_policy_approved or sr.expires_at is null then 'retention_required'
      when not sr.patient_copy_approved then 'patient_copy_required'
      else 'ready_for_access_window'
    end as policy_status,
    sr.selected_photo_count,
    sr.blocker_count,
    sr.expires_at,
    sr.updated_at,
    sr.patient_file_proxy_enabled,
    sr.patient_copy_approved,
    sr.retention_policy_approved,
    array_remove(array[
      case when sr.status = 'blocked' then 'blocked_release' end,
      case when sr.status = 'revoked' then 'revoked_release' end,
      case when not sr.patient_file_proxy_enabled then 'file_proxy_required' end,
      case when not sr.retention_policy_approved then 'retention_required' end,
      case when sr.expires_at is null then 'expiry_required' end,
      case when not sr.patient_copy_approved then 'patient_copy_required' end,
      case when sr.expires_at is not null and sr.expires_at <= now() + interval '24 hours' and sr.status = 'prepared'
        then 'expires_soon'
      end
    ], null)::text[] as attention
  from scoped_releases sr
  where sr.queue_number <= ${safeLimit(limit)}
),
summary as (
  select
    count(*)::int as releases_total,
    count(*) filter (where status = 'prepared')::int as prepared,
    count(*) filter (where status = 'blocked')::int as blocked,
    count(*) filter (where status = 'revoked')::int as revoked,
    count(*) filter (where not retention_policy_approved or expires_at is null)::int as retention_missing,
    count(*) filter (where not patient_copy_approved)::int as patient_copy_missing,
    count(*) filter (where not patient_file_proxy_enabled)::int as file_proxy_missing,
    count(*) filter (where expires_at is null)::int as expiry_missing,
    count(*) filter (where status = 'prepared' and expires_at > now())::int as active_access_windows,
    count(*) filter (
      where status = 'prepared'
        and expires_at is not null
        and expires_at > now()
        and expires_at <= now() + interval '24 hours'
    )::int as expiring_in_24h
  from scoped_releases
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    jsonb_build_object(
      'releasesTotal', coalesce(s.releases_total, 0),
      'prepared', coalesce(s.prepared, 0),
      'blocked', coalesce(s.blocked, 0),
      'revoked', coalesce(s.revoked, 0),
      'retentionMissing', coalesce(s.retention_missing, 0),
      'patientCopyMissing', coalesce(s.patient_copy_missing, 0),
      'fileProxyMissing', coalesce(s.file_proxy_missing, 0),
      'expiryMissing', coalesce(s.expiry_missing, 0),
      'activeAccessWindows', coalesce(s.active_access_windows, 0),
      'expiringIn24h', coalesce(s.expiring_in_24h, 0)
    ) as "summary",
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'queueNumber', q.queue_number,
            'status', q.status,
            'policyStatus', q.policy_status,
            'selectedPhotoCount', q.selected_photo_count,
            'blockerCount', q.blocker_count,
            'expiresAt', q.expires_at,
            'updatedAt', q.updated_at,
            'patientFileProxyEnabled', q.patient_file_proxy_enabled,
            'patientCopyApproved', q.patient_copy_approved,
            'retentionPolicyApproved', q.retention_policy_approved,
            'attention', q.attention
          )
          order by q.queue_number asc
        )
        from queue q
      ),
      '[]'::jsonb
    ) as "queue",
    jsonb_build_object(
      'retention', jsonb_build_object(
        'reviewDue', coalesce(s.retention_missing, 0),
        'ready', greatest(coalesce(s.prepared, 0) - coalesce(s.retention_missing, 0), 0),
        'blocked', coalesce(s.blocked, 0),
        'requiresClinicSignoff', coalesce(s.retention_missing, 0) > 0,
        'nextAction', 'review_retention_policy'
      ),
      'revokeReadiness', jsonb_build_object(
        'activeWindows', coalesce(s.active_access_windows, 0),
        'expiringIn24h', coalesce(s.expiring_in_24h, 0),
        'revoked', coalesce(s.revoked, 0),
        'canPrepareRevokeReview', coalesce(s.active_access_windows, 0),
        'requiresManualReason', true,
        'revokeReasonExposed', false
      ),
      'sessionLifecycle', jsonb_build_object(
        'active', coalesce(s.active_access_windows, 0),
        'expiringIn24h', coalesce(s.expiring_in_24h, 0),
        'missingExpiry', coalesce(s.expiry_missing, 0),
        'revoked', coalesce(s.revoked, 0),
        'temporaryCredentialsExposed', false,
        'qrTokensExposed', false,
        'sessionIdsExposed', false
      ),
      'allowedOperations', jsonb_build_array(
        'review_retention_policy',
        'review_patient_copy',
        'prepare_revoke_review',
        'inspect_session_lifecycle'
      ),
      'blockedOperations', jsonb_build_array(
        'block_secret_issue',
        'block_external_link_issue',
        'block_file_location_exposure',
        'block_patient_identity_view',
        'block_clinical_text_view',
        'direct_patient_delivery'
      )
    ) as "operations",
    jsonb_build_object(
      'metadataOnly', true,
      'patientNamesExposed', false,
      'rawIdentifiersExposed', false,
      'rawTokensExposed', false,
      'rawFilesExposed', false,
      'storagePathsExposed', false,
      'signedUrlsIssued', false,
      'doctorOnlyTextExposed', false,
      'rawPolicyPayloadExposed', false
    ) as "boundaries"
  from summary s
  limit 1
) result;
`.trim();
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

function number(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function textOrNull(value) {
  return value == null ? null : String(value);
}

function bool(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseEvents(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function eventKind(action) {
  switch (action) {
    case "patient_photo_protocol.release.prepare":
      return "release_prepared";
    case "patient_photo_protocol.release.policy_review":
      return "policy_reviewed";
    case "patient_photo_protocol.release.revoke":
      return "release_revoked";
    case "patient_portal.photo_protocol.read":
      return "patient_read";
    case "patient_portal.photo_protocol.proxy.download":
      return "proxy_download";
    case "patient_portal.photo_protocol.proxy.denied":
      return "proxy_denied";
    default:
      return "audit_event";
  }
}

function eventLabel(kind) {
  switch (kind) {
    case "release_prepared":
      return "Подготовка выдачи";
    case "policy_reviewed":
      return "Проверка политики выдачи";
    case "release_revoked":
      return "Отзыв выдачи";
    case "patient_read":
      return "Просмотр протокола пациентом";
    case "proxy_download":
      return "Открытие фото пациентом";
    case "proxy_denied":
      return "Отказ backend-прокси";
    default:
      return "Событие аудита";
  }
}

function actorType(kind) {
  return kind === "patient_read" || kind === "proxy_download" || kind === "proxy_denied"
    ? "patient"
    : "staff";
}

function normalizeAuditEvent(row) {
  const kind = eventKind(String(row.action ?? ""));
  return {
    kind,
    label: eventLabel(kind),
    occurredAt: row.occurredAt ?? null,
    actorType: actorType(kind),
    status: textOrNull(row.status),
    selectedPhotoCount: number(row.selectedPhotoCount),
    blockerCount: number(row.blockerCount),
    patientDeliveryAllowed: bool(row.patientDeliveryAllowed),
    reasonPresent: bool(row.reasonPresent),
  };
}

function normalizeRelease(row) {
  const fileProxyEnabled = bool(row.patientFileProxyEnabled);
  const patientCopyApproved = bool(row.patientCopyApproved);
  const retentionPolicyApproved = bool(row.retentionPolicyApproved);
  const expiresAt = row.expiresAt ?? null;
  const requiresRetentionPolicy = !retentionPolicyApproved || !expiresAt;
  const requiresApprovedPatientCopy = !patientCopyApproved;
  return {
    id: String(row.id),
    clinicId: textOrNull(row.clinicId),
    patientId: textOrNull(row.patientId),
    visitId: textOrNull(row.visitId),
    reportId: textOrNull(row.reportId),
    status: String(row.status ?? "blocked"),
    selectedPhotoCount: number(row.selectedPhotoCount),
    counts: {
      selectedPhotos: number(row.selectedPhotoCount),
      overviewPhotos: number(row.overviewPhotoCount),
      dermoscopyPhotos: number(row.dermoscopyPhotoCount),
      reportAttachments: number(row.reportAttachmentCount),
    },
    blockers: arrayOfStrings(row.blockers),
    preparedAt: row.preparedAt ?? null,
    revokedAt: row.revokedAt ?? null,
    revokeReason: textOrNull(row.revokeReason),
    expiresAt,
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    policy: {
      patientFileProxyEnabled: fileProxyEnabled,
      patientCopyApproved,
      retentionPolicyApproved,
    },
    deliveryBoundary: {
      patientDeliveryAllowed: false,
      rawFilesExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      tokensExposed: false,
      physicianTextExposed: false,
      fileProxyReady: fileProxyEnabled,
      requiresSelfHostedFileProxy: !fileProxyEnabled,
      requiresReleaseAudit: true,
      requiresRevoke: true,
      requiresIdentityCheck: true,
      requiresRetentionPolicy,
      requiresApprovedPatientCopy,
    },
  };
}

function normalizeReleaseAudit(row) {
  return {
    releaseId: textOrNull(row.releaseId),
    clinicId: textOrNull(row.clinicId),
    patientId: textOrNull(row.patientId),
    visitId: textOrNull(row.visitId),
    status: String(row.status ?? "blocked"),
    summary: {
      eventCount: number(row.eventCount),
      preparedEvents: number(row.preparedEventCount),
      policyReviewEvents: number(row.policyReviewEventCount),
      revokedEvents: number(row.revokedEventCount),
      patientReadEvents: number(row.patientReadEventCount),
      proxyDownloadEvents: number(row.proxyDownloadEventCount),
      proxyDeniedEvents: number(row.proxyDeniedEventCount),
    },
    events: parseEvents(row.events).map(normalizeAuditEvent),
    boundaries: {
      immutableLedger: true,
      rawPayloadExposed: false,
      revokeReasonExposed: false,
      actorIdsExposed: false,
      correlationIdsExposed: false,
      storagePathsExposed: false,
      tokensExposed: false,
      signedUrlsIssued: false,
      doctorOnlyTextExposed: false,
    },
  };
}

function governancePolicyStatus(row) {
  const explicit = textOrNull(row.policyStatus);
  if (explicit) return explicit;
  const status = String(row.status ?? "blocked");
  if (status === "revoked") return "revoked";
  if (status === "blocked") return "blocked";
  if (!bool(row.patientFileProxyEnabled)) return "file_proxy_required";
  if (!bool(row.retentionPolicyApproved) || !row.expiresAt) return "retention_required";
  if (!bool(row.patientCopyApproved)) return "patient_copy_required";
  return "ready_for_access_window";
}

function normalizeGovernanceQueue(row) {
  return {
    queueNumber: number(row.queueNumber),
    status: String(row.status ?? "blocked"),
    policyStatus: governancePolicyStatus(row),
    selectedPhotoCount: number(row.selectedPhotoCount),
    blockerCount: number(row.blockerCount),
    expiresAt: row.expiresAt ?? null,
    updatedAt: row.updatedAt ?? null,
    patientFileProxyEnabled: bool(row.patientFileProxyEnabled),
    patientCopyApproved: bool(row.patientCopyApproved),
    retentionPolicyApproved: bool(row.retentionPolicyApproved),
    attention: arrayOfStrings(row.attention),
  };
}

function normalizeGovernance(row = {}) {
  const summary = row.summary ?? {};
  const operations = row.operations ?? {};
  const retention = operations.retention ?? {};
  const revokeReadiness = operations.revokeReadiness ?? {};
  const sessionLifecycle = operations.sessionLifecycle ?? {};
  return {
    summary: {
      releasesTotal: number(summary.releasesTotal),
      prepared: number(summary.prepared),
      blocked: number(summary.blocked),
      revoked: number(summary.revoked),
      retentionMissing: number(summary.retentionMissing),
      patientCopyMissing: number(summary.patientCopyMissing),
      fileProxyMissing: number(summary.fileProxyMissing),
      expiryMissing: number(summary.expiryMissing),
      activeAccessWindows: number(summary.activeAccessWindows),
      expiringIn24h: number(summary.expiringIn24h),
    },
    queue: parseEvents(row.queue).map(normalizeGovernanceQueue),
    operations: {
      retention: {
        reviewDue: number(retention.reviewDue),
        ready: number(retention.ready),
        blocked: number(retention.blocked),
        requiresClinicSignoff: bool(retention.requiresClinicSignoff),
        nextAction: textOrNull(retention.nextAction) ?? "review_retention_policy",
      },
      revokeReadiness: {
        activeWindows: number(revokeReadiness.activeWindows),
        expiringIn24h: number(revokeReadiness.expiringIn24h),
        revoked: number(revokeReadiness.revoked),
        canPrepareRevokeReview: number(revokeReadiness.canPrepareRevokeReview),
        requiresManualReason: true,
        revokeReasonExposed: false,
      },
      sessionLifecycle: {
        active: number(sessionLifecycle.active),
        expiringIn24h: number(sessionLifecycle.expiringIn24h),
        missingExpiry: number(sessionLifecycle.missingExpiry),
        revoked: number(sessionLifecycle.revoked),
        temporaryCredentialsExposed: false,
        qrTokensExposed: false,
        sessionIdsExposed: false,
      },
      allowedOperations: arrayOfStrings(operations.allowedOperations),
      blockedOperations: arrayOfStrings(operations.blockedOperations),
    },
    boundaries: {
      metadataOnly: true,
      patientNamesExposed: false,
      rawIdentifiersExposed: false,
      rawTokensExposed: false,
      rawFilesExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      doctorOnlyTextExposed: false,
      rawPolicyPayloadExposed: false,
    },
  };
}

function normalizeGovernanceOperationResult(row = {}) {
  return {
    operation: String(row.operation ?? "revoke_expired_access_windows"),
    status: String(row.status ?? (number(row.affectedCount) > 0 ? "executed" : "no_op")),
    affectedCount: number(row.affectedCount),
    skippedActiveCount: number(row.skippedActiveCount),
    expiringIn24hCount: number(row.expiringIn24hCount),
    skippedMissingExpiryCount: number(row.skippedMissingExpiryCount),
    limit: number(row.limit),
    auditAction: String(row.auditAction ?? "patient_photo_protocol.release_governance.revoke_expired"),
    boundaries: {
      metadataOnly: true,
      patientRowsExposed: false,
      rawIdentifiersExposed: false,
      revokeReasonExposed: false,
      temporaryCredentialsExposed: false,
      qrTokensExposed: false,
      sessionIdsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      patientDeliveryAllowed: false,
    },
  };
}

export function createPatientPhotoProtocolReleaseRepository(dbClient) {
  return {
    async prepareRelease(params) {
      const rows = await dbClient.queryJson(buildPreparePatientPhotoProtocolReleaseSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeRelease(rows[0]) : null;
    },
    async revokeRelease(params) {
      const rows = await dbClient.queryJson(buildRevokePatientPhotoProtocolReleaseSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeRelease(rows[0]) : null;
    },
    async reviewPolicy(params) {
      const rows = await dbClient.queryJson(buildReviewPatientPhotoProtocolReleasePolicySql(params));
      return Array.isArray(rows) && rows[0] ? normalizeRelease(rows[0]) : null;
    },
    async getReleaseAudit(params) {
      const rows = await dbClient.queryJson(buildGetPatientPhotoProtocolReleaseAuditSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeReleaseAudit(rows[0]) : null;
    },
    async getGovernance(params) {
      const rows = await dbClient.queryJson(buildGetPatientPhotoProtocolReleaseGovernanceSql(params));
      return Array.isArray(rows) && rows[0] ? normalizeGovernance(rows[0]) : normalizeGovernance();
    },
    async executeGovernanceRevokeExpired(params) {
      const rows = await dbClient.queryJson(buildExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredSql(params));
      return Array.isArray(rows) && rows[0]
        ? normalizeGovernanceOperationResult(rows[0])
        : normalizeGovernanceOperationResult();
    },
  };
}

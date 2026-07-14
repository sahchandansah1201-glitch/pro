const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clampInteger(value, { fallback, min, max }) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlNullableUuid(value) {
  return value ? `${sqlLiteral(value)}::uuid` : "null";
}

function sqlNullableText(value) {
  return value == null ? "null" : sqlLiteral(value);
}

function sqlBoolean(value) {
  return value === true ? "true" : "false";
}

function sqlInteger(value) {
  return Number.parseInt(String(value ?? 0), 10);
}

function sqlTextArray(values = []) {
  const items = (Array.isArray(values) ? values : []).map(sqlLiteral);
  return `array[${items.join(", ")}]::text[]`;
}

function sqlJsonb(value) {
  return `${sqlLiteral(JSON.stringify(value && typeof value === "object" ? value : {}))}::jsonb`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function sqlUuidList(values = []) {
  return values.map((value) => sqlUuid(value)).join(", ");
}

function normalizeSearch(value) {
  return String(value || "").trim().slice(0, 120);
}

function safeUuidList(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(String)
    .filter((value) => UUID_PATTERN.test(value))
    .slice(0, 100);
}

function clinicScopeWhere({ alias = "c", clinicIds = [], allClinics = false } = {}) {
  const ids = safeUuidList(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.id in (${sqlUuidList(ids)})`;
}

function clinicServiceScopeWhere({ alias = "s", clinicIds = [], allClinics = false } = {}) {
  const ids = safeUuidList(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function clinicIntegrationScopeWhere({ alias = "i", clinicIds = [], allClinics = false } = {}) {
  const ids = safeUuidList(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function userClinicScopeWhere({ alias = "ur", clinicIds = [], allClinics = false } = {}) {
  const ids = safeUuidList(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function adminUserMutationScopeWhere({ alias = "app_users", clinicIds = [], allClinics = false } = {}) {
  const ids = safeUuidList(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and exists (
      select 1
      from user_roles ur
      where ur.user_id = ${alias}.id
        and ur.clinic_id in (${sqlUuidList(ids)})
        and ur.role in ('doctor', 'private_doctor', 'assistant', 'operator')
    )
    and not exists (
      select 1
      from user_roles protected_role
      where protected_role.user_id = ${alias}.id
        and protected_role.role = 'system_admin'
    )`;
}

function pagination({ limit = DEFAULT_LIMIT, offset = 0 } = {}) {
  return {
    limit: clampInteger(limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT }),
    offset: clampInteger(offset, { fallback: 0, min: 0, max: 10_000 }),
  };
}

export function parseAdminListParams(searchParams) {
  const { limit, offset } = pagination({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  });
  return {
    limit,
    offset,
    search: normalizeSearch(searchParams.get("search")),
  };
}

export function buildListAdminUsersSql({
  limit = DEFAULT_LIMIT,
  offset = 0,
  search = "",
  clinicIds = [],
  allClinics = false,
  doctorsOnly = false,
} = {}) {
  const safe = pagination({ limit, offset });
  const safeSearch = normalizeSearch(search);
  const searchWhere = safeSearch
    ? `and (u.display_name ilike '%' || ${sqlLiteral(safeSearch)} || '%' or u.email::text ilike '%' || ${sqlLiteral(safeSearch)} || '%')`
    : "";
  const clinicWhere = userClinicScopeWhere({ clinicIds, allClinics });
  const doctorWhere = doctorsOnly ? "and ur.role in ('doctor', 'private_doctor')" : "";
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    u.id::text as "id",
    u.email::text as "email",
    u.display_name as "displayName",
    u.disabled_at is null as "active",
    u.disabled_at as "disabledAt",
    u.created_at as "createdAt",
    coalesce(jsonb_agg(distinct jsonb_build_object(
      'role', ur.role::text,
      'clinicId', ur.clinic_id::text,
      'clinicName', c.name,
      'clinicSlug', c.slug,
      'active', ur.disabled_at is null,
      'disabledAt', ur.disabled_at,
      'clinicStatus', coalesce(c.status, 'active')
    )) filter (where ur.id is not null), '[]'::jsonb) as "roles"
  from app_users u
  left join user_roles ur on ur.user_id = u.id
  left join clinics c on c.id = ur.clinic_id and c.deleted_at is null
  where true
    ${clinicWhere}
    ${doctorWhere}
    ${searchWhere}
  group by u.id
  order by u.created_at desc, u.id desc
  limit ${safe.limit}
  offset ${safe.offset}
) result;
`.trim();
}

export function buildCreateAdminUserSql({
  email,
  displayName,
  passwordHash,
  role,
  clinicId = null,
} = {}) {
  return `
with user_row as (
  insert into app_users (email, display_name, password_hash)
  values (${sqlLiteral(email)}, ${sqlLiteral(displayName)}, ${sqlLiteral(passwordHash)})
  on conflict (email) do nothing
  returning *
),
role_row as (
  insert into user_roles (user_id, clinic_id, role)
  select id, ${sqlNullableUuid(clinicId)}, ${sqlLiteral(role)}::app_role from user_row
  on conflict (user_id, clinic_id, role) do update
    set disabled_at = null,
        disabled_reason = null,
        disabled_by_user_id = null
  returning id
)
select row_to_json(result)::text
from (
  select
    user_row.id::text as "id",
    user_row.email::text as "email",
    user_row.display_name as "displayName",
    user_row.disabled_at is null as "active",
    user_row.created_at as "createdAt"
  from user_row
) result;
`.trim();
}

export function buildAssignAdminUserRoleSql({ userId, role, clinicId = null } = {}) {
  return `
with inserted as (
  insert into user_roles (user_id, clinic_id, role)
  values (${sqlUuid(userId)}, ${sqlNullableUuid(clinicId)}, ${sqlLiteral(role)}::app_role)
  on conflict (user_id, clinic_id, role) do update
    set disabled_at = null,
        disabled_reason = null,
        disabled_by_user_id = null
  returning *
)
select row_to_json(result)::text
from (
  select
    u.id::text as "id",
    u.email::text as "email",
    u.display_name as "displayName",
    ${sqlLiteral(role)} as "assignedRole",
    ${sqlNullableText(clinicId)} as "clinicId"
  from app_users u
  where u.id = ${sqlUuid(userId)}
) result;
`.trim();
}

export function buildDisableAdminUserSql({ userId, clinicIds = [], allClinics = false } = {}) {
  const scopeWhere = adminUserMutationScopeWhere({ clinicIds, allClinics });
  return `
with updated as (
  update app_users
  set disabled_at = coalesce(disabled_at, now()), updated_at = now()
  where id = ${sqlUuid(userId)}
    ${scopeWhere}
  returning id::text as "id", email::text as "email", display_name as "displayName", disabled_at is null as "active", disabled_at as "disabledAt"
)
select row_to_json(result)::text
from (
  select * from updated
) result;
`.trim();
}

export function buildReactivateAdminUserSql({ userId, clinicIds = [], allClinics = false } = {}) {
  const scopeWhere = adminUserMutationScopeWhere({ clinicIds, allClinics });
  return `
with updated as (
  update app_users
  set disabled_at = null, updated_at = now()
  where id = ${sqlUuid(userId)}
    ${scopeWhere}
  returning id::text as "id", email::text as "email", display_name as "displayName", disabled_at is null as "active", disabled_at as "disabledAt"
)
select row_to_json(result)::text
from (
  select * from updated
) result;
`.trim();
}

export function buildResetAdminUserPasswordSql({
  userId,
  passwordHash,
  clinicIds = [],
  allClinics = false,
} = {}) {
  const scopedClinicIds = safeUuidList(clinicIds);
  const scopedUserWhere = allClinics
    ? ""
    : scopedClinicIds.length === 0
      ? "and false"
      : `and exists (
      select 1
      from user_roles ur
      where ur.user_id = app_users.id
        and ur.clinic_id in (${sqlUuidList(scopedClinicIds)})
        and ur.role in ('doctor', 'private_doctor', 'assistant', 'operator')
    )
    and not exists (
      select 1
      from user_roles protected_role
      where protected_role.user_id = app_users.id
        and protected_role.role = 'system_admin'
    )`;
  return `
with updated as (
  update app_users
  set password_hash = ${sqlLiteral(passwordHash)},
      updated_at = now()
  where id = ${sqlUuid(userId)}
    ${scopedUserWhere}
  returning id::text as "userId",
            display_name as "displayName",
            updated_at as "passwordChangedAt"
)
select row_to_json(result)::text
from (
  select * from updated
) result;
`.trim();
}

export function buildSetAdminUserRoleStatusSql({
  userId,
  role,
  clinicId = null,
  status,
  reason = null,
  actorUserId = null,
} = {}) {
  const disabledAt = status === "disabled" ? "coalesce(disabled_at, now())" : "null";
  const disabledReason = status === "disabled" ? sqlNullableText(reason) : "null";
  const disabledBy = status === "disabled" ? sqlNullableUuid(actorUserId) : "null";
  return `
with updated as (
  update user_roles
  set disabled_at = ${disabledAt},
      disabled_reason = ${disabledReason},
      disabled_by_user_id = ${disabledBy}
  where user_id = ${sqlUuid(userId)}
    and role = ${sqlLiteral(role)}::app_role
    and clinic_id is not distinct from ${sqlNullableUuid(clinicId)}
  returning user_id::text as "userId",
            clinic_id::text as "clinicId",
            role::text as "role",
            case when disabled_at is null then 'active' else 'disabled' end as "status",
            disabled_at as "disabledAt"
)
select row_to_json(result)::text
from (
  select * from updated
) result;
`.trim();
}

export function buildListClinicsSql({
  limit = DEFAULT_LIMIT,
  offset = 0,
  search = "",
  clinicIds = [],
  allClinics = false,
} = {}) {
  const safe = pagination({ limit, offset });
  const safeSearch = normalizeSearch(search);
  const searchWhere = safeSearch
    ? `and (c.name ilike '%' || ${sqlLiteral(safeSearch)} || '%' or c.slug ilike '%' || ${sqlLiteral(safeSearch)} || '%')`
    : "";
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    c.id::text as "id",
    c.slug as "slug",
    c.name as "name",
    coalesce(c.address, '') as "address",
    c.timezone as "timezone",
    coalesce(c.status, 'active') as "status",
    c.status_reason as "statusReason",
    c.status_changed_at as "statusChangedAt",
    c.created_at as "createdAt",
    (select count(*)::int from user_roles ur where ur.clinic_id = c.id) as "usersCount",
    (select count(*)::int from patients p where p.clinic_id = c.id and p.deleted_at is null) as "patientsCount",
    (select count(*)::int from visits v where v.clinic_id = c.id) as "visitsCount"
  from clinics c
  where true
    and c.deleted_at is null
    ${clinicScopeWhere({ alias: "c", clinicIds, allClinics })}
    ${searchWhere}
  order by c.created_at desc, c.id desc
  limit ${safe.limit}
  offset ${safe.offset}
) result;
`.trim();
}

export function buildCreateClinicSql({ name, address = "", slug, timezone = "Europe/Moscow" } = {}) {
  return `
with inserted as (
  insert into clinics (name, address, slug, timezone)
  values (${sqlLiteral(name)}, ${sqlLiteral(address)}, ${sqlLiteral(slug)}, ${sqlLiteral(timezone)})
  returning id::text as "id", slug, name, coalesce(address, '') as "address", timezone, status, status_reason as "statusReason", created_at as "createdAt"
)
select row_to_json(result)::text
from (
  select * from inserted
) result;
`.trim();
}

export function buildCreatePrivatePracticeSql({
  name,
  address = "",
  slug,
  timezone = "Europe/Moscow",
  ownerEmail,
  ownerDisplayName,
  ownerPasswordHash,
} = {}) {
  return `
with clinic_row as (
  insert into clinics (name, address, slug, timezone)
  values (${sqlLiteral(name)}, ${sqlLiteral(address)}, ${sqlLiteral(slug)}, ${sqlLiteral(timezone)})
  returning *
),
user_row as (
  insert into app_users (email, display_name, password_hash)
  values (${sqlLiteral(ownerEmail)}, ${sqlLiteral(ownerDisplayName)}, ${sqlLiteral(ownerPasswordHash)})
  on conflict (email) do update
    set display_name = excluded.display_name,
        password_hash = excluded.password_hash,
        disabled_at = null,
        updated_at = now()
  returning *
),
role_rows as (
  insert into user_roles (user_id, clinic_id, role)
  select user_row.id, clinic_row.id, role_values.role::app_role
  from user_row
  cross join clinic_row
  cross join (values ('clinic_admin'), ('private_doctor')) as role_values(role)
  on conflict (user_id, clinic_id, role) do nothing
  returning role, disabled_at
)
select row_to_json(result)::text
from (
  select
    jsonb_build_object(
      'id', clinic_row.id::text,
      'slug', clinic_row.slug,
      'name', clinic_row.name,
      'address', coalesce(clinic_row.address, ''),
      'timezone', clinic_row.timezone,
      'status', clinic_row.status,
      'statusReason', clinic_row.status_reason,
      'createdAt', clinic_row.created_at,
      'usersCount', 2,
      'patientsCount', 0,
      'visitsCount', 0
    ) as "clinic",
    jsonb_build_object(
      'id', user_row.id::text,
      'email', user_row.email::text,
      'displayName', user_row.display_name,
      'active', user_row.disabled_at is null,
      'disabledAt', user_row.disabled_at,
      'createdAt', user_row.created_at,
      'roles', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'role', role_rows.role::text,
          'clinicId', clinic_row.id::text,
          'clinicName', clinic_row.name,
          'clinicSlug', clinic_row.slug,
          'active', role_rows.disabled_at is null,
          'disabledAt', role_rows.disabled_at,
          'clinicStatus', clinic_row.status
        ) order by role_rows.role::text), '[]'::jsonb)
        from role_rows
      )
    ) as "owner"
  from clinic_row
  cross join user_row
) result;
`.trim();
}

export function buildSetClinicStatusSql({ clinicId, status, reason = null, actorUserId = null } = {}) {
  return `
with updated as (
  update clinics
  set status = ${sqlLiteral(status)},
      status_reason = ${sqlNullableText(reason)},
      status_changed_at = now(),
      status_changed_by_user_id = ${sqlNullableUuid(actorUserId)},
      updated_at = now()
  where id = ${sqlUuid(clinicId)}
    and deleted_at is null
  returning id::text as "id",
            slug,
            name,
            coalesce(address, '') as "address",
            timezone,
            status,
            status_reason as "statusReason",
            status_changed_at as "statusChangedAt",
            updated_at as "updatedAt"
)
select row_to_json(result)::text
from (
  select * from updated
) result;
`.trim();
}

export function buildDeleteEmptyClinicSql({ clinicId } = {}) {
  return `
with blockers as (
  select
    (select count(*)::int from user_roles where clinic_id = ${sqlUuid(clinicId)}) as user_roles,
    (select count(*)::int from patients where clinic_id = ${sqlUuid(clinicId)} and deleted_at is null) as patients,
    (select count(*)::int from visits where clinic_id = ${sqlUuid(clinicId)}) as visits,
    (select count(*)::int from lesions where clinic_id = ${sqlUuid(clinicId)}) as lesions,
    (select count(*)::int from clinical_assets where clinic_id = ${sqlUuid(clinicId)}) as clinical_assets,
    (select count(*)::int from reports where clinic_id = ${sqlUuid(clinicId)}) as reports
),
deleted as (
  update clinics
  set deleted_at = now(),
      updated_at = now()
  where id = ${sqlUuid(clinicId)}
    and deleted_at is null
    and (
      select user_roles + patients + visits + lesions + clinical_assets + reports
      from blockers
    ) = 0
  returning id::text as "id", name
)
select row_to_json(result)::text
from (
  select
    exists(select 1 from deleted) as "deleted",
    (select id from deleted) as "id",
    (select name from deleted) as "name",
    jsonb_build_object(
      'roles', blockers.user_roles,
      'patients', blockers.patients,
      'visits', blockers.visits,
      'lesions', blockers.lesions,
      'photos', blockers.clinical_assets,
      'reports', blockers.reports
    ) as "blockers",
    (blockers.user_roles + blockers.patients + blockers.visits + blockers.lesions + blockers.clinical_assets + blockers.reports) as "blockerCount"
  from blockers
) result;
`.trim();
}

export function buildUpdateClinicSql({ clinicId, name, address, slug, timezone } = {}) {
  const clauses = [];
  if (name != null) clauses.push(`name = ${sqlLiteral(name)}`);
  if (address != null) clauses.push(`address = ${sqlLiteral(address)}`);
  if (slug != null) clauses.push(`slug = ${sqlLiteral(slug)}`);
  if (timezone != null) clauses.push(`timezone = ${sqlLiteral(timezone)}`);
  clauses.push("updated_at = now()");
  return `
with updated as (
  update clinics
  set ${clauses.join(", ")}
  where id = ${sqlUuid(clinicId)}
    and deleted_at is null
  returning id::text as "id", slug, name, coalesce(address, '') as "address", timezone, status, status_reason as "statusReason", updated_at as "updatedAt"
)
select row_to_json(result)::text
from (
  select * from updated
) result;
`.trim();
}

export function buildListClinicServicesSql({
  limit = DEFAULT_LIMIT,
  offset = 0,
  search = "",
  clinicIds = [],
  allClinics = false,
} = {}) {
  const safe = pagination({ limit, offset });
  const safeSearch = normalizeSearch(search);
  const searchWhere = safeSearch
    ? `and (s.name ilike '%' || ${sqlLiteral(safeSearch)} || '%' or c.name ilike '%' || ${sqlLiteral(safeSearch)} || '%')`
    : "";
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    s.id::text as "id",
    s.clinic_id::text as "clinicId",
    c.name as "clinicName",
    s.name as "name",
    s.category as "category",
    s.duration_min as "durationMin",
    s.price_min as "priceMin",
    s.price_max as "priceMax",
    s.consent_note as "consentNote",
    s.online_booking as "onlineBooking",
    s.active as "active",
    s.created_at as "createdAt",
    s.updated_at as "updatedAt"
  from clinic_services s
  join clinics c on c.id = s.clinic_id and c.deleted_at is null
  where s.deleted_at is null
    ${clinicServiceScopeWhere({ alias: "s", clinicIds, allClinics })}
    ${searchWhere}
  order by s.created_at desc, s.id desc
  limit ${safe.limit}
  offset ${safe.offset}
) result;
`.trim();
}

export function buildCreateClinicServiceSql({
  clinicId,
  name,
  category,
  durationMin,
  priceMin,
  priceMax,
  consentNote = "",
  onlineBooking = false,
  active = true,
  actorUserId = null,
} = {}) {
  return `
with inserted as (
  insert into clinic_services (
    clinic_id,
    name,
    category,
    duration_min,
    price_min,
    price_max,
    consent_note,
    online_booking,
    active,
    created_by_user_id,
    updated_by_user_id
  )
  values (
    ${sqlUuid(clinicId)},
    ${sqlLiteral(name)},
    ${sqlLiteral(category)},
    ${sqlInteger(durationMin)},
    ${sqlInteger(priceMin)},
    ${sqlInteger(priceMax)},
    ${sqlLiteral(consentNote || "")},
    ${sqlBoolean(onlineBooking)},
    ${sqlBoolean(active)},
    ${sqlNullableUuid(actorUserId)},
    ${sqlNullableUuid(actorUserId)}
  )
  returning *
)
select row_to_json(result)::text
from (
  select
    inserted.id::text as "id",
    inserted.clinic_id::text as "clinicId",
    c.name as "clinicName",
    inserted.name as "name",
    inserted.category as "category",
    inserted.duration_min as "durationMin",
    inserted.price_min as "priceMin",
    inserted.price_max as "priceMax",
    inserted.consent_note as "consentNote",
    inserted.online_booking as "onlineBooking",
    inserted.active as "active",
    inserted.created_at as "createdAt",
    inserted.updated_at as "updatedAt"
  from inserted
  join clinics c on c.id = inserted.clinic_id
) result;
`.trim();
}

export function buildUpdateClinicServiceSql({
  serviceId,
  clinicId,
  name,
  category,
  durationMin,
  priceMin,
  priceMax,
  consentNote,
  onlineBooking,
  active,
  actorUserId = null,
} = {}) {
  const clauses = [];
  if (name != null) clauses.push(`name = ${sqlLiteral(name)}`);
  if (category != null) clauses.push(`category = ${sqlLiteral(category)}`);
  if (durationMin != null) clauses.push(`duration_min = ${sqlInteger(durationMin)}`);
  if (priceMin != null) clauses.push(`price_min = ${sqlInteger(priceMin)}`);
  if (priceMax != null) clauses.push(`price_max = ${sqlInteger(priceMax)}`);
  if (consentNote != null) clauses.push(`consent_note = ${sqlLiteral(consentNote || "")}`);
  if (onlineBooking != null) clauses.push(`online_booking = ${sqlBoolean(onlineBooking)}`);
  if (active != null) clauses.push(`active = ${sqlBoolean(active)}`);
  clauses.push(`updated_by_user_id = ${sqlNullableUuid(actorUserId)}`);
  return `
with updated as (
  update clinic_services
  set ${clauses.join(", ")}
  where id = ${sqlUuid(serviceId)}
    and clinic_id = ${sqlUuid(clinicId)}
    and deleted_at is null
  returning *
)
select row_to_json(result)::text
from (
  select
    updated.id::text as "id",
    updated.clinic_id::text as "clinicId",
    c.name as "clinicName",
    updated.name as "name",
    updated.category as "category",
    updated.duration_min as "durationMin",
    updated.price_min as "priceMin",
    updated.price_max as "priceMax",
    updated.consent_note as "consentNote",
    updated.online_booking as "onlineBooking",
    updated.active as "active",
    updated.created_at as "createdAt",
    updated.updated_at as "updatedAt"
  from updated
  join clinics c on c.id = updated.clinic_id
) result;
`.trim();
}

export function buildListClinicIntegrationsSql({
  limit = DEFAULT_LIMIT,
  offset = 0,
  search = "",
  clinicIds = [],
  allClinics = false,
} = {}) {
  const safe = pagination({ limit, offset });
  const safeSearch = normalizeSearch(search);
  const searchWhere = safeSearch
    ? `and (i.provider ilike '%' || ${sqlLiteral(safeSearch)} || '%' or c.name ilike '%' || ${sqlLiteral(safeSearch)} || '%')`
    : "";
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    i.id::text as "id",
    i.clinic_id::text as "clinicId",
    c.name as "clinicName",
    i.provider as "provider",
    i.kind as "kind",
    i.status as "status",
    i.safe_summary_enabled as "safeSummaryEnabled",
    i.protected_link_enabled as "protectedLinkEnabled",
    i.field_map as "fieldMap",
    i.last_checked_at as "lastCheckedAt",
    i.created_at as "createdAt",
    i.updated_at as "updatedAt"
  from clinic_integrations i
  join clinics c on c.id = i.clinic_id and c.deleted_at is null
  where i.deleted_at is null
    ${clinicIntegrationScopeWhere({ alias: "i", clinicIds, allClinics })}
    ${searchWhere}
  order by i.created_at desc, i.id desc
  limit ${safe.limit}
  offset ${safe.offset}
) result;
`.trim();
}

export function buildGetClinicIntegrationSql({ integrationId, clinicIds = [], allClinics = false } = {}) {
  return `
select row_to_json(result)::text
from (
  select
    i.id::text as "id",
    i.clinic_id::text as "clinicId",
    c.name as "clinicName",
    i.provider as "provider",
    i.kind as "kind",
    i.status as "status",
    i.safe_summary_enabled as "safeSummaryEnabled",
    i.protected_link_enabled as "protectedLinkEnabled",
    i.field_map as "fieldMap",
    i.last_checked_at as "lastCheckedAt",
    i.created_at as "createdAt",
    i.updated_at as "updatedAt"
  from clinic_integrations i
  join clinics c on c.id = i.clinic_id and c.deleted_at is null
  where i.id = ${sqlUuid(integrationId)}
    and i.deleted_at is null
    ${clinicIntegrationScopeWhere({ alias: "i", clinicIds, allClinics })}
) result;
`.trim();
}

export function buildCreateClinicIntegrationSql({
  clinicId,
  provider,
  kind,
  status = "draft",
  safeSummaryEnabled = true,
  protectedLinkEnabled = true,
  fieldMap = {},
  actorUserId = null,
} = {}) {
  return `
with inserted as (
  insert into clinic_integrations (
    clinic_id,
    provider,
    kind,
    status,
    safe_summary_enabled,
    protected_link_enabled,
    field_map,
    created_by_user_id,
    updated_by_user_id
  )
  values (
    ${sqlUuid(clinicId)},
    ${sqlLiteral(provider)},
    ${sqlLiteral(kind)},
    ${sqlLiteral(status)},
    ${sqlBoolean(safeSummaryEnabled)},
    ${sqlBoolean(protectedLinkEnabled)},
    ${sqlJsonb(fieldMap)},
    ${sqlNullableUuid(actorUserId)},
    ${sqlNullableUuid(actorUserId)}
  )
  returning *
)
select row_to_json(result)::text
from (
  select
    inserted.id::text as "id",
    inserted.clinic_id::text as "clinicId",
    c.name as "clinicName",
    inserted.provider as "provider",
    inserted.kind as "kind",
    inserted.status as "status",
    inserted.safe_summary_enabled as "safeSummaryEnabled",
    inserted.protected_link_enabled as "protectedLinkEnabled",
    inserted.field_map as "fieldMap",
    inserted.last_checked_at as "lastCheckedAt",
    inserted.created_at as "createdAt",
    inserted.updated_at as "updatedAt"
  from inserted
  join clinics c on c.id = inserted.clinic_id
) result;
`.trim();
}

export function buildUpdateClinicIntegrationSql({
  integrationId,
  clinicId,
  provider,
  kind,
  status,
  safeSummaryEnabled,
  protectedLinkEnabled,
  fieldMap,
  markChecked = false,
  actorUserId = null,
} = {}) {
  const clauses = [];
  if (provider != null) clauses.push(`provider = ${sqlLiteral(provider)}`);
  if (kind != null) clauses.push(`kind = ${sqlLiteral(kind)}`);
  if (status != null) clauses.push(`status = ${sqlLiteral(status)}`);
  if (safeSummaryEnabled != null) clauses.push(`safe_summary_enabled = ${sqlBoolean(safeSummaryEnabled)}`);
  if (protectedLinkEnabled != null) clauses.push(`protected_link_enabled = ${sqlBoolean(protectedLinkEnabled)}`);
  if (fieldMap != null) clauses.push(`field_map = ${sqlJsonb(fieldMap)}`);
  if (markChecked) clauses.push("last_checked_at = now()");
  clauses.push(`updated_by_user_id = ${sqlNullableUuid(actorUserId)}`);
  return `
with updated as (
  update clinic_integrations
  set ${clauses.join(", ")}
  where id = ${sqlUuid(integrationId)}
    and clinic_id = ${sqlUuid(clinicId)}
    and deleted_at is null
  returning *
)
select row_to_json(result)::text
from (
  select
    updated.id::text as "id",
    updated.clinic_id::text as "clinicId",
    c.name as "clinicName",
    updated.provider as "provider",
    updated.kind as "kind",
    updated.status as "status",
    updated.safe_summary_enabled as "safeSummaryEnabled",
    updated.protected_link_enabled as "protectedLinkEnabled",
    updated.field_map as "fieldMap",
    updated.last_checked_at as "lastCheckedAt",
    updated.created_at as "createdAt",
    updated.updated_at as "updatedAt"
  from updated
  join clinics c on c.id = updated.clinic_id
) result;
`.trim();
}

export function buildListClinicBotSettingsSql({ clinicIds = [], allClinics = false } = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    s.id::text as "id",
    c.id::text as "clinicId",
    c.name as "clinicName",
    coalesce(s.enabled, true) as "enabled",
    coalesce(s.intake_steps, '{"consent":true,"location":true,"timeline":true,"photo":true,"booking":true}'::jsonb) as "intakeSteps",
    coalesce(s.templates, '{}'::jsonb) as "templates",
    s.last_dry_run_at as "lastDryRunAt",
    s.updated_at as "updatedAt"
  from clinics c
  left join clinic_bot_settings s on s.clinic_id = c.id
  where c.deleted_at is null
    ${clinicScopeWhere({ alias: "c", clinicIds, allClinics })}
  order by c.created_at desc, c.id desc
) result;
`.trim();
}

export function buildUpsertClinicBotSettingsSql({
  clinicId,
  enabled = true,
  intakeSteps = {},
  templates = {},
  markDryRun = false,
  actorUserId = null,
} = {}) {
  return `
with upserted as (
  insert into clinic_bot_settings (
    clinic_id,
    enabled,
    intake_steps,
    templates,
    last_dry_run_at,
    updated_by_user_id
  )
  values (
    ${sqlUuid(clinicId)},
    ${sqlBoolean(enabled)},
    ${sqlJsonb(intakeSteps)},
    ${sqlJsonb(templates)},
    ${markDryRun ? "now()" : "null"},
    ${sqlNullableUuid(actorUserId)}
  )
  on conflict (clinic_id) do update
    set enabled = excluded.enabled,
        intake_steps = excluded.intake_steps,
        templates = excluded.templates,
        last_dry_run_at = ${markDryRun ? "now()" : "clinic_bot_settings.last_dry_run_at"},
        updated_by_user_id = excluded.updated_by_user_id,
        updated_at = now()
  returning *
)
select row_to_json(result)::text
from (
  select
    upserted.id::text as "id",
    upserted.clinic_id::text as "clinicId",
    c.name as "clinicName",
    upserted.enabled as "enabled",
    upserted.intake_steps as "intakeSteps",
    upserted.templates as "templates",
    upserted.last_dry_run_at as "lastDryRunAt",
    upserted.updated_at as "updatedAt"
  from upserted
  join clinics c on c.id = upserted.clinic_id
) result;
`.trim();
}

export function buildAdminAnalyticsSql({ clinicIds = [], allClinics = false } = {}) {
  const clinicWhere = allClinics ? "" : `where c.id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  const patientClinicWhere = allClinics ? "" : `and p.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  const visitClinicWhere = allClinics ? "" : `and v.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  const assetClinicWhere = allClinics ? "" : `and a.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  const auditClinicWhere = allClinics ? "" : `and al.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  return `
select jsonb_build_object(
  'clinics', (select count(*)::int from clinics c ${clinicWhere}${clinicWhere ? " and" : " where"} c.deleted_at is null),
  'activeUsers', (
    select count(distinct u.id)::int
    from app_users u
    join user_roles ur on ur.user_id = u.id
    where u.disabled_at is null
      ${allClinics ? "" : `and ur.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`}
  ),
  'doctors', (
    select count(distinct u.id)::int
    from app_users u
    join user_roles ur on ur.user_id = u.id
    where u.disabled_at is null
      and ur.role in ('doctor', 'private_doctor')
      ${allClinics ? "" : `and ur.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`}
  ),
  'patients', (select count(*)::int from patients p where p.deleted_at is null ${patientClinicWhere}),
  'visits', (select count(*)::int from visits v where true ${visitClinicWhere}),
  'photos', (select count(*)::int from clinical_assets a where true ${assetClinicWhere}),
  'signedReports', (select count(*)::int from reports r where r.status = 'signed' ${allClinics ? "" : `and r.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`}),
  'auditEvents7d', (select count(*)::int from audit_log al where al.created_at >= now() - interval '7 days' ${auditClinicWhere})
)::text;
`.trim();
}

export function buildListAuditEventsSql({ limit = 30, clinicIds = [], allClinics = false } = {}) {
  const safeLimit = clampInteger(limit, { fallback: 30, min: 1, max: 100 });
  const clinicWhere = allClinics ? "" : `and al.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    al.id::text as "id",
    al.action as "action",
    al.entity_type as "entityType",
    al.created_at as "createdAt",
    u.display_name as "actorName",
    c.name as "clinicName"
  from audit_log al
  left join app_users u on u.id = al.actor_user_id
  left join clinics c on c.id = al.clinic_id
  where true ${clinicWhere}
  order by al.created_at desc
  limit ${safeLimit}
) result;
`.trim();
}

export function buildListServiceKeysSql({ limit = DEFAULT_LIMIT, offset = 0, search = "" } = {}) {
  const safe = pagination({ limit, offset });
  const safeSearch = normalizeSearch(search);
  const searchWhere = safeSearch
    ? `where (k.label ilike '%' || ${sqlLiteral(safeSearch)} || '%' or k.owner ilike '%' || ${sqlLiteral(safeSearch)} || '%')`
    : "";
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    k.id::text as "id",
    k.label as "label",
    k.owner as "owner",
    (k.secret_prefix || '…' || k.secret_hint) as "masked",
    k.scopes as "scopes",
    k.status as "status",
    k.last_used_at as "lastUsedAt",
    k.expires_at as "expiresAt",
    k.rotated_at as "rotatedAt",
    k.revoked_at as "revokedAt",
    k.created_at as "createdAt"
  from service_api_keys k
  ${searchWhere}
  order by k.created_at desc, k.id desc
  limit ${safe.limit}
  offset ${safe.offset}
) result;
`.trim();
}

export function buildCreateServiceKeySql({
  label,
  owner,
  scopes = [],
  secretPrefix,
  secretHint,
  secretSha256,
  expiresAt = null,
  createdByUserId = null,
} = {}) {
  return `
with inserted as (
  insert into service_api_keys (
    label,
    owner,
    secret_prefix,
    secret_hint,
    secret_sha256,
    scopes,
    expires_at,
    created_by_user_id
  )
  values (
    ${sqlLiteral(label)},
    ${sqlLiteral(owner)},
    ${sqlLiteral(secretPrefix)},
    ${sqlLiteral(secretHint)},
    ${sqlLiteral(secretSha256)},
    ${sqlTextArray(scopes)},
    ${expiresAt ? `${sqlLiteral(expiresAt)}::timestamptz` : "null"},
    ${sqlNullableUuid(createdByUserId)}
  )
  returning *
)
select row_to_json(result)::text
from (
  select
    id::text as "id",
    label,
    owner,
    (secret_prefix || '…' || secret_hint) as "masked",
    scopes,
    status,
    last_used_at as "lastUsedAt",
    expires_at as "expiresAt",
    rotated_at as "rotatedAt",
    revoked_at as "revokedAt",
    created_at as "createdAt"
  from inserted
) result;
`.trim();
}

export function buildRotateServiceKeySql({
  keyId,
  secretPrefix,
  secretHint,
  secretSha256,
  expiresAt = null,
} = {}) {
  return `
with updated as (
  update service_api_keys
  set secret_prefix = ${sqlLiteral(secretPrefix)},
      secret_hint = ${sqlLiteral(secretHint)},
      secret_sha256 = ${sqlLiteral(secretSha256)},
      expires_at = ${expiresAt ? `${sqlLiteral(expiresAt)}::timestamptz` : "expires_at"},
      status = 'active',
      rotated_at = now(),
      revoked_at = null,
      updated_at = now()
  where id = ${sqlUuid(keyId)}
  returning *
)
select row_to_json(result)::text
from (
  select
    id::text as "id",
    label,
    owner,
    (secret_prefix || '…' || secret_hint) as "masked",
    scopes,
    status,
    last_used_at as "lastUsedAt",
    expires_at as "expiresAt",
    rotated_at as "rotatedAt",
    revoked_at as "revokedAt",
    created_at as "createdAt"
  from updated
) result;
`.trim();
}

export function buildRevokeServiceKeySql({ keyId } = {}) {
  return `
with updated as (
  update service_api_keys
  set status = 'revoked',
      revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
  where id = ${sqlUuid(keyId)}
  returning *
)
select row_to_json(result)::text
from (
  select
    id::text as "id",
    label,
    owner,
    (secret_prefix || '…' || secret_hint) as "masked",
    scopes,
    status,
    last_used_at as "lastUsedAt",
    expires_at as "expiresAt",
    rotated_at as "rotatedAt",
    revoked_at as "revokedAt",
    created_at as "createdAt"
  from updated
) result;
`.trim();
}

export function createAdminManagementRepository(dbClient) {
  return {
    async listUsers(params) {
      return dbClient.queryJson(buildListAdminUsersSql(params));
    },
    async createUser(params) {
      return dbClient.queryJson(buildCreateAdminUserSql(params));
    },
    async assignUserRole(params) {
      return dbClient.queryJson(buildAssignAdminUserRoleSql(params));
    },
    async disableUser(params) {
      return dbClient.queryJson(buildDisableAdminUserSql(params));
    },
    async reactivateUser(params) {
      return dbClient.queryJson(buildReactivateAdminUserSql(params));
    },
    async resetUserPassword(params) {
      return dbClient.queryJson(buildResetAdminUserPasswordSql(params));
    },
    async setUserRoleStatus(params) {
      return dbClient.queryJson(buildSetAdminUserRoleStatusSql(params));
    },
    async listClinics(params) {
      return dbClient.queryJson(buildListClinicsSql(params));
    },
    async createClinic(params) {
      return dbClient.queryJson(buildCreateClinicSql(params));
    },
    async createPrivatePractice(params) {
      return dbClient.queryJson(buildCreatePrivatePracticeSql(params));
    },
    async updateClinic(params) {
      return dbClient.queryJson(buildUpdateClinicSql(params));
    },
    async listClinicServices(params) {
      return dbClient.queryJson(buildListClinicServicesSql(params));
    },
    async createClinicService(params) {
      return dbClient.queryJson(buildCreateClinicServiceSql(params));
    },
    async updateClinicService(params) {
      return dbClient.queryJson(buildUpdateClinicServiceSql(params));
    },
    async listClinicIntegrations(params) {
      return dbClient.queryJson(buildListClinicIntegrationsSql(params));
    },
    async getClinicIntegration(params) {
      return dbClient.queryJson(buildGetClinicIntegrationSql(params));
    },
    async createClinicIntegration(params) {
      return dbClient.queryJson(buildCreateClinicIntegrationSql(params));
    },
    async updateClinicIntegration(params) {
      return dbClient.queryJson(buildUpdateClinicIntegrationSql(params));
    },
    async listClinicBotSettings(params) {
      return dbClient.queryJson(buildListClinicBotSettingsSql(params));
    },
    async upsertClinicBotSettings(params) {
      return dbClient.queryJson(buildUpsertClinicBotSettingsSql(params));
    },
    async setClinicStatus(params) {
      return dbClient.queryJson(buildSetClinicStatusSql(params));
    },
    async deleteEmptyClinic(params) {
      return dbClient.queryJson(buildDeleteEmptyClinicSql(params));
    },
    async getAnalytics(params) {
      return dbClient.queryJson(buildAdminAnalyticsSql(params));
    },
    async listAuditEvents(params) {
      return dbClient.queryJson(buildListAuditEventsSql(params));
    },
    async listServiceKeys(params) {
      return dbClient.queryJson(buildListServiceKeysSql(params));
    },
    async createServiceKey(params) {
      return dbClient.queryJson(buildCreateServiceKeySql(params));
    },
    async rotateServiceKey(params) {
      return dbClient.queryJson(buildRotateServiceKeySql(params));
    },
    async revokeServiceKey(params) {
      return dbClient.queryJson(buildRevokeServiceKeySql(params));
    },
  };
}

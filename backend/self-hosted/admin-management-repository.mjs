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

function userClinicScopeWhere({ alias = "ur", clinicIds = [], allClinics = false } = {}) {
  const ids = safeUuidList(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
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
      'clinicSlug', c.slug
    )) filter (where ur.id is not null), '[]'::jsonb) as "roles"
  from app_users u
  left join user_roles ur on ur.user_id = u.id
  left join clinics c on c.id = ur.clinic_id
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
  on conflict (email) do update
    set display_name = excluded.display_name,
        password_hash = excluded.password_hash,
        disabled_at = null,
        updated_at = now()
  returning *
),
role_row as (
  insert into user_roles (user_id, clinic_id, role)
  select id, ${sqlNullableUuid(clinicId)}, ${sqlLiteral(role)}::app_role from user_row
  on conflict (user_id, clinic_id, role) do nothing
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
  on conflict (user_id, clinic_id, role) do nothing
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

export function buildDisableAdminUserSql({ userId } = {}) {
  return `
with updated as (
  update app_users
  set disabled_at = coalesce(disabled_at, now()), updated_at = now()
  where id = ${sqlUuid(userId)}
  returning id::text as "id", email::text as "email", display_name as "displayName", disabled_at as "disabledAt"
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
    c.created_at as "createdAt",
    (select count(*)::int from user_roles ur where ur.clinic_id = c.id) as "usersCount",
    (select count(*)::int from patients p where p.clinic_id = c.id and p.deleted_at is null) as "patientsCount",
    (select count(*)::int from visits v where v.clinic_id = c.id) as "visitsCount"
  from clinics c
  where true
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
  returning id::text as "id", slug, name, coalesce(address, '') as "address", timezone, created_at as "createdAt"
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
  returning role
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
          'clinicSlug', clinic_row.slug
        ) order by role_rows.role::text), '[]'::jsonb)
        from role_rows
      )
    ) as "owner"
  from clinic_row
  cross join user_row
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
  returning id::text as "id", slug, name, coalesce(address, '') as "address", timezone, updated_at as "updatedAt"
)
select row_to_json(result)::text
from (
  select * from updated
) result;
`.trim();
}

export function buildAdminAnalyticsSql({ clinicIds = [], allClinics = false } = {}) {
  const clinicWhere = allClinics ? "" : `where c.id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  const patientClinicWhere = allClinics ? "" : `and p.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  const visitClinicWhere = allClinics ? "" : `and v.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  const assetClinicWhere = allClinics ? "" : `and a.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"})`;
  const auditClinicWhere = allClinics ? "" : `and (al.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"}) or al.clinic_id is null)`;
  return `
select jsonb_build_object(
  'clinics', (select count(*)::int from clinics c ${clinicWhere}),
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
  const clinicWhere = allClinics ? "" : `and (al.clinic_id in (${sqlUuidList(safeUuidList(clinicIds)) || "null"}) or al.clinic_id is null)`;
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
    async getAnalytics(params) {
      return dbClient.queryJson(buildAdminAnalyticsSql(params));
    },
    async listAuditEvents(params) {
      return dbClient.queryJson(buildListAuditEventsSql(params));
    },
  };
}

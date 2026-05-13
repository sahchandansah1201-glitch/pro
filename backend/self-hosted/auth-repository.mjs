function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  return `${sqlLiteral(value)}::uuid`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase().slice(0, 320);
}

function normalizeUser(row) {
  if (!row?.id || !row?.passwordHash) return null;
  return {
    id: String(row.id),
    displayName: String(row.displayName || ""),
    email: String(row.email || ""),
    passwordHash: String(row.passwordHash || ""),
    disabledAt: row.disabledAt ?? null,
    roles: Array.isArray(row.roles)
      ? row.roles.map((role) => ({
          role: String(role.role),
          clinicId: role.clinicId ? String(role.clinicId) : null,
          clinicSlug: role.clinicSlug ? String(role.clinicSlug) : null,
        }))
      : [],
  };
}

export function buildFindActiveUserByEmailSql(email) {
  const safeEmail = normalizeEmail(email);
  return `
select coalesce(row_to_json(result), 'null'::json)::text
from (
  select
    u.id::text as "id",
    u.email::text as "email",
    u.display_name as "displayName",
    u.password_hash as "passwordHash",
    u.disabled_at as "disabledAt",
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'role', ur.role::text,
            'clinicId', ur.clinic_id::text,
            'clinicSlug', c.slug
          )
          order by ur.role::text, c.slug
        )
        from user_roles ur
        left join clinics c on c.id = ur.clinic_id
        where ur.user_id = u.id
      ),
      '[]'::jsonb
    ) as "roles"
  from app_users u
  where lower(u.email::text) = ${sqlLiteral(safeEmail)}
    and u.disabled_at is null
  limit 1
) result;
`.trim();
}

export function buildFindUserContextByIdSql(userId) {
  return `
select coalesce(row_to_json(result), 'null'::json)::text
from (
  select
    u.id::text as "id",
    u.display_name as "displayName",
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'role', ur.role::text,
            'clinicId', ur.clinic_id::text,
            'clinicSlug', c.slug
          )
          order by ur.role::text, c.slug
        )
        from user_roles ur
        left join clinics c on c.id = ur.clinic_id
        where ur.user_id = u.id
      ),
      '[]'::jsonb
    ) as "roles"
  from app_users u
  where u.id = ${sqlUuid(userId)}
    and u.disabled_at is null
  limit 1
) result;
`.trim();
}

export function createAuthRepository(dbClient) {
  return {
    async findActiveUserByEmail(email) {
      const row = await dbClient.queryJson(buildFindActiveUserByEmailSql(email));
      return normalizeUser(row);
    },

    async findUserContextById(userId) {
      const row = await dbClient.queryJson(buildFindUserContextByIdSql(userId));
      if (!row?.id) return null;
      return {
        id: String(row.id),
        displayName: String(row.displayName || ""),
        roles: Array.isArray(row.roles)
          ? row.roles.map((role) => ({
              role: String(role.role),
              clinicId: role.clinicId ? String(role.clinicId) : null,
              clinicSlug: role.clinicSlug ? String(role.clinicSlug) : null,
            }))
          : [],
      };
    },
  };
}

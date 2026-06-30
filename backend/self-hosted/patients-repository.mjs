const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clampInteger(value, { fallback, min, max }) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNullableText(value) {
  return value == null ? "null" : sqlLiteral(value);
}

function sqlNullableDate(value) {
  return value == null ? "null" : `${sqlLiteral(value)}::date`;
}

function sqlNullableBoolean(value) {
  return value == null ? "null" : value ? "true" : "false";
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

function safeClinicIds(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(String)
    .filter((value) => UUID_PATTERN.test(value))
    .slice(0, 100);
}

function clinicScopeWhere({
  alias = "p",
  clinicIds = [],
  allClinics = false,
} = {}) {
  const ids = safeClinicIds(clinicIds);
  if (allClinics) return "";
  if (ids.length === 0) return "and false";
  return `and ${alias}.clinic_id in (${sqlUuidList(ids)})`;
}

function patientSelectColumns({ includeNotes = false } = {}) {
  return `
    p.id::text as "id",
    p.clinic_id::text as "clinicId",
    p.code as "code",
    p.full_name as "fullName",
    p.birth_date as "birthDate",
    p.sex as "sex",
    p.phototype as "phototype",
    p.imaging_consent as "imagingConsent",
    ${includeNotes ? 'p.notes as "notes",' : ""}
    c.slug as "clinicSlug",
    c.name as "clinicName",
    p.created_at as "createdAt",
    p.updated_at as "updatedAt",
    p.deleted_at as "deletedAt"
  `;
}

export function parsePatientListParams(searchParams) {
  const limit = clampInteger(searchParams.get("limit"), {
    fallback: DEFAULT_LIMIT,
    min: 1,
    max: MAX_LIMIT,
  });
  const offset = clampInteger(searchParams.get("offset"), {
    fallback: 0,
    min: 0,
    max: 10_000,
  });
  const search = normalizeSearch(searchParams.get("search"));
  return { limit, offset, search };
}

export function buildListPatientsSql({
  limit = DEFAULT_LIMIT,
  offset = 0,
  search = "",
  clinicIds = [],
  allClinics = false,
} = {}) {
  const safeLimit = clampInteger(limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT });
  const safeOffset = clampInteger(offset, { fallback: 0, min: 0, max: 10_000 });
  const safeSearch = normalizeSearch(search);
  const searchWhere = safeSearch
    ? `and (p.full_name ilike '%' || ${sqlLiteral(safeSearch)} || '%' or p.code ilike '%' || ${sqlLiteral(safeSearch)} || '%')`
    : "";
  const clinicWhere = clinicScopeWhere({ clinicIds, allClinics });

  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    ${patientSelectColumns()}
  from patients p
  join clinics c on c.id = p.clinic_id
  where p.deleted_at is null
  ${clinicWhere}
  ${searchWhere}
  order by p.created_at desc, p.id desc
  limit ${safeLimit}
  offset ${safeOffset}
) result;
`.trim();
}

export function buildGetPatientSql({
  patientId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    ${patientSelectColumns({ includeNotes: true })}
  from patients p
  join clinics c on c.id = p.clinic_id
  where p.id = ${sqlUuid(patientId)}
    and p.deleted_at is null
    ${clinicScopeWhere({ clinicIds, allClinics })}
  limit 1
) result;
`.trim();
}

export function buildCreatePatientSql({
  clinicId,
  code = null,
  fullName,
  birthDate = null,
  sex = "unknown",
  phototype = null,
  imagingConsent = false,
  notes = null,
  actorUserId,
} = {}) {
  const codeSql = code
    ? sqlLiteral(code)
    : "concat('DP-', to_char(now(), 'YYYYMMDD'), '-', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)))";
  return `
with inserted as (
  insert into patients (
    clinic_id,
    code,
    full_name,
    birth_date,
    sex,
    phototype,
    imaging_consent,
    notes,
    created_by
  )
  values (
    ${sqlUuid(clinicId)},
    ${codeSql},
    ${sqlLiteral(fullName)},
    ${sqlNullableDate(birthDate)},
    ${sqlLiteral(sex)},
    ${sqlNullableText(phototype)},
    ${sqlNullableBoolean(imagingConsent)},
    ${sqlNullableText(notes)},
    ${sqlUuid(actorUserId)}
  )
  returning *
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    ${patientSelectColumns({ includeNotes: true })}
  from inserted p
  join clinics c on c.id = p.clinic_id
) result;
`.trim();
}

function buildPatientUpdateSet(changes = {}) {
  const clauses = [];
  if (Object.hasOwn(changes, "code")) clauses.push(`code = ${sqlLiteral(changes.code)}`);
  if (Object.hasOwn(changes, "fullName")) clauses.push(`full_name = ${sqlLiteral(changes.fullName)}`);
  if (Object.hasOwn(changes, "birthDate")) clauses.push(`birth_date = ${sqlNullableDate(changes.birthDate)}`);
  if (Object.hasOwn(changes, "sex")) clauses.push(`sex = ${sqlLiteral(changes.sex)}`);
  if (Object.hasOwn(changes, "phototype")) clauses.push(`phototype = ${sqlNullableText(changes.phototype)}`);
  if (Object.hasOwn(changes, "imagingConsent")) clauses.push(`imaging_consent = ${sqlNullableBoolean(changes.imagingConsent)}`);
  if (Object.hasOwn(changes, "notes")) clauses.push(`notes = ${sqlNullableText(changes.notes)}`);
  return [...clauses, "updated_at = now()"].join(",\n      ");
}

export function buildUpdatePatientSql({
  patientId,
  changes = {},
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
with updated as (
  update patients p
  set ${buildPatientUpdateSet(changes)}
  where p.id = ${sqlUuid(patientId)}
    and p.deleted_at is null
    ${clinicScopeWhere({ alias: "p", clinicIds, allClinics })}
  returning p.*
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    ${patientSelectColumns({ includeNotes: true })}
  from updated p
  join clinics c on c.id = p.clinic_id
) result;
`.trim();
}

export function buildArchivePatientSql({
  patientId,
  clinicIds = [],
  allClinics = false,
} = {}) {
  return `
with archived as (
  update patients p
  set deleted_at = now(),
      updated_at = now()
  where p.id = ${sqlUuid(patientId)}
    and p.deleted_at is null
    ${clinicScopeWhere({ alias: "p", clinicIds, allClinics })}
  returning p.*
)
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    ${patientSelectColumns({ includeNotes: true })}
  from archived p
  join clinics c on c.id = p.clinic_id
) result;
`.trim();
}

function normalizePatient(row, { includeNotes = false } = {}) {
  return {
    id: String(row.id),
    code: String(row.code),
    fullName: String(row.fullName),
    birthDate: row.birthDate ?? null,
    sex: row.sex ?? "unknown",
    phototype: row.phototype ?? null,
    imagingConsent: Boolean(row.imagingConsent),
    ...(includeNotes ? { notes: row.notes ?? null } : {}),
    clinic: {
      id: row.clinicId ? String(row.clinicId) : undefined,
      slug: String(row.clinicSlug),
      name: String(row.clinicName),
    },
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
    deletedAt: row.deletedAt ?? null,
  };
}

async function queryOnePatient(dbClient, sql) {
  const rows = await dbClient.queryJson(sql);
  return Array.isArray(rows) && rows[0]
    ? normalizePatient(rows[0], { includeNotes: true })
    : null;
}

export function createPatientRepository(dbClient) {
  return {
    async listPatients(params = {}) {
      const query = {
        limit: clampInteger(params.limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT }),
        offset: clampInteger(params.offset, { fallback: 0, min: 0, max: 10_000 }),
        search: normalizeSearch(params.search),
        clinicIds: safeClinicIds(params.clinicIds),
        allClinics: Boolean(params.allClinics),
      };
      const rows = await dbClient.queryJson(buildListPatientsSql(query));
      const items = Array.isArray(rows) ? rows.map(normalizePatient) : [];
      return {
        items,
        count: items.length,
        limit: query.limit,
        offset: query.offset,
        search: query.search,
        clinicIds: query.clinicIds,
        allClinics: query.allClinics,
        source: "postgres",
      };
    },

    async getPatient(params = {}) {
      return queryOnePatient(dbClient, buildGetPatientSql(params));
    },

    async createPatient(params = {}) {
      return queryOnePatient(dbClient, buildCreatePatientSql(params));
    },

    async updatePatient(params = {}) {
      return queryOnePatient(dbClient, buildUpdatePatientSql(params));
    },

    async archivePatient(params = {}) {
      return queryOnePatient(dbClient, buildArchivePatientSql(params));
    },
  };
}

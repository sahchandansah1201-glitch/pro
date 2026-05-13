const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function clampInteger(value, { fallback, min, max }) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function normalizeSearch(value) {
  return String(value || "").trim().slice(0, 120);
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

export function buildListPatientsSql({ limit = DEFAULT_LIMIT, offset = 0, search = "" } = {}) {
  const safeLimit = clampInteger(limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT });
  const safeOffset = clampInteger(offset, { fallback: 0, min: 0, max: 10_000 });
  const safeSearch = normalizeSearch(search);
  const searchWhere = safeSearch
    ? `and (p.full_name ilike '%' || ${sqlLiteral(safeSearch)} || '%' or p.code ilike '%' || ${sqlLiteral(safeSearch)} || '%')`
    : "";

  return `
select coalesce(jsonb_agg(row_to_json(result)), '[]'::jsonb)::text
from (
  select
    p.id::text as "id",
    p.code as "code",
    p.full_name as "fullName",
    p.birth_date as "birthDate",
    p.sex as "sex",
    p.phototype as "phototype",
    p.imaging_consent as "imagingConsent",
    c.slug as "clinicSlug",
    c.name as "clinicName",
    p.created_at as "createdAt",
    p.updated_at as "updatedAt"
  from patients p
  join clinics c on c.id = p.clinic_id
  where p.deleted_at is null
  ${searchWhere}
  order by p.created_at desc, p.id desc
  limit ${safeLimit}
  offset ${safeOffset}
) result;
`.trim();
}

function normalizePatient(row) {
  return {
    id: String(row.id),
    code: String(row.code),
    fullName: String(row.fullName),
    birthDate: row.birthDate ?? null,
    sex: row.sex ?? "unknown",
    phototype: row.phototype ?? null,
    imagingConsent: Boolean(row.imagingConsent),
    clinic: {
      slug: String(row.clinicSlug),
      name: String(row.clinicName),
    },
    createdAt: row.createdAt ?? null,
    updatedAt: row.updatedAt ?? null,
  };
}

export function createPatientRepository(dbClient) {
  return {
    async listPatients(params = {}) {
      const query = {
        limit: clampInteger(params.limit, { fallback: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT }),
        offset: clampInteger(params.offset, { fallback: 0, min: 0, max: 10_000 }),
        search: normalizeSearch(params.search),
      };
      const rows = await dbClient.queryJson(buildListPatientsSql(query));
      const items = Array.isArray(rows) ? rows.map(normalizePatient) : [];
      return {
        items,
        count: items.length,
        limit: query.limit,
        offset: query.offset,
        search: query.search,
        source: "postgres",
      };
    },
  };
}

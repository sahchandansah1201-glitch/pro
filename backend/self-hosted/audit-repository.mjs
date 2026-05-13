function sqlLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlNullableUuid(value) {
  return value ? `${sqlLiteral(value)}::uuid` : "null";
}

function sqlJson(value) {
  return `${sqlLiteral(JSON.stringify(value ?? {}))}::jsonb`;
}

export function buildAuditInsertSql({
  clinicId = null,
  actorUserId = null,
  action,
  entityType,
  entityId = null,
  correlationId,
  metadata = {},
}) {
  return `
with inserted as (
  insert into audit_log (
    clinic_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    correlation_id,
    metadata_json
  )
  values (
    ${sqlNullableUuid(clinicId)},
    ${sqlNullableUuid(actorUserId)},
    ${sqlLiteral(action)},
    ${sqlLiteral(entityType)},
    ${sqlNullableUuid(entityId)},
    ${sqlLiteral(correlationId)},
    ${sqlJson(metadata)}
  )
  returning id::text
)
select coalesce(row_to_json(inserted), 'null'::json)::text from inserted;
`.trim();
}

export function createAuditRepository(dbClient) {
  return {
    async recordEvent(event) {
      return dbClient.queryJson(buildAuditInsertSql(event));
    },
  };
}

export async function recordAuditBestEffort(auditRepository, event) {
  try {
    await auditRepository.recordEvent(event);
    return true;
  } catch {
    return false;
  }
}

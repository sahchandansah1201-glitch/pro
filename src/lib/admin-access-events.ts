export type AccessEventSource = "api" | "demo";

export interface AccessEventExportRow {
  id?: string;
  createdAt: string;
  clinicName: string;
  actorLabel: string;
  action: string;
  entity: string;
  entityId: string | null;
  patientCode: string | null;
  visitId: string | null;
  lesionLabel: string | null;
  source: AccessEventSource;
}

export interface AccessEventsCsvMeta {
  filterLabel?: string;
  query?: string;
}

function csvCell(value: string | null): string {
  return `"${(value ?? "—").replaceAll('"', '""')}"`;
}

export function buildAccessEventsCsv(
  rows: AccessEventExportRow[],
  meta: AccessEventsCsvMeta = {},
): string {
  const header = [
    "event_id",
    "created_at",
    "clinic",
    "actor",
    "action",
    "entity",
    "entity_id",
    "patient_code",
    "visit_id",
    "lesion",
    "source",
  ];
  const metadata = [
    ["# filter", meta.filterLabel ?? "all"],
    ["# query", meta.query?.trim() || "—"],
    ["# row_count", String(rows.length)],
  ].map((row) => row.map(csvCell).join(","));
  const body = rows.map((row) =>
    [
      row.id ?? null,
      row.createdAt,
      row.clinicName,
      row.actorLabel,
      row.action,
      row.entity,
      row.entityId,
      row.patientCode,
      row.visitId,
      row.lesionLabel,
      row.source,
    ]
      .map(csvCell)
      .join(","),
  );
  return [...metadata, header.join(","), ...body].join("\n");
}

export function accessEventsCsvFilename(filterKey: string, query: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const filter = filterKey.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "all";
  const q = query.trim().replace(/[^a-z0-9а-яА-Я_-]+/g, "-").replace(/^-+|-+$/g, "");
  return q
    ? `access-events-${date}-${filter}-${q.slice(0, 24)}.csv`
    : `access-events-${date}-${filter}.csv`;
}

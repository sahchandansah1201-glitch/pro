export type AccessEventSource = "api" | "demo";

export interface AccessEventExportRow {
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

function csvCell(value: string | null): string {
  return `"${(value ?? "—").replaceAll('"', '""')}"`;
}

export function buildAccessEventsCsv(rows: AccessEventExportRow[]): string {
  const header = [
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
  const body = rows.map((row) =>
    [
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
  return [header.join(","), ...body].join("\n");
}

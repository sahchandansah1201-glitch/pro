export type AccessEventSource = "api" | "demo";

export const ACCESS_EVENTS_EXPORT_LIMIT = 200;

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

export const ACCESS_EVENT_EXPORT_COLUMNS = [
  { key: "event_id", label: "ID события", header: "event_id" },
  { key: "created_at", label: "Когда", header: "created_at" },
  { key: "clinic", label: "Клиника", header: "clinic" },
  { key: "actor", label: "Актор", header: "actor" },
  { key: "action", label: "Действие", header: "action" },
  { key: "entity", label: "Сущность", header: "entity" },
  { key: "entity_id", label: "ID сущности", header: "entity_id" },
  { key: "patient_code", label: "Код пациента", header: "patient_code" },
  { key: "visit_id", label: "Визит", header: "visit_id" },
  { key: "lesion", label: "Очаг", header: "lesion" },
  { key: "source", label: "Источник", header: "source" },
] as const;

export type AccessEventExportColumnKey = (typeof ACCESS_EVENT_EXPORT_COLUMNS)[number]["key"];

export const DEFAULT_ACCESS_EVENT_EXPORT_COLUMNS = ACCESS_EVENT_EXPORT_COLUMNS.map((column) => column.key);

export interface AccessEventsCsvMeta {
  filterLabel?: string;
  query?: string;
  scopeLabel?: string;
  columns?: AccessEventExportColumnKey[];
}

export interface AccessEventsFilenameOptions {
  scope?: string;
  rowCount?: number;
  columnCount?: number;
  repeated?: boolean;
}

type CellValue = string | null;

export function limitAccessEventExportRows<T>(
  rows: T[],
  limit = ACCESS_EVENTS_EXPORT_LIMIT,
): T[] {
  return rows.slice(0, Math.max(0, limit));
}

function normalizeColumns(columns: AccessEventExportColumnKey[] | undefined): typeof ACCESS_EVENT_EXPORT_COLUMNS {
  if (!columns || columns.length === 0) return ACCESS_EVENT_EXPORT_COLUMNS;
  const allowed = new Set(columns);
  const selected = ACCESS_EVENT_EXPORT_COLUMNS.filter((column) => allowed.has(column.key));
  return selected.length > 0 ? selected : ACCESS_EVENT_EXPORT_COLUMNS;
}

function valueForColumn(row: AccessEventExportRow, key: AccessEventExportColumnKey): CellValue {
  switch (key) {
    case "event_id":
      return row.id ?? null;
    case "created_at":
      return row.createdAt;
    case "clinic":
      return row.clinicName;
    case "actor":
      return row.actorLabel;
    case "action":
      return row.action;
    case "entity":
      return row.entity;
    case "entity_id":
      return row.entityId;
    case "patient_code":
      return row.patientCode;
    case "visit_id":
      return row.visitId;
    case "lesion":
      return row.lesionLabel;
    case "source":
      return row.source;
  }
}

function exportMatrix(rows: AccessEventExportRow[], meta: AccessEventsCsvMeta): CellValue[][] {
  const columns = normalizeColumns(meta.columns);
  return [
    ["# filter", meta.filterLabel ?? "all"],
    ["# query", meta.query?.trim() || "—"],
    ["# scope", meta.scopeLabel ?? "all"],
    ["# columns", String(columns.length)],
    ["# row_count", String(rows.length)],
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => valueForColumn(row, column.key))),
  ];
}

function csvCell(value: string | null): string {
  return `"${(value ?? "—").replaceAll('"', '""')}"`;
}

export function buildAccessEventsCsv(
  rows: AccessEventExportRow[],
  meta: AccessEventsCsvMeta = {},
): string {
  return exportMatrix(rows, meta)
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

function filenamePart(value: string): string {
  return value.replace(/[^a-z0-9а-яА-Я_-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function accessEventsCsvFilename(
  filterKey: string,
  query: string,
  options: AccessEventsFilenameOptions = {},
): string {
  const date = new Date().toISOString().slice(0, 10);
  const parts = ["access-events", date, filenamePart(filterKey) || "all"];
  const scope = options.scope ? filenamePart(options.scope) : "";
  if (scope) parts.push(scope.slice(0, 32));
  if (typeof options.rowCount === "number") parts.push(`${Math.max(0, options.rowCount)}-rows`);
  if (typeof options.columnCount === "number") parts.push(`${Math.max(0, options.columnCount)}-cols`);
  if (query.trim()) parts.push("query");
  if (options.repeated) parts.push("repeat");
  return `${parts.join("-")}.csv`;
}

export function accessEventsXlsxFilename(
  filterKey: string,
  query: string,
  options: AccessEventsFilenameOptions = {},
): string {
  return accessEventsCsvFilename(filterKey, query, options).replace(/\.csv$/, ".xlsx");
}

function xmlEscape(value: CellValue): string {
  return (value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnName(index: number): string {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function worksheetXml(matrix: CellValue[][]): string {
  const rows = matrix
    .map((row, rowIndex) => {
      const r = rowIndex + 1;
      const cells = row
        .map(
          (cell, colIndex) =>
            `<c r="${columnName(colIndex)}${r}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`,
        )
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rows}</sheetData>
</worksheet>`;
}

const encoder = new TextEncoder();

function bytes(text: string): Uint8Array {
  return encoder.encode(text);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pushUint16(out: number[], value: number): void {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUint32(out: number[], value: number): void {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
  crc: number;
  offset: number;
}

function pushLocalFile(out: number[], entry: ZipEntry): void {
  const name = bytes(entry.name);
  pushUint32(out, 0x04034b50);
  pushUint16(out, 20);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint32(out, entry.crc);
  pushUint32(out, entry.data.length);
  pushUint32(out, entry.data.length);
  pushUint16(out, name.length);
  pushUint16(out, 0);
  out.push(...name, ...entry.data);
}

function pushCentralDirectory(out: number[], entry: ZipEntry): void {
  const name = bytes(entry.name);
  pushUint32(out, 0x02014b50);
  pushUint16(out, 20);
  pushUint16(out, 20);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint32(out, entry.crc);
  pushUint32(out, entry.data.length);
  pushUint32(out, entry.data.length);
  pushUint16(out, name.length);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint32(out, 0);
  pushUint32(out, entry.offset);
  out.push(...name);
}

function zip(files: { name: string; text: string }[]): Uint8Array {
  const out: number[] = [];
  const entries: ZipEntry[] = [];
  for (const file of files) {
    const data = bytes(file.text);
    const entry = { name: file.name, data, crc: crc32(data), offset: out.length };
    entries.push(entry);
    pushLocalFile(out, entry);
  }
  const centralOffset = out.length;
  for (const entry of entries) pushCentralDirectory(out, entry);
  const centralSize = out.length - centralOffset;
  pushUint32(out, 0x06054b50);
  pushUint16(out, 0);
  pushUint16(out, 0);
  pushUint16(out, entries.length);
  pushUint16(out, entries.length);
  pushUint32(out, centralSize);
  pushUint32(out, centralOffset);
  pushUint16(out, 0);
  return new Uint8Array(out);
}

export function buildAccessEventsXlsxBytes(
  rows: AccessEventExportRow[],
  meta: AccessEventsCsvMeta = {},
): Uint8Array {
  const matrix = exportMatrix(rows, meta);
  return zip([
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Access events" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      text: worksheetXml(matrix),
    },
  ]);
}

export function buildAccessEventsXlsxBlob(
  rows: AccessEventExportRow[],
  meta: AccessEventsCsvMeta = {},
): Blob {
  const archive = buildAccessEventsXlsxBytes(rows, meta);
  return new Blob([archive], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

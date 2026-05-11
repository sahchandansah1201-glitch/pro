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

export interface AccessEventsCsvMeta {
  filterLabel?: string;
  query?: string;
}

type CellValue = string | null;

export function limitAccessEventExportRows<T>(
  rows: T[],
  limit = ACCESS_EVENTS_EXPORT_LIMIT,
): T[] {
  return rows.slice(0, Math.max(0, limit));
}

function exportMatrix(
  rows: AccessEventExportRow[],
  meta: AccessEventsCsvMeta,
): CellValue[][] {
  return [
    ["# filter", meta.filterLabel ?? "all"],
    ["# query", meta.query?.trim() || "—"],
    ["# row_count", String(rows.length)],
    [
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
    ],
    ...rows.map((row) => [
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
    ]),
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

export function accessEventsCsvFilename(filterKey: string, query: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const filter = filterKey.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "all";
  const q = query.trim().replace(/[^a-z0-9а-яА-Я_-]+/g, "-").replace(/^-+|-+$/g, "");
  return q
    ? `access-events-${date}-${filter}-${q.slice(0, 24)}.csv`
    : `access-events-${date}-${filter}.csv`;
}

export function accessEventsXlsxFilename(filterKey: string, query: string): string {
  return accessEventsCsvFilename(filterKey, query).replace(/\.csv$/, ".xlsx");
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

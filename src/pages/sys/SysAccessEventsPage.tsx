import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, RefreshCw, Search, ShieldAlert, ShieldCheck } from "lucide-react";

import { ListPagination } from "@/components/admin/ListPagination";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useRole } from "@/context/role-context";
import {
  ACCESS_EVENT_EXPORT_COLUMNS,
  ACCESS_EVENTS_EXPORT_LIMIT,
  DEFAULT_ACCESS_EVENT_EXPORT_COLUMNS,
  accessEventsCsvFilename,
  accessEventsXlsxFilename,
  buildAccessEventsCsv,
  buildAccessEventsXlsxBlob,
  limitAccessEventExportRows,
  type AccessEventExportColumnKey,
  type AccessEventSource,
} from "@/lib/admin-access-events";
import { formatDateTime } from "@/lib/format";
import {
  getAuditLogs,
  getClinicById,
  getImages,
  getLesionById,
  getPatientById,
  getReports,
  getVisitById,
  getVisitsByPatientId,
} from "@/lib/mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase-client";
import { useListPagination } from "@/lib/use-list-pagination";
import { DEMO_USERS } from "@/lib/users";
import { ROLE_BY_ID } from "@/lib/roles";
import type { AuditLog } from "@/lib/domain";
import type { Tables } from "@/integrations/supabase/types";

type AccessEventsViewRow = Tables<"access_events_admin">;

type FilterKey = "all" | "clinical" | "admin" | "integrations" | "devices";
type SourceFilter = "all" | AccessEventSource;
type ExportScope = "all_pages" | "current_page" | "custom_range";
type ExportLogFilter = "all" | "csv" | "xlsx" | "success" | "cancelled" | "error" | "repeated";
type ExportStatusKind = "info" | "error";

const ACCESS_EVENTS_LIMIT = ACCESS_EVENTS_EXPORT_LIMIT;
const REFRESH_COOLDOWN_MS = 10_000;
const AUTO_REFRESH_INTERVAL_MS = 60_000;
const PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;
const FILTER_STATE_STORAGE_KEY = "derma-pro:sys-access-events:filters";
const EXPORT_SETTINGS_STORAGE_KEY = "derma-pro:sys-access-events:export-settings";
const EXPORT_LOG_FILTER_STORAGE_KEY = "derma-pro:sys-access-events:export-log-filter";

interface AccessEventRow {
  id: string;
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

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "clinical", label: "Клиника" },
  { key: "admin", label: "Администрирование" },
  { key: "integrations", label: "Интеграции" },
  { key: "devices", label: "Устройства" },
];

const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "Все источники" },
  { key: "api", label: "API" },
  { key: "demo", label: "Demo" },
];

const EXPORT_LOG_FILTERS: { key: ExportLogFilter; label: string }[] = [
  { key: "all", label: "Все экспорты" },
  { key: "csv", label: "CSV" },
  { key: "xlsx", label: "XLSX" },
  { key: "success", label: "Готовые" },
  { key: "cancelled", label: "Отменённые" },
  { key: "error", label: "С ошибкой" },
  { key: "repeated", label: "Повторные" },
];

interface AccessEventsFilterState {
  query: string;
  filter: FilterKey;
  sourceFilter: SourceFilter;
  entityFilter: string;
  clinicFilter: string;
  actorFilter: string;
  actionFilter: string;
  patientCodeFilter: string;
  dateFrom: string;
  dateTo: string;
  pageSize: number;
}

interface AccessEventsExportSettings {
  exportScope: ExportScope;
  customRangeFrom: string;
  customRangeTo: string;
  selectedExportColumns: AccessEventExportColumnKey[];
}

const DEFAULT_FILTER_STATE: AccessEventsFilterState = {
  query: "",
  filter: "all",
  sourceFilter: "all",
  entityFilter: "all",
  clinicFilter: "all",
  actorFilter: "all",
  actionFilter: "all",
  patientCodeFilter: "",
  dateFrom: "",
  dateTo: "",
  pageSize: 10,
};

const DEFAULT_EXPORT_SETTINGS: AccessEventsExportSettings = {
  exportScope: "all_pages",
  customRangeFrom: "1",
  customRangeTo: "",
  selectedExportColumns: [...DEFAULT_ACCESS_EVENT_EXPORT_COLUMNS],
};

function isFilterKey(value: unknown): value is FilterKey {
  return typeof value === "string" && FILTERS.some((f) => f.key === value);
}

function isSourceFilter(value: unknown): value is SourceFilter {
  return typeof value === "string" && SOURCE_FILTERS.some((f) => f.key === value);
}

function isExportScope(value: unknown): value is ExportScope {
  return value === "all_pages" || value === "current_page" || value === "custom_range";
}

function isExportColumnKey(value: unknown): value is AccessEventExportColumnKey {
  return typeof value === "string" && ACCESS_EVENT_EXPORT_COLUMNS.some((column) => column.key === value);
}

function isPageSize(value: unknown): value is (typeof PAGE_SIZE_OPTIONS)[number] {
  return typeof value === "number" && PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]);
}

function storedString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function storedExportColumns(value: unknown): AccessEventExportColumnKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_EXPORT_SETTINGS.selectedExportColumns];
  const columns = value.filter(isExportColumnKey);
  return columns.length > 0 ? columns : [...DEFAULT_EXPORT_SETTINGS.selectedExportColumns];
}

function readFilterState(): AccessEventsFilterState {
  if (typeof window === "undefined") return DEFAULT_FILTER_STATE;
  try {
    const raw = window.localStorage.getItem(FILTER_STATE_STORAGE_KEY);
    if (!raw) return DEFAULT_FILTER_STATE;
    const parsed = JSON.parse(raw) as Partial<AccessEventsFilterState>;
    return {
      query: storedString(parsed.query),
      filter: isFilterKey(parsed.filter) ? parsed.filter : "all",
      sourceFilter: isSourceFilter(parsed.sourceFilter) ? parsed.sourceFilter : "all",
      entityFilter: storedString(parsed.entityFilter, "all"),
      clinicFilter: storedString(parsed.clinicFilter, "all"),
      actorFilter: storedString(parsed.actorFilter, "all"),
      actionFilter: storedString(parsed.actionFilter, "all"),
      patientCodeFilter: storedString(parsed.patientCodeFilter),
      dateFrom: storedString(parsed.dateFrom),
      dateTo: storedString(parsed.dateTo),
      pageSize: isPageSize(parsed.pageSize) ? parsed.pageSize : DEFAULT_FILTER_STATE.pageSize,
    };
  } catch {
    return DEFAULT_FILTER_STATE;
  }
}

function writeFilterState(state: AccessEventsFilterState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FILTER_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures; filtering must keep working in private or restricted contexts.
  }
}

function readExportSettings(): AccessEventsExportSettings {
  if (typeof window === "undefined") return DEFAULT_EXPORT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(EXPORT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_EXPORT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AccessEventsExportSettings>;
    return {
      exportScope: isExportScope(parsed.exportScope) ? parsed.exportScope : DEFAULT_EXPORT_SETTINGS.exportScope,
      customRangeFrom: storedString(parsed.customRangeFrom, DEFAULT_EXPORT_SETTINGS.customRangeFrom),
      customRangeTo: storedString(parsed.customRangeTo, DEFAULT_EXPORT_SETTINGS.customRangeTo),
      selectedExportColumns: storedExportColumns(parsed.selectedExportColumns),
    };
  } catch {
    return DEFAULT_EXPORT_SETTINGS;
  }
}

function writeExportSettings(state: AccessEventsExportSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXPORT_SETTINGS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Export settings are a convenience only; the page must remain usable without storage.
  }
}

function isExportLogFilter(value: unknown): value is ExportLogFilter {
  return typeof value === "string" && EXPORT_LOG_FILTERS.some((f) => f.key === value);
}

function readExportLogFilter(): ExportLogFilter {
  if (typeof window === "undefined") return "all";
  try {
    const raw = window.localStorage.getItem(EXPORT_LOG_FILTER_STORAGE_KEY);
    return isExportLogFilter(raw) ? raw : "all";
  } catch {
    return "all";
  }
}

function writeExportLogFilter(value: ExportLogFilter): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXPORT_LOG_FILTER_STORAGE_KEY, value);
  } catch {
    // Filter persistence is best-effort; never block the UI.
  }
}

const ENTITY_BUCKET: Record<string, FilterKey> = {
  visit: "clinical",
  image: "clinical",
  assessment: "clinical",
  lesion: "clinical",
  report: "clinical",
  appointment: "admin",
  lead: "admin",
  bot_dialog: "admin",
  integration: "integrations",
  device: "devices",
};

function actorLabel(actorId: string | null): string {
  if (!actorId) return "Системное событие";
  const user = Object.values(DEMO_USERS).find((u) => u.id === actorId);
  if (!user) return actorId;
  return `${ROLE_BY_ID[user.role].short} · ${user.id}`;
}

function clinicFromLog(log: AuditLog): string {
  let clinicId = typeof log.payload.clinicId === "string" ? log.payload.clinicId : null;
  if (!clinicId && typeof log.payload.visitId === "string") {
    clinicId = getVisitById(log.payload.visitId)?.clinicId ?? null;
  }
  if (!clinicId && log.entity === "visit") {
    clinicId = getVisitById(log.entityId)?.clinicId ?? null;
  }
  if (!clinicId && log.entity === "lesion") {
    const patientId = getLesionById(log.entityId)?.patientId;
    clinicId = patientId ? getVisitsByPatientId(patientId)[0]?.clinicId ?? null : null;
  }
  if (!clinicId && typeof log.payload.lesionId === "string") {
    const patientId = getLesionById(log.payload.lesionId)?.patientId;
    clinicId = patientId ? getVisitsByPatientId(patientId)[0]?.clinicId ?? null : null;
  }
  if (!clinicId && log.entity === "image") {
    const image = getImages().find((i) => i.id === log.entityId);
    clinicId = image ? getVisitById(image.visitId)?.clinicId ?? null : null;
  }
  if (!clinicId && log.entity === "report") {
    const report = getReports().find((r) => r.id === log.entityId);
    clinicId = report ? getVisitById(report.visitId)?.clinicId ?? null : null;
  }
  return clinicId ? getClinicById(clinicId)?.name ?? clinicId : "—";
}

function patientCodeFromLog(log: AuditLog): string | null {
  if (typeof log.payload.visitId === "string") {
    const visit = getVisitById(log.payload.visitId);
    return visit ? getPatientById(visit.patientId)?.code ?? null : null;
  }
  if (log.entity === "visit") {
    const visit = getVisitById(log.entityId);
    return visit ? getPatientById(visit.patientId)?.code ?? null : null;
  }
  if (log.entity === "lesion") {
    const lesion = getLesionById(log.entityId);
    return lesion ? getPatientById(lesion.patientId)?.code ?? null : null;
  }
  if (typeof log.payload.lesionId === "string") {
    const lesion = getLesionById(log.payload.lesionId);
    return lesion ? getPatientById(lesion.patientId)?.code ?? null : null;
  }
  if (log.entity === "image") {
    const image = getImages().find((i) => i.id === log.entityId);
    const visit = image ? getVisitById(image.visitId) : null;
    return visit ? getPatientById(visit.patientId)?.code ?? null : null;
  }
  if (log.entity === "report") {
    const report = getReports().find((r) => r.id === log.entityId);
    const visit = report ? getVisitById(report.visitId) : null;
    return visit ? getPatientById(visit.patientId)?.code ?? null : null;
  }
  return null;
}

function visitIdFromLog(log: AuditLog): string | null {
  if (typeof log.payload.visitId === "string") return log.payload.visitId;
  return log.entity === "visit" ? log.entityId : null;
}

function lesionLabelFromLog(log: AuditLog): string | null {
  if (log.entity === "lesion") return getLesionById(log.entityId)?.label ?? log.entityId;
  if (typeof log.payload.lesionId === "string") {
    return getLesionById(log.payload.lesionId)?.label ?? log.payload.lesionId;
  }
  return null;
}

function fromDemoLog(log: AuditLog): AccessEventRow {
  return {
    id: log.id,
    createdAt: log.createdAt,
    clinicName: clinicFromLog(log),
    actorLabel: actorLabel(log.actorId),
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    patientCode: patientCodeFromLog(log),
    visitId: visitIdFromLog(log),
    lesionLabel: lesionLabelFromLog(log),
    source: "demo",
  };
}

function fromViewRow(row: AccessEventsViewRow): AccessEventRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    clinicName: row.clinic_name,
    actorLabel: row.actor_full_name ?? row.actor_id ?? "Системное событие",
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    patientCode: row.patient_code,
    visitId: row.visit_id,
    lesionLabel: row.lesion_label,
    source: "api",
  };
}

function buildDemoRows(): AccessEventRow[] {
  return getAuditLogs()
    .map(fromDemoLog)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function contextLabel(row: AccessEventRow): string {
  const parts = [];
  if (row.visitId) parts.push(`визит ${row.visitId}`);
  if (row.lesionLabel) parts.push(`очаг ${row.lesionLabel}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function rowDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function filterLabel(
  filter: FilterKey,
  sourceFilter: SourceFilter,
  entityFilter: string,
  clinicFilter: string,
  actorFilter: string,
  actionFilter: string,
  patientCodeFilter: string,
  dateFrom: string,
  dateTo: string,
): string {
  const parts = [
    FILTERS.find((f) => f.key === filter)?.label ?? "Все",
    SOURCE_FILTERS.find((f) => f.key === sourceFilter)?.label ?? "Все источники",
  ];
  if (entityFilter !== "all") parts.push(`сущность: ${entityFilter}`);
  if (clinicFilter !== "all") parts.push(`клиника: ${clinicFilter}`);
  if (actorFilter !== "all") parts.push(`актор: ${actorFilter}`);
  if (actionFilter !== "all") parts.push(`действие: ${actionFilter}`);
  if (patientCodeFilter.trim()) parts.push(`код пациента: ${patientCodeFilter.trim()}`);
  if (dateFrom) parts.push(`с ${dateFrom}`);
  if (dateTo) parts.push(`по ${dateTo}`);
  return parts.join(" · ");
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, text: string) {
  downloadBlob(filename, new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" }));
}

interface QueryLogEntry {
  id: string;
  at: string;
  action: string;
  result: string;
}

type ExportFormat = "CSV" | "XLSX";
type ExportLogStatus = "success" | "cancelled" | "error";

interface ExportProgressState {
  format: ExportFormat;
  percent: number;
  label: string;
  active: boolean;
}

interface ExportLogEntry {
  id: string;
  at: string;
  format: ExportFormat;
  status: ExportLogStatus;
  rowCount: number;
  filterLabel: string;
  scopeLabel: string;
  columnCount: number;
  query: string;
  filename: string;
  rows: AccessEventRow[];
  columns: AccessEventExportColumnKey[];
  repeated: boolean;
  message: string;
}

interface ExportLogDraft {
  format: ExportFormat;
  status: ExportLogStatus;
  rowCount: number;
  filterLabel: string;
  scopeLabel: string;
  columnCount: number;
  query: string;
  filename: string;
  rows: AccessEventRow[];
  columns: AccessEventExportColumnKey[];
  repeated?: boolean;
  message: string;
}

interface ExportRunContext extends ExportLogDraft {
  runId: string;
  cancelled: boolean;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function waitForUi(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

function parsePositiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function repeatFilename(filename: string): string {
  return filename.replace(/(\.csv|\.xlsx)$/i, "-repeat$1");
}

function exportStatusLabel(status: ExportLogStatus): string {
  if (status === "cancelled") return "Отменён";
  if (status === "error") return "Ошибка";
  return "Готов";
}

export default function SysAccessEventsPage() {
  const { role } = useRole();
  const configured = isSupabaseConfigured();
  const exportRunRef = useRef<ExportRunContext | null>(null);
  const [storedFilters] = useState(readFilterState);
  const [storedExportSettings] = useState(readExportSettings);
  const [rows, setRows] = useState<AccessEventRow[]>(() => buildDemoRows());
  const [source, setSource] = useState<AccessEventSource>("demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(storedFilters.query);
  const [filter, setFilter] = useState<FilterKey>(storedFilters.filter);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(storedFilters.sourceFilter);
  const [entityFilter, setEntityFilter] = useState(storedFilters.entityFilter);
  const [clinicFilter, setClinicFilter] = useState(storedFilters.clinicFilter);
  const [actorFilter, setActorFilter] = useState(storedFilters.actorFilter);
  const [actionFilter, setActionFilter] = useState(storedFilters.actionFilter);
  const [patientCodeFilter, setPatientCodeFilter] = useState(storedFilters.patientCodeFilter);
  const [dateFrom, setDateFrom] = useState(storedFilters.dateFrom);
  const [dateTo, setDateTo] = useState(storedFilters.dateTo);
  const [pageSize, setPageSize] = useState<number>(storedFilters.pageSize);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<AccessEventRow | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportStatusKind, setExportStatusKind] = useState<ExportStatusKind>("info");
  const [exportProgress, setExportProgress] = useState<ExportProgressState | null>(null);
  const [exportLog, setExportLog] = useState<ExportLogEntry[]>([]);
  const [exportLogFilter, setExportLogFilter] = useState<ExportLogFilter>(readExportLogFilter);
  const [exportScope, setExportScope] = useState<ExportScope>(storedExportSettings.exportScope);
  const [customRangeFrom, setCustomRangeFrom] = useState(storedExportSettings.customRangeFrom);
  const [customRangeTo, setCustomRangeTo] = useState(storedExportSettings.customRangeTo);
  const [selectedExportColumns, setSelectedExportColumns] = useState<AccessEventExportColumnKey[]>(
    storedExportSettings.selectedExportColumns,
  );
  const [queryLog, setQueryLog] = useState<QueryLogEntry[]>([]);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [reloadTick, setReloadTick] = useState(0);

  const announceExportStatus = useCallback((message: string, kind: ExportStatusKind = "info") => {
    setExportStatusKind(kind);
    setExportStatus(message);
  }, []);

  const appendQueryLog = useCallback((action: string, result: string) => {
    const at = new Date().toISOString();
    setQueryLog((current) =>
      [
        {
          id: `${at}-${Math.random().toString(36).slice(2)}`,
          at,
          action,
          result,
        },
        ...current,
      ].slice(0, 5),
    );
  }, []);

  const appendExportLog = useCallback(
    (entry: ExportLogDraft) => {
      const at = new Date().toISOString();
      setExportLog((current) =>
        [
          {
            id: `${at}-${entry.format}-${entry.status}-${Math.random().toString(36).slice(2)}`,
            at,
            format: entry.format,
            status: entry.status,
            rowCount: entry.rowCount,
            filterLabel: entry.filterLabel,
            scopeLabel: entry.scopeLabel,
            columnCount: entry.columnCount,
            query: entry.query.trim() ? "есть" : "—",
            filename: entry.filename,
            rows: entry.rows,
            columns: entry.columns,
            repeated: entry.repeated === true,
            message: entry.message,
          },
          ...current,
        ].slice(0, 5),
      );
    },
    [],
  );

  useEffect(() => {
    if (cooldownUntil <= now) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(cooldownUntil - now, 1000));
    return () => window.clearTimeout(timer);
  }, [cooldownUntil, now]);

  useEffect(() => {
    writeFilterState({
      query,
      filter,
      sourceFilter,
      entityFilter,
      clinicFilter,
      actorFilter,
      actionFilter,
      patientCodeFilter,
      dateFrom,
      dateTo,
      pageSize,
    });
  }, [
    query,
    filter,
    sourceFilter,
    entityFilter,
    clinicFilter,
    actorFilter,
    actionFilter,
    patientCodeFilter,
    dateFrom,
    dateTo,
    pageSize,
  ]);

  useEffect(() => {
    writeExportSettings({
      exportScope,
      customRangeFrom,
      customRangeTo,
      selectedExportColumns,
    });
  }, [customRangeFrom, customRangeTo, exportScope, selectedExportColumns]);

  useEffect(() => {
    writeExportLogFilter(exportLogFilter);
  }, [exportLogFilter]);

  useEffect(() => {
    if (!configured || role !== "system_admin") {
      setRows(buildDemoRows());
      setSource("demo");
      setError(null);
      setLoading(false);
      setLastRefreshAt(new Date().toISOString());
      appendQueryLog("Демо-журнал", "локальные события загружены");
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    client
      .rpc("list_access_events_admin", {
        _limit: ACCESS_EVENTS_LIMIT,
        _offset: 0,
      })
      .then(({ data, error: apiError }) => {
        if (cancelled) return;
        if (apiError) {
          setRows([]);
          setSource("api");
          setError("Не удалось загрузить события доступа. Проверьте роль system_admin и RLS.");
          setLastRefreshAt(new Date().toISOString());
          appendQueryLog("RPC list_access_events_admin", "ошибка загрузки");
          return;
        }
        const safeRows = ((data ?? []) as AccessEventsViewRow[]).map(fromViewRow);
        setRows(safeRows);
        setSource("api");
        setLastRefreshAt(new Date().toISOString());
        appendQueryLog(
          "RPC list_access_events_admin",
          `загружено ${safeRows.length} из лимита ${ACCESS_EVENTS_LIMIT}`,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setSource("api");
        setError("Сбой сети при загрузке событий доступа.");
        setLastRefreshAt(new Date().toISOString());
        appendQueryLog("RPC list_access_events_admin", "сбой сети");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appendQueryLog, configured, reloadTick, role]);

  const entityOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.entity))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const clinicOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.clinicName).filter((value) => value !== "—"))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const actorOptions = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.actorLabel).filter((value) => value !== "—"))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [rows],
  );

  const actionOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.action))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const currentFilterLabel = filterLabel(
    filter,
    sourceFilter,
    entityFilter,
    clinicFilter,
    actorFilter,
    actionFilter,
    patientCodeFilter,
    dateFrom,
    dateTo,
  );

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const patientCode = patientCodeFilter.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && ENTITY_BUCKET[row.entity] !== filter) return false;
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      if (entityFilter !== "all" && row.entity !== entityFilter) return false;
      if (clinicFilter !== "all" && row.clinicName !== clinicFilter) return false;
      if (actorFilter !== "all" && row.actorLabel !== actorFilter) return false;
      if (actionFilter !== "all" && row.action !== actionFilter) return false;
      if (patientCode && !(row.patientCode ?? "").toLowerCase().includes(patientCode)) return false;
      const date = rowDate(row.createdAt);
      if (dateFrom && date && date < dateFrom) return false;
      if (dateTo && date && date > dateTo) return false;
      if (q) {
        const hay = `${row.action} ${row.entity} ${row.entityId ?? ""} ${row.patientCode ?? ""} ${row.clinicName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    rows,
    filter,
    sourceFilter,
    entityFilter,
    clinicFilter,
    actorFilter,
    actionFilter,
    patientCodeFilter,
    dateFrom,
    dateTo,
    query,
  ]);

  const hasActiveFilters =
    query !== DEFAULT_FILTER_STATE.query ||
    filter !== DEFAULT_FILTER_STATE.filter ||
    sourceFilter !== DEFAULT_FILTER_STATE.sourceFilter ||
    entityFilter !== DEFAULT_FILTER_STATE.entityFilter ||
    clinicFilter !== DEFAULT_FILTER_STATE.clinicFilter ||
    actorFilter !== DEFAULT_FILTER_STATE.actorFilter ||
    actionFilter !== DEFAULT_FILTER_STATE.actionFilter ||
    patientCodeFilter !== DEFAULT_FILTER_STATE.patientCodeFilter ||
    dateFrom !== DEFAULT_FILTER_STATE.dateFrom ||
    dateTo !== DEFAULT_FILTER_STATE.dateTo ||
    pageSize !== DEFAULT_FILTER_STATE.pageSize;

  const pagination = useListPagination(filteredRows, {
    pageSize,
    deps: [
      filter,
      sourceFilter,
      entityFilter,
      clinicFilter,
      actorFilter,
      actionFilter,
      patientCodeFilter,
      dateFrom,
      dateTo,
      query,
      rows,
      pageSize,
    ],
  });

  const customRange = useMemo(() => {
    const fallbackTo = filteredRows.length || 1;
    const from = Math.min(parsePositiveInt(customRangeFrom, 1), fallbackTo);
    const to = Math.min(parsePositiveInt(customRangeTo, fallbackTo), fallbackTo);
    return {
      from: Math.min(from, to),
      to: Math.max(from, to),
    };
  }, [customRangeFrom, customRangeTo, filteredRows.length]);

  const exportScopeLabel =
    exportScope === "current_page"
      ? "текущая страница"
      : exportScope === "custom_range"
        ? `строки ${customRange.from}–${customRange.to}`
        : "все страницы";

  const exportScopeFilenamePart =
    exportScope === "current_page"
      ? "current-page"
      : exportScope === "custom_range"
        ? `range-${customRange.from}-${customRange.to}`
        : "all-pages";

  const scopedExportRows = useMemo(() => {
    if (exportScope === "current_page") return pagination.visible;
    if (exportScope === "custom_range") return filteredRows.slice(customRange.from - 1, customRange.to);
    return filteredRows;
  }, [customRange.from, customRange.to, exportScope, filteredRows, pagination.visible]);

  const exportRows = useMemo(
    () => limitAccessEventExportRows(scopedExportRows, ACCESS_EVENTS_EXPORT_LIMIT),
    [scopedExportRows],
  );

  const selectedExportColumnCount = selectedExportColumns.length;
  const exportDisabled = filteredRows.length === 0 || exportRows.length === 0 || selectedExportColumnCount === 0;

  const exportPreviewText =
    selectedExportColumnCount === 0
      ? "Выберите хотя бы одну колонку для экспорта."
      : filteredRows.length === 0
        ? "Нет событий для экспорта."
        : scopedExportRows.length > exportRows.length
          ? `Будет экспортировано ${exportRows.length} из ${scopedExportRows.length} событий. Лимит: ${ACCESS_EVENTS_EXPORT_LIMIT}.`
          : `Будет экспортировано ${exportRows.length} событий.`;

  const exportBusy = exportProgress?.active === true;
  const exportQueryMeta = query.trim() ? "поиск применён" : "";

  const cooldownSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const refreshDisabled = loading || cooldownSeconds > 0;

  const requestRefresh = useCallback((action = "Обновление событий") => {
    const current = Date.now();
    setNow(current);
    if (cooldownUntil > current) {
      appendQueryLog(action, "заблокировано rate limit");
      return false;
    }
    setCooldownUntil(current + REFRESH_COOLDOWN_MS);
    appendQueryLog(action, `запрошено, лимит ${ACCESS_EVENTS_LIMIT}`);
    setReloadTick((n) => n + 1);
    return true;
  }, [appendQueryLog, cooldownUntil]);

  const handleRefresh = useCallback(() => {
    requestRefresh();
  }, [requestRefresh]);

  const handleManualRefresh = useCallback(() => {
    const requested = requestRefresh("Ручное обновление событий");
    announceExportStatus(
      requested
        ? "Ручное обновление запрошено."
        : `Ручное обновление доступно через ${cooldownSeconds} секунд.`,
    );
  }, [announceExportStatus, cooldownSeconds, requestRefresh]);

  const handleResetFilters = useCallback(() => {
    setQuery(DEFAULT_FILTER_STATE.query);
    setFilter(DEFAULT_FILTER_STATE.filter);
    setSourceFilter(DEFAULT_FILTER_STATE.sourceFilter);
    setEntityFilter(DEFAULT_FILTER_STATE.entityFilter);
    setClinicFilter(DEFAULT_FILTER_STATE.clinicFilter);
    setActorFilter(DEFAULT_FILTER_STATE.actorFilter);
    setActionFilter(DEFAULT_FILTER_STATE.actionFilter);
    setPatientCodeFilter(DEFAULT_FILTER_STATE.patientCodeFilter);
    setDateFrom(DEFAULT_FILTER_STATE.dateFrom);
    setDateTo(DEFAULT_FILTER_STATE.dateTo);
    setPageSize(DEFAULT_FILTER_STATE.pageSize);
    announceExportStatus("Фильтры сброшены.");
    appendQueryLog("Фильтры событий", "сброшены");
  }, [announceExportStatus, appendQueryLog]);

  const handleDatePreset = useCallback(
    (preset: "today" | "last30" | "demoMarch" | "clear") => {
      const today = new Date();
      if (preset === "today") {
        const value = isoDate(today);
        setDateFrom(value);
        setDateTo(value);
        announceExportStatus("Пресет даты применён: сегодня.");
        appendQueryLog("Пресет даты", "сегодня");
        return;
      }
      if (preset === "last30") {
        setDateFrom(isoDate(addDays(today, -29)));
        setDateTo(isoDate(today));
        announceExportStatus("Пресет даты применён: последние 30 дней.");
        appendQueryLog("Пресет даты", "последние 30 дней");
        return;
      }
      if (preset === "demoMarch") {
        setDateFrom("2026-03-01");
        setDateTo("2026-03-31");
        announceExportStatus("Пресет даты применён: март 2026.");
        appendQueryLog("Пресет даты", "март 2026");
        return;
      }
      setDateFrom("");
      setDateTo("");
      announceExportStatus("Фильтр даты сброшен.");
      appendQueryLog("Пресет даты", "сброшен");
    },
    [announceExportStatus, appendQueryLog],
  );

  const handleToggleExportColumn = useCallback((column: AccessEventExportColumnKey) => {
    setSelectedExportColumns((current) =>
      current.includes(column) ? current.filter((key) => key !== column) : [...current, column],
    );
  }, []);

  const handleSelectCoreColumns = useCallback(() => {
    setSelectedExportColumns(["event_id", "created_at", "actor", "action", "entity", "patient_code"]);
    announceExportStatus("Выбраны основные колонки экспорта.");
  }, [announceExportStatus]);

  const handleSelectAllColumns = useCallback(() => {
    setSelectedExportColumns(DEFAULT_ACCESS_EVENT_EXPORT_COLUMNS);
    announceExportStatus("Выбраны все колонки экспорта.");
  }, [announceExportStatus]);

  useEffect(() => {
    if (!autoRefresh || role !== "system_admin") return;
    const timer = window.setInterval(() => {
      requestRefresh("Автообновление событий");
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRefresh, requestRefresh, role]);

  const runExport = useCallback(
    async ({
      format,
      rows: rowsToExport,
      columns,
      filterLabelValue,
      scopeLabelValue,
      filename,
      queryValue,
      repeated,
    }: {
      format: ExportFormat;
      rows: AccessEventRow[];
      columns: AccessEventExportColumnKey[];
      filterLabelValue: string;
      scopeLabelValue: string;
      filename: string;
      queryValue: string;
      repeated?: boolean;
    }) => {
      if (rowsToExport.length === 0 || columns.length === 0) return;
      const rowCount = rowsToExport.length;
      const columnCount = columns.length;
      const runId = `${Date.now()}-${format}-${Math.random().toString(36).slice(2)}`;
      const runContext: ExportRunContext = {
        runId,
        cancelled: false,
        format,
        status: "success",
        rowCount,
        filterLabel: filterLabelValue,
        scopeLabel: scopeLabelValue,
        columnCount,
        query: queryValue,
        filename,
        rows: rowsToExport,
        columns,
        repeated,
        message: repeated ? `Повторный ${format} экспорт готов.` : `${format} экспорт готов.`,
      };
      exportRunRef.current = runContext;
      const isCancelled = () => exportRunRef.current?.runId === runId && exportRunRef.current.cancelled;

      setExportProgress({
        format,
        percent: 20,
        label: repeated ? `Готовим повторный ${format} экспорт.` : `Готовим ${format} экспорт.`,
        active: true,
      });

      try {
        await waitForUi();
        if (isCancelled()) return;

        if (format === "CSV") {
          const csv = buildAccessEventsCsv(rowsToExport, {
            filterLabel: filterLabelValue,
            query: queryValue,
            scopeLabel: scopeLabelValue,
            columns,
          });
          setExportProgress({
            format,
            percent: 70,
            label: "Формируем CSV файл.",
            active: true,
          });
          await waitForUi();
          if (isCancelled()) return;
          downloadText(filename, csv);
        } else {
          const blob = buildAccessEventsXlsxBlob(rowsToExport, {
            filterLabel: filterLabelValue,
            query: queryValue,
            scopeLabel: scopeLabelValue,
            columns,
          });
          setExportProgress({
            format,
            percent: 70,
            label: "Формируем XLSX файл.",
            active: true,
          });
          await waitForUi();
          if (isCancelled()) return;
          downloadBlob(filename, blob);
        }
        setExportProgress({
          format,
          percent: 100,
          label: repeated ? `Повторный ${format} экспорт готов.` : `${format} экспорт готов.`,
          active: false,
        });
        const successMessage = `${repeated ? "Повторный " : ""}${format} экспорт готов: ${rowCount} строк. Диапазон: ${scopeLabelValue}. Колонки: ${columnCount}. Файл: ${filename}.`;
        announceExportStatus(successMessage);
        appendExportLog({
          ...runContext,
          status: "success",
          message: successMessage,
        });
        appendQueryLog(
          repeated ? `Повторный экспорт ${format}` : `Экспорт ${format}`,
          `экспортировано ${rowCount} строк; диапазон: ${scopeLabelValue}`,
        );
      } catch {
        setExportProgress({
          format,
          percent: 100,
          label: `${format} экспорт завершился ошибкой.`,
          active: false,
        });
        const errorMessage = `Не удалось выполнить ${format} экспорт. Файл не сформирован.`;
        announceExportStatus(errorMessage, "error");
        appendExportLog({
          ...runContext,
          status: "error",
          message: errorMessage,
        });
        appendQueryLog(
          repeated ? `Повторный экспорт ${format}` : `Экспорт ${format}`,
          `ошибка формирования файла; диапазон: ${scopeLabelValue}`,
        );
      } finally {
        if (exportRunRef.current?.runId === runId) {
          exportRunRef.current = null;
        }
      }
    },
    [announceExportStatus, appendExportLog, appendQueryLog],
  );

  const handleCancelExport = useCallback(() => {
    const current = exportRunRef.current;
    if (!current || current.cancelled) return;
    current.cancelled = true;
    setExportProgress({
      format: current.format,
      percent: 100,
      label: `${current.format} экспорт отменён.`,
      active: false,
    });
    const message = `${current.format} экспорт отменён. Файл не сформирован.`;
    announceExportStatus(message);
    appendExportLog({
      ...current,
      status: "cancelled",
      message,
    });
    appendQueryLog(
      current.repeated ? `Повторный экспорт ${current.format}` : `Экспорт ${current.format}`,
      `отменён пользователем; диапазон: ${current.scopeLabel}`,
    );
  }, [announceExportStatus, appendExportLog, appendQueryLog]);

  const handleExportCsv = useCallback(async () => {
    if (exportDisabled) return;
    await runExport({
      format: "CSV",
      rows: exportRows,
      columns: selectedExportColumns,
      filterLabelValue: currentFilterLabel,
      scopeLabelValue: exportScopeLabel,
      filename: accessEventsCsvFilename(filter, query, {
        scope: exportScopeFilenamePart,
        rowCount: exportRows.length,
        columnCount: selectedExportColumnCount,
      }),
      queryValue: exportQueryMeta,
    });
  }, [
    currentFilterLabel,
    exportDisabled,
    exportRows,
    exportQueryMeta,
    exportScopeFilenamePart,
    exportScopeLabel,
    filter,
    query,
    runExport,
    selectedExportColumnCount,
    selectedExportColumns,
  ]);

  const handleExportXlsx = useCallback(async () => {
    if (exportDisabled) return;
    await runExport({
      format: "XLSX",
      rows: exportRows,
      columns: selectedExportColumns,
      filterLabelValue: currentFilterLabel,
      scopeLabelValue: exportScopeLabel,
      filename: accessEventsXlsxFilename(filter, query, {
        scope: exportScopeFilenamePart,
        rowCount: exportRows.length,
        columnCount: selectedExportColumnCount,
      }),
      queryValue: exportQueryMeta,
    });
  }, [
    currentFilterLabel,
    exportDisabled,
    exportRows,
    exportQueryMeta,
    exportScopeFilenamePart,
    exportScopeLabel,
    filter,
    query,
    runExport,
    selectedExportColumnCount,
    selectedExportColumns,
  ]);

  const handleRepeatExport = useCallback(
    async (entry: ExportLogEntry) => {
      await runExport({
        format: entry.format,
        rows: entry.rows,
        columns: entry.columns,
        filterLabelValue: entry.filterLabel,
        scopeLabelValue: entry.scopeLabel,
        filename: repeatFilename(entry.filename),
        queryValue: entry.query === "есть" ? "поиск применён" : "",
        repeated: true,
      });
    },
    [runExport],
  );

  const filteredExportLog = useMemo(
    () =>
      exportLog.filter((entry) => {
        if (exportLogFilter === "all") return true;
        if (exportLogFilter === "csv") return entry.format === "CSV";
        if (exportLogFilter === "xlsx") return entry.format === "XLSX";
        if (exportLogFilter === "repeated") return entry.repeated;
        return entry.status === exportLogFilter;
      }),
    [exportLog, exportLogFilter],
  );

  const handleClearExportLog = useCallback(() => {
    if (exportLog.length === 0) return;
    setExportLog([]);
    announceExportStatus("Журнал экспортов очищен.");
    appendQueryLog("Журнал экспортов", "очищен");
  }, [announceExportStatus, appendQueryLog, exportLog.length]);

  const handleExportExportLog = useCallback(() => {
    if (filteredExportLog.length === 0) return;
    const header = [
      "at",
      "format",
      "status",
      "rows",
      "columns",
      "scope",
      "filter",
      "query",
      "repeated",
      "filename",
    ];
    const escape = (value: string): string => `"${value.replace(/"/g, '""')}"`;
    const lines = [header.map(escape).join(",")];
    for (const entry of filteredExportLog) {
      lines.push(
        [
          entry.at,
          entry.format,
          exportStatusLabel(entry.status),
          String(entry.rowCount),
          String(entry.columnCount),
          entry.scopeLabel,
          entry.filterLabel,
          entry.query,
          entry.repeated ? "да" : "нет",
          entry.filename,
        ]
          .map(escape)
          .join(","),
      );
    }
    const date = new Date().toISOString().slice(0, 10);
    const filename = `access-events-export-log-${date}-${exportLogFilter}-${filteredExportLog.length}-rows.csv`;
    downloadText(filename, lines.join("\n"));
    announceExportStatus(
      `Журнал экспортов выгружен: ${filteredExportLog.length} записей. Файл: ${filename}`,
    );
    appendQueryLog("Журнал экспортов", `выгружен ${filteredExportLog.length}`);
  }, [announceExportStatus, appendQueryLog, exportLogFilter, filteredExportLog]);

  if (role !== "system_admin") {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="События доступа" subtitle="Только для системного администратора." />
        <div className="p-4">
          <div
            role="alert"
            className="flex max-w-2xl items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
          >
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            <span>
              Этот раздел доступен только роли system_admin. Переключите демо-роль на
              системного администратора, чтобы открыть журнал.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const visible = pagination.visible;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="События доступа"
        subtitle="Admin view `access_events_admin`: действия, акторы и безопасный контекст."
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={handleRefresh}
            disabled={refreshDisabled}
            aria-busy={loading || undefined}
            aria-label={
              cooldownSeconds > 0
                ? `Обновление доступно через ${cooldownSeconds} секунд`
                : "Обновить события доступа"
            }
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {cooldownSeconds > 0 ? `Через ${cooldownSeconds} с` : "Обновить"}
          </Button>
        }
      />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {source === "api"
              ? `Данные читаются через RPC list_access_events_admin. Лимит: ${ACCESS_EVENTS_LIMIT} событий, обновление не чаще одного раза в 10 секунд.`
              : `Демо-режим. В production этот экран читает RPC list_access_events_admin через RLS. Лимит: ${ACCESS_EVENTS_LIMIT} событий.`}
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
          >
            {error}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Фильтр событий доступа" className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.key)}
                    className={`min-h-[44px] rounded-md border px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[32px] ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-foreground hover:bg-muted"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block w-full sm:w-72">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по действию, сущности, коду"
                  aria-label="Поиск событий доступа"
                  className="h-11 pl-7 text-[12px] sm:h-9"
                />
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] gap-1 text-[12px] sm:min-h-[32px]"
                  onClick={handleExportCsv}
                  disabled={exportDisabled || exportBusy}
                  aria-busy={exportProgress?.format === "CSV" && exportBusy ? true : undefined}
                  aria-label="Экспортировать события доступа в CSV"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  CSV
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-[44px] gap-1 text-[12px] sm:min-h-[32px]"
                  onClick={handleExportXlsx}
                  disabled={exportDisabled || exportBusy}
                  aria-busy={exportProgress?.format === "XLSX" && exportBusy ? true : undefined}
                  aria-label="Экспортировать события доступа в XLSX"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  XLSX
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Источник событий
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="h-11 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                aria-label="Источник событий"
              >
                {SOURCE_FILTERS.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Тип сущности
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                aria-label="Тип сущности"
              >
                <option value="all">Все сущности</option>
                {entityOptions.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Клиника
              <select
                value={clinicFilter}
                onChange={(e) => setClinicFilter(e.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                aria-label="Клиника события"
              >
                <option value="all">Все клиники</option>
                {clinicOptions.map((clinic) => (
                  <option key={clinic} value={clinic}>
                    {clinic}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Актор
              <select
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                aria-label="Актор события"
              >
                <option value="all">Все акторы</option>
                {actorOptions.map((actor) => (
                  <option key={actor} value={actor}>
                    {actor}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Действие
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                aria-label="Действие события"
              >
                <option value="all">Все действия</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Код пациента
              <Input
                value={patientCodeFilter}
                onChange={(e) => setPatientCodeFilter(e.target.value)}
                placeholder="DP-2026-0001"
                aria-label="Код пациента события"
                className="h-11 text-[12px] sm:h-9"
              />
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Дата с
              <Input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                aria-label="Дата события с"
                className="h-11 text-[12px] sm:h-9"
              />
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Дата по
              <Input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                aria-label="Дата события по"
                className="h-11 text-[12px] sm:h-9"
              />
            </label>
            <label className="grid gap-1 text-[11px] text-muted-foreground">
              Размер страницы
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-11 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                aria-label="Размер страницы событий"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} событий
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            role="group"
            aria-label="Пресеты даты событий доступа"
            className="mt-2 flex flex-wrap items-center gap-2 text-[12px]"
          >
            <span className="text-[11px] text-muted-foreground">Пресеты даты</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={() => handleDatePreset("today")}
              aria-label="Показать события за сегодня"
            >
              Сегодня
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={() => handleDatePreset("last30")}
              aria-label="Показать события за последние 30 дней"
            >
              30 дней
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-[12px]"
              onClick={() => handleDatePreset("demoMarch")}
              aria-label="Показать события за март 2026"
            >
              Март 2026
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-[12px]"
              onClick={() => handleDatePreset("clear")}
              aria-label="Сбросить фильтр даты событий"
              disabled={!dateFrom && !dateTo}
            >
              Сбросить даты
            </Button>
          </div>
          <div className="mt-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-[11px] text-muted-foreground">
              Активный срез: {currentFilterLabel}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <label className="flex min-h-[36px] items-center gap-2 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => {
                    setAutoRefresh(e.target.checked);
                    announceExportStatus(
                      e.target.checked
                        ? "Автообновление включено: каждые 60 секунд."
                        : "Автообновление выключено.",
                    );
                  }}
                  aria-label="Автообновление событий доступа"
                  className="h-4 w-4 rounded border-input"
                />
                Автообновление
              </label>
              <span className="text-[11px] text-muted-foreground">
                Последнее: {lastRefreshAt ? formatDateTime(lastRefreshAt) : "—"}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-[12px]"
                onClick={handleManualRefresh}
                disabled={refreshDisabled}
                aria-busy={loading || undefined}
                aria-label={
                  cooldownSeconds > 0
                    ? `Ручное обновление доступно через ${cooldownSeconds} секунд`
                    : "Обновить события доступа вручную"
                }
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
                Вручную
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-[12px]"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                aria-label="Сбросить фильтры событий доступа"
              >
                Сбросить фильтры
              </Button>
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[13px] font-semibold">Параметры экспорта</h2>
            <span className="text-[11px] text-muted-foreground">
              Диапазон: {exportScopeLabel}; колонок: {selectedExportColumnCount}
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,320px)_1fr]">
            <div className="space-y-2">
              <label className="grid gap-1 text-[11px] text-muted-foreground">
                Что экспортировать
                <select
                  value={exportScope}
                  onChange={(e) => setExportScope(e.target.value as ExportScope)}
                  className="h-11 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                  aria-label="Диапазон экспорта событий"
                >
                  <option value="all_pages">Все страницы</option>
                  <option value="current_page">Текущая страница</option>
                  <option value="custom_range">Пользовательский диапазон</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  Строка с
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(filteredRows.length, 1)}
                    value={customRangeFrom}
                    onChange={(e) => setCustomRangeFrom(e.target.value)}
                    disabled={exportScope !== "custom_range"}
                    aria-label="Начало пользовательского диапазона экспорта"
                    className="h-11 text-[12px] sm:h-9"
                  />
                </label>
                <label className="grid gap-1 text-[11px] text-muted-foreground">
                  Строка по
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(filteredRows.length, 1)}
                    value={customRangeTo}
                    onChange={(e) => setCustomRangeTo(e.target.value)}
                    disabled={exportScope !== "custom_range"}
                    placeholder={String(Math.max(filteredRows.length, 1))}
                    aria-label="Конец пользовательского диапазона экспорта"
                    className="h-11 text-[12px] sm:h-9"
                  />
                </label>
              </div>
            </div>
            <div
              role="group"
              aria-label="Колонки экспорта событий"
              className="space-y-2 rounded-md border border-border bg-background p-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">Колонки</span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={handleSelectCoreColumns}
                    aria-label="Выбрать основные колонки экспорта"
                  >
                    Основные
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={handleSelectAllColumns}
                    aria-label="Выбрать все колонки экспорта"
                  >
                    Все
                  </Button>
                </div>
              </div>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {ACCESS_EVENT_EXPORT_COLUMNS.map((column) => (
                  <label
                    key={column.key}
                    className="flex min-h-[32px] items-center gap-2 rounded-md px-1 text-[12px] text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={selectedExportColumns.includes(column.key)}
                      onChange={() => handleToggleExportColumn(column.key)}
                      aria-label={`Колонка экспорта: ${column.label}`}
                      className="h-4 w-4 rounded border-input"
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div
          role="region"
          aria-label="Предпросмотр экспорта событий доступа"
          className="grid gap-1 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground sm:grid-cols-[160px_1fr]"
        >
          <div className="font-medium text-foreground">Предпросмотр экспорта</div>
          <div>
            {exportPreviewText} Форматы: CSV и XLSX. Диапазон: {exportScopeLabel}. Колонки:{" "}
            {selectedExportColumnCount}. Срез: {currentFilterLabel}.
          </div>
        </div>

        {exportProgress ? (
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Статус прогресса экспорта событий доступа"
            className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
          >
            <div className="flex items-center justify-between gap-3">
              <span>{exportProgress.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px]">{exportProgress.percent}%</span>
                {exportProgress.active ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    onClick={handleCancelExport}
                    aria-label={`Отменить ${exportProgress.format} экспорт событий доступа`}
                  >
                    Отменить
                  </Button>
                ) : null}
              </div>
            </div>
            <div
              role="progressbar"
              aria-label={`Прогресс экспорта ${exportProgress.format}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={exportProgress.percent}
              className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${exportProgress.percent}%` }}
              />
            </div>
          </div>
        ) : null}

        {exportStatus ? (
          <div
            role={exportStatusKind === "error" ? "alert" : "status"}
            aria-live={exportStatusKind === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            aria-label="Статус экспорта событий доступа"
            className={`rounded-md border px-3 py-2 text-[12px] ${
              exportStatusKind === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-surface text-muted-foreground"
            }`}
          >
            {exportStatus}
          </div>
        ) : null}

        <div className="text-[12px] text-muted-foreground" aria-live="polite">
          Найдено: {filteredRows.length}
        </div>

        <Card
          role="region"
          aria-label="Журнал запросов событий доступа"
          className="space-y-2 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[13px] font-semibold">Журнал запросов</h2>
            <span className="text-[11px] text-muted-foreground">последние 5 событий</span>
          </div>
          <ul className="space-y-1 text-[12px] text-muted-foreground">
            {queryLog.length > 0 ? (
              queryLog.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {entry.action}: {entry.result}
                  </span>
                  <time className="font-mono text-[11px]" dateTime={entry.at}>
                    {formatDateTime(entry.at)}
                  </time>
                </li>
              ))
            ) : (
              <li role="status" aria-live="polite">Запросов пока нет.</li>
            )}
          </ul>
        </Card>

        <Card
          role="region"
          aria-label="Журнал экспортов событий доступа"
          className="space-y-2 p-3"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[13px] font-semibold">Журнал экспортов</h2>
              <span className="text-[11px] text-muted-foreground">
                показано {filteredExportLog.length} из {exportLog.length}; последние 5 файлов
              </span>
            </div>
            <label className="grid gap-1 text-[11px] text-muted-foreground sm:w-48">
              Фильтр журнала
              <select
                value={exportLogFilter}
                onChange={(e) => setExportLogFilter(e.target.value as ExportLogFilter)}
                className="h-9 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Фильтр журнала экспортов"
              >
                {EXPORT_LOG_FILTERS.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="space-y-1 text-[12px] text-muted-foreground">
            {filteredExportLog.length > 0 ? (
              filteredExportLog.map((entry) => (
                <li key={entry.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-0.5">
                    <div>
                      {entry.format}: {entry.rowCount} строк. Результат: {exportStatusLabel(entry.status)}.
                      Диапазон: {entry.scopeLabel}. Колонки: {entry.columnCount}. Срез:{" "}
                      {entry.filterLabel}. Поиск: {entry.query}.
                    </div>
                    <div className="truncate font-mono text-[11px]">Файл: {entry.filename}</div>
                    <div className="text-[11px]">{entry.message}</div>
                    <time className="block font-mono text-[11px]" dateTime={entry.at}>
                      {formatDateTime(entry.at)}
                    </time>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 shrink-0 text-[12px]"
                    onClick={() => handleRepeatExport(entry)}
                    disabled={exportBusy}
                    aria-label={`Повторить экспорт ${entry.format} ${entry.filename}`}
                  >
                    Повторить
                  </Button>
                </li>
              ))
            ) : (
              <li>{exportLog.length > 0 ? "По выбранному фильтру экспортов нет." : "Экспортов пока нет."}</li>
            )}
          </ul>
        </Card>

        <Card className="hidden p-0 md:block">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Когда</th>
                <th className="px-3 py-2">Клиника</th>
                <th className="px-3 py-2">Актор</th>
                <th className="px-3 py-2">Действие</th>
                <th className="px-3 py-2">Сущность</th>
                <th className="px-3 py-2">Пациент</th>
                <th className="px-3 py-2">Контекст</th>
                <th className="px-3 py-2 text-right">Детали</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                  <td className="px-3 py-2">{row.clinicName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.actorLabel}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{row.action}</td>
                  <td className="px-3 py-2">
                    <span>{row.entity}</span>
                    <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                      {row.entityId ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {row.patientCode ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {contextLabel(row)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-[12px]"
                      onClick={() => setSelectedRow(row)}
                      aria-label={`Подробнее о событии ${row.id}`}
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Подробнее
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid grid-cols-1 gap-2 md:hidden">
          {visible.map((row) => (
            <Card key={row.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] font-semibold">{row.action}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatDateTime(row.createdAt)} · {row.actorLabel}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {row.source === "api" ? "API" : "demo"}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <dt className="text-muted-foreground">Клиника</dt>
                <dd className="text-right">{row.clinicName}</dd>
                <dt className="text-muted-foreground">Сущность</dt>
                <dd className="text-right">{row.entity}</dd>
                <dt className="text-muted-foreground">Пациент</dt>
                <dd className="text-right font-mono text-[11px]">{row.patientCode ?? "—"}</dd>
                <dt className="text-muted-foreground">Контекст</dt>
                <dd className="text-right">{contextLabel(row)}</dd>
              </dl>
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-[44px] w-full gap-1 text-[12px]"
                onClick={() => setSelectedRow(row)}
                aria-label={`Подробнее о событии ${row.id}`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Подробнее
              </Button>
            </Card>
          ))}
        </div>

        <ListPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          rangeLabel={pagination.rangeLabel}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPageChange={pagination.setPage}
          itemNoun="событий"
        />
      </div>

      <Drawer open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DrawerContent role="dialog" aria-modal="true" aria-describedby={undefined}>
          <DrawerHeader>
            <DrawerTitle>Детали события</DrawerTitle>
            <DrawerDescription id="access-event-details-description">
              Безопасный контекст из admin access-events view. Email, ФИО пациента, токены и storage-пути не выводятся.
            </DrawerDescription>
          </DrawerHeader>
          {selectedRow ? (
            <div className="max-h-[65vh] overflow-auto px-4 pb-2">
              <dl className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-2 text-[13px]">
                <dt className="text-muted-foreground">Event ID</dt>
                <dd className="font-mono text-[12px]">{selectedRow.id}</dd>
                <dt className="text-muted-foreground">Когда</dt>
                <dd>{formatDateTime(selectedRow.createdAt)}</dd>
                <dt className="text-muted-foreground">Клиника</dt>
                <dd>{selectedRow.clinicName}</dd>
                <dt className="text-muted-foreground">Актор</dt>
                <dd>{selectedRow.actorLabel}</dd>
                <dt className="text-muted-foreground">Действие</dt>
                <dd className="font-mono text-[12px]">{selectedRow.action}</dd>
                <dt className="text-muted-foreground">Сущность</dt>
                <dd>
                  {selectedRow.entity}
                  <span className="ml-1 font-mono text-[12px] text-muted-foreground">
                    {selectedRow.entityId ?? "—"}
                  </span>
                </dd>
                <dt className="text-muted-foreground">Пациент</dt>
                <dd className="font-mono text-[12px]">{selectedRow.patientCode ?? "—"}</dd>
                <dt className="text-muted-foreground">Контекст</dt>
                <dd>{contextLabel(selectedRow)}</dd>
                <dt className="text-muted-foreground">Источник</dt>
                <dd>{selectedRow.source === "api" ? "API" : "Demo"}</dd>
              </dl>
            </div>
          ) : null}
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" variant="outline">
                Закрыть
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

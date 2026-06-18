import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  ExternalLink,
  FileUp,
  FileCode2,
  GitCompare,
  History,
  ListChecks,
  Lock,
  MonitorCheck,
  PackageCheck,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { blobFromParts } from "@/lib/blob-utils";
import { formatDateTime } from "@/lib/format";
import {
  buildReleaseImportAuditReport,
  buildReleaseImportAuditCsv,
  buildReleaseHistoryPresetAuditReport,
  buildFilteredReleaseHistoryCsv,
  buildFilteredReleaseHistoryJsonl,
  buildFilteredReleaseHistoryXlsxBytes,
  buildReleaseReadinessSummary,
  buildReleaseHistoryPresetExportJson,
  buildReleaseHistoryPresetsXlsxBytes,
  buildReleaseHistoryFilterPreset,
  buildReleaseStatusExportBundle,
  buildReleaseStatusExportFile,
  buildReleaseStatusWriteGateSummary,
  buildReleaseBaselineOptions,
  compareReleaseStatusSnapshots,
  filterReleaseHistoryRecordsAdvanced,
  filterReleaseImportAuditEntries,
  paginateReleaseHistoryRecords,
  planReleaseHistoryPresetImport,
  DEFAULT_RELEASE_HISTORY_FILTER_PRESETS,
  RELEASE_HISTORY_FILTER_PRESET_LIMIT,
  RELEASE_STATUS_ALLOWED_ROLES,
  RELEASE_STATUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_DEMO_HISTORY_JSONL,
  RELEASE_STATUS_PREFLIGHT_COMMAND,
  RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_PRIVACY_CATEGORIES,
  parseReleaseHistoryJsonl,
  parseReleaseHistoryPresetExportJson,
  releaseHistoryAuditFilename,
  releaseStatusFormatLabel,
  releaseStatusLevel,
  releaseStatusLevelLabel,
  releaseHistoryFilteredCsvFilename,
  releaseHistoryFilteredJsonlFilename,
  releaseHistoryFilteredXlsxFilename,
  releaseHistoryPresetsJsonFilename,
  releaseHistoryPresetsXlsxFilename,
  releaseHistoryPresetAuditFilename,
  summarizeReleaseHistoryPreview,
  summarizeReleaseHistoryIssues,
  summarizeReleaseHistoryPresetImport,
  summarizeReleasePrivacy,
  normalizeReleaseHistoryFilterPreset,
  type ReleaseHistoryFilterPreset,
  type ReleaseHistoryRecord,
  type ReleaseHistoryArtifactFilter,
  type ReleaseHistoryDenoFilter,
  type ReleaseHistoryParseResult,
  type ReleaseHistoryPresetAuditEntry,
  type ReleaseHistoryStatusFilter,
  type ReleaseHistoryWorkflowFilter,
  type ReleaseImportAuditPrivacyFilter,
  type ReleaseStatusFormat,
  releaseHistoryAuditCsvFilename,
} from "@/lib/release-status-ui";

const FORMATS: ReleaseStatusFormat[] = ["markdown", "json", "html", "history"];
const HISTORY_PREVIEW_PAGE_SIZE = 3;
const RELEASE_STATUS_SYNC_COMMAND = "npm run check:release-status-sync";
const RELEASE_STATUS_SYNC_BLOCK = [
  "npm run ci:release-status-sync",
  "npm run check:release-status-sync",
  "node scripts/check-stage3-docs.mjs",
  "node scripts/check-no-deno-locks.mjs",
  "git status --short",
].join("\n");
const RELEASE_STATUS_CI_GATE_STATUS =
  "Проверка записи включена. Отчёты не записываются, пока предварительные проверки и сверка синхронизации не пройдут.";
const HISTORY_FILTER_PRESETS_STORAGE_KEY =
  "derma-pro:sys-release-status:history-filter-presets";
const AUDIT_STATUS_OPTIONS = [
  "all",
  "safe",
  "partial",
  "blocked",
  "empty",
  "dry_run",
  "deleted",
  "downloaded",
];

interface ExportLogEntry {
  at: string;
  format: ReleaseStatusFormat | "bundle";
  filename: string;
  fileCount?: number;
}

interface ImportAuditEntry {
  at: string;
  status:
    | ReleaseHistoryParseResult["status"]
    | "dry_run"
    | "deleted"
    | "downloaded";
  acceptedCount: number;
  skippedCount: number;
  privacyFindingCount: number;
  message: string;
}

type ReleaseStatusOperation =
  | "format_export"
  | "bundle_export"
  | "history_dry_run"
  | "history_import"
  | "history_delete"
  | "history_filtered_jsonl"
  | "history_filtered_csv"
  | "history_filtered_xlsx"
  | "preset_json"
  | "preset_xlsx"
  | "preset_import"
  | "preset_audit"
  | "audit_json"
  | "audit_csv"
  | null;

type ReleaseWriteGateScenario = "pass" | "fail";

function readSavedHistoryFilterPresets(): ReleaseHistoryFilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_FILTER_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeReleaseHistoryFilterPreset(item))
      .filter((item): item is ReleaseHistoryFilterPreset => item != null)
      .filter((item) => item.source === "saved")
      .slice(0, RELEASE_HISTORY_FILTER_PRESET_LIMIT);
  } catch {
    return [];
  }
}

function writeSavedHistoryFilterPresets(
  presets: ReleaseHistoryFilterPreset[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      HISTORY_FILTER_PRESETS_STORAGE_KEY,
      JSON.stringify(presets.filter((preset) => preset.source === "saved")),
    );
  } catch {
    // Presets are a convenience only; never block the release-status page.
  }
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadText(
  filename: string,
  content: string,
  type = "text/plain;charset=utf-8",
): void {
  downloadBlob(filename, blobFromParts([content], type));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function importAuditStatusLabel(status: ImportAuditEntry["status"]): string {
  if (status === "safe") return "Импорт обработан";
  if (status === "blocked") return "Импорт заблокирован";
  if (status === "empty") return "Пустой импорт";
  if (status === "partial") return "Импорт частичный";
  if (status === "dry_run") return "Проверка импорта";
  if (status === "deleted") return "Импорт удалён";
  if (status === "downloaded") return "Отчёт аудита скачан";
  return "Импорт обработан";
}

function releaseStatusOperationLabel(
  operation: ReleaseStatusOperation,
): string {
  if (operation === "format_export") return "Готовим экспорт текущего формата.";
  if (operation === "bundle_export") return "Готовим единый пакет.";
  if (operation === "history_dry_run")
    return "Проверяем журнал истории.";
  if (operation === "history_import") return "Импортируем журнал истории.";
  if (operation === "history_delete")
    return "Удаляем импортированные эталоны.";
  if (operation === "history_filtered_jsonl")
    return "Готовим экспорт журнала.";
  if (operation === "history_filtered_csv")
    return "Готовим табличный экспорт журнала.";
  if (operation === "history_filtered_xlsx")
    return "Готовим книгу журнала.";
  if (operation === "preset_json") return "Готовим файл наборов фильтров.";
  if (operation === "preset_xlsx") return "Готовим книгу наборов фильтров.";
  if (operation === "preset_import") return "Импортируем наборы фильтров.";
  if (operation === "preset_audit") return "Готовим аудит наборов фильтров.";
  if (operation === "audit_json") return "Готовим служебный отчёт аудита.";
  if (operation === "audit_csv") return "Готовим табличный отчёт аудита.";
  return "Операции не выполняются.";
}

function workflowDisplayName(name: string): string {
  const labels: Record<string, string> = {
    "release-status": "Готовность публикации",
    "preflight-all": "Предварительная проверка",
    "no-deno-locks": "Лишние служебные файлы",
    "e2e-smoke": "Быстрая проверка интерфейса",
    "unit-tests": "Модульные тесты",
    "typecheck": "Проверка типов",
    "lint": "Проверка кода",
    "build": "Сборка",
  };
  return labels[name] ?? "Проверка";
}

function workflowConclusionLabel(conclusion: string): string {
  if (conclusion === "success") return "пройдено";
  if (conclusion === "failure") return "ошибка";
  if (conclusion === "in_progress") return "выполняется";
  return "нет данных";
}

function privacyCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    "bearer token": "Ключ авторизации",
    "cookie header": "Служебный заголовок",
    "url token parameter": "Ключ в ссылке",
    "email address": "Эл. почта",
    "patient full-name field": "Полное имя пациента",
    "actor email field": "Эл. почта сотрудника",
    "storage object path": "Путь к хранилищу",
    "supabase key": "Ключ Supabase",
    "service role env": "Служебная переменная",
    "jwt-shaped value": "Похоже на JWT",
  };
  return labels[category] ?? category;
}

export default function SysReleaseStatusPage() {
  const snapshot = RELEASE_STATUS_DEMO_SNAPSHOT;
  const previousSnapshot = RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT;
  const historyInputRef = useRef<HTMLTextAreaElement | null>(null);
  const historyPresetImportRef = useRef<HTMLTextAreaElement | null>(null);
  const [format, setFormat] = useState<ReleaseStatusFormat>("markdown");
  const [status, setStatus] = useState(
    "Предпросмотр готов. Секреты не отображаются.",
  );
  const [exportLog, setExportLog] = useState<ExportLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [historyInput, setHistoryInput] = useState("");
  const [importedRecords, setImportedRecords] = useState<
    ReleaseHistoryRecord[]
  >([]);
  const [historyParseNote, setHistoryParseNote] = useState(
    "Журнал истории ещё не импортирован.",
  );
  const [importPrivacyNote, setImportPrivacyNote] = useState(
    "Проверка данных импорта ожидает запуска.",
  );
  const [importAuditLog, setImportAuditLog] = useState<ImportAuditEntry[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState("demo-previous");
  const [historyStatusFilter, setHistoryStatusFilter] =
    useState<ReleaseHistoryStatusFilter>("all");
  const [historyDenoFilter, setHistoryDenoFilter] =
    useState<ReleaseHistoryDenoFilter>("all");
  const [historyArtifactFilter, setHistoryArtifactFilter] =
    useState<ReleaseHistoryArtifactFilter>("all");
  const [historyWorkflowFilter, setHistoryWorkflowFilter] =
    useState<ReleaseHistoryWorkflowFilter>("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [savedHistoryPresets, setSavedHistoryPresets] = useState(
    readSavedHistoryFilterPresets,
  );
  const [selectedHistoryPresetId, setSelectedHistoryPresetId] =
    useState("builtin-all");
  const [historyPresetName, setHistoryPresetName] = useState("");
  const [historyPresetImportInput, setHistoryPresetImportInput] = useState("");
  const [historyPresetImportNote, setHistoryPresetImportNote] = useState(
    "Импорт наборов фильтров ожидает данные из экспортированного файла.",
  );
  const [lastClearedHistoryPresets, setLastClearedHistoryPresets] = useState<
    ReleaseHistoryFilterPreset[] | null
  >(null);
  const [presetAuditLog, setPresetAuditLog] = useState<
    ReleaseHistoryPresetAuditEntry[]
  >([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [auditStatusFilter, setAuditStatusFilter] = useState("all");
  const [auditPrivacyFilter, setAuditPrivacyFilter] =
    useState<ReleaseImportAuditPrivacyFilter>("all");
  const [auditQuery, setAuditQuery] = useState("");
  const [writeGateScenario, setWriteGateScenario] =
    useState<ReleaseWriteGateScenario>("pass");
  const [operation, setOperation] = useState<ReleaseStatusOperation>(null);

  const level = releaseStatusLevel(snapshot);
  const writeGateSnapshot = useMemo(
    () =>
      writeGateScenario === "pass"
        ? snapshot
        : {
            ...snapshot,
            denoLockOk: false,
            workflows: snapshot.workflows.map((workflow) =>
              workflow.name === "release-status"
                ? { ...workflow, conclusion: "failure" as const }
                : workflow,
            ),
          },
    [snapshot, writeGateScenario],
  );
  const writeGateSummary = useMemo(
    () =>
      buildReleaseStatusWriteGateSummary(writeGateSnapshot, {
        workflowSuccessCondition: writeGateScenario === "pass",
        ciSyncGateOk: writeGateScenario === "pass",
      }),
    [writeGateScenario, writeGateSnapshot],
  );
  const readinessSummary = useMemo(
    () => buildReleaseReadinessSummary(writeGateSnapshot, writeGateSummary),
    [writeGateSnapshot, writeGateSummary],
  );
  const currentExport = useMemo(
    () => buildReleaseStatusExportFile(snapshot, format),
    [format, snapshot],
  );
  const privacySummary = currentExport.privacy;
  const privacyFindings = privacySummary.findings;
  const safePreviewOutput = useMemo(
    () =>
      [
        `Готовность публикации: ${releaseStatusLevelLabel(level)}.`,
        `Проверки пройдены: ${readinessSummary.passedCount} из ${readinessSummary.totalCount}.`,
        `Рабочее дерево: ${snapshot.workingTree === "clean" ? "чисто" : "требует внимания"}.`,
        `Отчёт: ${snapshot.artifactPresent ? "найден" : "не найден"}.`,
        `Дата снимка: ${formatDateTime(snapshot.generatedAt)}.`,
        `Граница данных: секретные ключи, места хранения, закрытые ссылки, почта и имена пациентов не выводятся.`,
      ].join("\n"),
    [level, readinessSummary.passedCount, readinessSummary.totalCount, snapshot.artifactPresent, snapshot.generatedAt, snapshot.workingTree],
  );
  const historyDraft = useMemo(
    () => parseReleaseHistoryJsonl(historyInput),
    [historyInput],
  );
  const historyPreview = useMemo(
    () => summarizeReleaseHistoryPreview(historyDraft),
    [historyDraft],
  );
  const historyIssueSummary = useMemo(
    () => summarizeReleaseHistoryIssues(historyDraft),
    [historyDraft],
  );
  const activeHistoryFilters = useMemo(
    () => ({
      status: historyStatusFilter,
      deno: historyDenoFilter,
      artifact: historyArtifactFilter,
      workflow: historyWorkflowFilter,
      query: historyQuery,
    }),
    [
      historyArtifactFilter,
      historyDenoFilter,
      historyQuery,
      historyStatusFilter,
      historyWorkflowFilter,
    ],
  );
  const allHistoryPresets = useMemo(
    () => [...DEFAULT_RELEASE_HISTORY_FILTER_PRESETS, ...savedHistoryPresets],
    [savedHistoryPresets],
  );
  const selectedHistoryPreset = useMemo(
    () =>
      allHistoryPresets.find((preset) => preset.id === selectedHistoryPresetId),
    [allHistoryPresets, selectedHistoryPresetId],
  );
  const historyIssueHints = useMemo(() => {
    const hints: string[] = [];
    if (historyIssueSummary.invalidJsonCount > 0) {
      hints.push("Проверьте структуру данных в отмеченных строках.");
    }
    if (historyIssueSummary.invalidSchemaCount > 0) {
      hints.push(
        "Оставьте только строки журнала публикации с репозиторием, веткой, кодом версии, статусом и проверками.",
      );
    }
    if (historyIssueSummary.privacyBlockedCount > 0) {
      hints.push(
        "Удалите почту, секретные ключи, закрытые ссылки, места хранения и реальные данные перед импортом.",
      );
    }
    return hints;
  }, [historyIssueSummary]);
  const firstHistoryIssue = historyDraft.issues[0] ?? null;
  const presetImportResult = useMemo(
    () =>
      historyPresetImportInput.trim()
        ? parseReleaseHistoryPresetExportJson(historyPresetImportInput)
        : null,
    [historyPresetImportInput],
  );
  const presetImportPreview = useMemo(
    () =>
      presetImportResult
        ? summarizeReleaseHistoryPresetImport(presetImportResult)
        : null,
    [presetImportResult],
  );
  const presetImportPlan = useMemo(
    () =>
      presetImportResult
        ? planReleaseHistoryPresetImport(
            presetImportResult,
            savedHistoryPresets,
          )
        : null,
    [presetImportResult, savedHistoryPresets],
  );
  const presetImportHints = useMemo(() => {
    if (!presetImportResult || !historyPresetImportInput.trim()) return [];
    const hints: string[] = [];
    if (presetImportResult.status === "blocked") {
      hints.push(
        "Удалите адреса почты, секретные ключи, закрытые ссылки и другие приватные значения.",
      );
    }
    if (
      presetImportResult.status === "empty" &&
      presetImportResult.skippedCount > 0
    ) {
      hints.push(
        "Проверьте данные: ожидается объект или массив с наборами фильтров.",
      );
    }
    if (
      presetImportResult.status === "empty" &&
      presetImportResult.skippedCount === 0
    ) {
      hints.push("Добавьте хотя бы один безопасный saved-набор фильтров.");
    }
    if (presetImportResult.status === "partial") {
      hints.push("Часть наборов фильтров пропущена из-за формата, дублей или лимита.");
    }
    return hints;
  }, [historyPresetImportInput, presetImportResult]);
  const presetImportHasError = Boolean(
    historyPresetImportInput.trim() &&
      presetImportResult &&
      (presetImportResult.status === "blocked" ||
        presetImportResult.status === "empty"),
  );
  const filteredHistoryRecords = useMemo(
    () =>
      filterReleaseHistoryRecordsAdvanced(
        historyDraft.records,
        activeHistoryFilters,
      ),
    [activeHistoryFilters, historyDraft.records],
  );
  const historyPageData = useMemo(
    () =>
      paginateReleaseHistoryRecords(
        filteredHistoryRecords,
        historyPage,
        HISTORY_PREVIEW_PAGE_SIZE,
      ),
    [filteredHistoryRecords, historyPage],
  );
  const historyWorkflowOptions = useMemo(
    () =>
      Array.from(
        new Set(
          historyDraft.records.flatMap((record) =>
            record.workflows.map((workflow) => workflow.conclusion),
          ),
        ),
      ).sort(),
    [historyDraft.records],
  );
  const filteredImportAuditLog = useMemo(
    () =>
      filterReleaseImportAuditEntries(importAuditLog, {
        status: auditStatusFilter,
        privacy: auditPrivacyFilter,
        query: auditQuery,
      }),
    [auditPrivacyFilter, auditQuery, auditStatusFilter, importAuditLog],
  );
  const baselineOptions = useMemo(
    () =>
      buildReleaseBaselineOptions(snapshot, previousSnapshot, importedRecords),
    [importedRecords, previousSnapshot, snapshot],
  );
  const selectedBaseline =
    baselineOptions.find((item) => item.id === selectedBaselineId) ??
    baselineOptions[0]!;
  const comparison = useMemo(
    () => compareReleaseStatusSnapshots(selectedBaseline.snapshot, snapshot),
    [selectedBaseline.snapshot, snapshot],
  );
  const successCount = snapshot.workflows.filter(
    (workflow) => workflow.conclusion === "success",
  ).length;
  const isBusy = operation != null;
  const historyBusy =
    operation === "history_dry_run" ||
    operation === "history_import" ||
    operation === "history_delete" ||
    operation === "history_filtered_jsonl" ||
    operation === "history_filtered_csv" ||
    operation === "history_filtered_xlsx";
  const presetBusy =
    operation === "preset_json" ||
    operation === "preset_xlsx" ||
    operation === "preset_import" ||
    operation === "preset_audit";
  const auditBusy = operation === "audit_json" || operation === "audit_csv";

  useEffect(() => {
    writeSavedHistoryFilterPresets(savedHistoryPresets);
  }, [savedHistoryPresets]);

  const runOperation = async (
    nextOperation: Exclude<ReleaseStatusOperation, null>,
    task: () => void,
  ) => {
    if (operation != null) return;
    setOperation(nextOperation);
    setStatus(releaseStatusOperationLabel(nextOperation));
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      task();
    } finally {
      setOperation(null);
    }
  };

  const resetHistoryFilters = () => {
    setHistoryStatusFilter("all");
    setHistoryDenoFilter("all");
    setHistoryArtifactFilter("all");
    setHistoryWorkflowFilter("all");
    setHistoryQuery("");
    setHistoryPage(1);
    setSelectedHistoryPresetId("builtin-all");
  };

  const resetAuditFilters = () => {
    setAuditStatusFilter("all");
    setAuditPrivacyFilter("all");
    setAuditQuery("");
  };

  const markHistoryFiltersCustom = () => {
    setSelectedHistoryPresetId("custom");
  };

  const recordPresetAudit = (
    action: string,
    presetCount: number,
    message: string,
  ) => {
    setPresetAuditLog((items) => [
      {
        at: new Date().toISOString(),
        action,
        presetCount,
        message,
      },
      ...items.slice(0, 9),
    ]);
  };

  const applyHistoryPreset = (preset: ReleaseHistoryFilterPreset) => {
    setHistoryStatusFilter(preset.filters.status);
    setHistoryDenoFilter(preset.filters.deno);
    setHistoryArtifactFilter(preset.filters.artifact);
    setHistoryWorkflowFilter(preset.filters.workflow);
    setHistoryQuery(preset.filters.query);
    setHistoryPage(1);
    setSelectedHistoryPresetId(preset.id);
    setStatus(`Набор фильтров применён: ${preset.name}.`);
  };

  const handleHistoryPresetChange = (presetId: string) => {
    if (presetId === "custom") {
      setSelectedHistoryPresetId("custom");
      return;
    }
    const preset = allHistoryPresets.find((item) => item.id === presetId);
    if (preset) applyHistoryPreset(preset);
  };

  const handleSaveHistoryPreset = () => {
    const preset = buildReleaseHistoryFilterPreset(
      historyPresetName,
      activeHistoryFilters,
    );
    if (!preset) {
      setStatus(
        "Набор фильтров не сохранён: задайте безопасное название без секретов и приватных данных.",
      );
      return;
    }
    setSavedHistoryPresets((items) => [
      preset,
      ...items
        .filter(
          (item) =>
            item.id !== preset.id &&
            item.name.toLowerCase() !== preset.name.toLowerCase(),
        )
        .slice(0, RELEASE_HISTORY_FILTER_PRESET_LIMIT - 1),
    ]);
    setSelectedHistoryPresetId(preset.id);
    setHistoryPresetName("");
    setLastClearedHistoryPresets(null);
    recordPresetAudit("save", 1, `Набор фильтров сохранён: ${preset.name}.`);
    setStatus(`Набор фильтров сохранён: ${preset.name}.`);
  };

  const handleDeleteHistoryPreset = () => {
    const preset = savedHistoryPresets.find(
      (item) => item.id === selectedHistoryPresetId,
    );
    if (!preset) return;
    setSavedHistoryPresets((items) =>
      items.filter((item) => item.id !== preset.id),
    );
    setSelectedHistoryPresetId("custom");
    setLastClearedHistoryPresets(null);
    recordPresetAudit("delete", 1, `Набор фильтров удалён: ${preset.name}.`);
    setStatus(`Сохранённый набор фильтров удалён: ${preset.name}.`);
  };

  const handleRenameHistoryPreset = () => {
    const preset = savedHistoryPresets.find(
      (item) => item.id === selectedHistoryPresetId,
    );
    if (!preset) return;
    const renamed = buildReleaseHistoryFilterPreset(
      historyPresetName,
      preset.filters,
      preset.createdAt ?? new Date().toISOString(),
    );
    if (!renamed) {
      setStatus(
        "Набор фильтров не переименован: задайте безопасное название без секретов и приватных данных.",
      );
      return;
    }
    const nextPreset = { ...renamed, id: preset.id };
    setSavedHistoryPresets((items) =>
      items.map((item) => (item.id === preset.id ? nextPreset : item)),
    );
    setHistoryPresetName("");
    recordPresetAudit("rename", 1, `Набор фильтров переименован: ${nextPreset.name}.`);
    setStatus(`Набор фильтров переименован: ${nextPreset.name}.`);
  };

  const handleDuplicateHistoryPreset = () => {
    const sourcePreset = selectedHistoryPreset;
    if (!sourcePreset) return;
    const duplicateName = historyPresetName || `${sourcePreset.name} копия`;
    const duplicate = buildReleaseHistoryFilterPreset(
      duplicateName,
      sourcePreset.filters,
    );
    if (!duplicate) {
      setStatus(
        "Копия набора фильтров не создана: задайте безопасное название без секретов и приватных данных.",
      );
      return;
    }
    setSavedHistoryPresets((items) => [
      duplicate,
      ...items
        .filter(
          (item) => item.name.toLowerCase() !== duplicate.name.toLowerCase(),
        )
        .slice(0, RELEASE_HISTORY_FILTER_PRESET_LIMIT - 1),
    ]);
    setSelectedHistoryPresetId(duplicate.id);
    setHistoryPresetName("");
    setLastClearedHistoryPresets(null);
    recordPresetAudit("duplicate", 1, `Копия набора фильтров создана: ${duplicate.name}.`);
    setStatus(`Копия набора фильтров создана: ${duplicate.name}.`);
  };

  const handleExportHistoryPresets = (targetFormat: "json" | "xlsx") => {
    if (savedHistoryPresets.length === 0) return;
    void runOperation(targetFormat === "xlsx" ? "preset_xlsx" : "preset_json", () => {
      const json = buildReleaseHistoryPresetExportJson(savedHistoryPresets);
      const privacy = summarizeReleasePrivacy(json);
      if (privacy.findingCount > 0) {
        setStatus(
          "Экспорт наборов фильтров заблокирован: проверка данных нашла чувствительные значения.",
        );
        return;
      }
      const filename =
        targetFormat === "xlsx"
          ? releaseHistoryPresetsXlsxFilename()
          : releaseHistoryPresetsJsonFilename();
      if (targetFormat === "xlsx") {
        const bytes = buildReleaseHistoryPresetsXlsxBytes(savedHistoryPresets);
        downloadBlob(
          filename,
          blobFromParts(
            [bytes],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          ),
        );
      } else {
        downloadText(filename, json, "application/json;charset=utf-8");
      }
      setStatus(
        `${targetFormat.toUpperCase()} экспорт наборов фильтров готов: ${filename}.`,
      );
      recordPresetAudit(
        `export_${targetFormat}`,
        savedHistoryPresets.length,
        `${targetFormat.toUpperCase()} экспорт наборов фильтров: ${filename}.`,
      );
    });
  };

  const handleImportHistoryPresets = () => {
    void runOperation("preset_import", () => {
      const result = parseReleaseHistoryPresetExportJson(
        historyPresetImportInput,
      );
      setHistoryPresetImportNote(result.message);
      if (result.status === "blocked" || result.acceptedCount === 0) {
        setStatus(result.message);
        return;
      }
      setSavedHistoryPresets((items) => {
        const merged = [
          ...result.presets,
          ...items.filter(
            (item) =>
              !result.presets.some(
                (preset) =>
                  preset.name.toLowerCase() === item.name.toLowerCase(),
              ),
          ),
        ].slice(0, RELEASE_HISTORY_FILTER_PRESET_LIMIT);
        return merged;
      });
      setSelectedHistoryPresetId(result.presets[0]?.id ?? "custom");
      setHistoryPresetImportInput("");
      setLastClearedHistoryPresets(null);
      recordPresetAudit("import", result.acceptedCount, result.message);
      setStatus(result.message);
    });
  };

  const handleClearHistoryPresets = () => {
    if (savedHistoryPresets.length === 0) return;
    const previous = savedHistoryPresets;
    setLastClearedHistoryPresets(previous);
    setSavedHistoryPresets([]);
    setSelectedHistoryPresetId("custom");
    recordPresetAudit(
      "clear",
      previous.length,
      `Очищено сохранённых наборов фильтров: ${previous.length}.`,
    );
    setStatus(`Сохранённые наборы фильтров очищены: ${previous.length}.`);
  };

  const handleUndoClearHistoryPresets = () => {
    if (!lastClearedHistoryPresets || lastClearedHistoryPresets.length === 0)
      return;
    const restored = lastClearedHistoryPresets.slice(
      0,
      RELEASE_HISTORY_FILTER_PRESET_LIMIT,
    );
    setSavedHistoryPresets(restored);
    setSelectedHistoryPresetId(restored[0]?.id ?? "custom");
    setLastClearedHistoryPresets(null);
    recordPresetAudit(
      "undo_clear",
      restored.length,
      `Восстановлено сохранённых наборов фильтров: ${restored.length}.`,
    );
    setStatus(`Сохранённые наборы фильтров восстановлены: ${restored.length}.`);
  };

  const handleDownloadPresetAudit = () => {
    if (presetAuditLog.length === 0) return;
    void runOperation("preset_audit", () => {
      const content = buildReleaseHistoryPresetAuditReport(presetAuditLog);
      const privacy = summarizeReleasePrivacy(content);
      if (privacy.findingCount > 0) {
        setStatus(
          "Аудит наборов фильтров заблокирован: проверка данных нашла чувствительные значения.",
        );
        return;
      }
      const filename = releaseHistoryPresetAuditFilename();
      downloadText(filename, content, "application/json;charset=utf-8");
      setStatus(`Аудит наборов фильтров скачан: ${filename}.`);
    });
  };

  const handleFocusFirstHistoryError = () => {
    const input = historyInputRef.current;
    if (!input) return;
    input.focus();
    if (firstHistoryIssue) {
      const lines = historyInput.split(/\r?\n/);
      const start =
        firstHistoryIssue.line <= 1
          ? 0
          : lines.slice(0, firstHistoryIssue.line - 1).join("\n").length + 1;
      const end = start + (lines[firstHistoryIssue.line - 1]?.length ?? 0);
      input.setSelectionRange(start, end);
    setStatus(`Выделена строка ${firstHistoryIssue.line} с ошибкой журнала.`);
      return;
    }
    setStatus(historyIssueSummary.message);
  };

  const handleFocusPresetImportError = () => {
    const input = historyPresetImportRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(0, input.value.length);
    setStatus("Выделены наборы фильтров журнала для исправления.");
  };

  const handleExport = (targetFormat: ReleaseStatusFormat) => {
    void runOperation("format_export", () => {
      const file = buildReleaseStatusExportFile(snapshot, targetFormat);
      if (file.privacy.findingCount > 0) {
        setStatus(
          `Экспорт заблокирован: найдено ${file.privacy.findingCount} чувствительных совпадений.`,
        );
        return;
      }
      downloadText(file.filename, file.content, file.mime);
      setExportLog((items) => [
        {
          at: new Date().toISOString(),
          format: targetFormat,
          filename: file.filename,
        },
        ...items.slice(0, 4),
      ]);
      const readyLabel =
        targetFormat === "html"
          ? "Веб-страница готова"
          : `${releaseStatusFormatLabel(targetFormat)} готов`;
      setStatus(`${readyLabel}: ${file.filename}`);
    });
  };

  const handleExportBundle = () => {
    void runOperation("bundle_export", () => {
      const files = buildReleaseStatusExportBundle(snapshot);
      const unsafe = files.filter((file) => file.privacy.findingCount > 0);
      if (unsafe.length > 0) {
        setStatus(
          `Пакетный экспорт заблокирован: небезопасных файлов ${unsafe.length}.`,
        );
        return;
      }
      for (const file of files)
        downloadText(file.filename, file.content, file.mime);
      setExportLog((items) => [
        {
          at: new Date().toISOString(),
          format: "bundle",
          filename: "release-status-bundle",
          fileCount: files.length,
        },
        ...items.slice(0, 4),
      ]);
      setStatus(`Пакетный экспорт готов: ${files.length} файла.`);
    });
  };

  const handlePrivacyCheck = () => {
    if (privacyFindings.length === 0) {
      setStatus(
        `Проверка приватности пройдена для ${releaseStatusFormatLabel(format)}.`,
      );
    } else {
      setStatus(
        `Проверка приватности нашла ${privacyFindings.length} совпадений.`,
      );
    }
  };

  const recordImportAudit = (entry: ImportAuditEntry) => {
    setImportAuditLog((items) => [entry, ...items.slice(0, 7)]);
  };

  const makeImportAuditEntry = (
    result: ReleaseHistoryParseResult,
    statusOverride?: ImportAuditEntry["status"],
    messageOverride?: string,
  ): ImportAuditEntry => ({
    at: new Date().toISOString(),
    status: statusOverride ?? result.status,
    acceptedCount: result.acceptedCount,
    skippedCount: result.skippedCount,
    privacyFindingCount: result.privacy.findingCount,
    message: messageOverride ?? result.message,
  });

  const handleDryRunHistory = () => {
    void runOperation("history_dry_run", () => {
      const result = historyDraft;
      recordImportAudit(
        makeImportAuditEntry(
          result,
          result.privacy.findingCount > 0 ? "blocked" : "dry_run",
          result.privacy.findingCount > 0
            ? result.message
            : `Проверка импорта: ${result.acceptedCount} безопасных записей; эталон не изменён.`,
        ),
      );

      setHistoryParseNote(
        result.privacy.findingCount > 0
          ? result.message
          : `Проверка импорта выполнена: ${result.acceptedCount} безопасных записей, эталон не изменён.`,
      );
      setImportPrivacyNote(
        result.privacy.findingCount > 0
          ? `Проверка данных импорта: блокер. Категории: ${result.privacy.labels.join(", ")}.`
          : "Проверка данных импорта пройдена: чувствительные совпадения не найдены.",
      );
      setStatus(
        result.privacy.findingCount > 0
          ? "Проверка импорта заблокирована: найдены чувствительные значения."
          : "Проверка импорта выполнена без изменения эталона.",
      );
    });
  };

  const handleImportHistory = () => {
    void runOperation("history_import", () => {
      const result = historyDraft;
      recordImportAudit(makeImportAuditEntry(result));

      if (result.privacy.findingCount > 0) {
        setImportedRecords([]);
        setSelectedBaselineId("demo-previous");
        setHistoryParseNote(result.message);
        setImportPrivacyNote(
          `Проверка данных импорта: блокер. Категории: ${result.privacy.labels.join(", ")}.`,
        );
        setStatus(
          "Журнал истории не импортирован: найдены чувствительные значения.",
        );
        return;
      }
      setImportedRecords(result.records);
      const nextOptions = buildReleaseBaselineOptions(
        snapshot,
        previousSnapshot,
        result.records,
      );
      setSelectedBaselineId(nextOptions[0]?.id ?? "demo-previous");
      setHistoryParseNote(result.message);
      setImportPrivacyNote(
        result.acceptedCount === 0
          ? "Проверка данных импорта пройдена, но валидных эталонных записей нет."
          : "Проверка данных импорта пройдена: чувствительные совпадения не найдены.",
      );
      setStatus(
        `Журнал истории обработан: ${result.acceptedCount} безопасных записей.`,
      );
    });
  };

  const handleDeleteImportedHistory = () => {
    if (importedRecords.length === 0) return;
    void runOperation("history_delete", () => {
      const removedCount = importedRecords.length;
      setImportedRecords([]);
      setSelectedBaselineId("demo-previous");
      const entry: ImportAuditEntry = {
        at: new Date().toISOString(),
        status: "deleted",
        acceptedCount: 0,
        skippedCount: 0,
        privacyFindingCount: 0,
        message: `Импорт удалён: очищено эталонных записей ${removedCount}.`,
      };
      recordImportAudit(entry);
      setHistoryParseNote(
        `Импорт удалён: очищено эталонных записей ${removedCount}.`,
      );
      setImportPrivacyNote("Проверка данных импорта ожидает запуска.");
      setStatus("Импортированные эталоны удалены; выбран учебный эталон.");
    });
  };

  const buildAuditContext = () => ({
    selectedBaselineSha: selectedBaseline.snapshot.shortSha,
    selectedBaselineSource: selectedBaseline.source,
    filteredHistoryCount: filteredHistoryRecords.length,
    visibleAuditCount: filteredImportAuditLog.length,
    historyStatusFilter,
    historyDenoFilter,
    historyArtifactFilter,
    historyWorkflowFilter,
    historyQuery,
    auditStatusFilter,
    auditPrivacyFilter,
    auditQuery,
  });

  const handleDownloadImportAudit = (targetFormat: "json" | "csv") => {
    if (filteredImportAuditLog.length === 0) return;
    void runOperation(
      targetFormat === "csv" ? "audit_csv" : "audit_json",
      () => {
        const content =
          targetFormat === "csv"
            ? buildReleaseImportAuditCsv(
                filteredImportAuditLog,
                buildAuditContext(),
              )
            : buildReleaseImportAuditReport(
                filteredImportAuditLog,
                buildAuditContext(),
              );
        const reportPrivacy = summarizeReleasePrivacy(content);
        if (reportPrivacy.findingCount > 0) {
          setStatus(
            "Отчёт аудита импортов заблокирован: проверка данных нашла чувствительные значения.",
          );
          return;
        }
        const filename =
          targetFormat === "csv"
            ? releaseHistoryAuditCsvFilename()
            : releaseHistoryAuditFilename();
        downloadText(
          filename,
          content,
          targetFormat === "csv"
            ? "text/csv;charset=utf-8"
            : "application/json;charset=utf-8",
        );
        recordImportAudit({
          at: new Date().toISOString(),
          status: "downloaded",
          acceptedCount: filteredImportAuditLog.length,
          skippedCount: 0,
          privacyFindingCount: 0,
          message: `Отчёт аудита импортов скачан: ${filename}.`,
        });
        setStatus(
          `Отчёт аудита импортов скачан: ${filename}.`,
        );
      },
    );
  };

  const handleExportFilteredHistory = (
    targetFormat: "jsonl" | "csv" | "xlsx",
  ) => {
    if (filteredHistoryRecords.length === 0) return;
    void runOperation(
      targetFormat === "xlsx"
        ? "history_filtered_xlsx"
        : targetFormat === "csv"
          ? "history_filtered_csv"
          : "history_filtered_jsonl",
      () => {
        const context = {
          totalCount: historyDraft.records.length,
          filteredCount: filteredHistoryRecords.length,
          filters: activeHistoryFilters,
        };
        const textContent =
          targetFormat === "csv"
            ? buildFilteredReleaseHistoryCsv(filteredHistoryRecords, context)
            : targetFormat === "jsonl"
              ? buildFilteredReleaseHistoryJsonl(filteredHistoryRecords)
              : buildFilteredReleaseHistoryCsv(filteredHistoryRecords, context);
        const exportPrivacy = summarizeReleasePrivacy(textContent);
        if (exportPrivacy.findingCount > 0) {
          setStatus(
            "Экспорт отфильтрованного журнала заблокирован: проверка данных нашла чувствительные значения.",
          );
          return;
        }
        const filename =
          targetFormat === "xlsx"
            ? releaseHistoryFilteredXlsxFilename()
            : targetFormat === "csv"
              ? releaseHistoryFilteredCsvFilename()
              : releaseHistoryFilteredJsonlFilename();
        if (targetFormat === "xlsx") {
          const bytes = buildFilteredReleaseHistoryXlsxBytes(
            filteredHistoryRecords,
            context,
          );
          downloadBlob(
            filename,
            blobFromParts(
              [bytes],
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ),
          );
        } else {
          downloadText(
            filename,
            textContent,
            targetFormat === "csv"
              ? "text/csv;charset=utf-8"
              : "application/x-ndjson;charset=utf-8",
          );
        }
        recordImportAudit({
          at: new Date().toISOString(),
          status: "downloaded",
          acceptedCount: filteredHistoryRecords.length,
          skippedCount: Math.max(
            0,
            historyDraft.records.length - filteredHistoryRecords.length,
          ),
          privacyFindingCount: 0,
          message:
            targetFormat === "xlsx"
              ? `Книга журнала скачана: ${filename}.`
              : targetFormat === "csv"
                ? `Табличный экспорт журнала скачан: ${filename}.`
                : `Экспорт журнала скачан: ${filename}.`,
        });
        setStatus(
          targetFormat === "xlsx"
            ? `Книга журнала готова: ${filename}.`
            : targetFormat === "csv"
              ? `Табличный экспорт журнала готов: ${filename}.`
              : `Экспорт журнала готов: ${filename}.`,
        );
      },
    );
  };

  const handleResetHistoryInput = () => {
    setHistoryInput(RELEASE_STATUS_DEMO_HISTORY_JSONL);
    setImportedRecords([]);
    setSelectedBaselineId("demo-previous");
    setHistoryStatusFilter("all");
    setHistoryDenoFilter("all");
    setHistoryArtifactFilter("all");
    setHistoryWorkflowFilter("all");
    setHistoryQuery("");
    setHistoryPage(1);
    setSelectedHistoryPresetId("builtin-all");
    resetAuditFilters();
    setHistoryParseNote("Журнал истории сброшен к учебному эталону.");
    setImportPrivacyNote("Проверка данных импорта ожидает запуска.");
    setStatus("Журнал истории сброшен к безопасному учебному примеру.");
  };

  const handlePreparePreflight = async () => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(RELEASE_STATUS_PREFLIGHT_COMMAND);
      setStatus(
        "Команда предварительной проверки скопирована. Запустите её в локальном терминале.",
      );
    } catch {
      setStatus("Команду предварительной проверки не удалось скопировать.");
    }
  };

  const handlePrepareSyncCheck = async () => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(RELEASE_STATUS_SYNC_COMMAND);
      setStatus(
        "Команда сверки синхронизации скопирована. Запустите её перед проверкой изменений.",
      );
    } catch {
      setStatus("Команду сверки синхронизации не удалось скопировать.");
    }
  };

  const handlePrepareSyncBlock = async () => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(RELEASE_STATUS_SYNC_BLOCK);
      setStatus(
        "Полный блок сверки скопирован. Запустите его до проверки изменений и после синхронизации Lovable.",
      );
    } catch {
      setStatus("Полный блок сверки не удалось скопировать.");
    }
  };

  const handleCopyReportLink = async () => {
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(readinessSummary.reportUrl);
      setStatus("Ссылка на отчёт готовности публикации скопирована.");
    } catch {
      setStatus(`Ссылка на отчёт готовности публикации: ${readinessSummary.reportUrl}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Готовность публикации"
        subtitle="Проверки перед публикацией, отчёт и безопасный экспорт."
        actions={
          <Button
            size="sm"
            className="min-h-11 text-[12px]"
            onClick={() => handleExport(format)}
            disabled={isBusy}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            {operation === "format_export"
              ? "Готовим экспорт"
              : "Экспорт текущего формата"}
          </Button>
        }
      />

      <div className="space-y-4 p-3 sm:p-4">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
        aria-label="Статус готовности публикации"
          aria-busy={isBusy}
          className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
        >
          {isBusy ? releaseStatusOperationLabel(operation) : status}
        </div>

        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Учебный режим. Рабочие роли, аудит, ключи и мост устройств включаются после подключения системы клиники.
        </div>

        <section
          aria-label="Готовность публикации"
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]"
        >
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <PackageCheck
                    className="h-4 w-4 text-primary"
                    aria-hidden
                  />
                  <h2 className="text-[16px] font-semibold tracking-tight">
                    Готовность публикации
                  </h2>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Единый снимок готовности публикации: проверки, отчёт и разрешение записи.
                </p>
              </div>
              <Badge
                variant={
                  readinessSummary.status === "ready"
                    ? "secondary"
                    : readinessSummary.status === "blocked"
                      ? "destructive"
                      : "outline"
                }
                className="w-fit"
              >
                {readinessSummary.label}
              </Badge>
            </div>

            <div
              className={
                readinessSummary.status === "blocked"
                  ? "mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
                  : "mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-700"
              }
              role={readinessSummary.status === "blocked" ? "alert" : "status"}
              aria-label="Уведомление о готовности публикации"
            >
              {readinessSummary.notification}
            </div>

            <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Готовность</dt>
                <dd className="mt-1 text-[18px] font-semibold">
                  {readinessSummary.score}%
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Проверки</dt>
                <dd className="mt-1">
                  {readinessSummary.passedCount} из{" "}
                  {readinessSummary.totalCount}
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Отчёт</dt>
                <dd className="mt-1 truncate font-mono text-[11px]">
                  {snapshot.artifactPresent ? "отчёт найден" : "отчёт не найден"}
                </dd>
              </div>
            </dl>

            <ul
              className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2"
              aria-label="Проверки готовности публикации"
            >
              {readinessSummary.checks.map((check) => (
                <li
                  key={check.id}
                  className="rounded-md border border-border bg-muted/30 p-3"
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    {check.ok ? (
                      <CheckCircle2
                        className="h-3.5 w-3.5 text-success"
                        aria-hidden
                      />
                    ) : (
                      <Bell
                        className="h-3.5 w-3.5 text-destructive"
                        aria-hidden
                      />
                    )}
                    {check.label}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {check.detail}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-2">
              <MonitorCheck
                className="mt-0.5 h-4 w-4 text-primary"
                aria-hidden
              />
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">
                  Статус проверок
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Публикуемая ссылка ведёт на страницу проверки с отчётом публикации.
                </p>
              </div>
            </div>

            <div
              className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-[12px]"
              role="status"
              aria-label="Сводка проверок"
            >
              Проверки: {successCount} из {snapshot.workflows.length} пройдены.
              Отчёт: {readinessSummary.reportLabel}.
            </div>

            <ul
              className="mt-3 max-h-[260px] divide-y divide-border overflow-auto rounded-md border border-border"
              aria-label="Проверки публикации"
            >
              {snapshot.workflows.map((workflow) => (
                <li
                  key={workflow.name}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
                >
                  <span className="min-w-0 truncate font-mono">
                    {workflowDisplayName(workflow.name)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    {workflowConclusionLabel(workflow.conclusion)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 text-[12px]"
                asChild
              >
                <a
                  href={readinessSummary.reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Открыть опубликованный отчёт готовности публикации"
                >
                  <ExternalLink
                    className="mr-1.5 h-3.5 w-3.5"
                    aria-hidden
                  />
                  Открыть отчёт
                </a>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-[12px]"
                onClick={handleCopyReportLink}
              >
                <ClipboardCheck
                  className="mr-1.5 h-3.5 w-3.5"
                  aria-hidden
                />
                Скопировать ссылку
              </Button>
            </div>

            {readinessSummary.status === "blocked" && (
              <div
                className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
                role="alert"
                aria-label="Уведомление о блокере публикации"
              >
                {readinessSummary.notification}
              </div>
            )}
          </Card>
        </section>

        <section
          aria-label="Предпросмотр готовности публикации"
          className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]"
        >
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MonitorCheck className="h-4 w-4 text-primary" aria-hidden />
                  <h2 className="text-[16px] font-semibold tracking-tight">
                    Операционный снимок
                  </h2>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Данные синхронизированы с последней успешной проверкой основной ветки.
                </p>
              </div>
              <Badge
                variant={
                  level === "ok"
                    ? "secondary"
                    : level === "fail"
                      ? "destructive"
                      : "outline"
                }
                className="w-fit"
              >
                {releaseStatusLevelLabel(level)}
              </Badge>
            </div>

            <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Проект</dt>
                <dd className="mt-1 font-mono text-[12px]">код скрыт</dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Код версии</dt>
                <dd className="mt-1 font-mono text-[12px]">
                  {snapshot.branch === "main" ? "основная ветка" : snapshot.branch} · код скрыт
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Рабочее дерево</dt>
                <dd className="mt-1">
                  {snapshot.workingTree === "clean"
                    ? "чисто"
                    : `изменений: ${snapshot.changedCount}`}
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Отчёт</dt>
                <dd className="mt-1">
                  {snapshot.artifactPresent ? "найден" : "не найден"}
                </dd>
              </div>
            </dl>

            <div className="mt-4 rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-[12px] font-semibold">
                Проверки основной ветки: {successCount} из {snapshot.workflows.length} пройдены
              </div>
              <div className="divide-y divide-border">
                {snapshot.workflows.map((workflow) => (
                  <div
                    key={workflow.name}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
                  >
                    <span className="min-w-0 truncate font-mono">
                      {workflowDisplayName(workflow.name)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      {workflowConclusionLabel(workflow.conclusion)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 text-success"
                aria-hidden
              />
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">
                  Приватность и предварительная проверка
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Браузерная проверка повторяет основные правила поиска небезопасных данных.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-[12px]">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 font-medium">
                  <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Граница доступа
                </div>
                <div className="mt-1 text-muted-foreground">
                  Доступ к разделу открыт только роли{" "}
                  системного администратора. Проверка маршрута показывает логику интерфейса,
                  доступ рабочей системы проверяется отдельно.
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="font-medium">Проверка предпросмотра</div>
                <div
                  className={
                    privacySummary.findingCount === 0
                      ? "mt-1 text-success"
                      : "mt-1 text-destructive"
                  }
                >
                  {privacySummary.findingCount === 0
                    ? "Чувствительные совпадения не найдены."
                    : `Найдено совпадений: ${privacySummary.findingCount}.`}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Проверено строк: {privacySummary.lineCount}. Категорий скана:{" "}
                  {RELEASE_STATUS_PRIVACY_CATEGORIES.length}.
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[11px] text-muted-foreground">
                    Показать категории приватности
                  </summary>
                  <ul
                    className="mt-2 grid gap-1 sm:grid-cols-2"
                    aria-label="Категории проверки приватности"
                  >
                    {RELEASE_STATUS_PRIVACY_CATEGORIES.map((category) => (
                      <li
                        key={category}
                        className="rounded bg-background px-2 py-1 font-mono text-[10px]"
                      >
                        {privacyCategoryLabel(category)}
                      </li>
                    ))}
                  </ul>
                </details>
                {privacySummary.findings.length > 0 && (
                  <ul
                    className="mt-2 space-y-1"
                    aria-label="Найденные приватные совпадения"
                  >
                    {privacySummary.findings.slice(0, 4).map((finding) => (
                      <li key={`${finding.label}-${finding.line}`}>
                        строка {finding.line}: {finding.label}
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-11 text-[12px]"
                  onClick={handlePrivacyCheck}
                >
                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Проверить предпросмотр
                </Button>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="font-medium">Локальный запуск</div>
                <p className="mt-1 rounded bg-background px-2 py-1 text-[11px] text-muted-foreground">
                  Команды скрыты с экрана. Скопируйте нужный запуск кнопкой ниже и выполните
                  его в локальном терминале.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 min-h-11 text-[12px]"
                  onClick={handlePreparePreflight}
                >
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Подготовить локальный запуск
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-0 mt-2 min-h-11 text-[12px] sm:ml-2 sm:mt-3"
                  onClick={handlePrepareSyncCheck}
                >
                  <ListChecks className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Скопировать сверку
                </Button>
                <div
                  className="mt-3 rounded-md border border-border bg-background p-2"
                  role="region"
                  aria-label="Сверка синхронизации публикации"
                >
                  <div className="text-[11px] font-medium">
                    Сверка синхронизации
                  </div>
                  <div
                    className="mt-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700"
                    role="status"
                    aria-label="Статус сверки записи отчётов"
                  >
                    {RELEASE_STATUS_CI_GATE_STATUS}
                  </div>
                  <div
                    className="mt-2 rounded-md border border-border bg-muted/30 p-2"
                    role="region"
                    aria-label="Проверка записи отчётов публикации"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="text-[11px] font-medium">
                          Проверка записи отчётов
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Проверяет, будут ли отчёты записаны только после успешных проверок.
                        </p>
                      </div>
                      <select
                        className="min-h-11 rounded-md border border-input bg-background px-2 text-[11px]"
                        aria-label="Сценарий проверки записи отчётов"
                        value={writeGateScenario}
                        onChange={(event) =>
                          setWriteGateScenario(
                            event.target.value as ReleaseWriteGateScenario,
                          )
                        }
                      >
                        <option value="pass">Проверка пройдена</option>
                        <option value="fail">Проверка не пройдена</option>
                      </select>
                    </div>
                    <div
                      className={
                        writeGateSummary.canWriteReports
                          ? "mt-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700"
                          : "mt-2 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive"
                      }
                      role="status"
                      aria-label="Статус проверки записи отчётов"
                    >
                      {writeGateSummary.message}
                    </div>
                    <ul
                      className="mt-2 space-y-1 text-[11px] text-muted-foreground"
                      aria-label="Проверки записи отчётов"
                    >
                      {writeGateSummary.steps.map((step) => (
                        <li key={step.id}>
                          {step.ok ? "✓" : "✗"} {step.label}: {step.detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div
                    className="mt-2 rounded bg-muted/50 px-2 py-1 text-[10px] leading-relaxed text-muted-foreground"
                    aria-label="Полный блок сверки"
                  >
                    Полный служебный блок скрыт с экрана и доступен через копирование.
                  </div>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <ul
                      className="space-y-1 text-[11px] text-muted-foreground"
                      aria-label="Критерии сверки публикации"
                    >
                      <li>Сверка запускает проверки синхронизации, документов и изменений.</li>
                      <li>Запись отчётов разрешается только после успешных проверок.</li>
                      <li>До проверки изменений документы и синхронизация должны быть актуальны.</li>
                      <li>После синхронизации Lovable видимый коммит должен быть актуальным.</li>
                      <li>Если синхронизация устарела, отсутствующий код не переимплементировать.</li>
                    </ul>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-fit shrink-0 text-[11px]"
                      onClick={handlePrepareSyncBlock}
                      aria-label="Скопировать полный блок сверки"
                    >
                      Скопировать блок
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section
          aria-label="Импорт журнала публикации"
          aria-busy={historyBusy || auditBusy || presetBusy}
          className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]"
        >
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <FileUp className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">
                  Импорт журнала истории
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Вставьте безопасный журнал публикации, чтобы сравнить
                  текущую основную ветку с выбранным эталоном.
                </p>
              </div>
            </div>
            <Textarea
              ref={historyInputRef}
              value={historyInput}
              onChange={(event) => {
                setHistoryInput(event.target.value);
                setHistoryPage(1);
              }}
              aria-label="Вставить журнал истории публикации"
              aria-invalid={historyIssueSummary.totalIssues > 0}
              aria-describedby="release-history-import-error-summary release-history-import-error-hints release-history-filter-summary release-history-import-status release-history-import-privacy-status"
              disabled={historyBusy}
              className="mt-3 min-h-[150px] resize-y font-mono text-[11px] leading-relaxed"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 text-[12px]"
                onClick={handleDryRunHistory}
                disabled={isBusy}
              >
                <ListChecks className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {operation === "history_dry_run"
                  ? "Проверяем…"
                  : "Проверить импорт"}
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-11 text-[12px]"
                onClick={handleImportHistory}
                disabled={isBusy}
              >
                <FileUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {operation === "history_import"
                  ? "Импортируем…"
                  : "Импортировать журнал"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-[12px]"
                onClick={handleResetHistoryInput}
                disabled={isBusy}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Сбросить пример
              </Button>
            </div>

            <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-[12px]">
              <div className="flex items-center gap-1.5 font-medium">
                <ListChecks className="h-3.5 w-3.5 text-primary" aria-hidden />
                Предпросмотр истории
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <div>
                  <div className="text-[11px] text-muted-foreground">Строк</div>
                  <div className="font-mono">{historyPreview.totalLines}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Принято
                  </div>
                  <div className="font-mono">
                    {historyPreview.acceptedCount}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Пропущено
                  </div>
                  <div className="font-mono">{historyPreview.skippedCount}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">
                    Проверка данных
                  </div>
                  <div
                    className={
                      historyPreview.privacyFindingCount === 0
                        ? "font-mono text-success"
                        : "font-mono text-destructive"
                    }
                  >
                    {historyPreview.privacyFindingCount}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Последний код версии: {historyPreview.latestSha ?? "нет"}.
                {historyPreview.latestStatus &&
                  ` Статус: ${releaseStatusLevelLabel(historyPreview.latestStatus)}.`}
              </div>
              <div
                id="release-history-import-error-summary"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-label="Сводка ошибок импорта журнала публикации"
                className={
                  historyIssueSummary.totalIssues === 0
                    ? "mt-2 rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground"
                    : "mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive"
                }
              >
                {historyIssueSummary.message}
                {firstHistoryIssue && (
                  <span className="mt-1 block">
                    Первая ошибка: строка {firstHistoryIssue.line},{" "}
                    {firstHistoryIssue.reason}.
                  </span>
                )}
              </div>
              {historyIssueHints.length > 0 && (
                <div className="mt-2 rounded-md border border-border bg-background p-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <ul
                      id="release-history-import-error-hints"
                      className="space-y-1 text-[11px] text-muted-foreground"
                      aria-label="Подсказки исправления журнала публикации"
                    >
                      {historyIssueHints.map((hint) => (
                        <li key={hint}>{hint}</li>
                      ))}
                    </ul>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-fit shrink-0 text-[11px]"
                      onClick={handleFocusFirstHistoryError}
                      aria-label="Фокус на журнале с ошибкой"
                    >
                      К журналу
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-3 rounded-md border border-border bg-background p-3">
                <div className="grid gap-2 lg:grid-cols-[minmax(180px,0.8fr)_minmax(180px,1fr)_auto_auto] lg:items-end">
                  <label className="text-[11px] text-muted-foreground">
                    Набор фильтров
                    <select
                      aria-label="Набор фильтров журнала публикации"
                      value={selectedHistoryPresetId}
                      onChange={(event) =>
                        handleHistoryPresetChange(event.target.value)
                      }
                      className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="custom">Ручные фильтры</option>
                      <optgroup label="Встроенные">
                        {DEFAULT_RELEASE_HISTORY_FILTER_PRESETS.map(
                          (preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ),
                        )}
                      </optgroup>
                      {savedHistoryPresets.length > 0 && (
                        <optgroup label="Сохранённые">
                          {savedHistoryPresets.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </label>
                  <label className="text-[11px] text-muted-foreground">
                    Название набора фильтров
                    <Input
                      aria-label="Название набора фильтров журнала публикации"
                      value={historyPresetName}
                      onChange={(event) =>
                        setHistoryPresetName(event.target.value)
                      }
                      placeholder="Например: Блокеры недели"
                      className="mt-1 min-h-11 text-[12px]"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-[12px]"
                    onClick={handleSaveHistoryPreset}
                    disabled={isBusy}
                    aria-label="Сохранить текущие фильтры журнала публикации как набор фильтров"
                  >
                    Сохранить
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-[12px]"
                    onClick={handleDeleteHistoryPreset}
                    disabled={
                      isBusy ||
                      !savedHistoryPresets.some(
                        (preset) => preset.id === selectedHistoryPresetId,
                      )
                    }
                    aria-label="Удалить сохранённый набор фильтров журнала публикации"
                  >
                    Удалить
                  </Button>
                </div>
                <div
                  role="status"
                  aria-label="Сводка наборов фильтров журнала публикации"
                  className="mt-2 text-[11px] text-muted-foreground"
                >
                  Выбран: {selectedHistoryPreset?.name ?? "Ручные фильтры"}.
                  Сохранено: {savedHistoryPresets.length}/
                  {RELEASE_HISTORY_FILTER_PRESET_LIMIT}.
                </div>
                <div
                  className="mt-3 rounded-md border border-border bg-muted/30 p-2"
                  role="region"
                  aria-label="Управление наборами фильтров журнала публикации"
                  aria-busy={presetBusy}
                >
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-[11px]"
                      onClick={handleRenameHistoryPreset}
                      disabled={
                        isBusy ||
                        !savedHistoryPresets.some(
                          (preset) => preset.id === selectedHistoryPresetId,
                        )
                      }
                      aria-label="Переименовать сохранённый набор фильтров журнала публикации"
                    >
                      Переименовать
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-[11px]"
                      onClick={handleDuplicateHistoryPreset}
                      disabled={!selectedHistoryPreset || isBusy}
                      aria-label="Дублировать выбранный набор фильтров журнала публикации"
                    >
                      Дублировать
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-[11px]"
                      onClick={() => handleExportHistoryPresets("json")}
                      disabled={savedHistoryPresets.length === 0 || isBusy}
                      aria-label="Экспортировать наборы фильтров журнала публикации в служебный файл"
                    >
                      Наборы фильтров файлом
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-[11px]"
                      onClick={() => handleExportHistoryPresets("xlsx")}
                      disabled={savedHistoryPresets.length === 0 || isBusy}
                      aria-label="Экспортировать наборы фильтров журнала публикации в книгу"
                    >
                      Наборы фильтров книгой
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-[11px]"
                      onClick={handleClearHistoryPresets}
                      disabled={savedHistoryPresets.length === 0 || isBusy}
                      aria-label="Очистить сохранённые наборы фильтров журнала публикации"
                    >
                      Очистить
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 text-[11px]"
                      onClick={handleUndoClearHistoryPresets}
                      disabled={!lastClearedHistoryPresets || isBusy}
                      aria-label="Восстановить очищенные наборы фильтров журнала публикации"
                    >
                      Вернуть
                    </Button>
                  </div>
                  <Textarea
                    ref={historyPresetImportRef}
                    value={historyPresetImportInput}
                    onChange={(event) =>
                      setHistoryPresetImportInput(event.target.value)
                    }
                    aria-label="Вставить наборы фильтров журнала публикации"
                    aria-invalid={presetImportHasError}
                    aria-describedby="release-history-preset-import-preview release-history-preset-import-plan release-history-preset-import-status release-history-preset-import-hints"
                    className="mt-2 min-h-[72px] resize-y font-mono text-[11px]"
                    placeholder="Вставьте безопасные наборы фильтров журнала"
                    disabled={isBusy}
                  />
                  <div
                    role="status"
                    id="release-history-preset-import-preview"
                    aria-live="polite"
                    aria-atomic="true"
                    aria-label="Предпросмотр импорта наборов фильтров журнала публикации"
                    className="mt-2 rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground"
                  >
                    {presetImportPreview ? (
                      <>
                        Статус: {importAuditStatusLabel(presetImportPreview.status)}; принято:{" "}
                        {presetImportPreview.acceptedCount}; пропущено:{" "}
                        {presetImportPreview.skippedCount}; проверка данных:{" "}
                        {presetImportPreview.privacyFindingCount}.
                        {presetImportPreview.previewNames.length > 0 &&
                          ` Наборы фильтров: ${presetImportPreview.previewNames.join(", ")}.`}
                      </>
                    ) : (
                      "Предпросмотр появится после вставки данных наборов фильтров."
                    )}
                  </div>
                  <div
                    id="release-history-preset-import-plan"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    aria-label="План импорта наборов фильтров журнала публикации"
                    className={
                      presetImportHasError
                        ? "mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive"
                        : "mt-2 rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground"
                    }
                  >
                    {presetImportPlan ? (
                      <>
                        {presetImportPlan.message} Свободных мест:{" "}
                        {presetImportPlan.availableSlots}. Будет импортировано:{" "}
                        {presetImportPlan.willImportCount}.
                        {presetImportPlan.duplicateCount > 0 &&
                          ` Заменит: ${presetImportPlan.duplicateNames.join(", ")}.`}
                        {presetImportPlan.willTrimExistingCount > 0 &&
                          ` Вытеснит старые: ${presetImportPlan.trimmedExistingNames.join(", ")}.`}
                      </>
                    ) : (
                      "План импорта появится после вставки данных наборов фильтров."
                    )}
                  </div>
                  {presetImportHints.length > 0 && (
                    <div className="mt-2 rounded-md border border-border bg-background p-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <ul
                          id="release-history-preset-import-hints"
                          className="space-y-1 text-[11px] text-muted-foreground"
                          aria-label="Подсказки исправления импорта наборов фильтров журнала публикации"
                        >
                          {presetImportHints.map((hint) => (
                            <li key={hint}>{hint}</li>
                          ))}
                        </ul>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 w-fit shrink-0 text-[11px]"
                          onClick={handleFocusPresetImportError}
                          aria-label="Фокус на наборах фильтров с ошибкой"
                        >
                          К наборам фильтров
                        </Button>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      id="release-history-preset-import-status"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      aria-label="Статус импорта наборов фильтров журнала публикации"
                      className="text-[11px] text-muted-foreground"
                    >
                      {historyPresetImportNote}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 w-fit text-[11px]"
                      onClick={handleImportHistoryPresets}
                      disabled={!historyPresetImportInput.trim() || isBusy}
                      aria-label="Импортировать наборы фильтров журнала публикации"
                    >
                      {operation === "preset_import"
                        ? "Импортируем…"
                        : "Импорт наборов фильтров"}
                    </Button>
                  </div>
                  <div
                    className="mt-3 rounded-md border border-border bg-background p-2"
                    role="region"
                    aria-label="Аудит наборов фильтров журнала публикации"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-[11px] font-medium">
                        Аудит наборов фильтров: {presetAuditLog.length}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 w-fit text-[11px]"
                        onClick={handleDownloadPresetAudit}
                        disabled={presetAuditLog.length === 0 || isBusy}
                        aria-label="Скачать аудит наборов фильтров журнала публикации"
                      >
                        Скачать аудит
                      </Button>
                    </div>
                    {presetAuditLog.length > 0 ? (
                      <ul
                        className="mt-2 space-y-1 text-[11px] text-muted-foreground"
                        aria-label="Записи аудита наборов фильтров журнала публикации"
                      >
                        {presetAuditLog.slice(0, 4).map((entry) => (
                          <li key={`${entry.at}-${entry.action}`}>
                            {formatTime(entry.at)} · {entry.action} ·{" "}
                            {entry.presetCount}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div
                        role="status"
                        className="mt-2 text-[11px] text-muted-foreground"
                      >
                        Операций с наборами фильтров пока нет.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <label className="text-[11px] text-muted-foreground">
                  Статус
                  <select
                    aria-label="Фильтр статуса истории"
                    value={historyStatusFilter}
                    onChange={(event) => {
                      markHistoryFiltersCustom();
                      setHistoryStatusFilter(
                        event.target.value as ReleaseHistoryStatusFilter,
                      );
                      setHistoryPage(1);
                    }}
                    className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Все</option>
                    <option value="ok">Готово</option>
                    <option value="incomplete">Нужно проверить</option>
                    <option value="fail">Блокер</option>
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Служебные файлы
                  <select
                    aria-label="Фильтр служебных файлов истории"
                    value={historyDenoFilter}
                    onChange={(event) => {
                      markHistoryFiltersCustom();
                      setHistoryDenoFilter(
                        event.target.value as ReleaseHistoryDenoFilter,
                      );
                      setHistoryPage(1);
                    }}
                    className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Любой</option>
                    <option value="ok">Чисто</option>
                    <option value="blocked">Блокер</option>
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Отчёт
                  <select
                    aria-label="Фильтр отчёта истории"
                    value={historyArtifactFilter}
                    onChange={(event) => {
                      markHistoryFiltersCustom();
                      setHistoryArtifactFilter(
                        event.target.value as ReleaseHistoryArtifactFilter,
                      );
                      setHistoryPage(1);
                    }}
                    className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Любой</option>
                    <option value="present">Есть</option>
                    <option value="missing">Нет</option>
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Проверки
                  <select
                    aria-label="Фильтр результата проверок истории"
                    value={historyWorkflowFilter}
                    onChange={(event) => {
                      markHistoryFiltersCustom();
                      setHistoryWorkflowFilter(
                        event.target.value as ReleaseHistoryWorkflowFilter,
                      );
                      setHistoryPage(1);
                    }}
                    className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Любой</option>
                    {historyWorkflowOptions.map((option) => (
                      <option key={option} value={option}>
                        {workflowConclusionLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Поиск
                  <Input
                    aria-label="Поиск по журналу публикации"
                    value={historyQuery}
                    onChange={(event) => {
                      markHistoryFiltersCustom();
                      setHistoryQuery(event.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="код версии, проверка, ветка"
                    className="mt-1 min-h-11 text-[12px]"
                  />
                </label>
              </div>
              <div className="mt-2 flex flex-col gap-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div
                  id="release-history-filter-summary"
                  role="status"
                  aria-label="Сводка фильтров журнала публикации"
                >
                  Найдено записей истории: {filteredHistoryRecords.length} из{" "}
                  {historyDraft.records.length}.
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-fit text-[11px]"
                    onClick={() => handleExportFilteredHistory("jsonl")}
                    disabled={filteredHistoryRecords.length === 0 || isBusy}
                    aria-label="Экспортировать отфильтрованный журнал публикации"
                  >
                    <Download className="mr-1 h-3 w-3" aria-hidden />
                    {operation === "history_filtered_jsonl"
                      ? "Готовим журнал…"
                      : "Журнал"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-fit text-[11px]"
                    onClick={() => handleExportFilteredHistory("csv")}
                    disabled={filteredHistoryRecords.length === 0 || isBusy}
                    aria-label="Экспортировать отфильтрованный журнал публикации таблицей"
                  >
                    <Download className="mr-1 h-3 w-3" aria-hidden />
                    {operation === "history_filtered_csv"
                      ? "Готовим таблицу…"
                      : "Таблица"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-fit text-[11px]"
                    onClick={() => handleExportFilteredHistory("xlsx")}
                    disabled={filteredHistoryRecords.length === 0 || isBusy}
                    aria-label="Экспортировать отфильтрованный журнал публикации книгой"
                  >
                    <Download className="mr-1 h-3 w-3" aria-hidden />
                    {operation === "history_filtered_xlsx"
                      ? "Готовим книгу…"
                      : "Книга"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 w-fit text-[11px]"
                    onClick={resetHistoryFilters}
                    disabled={isBusy}
                    aria-label="Сбросить фильтры журнала публикации"
                  >
                    Сбросить фильтры
                  </Button>
                </div>
              </div>
              {historyPreview.workflowNames.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Проверки в предпросмотре:{" "}
                  {historyPreview.workflowNames
                    .slice(0, 4)
                    .map(workflowDisplayName)
                    .join(", ")}
                  {historyPreview.workflowNames.length > 4 ? "…" : ""}.
                </div>
              )}
              {historyDraft.issues.length > 0 && (
                <ul
                  className="mt-2 space-y-1 rounded-md border border-border bg-background p-2"
                  aria-label="Ошибки формата журнала публикации"
                >
                  {historyDraft.issues.slice(0, 4).map((issue, index) => (
                    <li
                      key={`${issue.line}-${issue.reason}-${index}`}
                      className="text-[11px] text-muted-foreground"
                    >
                      строка {issue.line}: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {historyPageData.records.length > 0 ? (
                <ul
                  className="mt-2 divide-y divide-border rounded-md border border-border"
                  aria-label="Предпросмотр записей журнала публикации"
                >
                  {historyPageData.records.map((record) => (
                    <li
                      key={`${record.currentSha}-${record.recordedAt}`}
                      className="grid gap-1 px-2 py-1.5 sm:grid-cols-[1fr_auto]"
                    >
                      <span className="font-mono">код версии скрыт</span>
                      <span className="text-muted-foreground">
                        {releaseStatusLevelLabel(record.overallStatus)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div
                  role="status"
                  className="mt-2 rounded-md border border-dashed border-border bg-background p-2 text-[11px] text-muted-foreground"
                >
                  По выбранным фильтрам записей нет.
                </div>
              )}
              <div
                className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
                role="region"
                aria-label="Пагинация журнала публикации"
              >
                <span>
                  {historyPageData.totalCount === 0
                    ? "0 из 0"
                    : `${historyPageData.start}-${historyPageData.end} из ${historyPageData.totalCount}`}{" "}
                  · страница {historyPageData.page} из{" "}
                  {historyPageData.pageCount}
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-[11px]"
                    onClick={() =>
                      setHistoryPage((page) => Math.max(1, page - 1))
                    }
                    disabled={historyPageData.page <= 1}
                    aria-label="Предыдущая страница истории"
                  >
                    Назад
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-[11px]"
                    onClick={() =>
                      setHistoryPage((page) =>
                        Math.min(historyPageData.pageCount, page + 1),
                      )
                    }
                    disabled={historyPageData.page >= historyPageData.pageCount}
                    aria-label="Следующая страница истории"
                  >
                    Далее
                  </Button>
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-[16px] font-semibold tracking-tight">
              Эталон сравнения
            </h2>
            <div
              id="release-history-import-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Статус импорта журнала публикации"
              className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-[12px] text-muted-foreground"
            >
              {historyParseNote}
            </div>
            <div
              id="release-history-import-privacy-status"
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Статус проверки данных импорта журнала публикации"
              className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-[12px] text-muted-foreground"
            >
              {importPrivacyNote}
            </div>
            <label className="mt-3 block text-[12px] text-muted-foreground">
              Эталон для сравнения
              <select
                aria-label="Выбрать эталон готовности публикации"
                value={selectedBaseline.id}
                onChange={(event) => setSelectedBaselineId(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {baselineOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <dl className="mt-3 space-y-2 text-[12px]">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Источник</dt>
                <dd className="mt-1">
                  {selectedBaseline.source === "imported"
                    ? "Импортированная история"
                    : "Учебный эталон"}
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Детали</dt>
                <dd className="mt-1">{selectedBaseline.detail}</dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 min-h-11 text-[12px]"
              onClick={handleDeleteImportedHistory}
              disabled={importedRecords.length === 0 || isBusy}
              aria-label="Удалить импортированные эталоны"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {operation === "history_delete" ? "Удаляем…" : "Удалить импорт"}
            </Button>

            <div
              className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-[12px]"
              role="region"
              aria-label="Предпросмотр выбранного эталона"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">Предпросмотр эталона</div>
                <Badge
                  variant={
                    comparison.previousLevel === "fail"
                      ? "destructive"
                      : comparison.previousLevel === "ok"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {releaseStatusLevelLabel(comparison.previousLevel)}
                </Badge>
              </div>
              <dl className="mt-2 grid gap-2">
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <dt className="text-muted-foreground">Код</dt>
                  <dd className="break-all font-mono">
                    код скрыт
                  </dd>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <dt className="text-muted-foreground">Дата</dt>
                  <dd>{selectedBaseline.snapshot.generatedAt.slice(0, 10)}</dd>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <dt className="text-muted-foreground">Служебные файлы</dt>
                  <dd>
                    {selectedBaseline.snapshot.denoLockOk ? "Чисто" : "Блокер"}
                  </dd>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <dt className="text-muted-foreground">Отчёт</dt>
                  <dd>
                    {selectedBaseline.snapshot.artifactPresent ? "Есть" : "Нет"}
                  </dd>
                </div>
              </dl>
              <ul
                className="mt-2 divide-y divide-border rounded-md border border-border bg-background"
                aria-label="Проверки выбранного эталона"
              >
                {selectedBaseline.snapshot.workflows
                  .slice(0, 4)
                  .map((workflow) => (
                    <li
                      key={`${selectedBaseline.id}-${workflow.name}`}
                      className="grid gap-1 px-2 py-1.5 sm:grid-cols-[1fr_auto]"
                    >
                      <span className="truncate font-mono text-[11px]">
                        {workflowDisplayName(workflow.name)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {workflowConclusionLabel(workflow.conclusion)}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>

            <div
              className="mt-4"
              role="region"
              aria-label="Аудит импортов журнала публикации"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <History className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Аудит импортов
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-[12px]"
                    onClick={() => handleDownloadImportAudit("json")}
                    disabled={filteredImportAuditLog.length === 0 || isBusy}
                    aria-label="Скачать служебный отчёт аудита импортов журнала публикации"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    {operation === "audit_json"
                      ? "Готовим отчёт…"
                      : "Служебный отчёт"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-[12px]"
                    onClick={() => handleDownloadImportAudit("csv")}
                    disabled={filteredImportAuditLog.length === 0 || isBusy}
                    aria-label="Скачать табличный отчёт аудита импортов журнала публикации"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    {operation === "audit_csv" ? "Готовим таблицу…" : "Табличный отчёт"}
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
                <label className="text-[11px] text-muted-foreground">
                  Статус аудита
                  <select
                    aria-label="Фильтр статуса аудита импортов"
                    value={auditStatusFilter}
                    onChange={(event) =>
                      setAuditStatusFilter(event.target.value)
                    }
                    className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {AUDIT_STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option === "all"
                          ? "Все"
                          : importAuditStatusLabel(
                              option as ImportAuditEntry["status"],
                            )}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Проверка данных
                  <select
                    aria-label="Фильтр проверки данных аудита импортов"
                    value={auditPrivacyFilter}
                    onChange={(event) =>
                      setAuditPrivacyFilter(
                        event.target.value as ReleaseImportAuditPrivacyFilter,
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Любой</option>
                    <option value="clean">Без совпадений</option>
                    <option value="with_privacy">Есть совпадения</option>
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground sm:col-span-2">
                  Поиск
                  <Input
                    aria-label="Поиск по аудиту импортов"
                    value={auditQuery}
                    onChange={(event) => setAuditQuery(event.target.value)}
                    placeholder="статус, дата, сообщение"
                    className="mt-1 min-h-11 text-[12px]"
                  />
                </label>
              </div>
              <div className="mt-2 flex flex-col gap-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <div role="status" aria-label="Сводка фильтров аудита импортов">
                  Показано записей аудита: {filteredImportAuditLog.length} из{" "}
                  {importAuditLog.length}.
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 w-fit text-[11px]"
                  onClick={resetAuditFilters}
                  disabled={isBusy}
                  aria-label="Сбросить фильтры аудита импортов"
                >
                  Сбросить аудит-фильтры
                </Button>
              </div>
              {importAuditLog.length === 0 ? (
                <div
                  role="status"
                  className="mt-2 rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground"
                >
                  Попыток импорта пока нет.
                </div>
              ) : filteredImportAuditLog.length === 0 ? (
                <div
                  role="status"
                  className="mt-2 rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground"
                >
                  По выбранным фильтрам аудита записей нет.
                </div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {filteredImportAuditLog.map((entry) => (
                    <li
                      key={`${entry.at}-${entry.status}`}
                      className="rounded-md border border-border p-3 text-[12px]"
                    >
                      <div
                        className={
                          entry.status === "blocked"
                            ? "font-medium text-destructive"
                            : "font-medium text-foreground"
                        }
                      >
                        {importAuditStatusLabel(entry.status as Parameters<typeof importAuditStatusLabel>[0])}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatTime(entry.at)} · принято {entry.acceptedCount},
                        пропущено {entry.skippedCount}, проверка данных{" "}
                        {entry.privacyFindingCount}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {entry.message}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </section>

        <section
          aria-label="Сравнение публикаций"
          className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
        >
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <GitCompare className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">
                  Сравнение публикаций
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Текущий снимок основной ветки сравнивается с предыдущим сохранённым
                  снимком.
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Предыдущий</dt>
                <dd className="mt-1 font-mono">
                  код версии скрыт
                </dd>
                <dd className="mt-1">
                  {releaseStatusLevelLabel(comparison.previousLevel)}
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Текущий</dt>
                <dd className="mt-1 font-mono">код версии скрыт</dd>
                <dd className="mt-1">
                  {releaseStatusLevelLabel(comparison.currentLevel)}
                </dd>
              </div>
            </dl>
            <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-[12px]">
              {comparison.improved
                ? "Статус улучшился: блокирующие сигналы сняты."
                : comparison.worsened
                  ? "Статус ухудшился: требуется ручная проверка."
                  : "Итоговый статус не изменился."}
              {comparison.artifactChanged && (
                <span className="block pt-1 text-muted-foreground">
                  Доступность отчёта изменилась.
                </span>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-[13px] font-semibold">Изменения проверок</h3>
            {comparison.workflowChanges.length === 0 ? (
              <div
                role="status"
                className="mt-3 rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground"
              >
                Изменений проверок нет.
              </div>
            ) : (
              <ul
                className="mt-3 divide-y divide-border rounded-md border border-border"
                aria-label="Изменения проверок между публикациями"
              >
                {comparison.workflowChanges.map((item) => (
                  <li
                    key={item.name}
                    className="grid gap-1 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <span className="font-medium">{workflowDisplayName(item.name)}</span>
                    <span className="text-muted-foreground">
                      {workflowConclusionLabel(item.previous)} →{" "}
                      {workflowConclusionLabel(item.current)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="text-[16px] font-semibold tracking-tight">
                  Файловый предпросмотр
                </h2>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                Формат
                <select
                  aria-label="Формат предпросмотра статуса публикации"
                  value={format}
                  onChange={(event) =>
                    setFormat(event.target.value as ReleaseStatusFormat)
                  }
                  className="min-h-11 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {FORMATS.map((item) => (
                    <option key={item} value={item}>
                      {releaseStatusFormatLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <Textarea
              readOnly
              aria-label="Предпросмотр файла готовности публикации"
              value={safePreviewOutput}
              className="mt-3 min-h-[320px] resize-y font-mono text-[11px] leading-relaxed"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-11 text-[12px]"
                onClick={handleExportBundle}
                disabled={isBusy}
                aria-label="Экспортировать единый пакет готовности публикации"
              >
                <PackageCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {operation === "bundle_export"
                  ? "Готовим пакет…"
                  : "Единый пакет"}
              </Button>
              {FORMATS.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={item === format ? "default" : "outline"}
                  size="sm"
                  className="min-h-11 text-[12px]"
                  onClick={() => handleExport(item)}
                  disabled={isBusy}
                  aria-label={`Экспортировать готовность публикации: ${releaseStatusFormatLabel(item)}`}
                >
                  <FileCode2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  {releaseStatusFormatLabel(item)}
                </Button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="text-[16px] font-semibold tracking-tight">
                  Журнал экспорта интерфейса
                </h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-[12px]"
                onClick={() => setShowHistory((value) => !value)}
                aria-expanded={showHistory}
                aria-controls="release-export-log"
              >
                {showHistory ? "Скрыть" : "Показать"}
              </Button>
            </div>

            {showHistory && (
              <div
                id="release-export-log"
                role="region"
                aria-label="Журнал экспортов статуса публикации"
                className="mt-3"
              >
                {exportLog.length === 0 ? (
                  <div
                    role="status"
                    className="rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground"
                  >
                    Экспортов пока нет.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {exportLog.map((entry) => (
                      <li
                        key={`${entry.at}-${entry.filename}`}
                        className="rounded-md border border-border p-3 text-[12px]"
                      >
                        <div className="font-medium">
                          {entry.format === "bundle"
                            ? "Единый пакет"
                            : releaseStatusFormatLabel(entry.format)}
                        </div>
                        <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          {entry.filename}
                        </div>
                        {entry.fileCount && (
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Файлов: {entry.fileCount}
                          </div>
                        )}
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {formatTime(entry.at)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}

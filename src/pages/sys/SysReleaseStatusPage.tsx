import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
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
import {
  buildReleaseImportAuditReport,
  buildReleaseStatusExportBundle,
  buildReleaseStatusExportFile,
  buildReleaseBaselineOptions,
  compareReleaseStatusSnapshots,
  filterReleaseHistoryRecords,
  paginateReleaseHistoryRecords,
  RELEASE_STATUS_ALLOWED_ROLES,
  RELEASE_STATUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_DEMO_HISTORY_JSONL,
  RELEASE_STATUS_PREFLIGHT_COMMAND,
  RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_PRIVACY_CATEGORIES,
  parseReleaseHistoryJsonl,
  releaseHistoryAuditFilename,
  releaseStatusFormatLabel,
  releaseStatusLevel,
  releaseStatusLevelLabel,
  summarizeReleaseHistoryPreview,
  summarizeReleasePrivacy,
  type ReleaseHistoryRecord,
  type ReleaseHistoryParseResult,
  type ReleaseHistoryStatusFilter,
  type ReleaseStatusFormat,
} from "@/lib/release-status-ui";

const FORMATS: ReleaseStatusFormat[] = ["markdown", "json", "html", "history"];
const HISTORY_PREVIEW_PAGE_SIZE = 3;

interface ExportLogEntry {
  at: string;
  format: ReleaseStatusFormat | "bundle";
  filename: string;
  fileCount?: number;
}

interface ImportAuditEntry {
  at: string;
  status: ReleaseHistoryParseResult["status"] | "dry_run" | "deleted" | "downloaded";
  acceptedCount: number;
  skippedCount: number;
  privacyFindingCount: number;
  message: string;
}

function downloadText(filename: string, content: string, type = "text/plain;charset=utf-8"): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  if (status === "blocked") return "Импорт заблокирован";
  if (status === "empty") return "Пустой импорт";
  if (status === "partial") return "Импорт частичный";
  if (status === "dry_run") return "Dry-run импорт";
  if (status === "deleted") return "Импорт удалён";
  if (status === "downloaded") return "Отчет аудита скачан";
  return "Импорт обработан";
}

export default function SysReleaseStatusPage() {
  const snapshot = RELEASE_STATUS_DEMO_SNAPSHOT;
  const previousSnapshot = RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT;
  const [format, setFormat] = useState<ReleaseStatusFormat>("markdown");
  const [status, setStatus] = useState("Предпросмотр готов. Секреты не отображаются.");
  const [exportLog, setExportLog] = useState<ExportLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [historyInput, setHistoryInput] = useState(RELEASE_STATUS_DEMO_HISTORY_JSONL);
  const [importedRecords, setImportedRecords] = useState<ReleaseHistoryRecord[]>([]);
  const [historyParseNote, setHistoryParseNote] = useState("History JSONL ещё не импортирован.");
  const [importPrivacyNote, setImportPrivacyNote] = useState("Privacy-проверка импорта ожидает запуска.");
  const [importAuditLog, setImportAuditLog] = useState<ImportAuditEntry[]>([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState("demo-previous");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<ReleaseHistoryStatusFilter>("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const level = releaseStatusLevel(snapshot);
  const currentExport = useMemo(() => buildReleaseStatusExportFile(snapshot, format), [format, snapshot]);
  const output = currentExport.content;
  const privacySummary = currentExport.privacy;
  const privacyFindings = privacySummary.findings;
  const historyDraft = useMemo(() => parseReleaseHistoryJsonl(historyInput), [historyInput]);
  const historyPreview = useMemo(() => summarizeReleaseHistoryPreview(historyDraft), [historyDraft]);
  const filteredHistoryRecords = useMemo(
    () => filterReleaseHistoryRecords(historyDraft.records, historyStatusFilter, historyQuery),
    [historyDraft.records, historyQuery, historyStatusFilter],
  );
  const historyPageData = useMemo(
    () => paginateReleaseHistoryRecords(filteredHistoryRecords, historyPage, HISTORY_PREVIEW_PAGE_SIZE),
    [filteredHistoryRecords, historyPage],
  );
  const baselineOptions = useMemo(
    () => buildReleaseBaselineOptions(snapshot, previousSnapshot, importedRecords),
    [importedRecords, previousSnapshot, snapshot],
  );
  const selectedBaseline = baselineOptions.find((item) => item.id === selectedBaselineId) ?? baselineOptions[0]!;
  const comparison = useMemo(
    () => compareReleaseStatusSnapshots(selectedBaseline.snapshot, snapshot),
    [selectedBaseline.snapshot, snapshot],
  );
  const successCount = snapshot.workflows.filter((workflow) => workflow.conclusion === "success").length;

  const handleExport = (targetFormat: ReleaseStatusFormat) => {
    const file = buildReleaseStatusExportFile(snapshot, targetFormat);
    if (file.privacy.findingCount > 0) {
      setStatus(`Экспорт заблокирован: найдено ${file.privacy.findingCount} чувствительных совпадений.`);
      return;
    }
    downloadText(file.filename, file.content, file.mime);
    setExportLog((items) => [
      { at: new Date().toISOString(), format: targetFormat, filename: file.filename },
      ...items.slice(0, 4),
    ]);
    setStatus(`${releaseStatusFormatLabel(targetFormat)} экспорт готов: ${file.filename}`);
  };

  const handleExportBundle = () => {
    const files = buildReleaseStatusExportBundle(snapshot);
    const unsafe = files.filter((file) => file.privacy.findingCount > 0);
    if (unsafe.length > 0) {
      setStatus(`Пакетный экспорт заблокирован: небезопасных файлов ${unsafe.length}.`);
      return;
    }
    for (const file of files) downloadText(file.filename, file.content, file.mime);
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
  };

  const handlePrivacyCheck = () => {
    if (privacyFindings.length === 0) {
      setStatus(`Проверка приватности пройдена для ${releaseStatusFormatLabel(format)}.`);
    } else {
      setStatus(`Проверка приватности нашла ${privacyFindings.length} совпадений.`);
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
    const result = historyDraft;
    recordImportAudit(
      makeImportAuditEntry(
        result,
        result.privacy.findingCount > 0 ? "blocked" : "dry_run",
        result.privacy.findingCount > 0
          ? result.message
          : `Dry-run импорт: ${result.acceptedCount} безопасных записей; baseline не изменён.`,
      ),
    );

    setHistoryParseNote(
      result.privacy.findingCount > 0
        ? result.message
        : `Dry-run импорт выполнен: ${result.acceptedCount} безопасных записей, baseline не изменён.`,
    );
    setImportPrivacyNote(
      result.privacy.findingCount > 0
        ? `Privacy-проверка dry-run: блокер. Категории: ${result.privacy.labels.join(", ")}.`
        : "Privacy-проверка dry-run пройдена: чувствительные совпадения не найдены.",
    );
    setStatus(
      result.privacy.findingCount > 0
        ? "Dry-run импорт заблокирован: privacy detector нашёл чувствительные значения."
        : "Dry-run импорт выполнен без изменения baseline.",
    );
  };

  const handleImportHistory = () => {
    const result = historyDraft;
    recordImportAudit(makeImportAuditEntry(result));

    if (result.privacy.findingCount > 0) {
      setImportedRecords([]);
      setSelectedBaselineId("demo-previous");
      setHistoryParseNote(result.message);
      setImportPrivacyNote(
        `Privacy-проверка импорта: блокер. Категории: ${result.privacy.labels.join(", ")}.`,
      );
      setStatus("History JSONL не импортирован: privacy detector нашёл чувствительные значения.");
      return;
    }
    setImportedRecords(result.records);
    const nextOptions = buildReleaseBaselineOptions(snapshot, previousSnapshot, result.records);
    setSelectedBaselineId(nextOptions[0]?.id ?? "demo-previous");
    setHistoryParseNote(result.message);
    setImportPrivacyNote(
      result.acceptedCount === 0
        ? "Privacy-проверка импорта пройдена, но валидных baseline-записей нет."
        : "Privacy-проверка импорта пройдена: чувствительные совпадения не найдены.",
    );
    setStatus(`History JSONL обработан: ${result.acceptedCount} безопасных записей.`);
  };

  const handleDeleteImportedHistory = () => {
    if (importedRecords.length === 0) return;
    const removedCount = importedRecords.length;
    setImportedRecords([]);
    setSelectedBaselineId("demo-previous");
    const entry: ImportAuditEntry = {
      at: new Date().toISOString(),
      status: "deleted",
      acceptedCount: 0,
      skippedCount: 0,
      privacyFindingCount: 0,
      message: `Импорт удалён: очищено baseline-записей ${removedCount}.`,
    };
    recordImportAudit(entry);
    setHistoryParseNote(`Импорт удалён: очищено baseline-записей ${removedCount}.`);
    setImportPrivacyNote("Privacy-проверка импорта ожидает запуска.");
    setStatus("Импортированные baseline удалены; выбран демо-baseline.");
  };

  const handleDownloadImportAudit = () => {
    if (importAuditLog.length === 0) return;
    const content = buildReleaseImportAuditReport(importAuditLog, {
      selectedBaselineSha: selectedBaseline.snapshot.shortSha,
      selectedBaselineSource: selectedBaseline.source,
      filteredHistoryCount: filteredHistoryRecords.length,
      historyStatusFilter,
      historyQuery,
    });
    const reportPrivacy = summarizeReleasePrivacy(content);
    if (reportPrivacy.findingCount > 0) {
      setStatus("Отчет аудита импортов заблокирован: privacy detector нашёл чувствительные значения.");
      return;
    }
    const filename = releaseHistoryAuditFilename();
    downloadText(filename, content, "application/json;charset=utf-8");
    recordImportAudit({
      at: new Date().toISOString(),
      status: "downloaded",
      acceptedCount: importAuditLog.length,
      skippedCount: 0,
      privacyFindingCount: 0,
      message: `Отчет аудита импортов скачан: ${filename}.`,
    });
    setStatus(`Отчет аудита импортов скачан: ${filename}.`);
  };

  const handleResetHistoryInput = () => {
    setHistoryInput(RELEASE_STATUS_DEMO_HISTORY_JSONL);
    setImportedRecords([]);
    setSelectedBaselineId("demo-previous");
    setHistoryStatusFilter("all");
    setHistoryQuery("");
    setHistoryPage(1);
    setHistoryParseNote("History JSONL сброшен к демо-baseline.");
    setImportPrivacyNote("Privacy-проверка импорта ожидает запуска.");
    setStatus("History JSONL сброшен к безопасному демо-примеру.");
  };

  const handlePreparePreflight = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(RELEASE_STATUS_PREFLIGHT_COMMAND);
      setStatus("Команда preflight скопирована. Запустите её в локальном терминале.");
    } catch {
      setStatus(`Команда preflight: ${RELEASE_STATUS_PREFLIGHT_COMMAND}`);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Релиз-статус"
        subtitle="Безопасный просмотр release dashboard, экспорт артефактов и локальный preflight."
        actions={
          <Button size="sm" className="h-9 text-[12px]" onClick={() => handleExport(format)}>
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Экспорт текущего формата
          </Button>
        }
      />

      <div className="space-y-4 p-3 sm:p-4">
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Статус релиз-дашборда"
          className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
        >
          {status}
        </div>

        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Демо-режим. Реальные роли, RLS, аудит, ключи и Device Bridge включаются на этапе бэкенда.
        </div>

        <section
          aria-label="Предпросмотр release status"
          className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]"
        >
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <MonitorCheck className="h-4 w-4 text-primary" aria-hidden />
                  <h2 className="text-[16px] font-semibold tracking-tight">Операционный снимок</h2>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Данные синхронизированы с последним успешным main run после PR #56.
                </p>
              </div>
              <Badge
                variant={level === "ok" ? "secondary" : level === "fail" ? "destructive" : "outline"}
                className="w-fit"
              >
                {releaseStatusLevelLabel(level)}
              </Badge>
            </div>

            <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Репозиторий</dt>
                <dd className="mt-1 font-mono text-[12px]">{snapshot.repo}</dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Ветка и SHA</dt>
                <dd className="mt-1 font-mono text-[12px]">
                  {snapshot.branch} · {snapshot.shortSha}
                </dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Рабочее дерево</dt>
                <dd className="mt-1">{snapshot.workingTree === "clean" ? "clean" : `${snapshot.changedCount} changed`}</dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Артефакт</dt>
                <dd className="mt-1">{snapshot.artifactPresent ? "present" : "missing"}</dd>
              </div>
            </dl>

            <div className="mt-4 rounded-md border border-border">
              <div className="border-b border-border px-3 py-2 text-[12px] font-semibold">
                Main workflows: {successCount} из {snapshot.workflows.length} success
              </div>
              <div className="divide-y divide-border">
                {snapshot.workflows.map((workflow) => (
                  <div key={workflow.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                    <span className="min-w-0 truncate font-mono">{workflow.name}</span>
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      {workflow.conclusion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-success" aria-hidden />
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">Приватность и preflight</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Браузерная проверка повторяет основные правила CLI privacy detector.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-[12px]">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 font-medium">
                  <Lock className="h-3.5 w-3.5 text-primary" aria-hidden />
                  RBAC scope
                </div>
                <div className="mt-1 text-muted-foreground">
                  Доступ к разделу открыт только роли {RELEASE_STATUS_ALLOWED_ROLES.join(", ")}.
                  RouteGuard остаётся UX-симуляцией, серверный доступ проверяется отдельно.
                </div>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="font-medium">Скан предпросмотра</div>
                <div className={privacySummary.findingCount === 0 ? "mt-1 text-success" : "mt-1 text-destructive"}>
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
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2" aria-label="Категории проверки приватности">
                    {RELEASE_STATUS_PRIVACY_CATEGORIES.map((category) => (
                      <li key={category} className="rounded bg-background px-2 py-1 font-mono text-[10px]">
                        {category}
                      </li>
                    ))}
                  </ul>
                </details>
                {privacySummary.findings.length > 0 && (
                  <ul className="mt-2 space-y-1" aria-label="Найденные приватные совпадения">
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
                  className="mt-3 h-8 text-[12px]"
                  onClick={handlePrivacyCheck}
                >
                  <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Проверить предпросмотр
                </Button>
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="font-medium">Локальный запуск</div>
                <code className="mt-1 block rounded bg-background px-2 py-1 text-[11px]">
                  {RELEASE_STATUS_PREFLIGHT_COMMAND}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 text-[12px]"
                  onClick={handlePreparePreflight}
                >
                  <PlayCircle className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Подготовить локальный запуск
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section aria-label="Импорт release history" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <FileUp className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">Импорт history JSONL</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Вставьте безопасный `release-history.jsonl`, чтобы сравнить текущий main с выбранным baseline.
                </p>
              </div>
            </div>
            <Textarea
              value={historyInput}
              onChange={(event) => {
                setHistoryInput(event.target.value);
                setHistoryPage(1);
              }}
              aria-label="Вставить release-history JSONL"
              className="mt-3 min-h-[150px] resize-y font-mono text-[11px] leading-relaxed"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" className="h-8 text-[12px]" onClick={handleDryRunHistory}>
                <ListChecks className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Dry-run импорт
              </Button>
              <Button type="button" size="sm" className="h-8 text-[12px]" onClick={handleImportHistory}>
                <FileUp className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Импортировать history JSONL
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-8 text-[12px]" onClick={handleResetHistoryInput}>
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
                  <div className="text-[11px] text-muted-foreground">Принято</div>
                  <div className="font-mono">{historyPreview.acceptedCount}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Пропущено</div>
                  <div className="font-mono">{historyPreview.skippedCount}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Privacy</div>
                  <div className={historyPreview.privacyFindingCount === 0 ? "font-mono text-success" : "font-mono text-destructive"}>
                    {historyPreview.privacyFindingCount}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                Последний SHA: {historyPreview.latestSha ?? "нет"}.
                {historyPreview.latestStatus && ` Статус: ${releaseStatusLevelLabel(historyPreview.latestStatus)}.`}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr]">
                <label className="text-[11px] text-muted-foreground">
                  Статус
                  <select
                    aria-label="Фильтр статуса истории"
                    value={historyStatusFilter}
                    onChange={(event) => {
                      setHistoryStatusFilter(event.target.value as ReleaseHistoryStatusFilter);
                      setHistoryPage(1);
                    }}
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">Все</option>
                    <option value="ok">Готово</option>
                    <option value="incomplete">Нужно проверить</option>
                    <option value="fail">Блокер</option>
                  </select>
                </label>
                <label className="text-[11px] text-muted-foreground">
                  Поиск
                  <Input
                    aria-label="Поиск по release history"
                    value={historyQuery}
                    onChange={(event) => {
                      setHistoryQuery(event.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="SHA, workflow, branch"
                    className="mt-1 h-9 text-[12px]"
                  />
                </label>
              </div>
              {historyPreview.workflowNames.length > 0 && (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Workflow в preview: {historyPreview.workflowNames.slice(0, 4).join(", ")}
                  {historyPreview.workflowNames.length > 4 ? "…" : ""}.
                </div>
              )}
              {historyDraft.issues.length > 0 && (
                <ul className="mt-2 space-y-1 rounded-md border border-border bg-background p-2" aria-label="Ошибки формата release history">
                  {historyDraft.issues.slice(0, 4).map((issue, index) => (
                    <li key={`${issue.line}-${issue.reason}-${index}`} className="text-[11px] text-muted-foreground">
                      строка {issue.line}: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
              {historyPageData.records.length > 0 ? (
                <ul className="mt-2 divide-y divide-border rounded-md border border-border" aria-label="Предпросмотр записей release history">
                  {historyPageData.records.map((record) => (
                    <li key={`${record.currentSha}-${record.recordedAt}`} className="grid gap-1 px-2 py-1.5 sm:grid-cols-[1fr_auto]">
                      <span className="font-mono">{record.currentSha}</span>
                      <span className="text-muted-foreground">{releaseStatusLevelLabel(record.overallStatus)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div role="status" className="mt-2 rounded-md border border-dashed border-border bg-background p-2 text-[11px] text-muted-foreground">
                  По выбранным фильтрам history-записей нет.
                </div>
              )}
              <div
                className="mt-2 flex flex-col gap-2 rounded-md border border-border bg-background p-2 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
                role="region"
                aria-label="Пагинация release history"
              >
                <span>
                  {historyPageData.totalCount === 0
                    ? "0 из 0"
                    : `${historyPageData.start}-${historyPageData.end} из ${historyPageData.totalCount}`}{" "}
                  · страница {historyPageData.page} из {historyPageData.pageCount}
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                    disabled={historyPageData.page <= 1}
                    aria-label="Предыдущая страница истории"
                  >
                    Назад
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setHistoryPage((page) => Math.min(historyPageData.pageCount, page + 1))}
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
            <h2 className="text-[16px] font-semibold tracking-tight">Baseline status</h2>
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Статус импорта release history"
              className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-[12px] text-muted-foreground"
            >
              {historyParseNote}
            </div>
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Privacy статус импорта release history"
              className="mt-2 rounded-md border border-border bg-muted/30 p-3 text-[12px] text-muted-foreground"
            >
              {importPrivacyNote}
            </div>
            <label className="mt-3 block text-[12px] text-muted-foreground">
              Baseline для сравнения
              <select
                aria-label="Выбрать baseline release status"
                value={selectedBaseline.id}
                onChange={(event) => setSelectedBaselineId(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <dd className="mt-1">{selectedBaseline.source === "imported" ? "Импортированный history" : "Демо-baseline"}</dd>
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
              className="mt-3 h-8 text-[12px]"
              onClick={handleDeleteImportedHistory}
              disabled={importedRecords.length === 0}
              aria-label="Удалить импортированные baseline"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Удалить импорт
            </Button>

            <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-[12px]" role="region" aria-label="Предпросмотр выбранного baseline">
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">Предпросмотр baseline</div>
                <Badge variant={comparison.previousLevel === "fail" ? "destructive" : comparison.previousLevel === "ok" ? "secondary" : "outline"}>
                  {releaseStatusLevelLabel(comparison.previousLevel)}
                </Badge>
              </div>
              <dl className="mt-2 grid gap-2">
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <dt className="text-muted-foreground">SHA</dt>
                  <dd className="break-all font-mono">{selectedBaseline.snapshot.shortSha}</dd>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <dt className="text-muted-foreground">Дата</dt>
                  <dd>{selectedBaseline.snapshot.generatedAt.slice(0, 10)}</dd>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <dt className="text-muted-foreground">Deno</dt>
                  <dd>{selectedBaseline.snapshot.denoLockOk ? "OK" : "Блокер"}</dd>
                </div>
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <dt className="text-muted-foreground">Артефакт</dt>
                  <dd>{selectedBaseline.snapshot.artifactPresent ? "Есть" : "Нет"}</dd>
                </div>
              </dl>
              <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-background" aria-label="Workflow выбранного baseline">
                {selectedBaseline.snapshot.workflows.slice(0, 4).map((workflow) => (
                  <li key={`${selectedBaseline.id}-${workflow.name}`} className="grid gap-1 px-2 py-1.5 sm:grid-cols-[1fr_auto]">
                    <span className="truncate font-mono text-[11px]">{workflow.name}</span>
                    <span className="text-[11px] text-muted-foreground">{workflow.conclusion}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4" role="region" aria-label="Аудит импортов release history">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <History className="h-3.5 w-3.5 text-primary" aria-hidden />
                  Аудит импортов
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-[12px]"
                  onClick={handleDownloadImportAudit}
                  disabled={importAuditLog.length === 0}
                  aria-label="Скачать отчет аудита импортов release history"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Скачать отчет
                </Button>
              </div>
              {importAuditLog.length === 0 ? (
                <div role="status" className="mt-2 rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground">
                  Попыток импорта пока нет.
                </div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {importAuditLog.map((entry) => (
                    <li key={`${entry.at}-${entry.status}`} className="rounded-md border border-border p-3 text-[12px]">
                      <div className={entry.status === "blocked" ? "font-medium text-destructive" : "font-medium text-foreground"}>
                        {importAuditStatusLabel(entry.status)}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {formatTime(entry.at)} · принято {entry.acceptedCount}, пропущено {entry.skippedCount}, privacy {entry.privacyFindingCount}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{entry.message}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </section>

        <section aria-label="Сравнение релизов" className="grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <GitCompare className="mt-0.5 h-4 w-4 text-primary" aria-hidden />
              <div>
                <h2 className="text-[16px] font-semibold tracking-tight">Сравнение релизов</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Текущий main-снимок сравнивается с предыдущим сохранённым снимком.
                </p>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 text-[12px] sm:grid-cols-2">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Предыдущий</dt>
                <dd className="mt-1 font-mono">{selectedBaseline.snapshot.shortSha}</dd>
                <dd className="mt-1">{releaseStatusLevelLabel(comparison.previousLevel)}</dd>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <dt className="text-muted-foreground">Текущий</dt>
                <dd className="mt-1 font-mono">{snapshot.shortSha}</dd>
                <dd className="mt-1">{releaseStatusLevelLabel(comparison.currentLevel)}</dd>
              </div>
            </dl>
            <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-[12px]">
              {comparison.improved
                ? "Статус улучшился: блокирующие сигналы сняты."
                : comparison.worsened
                  ? "Статус ухудшился: требуется ручная проверка."
                  : "Итоговый статус не изменился."}
              {comparison.artifactChanged && (
                <span className="block pt-1 text-muted-foreground">Доступность артефакта изменилась.</span>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-[13px] font-semibold">Изменения workflow</h3>
            {comparison.workflowChanges.length === 0 ? (
              <div role="status" className="mt-3 rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground">
                Изменений workflow нет.
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-md border border-border" aria-label="Изменения workflow между релизами">
                {comparison.workflowChanges.map((item) => (
                  <li key={item.name} className="grid gap-1 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto] sm:items-center">
                    <span className="font-mono">{item.name}</span>
                    <span className="text-muted-foreground">
                      {item.previous} → {item.current}
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
                <h2 className="text-[16px] font-semibold tracking-tight">Файловый предпросмотр</h2>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
                Формат
                <select
                  aria-label="Формат предпросмотра релиз-статуса"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ReleaseStatusFormat)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              aria-label="Предпросмотр файла release status"
              value={output}
              className="mt-3 min-h-[320px] resize-y font-mono text-[11px] leading-relaxed"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-8 text-[12px]"
                onClick={handleExportBundle}
                aria-label="Экспортировать единый пакет release status"
              >
                <PackageCheck className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Единый пакет
              </Button>
              {FORMATS.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={item === format ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-[12px]"
                  onClick={() => handleExport(item)}
                  aria-label={`Экспортировать release status в ${releaseStatusFormatLabel(item)}`}
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
                <h2 className="text-[16px] font-semibold tracking-tight">Журнал UI-экспорта</h2>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-[12px]"
                onClick={() => setShowHistory((value) => !value)}
                aria-expanded={showHistory}
                aria-controls="release-export-log"
              >
                {showHistory ? "Скрыть" : "Показать"}
              </Button>
            </div>

            {showHistory && (
              <div id="release-export-log" role="region" aria-label="Журнал экспортов релиз-статуса" className="mt-3">
                {exportLog.length === 0 ? (
                  <div role="status" className="rounded-md border border-dashed border-border p-3 text-[12px] text-muted-foreground">
                    Экспортов пока нет.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {exportLog.map((entry) => (
                      <li key={`${entry.at}-${entry.filename}`} className="rounded-md border border-border p-3 text-[12px]">
                        <div className="font-medium">
                          {entry.format === "bundle" ? "Единый пакет" : releaseStatusFormatLabel(entry.format)}
                        </div>
                        <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{entry.filename}</div>
                        {entry.fileCount && (
                          <div className="mt-1 text-[11px] text-muted-foreground">Файлов: {entry.fileCount}</div>
                        )}
                        <div className="mt-1 text-[11px] text-muted-foreground">{formatTime(entry.at)}</div>
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

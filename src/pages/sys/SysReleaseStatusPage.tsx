import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileCode2,
  History,
  MonitorCheck,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  buildReleaseStatusOutput,
  detectReleaseStatusUiPrivacyLeaks,
  RELEASE_STATUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_PREFLIGHT_COMMAND,
  releaseStatusFilename,
  releaseStatusFormatLabel,
  releaseStatusLevel,
  releaseStatusLevelLabel,
  type ReleaseStatusFormat,
} from "@/lib/release-status-ui";

const FORMATS: ReleaseStatusFormat[] = ["markdown", "json", "html", "history"];

interface ExportLogEntry {
  at: string;
  format: ReleaseStatusFormat;
  filename: string;
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

export default function SysReleaseStatusPage() {
  const snapshot = RELEASE_STATUS_DEMO_SNAPSHOT;
  const [format, setFormat] = useState<ReleaseStatusFormat>("markdown");
  const [status, setStatus] = useState("Предпросмотр готов. Секреты не отображаются.");
  const [exportLog, setExportLog] = useState<ExportLogEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const level = releaseStatusLevel(snapshot);
  const output = useMemo(() => buildReleaseStatusOutput(snapshot, format), [format, snapshot]);
  const privacyFindings = useMemo(() => detectReleaseStatusUiPrivacyLeaks(output), [output]);
  const successCount = snapshot.workflows.filter((workflow) => workflow.conclusion === "success").length;

  const handleExport = (targetFormat: ReleaseStatusFormat) => {
    const content = buildReleaseStatusOutput(snapshot, targetFormat);
    const findings = detectReleaseStatusUiPrivacyLeaks(content);
    if (findings.length > 0) {
      setStatus(`Экспорт заблокирован: найдено ${findings.length} чувствительных совпадений.`);
      return;
    }
    const filename = releaseStatusFilename(targetFormat);
    const mime = targetFormat === "html" ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
    downloadText(filename, content, mime);
    setExportLog((items) => [
      { at: new Date().toISOString(), format: targetFormat, filename },
      ...items.slice(0, 4),
    ]);
    setStatus(`${releaseStatusFormatLabel(targetFormat)} экспорт готов: ${filename}`);
  };

  const handlePrivacyCheck = () => {
    if (privacyFindings.length === 0) {
      setStatus(`Проверка приватности пройдена для ${releaseStatusFormatLabel(format)}.`);
    } else {
      setStatus(`Проверка приватности нашла ${privacyFindings.length} совпадений.`);
    }
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
                <div className="font-medium">Скан предпросмотра</div>
                <div className={privacyFindings.length === 0 ? "mt-1 text-success" : "mt-1 text-destructive"}>
                  {privacyFindings.length === 0
                    ? "Чувствительные совпадения не найдены."
                    : `Найдено совпадений: ${privacyFindings.length}.`}
                </div>
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
                        <div className="font-medium">{releaseStatusFormatLabel(entry.format)}</div>
                        <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{entry.filename}</div>
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

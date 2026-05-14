import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ClipboardCheck,
  Download,
  ListChecks,
  Lock,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { blobFromParts } from "@/lib/blob-utils";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  buildStage4OAuditExportPreview,
  fetchSelfHostedOpsStatus,
  STAGE4O_AUDIT_EXPORT_COMMAND,
  type SelfHostedOpsStatus,
} from "@/lib/self-hosted-ops-api";

const DEMO_SYS_BANNER =
  "Демо-режим. Реальные роли, RLS, аудит, ключи и Device Bridge появятся после подключения backend.";

function statusLabel(status: string): string {
  if (status === "ready") return "Готов";
  if (status === "degraded") return "Снижена готовность";
  if (status === "connected") return "Подключено";
  if (status === "configured") return "Настроено";
  if (status === "missing") return "Не настроено";
  if (status === "unavailable") return "Недоступно";
  return status || "Неизвестно";
}

function formatDateTime(value: string): string {
  if (!value) return "нет данных";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function downloadText(filename: string, content: string): void {
  const url = URL.createObjectURL(blobFromParts([content], "text/markdown;charset=utf-8"));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SysSelfHostedOpsPage() {
  const session = useSelfHostedApiSession();
  const [opsStatus, setOpsStatus] = useState<SelfHostedOpsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Self-hosted ops console готова.");

  const isConfigured = Boolean(session.apiBaseUrl && session.apiToken);
  const hasSystemAdminRole = session.user?.roles?.includes("system_admin") ?? false;
  const readyDependencies = useMemo(
    () => opsStatus?.dependencies.filter((item) => item.configured && item.connected).length ?? 0,
    [opsStatus],
  );

  async function refresh() {
    setError(null);
    if (!isConfigured) {
      setOpsStatus(null);
      setStatusMessage("Self-hosted backend-сессия не подключена.");
      return;
    }
    setLoading(true);
    const result = await fetchSelfHostedOpsStatus({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    });
    setLoading(false);
    if (!result.ok || !result.value) {
      setOpsStatus(null);
      setError(result.error?.message ?? "Не удалось загрузить ops status.");
      setStatusMessage("Ops status не загружен.");
      return;
    }
    setOpsStatus(result.value);
    setStatusMessage(`Ops status обновлён. Correlation: ${result.value.correlationId || "нет"}.`);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  function downloadAuditPlan() {
    const content = buildStage4OAuditExportPreview(opsStatus);
    downloadText("stage4o-audit-export-preview.md", content);
    setStatusMessage("Audit export dry-run preview скачан.");
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Self-hosted ops"
        subtitle="Операционный статус цельного self-hosted продукта: backend, PostgreSQL, object storage, audit и correlation."
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[12px]"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
              Обновить
            </Button>
            <Button asChild size="sm" className="h-8 gap-1.5 text-[12px]">
              <Link to="/self-hosted/login">
                <ServerCog className="h-3.5 w-3.5" aria-hidden />
                Self-hosted login
              </Link>
            </Button>
          </div>
        }
      />

      <main className="space-y-4 p-4">
        <div
          role="note"
          aria-label="Self-hosted ops runtime boundary"
          className="surface-toolbar flex items-start gap-2 p-3 text-[12px] text-muted-foreground"
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div>
            <div className="font-medium text-foreground">Self-hosted boundary</div>
            <p>
              Страница читает только наш backend `/api/v1/ops/status`. Managed runtime,
              внешние облачные базы данных и edge functions не используются.
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Статус self-hosted ops"
          className="sr-only"
        >
          {statusMessage}
        </div>

        {!isConfigured ? (
          <section className="surface-card p-4" aria-label="Self-hosted ops session gate">
            <div className="mb-2 flex items-center gap-2 text-warning">
              <Lock className="h-4 w-4" aria-hidden />
              <h2 className="h-section">Self-hosted сессия не подключена</h2>
            </div>
            <p className="text-meta">
              {DEMO_SYS_BANNER} Для live-статуса войдите через `/self-hosted/login` пользователем
              с ролью `system_admin`.
            </p>
            <Button asChild size="sm" className="mt-3 h-8 text-[12px]">
              <Link to="/self-hosted/login">Открыть self-hosted login</Link>
            </Button>
          </section>
        ) : null}

        {isConfigured && !hasSystemAdminRole ? (
          <section className="surface-card p-4" aria-label="Self-hosted ops role warning">
            <div className="mb-2 flex items-center gap-2 text-warning">
              <Lock className="h-4 w-4" aria-hidden />
              <h2 className="h-section">Нужна роль system_admin</h2>
            </div>
            <p className="text-meta">
              Текущая self-hosted сессия не содержит `system_admin`. Backend дополнительно
              проверит RBAC и вернёт 403 для `/api/v1/ops/status`.
            </p>
          </section>
        ) : null}

        {error ? (
          <section
            role="alert"
            aria-live="assertive"
            aria-label="Ошибка self-hosted ops"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
          >
            {error}
          </section>
        ) : null}

        <section
          className="grid gap-3 md:grid-cols-4"
          aria-label="Сводка self-hosted ops"
        >
          <MetricTile
            label="Backend"
            value={opsStatus ? statusLabel(opsStatus.status) : "Нет сессии"}
            hint={opsStatus?.source ?? "self-hosted"}
          />
          <MetricTile
            label="Dependencies"
            value={opsStatus ? `${readyDependencies}/${opsStatus.dependencies.length}` : "0/0"}
            hint="configured + connected"
          />
          <MetricTile
            label="Correlation"
            value={opsStatus?.observability.correlationHeader ?? "x-correlation-id"}
            hint={opsStatus?.correlationId || "ожидает запроса"}
          />
          <MetricTile
            label="Audit"
            value={opsStatus?.audit.mode ?? "append-only"}
            hint="metadata-only export"
          />
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="surface-card overflow-hidden" aria-label="Self-hosted dependencies">
            <div className="section-bar">
              <div>
                <h2 className="h-section">Readiness dependencies</h2>
                <p className="h-section-hint">
                  Проверка backend, PostgreSQL, JWT signing key и object storage.
                </p>
              </div>
              <Badge variant={opsStatus?.ready ? "default" : "secondary"}>
                {opsStatus?.ready ? "ready" : "not ready"}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Компонент</th>
                    <th scope="col">Настроен</th>
                    <th scope="col">Связь</th>
                    <th scope="col">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {(opsStatus?.dependencies ?? []).map((dependency) => (
                    <tr key={dependency.name}>
                      <td className="font-medium text-foreground">{dependency.name}</td>
                      <td>{dependency.configured ? "Да" : "Нет"}</td>
                      <td>{dependency.connected ? "Есть" : "Нет"}</td>
                      <td>
                        <Badge variant={dependency.status === "connected" ? "default" : "secondary"}>
                          {statusLabel(dependency.status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {!opsStatus ? (
                    <tr>
                      <td colSpan={4} className="text-meta">
                        Подключите self-hosted session и обновите статус.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface-card" aria-label="Self-hosted observability contract">
            <div className="section-bar">
              <div>
                <h2 className="h-section">Observability contract</h2>
                <p className="h-section-hint">Что backend обещает не раскрывать в UI и логах.</p>
              </div>
            </div>
            <div className="space-y-3 p-4 text-[13px]">
              <StatusLine
                icon={<ListChecks className="h-4 w-4" aria-hidden />}
                label="Structured JSON logs"
                value={opsStatus?.observability.structuredJsonLogs ? "включены" : "ожидает статуса"}
              />
              <StatusLine
                icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
                label="Redaction"
                value={opsStatus?.observability.redaction ?? "enabled"}
              />
              <StatusLine
                icon={<TerminalSquare className="h-4 w-4" aria-hidden />}
                label="Path logging"
                value={opsStatus?.observability.requestPathLogging ?? "path-only"}
              />
              <div className="rounded-md border border-border bg-surface-muted p-3 text-[12px] text-muted-foreground">
                Не выводим тела запросов, bearer-токены, пароли, ФИО пациентов,
                object keys, storage paths и raw env values.
              </div>
            </div>
          </section>
        </div>

        <section className="surface-card" aria-label="Self-hosted audit export dry-run">
          <div className="section-bar">
            <div>
              <h2 className="h-section">Audit export dry-run</h2>
              <p className="h-section-hint">Безопасный metadata-only план, без PHI и секретов.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-[12px]"
              onClick={downloadAuditPlan}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Скачать preview
            </Button>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="space-y-2 text-[13px]">
              <div className="font-medium text-foreground">Команда</div>
              <code className="block rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-[12px]">
                {STAGE4O_AUDIT_EXPORT_COMMAND}
              </code>
              <p className="text-meta">
                Последнее обновление: {formatDateTime(opsStatus?.generatedAt ?? "")}
              </p>
            </div>
            <pre
              aria-label="Предпросмотр audit export dry-run"
              className="max-h-48 overflow-auto rounded-md border border-border bg-surface-muted p-3 font-mono text-[12px] leading-relaxed text-foreground"
            >
              {buildStage4OAuditExportPreview(opsStatus)}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <section className="surface-card p-4" aria-label={label}>
      <div className="kpi-label">{label}</div>
      <div className="mt-1 text-[18px] font-semibold leading-tight text-foreground">{value}</div>
      <div className="mt-1 break-words font-mono text-[11px] text-muted-foreground">{hint}</div>
    </section>
  );
}

function StatusLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <span className="shrink-0 font-medium text-foreground">{value}</span>
    </div>
  );
}

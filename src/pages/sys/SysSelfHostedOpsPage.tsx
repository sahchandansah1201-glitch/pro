import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ClipboardCheck,
  Database,
  Download,
  FileText,
  ListChecks,
  Lock,
  PlayCircle,
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
  buildStage4POperationsPreview,
  buildStage4OAuditExportPreview,
  buildStage4ZProductReadinessPreview,
  fetchSelfHostedProductReadiness,
  fetchSelfHostedOpsRuntimeChecks,
  fetchSelfHostedOpsStatus,
  type SelfHostedProductReadiness,
  type SelfHostedOpsRuntimeChecks,
  type SelfHostedOpsStatus,
} from "@/lib/self-hosted-ops-api";

const DEMO_SYS_BANNER =
  "Учебный режим. Рабочие роли, аудит, ключи и мост устройств появятся после подключения системы клиники.";

function statusLabel(status: string): string {
  if (status === "ready") return "Готов";
  if (status === "ready_for_server_deploy") return "Готов к установке";
  if (status === "degraded") return "Снижена готовность";
  if (status === "warning") return "Требует внимания";
  if (status === "failed") return "Ошибка";
  if (status === "connected") return "Подключено";
  if (status === "configured") return "Настроено";
  if (status === "missing") return "Не настроено";
  if (status === "unavailable") return "Недоступно";
  if (status === "pending") return "Ожидает";
  if (status === "unknown") return "Нет данных";
  return "Неизвестно";
}

function systemTermLabel(value: string): string {
  const labels: Record<string, string> = {
    postgres: "База данных",
    "jwt-signing-key": "Ключ подписи",
    "object-storage": "Файлы клиники",
    "PostgreSQL connectivity": "Связь с базой данных",
    "PostgreSQL connection verified": "Связь с базой данных проверена",
    "PostgreSQL persistence": "Хранение в базе данных",
    "Migration bundle": "Пакет обновлений",
    "Self-hosted PostgreSQL migration bundle is present": "Пакет обновлений базы найден",
    "Backup dry-run": "План резервной копии",
    "Backup after deploy": "Резервная копия после обновления",
    "Deploy smoke dry-run": "Проверка развёртывания",
    "Post-deploy verification": "Проверка после обновления",
    "Rollback drill": "Проверка отката",
    "Restore dry-run": "Пробная проверка восстановления",
    "Audit export dry-run": "План экспорта аудита",
    "Plan backup": "Проверить план резервной копии",
    "Plan smoke": "Проверить план развёртывания",
    "Plan restore": "Проверить план восстановления",
    "Plan audit export": "Проверить план экспорта аудита",
    "Full deterministic preflight": "Полная предварительная проверка",
    "Self-hosted compose smoke": "Проверка состава системы",
    "React frontend": "Интерфейс продукта",
    "Node self-hosted API": "Рабочая система",
    "Self-hosted object storage": "Файлы клиники",
    "Object storage runtime": "Файлы клиники",
    "Device Bridge worker operations": "Связь с приборами",
    "Clinical patient/visit/asset workflows": "Клинические рабочие процессы",
    "Server operations": "Операции сервера",
    "dist build": "интерфейс собран",
    "self-hosted API clients": "подключение к рабочей системе",
    "system_admin ops UI": "панель системного администратора",
    "/healthz": "проверка доступности",
    "/readyz": "проверка готовности",
    "/api/v1/meta": "служебная справка",
    "/api/v1/product/readiness": "готовность продукта",
    "db/migrations/0001-0013": "пакет обновлений базы",
    "local auth seed": "первичная учётная запись",
    "append-only audit": "неизменяемый журнал",
    "OBJECT_STORAGE_LOCAL_DIR": "локальное хранилище файлов",
    "OBJECT_STORAGE_ENDPOINT": "точка хранения файлов",
    "backend download proxy": "безопасная выдача файлов",
    "patients CRUD": "карты пациентов",
    "visit workspace writes": "записи визитов",
    "asset binary upload/download": "загрузка и скачивание файлов",
    "registry": "реестр",
    "command queue": "очередь команд",
    "worker lifecycle": "состояние обработчика",
    "audit replay/export": "журнал и экспорт",
    "backup/restore dry-runs": "планы копии и восстановления",
    "deploy smoke": "проверка обновления",
    "runtime checks": "проверки среды",
    "observability": "наблюдение",
    "External S3-compatible endpoint configured behind backend proxy": "Файлы клиники настроены через защищённый серверный доступ",
    "Local backend-owned object storage is writable": "Файлы клиники доступны для записи",
    "Local backend-owned object storage is nearly full": "Место для файлов клиники почти заполнено",
    "Local backend-owned object storage is not writable": "Файлы клиники временно недоступны для записи",
    "Plan destructive restore without executing restore": "Показывает план восстановления без запуска восстановления",
    "Prepare metadata-only audit export without PHI and secrets": "Готовит безопасный экспорт журнала без персональных данных и секретов",
    "Планирует резервное копирование PostgreSQL и backend-owned object storage.":
      "Планирует резервную копию базы данных и файлов клиники.",
    "Показывает destructive restore-план без выполнения восстановления.":
      "Показывает план восстановления без запуска восстановления.",
    "Проверяет docker-compose smoke-план до запуска production stack.":
      "Проверяет план обновления перед запуском рабочей системы.",
    "Готовит metadata-only audit export без PHI и секретов.":
      "Готовит безопасный экспорт журнала без персональных данных и секретов.",
    "audit export": "служебный журнал готов",
  };
  return labels[value] ?? "служебная проверка";
}

function systemValueLabel(value: string | undefined): string {
  if (!value) return "нет";
  const labels: Record<string, string> = {
    none: "нет",
    enabled: "включено",
    "path-only": "только путь",
    "append-only": "только добавление",
    "single self-hosted product": "единый продукт клиники",
    "static React build served by nginx": "статическая сборка интерфейса",
    "Node self-hosted API": "рабочая система клиники",
    "operator-owned PostgreSQL": "база данных клиники",
    "operator-owned object storage": "файлы клиники",
    "operator-owned object storage or local filesystem": "файлы клиники",
    "metadata-only operational readiness": "только служебная готовность",
  };
  return labels[value] ?? "служебное значение скрыто";
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
  const [runtimeChecks, setRuntimeChecks] = useState<SelfHostedOpsRuntimeChecks | null>(null);
  const [productReadiness, setProductReadiness] = useState<SelfHostedProductReadiness | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Панель рабочего контура готова.");

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
      setRuntimeChecks(null);
      setProductReadiness(null);
      setStatusMessage("Рабочая сессия не подключена.");
      return;
    }
    setLoading(true);
    const [statusResult, runtimeResult, productResult] = await Promise.all([
      fetchSelfHostedOpsStatus({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      }),
      fetchSelfHostedOpsRuntimeChecks({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      }),
      fetchSelfHostedProductReadiness({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      }),
    ]);
    setLoading(false);
    if (!statusResult.ok || !statusResult.value) {
      setOpsStatus(null);
      setRuntimeChecks(null);
      setProductReadiness(null);
      setError(statusResult.error?.message ?? "Не удалось загрузить состояние рабочего контура.");
      setStatusMessage("Состояние рабочего контура не загружено.");
      return;
    }
    setOpsStatus(statusResult.value);
    if (!runtimeResult.ok || !runtimeResult.value) {
      setRuntimeChecks(null);
      setError(runtimeResult.error?.message ?? "Не удалось загрузить проверки среды.");
      setStatusMessage("Состояние рабочего контура загружено, проверки среды недоступны.");
      return;
    }
    setRuntimeChecks(runtimeResult.value);
    if (!productResult.ok || !productResult.value) {
      setProductReadiness(null);
      setError(productResult.error?.message ?? "Не удалось загрузить готовность продукта.");
      setStatusMessage("Состояние и проверки среды загружены, готовность продукта недоступна.");
      return;
    }
    setProductReadiness(productResult.value);
    setStatusMessage("Состояние, проверки среды и готовность продукта обновлены. Служебный код скрыт.");
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  function downloadAuditPlan() {
    const content = buildStage4OAuditExportPreview(opsStatus);
    downloadText("stage4o-audit-export-preview.md", content);
    setStatusMessage("Предпросмотр экспорта аудита скачан.");
  }

  function downloadOperationsPlan() {
    const content = buildStage4POperationsPreview(runtimeChecks);
    downloadText("stage4p-operations-preview.md", content);
    setStatusMessage("Предпросмотр операционного плана скачан.");
  }

  function downloadProductReadinessPlan() {
    const content = buildStage4ZProductReadinessPreview(productReadiness);
    downloadText("stage4z-product-readiness-preview.md", content);
    setStatusMessage("Предпросмотр готовности продукта скачан.");
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Рабочий контур"
        subtitle="Состояние продукта: рабочая система, база данных, файлы клиники, аудит и сверка событий."
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 gap-1.5 text-[12px]"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
              Обновить
            </Button>
            <Button asChild size="sm" className="min-h-11 gap-1.5 text-[12px]">
              <Link to="/self-hosted/login">
                <ServerCog className="h-3.5 w-3.5" aria-hidden />
                Рабочий вход
              </Link>
            </Button>
          </div>
        }
      />

      <main className="space-y-4 p-4">
        <div
          role="note"
          aria-label="Граница рабочего контура"
          className="surface-toolbar flex items-start gap-2 p-3 text-[12px] text-muted-foreground"
        >
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div>
            <div className="font-medium text-foreground">Граница рабочего контура</div>
            <p>
              Страница читает только служебные проверки продукта. Внешние управляемые среды,
              облачные базы и сторонние функции здесь не используются.
            </p>
          </div>
        </div>

        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Статус рабочего контура"
          className="sr-only"
        >
          {statusMessage}
        </div>

        {!isConfigured ? (
          <section className="surface-card p-4" aria-label="Подключение рабочего контура">
            <div className="mb-2 flex items-center gap-2 text-warning">
              <Lock className="h-4 w-4" aria-hidden />
              <h2 className="h-section">Рабочая сессия не подключена</h2>
            </div>
            <p className="text-meta">
              {DEMO_SYS_BANNER} Для рабочего статуса войдите пользователем с ролью системного администратора.
            </p>
            <Button asChild size="sm" className="mt-3 min-h-11 text-[12px]">
              <Link to="/self-hosted/login">Открыть рабочий вход</Link>
            </Button>
          </section>
        ) : null}

        {isConfigured && !hasSystemAdminRole ? (
          <section className="surface-card p-4" aria-label="Недостаточно прав рабочего контура">
            <div className="mb-2 flex items-center gap-2 text-warning">
              <Lock className="h-4 w-4" aria-hidden />
              <h2 className="h-section">Нужна роль системного администратора</h2>
            </div>
            <p className="text-meta">
              Текущая рабочая сессия не содержит роль системного администратора. Рабочая система
              дополнительно проверит доступ и отклонит запрос без нужной роли.
            </p>
          </section>
        ) : null}

        {error ? (
          <section
            role="alert"
            aria-live="assertive"
          aria-label="Ошибка рабочего контура"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
          >
            {error}
          </section>
        ) : null}

        <section
          className="grid gap-3 md:grid-cols-3 xl:grid-cols-6"
          aria-label="Сводка рабочего контура"
        >
          <MetricTile
            label="Система"
            value={opsStatus ? statusLabel(opsStatus.status) : "Нет сессии"}
            hint={opsStatus?.source ? "рабочая система" : "нет подключения"}
          />
          <MetricTile
            label="Зависимости"
            value={opsStatus ? `${readyDependencies}/${opsStatus.dependencies.length}` : "0/0"}
            hint="настроено и подключено"
          />
          <MetricTile
            label="Код сверки"
            value={opsStatus ? "скрыт" : "ожидает"}
            hint={opsStatus ? "служебный код" : "ожидает запроса"}
          />
          <MetricTile
            label="Аудит"
            value={systemValueLabel(opsStatus?.audit.mode ?? "только добавление")}
            hint="экспорт без лишних данных"
          />
          <MetricTile
            label="Проверки среды"
            value={runtimeChecks ? statusLabel(runtimeChecks.status) : "Ожидает"}
            hint={`проверок: ${runtimeChecks?.checks.length ?? 0}`}
          />
          <MetricTile
            label="Готовность продукта"
            value={productReadiness ? "Готов" : "Ожидает"}
            hint={productReadiness ? statusLabel(productReadiness.status) : "ожидает"}
          />
        </section>

        <section className="surface-card overflow-hidden" aria-label="Готовность продукта">
          <div className="section-bar">
            <div>
              <h2 className="h-section">Готовность продукта</h2>
              <p className="h-section-hint">
                Единая проверка: интерфейс, рабочая система, база данных, файлы клиники и связь с приборами
                разворачиваются как цельный продукт клиники.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={productReadiness ? "default" : "secondary"}>
                {statusLabel(productReadiness?.status ?? "pending")}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 gap-1.5 text-[12px]"
                onClick={downloadProductReadinessPlan}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Скачать готовность
              </Button>
            </div>
          </div>
          <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <StatusLine
                icon={<ServerCog className="h-4 w-4" aria-hidden />}
                label="Управляемая среда"
                value={systemValueLabel(productReadiness?.productBoundary.managedRuntime)}
              />
              <StatusLine
                icon={<Database className="h-4 w-4" aria-hidden />}
                label="Управляемая база"
                value={systemValueLabel(productReadiness?.productBoundary.managedDatabase)}
              />
              <StatusLine
                icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
                label="Связь с внешней средой"
                value={productReadiness?.productBoundary.supabaseRuntimeCoupling ? "есть" : "нет"}
              />
              <StatusLine
                icon={<Lock className="h-4 w-4" aria-hidden />}
                label="Аппаратный доступ браузера"
                value={productReadiness?.productBoundary.browserHardwareApis ? "есть" : "нет"}
              />
            </div>
            <div className="space-y-2">
              {(productReadiness?.gates ?? []).slice(0, 5).map((gate) => (
                <div key={gate.key} className="rounded-md border border-border bg-surface-muted p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{systemTermLabel(gate.label)}</div>
                    <Badge variant={gate.required ? "default" : "secondary"}>
                      {gate.required ? "обязательно" : "дополнительно"}
                    </Badge>
                  </div>
                  <div className="mt-2 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    Служебная команда скрыта с экрана.
                  </div>
                </div>
              ))}
              {!productReadiness ? (
                <div className="rounded-md border border-border bg-surface-muted p-3 text-meta">
                  Готовность продукта появится после подключения рабочей сессии системного администратора.
                </div>
              ) : null}
            </div>
          </div>
          {productReadiness ? (
            <div className="border-t border-border p-4">
              <div className="mb-2 text-[12px] font-medium text-muted-foreground">
                Возможности
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {productReadiness.capabilities.map((capability) => (
                  <div key={capability.key} className="rounded-md border border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-foreground">{systemTermLabel(capability.label)}</div>
                      <Badge variant="secondary">{statusLabel(capability.status)}</Badge>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {capability.evidence.map(systemTermLabel).join(" / ")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="surface-card overflow-hidden" aria-label="Зависимости рабочего контура">
            <div className="section-bar">
              <div>
                <h2 className="h-section">Зависимости готовности</h2>
                <p className="h-section-hint">
                  Проверка рабочей системы, базы данных, ключа подписи и файлов клиники.
                </p>
              </div>
              <Badge variant={opsStatus?.ready ? "default" : "secondary"}>
                {opsStatus?.ready ? "готово" : "не готово"}
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
                      <td className="font-medium text-foreground">{systemTermLabel(dependency.name)}</td>
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
                        Подключите рабочую сессию и обновите статус.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface-card" aria-label="Договор наблюдаемости">
            <div className="section-bar">
              <div>
                <h2 className="h-section">Договор наблюдаемости</h2>
                <p className="h-section-hint">Что рабочая система не раскрывает в интерфейсе и журналах.</p>
              </div>
            </div>
            <div className="space-y-3 p-4 text-[13px]">
              <StatusLine
                icon={<ListChecks className="h-4 w-4" aria-hidden />}
                label="Структурированные журналы"
                value={opsStatus?.observability.structuredJsonLogs ? "включены" : "ожидает статуса"}
              />
              <StatusLine
                icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
                label="Сокрытие лишнего"
                value={systemValueLabel(opsStatus?.observability.redaction)}
              />
              <StatusLine
                icon={<TerminalSquare className="h-4 w-4" aria-hidden />}
                label="Журналирование путей"
                value={systemValueLabel(opsStatus?.observability.requestPathLogging)}
              />
              <StatusLine
                icon={<Database className="h-4 w-4" aria-hidden />}
                label="Проверки среды"
                value={runtimeChecks ? statusLabel(runtimeChecks.status) : "ожидает статуса"}
              />
              <StatusLine
                icon={<FileText className="h-4 w-4" aria-hidden />}
                label="Служебная схема"
                value="служебная схема"
              />
              <div className="rounded-md border border-border bg-surface-muted p-3 text-[12px] text-muted-foreground">
                Не выводим тела запросов, секретные ключи, пароли, ФИО пациентов,
                ключи объектов, пути хранения и сырые значения окружения.
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="surface-card overflow-hidden" aria-label="Проверки рабочей среды">
            <div className="section-bar">
              <div>
                <h2 className="h-section">Проверки рабочей среды</h2>
                <p className="h-section-hint">
                  Служебные проверки базы данных, файлов клиники, обновлений и пакета развёртывания.
                </p>
              </div>
              <Badge variant={runtimeChecks?.ready ? "default" : "secondary"}>
                {runtimeChecks?.ready ? "готово" : statusLabel(runtimeChecks?.status ?? "unknown")}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Проверка</th>
                    <th scope="col">Статус</th>
                    <th scope="col">Деталь</th>
                  </tr>
                </thead>
                <tbody>
                  {(runtimeChecks?.checks ?? []).map((item) => (
                    <tr key={item.key}>
                      <td className="font-medium text-foreground">{systemTermLabel(item.label)}</td>
                      <td>
                        <Badge variant={item.status === "ready" ? "default" : "secondary"}>
                          {statusLabel(item.status)}
                        </Badge>
                      </td>
                      <td className="text-meta">
                        <span>{systemTermLabel(item.detail)}</span>
                        {item.key === "migration_bundle" && item.latest ? (
                          <span className="ml-2 text-[11px]">
                            последняя миграция подтверждена
                          </span>
                        ) : null}
                        {typeof item.usedPercent === "number" ? (
                          <span className="ml-2 font-mono text-[11px]">
                            занято: {item.usedPercent}%
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {!runtimeChecks ? (
                    <tr>
                      <td colSpan={3} className="text-meta">
                        Проверки рабочей среды появятся после подключения рабочей сессии.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="surface-card" aria-label="Планы операций">
            <div className="section-bar">
              <div>
                <h2 className="h-section">Планы операций</h2>
                <p className="h-section-hint">
                  Операции запускает ответственный сотрудник, интерфейс показывает безопасный план.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 gap-1.5 text-[12px]"
                onClick={downloadOperationsPlan}
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Скачать план
              </Button>
            </div>
            <div className="space-y-2 p-4">
              {(runtimeChecks?.commands ?? []).map((command) => (
                <div
                  key={command.key}
                  className="rounded-md border border-border bg-surface-muted p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <PlayCircle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                      <div className="font-medium text-foreground">{systemTermLabel(command.label)}</div>
                    </div>
                    <Badge variant="secondary">план</Badge>
                  </div>
                  <div className="mt-2 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                    Служебная команда скрыта с экрана.
                  </div>
                  <p className="mt-2 text-meta">{systemTermLabel(command.description)}</p>
                </div>
              ))}
              {!runtimeChecks ? (
                <div className="rounded-md border border-border bg-surface-muted p-3 text-meta">
                  Подключите рабочую сессию, чтобы увидеть планы резервного копирования,
                  восстановления, проверки развёртывания и аудита.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <section className="surface-card" aria-label="План экспорта аудита">
          <div className="section-bar">
            <div>
              <h2 className="h-section">План экспорта аудита</h2>
              <p className="h-section-hint">Безопасный план без персональных медицинских данных и секретов.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 gap-1.5 text-[12px]"
              onClick={downloadAuditPlan}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Скачать предпросмотр
            </Button>
          </div>
          <div className="grid gap-3 p-4 lg:grid-cols-[0.75fr_1.25fr]">
            <div className="space-y-2 text-[13px]">
              <div className="font-medium text-foreground">Локальный запуск</div>
              <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground">
                Служебная команда скрыта с экрана.
              </div>
              <p className="text-meta">
                Последнее обновление: {formatDateTime(opsStatus?.generatedAt ?? "")}
              </p>
            </div>
            <pre
              aria-label="Предпросмотр экспорта аудита"
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

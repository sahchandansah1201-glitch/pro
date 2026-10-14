import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  checkAdminClinicIntegration,
  getAdminClinicIntegration,
  updateAdminClinicIntegration,
  type AdminClinicIntegrationDTO,
  type AdminClinicIntegrationStatus,
} from "@/lib/self-hosted-admin-api";

const SOURCE_FIELD_LABEL: Record<string, string> = {
  source: "Источник записи",
  utmSource: "Канал привлечения",
  pipeline: "Этап воронки",
  service: "Услуга",
  price: "Цена",
  clinic: "Клиника",
  patientCode: "Номер пациента в клинике",
  visitId: "Номер визита",
  channel: "Канал связи",
};

const TARGET_FIELD_LABEL: Record<string, string> = {
  SOURCE_ID: "Источник во внешней системе",
  UTM_SOURCE: "Канал во внешней системе",
  pipeline: "Воронка во внешней системе",
  "Услуга": "Название услуги",
  "Цена": "Цена",
  "Подразделение": "Подразделение",
  MRN: "Номер карты",
  EncounterID: "Номер визита",
  chat_type: "Тип диалога",
};

const displaySourceField = (field: string) => SOURCE_FIELD_LABEL[field] ?? "Разрешённое поле";
const displayTargetField = (field: string) => TARGET_FIELD_LABEL[field] ?? "Поле внешней системы";

/**
 * Allowlist безопасных source-полей, которые разрешено показывать в маппинге.
 * Любые иные ключи интерпретируются как чувствительные и не выводятся в UI.
 */
export const ALLOWED_SOURCE_FIELDS = new Set<string>([
  "source",
  "utmSource",
  "pipeline",
  "service",
  "price",
  "clinic",
  "patientCode",
  "visitId",
  // Внешний идентификатор пользователя в мессенджере намеренно исключён:
  // токен такого поля запрещён в админском интерфейсе политикой данных.
  "channel",
]);

const LIVE_STATUS_LABEL: Record<AdminClinicIntegrationStatus, string> = {
  connected: "Подключено",
  draft: "Черновик",
  disabled: "Отключено",
  error: "Ошибка",
};

function AdminIntegrationDetailPageLive() {
  const { id } = useParams();
  const session = useSelfHostedApiSession();
  const [integration, setIntegration] = useState<AdminClinicIntegrationDTO | null>(null);
  const [provider, setProvider] = useState("");
  const [status, setStatus] = useState<AdminClinicIntegrationStatus>("draft");
  const [safeSummaryEnabled, setSafeSummaryEnabled] = useState(true);
  const [protectedLinkEnabled, setProtectedLinkEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    const result = await getAdminClinicIntegration({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      integrationId: id,
    });
    setLoading(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setIntegration(result.value);
    setProvider(result.value?.provider ?? "");
    setStatus(result.value?.status ?? "draft");
    setSafeSummaryEnabled(result.value?.safeSummaryEnabled !== false);
    setProtectedLinkEnabled(result.value?.protectedLinkEnabled !== false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session.apiBaseUrl, session.apiToken]);

  async function save() {
    if (!id || !integration) return;
    if (provider.trim().length < 3) {
      setNote("Укажите название подключения.");
      return;
    }
    setBusy(true);
    const result = await updateAdminClinicIntegration({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      integrationId: id,
      payload: {
        clinicId: integration.clinicId,
        provider: provider.trim(),
        status,
        safeSummaryEnabled,
        protectedLinkEnabled,
        fieldMap: integration.fieldMap,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setIntegration(result.value);
    setNote(`Подключение сохранено: ${result.value?.provider ?? provider}`);
  }

  async function checkConnection() {
    if (!id || !integration) return;
    setBusy(true);
    const result = await checkAdminClinicIntegration({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      integrationId: id,
      payload: { clinicId: integration.clinicId },
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setIntegration(result.value);
    setNote("Проверка подключения выполнена.");
  }

  if (!integration && !loading) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Интеграция не найдена" />
        <div className="p-4">
          <Link to="/admin/integrations" className="inline-flex min-h-11 items-center gap-1 text-[13px] text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> К списку интеграций
          </Link>
          {note && <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">{note}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={integration?.provider || "Интеграция"}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span>{integration?.clinicName || "Клиника"}</span>
            <span>{integration ? LIVE_STATUS_LABEL[integration.status] : "Загрузка"}</span>
            <span>{integration?.lastCheckedAt ? `проверка ${formatDateTime(integration.lastCheckedAt)}` : "ещё не проверялось"}</span>
          </div>
        }
        actions={
          <Link to="/admin/integrations" className="inline-flex min-h-11 items-center">
            <Button size="sm" variant="outline" className="min-h-11 gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> К списку
            </Button>
          </Link>
        }
      />

      <div className="space-y-4 p-3 sm:p-4">
        <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Рабочий режим: здесь сохраняются только правила подключения. Фото, клинические решения и персональные данные не передаются во внешнюю систему.
        </div>

        <Card className="p-3">
          <div className="mb-3">
            <h2 className="text-[14px] font-semibold">Настройки подключения</h2>
            <p className="text-[12px] text-muted-foreground">Изменения сохраняются в рабочей базе клиники.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
            <Input
              aria-label="Название подключения"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="h-11"
            />
            <select
              aria-label="Статус подключения"
              value={status}
              onChange={(event) => setStatus(event.target.value as AdminClinicIntegrationStatus)}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[14px]"
            >
              {Object.entries(LIVE_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <label className="flex min-h-11 items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={safeSummaryEnabled}
                onChange={(event) => setSafeSummaryEnabled(event.target.checked)}
              />
              Безопасное резюме
            </label>
            <label className="flex min-h-11 items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={protectedLinkEnabled}
                onChange={(event) => setProtectedLinkEnabled(event.target.checked)}
              />
              Защищённая ссылка
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" className="min-h-[44px]" onClick={save} disabled={busy || loading}>
              Сохранить подключение
            </Button>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={checkConnection} disabled={busy || loading || !integration}>
              Проверить подключение
            </Button>
          </div>
        </Card>

        <Card className="p-3">
          <h2 className="text-[14px] font-semibold">Разрешённые поля</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {Object.entries(integration?.fieldMap ?? {}).map(([from, to]) => (
              <div key={from} className="rounded-md border border-border px-3 py-2 text-[13px]">
                <div className="font-medium">{displaySourceField(from)}</div>
                <div className="text-[12px] text-muted-foreground">{displayTargetField(to)}</div>
              </div>
            ))}
            {Object.keys(integration?.fieldMap ?? {}).length === 0 && (
              <div className="rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground">Связи полей пока не заданы.</div>
            )}
          </div>
          <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
            Закрыто правилами: идентификаторы пациента, фото, клинические решения и технические детали подсказок.
          </div>
        </Card>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminIntegrationDetailPage() {
  const session = useSelfHostedApiSession();
  return <AdminIntegrationDetailPageLive key={session.revision} />;
}

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getIntegrations } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import type { IntegrationKind, IntegrationStatus } from "@/lib/domain";

const KIND_LABEL: Record<IntegrationKind, string> = {
  crm: "Клиентская база",
  erp: "Учёт",
  mis: "МИС",
  messenger: "Мессенджер",
  telephony: "Телефония",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Подключено",
  draft: "Черновик",
  disabled: "Отключено",
  error: "Ошибка",
};

const providerLabel = (provider: string) => {
  if (provider === "Bitrix24") return "Битрикс24";
  if (provider === "amoCRM") return "Амо";
  if (provider === "1С: Медицина") return "1С: Медицина";
  if (provider === "Telegram Bot API") return "Телеграм";
  if (provider === "Demo MIS") return "Учебная медсистема";
  return provider;
};

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
  // токен такого поля запрещён в admin UI политикой данных MVP.
  "channel",
]);

/** Обобщённые категории, которые в MVP всегда заблокированы политикой данных. */
const LOCKED_CATEGORIES: { label: string }[] = [
  { label: "Идентификаторы пациента" },
  { label: "Фото" },
  { label: "Клиническое решение" },
  { label: "Технические детали подсказки" },
];

const POLICY_ROWS: { key: keyof PolicyView; label: string; allowed: boolean }[] = [
  { key: "sendPhotos", label: "Передавать фото", allowed: false },
  { key: "sendDiagnosis", label: "Передавать клиническое решение", allowed: false },
  { key: "sendAIDetails", label: "Передавать технические детали подсказки", allowed: false },
  { key: "sendPHI", label: "Передавать идентификаторы пациента", allowed: false },
  { key: "sendSafeSummary", label: "Передавать безопасное резюме", allowed: true },
  { key: "sendProtectedLink", label: "Передавать защищённую ссылку", allowed: true },
];

type PolicyView = {
  sendPhotos: boolean;
  sendDiagnosis: boolean;
  sendAIDetails: boolean;
  sendPHI: boolean;
  sendSafeSummary: boolean;
  sendProtectedLink: boolean;
};

export default function AdminIntegrationDetailPage() {
  const { id } = useParams();
  const integration = useMemo(() => getIntegrations().find((i) => i.id === id), [id]);
  const [audit, setAudit] = useState<string[]>([]);

  if (!integration) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Интеграция не найдена" />
        <div className="p-4">
          <Link to="/admin/integrations" className="inline-flex min-h-11 items-center gap-1 text-[13px] text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> К списку интеграций
          </Link>
        </div>
      </div>
    );
  }

  const allowedMappings = Object.entries(integration.fieldMap).filter(([from]) =>
    ALLOWED_SOURCE_FIELDS.has(from),
  );

  const dryRun = {
    provider: integration.provider,
    kind: integration.kind,
    event: "lead.safe_summary.created",
    payload: {
      leadId: "ld-demo",
      source: "bot",
      safeSummary: "Предварительная рекомендация: требуется очная оценка врача.",
      protectedAnalysisUrl: "/analysis/pal-tok-demo",
      clinicRouting: "partner_clinic",
    },
    blockedByPolicy: [
      "patient_identifiers",
      "photos",
      "clinical_decision",
      "ai_xai_details",
    ],
  };

  const log = (msg: string) => setAudit((a) => [`Только что · ${msg}`, ...a].slice(0, 5));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={providerLabel(integration.provider)}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            <span>{KIND_LABEL[integration.kind]}</span>
            <span>{STATUS_LABEL[integration.status]}</span>
            <span>
              {integration.lastSyncAt ? `синхронизация ${formatDateTime(integration.lastSyncAt)}` : "нет синхронизации"}
            </span>
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

      <div className="space-y-4 p-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--warning) / 0.08)",
            borderColor: "hsl(var(--warning) / 0.30)",
            color: "hsl(var(--warning))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Учебный режим: внешняя система получает только безопасное резюме и защищённую ссылку. Врачебные материалы не смешиваются с карточкой обращения.</span>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Field mapping */}
          <Card className="p-4">
            <div className="mb-2 text-[13px] font-semibold">Связь полей</div>
            <div className="text-[12px] text-muted-foreground">что передаём → как это называется во внешней системе</div>
            <div className="mt-3 divide-y divide-border rounded-md border border-border">
              {allowedMappings.map(([from, to]) => (
                <div
                  key={from}
                  className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 px-3 py-2 text-[13px]"
                >
                  <span>{displaySourceField(from)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span>{displayTargetField(to)}</span>
                  <span className="text-[11px] text-muted-foreground">разрешено</span>
                </div>
              ))}
              {allowedMappings.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-muted-foreground">
                  Нет разрешённых связей полей в этой интеграции.
                </div>
              )}
              {/* Always-locked generic categories */}
              {LOCKED_CATEGORIES.map((cat) => (
                <div
                  key={cat.label}
                  className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 px-3 py-2 text-[13px] opacity-70"
                >
                  <span className="text-muted-foreground line-through">{cat.label}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-muted-foreground">—</span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                    title="Закрыто правилами передачи данных"
                  >
                    <Lock className="h-3 w-3" /> закрыто
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Data Policy */}
          <Card className="p-4">
            <div className="mb-3 text-[13px] font-semibold">Правила передачи данных</div>
            <ul className="space-y-2">
              {POLICY_ROWS.map((row) => {
                const value = integration.dataPolicy[row.key];
                return (
                  <li
                    key={row.key}
                    className={`flex items-center justify-between rounded-md border border-border px-3 py-2 text-[13px] ${
                      row.allowed ? "" : "opacity-70"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {!row.allowed && <Lock className="h-3 w-3 text-muted-foreground" />}
                      {row.label}
                    </span>
                    <span className={`text-[12px] ${value ? "text-success" : "text-muted-foreground"}`}>
                      {row.allowed
                        ? value
                          ? "разрешено"
                          : "выключено"
                        : "Закрыто правилами передачи данных"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        {/* Safe local transfer preview */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-semibold">Пробная проверка передачи</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => log("Связь полей проверена локально")}>
                Проверить связь полей
              </Button>
              <Button size="sm" variant="outline" className="min-h-11" onClick={() => log("Пробный пакет сформирован локально")}>
                Сформировать пробный пакет
              </Button>
              <Button size="sm" variant="outline" className="min-h-11" disabled title="Учебный режим: копирование отключено">
                Копирование отключено
              </Button>
            </div>
          </div>
          <div className="mt-2 text-[12px] text-muted-foreground">
            Это локальная проверка. Данные не отправляются во внешнюю систему.
          </div>
          <div className="mt-3 grid gap-3 rounded-md border border-border bg-muted/30 p-3 text-[12px] sm:grid-cols-3">
            <div>
              <div className="font-medium text-foreground">Событие</div>
              <div className="mt-1 text-muted-foreground">Создано безопасное резюме обращения</div>
            </div>
            <div>
              <div className="font-medium text-foreground">Разрешено</div>
              <div className="mt-1 text-muted-foreground">Источник, краткое резюме, защищённая ссылка, клиника</div>
            </div>
            <div>
              <div className="font-medium text-foreground">Закрыто</div>
              <div className="mt-1 text-muted-foreground">
                {dryRun.blockedByPolicy.length} категории: пациентские данные, фото, клиническое решение и технические детали подсказки
              </div>
            </div>
          </div>
          {audit.length > 0 && (
            <div className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
              {audit.map((a, i) => (
                <div key={i}>{a}</div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

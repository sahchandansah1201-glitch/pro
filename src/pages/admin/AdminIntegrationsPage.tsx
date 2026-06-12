import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { getIntegrations } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import type { IntegrationKind, IntegrationStatus } from "@/lib/domain";

const KIND_FILTERS: { value: "all" | IntegrationKind; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "crm", label: "Клиентская база" },
  { value: "erp", label: "Учёт" },
  { value: "mis", label: "Учётная система" },
  { value: "messenger", label: "Мессенджеры" },
  { value: "telephony", label: "Телефония" },
];

const STATUS_FILTERS: { value: "all" | IntegrationStatus; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "connected", label: "Подключено" },
  { value: "draft", label: "Черновик" },
  { value: "disabled", label: "Отключено" },
  { value: "error", label: "Ошибка" },
];

const KIND_LABEL: Record<IntegrationKind, string> = {
  crm: "Клиентская база",
  erp: "Учёт",
  mis: "Учётная система",
  messenger: "Мессенджер",
  telephony: "Телефония",
};

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Подключено",
  draft: "Черновик",
  disabled: "Отключено",
  error: "Ошибка",
};

const STATUS_DOT: Record<IntegrationStatus, string> = {
  connected: "bg-success",
  draft: "bg-muted-foreground",
  disabled: "bg-muted-foreground/60",
  error: "bg-destructive",
};

const providerLabel = (provider: string) => {
  if (provider === "Bitrix24") return "Битрикс24";
  if (provider === "amoCRM") return "Амо";
  if (provider === "1С: Медицина") return "1С: Медицина";
  if (provider === "Telegram Bot API") return "Телеграм";
  if (provider === "Demo MIS") return "Учебная система клиники";
  return provider;
};

export default function AdminIntegrationsPage() {
  const integrations = getIntegrations();
  const [kind, setKind] = useState<"all" | IntegrationKind>("all");
  const [status, setStatus] = useState<"all" | IntegrationStatus>("all");

  const filtered = useMemo(() => {
    return integrations.filter((i) => {
      if (kind !== "all" && i.kind !== kind) return false;
      if (status !== "all" && i.status !== status) return false;
      return true;
    });
  }, [integrations, kind, status]);

  const kpi = useMemo(() => {
    const total = integrations.length;
    const connected = integrations.filter((i) => i.status === "connected").length;
    const draft = integrations.filter((i) => i.status === "draft").length;
    const off = integrations.filter((i) => i.status === "disabled" || i.status === "error").length;
    return { total, connected, draft, off };
  }, [integrations]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Интеграции"
        subtitle={
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span>Клиентская база</span>
            <span>учёт</span>
            <span>учётная система</span>
            <span>мессенджеры</span>
            <span>телефония</span>
          </span>
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
          <span>Учебный режим: внешние системы не получают фото, клинические выводы и персональные данные.</span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Всего" value={kpi.total} />
          <KpiCard label="Подключено" value={kpi.connected} />
          <KpiCard label="Черновики" value={kpi.draft} />
          <KpiCard label="Откл./ошибка" value={kpi.off} />
        </div>

        <div className="flex flex-wrap gap-3">
          <FilterGroup label="Тип">
            {KIND_FILTERS.map((f) => (
              <FilterBtn key={f.value} active={kind === f.value} onClick={() => setKind(f.value)}>
                {f.label}
              </FilterBtn>
            ))}
          </FilterGroup>
          <FilterGroup label="Статус">
            {STATUS_FILTERS.map((f) => (
              <FilterBtn key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>
                {f.label}
              </FilterBtn>
            ))}
          </FilterGroup>
        </div>

        {/* Desktop table */}
        <Card className="hidden overflow-hidden md:block">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Провайдер</th>
                <th className="px-3 py-2 font-medium">Тип</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium">Последняя синхронизация</th>
                <th className="px-3 py-2 font-medium">Передача данных</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{providerLabel(i.provider)}</td>
                  <td className="px-3 py-2">{KIND_LABEL[i.kind]}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${STATUS_DOT[i.status]}`} />
                      {STATUS_LABEL[i.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {i.lastSyncAt ? formatDateTime(i.lastSyncAt) : "нет синхронизации"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">Краткое резюме и защищённая ссылка</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/admin/integrations/crm/${i.id}`} className="inline-flex min-h-11 items-center">
                      <Button size="sm" variant="outline" className="min-h-11">Открыть</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Ничего не найдено.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        {/* Mobile cards */}
        <div className="space-y-2 md:hidden">
          {filtered.map((i) => (
            <Card key={i.id} className="p-3 text-[13px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{providerLabel(i.provider)}</div>
                  <div className="text-[12px] text-muted-foreground">{KIND_LABEL[i.kind]}</div>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[12px]">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[i.status]}`} />
                  {STATUS_LABEL[i.status]}
                </span>
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground">
                {i.lastSyncAt ? formatDateTime(i.lastSyncAt) : "нет синхронизации"}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">Краткое резюме и защищённая ссылка</div>
              <div className="mt-3">
                <Link to={`/admin/integrations/crm/${i.id}`} className="block min-h-11">
                  <Button size="sm" variant="outline" className="min-h-11 w-full">Открыть</Button>
                </Link>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="p-6 text-center text-muted-foreground">Ничего не найдено.</Card>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-11 rounded-md border px-2.5 py-1 text-[12px] transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

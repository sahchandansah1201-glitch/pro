import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  createAdminClinicIntegration,
  listAdminClinicIntegrations,
  listAdminClinics,
  type AdminClinicDTO,
  type AdminClinicIntegrationDTO,
  type AdminClinicIntegrationKind,
  type AdminClinicIntegrationStatus,
} from "@/lib/self-hosted-admin-api";

type LiveIntegrationForm = {
  clinicId: string;
  provider: string;
  kind: AdminClinicIntegrationKind;
};

const EMPTY_LIVE_FORM: LiveIntegrationForm = {
  clinicId: "",
  provider: "",
  kind: "crm",
};

const LIVE_KIND_LABEL: Record<AdminClinicIntegrationKind, string> = {
  crm: "Клиентская база",
  erp: "Учёт",
  mis: "Учётная система",
  messenger: "Мессенджер",
  telephony: "Телефония",
};

const LIVE_STATUS_LABEL: Record<AdminClinicIntegrationStatus, string> = {
  connected: "Подключено",
  draft: "Черновик",
  disabled: "Отключено",
  error: "Ошибка",
};

function AdminIntegrationsPageLive() {
  const session = useSelfHostedApiSession();
  const [integrations, setIntegrations] = useState<AdminClinicIntegrationDTO[]>([]);
  const [clinics, setClinics] = useState<AdminClinicDTO[]>([]);
  const [form, setForm] = useState<LiveIntegrationForm>(EMPTY_LIVE_FORM);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lastChangedId, setLastChangedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [integrationsResult, clinicsResult] = await Promise.all([
      listAdminClinicIntegrations({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
      listAdminClinics({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
    ]);
    setLoading(false);
    if (integrationsResult.ok) setIntegrations(integrationsResult.value ?? []);
    else setNote(adminApiErrorText(integrationsResult.error));
    if (clinicsResult.ok) {
      const nextClinics = clinicsResult.value ?? [];
      setClinics(nextClinics);
      setForm((current) => ({ ...current, clinicId: current.clinicId || nextClinics[0]?.id || "" }));
    } else {
      setNote(adminApiErrorText(clinicsResult.error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  const kpi = useMemo(() => {
    const connected = integrations.filter((item) => item.status === "connected").length;
    const draft = integrations.filter((item) => item.status === "draft").length;
    const off = integrations.filter((item) => item.status === "disabled" || item.status === "error").length;
    return { total: integrations.length, connected, draft, off };
  }, [integrations]);

  async function submitIntegration() {
    if (!form.clinicId) {
      setNote("Выберите клинику для подключения.");
      return;
    }
    if (form.provider.trim().length < 3) {
      setNote("Укажите название подключения.");
      return;
    }
    setBusy(true);
    const result = await createAdminClinicIntegration({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: {
        clinicId: form.clinicId,
        provider: form.provider.trim(),
        kind: form.kind,
        status: "draft",
        safeSummaryEnabled: true,
        protectedLinkEnabled: true,
        fieldMap: {
          source: "Источник обращения",
          service: "Услуга",
          clinic: "Клиника",
          channel: "Канал связи",
        },
      },
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    if (result.value) {
      setLastChangedId(result.value.id);
      setIntegrations((current) => [result.value!, ...current.filter((item) => item.id !== result.value!.id)]);
    }
    setNote(`Подключение создано: ${result.value?.provider ?? form.provider}`);
    setForm((current) => ({ ...EMPTY_LIVE_FORM, clinicId: current.clinicId || clinics[0]?.id || "" }));
    await load();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Интеграции" subtitle="Подключения клиники к учёту, мессенджерам и телефонии." />
      <div className="space-y-3 p-3 sm:p-4">
        <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Рабочий режим: подключения сохраняются в базе клиники. Передача фото, клинических решений и персональных данных закрыта правилами.
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard label="Всего" value={kpi.total} />
          <KpiCard label="Подключено" value={kpi.connected} />
          <KpiCard label="Черновики" value={kpi.draft} />
          <KpiCard label="Откл./ошибка" value={kpi.off} />
        </div>

        <Card className="p-3">
          <div className="mb-3">
            <h2 className="text-[14px] font-semibold">Создать подключение</h2>
            <p className="text-[12px] text-muted-foreground">Начните с названия внешней системы и клиники. Настройки проверяются на следующем экране.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
            <Input
              aria-label="Название подключения"
              placeholder="Название подключения"
              value={form.provider}
              onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
              className="h-11"
            />
            <select
              aria-label="Клиника подключения"
              value={form.clinicId}
              onChange={(event) => setForm((current) => ({ ...current, clinicId: event.target.value }))}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[14px]"
            >
              {clinics.length === 0 && <option value="">Клиника не выбрана</option>}
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Тип подключения"
              value={form.kind}
              onChange={(event) => setForm((current) => ({ ...current, kind: event.target.value as AdminClinicIntegrationKind }))}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[14px]"
            >
              {Object.entries(LIVE_KIND_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button type="button" className="min-h-[44px]" onClick={submitIntegration} disabled={busy || loading}>
              Создать подключение
            </Button>
          </div>
        </Card>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        <Card className="hidden overflow-hidden md:block">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Подключение</th>
                <th className="px-3 py-2 font-medium">Клиника</th>
                <th className="px-3 py-2 font-medium">Тип</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium">Проверка</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {integrations.map((item) => (
                <tr key={item.id} className={`border-t border-border ${lastChangedId === item.id ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2 font-medium">{item.provider}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.clinicName}</td>
                  <td className="px-3 py-2">{LIVE_KIND_LABEL[item.kind]}</td>
                  <td className="px-3 py-2">{LIVE_STATUS_LABEL[item.status]}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.lastCheckedAt ? formatDateTime(item.lastCheckedAt) : "не проверялось"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link to={`/admin/integrations/crm/${item.id}`} className="inline-flex min-h-11 items-center">
                      <Button size="sm" variant="outline" className="min-h-11 sm:min-h-[32px]">Открыть</Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {integrations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Создайте первое подключение.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <div className="space-y-2 md:hidden">
          {integrations.map((item) => (
            <Card key={item.id} className={`p-3 text-[13px] ${lastChangedId === item.id ? "border-primary/50" : ""}`}>
              <div className="font-medium">{item.provider}</div>
              <div className="text-[12px] text-muted-foreground">{item.clinicName} · {LIVE_KIND_LABEL[item.kind]}</div>
              <div className="mt-2 text-[12px]">{LIVE_STATUS_LABEL[item.status]}</div>
              <div className="mt-3">
                <Link to={`/admin/integrations/crm/${item.id}`} className="block min-h-11">
                  <Button size="sm" variant="outline" className="min-h-11 w-full">Открыть</Button>
                </Link>
              </div>
            </Card>
          ))}
          {integrations.length === 0 && <Card className="p-6 text-center text-muted-foreground">Создайте первое подключение.</Card>}
        </div>
      </div>
    </div>
  );
}

export default function AdminIntegrationsPage() {
  const session = useSelfHostedApiSession();
  return <AdminIntegrationsPageLive key={session.revision} />;
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

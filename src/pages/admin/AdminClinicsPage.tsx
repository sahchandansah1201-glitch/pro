import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListPagination } from "@/components/admin/ListPagination";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { AdminMetric, AdminOpsCard } from "@/components/admin/AdminOpsCard";
import { useListPagination } from "@/lib/use-list-pagination";
import { getAppointments, getClinics, getIntegrations, getLeads } from "@/lib/mock-data";
import type { PartnerTier } from "@/lib/domain";
import { isProductionAppMode } from "@/lib/app-mode";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  createAdminClinic,
  createAdminPrivatePractice,
  deleteAdminClinic,
  listAdminClinics,
  setAdminClinicStatus,
  updateAdminClinic,
  type AdminClinicStatus,
  type AdminClinicDTO,
} from "@/lib/self-hosted-admin-api";

/**
 * Admin Clinics — клиники и филиалы.
 *
 * SAFETY:
 *   - Используются операционные данные клиники: имя, адрес, тариф,
 *     приоритет маршрутизации, агрегаты заявок и записей. Пациент-уровневые
 *     поля не импортируются. Телефон клиники не отображаем — оставлено
 *     для этапа редактирования контактов в системе клиники.
 *   - Никаких сетевых вызовов, clipboard, storage, медиа.
 */

const DEMO_NOTICE =
  "Учебный режим: показаны только операционные настройки филиалов. Персональные данные, фото и медицинские выводы скрыты.";

const PARTNER_TIER_LABEL: Record<PartnerTier, string> = {
  owned: "Своя",
  partner: "Партнёр",
  external: "Внешняя",
};

type FilterKey = "all" | "owned" | "partner" | "external";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "owned", label: "Свои" },
  { key: "partner", label: "Партнёрские" },
  { key: "external", label: "Внешние" },
];

type SortKey = "priority" | "conversion";

const SORT_OPTIONS: {
  key: SortKey;
  label: string;
  hint: string;
  Icon: typeof ArrowUpNarrowWide;
}[] = [
  {
    key: "priority",
    label: "По приоритету",
    hint: "сначала клиники с меньшим номером маршрутинга",
    Icon: ArrowUpNarrowWide,
  },
  {
    key: "conversion",
    label: "По конверсии",
    hint: "сначала клиники с лучшим отношением записей к заявкам",
    Icon: ArrowDownWideNarrow,
  },
];

const isSortKey = (v: string | null): v is SortKey =>
  v === "priority" || v === "conversion";

// Детерминированная учебная готовность инфраструктуры по клинике.
const READINESS: Record<
  string,
  { integration: "ready" | "partial" | "missing"; bridge: "ready" | "partial" | "missing" }
> = {
  "clinic-demo-001": { integration: "ready", bridge: "ready" },
  "clinic-demo-002": { integration: "partial", bridge: "partial" },
  "clinic-private-007": { integration: "partial", bridge: "missing" },
};

const READINESS_LABEL = {
  ready: "Готово",
  partial: "Частично",
  missing: "Нет",
} as const;

const READINESS_TONE = {
  ready: "hsl(var(--success))",
  partial: "hsl(var(--warning))",
  missing: "hsl(var(--destructive))",
} as const;

const TIMEZONE_OPTIONS = [
  { value: "Europe/Kaliningrad", label: "Калининград · UTC+2" },
  { value: "Europe/Moscow", label: "Москва, Краснодар · UTC+3" },
  { value: "Europe/Samara", label: "Самара · UTC+4" },
  { value: "Asia/Yekaterinburg", label: "Екатеринбург · UTC+5" },
  { value: "Asia/Omsk", label: "Омск · UTC+6" },
  { value: "Asia/Krasnoyarsk", label: "Красноярск · UTC+7" },
  { value: "Asia/Irkutsk", label: "Иркутск · UTC+8" },
  { value: "Asia/Yakutsk", label: "Якутск · UTC+9" },
  { value: "Asia/Vladivostok", label: "Владивосток · UTC+10" },
  { value: "Asia/Magadan", label: "Магадан · UTC+11" },
  { value: "Asia/Kamchatka", label: "Камчатка · UTC+12" },
] as const;

function timezoneLabel(value: string) {
  return TIMEZONE_OPTIONS.find((item) => item.value === value)?.label ?? "Часовой пояс не указан";
}

const CLINIC_STATUS_LABEL: Record<AdminClinicStatus, string> = {
  active: "Работает",
  suspended: "Приостановлена",
  archived: "Архив",
};

const CLINIC_STATUS_CLASS: Record<AdminClinicStatus, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  suspended: "border-amber-200 bg-amber-50 text-amber-800",
  archived: "border-slate-200 bg-slate-50 text-slate-600",
};

function clinicLinkedCount(clinic: AdminClinicDTO): number {
  return (clinic.usersCount ?? 0) + (clinic.patientsCount ?? 0) + (clinic.visitsCount ?? 0);
}

function TimezoneSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <Select value={value || "Europe/Moscow"} onValueChange={onChange}>
      <SelectTrigger aria-label={label} className="min-h-11 text-left">
        <SelectValue placeholder="Выберите часовой пояс" />
      </SelectTrigger>
      <SelectContent>
        {TIMEZONE_OPTIONS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AdminClinicsPageLive() {
  const session = useSelfHostedApiSession();
  const [clinics, setClinics] = useState<AdminClinicDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [lastChangedClinicId, setLastChangedClinicId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", address: "", timezone: "Europe/Moscow" });
  const [editForm, setEditForm] = useState<{ id: string; name: string; address: string; timezone: string } | null>(null);
  const [privateForm, setPrivateForm] = useState({
    clinicName: "",
    address: "",
    timezone: "Europe/Moscow",
    ownerDisplayName: "",
    ownerEmail: "",
    ownerPassword: "",
  });

  async function load() {
    setLoading(true);
    const result = await listAdminClinics({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken });
    setLoading(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setClinics(result.value ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  async function submitClinic() {
    if (!form.name.trim() || !form.address.trim()) {
      setNote("Укажите название и адрес клиники.");
      return;
    }
    setBusy(true);
    const result = await createAdminClinic({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: form,
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    if (result.value) {
      setLastChangedClinicId(result.value.id);
      setClinics((current) => [result.value!, ...current.filter((clinic) => clinic.id !== result.value!.id)]);
    }
    setNote(`Клиника сохранена и добавлена в список: ${result.value?.name ?? form.name}`);
    setForm({ name: "", address: "", timezone: "Europe/Moscow" });
    await load();
  }

  async function submitPrivatePractice() {
    const validationMessages = [
      !privateForm.clinicName.trim() ? "Укажите название частного кабинета." : null,
      !privateForm.address.trim() ? "Укажите адрес частного кабинета." : null,
      !privateForm.ownerDisplayName.trim() ? "Укажите имя владельца кабинета." : null,
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(privateForm.ownerEmail.trim()) ? "Укажите рабочую почту владельца." : null,
      privateForm.ownerPassword.length < 10 ? "Пароль должен быть не короче 10 символов." : null,
    ].filter(Boolean);

    if (validationMessages.length) {
      setNote(validationMessages.join(" "));
      return;
    }
    setBusy(true);
    const result = await createAdminPrivatePractice({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: privateForm,
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setNote(
      `Кабинет создан: ${result.value?.clinic.name ?? privateForm.clinicName}. Владелец получил доступ администратора и частного врача.`,
    );
    if (result.value?.clinic) {
      setLastChangedClinicId(result.value.clinic.id);
      setClinics((current) => [result.value!.clinic, ...current.filter((clinic) => clinic.id !== result.value!.clinic.id)]);
    }
    setPrivateForm({
      clinicName: "",
      address: "",
      timezone: "Europe/Moscow",
      ownerDisplayName: "",
      ownerEmail: "",
      ownerPassword: "",
    });
    await load();
  }

  async function submitClinicEdit() {
    if (!editForm) return;
    if (!editForm.name.trim() || !editForm.address.trim()) {
      setNote("Укажите название и адрес клиники.");
      return;
    }
    setBusy(true);
    const result = await updateAdminClinic({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      clinicId: editForm.id,
      payload: {
        name: editForm.name,
        address: editForm.address,
        timezone: editForm.timezone,
      },
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    if (result.value) {
      setLastChangedClinicId(result.value.id);
      setClinics((current) => current.map((clinic) => (clinic.id === result.value!.id ? { ...clinic, ...result.value! } : clinic)));
    }
    setNote(`Изменения сохранены: ${result.value?.name ?? editForm.name}`);
    setEditForm(null);
    await load();
  }

  async function changeClinicStatus(clinic: AdminClinicDTO, status: AdminClinicStatus) {
    setBusy(true);
    const result = await setAdminClinicStatus({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      clinicId: clinic.id,
      payload: { status, reason: status === "active" ? null : "Решение администратора Dermatolog Pro" },
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    if (result.value) {
      setLastChangedClinicId(result.value.id);
      setClinics((current) => current.map((item) => (item.id === result.value!.id ? { ...item, ...result.value! } : item)));
    }
    setDeleteConfirmId(null);
    setNote(`Статус обновлён: ${result.value?.name ?? clinic.name} · ${CLINIC_STATUS_LABEL[status]}`);
    await load();
  }

  async function deleteClinicIfEmpty(clinic: AdminClinicDTO) {
    if (deleteConfirmId !== clinic.id) {
      setDeleteConfirmId(clinic.id);
      setNote(`Подтвердите удаление пустой записи: ${clinic.name}. Рабочие клиники с данными удалять нельзя.`);
      return;
    }
    setBusy(true);
    const result = await deleteAdminClinic({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      clinicId: clinic.id,
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    if (!result.value?.deleted) {
      setNote("Клиника не удалена: есть связанные сотрудники, пациенты, визиты, снимки или отчёты.");
      return;
    }
    setClinics((current) => current.filter((item) => item.id !== clinic.id));
    setDeleteConfirmId(null);
    setNote(`Пустая запись удалена: ${clinic.name}`);
  }

  const totals = clinics.reduce(
    (acc, clinic) => ({
      users: acc.users + (clinic.usersCount ?? 0),
      patients: acc.patients + (clinic.patientsCount ?? 0),
      visits: acc.visits + (clinic.visitsCount ?? 0),
    }),
    { users: 0, patients: 0, visits: 0 },
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Клиники и кабинеты" subtitle="Рабочая регистрация клиник, частных кабинетов и области доступа." />
      <div className="space-y-3 p-3 sm:p-4">
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Рабочий режим: сначала создайте клинику или частный кабинет, затем назначайте сотрудников и роли.
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <AdminOpsCard title="Клиники" hint="зарегистрированы в рабочей базе">
            <AdminMetric label="Всего" value={clinics.length} tone="info" />
          </AdminOpsCard>
          <AdminOpsCard title="Сотрудники" hint="назначены на клиники и кабинеты">
            <AdminMetric label="Активные связи" value={totals.users} tone="success" />
          </AdminOpsCard>
          <AdminOpsCard title="Пациенты" hint="агрегат без персональных строк">
            <AdminMetric label="В клиниках" value={totals.patients} />
          </AdminOpsCard>
          <AdminOpsCard title="Визиты" hint="рабочие записи">
            <AdminMetric label="Всего" value={totals.visits} />
          </AdminOpsCard>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Card className="p-3">
            <div className="mb-1 text-[13px] font-semibold">Создать клинику</div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Для медицинского центра, сети или филиала. Сотрудников назначайте следующим шагом.
            </p>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1.2fr_0.9fr]">
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Название клиники"
                aria-label="Название клиники"
                className="min-h-11"
              />
              <Input
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Адрес клиники"
                aria-label="Адрес клиники"
                className="min-h-11"
              />
              <TimezoneSelect
                value={form.timezone}
                onChange={(timezone) => setForm((current) => ({ ...current, timezone }))}
                label="Часовой пояс клиники"
              />
            </div>
            <Button type="button" className="mt-3 min-h-11" onClick={submitClinic} disabled={busy}>
              Создать клинику
            </Button>
          </Card>

          <Card className="p-3">
            <div className="mb-1 text-[13px] font-semibold">Создать частный кабинет</div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Для одного врача-владельца. Он сразу получит доступ администратора кабинета и частного врача.
            </p>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <Input
                value={privateForm.clinicName}
                onChange={(event) => setPrivateForm((current) => ({ ...current, clinicName: event.target.value }))}
                placeholder="Название кабинета"
                aria-label="Название кабинета"
                className="min-h-11"
              />
              <Input
                value={privateForm.address}
                onChange={(event) => setPrivateForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Адрес кабинета"
                aria-label="Адрес кабинета"
                className="min-h-11"
              />
              <Input
                value={privateForm.ownerDisplayName}
                onChange={(event) => setPrivateForm((current) => ({ ...current, ownerDisplayName: event.target.value }))}
                placeholder="ФИО владельца"
                aria-label="ФИО владельца кабинета"
                className="min-h-11"
              />
              <Input
                value={privateForm.ownerEmail}
                onChange={(event) => setPrivateForm((current) => ({ ...current, ownerEmail: event.target.value }))}
                placeholder="Эл. почта владельца"
                aria-label="Эл. почта владельца кабинета"
                className="min-h-11"
              />
              <Input
                value={privateForm.ownerPassword}
                onChange={(event) => setPrivateForm((current) => ({ ...current, ownerPassword: event.target.value }))}
                placeholder="Временный пароль"
                aria-label="Временный пароль владельца кабинета"
                type="password"
                className="min-h-11"
              />
              <TimezoneSelect
                value={privateForm.timezone}
                onChange={(timezone) => setPrivateForm((current) => ({ ...current, timezone }))}
                label="Часовой пояс кабинета"
              />
            </div>
            <Button type="button" className="mt-3 min-h-11" onClick={submitPrivatePractice} disabled={busy}>
              Создать кабинет и владельца
            </Button>
          </Card>
        </div>

        {editForm && (
          <Card role="region" aria-label="Редактирование клиники" className="border-primary/30 bg-primary/5 p-3">
            <div className="mb-1 text-[13px] font-semibold">Редактировать клинику</div>
            <p className="mb-3 text-[12px] text-muted-foreground">
              Изменения сохраняются в рабочей базе и сразу обновляют список клиник.
            </p>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1.2fr_0.9fr]">
              <Input
                value={editForm.name}
                onChange={(event) => setEditForm((current) => (current ? { ...current, name: event.target.value } : current))}
                placeholder="Название клиники"
                aria-label="Название редактируемой клиники"
                className="min-h-11"
              />
              <Input
                value={editForm.address}
                onChange={(event) => setEditForm((current) => (current ? { ...current, address: event.target.value } : current))}
                placeholder="Адрес клиники"
                aria-label="Адрес редактируемой клиники"
                className="min-h-11"
              />
              <TimezoneSelect
                value={editForm.timezone}
                onChange={(timezone) => setEditForm((current) => (current ? { ...current, timezone } : current))}
                label="Часовой пояс редактируемой клиники"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" className="min-h-11" onClick={submitClinicEdit} disabled={busy}>
                Сохранить изменения
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditForm(null)} disabled={busy}>
                Отменить
              </Button>
            </div>
          </Card>
        )}

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-3 py-2 text-[12px] font-medium">
            {loading ? "Загрузка клиник" : `В списке: ${clinics.length}`}
          </div>
          <div className="grid grid-cols-1 divide-y divide-border">
            {clinics.map((clinic) => (
              <div
                key={clinic.id}
                className={`grid grid-cols-1 gap-2 p-3 lg:grid-cols-[1.2fr_1.2fr_0.8fr_0.7fr_0.7fr_0.7fr_auto] ${
                  clinic.id === lastChangedClinicId ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
                }`}
              >
                <div>
                  <div className="text-[13px] font-semibold">{clinic.name}</div>
                  <div className="text-[11px] text-muted-foreground">служебный код скрыт</div>
                </div>
                <div className="text-[12px] text-muted-foreground">адрес: {clinic.address || "не указан"}</div>
                <div className="text-[12px] text-muted-foreground">{timezoneLabel(clinic.timezone)}</div>
                <div className="text-[12px] text-muted-foreground">пользователей: {clinic.usersCount ?? 0}</div>
                <div className="text-[12px] text-muted-foreground">визитов: {clinic.visitsCount ?? 0}</div>
                <div className="text-[12px]">
                  <span className={`rounded-full border px-2 py-1 text-[11px] ${CLINIC_STATUS_CLASS[clinic.status]}`}>
                    {CLINIC_STATUS_LABEL[clinic.status]}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 justify-self-start"
                  onClick={() =>
                    setEditForm({
                      id: clinic.id,
                      name: clinic.name,
                      address: clinic.address || "",
                      timezone: clinic.timezone || "Europe/Moscow",
                    })
                  }
                >
                  Редактировать
                </Button>
                <div className="flex flex-wrap gap-2 lg:col-span-7">
                  {clinic.status !== "suspended" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => void changeClinicStatus(clinic, "suspended")}
                      disabled={busy}
                    >
                      Приостановить
                    </Button>
                  )}
                  {clinic.status !== "active" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => void changeClinicStatus(clinic, "active")}
                      disabled={busy}
                    >
                      Вернуть в работу
                    </Button>
                  )}
                  {clinic.status !== "archived" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => void changeClinicStatus(clinic, "archived")}
                      disabled={busy}
                    >
                      В архив
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void deleteClinicIfEmpty(clinic)}
                    disabled={busy || clinicLinkedCount(clinic) > 0}
                  >
                    {deleteConfirmId === clinic.id ? "Подтвердить удаление" : "Удалить пустую запись"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AdminClinicsPage() {
  if (isProductionAppMode()) return <AdminClinicsPageLive />;
  return <AdminClinicsPageDemo />;
}

function AdminClinicsPageDemo() {
  const clinics = getClinics();
  const leads = getLeads();
  const appointments = getAppointments();
  const integrations = getIntegrations();
  const integrationsActive = integrations.some((i) => i.status === "connected");

  const [filter, setFilter] = useState<FilterKey>("all");

  // Сортировка синхронизируется с ?sort= в URL: значение сохраняется при
  // перезагрузке страницы и шарится по ссылке. Дефолт "priority" в URL не
  // прописываем, чтобы не засорять историю.
  const [searchParams, setSearchParams] = useSearchParams();
  const sortFromUrl = searchParams.get("sort");
  const sort: SortKey = isSortKey(sortFromUrl) ? sortFromUrl : "priority";
  const setSort = (next: SortKey) => {
    const sp = new URLSearchParams(searchParams);
    if (next === "priority") sp.delete("sort");
    else sp.set("sort", next);
    setSearchParams(sp, { replace: true });
  };

  // Если в URL пришло невалидное значение — мягко чистим параметр один раз.
  useEffect(() => {
    if (sortFromUrl !== null && !isSortKey(sortFromUrl)) {
      const sp = new URLSearchParams(searchParams);
      sp.delete("sort");
      setSearchParams(sp, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortFromUrl]);
  const [actionNote, setActionNote] = useState<string | null>(null);

  const enriched = useMemo(() => {
    return clinics.map((c) => {
      const leadsCount = leads.filter((l) => l.clinicId === c.id).length;
      const bookings = appointments.filter((a) => a.clinicId === c.id).length;
      const conversion = leadsCount > 0 ? Math.round((bookings / leadsCount) * 100) : 0;
      const r = READINESS[c.id] ?? { integration: "partial", bridge: "missing" };
      // Если в системе нет ни одной активной интеграции — даже "ready"
      // помечаем как partial, чтобы не вводить пользователя в заблуждение.
      const integration = integrationsActive ? r.integration : "partial";
      return {
        clinic: c,
        leads: leadsCount,
        bookings,
        conversion,
        integration,
        bridge: r.bridge,
      };
    });
  }, [clinics, leads, appointments, integrationsActive]);

  const readyBranches = enriched.filter(
    (row) => row.integration === "ready" && row.bridge === "ready",
  ).length;
  const needsBridge = enriched.filter((row) => row.bridge !== "ready").length;
  const totalLeads = enriched.reduce((sum, row) => sum + row.leads, 0);

  const visible = useMemo(() => {
    const filtered = enriched.filter((row) =>
      filter === "all" ? true : row.clinic.partnerTier === filter,
    );
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "priority") return a.clinic.routingPriority - b.clinic.routingPriority;
      return b.conversion - a.conversion;
    });
    return sorted;
  }, [enriched, filter, sort]);

  const pagination = useListPagination(visible, {
    mobilePageSize: 4,
    desktopPageSize: 6,
    deps: [filter, sort],
  });
  const visibleRows = pagination.visible;

  const activeFilterLabels =
    filter === "all" ? [] : [`фильтр: ${FILTERS.find((f) => f.key === filter)?.label}`];
  const resetAll = () => {
    setFilter("all");
    setSort("priority");
  };
  const isEmpty = visible.length === 0;
  const emptyState = (
    <ListEmptyState
      itemNoun="клиник"
      activeFilters={activeFilterLabels}
      totalUnfiltered={enriched.length}
      onReset={resetAll}
      hint="В учебном каталоге фиксированный список клиник. Рабочие изменения выполняются в системе клиники."
    />
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Клиники и кабинеты"
        subtitle="Адреса, маршрутизация заявок, готовность кабинетов."
      />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{DEMO_NOTICE}</span>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <AdminOpsCard title="Готовность филиалов" hint="Филиал готов, только если есть интеграция и устройство/кабинет.">
            <div className="grid grid-cols-3 gap-2">
              <AdminMetric label="Филиалы" value={enriched.length} />
              <AdminMetric label="Готовы" value={readyBranches} tone={readyBranches ? "success" : "warning"} />
              <AdminMetric label="Кабинеты" value={needsBridge} tone={needsBridge ? "warning" : "success"} />
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Готовность показывает только операционные условия филиала: кабинет, устройство, интеграции и правила записи.
            </p>
          </AdminOpsCard>

          <AdminOpsCard title="Связь с врачами и услугами" hint="Справочник мест, где реально работают врачи.">
            <div className="grid gap-2 text-[12px]">
              <div className="rounded-md border border-border bg-surface px-2.5 py-2">
                <div className="font-medium">Врач → филиал → услуга</div>
                <div className="text-[11px] text-muted-foreground">
                  Дерматолог, дерматоскопия и цифровая карта кожи должны быть привязаны к конкретному месту приема.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <span className="rounded bg-muted px-2 py-1">3 филиала</span>
                <span className="rounded bg-muted px-2 py-1">6 услуг</span>
              </div>
            </div>
          </AdminOpsCard>

          <AdminOpsCard
            title="Маршрутизация заявок"
            hint="Приоритет филиала, доступность врачей и качество интеграций."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={() =>
                  setActionNote("Проверка клиник подготовлена локально. Рабочий пересчёт выполняется в системе клиники.")
                }
              >
                Проверить клиники
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <AdminMetric label="Заявки" value={totalLeads} tone="info" />
              <AdminMetric label="Сортировка" value={sort === "priority" ? "приоритет" : "конверсия"} />
            </div>
            <p className="mt-3 text-[12px] text-muted-foreground">
              Заявки направляются в клинику или кабинет только по операционным признакам: расписание, услуга, интеграция, кабинет.
            </p>
          </AdminOpsCard>

          <AdminOpsCard title="Ограничения передачи данных" hint="только служебные настройки">
            <p className="text-[12px] text-muted-foreground">
              В интеграции и маршрутизацию передаются только служебные статусы: без фото, диагнозов и внутренних кодов.
            </p>
            <Link
              to="/admin/integrations"
              className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-border px-3 text-[12px] font-medium hover:bg-muted sm:min-h-[32px]"
            >
              Открыть интеграции
            </Link>
          </AdminOpsCard>
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Фильтр клиник" className="flex flex-wrap gap-1">
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
            <div className="flex flex-col gap-1 sm:items-end">
              <div
                role="tablist"
                aria-label="Сортировка клиник"
                className="flex flex-wrap gap-1"
              >
                {SORT_OPTIONS.map((s) => {
                  const active = sort === s.key;
                  const Icon = s.Icon;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      aria-pressed={active}
                      title={s.hint}
                      onClick={() => setSort(s.key)}
                      className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[28px] sm:text-[11px] ${
                        active
                          ? "border-primary bg-primary/15 font-medium text-primary shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
                          : "border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden
                        style={active ? { color: "hsl(var(--primary))" } : undefined}
                      />
                      {s.label}
                    </button>
                  );
                })}
              </div>
              <div
                aria-live="polite"
                className="text-[11px] text-muted-foreground sm:text-right"
              >
                Сортировка: {SORT_OPTIONS.find((s) => s.key === sort)?.label}
              </div>
            </div>
          </div>
        </Card>

        {actionNote && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
          >
            {actionNote}
          </div>
        )}

        {isEmpty && emptyState}

        {/* Desktop: список-карточки в две колонки */}
        <div className={`grid grid-cols-1 gap-2 lg:grid-cols-2 ${isEmpty ? "hidden" : ""}`}>
          {visibleRows.map((row) => (
              <Card key={row.clinic.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{row.clinic.name}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {row.clinic.address}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {PARTNER_TIER_LABEL[row.clinic.partnerTier]}
                  </span>
                </div>

                <dl className="mt-2 grid grid-cols-3 gap-2 text-[12px]">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Приоритет
                    </dt>
                    <dd className="tabular-nums">{row.clinic.routingPriority}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Заявки
                    </dt>
                    <dd className="tabular-nums">{row.leads}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Записи
                    </dt>
                    <dd className="tabular-nums">{row.bookings}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Конверсия
                    </dt>
                    <dd className="tabular-nums">{row.conversion}%</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Интеграции
                    </dt>
                    <dd>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: READINESS_TONE[row.integration],
                          border: `1px solid ${READINESS_TONE[row.integration]}`,
                        }}
                      >
                        {READINESS_LABEL[row.integration]}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Кабинет
                    </dt>
                    <dd>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: READINESS_TONE[row.bridge],
                          border: `1px solid ${READINESS_TONE[row.bridge]}`,
                        }}
                      >
                        {READINESS_LABEL[row.bridge]}
                      </span>
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-col gap-1.5 sm:flex-row">
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1 text-[12px] sm:min-h-[36px]"
                    onClick={() =>
                      setActionNote(
                        `Настройка маршрутизации для «${row.clinic.name}» подготовлена локально.`,
                      )
                    }
                  >
                    Настроить маршрутизацию
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1 text-[12px] sm:min-h-[36px]"
                    onClick={() =>
                      setActionNote(
                        `Проверка готовности «${row.clinic.name}» подготовлена локально.`,
                      )
                    }
                  >
                    Проверить готовность
                  </Button>
                </div>
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
          itemNoun="клиник"
        />
      </div>
    </div>
  );
}

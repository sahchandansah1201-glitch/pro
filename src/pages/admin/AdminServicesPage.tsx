import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { AdminMetric, AdminOpsCard } from "@/components/admin/AdminOpsCard";
import { useListPagination } from "@/lib/use-list-pagination";
import { isProductionAppMode } from "@/lib/app-mode";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  createAdminClinicService,
  listAdminClinicServices,
  listAdminClinics,
  updateAdminClinicService,
  type AdminClinicDTO,
  type AdminClinicServiceCategory,
  type AdminClinicServiceDTO,
} from "@/lib/self-hosted-admin-api";

/**
 * Admin Services — каталог услуг и тарифов.
 *
 * SAFETY:
 *   - Только операционные поля услуги (код, категория, длительность,
 *     цена, активность, согласие, онлайн-запись). Пациент-уровневые
 *     данные не используются.
 *   - Никаких клинических рекомендаций или формулировок диагноза.
 *   - Никаких сетевых вызовов, clipboard, storage, медиа.
 */

const DEMO_NOTICE =
  "Учебный режим: показаны только настройки услуг. Персональные данные, фото и медицинские выводы скрыты.";

type Category = "consult" | "procedure" | "imaging";

interface ServiceRow {
  code: string;
  name: string;
  category: Category;
  durationMin: number;
  priceMin: number;
  priceMax: number;
  active: boolean;
  consentNote: string;
  onlineBooking: boolean;
}

const SERVICES: ServiceRow[] = [
  {
    code: "DRM-001",
    name: "Первичный приём дерматолога",
    category: "consult",
    durationMin: 30,
    priceMin: 2500,
    priceMax: 3500,
    active: true,
    consentNote: "Согласие на обработку персональных данных",
    onlineBooking: true,
  },
  {
    code: "DRM-002",
    name: "Повторный приём",
    category: "consult",
    durationMin: 20,
    priceMin: 1800,
    priceMax: 2500,
    active: true,
    consentNote: "—",
    onlineBooking: true,
  },
  {
    code: "DRM-010",
    name: "Дерматоскопия одного образования",
    category: "imaging",
    durationMin: 15,
    priceMin: 800,
    priceMax: 1200,
    active: true,
    consentNote: "Согласие на медицинскую съёмку",
    onlineBooking: true,
  },
  {
    code: "DRM-011",
    name: "Цифровая карта кожи",
    category: "imaging",
    durationMin: 60,
    priceMin: 4500,
    priceMax: 6000,
    active: true,
    consentNote: "Согласие на медицинскую съёмку и хранение снимков",
    onlineBooking: false,
  },
  {
    code: "DRM-020",
    name: "Удаление образования",
    category: "procedure",
    durationMin: 40,
    priceMin: 3500,
    priceMax: 9000,
    active: true,
    consentNote: "Согласие на медицинскую процедуру",
    onlineBooking: false,
  },
  {
    code: "DRM-021",
    name: "Контроль после удаления",
    category: "consult",
    durationMin: 20,
    priceMin: 1500,
    priceMax: 2000,
    active: false,
    consentNote: "—",
    onlineBooking: true,
  },
];

const CATEGORY_LABEL: Record<Category, string> = {
  consult: "Консультация",
  procedure: "Процедура",
  imaging: "Снимок/карта",
};

type FilterKey = "all" | "active" | "online" | "procedure";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "online", label: "Онлайн-запись" },
  { key: "procedure", label: "Процедуры" },
];

function fmtPrice(min: number, max: number): string {
  if (min === max) return `${min.toLocaleString("ru-RU")} ₽`;
  return `${min.toLocaleString("ru-RU")}–${max.toLocaleString("ru-RU")} ₽`;
}

type ServiceForm = {
  clinicId: string;
  name: string;
  category: Category;
  durationMin: string;
  priceMin: string;
  priceMax: string;
  consentNote: string;
  onlineBooking: boolean;
  active: boolean;
};

const EMPTY_SERVICE_FORM: ServiceForm = {
  clinicId: "",
  name: "",
  category: "consult",
  durationMin: "30",
  priceMin: "0",
  priceMax: "0",
  consentNote: "",
  onlineBooking: false,
  active: true,
};

function numberFromField(value: string): number {
  return Number.parseInt(value || "0", 10);
}

function formFromService(service: AdminClinicServiceDTO): ServiceForm & { id: string } {
  return {
    id: service.id,
    clinicId: service.clinicId,
    name: service.name,
    category: service.category,
    durationMin: String(service.durationMin),
    priceMin: String(service.priceMin),
    priceMax: String(service.priceMax),
    consentNote: service.consentNote,
    onlineBooking: service.onlineBooking,
    active: service.active,
  };
}

function servicePayloadFromForm(form: ServiceForm) {
  return {
    clinicId: form.clinicId,
    name: form.name.trim(),
    category: form.category as AdminClinicServiceCategory,
    durationMin: numberFromField(form.durationMin),
    priceMin: numberFromField(form.priceMin),
    priceMax: numberFromField(form.priceMax),
    consentNote: form.consentNote.trim(),
    onlineBooking: form.onlineBooking,
    active: form.active,
  };
}

function validateServiceForm(form: ServiceForm): string | null {
  if (!form.clinicId) return "Выберите клинику для услуги.";
  if (form.name.trim().length < 3) return "Укажите название услуги.";
  const durationMin = numberFromField(form.durationMin);
  const priceMin = numberFromField(form.priceMin);
  const priceMax = numberFromField(form.priceMax);
  if (!Number.isFinite(durationMin) || durationMin < 5 || durationMin > 720) {
    return "Длительность должна быть от 5 до 720 минут.";
  }
  if (!Number.isFinite(priceMin) || priceMin < 0) return "Минимальная цена не может быть отрицательной.";
  if (!Number.isFinite(priceMax) || priceMax < 0) return "Максимальная цена не может быть отрицательной.";
  if (priceMax < priceMin) return "Максимальная цена не может быть ниже минимальной.";
  return null;
}

function AdminServicesPageLive() {
  const session = useSelfHostedApiSession();
  const [services, setServices] = useState<AdminClinicServiceDTO[]>([]);
  const [clinics, setClinics] = useState<AdminClinicDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [lastChangedServiceId, setLastChangedServiceId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM);
  const [editForm, setEditForm] = useState<(ServiceForm & { id: string }) | null>(null);

  async function load() {
    setLoading(true);
    const [servicesResult, clinicsResult] = await Promise.all([
      listAdminClinicServices({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
      listAdminClinics({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
    ]);
    setLoading(false);
    if (servicesResult.ok) setServices(servicesResult.value ?? []);
    else setNote(adminApiErrorText(servicesResult.error));
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

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) => `${service.name} ${service.clinicName}`.toLowerCase().includes(q));
  }, [services, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 4,
    desktopPageSize: 8,
    deps: [query],
  });
  const visibleRows = pagination.visible;
  const activeCount = services.filter((service) => service.active).length;
  const onlineCount = services.filter((service) => service.onlineBooking).length;
  const imagingCount = services.filter((service) => service.category === "imaging").length;
  const emptyState = (
    <ListEmptyState
      itemNoun="услуг"
      query={query}
      activeFilters={[]}
      totalUnfiltered={services.length}
      onReset={() => setQuery("")}
      hint="Создайте первую услугу, чтобы администратор клиники мог управлять длительностью, ценой и доступностью записи."
    />
  );

  async function submitService() {
    const validation = validateServiceForm(form);
    if (validation) {
      setNote(validation);
      return;
    }
    setBusy(true);
    const result = await createAdminClinicService({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: servicePayloadFromForm(form),
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    if (result.value) {
      setLastChangedServiceId(result.value.id);
      setServices((current) => [result.value!, ...current.filter((service) => service.id !== result.value!.id)]);
    }
    setNote(`Услуга создана: ${result.value?.name ?? form.name}`);
    setForm((current) => ({ ...EMPTY_SERVICE_FORM, clinicId: current.clinicId || clinics[0]?.id || "" }));
    await load();
  }

  async function submitServiceEdit() {
    if (!editForm) return;
    const validation = validateServiceForm(editForm);
    if (validation) {
      setNote(validation);
      return;
    }
    setBusy(true);
    const result = await updateAdminClinicService({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      serviceId: editForm.id,
      payload: servicePayloadFromForm(editForm),
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    if (result.value) {
      setLastChangedServiceId(result.value.id);
      setServices((current) => current.map((service) => (service.id === result.value!.id ? result.value! : service)));
    }
    setNote(`Услуга обновлена: ${result.value?.name ?? editForm.name}`);
    setEditForm(null);
    await load();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Услуги и тарифы" subtitle="Каталог услуг, цены, длительность." />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
        >
          Рабочий режим: услуги сохраняются в базе клиники и доступны для настройки записи после проверки условий.
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <AdminOpsCard title="Услуги" hint="зарегистрированы в рабочей базе">
            <AdminMetric label="Всего" value={services.length} tone="info" />
          </AdminOpsCard>
          <AdminOpsCard title="Онлайн-запись" hint="доступны пациентам после проверки условий">
            <AdminMetric label="Включена" value={onlineCount} tone="success" />
          </AdminOpsCard>
          <AdminOpsCard title="Съёмка" hint="услуги с фото или картой кожи">
            <AdminMetric label="Услуг" value={imagingCount} tone="neutral" />
          </AdminOpsCard>
        </div>

        <Card className="p-3">
          <div className="mb-3">
            <h2 className="text-[14px] font-semibold">Создать услугу</h2>
            <p className="text-[12px] text-muted-foreground">
              Укажите длительность, цену и условия записи. Пациентские данные здесь не используются.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
            <Input
              aria-label="Название услуги"
              placeholder="Название услуги"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="h-11"
            />
            <select
              aria-label="Клиника услуги"
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
              aria-label="Категория услуги"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as Category }))}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[14px]"
            >
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Input
              aria-label="Длительность услуги"
              inputMode="numeric"
              value={form.durationMin}
              onChange={(event) => setForm((current) => ({ ...current, durationMin: event.target.value }))}
              className="h-11"
            />
            <Input
              aria-label="Минимальная цена"
              inputMode="numeric"
              value={form.priceMin}
              onChange={(event) => setForm((current) => ({ ...current, priceMin: event.target.value }))}
              className="h-11"
            />
            <Input
              aria-label="Максимальная цена"
              inputMode="numeric"
              value={form.priceMax}
              onChange={(event) => setForm((current) => ({ ...current, priceMax: event.target.value }))}
              className="h-11"
            />
            <Input
              aria-label="Согласие для услуги"
              placeholder="Согласие или условие"
              value={form.consentNote}
              onChange={(event) => setForm((current) => ({ ...current, consentNote: event.target.value }))}
              className="h-11"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-h-11 items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={form.onlineBooking}
                  onChange={(event) => setForm((current) => ({ ...current, onlineBooking: event.target.checked }))}
                />
                Онлайн-запись
              </label>
              <label className="flex min-h-11 items-center gap-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                />
                Активна
              </label>
            </div>
          </div>
          <Button type="button" className="mt-3 min-h-[44px]" onClick={submitService} disabled={busy || loading}>
            Создать услугу
          </Button>
        </Card>

        {editForm && (
          <Card role="region" aria-label="Редактирование услуги" className="p-3">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[14px] font-semibold">Редактирование услуги</h2>
                <p className="text-[12px] text-muted-foreground">Изменения сохраняются в рабочей базе клиники.</p>
              </div>
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setEditForm(null)}>
                Отменить
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
              <Input
                aria-label="Название редактируемой услуги"
                value={editForm.name}
                onChange={(event) => setEditForm((current) => (current ? { ...current, name: event.target.value } : current))}
                className="h-11"
              />
              <select
                aria-label="Клиника редактируемой услуги"
                value={editForm.clinicId}
                onChange={(event) => setEditForm((current) => (current ? { ...current, clinicId: event.target.value } : current))}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-[14px]"
              >
                {clinics.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Категория редактируемой услуги"
                value={editForm.category}
                onChange={(event) => setEditForm((current) => (current ? { ...current, category: event.target.value as Category } : current))}
                className="min-h-11 rounded-md border border-input bg-background px-3 text-[14px]"
              >
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                aria-label="Длительность редактируемой услуги"
                inputMode="numeric"
                value={editForm.durationMin}
                onChange={(event) => setEditForm((current) => (current ? { ...current, durationMin: event.target.value } : current))}
                className="h-11"
              />
              <Input
                aria-label="Минимальная цена редактируемой услуги"
                inputMode="numeric"
                value={editForm.priceMin}
                onChange={(event) => setEditForm((current) => (current ? { ...current, priceMin: event.target.value } : current))}
                className="h-11"
              />
              <Input
                aria-label="Максимальная цена редактируемой услуги"
                inputMode="numeric"
                value={editForm.priceMax}
                onChange={(event) => setEditForm((current) => (current ? { ...current, priceMax: event.target.value } : current))}
                className="h-11"
              />
              <Input
                aria-label="Согласие редактируемой услуги"
                value={editForm.consentNote}
                onChange={(event) => setEditForm((current) => (current ? { ...current, consentNote: event.target.value } : current))}
                className="h-11"
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-11 items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={editForm.onlineBooking}
                    onChange={(event) => setEditForm((current) => (current ? { ...current, onlineBooking: event.target.checked } : current))}
                  />
                  Онлайн-запись
                </label>
                <label className="flex min-h-11 items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={editForm.active}
                    onChange={(event) => setEditForm((current) => (current ? { ...current, active: event.target.checked } : current))}
                  />
                  Активна
                </label>
              </div>
            </div>
            <Button type="button" className="mt-3 min-h-[44px]" onClick={submitServiceEdit} disabled={busy}>
              Сохранить услугу
            </Button>
          </Card>
        )}

        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[13px] font-semibold">В списке: {rows.length}</div>
            <label className="relative block w-full sm:w-80">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по услуге или клинике"
                aria-label="Поиск услуг"
                className="h-11 pl-7 text-[12px] sm:h-9"
              />
            </label>
          </div>
        </Card>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        {rows.length === 0 && !loading && emptyState}

        <Card className={`hidden p-0 md:block ${rows.length === 0 ? "md:hidden" : ""}`}>
          <table className="w-full text-[12px]">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Услуга</th>
                <th className="px-3 py-2">Клиника</th>
                <th className="px-3 py-2">Категория</th>
                <th className="px-3 py-2 text-right">Время</th>
                <th className="px-3 py-2 text-right">Цена</th>
                <th className="px-3 py-2">Согласие</th>
                <th className="px-3 py-2">Онлайн</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((service) => (
                <tr
                  key={service.id}
                  className={`border-b border-border/60 last:border-0 ${lastChangedServiceId === service.id ? "bg-primary/5" : ""}`}
                >
                  <td className="px-3 py-2 font-medium">{service.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{service.clinicName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{CATEGORY_LABEL[service.category]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{service.durationMin} мин</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtPrice(service.priceMin, service.priceMax)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{service.consentNote || "Не требуется"}</td>
                  <td className="px-3 py-2">{service.onlineBooking ? "Да" : "Нет"}</td>
                  <td className="px-3 py-2">{service.active ? "Активна" : "Отключена"}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] sm:min-h-[32px]"
                      onClick={() => setEditForm(formFromService(service))}
                    >
                      Редактировать
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className={`grid grid-cols-1 gap-2 md:hidden ${rows.length === 0 ? "hidden" : ""}`}>
          {visibleRows.map((service) => (
            <Card key={service.id} role="region" aria-label={`Услуга ${service.name}`} className={`p-3 ${lastChangedServiceId === service.id ? "border-primary/50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{service.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {service.clinicName} · {CATEGORY_LABEL[service.category]}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{service.active ? "Активна" : "Отключена"}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <dt className="text-muted-foreground">Длительность</dt>
                <dd className="text-right tabular-nums">{service.durationMin} мин</dd>
                <dt className="text-muted-foreground">Цена</dt>
                <dd className="text-right tabular-nums">{fmtPrice(service.priceMin, service.priceMax)}</dd>
                <dt className="text-muted-foreground">Согласие</dt>
                <dd className="text-right">{service.consentNote || "Не требуется"}</dd>
                <dt className="text-muted-foreground">Онлайн-запись</dt>
                <dd className="text-right">{service.onlineBooking ? "Да" : "Нет"}</dd>
              </dl>
              <Button type="button" variant="outline" className="mt-3 min-h-[44px] w-full text-[12px]" onClick={() => setEditForm(formFromService(service))}>
                Редактировать
              </Button>
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
          itemNoun="услуг"
        />
      </div>
    </div>
  );
}

function AdminServicesPageDemo() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [actionNote, setActionNote] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICES.filter((s) => {
      if (filter === "active" && !s.active) return false;
      if (filter === "online" && !s.onlineBooking) return false;
      if (filter === "procedure" && s.category !== "procedure") return false;
      if (q && !`${s.name} ${s.code}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 4,
    desktopPageSize: 8,
    deps: [filter, query],
  });
  const visibleRows = pagination.visible;

  const activeFilterLabels =
    filter === "all" ? [] : [`фильтр: ${FILTERS.find((f) => f.key === filter)?.label}`];
  const resetAll = () => {
    setFilter("all");
    setQuery("");
  };
  const activeCount = SERVICES.filter((s) => s.active).length;
  const onlineCount = SERVICES.filter((s) => s.onlineBooking).length;
  const imagingCount = SERVICES.filter((s) => s.category === "imaging").length;
  const blockedForOnline = SERVICES.filter((s) => s.active && !s.onlineBooking).length;
  const isEmpty = rows.length === 0;
  const emptyState = (
    <ListEmptyState
      itemNoun="услуг"
      query={query}
      activeFilters={activeFilterLabels}
      totalUnfiltered={SERVICES.length}
      onReset={resetAll}
      hint="В учебном каталоге фиксированный список услуг. Рабочие изменения выполняются в системе клиники."
    />
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Услуги и тарифы" subtitle="Каталог услуг, цены, длительность." />

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

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.9fr_1fr_1fr]">
          <AdminOpsCard
            title="Создание услуги"
            hint="Ручное добавление для филиалов без полной связи с учётной системой."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={() =>
                  setActionNote("Черновик услуги подготовлен локально. Рабочее сохранение выполняется в системе клиники.")
                }
              >
                Создать услугу вручную
              </Button>
            }
          >
            <p className="text-[12px] text-muted-foreground">
              Форма должна покрывать название, категория, длительность, цена, согласие/условия и доступность онлайн-записи.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <AdminMetric label="Активны" value={activeCount} tone="success" />
              <AdminMetric label="Онлайн" value={onlineCount} tone="info" />
              <AdminMetric label="Съёмка" value={imagingCount} tone="neutral" />
            </div>
          </AdminOpsCard>

          <AdminOpsCard title="Обновление из системы клиники" hint="Источник услуги должен быть понятен администратору.">
            <div className="grid gap-2 text-[12px]">
              <div className="rounded-md border border-border bg-surface px-2.5 py-2">
                <div className="font-medium">Обновление услуг</div>
                <div className="text-[11px] text-muted-foreground">
                  Обновление меняет длительность и цену; ручные правки не заменяются без подтверждения.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="rounded-md border border-border bg-muted px-2 py-1 text-[11px]">
                  Источник: система клиники
                </span>
                <span className="rounded-md border border-border bg-muted px-2 py-1 text-[11px]">
                  Источник: ручной
                </span>
              </div>
            </div>
          </AdminOpsCard>

          <AdminOpsCard
            title="Проверка перед публикацией"
            hint="Услуга не должна попадать в запись без правил и согласий."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={() => setActionNote("Проверка правил записи подготовлена локально. Сообщения пациентам не отправляются.")}
              >
                Проверить правила записи
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <AdminMetric label="Без онлайн" value={blockedForOnline} tone="warning" />
              <AdminMetric label="Согласия" value="4/6" tone="info" />
            </div>
            <ul className="mt-3 grid gap-1.5 text-[12px] text-muted-foreground">
              <li>Цена и длительность заполнены.</li>
              <li>Согласие на съёмку требуется для услуг со снимками.</li>
              <li>Онлайн-запись включается только после проверки условий.</li>
            </ul>
          </AdminOpsCard>
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Фильтр услуг" className="flex flex-wrap gap-1">
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
            <label className="relative block w-full sm:w-64">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по названию услуги"
                aria-label="Поиск услуг"
                className="h-11 pl-7 text-[12px] sm:h-9"
              />
            </label>
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

        <Card className={`hidden p-0 md:block ${isEmpty ? "md:hidden" : ""}`}>
          <table className="w-full text-[12px]">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Служебный код</th>
                <th className="px-3 py-2">Услуга</th>
                <th className="px-3 py-2">Категория</th>
                <th className="px-3 py-2 text-right">Время</th>
                <th className="px-3 py-2 text-right">Цена</th>
                <th className="px-3 py-2">Согласие</th>
                <th className="px-3 py-2">Онлайн</th>
                <th className="px-3 py-2">Статус</th>
                <th className="px-3 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((s) => (
                <tr key={s.code} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">скрыт</td>
                  <td className="px-3 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{CATEGORY_LABEL[s.category]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.durationMin} мин</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmtPrice(s.priceMin, s.priceMax)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{s.consentNote}</td>
                  <td className="px-3 py-2">
                    {s.onlineBooking ? (
                      <span className="text-[11px]" style={{ color: "hsl(var(--success))" }}>
                        Да
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Нет</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{
                        color: s.active
                          ? "hsl(var(--success))"
                          : "hsl(var(--muted-foreground))",
                        border: `1px solid ${
                          s.active
                            ? "hsl(var(--success))"
                            : "hsl(var(--muted-foreground))"
                        }`,
                      }}
                    >
                      {s.active ? "Активна" : "Отключена"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 min-h-[44px] sm:min-h-[32px]"
                      onClick={() =>
                        setActionNote(
                          `Правка услуги «${s.name}» подготовлена локально. Рабочее сохранение выполняется в системе клиники.`,
                        )
                      }
                    >
                      Редактировать
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className={`grid grid-cols-1 gap-2 md:hidden ${isEmpty ? "hidden" : ""}`}>
          {visibleRows.map((s) => (
              <Card key={s.code} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Служебный код скрыт · {CATEGORY_LABEL[s.category]}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      color: s.active
                        ? "hsl(var(--success))"
                        : "hsl(var(--muted-foreground))",
                      border: `1px solid ${
                        s.active
                          ? "hsl(var(--success))"
                          : "hsl(var(--muted-foreground))"
                      }`,
                    }}
                  >
                    {s.active ? "Активна" : "Отключена"}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Длительность</dt>
                  <dd className="text-right tabular-nums">{s.durationMin} мин</dd>
                  <dt className="text-muted-foreground">Цена</dt>
                  <dd className="text-right tabular-nums">{fmtPrice(s.priceMin, s.priceMax)}</dd>
                  <dt className="text-muted-foreground">Согласие</dt>
                  <dd className="text-right">{s.consentNote}</dd>
                  <dt className="text-muted-foreground">Онлайн-запись</dt>
                  <dd className="text-right">{s.onlineBooking ? "Да" : "Нет"}</dd>
                </dl>
                <Button
                  variant="outline"
                  className="mt-3 min-h-[44px] w-full text-[12px]"
                  onClick={() =>
                    setActionNote(
                      `Правка услуги «${s.name}» подготовлена локально. Рабочее сохранение выполняется в системе клиники.`,
                    )
                  }
                >
                  Редактировать
                </Button>
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
          itemNoun="услуг"
        />
      </div>
    </div>
  );
}

export default function AdminServicesPage() {
  if (isProductionAppMode()) return <AdminServicesPageLive />;
  return <AdminServicesPageDemo />;
}

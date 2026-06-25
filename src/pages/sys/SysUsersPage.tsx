import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { useListPagination } from "@/lib/use-list-pagination";
import { getClinics } from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";
import { ROLE_BY_ID, type Role } from "@/lib/roles";
import { isProductionAppMode } from "@/lib/app-mode";
import { clearSelfHostedApiSession, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  assignAdminUserRole,
  createAdminUser,
  disableAdminUser,
  isAdminSessionExpiredError,
  listAdminClinics,
  listAdminUsers,
  type AdminClinicDTO,
  type AdminUserDTO,
} from "@/lib/self-hosted-admin-api";

/**
 * Сотрудники системы — управление учётными записями и ролями (учебный режим).
 * SAFETY: не показывает email пациента и raw email вообще; пациент скрыт под
 * меткой «Учебный пациент». Никаких сетевых вызовов и storage.
 */

const DEMO_BANNER =
  "Учебный режим. Рабочие роли, аудит, ключи и мост устройств включаются после подключения системы клиники.";

type Status = "active" | "demo" | "needs_backend";
const STATUS_LABEL: Record<Status, string> = {
  active: "Активен",
  demo: "Учебный",
  needs_backend: "Нужна система",
};
const STATUS_TONE: Record<Status, string> = {
  active: "hsl(var(--success))",
  demo: "hsl(var(--info))",
  needs_backend: "hsl(var(--warning))",
};

interface UserRow {
  accountId: string;
  display: string;
  role: Role;
  clinicId: string | null;
  status: Status;
  scope: string;
}

const CLINICAL: Role[] = ["doctor", "assistant", "private_doctor"];

const ROWS: UserRow[] = (Object.values(DEMO_USERS) as Array<typeof DEMO_USERS[Role]>).map((u) => {
  const isPatient = u.role === "patient";
  const scope =
    u.role === "system_admin"
      ? "Глобально, без клинического контента"
      : u.role === "patient"
        ? "Только свой портал"
        : u.role === "operator"
          ? "Обращения и заявки клиники"
          : u.role === "clinic_admin"
            ? "Своя клиника, без клинических данных"
            : "Своя клиника, клинический контент";
  return {
    accountId: u.id,
    display: isPatient ? "Учебный пациент" : u.fullName,
    role: u.role,
    clinicId: u.clinicId,
    status: u.role === "system_admin" ? "needs_backend" : "demo",
    scope,
  };
});

type FilterKey = "all" | "clinical" | "clinic_admin" | "operator" | "system_admin" | "patient";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "clinical", label: "Клинический персонал" },
  { key: "clinic_admin", label: "Админ клиники" },
  { key: "operator", label: "Оператор" },
  { key: "system_admin", label: "Сисадмин" },
  { key: "patient", label: "Пациент" },
];

const ROLE_LABEL: Record<string, string> = {
  system_admin: "Системный администратор",
  clinic_admin: "Администратор клиники",
  doctor: "Дерматолог",
  private_doctor: "Частный врач",
  assistant: "Ассистент",
  operator: "Оператор",
  patient: "Пациент",
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function userRoleLabels(user: AdminUserDTO): string[] {
  const labels = uniqueValues(user.roles.map((role) => roleLabel(role.role)));
  return labels.length > 0 ? labels : ["Роль не назначена"];
}

function userClinicLabels(user: AdminUserDTO): string[] {
  const labels = uniqueValues(user.roles.map((role) => role.clinicName));
  return labels.length > 0 ? labels : ["Без клиники"];
}

function SysUsersPageLive() {
  const session = useSelfHostedApiSession();
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [clinics, setClinics] = useState<AdminClinicDTO[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    role: "clinic_admin",
    clinicId: "",
  });
  const [roleForm, setRoleForm] = useState({
    userId: "",
    role: "doctor",
    clinicId: "",
  });

  function handleAdminError(error: Parameters<typeof adminApiErrorText>[0]) {
    if (isAdminSessionExpiredError(error)) setSessionExpired(true);
    setNote(adminApiErrorText(error));
  }

  function goToLogin() {
    clearSelfHostedApiSession();
    window.location.assign("/self-hosted/login");
  }

  async function load() {
    setLoading(true);
    const [usersResult, clinicsResult] = await Promise.all([
      listAdminUsers({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken, search: query }),
      listAdminClinics({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
    ]);
    if (usersResult.ok) {
      const nextUsers = usersResult.value ?? [];
      setUsers(nextUsers);
      setRoleForm((current) => ({
        ...current,
        userId: current.userId || nextUsers[0]?.id || "",
      }));
    } else handleAdminError(usersResult.error);
    if (clinicsResult.ok) {
      const nextClinics = clinicsResult.value ?? [];
      setClinics(nextClinics);
      setForm((current) => ({
        ...current,
        clinicId: current.clinicId || nextClinics[0]?.id || "",
      }));
      setRoleForm((current) => ({
        ...current,
        clinicId: current.clinicId || nextClinics[0]?.id || "",
      }));
    } else {
      handleAdminError(clinicsResult.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  async function submitUser() {
    if (sessionExpired) return;
    const displayName = form.displayName.trim();
    const email = form.email.trim();
    const password = form.password;
    if (!displayName || !email || !password) {
      setNote("Укажите ФИО, почту и временный пароль.");
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setNote("Укажите рабочую почту сотрудника.");
      return;
    }
    if (password.length < 10) {
      setNote("Временный пароль должен быть не короче 10 символов.");
      return;
    }
    if (form.role !== "system_admin" && !form.clinicId) {
      setNote("Выберите клинику для этой роли.");
      return;
    }
    setBusy(true);
    setNote(`Создаём сотрудника: ${displayName}`);
    const result = await createAdminUser({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: {
        displayName,
        email,
        password,
        role: form.role,
        clinicId: form.role === "system_admin" ? null : form.clinicId,
      },
    });
    setBusy(false);
    if (!result.ok) {
      handleAdminError(result.error);
      return;
    }
    setNote(`Учётная запись создана: ${result.value?.displayName ?? displayName}`);
    setForm((current) => ({ ...current, displayName: "", email: "", password: "" }));
    await load();
  }

  async function submitRoleAssignment() {
    if (sessionExpired) return;
    if (!roleForm.userId) {
      setNote("Выберите учётную запись для назначения роли.");
      return;
    }
    if (roleForm.role !== "system_admin" && !roleForm.clinicId) {
      setNote("Выберите клинику для этой роли.");
      return;
    }
    setBusy(true);
    const result = await assignAdminUserRole({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      userId: roleForm.userId,
      payload: {
        role: roleForm.role,
        clinicId: roleForm.role === "system_admin" ? null : roleForm.clinicId,
      },
    });
    setBusy(false);
    if (!result.ok) {
      handleAdminError(result.error);
      return;
    }
    const selectedUser = users.find((user) => user.id === roleForm.userId);
    setNote(`Роль назначена: ${selectedUser?.displayName ?? "выбранная учётная запись"}`);
    await load();
  }

  async function disableUser(user: AdminUserDTO) {
    if (sessionExpired) return;
    setBusy(true);
    const result = await disableAdminUser({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      userId: user.id,
    });
    setBusy(false);
    if (!result.ok) {
      handleAdminError(result.error);
      return;
    }
    setNote(`Доступ отключён: ${user.displayName}`);
    await load();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Сотрудники и доступ" subtitle="Учётные записи, роли и доступ к клиникам или частным кабинетам." />
      <div className="space-y-3 p-3 sm:p-4">
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Рабочий режим: один человек может иметь несколько ролей, например администратор кабинета и частный врач.
        </div>

        {sessionExpired && (
          <Card role="alert" className="border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="text-[13px] font-semibold">Сессия истекла</div>
            <p className="mt-1 text-[12px]">
              Новые сотрудники и роли не сохраняются, пока вы не войдёте заново.
            </p>
            <Button type="button" className="mt-3 min-h-11" onClick={goToLogin}>
              Войти заново
            </Button>
          </Card>
        )}

        <Card className="p-3">
          <div className="mb-1 text-[13px] font-semibold">Создать сотрудника</div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Укажите первую роль. Дополнительные роли добавляются ниже без создания второй учётной записи.
          </p>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
            <Input
              value={form.displayName}
              onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
              placeholder="ФИО сотрудника"
              aria-label="ФИО сотрудника"
              className="min-h-11"
              disabled={sessionExpired}
            />
            <Input
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Эл. почта"
              aria-label="Эл. почта"
              className="min-h-11"
              disabled={sessionExpired}
            />
            <Input
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Временный пароль"
              aria-label="Временный пароль"
              type="password"
              className="min-h-11"
              disabled={sessionExpired}
            />
            <select
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Роль"
              disabled={sessionExpired}
            >
              <option value="clinic_admin">Администратор клиники</option>
              <option value="doctor">Дерматолог</option>
              <option value="private_doctor">Частный врач</option>
              <option value="assistant">Ассистент</option>
              <option value="operator">Оператор</option>
              <option value="system_admin">Системный администратор</option>
            </select>
            <select
              value={form.clinicId}
              onChange={(event) => setForm((current) => ({ ...current, clinicId: event.target.value }))}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Клиника"
              disabled={sessionExpired || form.role === "system_admin"}
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" className="mt-3 min-h-11" onClick={submitUser} disabled={busy || sessionExpired}>
            {busy ? "Создаём сотрудника..." : "Создать сотрудника"}
          </Button>
        </Card>

        <Card className="p-3">
          <div className="mb-1 text-[13px] font-semibold">Добавить роль действующему сотруднику</div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Используйте это для владельца кабинета, который одновременно администрирует кабинет и ведёт приём.
          </p>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
            <select
              value={roleForm.userId}
              onChange={(event) => setRoleForm((current) => ({ ...current, userId: event.target.value }))}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Учётная запись"
              disabled={sessionExpired}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName}
                </option>
              ))}
            </select>
            <select
              value={roleForm.role}
              onChange={(event) => setRoleForm((current) => ({ ...current, role: event.target.value }))}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Новая роль"
              disabled={sessionExpired}
            >
              <option value="clinic_admin">Администратор клиники</option>
              <option value="doctor">Дерматолог</option>
              <option value="private_doctor">Частный врач</option>
              <option value="assistant">Ассистент</option>
              <option value="operator">Оператор</option>
              <option value="system_admin">Системный администратор</option>
            </select>
            <select
              value={roleForm.clinicId}
              onChange={(event) => setRoleForm((current) => ({ ...current, clinicId: event.target.value }))}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Клиника для роли"
              disabled={sessionExpired || roleForm.role === "system_admin"}
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" className="min-h-11" onClick={submitRoleAssignment} disabled={busy || sessionExpired}>
              {busy ? "Добавляем роль..." : "Добавить роль"}
            </Button>
          </div>
        </Card>

        <Card className="p-3">
          <label className="relative block w-full">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void load();
              }}
              placeholder="Поиск по имени или почте"
              aria-label="Поиск пользователей"
              className="min-h-11 pl-7"
              disabled={sessionExpired}
            />
          </label>
        </Card>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-3 py-2 text-[12px] font-medium">
            {loading ? "Загрузка пользователей" : `В списке: ${users.length}`}
          </div>
          <div className="grid grid-cols-1 divide-y divide-border">
            {users.map((user) => (
              <div key={user.id} className="grid grid-cols-1 gap-2 p-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-center">
                <div>
                  <div className="text-[13px] font-semibold">{user.displayName}</div>
                  <div className="text-[11px] text-muted-foreground">{user.email}</div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {userRoleLabels(user).map((label) => (
                    <span key={label} className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground">
                      {label}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {userClinicLabels(user).map((label) => (
                    <span key={label} className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                      {label}
                    </span>
                  ))}
                </div>
                <div className="text-[12px]">
                  <span className={`rounded-full border px-2 py-0.5 ${user.active ? "text-emerald-700" : "text-muted-foreground"}`}>
                    {user.active ? "Доступ включён" : "Доступ отключён"}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void disableUser(user)}
                  disabled={busy || sessionExpired || !user.active}
                >
                  Отключить доступ
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function SysUsersPage() {
  if (isProductionAppMode()) return <SysUsersPageLive />;
  return <SysUsersPageDemo />;
}

function SysUsersPageDemo() {
  const clinics = getClinics();
  const clinicNameById = useMemo(() => {
    const m = new Map<string, string>();
    clinics.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clinics]);

  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ROWS.filter((r) => {
      if (filter === "clinical" && !CLINICAL.includes(r.role)) return false;
      if (
        (filter === "clinic_admin" || filter === "operator" || filter === "system_admin" || filter === "patient") &&
        r.role !== filter
      ) return false;
      if (q) {
        const hay = `${r.display} ${ROLE_BY_ID[r.role].label} ${r.scope}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 5,
    desktopPageSize: 10,
    deps: [filter, query],
  });
  const visible = pagination.visible;

  const resetAll = () => { setFilter("all"); setQuery(""); };
  const activeFilterLabels =
    filter === "all" ? [] : [`фильтр: ${FILTERS.find((f) => f.key === filter)?.label}`];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Сотрудники и доступ" subtitle="Учётные записи, роли, область доступа." />

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
          <span>{DEMO_BANNER}</span>
        </div>

        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Проверка роли в учебном режиме показывает логику интерфейса. Рабочую защиту включает система клиники.
        </div>

        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Фильтр пользователей" className="flex flex-wrap gap-1">
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
            <label className="relative block w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по имени, роли или доступу"
                aria-label="Поиск пользователей"
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

        {rows.length === 0 && (
          <ListEmptyState
            itemNoun="пользователей"
            query={query}
            activeFilters={activeFilterLabels}
            totalUnfiltered={ROWS.length}
            onReset={resetAll}
            hint="В учебном каталоге фиксированный список ролей. После подключения системы сюда придут реальные учётные записи."
          />
        )}

        {/* Desktop таблица */}
        {rows.length > 0 && (
          <Card className="hidden p-0 md:block">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Код учётной записи</th>
                  <th className="px-3 py-2">Имя / метка</th>
                  <th className="px-3 py-2">Роль</th>
                  <th className="px-3 py-2">Клиника</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Доступ</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.accountId} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">скрыт</td>
                    <td className="px-3 py-2 font-medium">{r.display}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ROLE_BY_ID[r.role].label}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.clinicId ? clinicNameById.get(r.clinicId) ?? r.clinicId : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ color: STATUS_TONE[r.status], border: `1px solid ${STATUS_TONE[r.status]}` }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.scope}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() => setNote(`Изменение роли для выбранной учётной записи — учебное действие.`)}
                        >
                          Изменить роль
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() => setNote(`Отключение доступа для выбранной учётной записи — учебное действие.`)}
                        >
                          Отключить доступ
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Mobile карточки */}
        {rows.length > 0 && (
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {visible.map((r) => (
              <Card key={r.accountId} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{r.display}</div>
                    <div className="truncate text-[11px] text-muted-foreground">код учётной записи скрыт</div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{ color: STATUS_TONE[r.status], border: `1px solid ${STATUS_TONE[r.status]}` }}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Роль</dt>
                  <dd className="text-right">{ROLE_BY_ID[r.role].label}</dd>
                  <dt className="text-muted-foreground">Клиника</dt>
                  <dd className="text-right">{r.clinicId ? clinicNameById.get(r.clinicId) ?? r.clinicId : "—"}</dd>
                  <dt className="text-muted-foreground">Доступ</dt>
                  <dd className="text-right">{r.scope}</dd>
                </dl>
                <div className="mt-3 flex flex-col gap-1.5">
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(`Изменение роли для выбранной учётной записи — учебное действие.`)}>
                    Изменить роль
                  </Button>
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(`Отключение доступа для выбранной учётной записи — учебное действие.`)}>
                    Отключить доступ
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <ListPagination
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          rangeLabel={pagination.rangeLabel}
          canPrev={pagination.canPrev}
          canNext={pagination.canNext}
          onPageChange={pagination.setPage}
          itemNoun="пользователей"
        />
      </div>
    </div>
  );
}

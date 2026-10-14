import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearSelfHostedApiSession, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  assignAdminUserRole,
  createAdminUser,
  disableAdminUser,
  isAdminSessionExpiredError,
  listAdminClinics,
  listAdminUsers,
  reactivateAdminUser,
  setAdminUserRoleStatus,
  type AdminClinicDTO,
  type AdminRoleBindingDTO,
  type AdminUserDTO,
} from "@/lib/self-hosted-admin-api";

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

type CreateUserField = "displayName" | "email" | "password" | "clinicId";

function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

function roleStatusLabel(role: AdminRoleBindingDTO): string {
  return role.active === false ? "роль отключена" : "роль включена";
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
  const [createError, setCreateError] = useState<string | null>(null);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [invalidCreateField, setInvalidCreateField] = useState<CreateUserField | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const displayNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const clinicRef = useRef<HTMLSelectElement>(null);
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

  function updateCreateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setCreateStatus(null);
    if (
      invalidCreateField === null ||
      invalidCreateField === field ||
      (field === "role" && value === "system_admin" && invalidCreateField === "clinicId")
    ) {
      setInvalidCreateField(null);
      setCreateError(null);
    }
  }

  function showCreateError(message: string, field: CreateUserField | null = null) {
    setCreateError(message);
    setCreateStatus(null);
    setInvalidCreateField(field);
    if (field === "displayName") displayNameRef.current?.focus();
    if (field === "email") emailRef.current?.focus();
    if (field === "password") passwordRef.current?.focus();
    if (field === "clinicId") clinicRef.current?.focus();
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
      const field = !displayName ? "displayName" : !email ? "email" : "password";
      showCreateError("Укажите ФИО, почту и временный пароль.", field);
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      showCreateError("Укажите рабочую почту сотрудника.", "email");
      return;
    }
    if (password.length < 10) {
      showCreateError("Временный пароль должен быть не короче 10 символов.", "password");
      return;
    }
    if (form.role !== "system_admin" && !form.clinicId) {
      showCreateError("Выберите клинику для этой роли.", "clinicId");
      return;
    }
    setBusy(true);
    setNote(null);
    setCreateError(null);
    setInvalidCreateField(null);
    setCreateStatus(`Создаём сотрудника: ${displayName}`);
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
      if (isAdminSessionExpiredError(result.error)) setSessionExpired(true);
      showCreateError(adminApiErrorText(result.error));
      return;
    }
    setCreateStatus(`Учётная запись создана: ${result.value?.displayName ?? displayName}`);
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

  async function reactivateUser(user: AdminUserDTO) {
    if (sessionExpired) return;
    setBusy(true);
    const result = await reactivateAdminUser({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      userId: user.id,
    });
    setBusy(false);
    if (!result.ok) {
      handleAdminError(result.error);
      return;
    }
    setNote(`Доступ возвращён: ${user.displayName}`);
    await load();
  }

  async function changeRoleStatus(user: AdminUserDTO, role: AdminRoleBindingDTO, status: "active" | "disabled") {
    if (sessionExpired) return;
    setBusy(true);
    const result = await setAdminUserRoleStatus({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      userId: user.id,
      payload: {
        role: role.role,
        clinicId: role.clinicId,
        status,
        reason: status === "disabled" ? "Решение администратора Dermatolog Pro" : null,
      },
    });
    setBusy(false);
    if (!result.ok) {
      handleAdminError(result.error);
      return;
    }
    setNote(
      status === "disabled"
        ? `Роль отключена: ${roleLabel(role.role)} · ${user.displayName}`
        : `Роль возвращена: ${roleLabel(role.role)} · ${user.displayName}`,
    );
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

        <Card role="region" aria-label="Создание сотрудника" className="p-3">
          <div className="mb-1 text-[13px] font-semibold">Создать сотрудника</div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Укажите первую роль. Дополнительные роли добавляются ниже без создания второй учётной записи.
          </p>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
            <Input
              ref={displayNameRef}
              value={form.displayName}
              onChange={(event) => updateCreateField("displayName", event.target.value)}
              placeholder="ФИО сотрудника"
              aria-label="ФИО сотрудника"
              aria-invalid={invalidCreateField === "displayName" || undefined}
              aria-errormessage={invalidCreateField === "displayName" ? "create-user-feedback" : undefined}
              className="min-h-11"
              disabled={busy || sessionExpired}
            />
            <Input
              ref={emailRef}
              value={form.email}
              onChange={(event) => updateCreateField("email", event.target.value)}
              placeholder="Эл. почта"
              aria-label="Эл. почта"
              aria-invalid={invalidCreateField === "email" || undefined}
              aria-errormessage={invalidCreateField === "email" ? "create-user-feedback" : undefined}
              className="min-h-11"
              disabled={busy || sessionExpired}
            />
            <Input
              ref={passwordRef}
              value={form.password}
              onChange={(event) => updateCreateField("password", event.target.value)}
              placeholder="Временный пароль"
              aria-label="Временный пароль"
              aria-describedby="create-user-password-help"
              aria-invalid={invalidCreateField === "password" || undefined}
              aria-errormessage={invalidCreateField === "password" ? "create-user-feedback" : undefined}
              type="password"
              minLength={10}
              className="min-h-11"
              disabled={busy || sessionExpired}
            />
            <select
              value={form.role}
              onChange={(event) => updateCreateField("role", event.target.value)}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Роль"
              disabled={busy || sessionExpired}
            >
              <option value="clinic_admin">Администратор клиники</option>
              <option value="doctor">Дерматолог</option>
              <option value="private_doctor">Частный врач</option>
              <option value="assistant">Ассистент</option>
              <option value="operator">Оператор</option>
              <option value="system_admin">Системный администратор</option>
            </select>
            <select
              ref={clinicRef}
              value={form.clinicId}
              onChange={(event) => updateCreateField("clinicId", event.target.value)}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Клиника"
              aria-invalid={invalidCreateField === "clinicId" || undefined}
              aria-errormessage={invalidCreateField === "clinicId" ? "create-user-feedback" : undefined}
              disabled={busy || sessionExpired || form.role === "system_admin"}
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <p id="create-user-password-help" className="mt-2 text-[12px] text-muted-foreground">
            Временный пароль: не менее 10 символов.
          </p>
          <Button type="button" className="mt-3 min-h-11" onClick={submitUser} disabled={busy || sessionExpired}>
            {busy ? "Создаём сотрудника..." : "Создать сотрудника"}
          </Button>
          {createError && (
            <div
              id="create-user-feedback"
              role="alert"
              className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12px] text-destructive"
            >
              {createError}
            </div>
          )}
          {createStatus && !createError && (
            <div
              role="status"
              aria-live="polite"
              className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
            >
              {createStatus}
            </div>
          )}
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
                  {user.roles.length > 0 ? (
                    user.roles.map((role) => (
                      <span
                        key={`${role.role}-${role.clinicId ?? "global"}`}
                        className={`rounded-full border px-2 py-1 text-[11px] ${
                          role.active === false ? "border-slate-200 bg-slate-50 text-muted-foreground" : "border-border text-foreground"
                        }`}
                      >
                        {roleLabel(role.role)} · {roleStatusLabel(role)}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-border px-2 py-1 text-[11px] text-foreground">Роль не назначена</span>
                  )}
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
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {user.active ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => void disableUser(user)}
                      disabled={busy || sessionExpired}
                    >
                      Отключить доступ
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => void reactivateUser(user)}
                      disabled={busy || sessionExpired}
                    >
                      Вернуть доступ
                    </Button>
                  )}
                </div>
                {user.roles.length > 0 && (
                  <div className="flex flex-wrap gap-2 lg:col-span-5">
                    {user.roles.map((role) => (
                      <Button
                        key={`${user.id}-${role.role}-${role.clinicId ?? "global"}-${role.active}`}
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => void changeRoleStatus(user, role, role.active === false ? "active" : "disabled")}
                        disabled={busy || sessionExpired}
                      >
                        {role.active === false ? "Вернуть роль" : "Отключить роль"} · {roleLabel(role.role)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function SysUsersPage() {
  const session = useSelfHostedApiSession();
  return <SysUsersPageLive key={session.revision} />;
}

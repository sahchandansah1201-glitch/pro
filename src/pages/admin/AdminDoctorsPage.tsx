import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, Search, ShieldAlert, ShieldCheck, Stethoscope, UserPlus, UserRoundCog, UserRoundX } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ListPagination } from "@/components/admin/ListPagination";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { AdminMetric, AdminOpsCard } from "@/components/admin/AdminOpsCard";
import { useListPagination } from "@/lib/use-list-pagination";
import { getClinics, getAppointments } from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";
import { isProductionAppMode } from "@/lib/app-mode";
import { clearSelfHostedApiSession, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  createAdminDoctor,
  createAdminUser,
  disableAdminUser,
  isAdminSessionExpiredError,
  listAdminClinics,
  listAdminDoctors,
  listAdminUsers,
  reactivateAdminUser,
  resetAdminUserPassword,
  setAdminUserRoleStatus,
  type AdminClinicDTO,
  type AdminRoleBindingDTO,
  type AdminUserDTO,
} from "@/lib/self-hosted-admin-api";

/**
 * Admin Doctors — список врачей клиники, расписание и лицензии.
 *
 * SAFETY:
 *   - Только операционные данные о врачах: имя, специализация, клиника,
 *     расписание, нагрузка. Пациент-уровневые поля не импортируются.
 *   - Никаких сетевых вызовов, clipboard, storage, медиа.
 *   - Кнопки действий — локальные инструкции через React state.
 */

const DEMO_NOTICE =
  "Учебный режим: показаны только расписание, роли и готовность врачей. Персональные данные пациентов, фото и медицинские выводы скрыты.";

type LicenseStatus = "valid" | "expiring" | "needs_check";

interface DoctorRow {
  id: string;
  fullName: string;
  specialty: string;
  roleLabel: string;
  clinicId: string;
  scheduleSummary: string;
  todayLoad: number;
  nextSlot: string;
  license: LicenseStatus;
  active: boolean;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Детерминированный демо-список — расширяет DEMO_USERS операционными полями.
const DOCTOR_ROWS: DoctorRow[] = (() => {
  const doc = DEMO_USERS.doctor;
  const pdoc = DEMO_USERS.private_doctor;
  return [
    {
      id: doc.id,
      fullName: doc.fullName,
      specialty: "Дерматолог-онколог",
      roleLabel: "Дерматолог",
      clinicId: doc.clinicId ?? "clinic-demo-001",
      scheduleSummary: "Пн–Пт · 09:00–18:00",
      todayLoad: 6,
      nextSlot: "сегодня · 14:30",
      license: "valid",
      active: true,
    },
    {
      id: pdoc.id,
      fullName: pdoc.fullName,
      specialty: "Дерматолог",
      roleLabel: "Частный врач",
      clinicId: pdoc.clinicId ?? "clinic-private-007",
      scheduleSummary: "Вт, Чт, Сб · 11:00–19:00",
      todayLoad: 3,
      nextSlot: "завтра · 11:00",
      license: "expiring",
      active: true,
    },
    {
      id: "u-doc-002",
      fullName: "Кузнецов Павел Викторович",
      specialty: "Дерматолог",
      roleLabel: "Дерматолог",
      clinicId: "clinic-demo-001",
      scheduleSummary: "Пн, Ср, Пт · 12:00–20:00",
      todayLoad: 4,
      nextSlot: "сегодня · 16:15",
      license: "valid",
      active: true,
    },
    {
      id: "u-doc-003",
      fullName: "Никитина Ольга Романовна",
      specialty: "Дерматолог-косметолог",
      roleLabel: "Дерматолог",
      clinicId: "clinic-demo-002",
      scheduleSummary: "Пн–Чт · 10:00–17:00",
      todayLoad: 5,
      nextSlot: "сегодня · 17:00",
      license: "needs_check",
      active: true,
    },
    {
      id: "u-doc-004",
      fullName: "Рябов Андрей Сергеевич",
      specialty: "Дерматолог-онколог",
      roleLabel: "Дерматолог",
      clinicId: "clinic-demo-002",
      scheduleSummary: "Сб · 10:00–15:00",
      todayLoad: 0,
      nextSlot: "сб · 10:00",
      license: "valid",
      active: false,
    },
  ];
})();

const LICENSE_LABEL: Record<LicenseStatus, string> = {
  valid: "Лицензия действует",
  expiring: "Истекает скоро",
  needs_check: "Нужна проверка",
};
const LICENSE_TONE: Record<LicenseStatus, string> = {
  valid: "hsl(var(--success))",
  expiring: "hsl(var(--warning))",
  needs_check: "hsl(var(--destructive))",
};

type FilterKey = "all" | "active" | "needs_check";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "needs_check", label: "Проверить лицензию" },
];

function doctorRoleLabel(role: string): string {
  return role === "private_doctor" ? "Частный врач" : "Дерматолог";
}

function doctorClinicName(user: AdminUserDTO): string {
  return user.roles.find((role) => role.clinicName)?.clinicName ?? "—";
}

function primaryDoctorRole(user: AdminUserDTO): AdminRoleBindingDTO | null {
  return user.roles.find((role) => role.role === "private_doctor") ?? user.roles.find((role) => role.role === "doctor") ?? null;
}

function PasswordVisibilityButton({
  visible,
  onToggle,
  subject,
  passwordLabel = "временный пароль",
}: {
  visible: boolean;
  onToggle: () => void;
  subject: string;
  passwordLabel?: string;
}) {
  const label = `${visible ? "Скрыть" : "Показать"} ${passwordLabel} ${subject}`;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onToggle}
      className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
    </button>
  );
}

type StaffTab = "doctors" | "assistants" | "access";
type AccessFilter = "all" | "active" | "disabled";

function assistantRole(user: AdminUserDTO): AdminRoleBindingDTO | null {
  return user.roles.find((role) => role.role === "assistant") ?? null;
}

function staffRoleLabel(user: AdminUserDTO): string {
  const labels: string[] = [];
  if (primaryDoctorRole(user)) labels.push(doctorRoleLabel(primaryDoctorRole(user)?.role ?? "doctor"));
  if (assistantRole(user)) labels.push("Ассистент");
  return labels.join(" · ") || "Сотрудник";
}

function StaffMetricsStrip({ doctors, assistants }: { doctors: AdminUserDTO[]; assistants: AdminUserDTO[] }) {
  const allStaff = new Map([...doctors, ...assistants].map((user) => [user.id, user]));
  const active = [...allStaff.values()].filter((user) => user.active).length;
  const disabled = [...allStaff.values()].filter((user) => !user.active).length;
  const items = [
    { label: "Врачи", value: doctors.length, icon: Stethoscope },
    { label: "Ассистенты", value: assistants.length, icon: UserRoundCog },
    { label: "С доступом", value: active, icon: ShieldCheck },
    { label: "Отключены", value: disabled, icon: UserRoundX },
  ];

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-surface lg:grid-cols-4" aria-label="Сводка по сотрудникам">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="flex min-h-14 items-center gap-2 border-b border-r border-border px-3 py-2 last:border-r-0 lg:border-b-0">
          <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div>
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="text-[16px] font-semibold tabular-nums">{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StaffAccessStatus({ user }: { user: AdminUserDTO }) {
  if (!user.active) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive"><UserRoundX className="h-3.5 w-3.5" aria-hidden />Доступ отключён</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] font-medium text-success"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />Доступ включён</span>;
}

function StaffRoleStatus({ user }: { user: AdminUserDTO }) {
  const role = primaryDoctorRole(user) ?? assistantRole(user);
  return (
    <div className="space-y-1">
      <div>{staffRoleLabel(user)}</div>
      {role?.active === false && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning">
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />Роль приостановлена
        </span>
      )}
    </div>
  );
}

function StaffDirectory({
  title,
  users,
  loading,
  busy,
  showRoleAction,
  showPasswordAction = false,
  onToggleAccess,
  onToggleRole,
  onResetPassword,
}: {
  title: string;
  users: AdminUserDTO[];
  loading: boolean;
  busy: boolean;
  showRoleAction: boolean;
  showPasswordAction?: boolean;
  onToggleAccess: (user: AdminUserDTO) => void;
  onToggleRole: (user: AdminUserDTO, role: AdminRoleBindingDTO) => void;
  onResetPassword?: (user: AdminUserDTO) => void;
}) {
  return (
    <Card className="overflow-hidden p-0" role="region" aria-label={title}>
      <div className="flex min-h-12 items-center gap-2 border-b border-border px-3">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <span className="text-[11px] text-muted-foreground">{loading ? "Загрузка" : `${users.length} записей`}</span>
      </div>
      <div className="hidden grid-cols-[1.25fr_0.8fr_0.9fr_0.9fr_auto] gap-3 border-b border-border bg-surface-muted px-3 py-2 text-[10px] font-semibold uppercase text-muted-foreground lg:grid">
        <span>Сотрудник</span><span>Роль</span><span>Клиника</span><span>Доступ</span><span>Действия</span>
      </div>
      {users.length === 0 ? (
        <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">Сотрудники не найдены. Измените поиск или добавьте нового сотрудника.</div>
      ) : (
        <div className="divide-y divide-border">
          {users.map((user) => {
            const doctorRole = primaryDoctorRole(user);
            return (
              <div key={user.id} className="grid grid-cols-1 gap-2 p-3 lg:grid-cols-[1.25fr_0.8fr_0.9fr_0.9fr_auto] lg:items-center">
                <div>
                  <div className="text-[13px] font-semibold">{user.displayName}</div>
                  <div className="text-[11px] text-muted-foreground">{user.email}</div>
                </div>
                <div className="grid grid-cols-[88px_1fr] text-[12px] lg:block"><span className="font-medium text-muted-foreground lg:hidden">Роль</span><StaffRoleStatus user={user} /></div>
                <div className="grid grid-cols-[88px_1fr] text-[12px] lg:block"><span className="font-medium text-muted-foreground lg:hidden">Клиника</span><span>{doctorClinicName(user)}</span></div>
                <div className="grid grid-cols-[88px_1fr] items-center text-[12px] lg:block"><span className="font-medium text-muted-foreground lg:hidden">Доступ</span><StaffAccessStatus user={user} /></div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {showPasswordAction && (
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => onResetPassword?.(user)} disabled={busy}>
                      <KeyRound className="mr-2 h-4 w-4" aria-hidden />Задать новый пароль
                    </Button>
                  )}
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => onToggleAccess(user)} disabled={busy}>
                    {user.active ? "Отключить доступ" : "Вернуть доступ"}
                  </Button>
                  {showRoleAction && doctorRole && (
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => onToggleRole(user, doctorRole)} disabled={busy}>
                      {doctorRole.active === false ? "Вернуть роль врача" : "Приостановить роль врача"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AdminDoctorsPageLive() {
  const session = useSelfHostedApiSession();
  const [doctors, setDoctors] = useState<AdminUserDTO[]>([]);
  const [assistants, setAssistants] = useState<AdminUserDTO[]>([]);
  const [clinics, setClinics] = useState<AdminClinicDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [doctorNote, setDoctorNote] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [doctorPasswordVisible, setDoctorPasswordVisible] = useState(false);
  const [assistantPasswordVisible, setAssistantPasswordVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<StaffTab>("doctors");
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [staffQuery, setStaffQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [passwordUser, setPasswordUser] = useState<AdminUserDTO | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [passwordNote, setPasswordNote] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [form, setForm] = useState({
    displayName: "",
    email: "",
    password: "",
    role: "doctor" as "doctor" | "private_doctor",
    clinicId: "",
  });
  const [assistantNote, setAssistantNote] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [assistantForm, setAssistantForm] = useState({
    displayName: "",
    email: "",
    password: "",
    clinicId: "",
  });

  function handleAdminError(error: Parameters<typeof adminApiErrorText>[0]) {
    if (isAdminSessionExpiredError(error)) {
      setSessionExpired(true);
      setNote(null);
      setPasswordUser(null);
      return true;
    }
    setNote(adminApiErrorText(error));
    return false;
  }

  function goToLogin() {
    clearSelfHostedApiSession();
    window.location.assign("/self-hosted/login");
  }

  async function load() {
    setLoading(true);
    const [doctorsResult, usersResult, clinicsResult] = await Promise.all([
      listAdminDoctors({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
      listAdminUsers({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
      listAdminClinics({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
    ]);
    setLoading(false);
    if (doctorsResult.ok) setDoctors(doctorsResult.value ?? []);
    else handleAdminError(doctorsResult.error);
    if (usersResult.ok) {
      setAssistants((usersResult.value ?? []).filter((user) => user.roles.some((role) => role.role === "assistant")));
    } else {
      if (!handleAdminError(usersResult.error)) {
        setAssistantNote({ kind: "error", text: adminApiErrorText(usersResult.error) });
      }
    }
    if (clinicsResult.ok) {
      const nextClinics = clinicsResult.value ?? [];
      setClinics(nextClinics);
      setForm((current) => ({ ...current, clinicId: current.clinicId || nextClinics[0]?.id || "" }));
      setAssistantForm((current) => ({ ...current, clinicId: current.clinicId || nextClinics[0]?.id || "" }));
    } else {
      handleAdminError(clinicsResult.error);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  async function submitDoctor() {
    if (sessionExpired) return;
    const displayName = form.displayName.trim();
    const email = form.email.trim();
    const password = form.password.trim();
    const clinicId = form.clinicId;
    if (!displayName || !email || !password) {
      setDoctorNote({ kind: "error", text: "Укажите ФИО, почту и временный пароль врача." });
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setDoctorNote({ kind: "error", text: "Укажите рабочую почту врача." });
      return;
    }
    if (password.length < 10) {
      setDoctorNote({ kind: "error", text: "Временный пароль должен быть не короче 10 символов." });
      return;
    }
    if (!clinicId) {
      setDoctorNote({ kind: "error", text: "Выберите клинику для врача." });
      return;
    }
    setBusy(true);
    setDoctorNote(null);
    const result = await createAdminDoctor({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: {
        displayName,
        email,
        password,
        role: form.role,
        clinicId,
      },
    });
    setBusy(false);
    if (!result.ok) {
      if (!handleAdminError(result.error)) {
        setDoctorNote({ kind: "error", text: adminApiErrorText(result.error) });
      }
      return;
    }
    setDoctorNote({ kind: "success", text: `Врач добавлен: ${result.value?.displayName ?? form.displayName}` });
    setForm((current) => ({ ...current, displayName: "", email: "", password: "" }));
    setDoctorPasswordVisible(false);
    await load();
  }

  async function submitAssistant() {
    if (sessionExpired) return;
    const displayName = assistantForm.displayName.trim();
    const email = assistantForm.email.trim();
    const password = assistantForm.password.trim();
    const clinicId = assistantForm.clinicId;
    if (!displayName || !email || !password) {
      setAssistantNote({ kind: "error", text: "Укажите ФИО, почту и временный пароль ассистента." });
      return;
    }
    if (!EMAIL_PATTERN.test(email)) {
      setAssistantNote({ kind: "error", text: "Укажите рабочую почту ассистента." });
      return;
    }
    if (password.length < 10) {
      setAssistantNote({ kind: "error", text: "Временный пароль должен быть не короче 10 символов." });
      return;
    }
    if (!clinicId) {
      setAssistantNote({ kind: "error", text: "Выберите клинику для ассистента." });
      return;
    }
    setBusy(true);
    setAssistantNote(null);
    const result = await createAdminUser({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: { displayName, email, password, role: "assistant", clinicId },
    });
    setBusy(false);
    if (!result.ok) {
      if (!handleAdminError(result.error)) {
        setAssistantNote({ kind: "error", text: adminApiErrorText(result.error) });
      }
      return;
    }
    setAssistantNote({ kind: "success", text: `Ассистент добавлен: ${result.value?.displayName ?? displayName}` });
    setAssistantForm((current) => ({ ...current, displayName: "", email: "", password: "" }));
    setAssistantPasswordVisible(false);
    await load();
  }

  async function changeStaffAccess(user: AdminUserDTO, active: boolean) {
    if (sessionExpired) return;
    setBusy(true);
    const result = active
      ? await reactivateAdminUser({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          userId: user.id,
        })
      : await disableAdminUser({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          userId: user.id,
        });
    setBusy(false);
    if (!result.ok) {
      handleAdminError(result.error);
      return;
    }
    setNote(active ? `Доступ сотрудника возвращён: ${user.displayName}` : `Доступ сотрудника отключён: ${user.displayName}`);
    await load();
  }

  async function changeDoctorRoleStatus(doctor: AdminUserDTO, role: AdminRoleBindingDTO, status: "active" | "disabled") {
    if (sessionExpired) return;
    setBusy(true);
    const result = await setAdminUserRoleStatus({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      userId: doctor.id,
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
    setNote(status === "disabled" ? `Роль врача приостановлена: ${doctor.displayName}` : `Роль врача возвращена: ${doctor.displayName}`);
    await load();
  }

  function startPasswordReset(user: AdminUserDTO) {
    if (sessionExpired) return;
    setPasswordUser(user);
    setNewPassword("");
    setNewPasswordVisible(false);
    setPasswordNote(null);
  }

  async function submitPasswordReset() {
    if (!passwordUser || sessionExpired) return;
    if (newPassword.length < 10) {
      setPasswordNote({ kind: "error", text: "Новый пароль должен быть не короче 10 символов." });
      return;
    }
    setBusy(true);
    setPasswordNote(null);
    const result = await resetAdminUserPassword({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      userId: passwordUser.id,
      password: newPassword,
    });
    setBusy(false);
    if (!result.ok) {
      if (!handleAdminError(result.error)) {
        setPasswordNote({ kind: "error", text: adminApiErrorText(result.error) });
      }
      return;
    }
    setNewPassword("");
    setNewPasswordVisible(false);
    setPasswordNote({ kind: "success", text: `Новый пароль сохранён: ${passwordUser.displayName}` });
  }

  const normalizedQuery = staffQuery.trim().toLowerCase();
  const matchesQuery = (user: AdminUserDTO) =>
    !normalizedQuery || `${user.displayName} ${user.email} ${doctorClinicName(user)}`.toLowerCase().includes(normalizedQuery);
  const visibleDoctors = doctors.filter(matchesQuery);
  const visibleAssistants = assistants.filter(matchesQuery);
  const allStaff = [...new Map([...doctors, ...assistants].map((user) => [user.id, user])).values()];
  const visibleAccessStaff = allStaff.filter(
    (user) => matchesQuery(user) && (accessFilter === "all" || (accessFilter === "active" ? user.active : !user.active)),
  );

  function changeTab(value: string) {
    setActiveTab(value as StaffTab);
    setCreateFormOpen(false);
  }

  const doctorCreatePanel = createFormOpen && activeTab === "doctors" && (
    <Card className="p-3" role="region" aria-labelledby="add-doctor-heading">
      <div id="add-doctor-heading" className="text-[13px] font-semibold">Добавить врача</div>
      <p className="mt-1 text-[12px] text-muted-foreground">Создаётся новая учётная запись. Для действующего сотрудника используйте другую рабочую почту или обратитесь к системному администратору для добавления роли.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="space-y-1 text-[11px] font-medium" htmlFor="doctor-name"><span>ФИО врача</span><Input id="doctor-name" value={form.displayName} onChange={(event) => { setForm((current) => ({ ...current, displayName: event.target.value })); setDoctorNote(null); }} className="min-h-11" /></label>
        <label className="space-y-1 text-[11px] font-medium" htmlFor="doctor-email"><span>Рабочая почта</span><Input id="doctor-email" type="email" value={form.email} onChange={(event) => { setForm((current) => ({ ...current, email: event.target.value })); setDoctorNote(null); }} aria-label="Эл. почта" className="min-h-11" /></label>
        <label className="space-y-1 text-[11px] font-medium" htmlFor="doctor-password"><span>Временный пароль</span><div className="relative"><Input id="doctor-password" value={form.password} onChange={(event) => { setForm((current) => ({ ...current, password: event.target.value })); setDoctorNote(null); }} type={doctorPasswordVisible ? "text" : "password"} className="min-h-11 pr-12" /><PasswordVisibilityButton visible={doctorPasswordVisible} onToggle={() => setDoctorPasswordVisible((current) => !current)} subject="врача" /></div></label>
        <label className="space-y-1 text-[11px] font-medium" htmlFor="doctor-role"><span>Тип врача</span><select id="doctor-role" value={form.role} onChange={(event) => { setForm((current) => ({ ...current, role: event.target.value as "doctor" | "private_doctor" })); setDoctorNote(null); }} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-[13px]"><option value="doctor">Дерматолог клиники</option><option value="private_doctor">Частный дерматолог</option></select></label>
        <label className="space-y-1 text-[11px] font-medium" htmlFor="doctor-clinic"><span>Клиника</span><select id="doctor-clinic" value={form.clinicId} onChange={(event) => { setForm((current) => ({ ...current, clinicId: event.target.value })); setDoctorNote(null); }} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-[13px]">{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>
      </div>
      {doctorNote && <div role={doctorNote.kind === "error" ? "alert" : "status"} aria-live="polite" className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${doctorNote.kind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success"}`}>{doctorNote.text}</div>}
      <div className="mt-3 flex justify-end"><Button type="button" className="min-h-11" onClick={submitDoctor} disabled={busy || sessionExpired || clinics.length === 0}><UserPlus className="mr-2 h-4 w-4" aria-hidden />Добавить врача</Button></div>
    </Card>
  );

  const assistantCreatePanel = createFormOpen && activeTab === "assistants" && (
    <Card className="p-3" role="region" aria-labelledby="add-assistant-heading">
      <div id="add-assistant-heading" className="text-[13px] font-semibold">Добавить ассистента</div>
      <p className="mt-1 text-[12px] text-muted-foreground">Ассистент сможет работать со съёмкой и загружать снимки только в выбранной клинике.</p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-[11px] font-medium" htmlFor="assistant-name"><span>ФИО ассистента</span><Input id="assistant-name" value={assistantForm.displayName} onChange={(event) => { setAssistantForm((current) => ({ ...current, displayName: event.target.value })); setAssistantNote(null); }} className="min-h-11" /></label>
        <label className="space-y-1 text-[11px] font-medium" htmlFor="assistant-email"><span>Рабочая почта</span><Input id="assistant-email" type="email" value={assistantForm.email} onChange={(event) => { setAssistantForm((current) => ({ ...current, email: event.target.value })); setAssistantNote(null); }} aria-label="Эл. почта ассистента" className="min-h-11" /></label>
        <label className="space-y-1 text-[11px] font-medium" htmlFor="assistant-password"><span>Временный пароль</span><div className="relative"><Input id="assistant-password" value={assistantForm.password} onChange={(event) => { setAssistantForm((current) => ({ ...current, password: event.target.value })); setAssistantNote(null); }} aria-label="Временный пароль ассистента" type={assistantPasswordVisible ? "text" : "password"} className="min-h-11 pr-12" /><PasswordVisibilityButton visible={assistantPasswordVisible} onToggle={() => setAssistantPasswordVisible((current) => !current)} subject="ассистента" /></div></label>
        <label className="space-y-1 text-[11px] font-medium" htmlFor="assistant-clinic"><span>Клиника</span><select id="assistant-clinic" value={assistantForm.clinicId} onChange={(event) => { setAssistantForm((current) => ({ ...current, clinicId: event.target.value })); setAssistantNote(null); }} aria-label="Клиника ассистента" className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-[13px]">{clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select></label>
      </div>
      {assistantNote && <div role={assistantNote.kind === "error" ? "alert" : "status"} aria-live="polite" className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${assistantNote.kind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success"}`}>{assistantNote.text}</div>}
      <div className="mt-3 flex justify-end"><Button type="button" className="min-h-11" onClick={submitAssistant} disabled={busy || sessionExpired || clinics.length === 0}><UserPlus className="mr-2 h-4 w-4" aria-hidden />Добавить ассистента</Button></div>
    </Card>
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Врачи и ассистенты" subtitle="Состав сотрудников, роли и доступ к выбранной клинике." />
      <div className="space-y-3 p-3 sm:p-4">
        <StaffMetricsStrip doctors={doctors} assistants={assistants} />
        {sessionExpired && (
          <Card role="alert" className="border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="text-[13px] font-semibold">Сессия истекла</div>
            <p className="mt-1 text-[12px]">Изменения сотрудников не сохраняются, пока вы не войдёте заново.</p>
            <Button type="button" className="mt-3 min-h-11" onClick={goToLogin}>Войти заново</Button>
          </Card>
        )}
        {note && !sessionExpired && <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">{note}</div>}
        <Tabs value={activeTab} onValueChange={changeTab}>
          <TabsList className="h-auto min-h-11 w-full justify-start overflow-x-auto" aria-label="Разделы сотрудников">
            <TabsTrigger value="doctors" className="min-h-11 gap-2"><Stethoscope className="h-4 w-4" aria-hidden />Врачи</TabsTrigger>
            <TabsTrigger value="assistants" className="min-h-11 gap-2"><UserRoundCog className="h-4 w-4" aria-hidden />Ассистенты</TabsTrigger>
            <TabsTrigger value="access" className="min-h-11 gap-2"><KeyRound className="h-4 w-4" aria-hidden />Доступ</TabsTrigger>
          </TabsList>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} aria-label="Поиск сотрудников" placeholder="Имя, рабочая почта или клиника" className="min-h-11 pl-9" /></label>
            {activeTab === "access" ? (
              <label className="flex items-center gap-2 text-[12px] font-medium"><span>Состояние</span><select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value as AccessFilter)} aria-label="Фильтр доступа" className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"><option value="all">Любой доступ</option><option value="active">Доступ включён</option><option value="disabled">Доступ отключён</option></select></label>
            ) : (
              <Button type="button" className="min-h-11" onClick={() => setCreateFormOpen((current) => !current)} disabled={sessionExpired}><UserPlus className="mr-2 h-4 w-4" aria-hidden />{activeTab === "doctors" ? "Добавить врача" : "Добавить ассистента"}</Button>
            )}
          </div>

          <TabsContent value="doctors" className="space-y-3">{doctorCreatePanel}<StaffDirectory title="Врачи клиники" users={visibleDoctors} loading={loading} busy={busy || sessionExpired} showRoleAction onToggleAccess={(user) => void changeStaffAccess(user, !user.active)} onToggleRole={(user, role) => void changeDoctorRoleStatus(user, role, role.active === false ? "active" : "disabled")} /></TabsContent>
          <TabsContent value="assistants" className="space-y-3">{assistantCreatePanel}<StaffDirectory title="Ассистенты клиники" users={visibleAssistants} loading={loading} busy={busy || sessionExpired} showRoleAction={false} onToggleAccess={(user) => void changeStaffAccess(user, !user.active)} onToggleRole={() => {}} /></TabsContent>
          <TabsContent value="access" className="space-y-3">
            <div className="flex flex-col gap-1 rounded-md border-l-4 border-warning bg-warning/5 px-3 py-2 text-[12px]"><strong>Учётная запись и роль — разные уровни доступа.</strong><span className="text-muted-foreground">Отключение доступа блокирует вход полностью. Приостановка роли убирает только рабочее место врача.</span></div>
            {passwordUser && (
              <Card className="p-3" role="region" aria-label={`Новый пароль для ${passwordUser.displayName}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold">Новый пароль для {passwordUser.displayName}</div>
                    <p className="mt-1 text-[12px] text-muted-foreground">Текущий пароль посмотреть нельзя. Введите новый пароль и передайте его сотруднику безопасным способом.</p>
                  </div>
                  <div className="min-w-0 space-y-1 text-[11px] font-medium lg:w-80">
                    <label htmlFor="staff-new-password">Новый пароль</label>
                    <div className="relative">
                      <Input id="staff-new-password" value={newPassword} onChange={(event) => { setNewPassword(event.target.value); setPasswordNote(null); }} type={newPasswordVisible ? "text" : "password"} className="min-h-11 pr-12" />
                      <PasswordVisibilityButton visible={newPasswordVisible} onToggle={() => setNewPasswordVisible((current) => !current)} subject="сотрудника" passwordLabel="новый пароль" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" className="min-h-11" onClick={() => void submitPasswordReset()} disabled={busy || sessionExpired}>Сохранить пароль</Button>
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => { setPasswordUser(null); setPasswordNote(null); setNewPassword(""); }} disabled={busy}>Отмена</Button>
                  </div>
                </div>
                {passwordNote && <div role={passwordNote.kind === "error" ? "alert" : "status"} aria-live="polite" className={`mt-3 rounded-md border px-3 py-2 text-[12px] ${passwordNote.kind === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-success/30 bg-success/5 text-success"}`}>{passwordNote.text}</div>}
              </Card>
            )}
            <StaffDirectory title="Управление доступом" users={visibleAccessStaff} loading={loading} busy={busy || sessionExpired} showRoleAction showPasswordAction onResetPassword={startPasswordReset} onToggleAccess={(user) => void changeStaffAccess(user, !user.active)} onToggleRole={(user, role) => void changeDoctorRoleStatus(user, role, role.active === false ? "active" : "disabled")} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function AdminDoctorsPage() {
  if (isProductionAppMode()) return <AdminDoctorsPageLive />;
  return <AdminDoctorsPageDemo />;
}

function AdminDoctorsPageDemo() {
  const clinics = getClinics();
  const appointments = getAppointments();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [actionNote, setActionNote] = useState<string | null>(null);

  const clinicNameById = useMemo(() => {
    const m = new Map<string, string>();
    clinics.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clinics]);

  // Реальная нагрузка по записям — суммируем для контекста.
  const realLoadById = useMemo(() => {
    const m = new Map<string, number>();
    appointments.forEach((a) => m.set(a.doctorId, (m.get(a.doctorId) ?? 0) + 1));
    return m;
  }, [appointments]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DOCTOR_ROWS.filter((r) => {
      if (filter === "active" && !r.active) return false;
      if (filter === "needs_check" && r.license !== "needs_check") return false;
      if (q && !`${r.fullName} ${r.specialty}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 4,
    desktopPageSize: 8,
    deps: [filter, query],
  });
  const visibleRows = pagination.visible;

  const note = (text: string) => setActionNote(text);

  const activeFilterLabels =
    filter === "all" ? [] : [`фильтр: ${FILTERS.find((f) => f.key === filter)?.label}`];
  const resetAll = () => {
    setFilter("all");
    setQuery("");
  };
  const activeDoctors = DOCTOR_ROWS.filter((r) => r.active).length;
  const licenseIssues = DOCTOR_ROWS.filter((r) => r.license !== "valid").length;
  const profileReady = DOCTOR_ROWS.length - DOCTOR_ROWS.filter((r) => r.license === "needs_check").length;
  const scheduleColumns = DOCTOR_ROWS.filter((r) => r.active).slice(0, 4);
  const isEmpty = rows.length === 0;
  const emptyState = (
    <ListEmptyState
      itemNoun="врачей"
      query={query}
      activeFilters={activeFilterLabels}
      totalUnfiltered={DOCTOR_ROWS.length}
      onReset={resetAll}
      hint="В учебном списке фиксированный набор врачей. Рабочие изменения выполняются в системе клиники."
    />
  );

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Врачи и ассистенты" subtitle="Состав, специализации, расписание и доступ к съёмке." />

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

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_1fr_0.9fr]">
          <AdminOpsCard
            title="Готовность врачей"
            hint="Только операционная готовность: профили, лицензии, расписание; клинические данные не выводятся."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                onClick={() => note("Проверка готовности врачей подготовлена локально. Рабочий пересчёт выполняется в системе клиники.")}
              >
                Проверить готовность врачей
              </Button>
            }
          >
            <div className="grid grid-cols-3 gap-2">
              <AdminMetric label="Активны" value={activeDoctors} tone="success" />
              <AdminMetric label="Лицензии" value={licenseIssues} tone={licenseIssues ? "warning" : "success"} />
              <AdminMetric label="Профили" value={`${profileReady}/${DOCTOR_ROWS.length}`} tone="info" />
            </div>
            <ul className="mt-3 grid gap-1.5 text-[12px] text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Лицензии и профили</span> — срок действия, заполненность,
                блокеры допуска.
              </li>
              <li>
                <span className="font-medium text-foreground">Смены</span> — расписание врача и ближайшее доступное время.
              </li>
            </ul>
          </AdminOpsCard>

          <AdminOpsCard
            title="Расписание приёма"
            hint="Администратор видит управляемую сетку дня без ухода в клиническую карточку."
          >
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Врачи на сегодня
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {scheduleColumns.map((r) => (
                <div key={r.id} className="rounded-md border border-border bg-surface p-2">
                  <div className="truncate text-[12px] font-medium">{r.fullName}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{r.nextSlot}</div>
                  <div className="mt-1 grid grid-cols-2 gap-1 text-[11px]">
                    <span className="rounded bg-muted px-1.5 py-1">09:30 · прием</span>
                    <span className="rounded bg-muted px-1.5 py-1">12:00 · съемка</span>
                  </div>
                </div>
              ))}
            </div>
          </AdminOpsCard>

          <AdminOpsCard title="Права и роли" hint="Разделение доступа для расписания, услуг и приёмов.">
            <div className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-2">
                <span>Дерматолог</span>
                <span className="text-[11px] text-muted-foreground">визиты, съёмка, отчёты</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-2">
                <span>Администратор</span>
                <span className="text-[11px] text-muted-foreground">расписание, услуги, филиалы</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-2.5 py-2">
                <span>Ассистент</span>
                <span className="text-[11px] text-muted-foreground">может быть отключён</span>
              </div>
            </div>
          </AdminOpsCard>
        </div>

        {/* Фильтры + поиск */}
        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div
              role="tablist"
              aria-label="Фильтр врачей"
              className="flex flex-wrap gap-1"
            >
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
                placeholder="Поиск по имени или специализации"
                aria-label="Поиск врачей"
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

        {/* Desktop таблица */}
        <Card className={`hidden p-0 md:block ${isEmpty ? "md:hidden" : ""}`}>
          <table className="w-full text-[12px]">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Врач</th>
                <th className="px-3 py-2">Специализация</th>
                <th className="px-3 py-2">Клиника</th>
                <th className="px-3 py-2">Расписание</th>
                <th className="px-3 py-2 text-right">Нагрузка</th>
                <th className="px-3 py-2">Лицензия</th>
                <th className="px-3 py-2 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{r.fullName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.specialty}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {clinicNameById.get(r.clinicId) ?? r.clinicId}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.scheduleSummary}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.todayLoad}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        /{realLoadById.get(r.id) ?? 0}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: LICENSE_TONE[r.license],
                          border: `1px solid ${LICENSE_TONE[r.license]}`,
                        }}
                      >
                        {LICENSE_LABEL[r.license]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() =>
                            note(`Расписание врача «${r.fullName}» подготовлено локально. Рабочее открытие выполняется в системе клиники.`)
                          }
                        >
                          Открыть расписание
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() =>
                            note(`Проверка лицензии врача «${r.fullName}» подготовлена локально.`)
                          }
                        >
                          Проверить лицензию
                        </Button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Mobile карточки */}
        <div className={`grid grid-cols-1 gap-2 md:hidden ${isEmpty ? "hidden" : ""}`}>
          {visibleRows.map((r) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{r.fullName}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {r.specialty} · {r.roleLabel}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      color: LICENSE_TONE[r.license],
                      border: `1px solid ${LICENSE_TONE[r.license]}`,
                    }}
                  >
                    {LICENSE_LABEL[r.license]}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Клиника</dt>
                  <dd className="text-right">
                    {clinicNameById.get(r.clinicId) ?? r.clinicId}
                  </dd>
                  <dt className="text-muted-foreground">Расписание</dt>
                  <dd className="text-right">{r.scheduleSummary}</dd>
                  <dt className="text-muted-foreground">Сегодня</dt>
                  <dd className="text-right tabular-nums">{r.todayLoad}</dd>
                  <dt className="text-muted-foreground">Ближайшее время</dt>
                  <dd className="text-right">{r.nextSlot}</dd>
                </dl>
                <div className="mt-3 flex flex-col gap-1.5">
                  <Button
                    variant="outline"
                    className="min-h-[44px] text-[12px]"
                    onClick={() =>
                      note(`Расписание врача «${r.fullName}» подготовлено локально. Рабочее открытие выполняется в системе клиники.`)
                    }
                  >
                    Открыть расписание
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] text-[12px]"
                    onClick={() =>
                      note(`Проверка лицензии врача «${r.fullName}» подготовлена локально.`)
                    }
                  >
                    Проверить лицензию
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
          itemNoun="врачей"
        />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { ListEmptyState } from "@/components/admin/ListEmptyState";
import { AdminMetric, AdminOpsCard } from "@/components/admin/AdminOpsCard";
import { useListPagination } from "@/lib/use-list-pagination";
import { getClinics, getAppointments } from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";
import { isProductionAppMode } from "@/lib/app-mode";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  createAdminDoctor,
  createAdminUser,
  disableAdminUser,
  listAdminClinics,
  listAdminDoctors,
  listAdminUsers,
  reactivateAdminUser,
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
}: {
  visible: boolean;
  onToggle: () => void;
  subject: "врача" | "ассистента";
}) {
  const label = `${visible ? "Скрыть" : "Показать"} временный пароль ${subject}`;
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

function AdminDoctorsPageLive() {
  const session = useSelfHostedApiSession();
  const [doctors, setDoctors] = useState<AdminUserDTO[]>([]);
  const [assistants, setAssistants] = useState<AdminUserDTO[]>([]);
  const [clinics, setClinics] = useState<AdminClinicDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [doctorNote, setDoctorNote] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [doctorPasswordVisible, setDoctorPasswordVisible] = useState(false);
  const [assistantPasswordVisible, setAssistantPasswordVisible] = useState(false);
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

  async function load() {
    setLoading(true);
    const [doctorsResult, usersResult, clinicsResult] = await Promise.all([
      listAdminDoctors({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
      listAdminUsers({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
      listAdminClinics({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
    ]);
    setLoading(false);
    if (doctorsResult.ok) setDoctors(doctorsResult.value ?? []);
    else setNote(adminApiErrorText(doctorsResult.error));
    if (usersResult.ok) {
      setAssistants((usersResult.value ?? []).filter((user) => user.roles.some((role) => role.role === "assistant")));
    } else {
      setAssistantNote({ kind: "error", text: adminApiErrorText(usersResult.error) });
    }
    if (clinicsResult.ok) {
      const nextClinics = clinicsResult.value ?? [];
      setClinics(nextClinics);
      setForm((current) => ({ ...current, clinicId: current.clinicId || nextClinics[0]?.id || "" }));
      setAssistantForm((current) => ({ ...current, clinicId: current.clinicId || nextClinics[0]?.id || "" }));
    } else {
      setNote(adminApiErrorText(clinicsResult.error));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  async function submitDoctor() {
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
      setDoctorNote({ kind: "error", text: adminApiErrorText(result.error) });
      return;
    }
    setDoctorNote({ kind: "success", text: `Врач добавлен: ${result.value?.displayName ?? form.displayName}` });
    setForm((current) => ({ ...current, displayName: "", email: "", password: "" }));
    setDoctorPasswordVisible(false);
    await load();
  }

  async function submitAssistant() {
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
      setAssistantNote({ kind: "error", text: adminApiErrorText(result.error) });
      return;
    }
    setAssistantNote({ kind: "success", text: `Ассистент добавлен: ${result.value?.displayName ?? displayName}` });
    setAssistantForm((current) => ({ ...current, displayName: "", email: "", password: "" }));
    setAssistantPasswordVisible(false);
    await load();
  }

  async function changeDoctorAccess(doctor: AdminUserDTO, active: boolean) {
    setBusy(true);
    const result = active
      ? await reactivateAdminUser({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          userId: doctor.id,
        })
      : await disableAdminUser({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          userId: doctor.id,
        });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setNote(active ? `Доступ врача возвращён: ${doctor.displayName}` : `Доступ врача отключён: ${doctor.displayName}`);
    await load();
  }

  async function changeDoctorRoleStatus(doctor: AdminUserDTO, role: AdminRoleBindingDTO, status: "active" | "disabled") {
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
      setNote(adminApiErrorText(result.error));
      return;
    }
    setNote(status === "disabled" ? `Роль врача приостановлена: ${doctor.displayName}` : `Роль врача возвращена: ${doctor.displayName}`);
    await load();
  }

  const activeDoctors = doctors.filter((doctor) => doctor.active).length;
  const activeAssistants = assistants.filter((assistant) => assistant.active).length;
  const privateDoctors = doctors.filter((doctor) => doctor.roles.some((role) => role.role === "private_doctor")).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Врачи и ассистенты" subtitle="Новые учётные записи и доступ к выбранной клинике." />
      <div className="space-y-3 p-3 sm:p-4">
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Рабочий режим: врач или ассистент получает учётную запись, роль и привязку к выбранной клинике. Действие пишется в аудит.
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AdminOpsCard title="Врачи" hint="активный доступ">
            <AdminMetric label="Активны" value={activeDoctors} tone="success" />
          </AdminOpsCard>
          <AdminOpsCard title="Ассистенты" hint="доступ к съёмке">
            <AdminMetric label="Активны" value={activeAssistants} tone="success" />
          </AdminOpsCard>
          <AdminOpsCard title="Частные врачи" hint="отдельная роль">
            <AdminMetric label="В списке" value={privateDoctors} tone="info" />
          </AdminOpsCard>
          <AdminOpsCard title="Клиники" hint="доступны для привязки">
            <AdminMetric label="Всего" value={clinics.length} />
          </AdminOpsCard>
        </div>

        <Card className="p-3" role="region" aria-labelledby="add-doctor-heading">
          <div id="add-doctor-heading" className="mb-3 text-[13px] font-semibold">Добавить врача</div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Создаётся новая учётная запись. Для действующего сотрудника используйте другую рабочую почту или обратитесь к системному администратору для добавления роли.
          </p>
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-5">
            <Input
              value={form.displayName}
              onChange={(event) => {
                setForm((current) => ({ ...current, displayName: event.target.value }));
                setDoctorNote(null);
              }}
              placeholder="ФИО врача"
              aria-label="ФИО врача"
              className="min-h-11"
            />
            <Input
              value={form.email}
              onChange={(event) => {
                setForm((current) => ({ ...current, email: event.target.value }));
                setDoctorNote(null);
              }}
              placeholder="Эл. почта"
              aria-label="Эл. почта"
              className="min-h-11"
            />
            <div className="relative">
              <Input
                value={form.password}
                onChange={(event) => {
                  setForm((current) => ({ ...current, password: event.target.value }));
                  setDoctorNote(null);
                }}
                placeholder="Временный пароль"
                aria-label="Временный пароль"
                type={doctorPasswordVisible ? "text" : "password"}
                className="min-h-11 pr-12"
              />
              <PasswordVisibilityButton
                visible={doctorPasswordVisible}
                onToggle={() => setDoctorPasswordVisible((current) => !current)}
                subject="врача"
              />
            </div>
            <select
              value={form.role}
              onChange={(event) => {
                setForm((current) => ({ ...current, role: event.target.value as "doctor" | "private_doctor" }));
                setDoctorNote(null);
              }}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Тип врача"
            >
              <option value="doctor">Дерматолог клиники</option>
              <option value="private_doctor">Частный дерматолог</option>
            </select>
            <select
              value={form.clinicId}
              onChange={(event) => {
                setForm((current) => ({ ...current, clinicId: event.target.value }));
                setDoctorNote(null);
              }}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Клиника"
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" className="mt-3 min-h-11" onClick={submitDoctor} disabled={busy || clinics.length === 0}>
            Добавить врача
          </Button>
          {doctorNote && (
            <div
              role={doctorNote.kind === "error" ? "alert" : "status"}
              aria-live="polite"
              className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
            >
              {doctorNote.text}
            </div>
          )}
        </Card>

        <Card className="p-3" role="region" aria-labelledby="add-assistant-heading">
          <div id="add-assistant-heading" className="text-[13px] font-semibold">Добавить ассистента</div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Создаётся новая учётная запись. Ассистент сможет работать со съёмкой и загружать снимки только в выбранной клинике.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-4">
            <Input
              value={assistantForm.displayName}
              onChange={(event) => {
                setAssistantForm((current) => ({ ...current, displayName: event.target.value }));
                setAssistantNote(null);
              }}
              placeholder="ФИО ассистента"
              aria-label="ФИО ассистента"
              className="min-h-11"
            />
            <Input
              value={assistantForm.email}
              onChange={(event) => {
                setAssistantForm((current) => ({ ...current, email: event.target.value }));
                setAssistantNote(null);
              }}
              placeholder="Эл. почта ассистента"
              aria-label="Эл. почта ассистента"
              className="min-h-11"
            />
            <div className="relative">
              <Input
                value={assistantForm.password}
                onChange={(event) => {
                  setAssistantForm((current) => ({ ...current, password: event.target.value }));
                  setAssistantNote(null);
                }}
                placeholder="Временный пароль ассистента"
                aria-label="Временный пароль ассистента"
                type={assistantPasswordVisible ? "text" : "password"}
                className="min-h-11 pr-12"
              />
              <PasswordVisibilityButton
                visible={assistantPasswordVisible}
                onToggle={() => setAssistantPasswordVisible((current) => !current)}
                subject="ассистента"
              />
            </div>
            <select
              value={assistantForm.clinicId}
              onChange={(event) => {
                setAssistantForm((current) => ({ ...current, clinicId: event.target.value }));
                setAssistantNote(null);
              }}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              aria-label="Клиника ассистента"
            >
              {clinics.map((clinic) => (
                <option key={clinic.id} value={clinic.id}>{clinic.name}</option>
              ))}
            </select>
          </div>
          <Button type="button" className="mt-3 min-h-11" onClick={submitAssistant} disabled={busy || clinics.length === 0}>
            Добавить ассистента
          </Button>
          {assistantNote && (
            <div
              role={assistantNote.kind === "error" ? "alert" : "status"}
              aria-live="polite"
              className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
            >
              {assistantNote.text}
            </div>
          )}
          <div className="mt-3 border-t border-border pt-3">
            <div className="text-[12px] font-medium">{loading ? "Загрузка ассистентов" : `Ассистенты: ${assistants.length}`}</div>
            {assistants.length === 0 ? (
              <div className="mt-2 text-[12px] text-muted-foreground">Ассистенты ещё не добавлены.</div>
            ) : (
              <div className="mt-2 grid grid-cols-1 divide-y divide-border">
                {assistants.map((assistant) => (
                  <div key={assistant.id} className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[1.2fr_1fr_0.8fr]">
                    <div>
                      <div className="text-[13px] font-semibold">{assistant.displayName}</div>
                      <div className="text-[11px] text-muted-foreground">{assistant.email}</div>
                    </div>
                    <div className="text-[12px] text-muted-foreground">{doctorClinicName(assistant)}</div>
                    <div className="text-[12px]">{assistant.active ? "Доступ включён" : "Доступ отключён"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-3 py-2 text-[12px] font-medium">
            {loading ? "Загрузка врачей" : `В списке: ${doctors.length}`}
          </div>
          <div className="grid grid-cols-1 divide-y divide-border">
            {doctors.map((doctor) => (
              <div key={doctor.id} className="grid grid-cols-1 gap-2 p-3 lg:grid-cols-[1.2fr_0.8fr_1fr_0.8fr_auto]">
                <div>
                  <div className="text-[13px] font-semibold">{doctor.displayName}</div>
                  <div className="text-[11px] text-muted-foreground">{doctor.email}</div>
                </div>
                <div className="text-[12px] text-muted-foreground">{doctorRoleLabel(primaryDoctorRole(doctor)?.role ?? "doctor")}</div>
                <div className="text-[12px] text-muted-foreground">{doctorClinicName(doctor)}</div>
                <div className="text-[12px]">{doctor.active ? "Доступ включён" : "Доступ отключён"}</div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void changeDoctorAccess(doctor, !doctor.active)}
                    disabled={busy}
                  >
                    {doctor.active ? "Отключить доступ" : "Вернуть доступ"}
                  </Button>
                </div>
                {primaryDoctorRole(doctor) && (
                  <div className="flex flex-wrap gap-2 lg:col-span-5">
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() =>
                        void changeDoctorRoleStatus(
                          doctor,
                          primaryDoctorRole(doctor)!,
                          primaryDoctorRole(doctor)!.active === false ? "active" : "disabled",
                        )
                      }
                      disabled={busy}
                    >
                      {primaryDoctorRole(doctor)!.active === false ? "Вернуть роль врача" : "Приостановить роль врача"}
                    </Button>
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

import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { updateSelfHostedPatientPortalReminderPreferences } from "@/lib/self-hosted-patient-portal-api";
import { usePatientPortalOverview } from "./usePatientPortalOverview";

export default function MeRemindersPageLive() {
  const { session, status, overview, error, reload } = usePatientPortalOverview();
  const [appointmentRemindersEnabled, setAppointmentRemindersEnabled] = useState(true);
  const [reportNotificationsEnabled, setReportNotificationsEnabled] = useState(true);
  const [preferredChannel, setPreferredChannel] = useState<"email" | "phone" | "none">("email");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!overview) return;
    setAppointmentRemindersEnabled(overview.reminderPreferences.appointmentRemindersEnabled);
    setReportNotificationsEnabled(overview.reminderPreferences.reportNotificationsEnabled);
    setPreferredChannel(overview.reminderPreferences.preferredChannel);
  }, [overview]);

  async function submitReminderPreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveStatus("saving");
    setSaveMessage("Сохраняем настройки напоминаний.");
    const result = await updateSelfHostedPatientPortalReminderPreferences({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: {
        appointmentRemindersEnabled,
        reportNotificationsEnabled,
        preferredChannel,
      },
    });
    if (!result.ok) {
      setSaveStatus("error");
      setSaveMessage(result.error.message);
      return;
    }
    setSaveStatus("saved");
    setSaveMessage("Настройки напоминаний сохранены.");
    await reload();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Напоминания" subtitle="Production · self-hosted reminder preferences" />
      <div className="space-y-3 p-3 sm:p-4">
        {status === "missing_session" && (
          <Card className="p-4">
            <div className="text-[13px] text-muted-foreground">Войдите в production, чтобы увидеть напоминания.</div>
            <Button asChild className="mt-3 min-h-[44px] sm:min-h-[36px]">
              <Link to="/self-hosted/login">Войти</Link>
            </Button>
          </Card>
        )}
        {status === "loading" && <Card className="p-4 text-[13px] text-muted-foreground">Загружаем напоминания…</Card>}
        {status === "error" && <Card className="p-4 text-[13px] text-destructive" role="alert">{error}</Card>}
        {overview && (
          <>
            <Card className="p-4">
              <div className="text-[13px] font-semibold">Настройки напоминаний</div>
              <form className="mt-3 grid gap-3" onSubmit={submitReminderPreferences}>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={appointmentRemindersEnabled}
                    onChange={(event) => setAppointmentRemindersEnabled(event.target.checked)}
                  />
                  Напоминать о ближайшем приёме
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={reportNotificationsEnabled}
                    onChange={(event) => setReportNotificationsEnabled(event.target.checked)}
                  />
                  Сообщать о новых заключениях
                </label>
                <label className="grid gap-1 text-[12px] font-medium sm:max-w-xs">
                  Канал уведомлений
                  <select
                    aria-label="Канал уведомлений пациента"
                    className="min-h-[40px] rounded-md border border-input bg-background px-3 text-[13px]"
                    value={preferredChannel}
                    onChange={(event) => setPreferredChannel(event.target.value as "email" | "phone" | "none")}
                  >
                    <option value="email">Email</option>
                    <option value="phone">Телефон</option>
                    <option value="none">Не отправлять</option>
                  </select>
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={saveStatus === "saving"}>
                    {saveStatus === "saving" ? "Сохраняем…" : "Сохранить настройки"}
                  </Button>
                  <div
                    role={saveStatus === "error" ? "alert" : "status"}
                    aria-live={saveStatus === "error" ? "assertive" : "polite"}
                    className={saveStatus === "error" ? "text-[13px] text-destructive" : "text-[13px] text-muted-foreground"}
                  >
                    {saveMessage}
                  </div>
                </div>
              </form>
            </Card>
            <Card className="overflow-hidden">
              {overview.reminders.length === 0 ? (
                <div className="p-4 text-[13px] text-muted-foreground">Напоминаний нет.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {overview.reminders.map((reminder) => (
                    <li key={reminder.id} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[13px] font-semibold">
                          <Bell className="h-4 w-4" aria-hidden />
                          {reminder.title}
                        </div>
                        <div className="mt-1 text-[12px] text-muted-foreground">
                          {reminder.source} · {reminder.status}
                        </div>
                      </div>
                      <div className="shrink-0 text-[12px] text-muted-foreground">{formatDate(reminder.dueAt)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

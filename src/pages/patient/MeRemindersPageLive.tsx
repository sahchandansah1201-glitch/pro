import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import {
  createSelfHostedPatientFollowUpMessage,
  listSelfHostedPatientFollowUps,
  type SelfHostedClinicalFollowUp,
} from "@/lib/self-hosted-follow-up-api";
import { updateSelfHostedPatientPortalReminderPreferences } from "@/lib/self-hosted-patient-portal-api";
import { usePatientPortalOverview } from "./usePatientPortalOverview";

export default function MeRemindersPageLive() {
  const { session, status, overview, error, reload } = usePatientPortalOverview();
  const [appointmentRemindersEnabled, setAppointmentRemindersEnabled] = useState(true);
  const [reportNotificationsEnabled, setReportNotificationsEnabled] = useState(true);
  const [preferredChannel, setPreferredChannel] = useState<"email" | "phone" | "none">("email");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<SelfHostedClinicalFollowUp[]>([]);
  const [followUpsStatus, setFollowUpsStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [followUpsMessage, setFollowUpsMessage] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyBusyId, setReplyBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!overview) return;
    setAppointmentRemindersEnabled(overview.reminderPreferences.appointmentRemindersEnabled);
    setReportNotificationsEnabled(overview.reminderPreferences.reportNotificationsEnabled);
    setPreferredChannel(overview.reminderPreferences.preferredChannel);
  }, [overview]);

  useEffect(() => {
    if (!overview) return;
    let cancelled = false;
    async function loadFollowUps() {
      setFollowUpsStatus("loading");
      const result = await listSelfHostedPatientFollowUps({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      });
      if (cancelled) return;
      if (!result.ok) {
        setFollowUpsStatus("error");
        setFollowUpsMessage(result.error.message);
        return;
      }
      setFollowUps(result.value || []);
      setFollowUpsStatus("ready");
      setFollowUpsMessage(null);
    }
    void loadFollowUps();
    return () => {
      cancelled = true;
    };
  }, [overview, session.apiBaseUrl, session.apiToken]);

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

  async function submitFollowUpReply(followUpId: string) {
    const body = (replyDrafts[followUpId] || "").trim();
    if (!body) {
      setFollowUpsStatus("error");
      setFollowUpsMessage("Введите текст ответа клинике.");
      return;
    }
    setReplyBusyId(followUpId);
    setFollowUpsMessage("Отправляем ответ клинике.");
    const result = await createSelfHostedPatientFollowUpMessage({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      followUpId,
      payload: { body },
    });
    setReplyBusyId(null);
    if (!result.ok) {
      setFollowUpsStatus("error");
      setFollowUpsMessage(result.error.message);
      return;
    }
    setReplyDrafts((current) => ({ ...current, [followUpId]: "" }));
    setFollowUpsStatus("ready");
    setFollowUpsMessage("Ответ клинике сохранён.");
    const next = await listSelfHostedPatientFollowUps({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    });
    if (next.ok) setFollowUps(next.value || []);
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Напоминания" subtitle="Настройки напоминаний и сообщения клиники" />
      <div className="space-y-3 p-3 sm:p-4">
        {status === "missing_session" && (
          <Card className="p-4">
            <div className="text-[13px] text-muted-foreground">Войдите в личный кабинет, чтобы увидеть напоминания.</div>
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
                    <option value="email">Эл. почта</option>
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
            <Card className="overflow-hidden" aria-label="Контроль и сообщения клиники">
              <div className="flex flex-col gap-1 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[13px] font-semibold">Контроль и сообщения клиники</div>
                  <div className="text-[12px] text-muted-foreground">
                    Здесь отображаются контрольные сообщения и ответы клинике.
                  </div>
                </div>
                <div
                  role={followUpsStatus === "error" ? "alert" : "status"}
                  aria-live={followUpsStatus === "error" ? "assertive" : "polite"}
                  className={followUpsStatus === "error" ? "text-[12px] text-destructive" : "text-[12px] text-muted-foreground"}
                >
                  {followUpsStatus === "loading" ? "Загружаем контрольные задачи…" : followUpsMessage}
                </div>
              </div>
              {followUpsStatus === "ready" && followUps.length === 0 ? (
                <div className="p-4 text-[13px] text-muted-foreground">Контрольных сообщений нет.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {followUps.map((followUp) => (
                    <li key={followUp.id} className="space-y-3 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold">{followUp.reason || "Контроль"}</div>
                          <div className="mt-1 text-[12px] text-muted-foreground">
                            {followUp.status} · {followUp.priority} · {formatDate(followUp.dueAt)}
                          </div>
                          {followUp.patientSummary && (
                            <div className="mt-2 text-[13px] text-foreground">{followUp.patientSummary}</div>
                          )}
                          {followUp.latestMessage?.body && (
                            <div className="mt-2 rounded border border-border bg-muted/30 p-2 text-[12px] text-muted-foreground">
                              {followUp.latestMessage.body}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-[12px] text-muted-foreground">
                          сообщений: {followUp.messageCount}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                        <label className="grid gap-1 text-[12px] font-medium">
                          Ответ клинике
                          <Textarea
                            aria-label={`Ответ клинике по контролю ${followUp.reason || followUp.id}`}
                            value={replyDrafts[followUp.id] || ""}
                            onChange={(event) => setReplyDrafts((current) => ({
                              ...current,
                              [followUp.id]: event.target.value,
                            }))}
                            className="min-h-16 text-[13px]"
                          />
                        </label>
                        <Button
                          type="button"
                          onClick={() => void submitFollowUpReply(followUp.id)}
                          disabled={replyBusyId === followUp.id}
                        >
                          {replyBusyId === followUp.id ? "Отправляем…" : "Ответить клинике"}
                        </Button>
                      </div>
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

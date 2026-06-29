import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { FormEvent, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { createSelfHostedPatientPortalBookingRequest } from "@/lib/self-hosted-patient-portal-api";
import { usePatientPortalOverview } from "./usePatientPortalOverview";

function toIsoDateTime(value: string): string {
  return value ? new Date(value).toISOString() : "";
}

export default function MeBookingPageLive() {
  const { session, status, overview, error, reload } = usePatientPortalOverview();
  const [preferredFrom, setPreferredFrom] = useState("");
  const [preferredTo, setPreferredTo] = useState("");
  const [reason, setReason] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  async function submitBookingRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitStatus("saving");
    setSubmitMessage("Отправляем запрос на запись.");
    const result = await createSelfHostedPatientPortalBookingRequest({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: {
        preferredFrom: toIsoDateTime(preferredFrom),
        preferredTo: preferredTo ? toIsoDateTime(preferredTo) : null,
        reason,
      },
    });
    if (!result.ok) {
      setSubmitStatus("error");
      setSubmitMessage(result.error.message);
      return;
    }
    setSubmitStatus("saved");
    setSubmitMessage("Запрос на запись отправлен в клинику.");
    setPreferredFrom("");
    setPreferredTo("");
    setReason("");
    await reload();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Запись на приём" subtitle="Заявка на запись в клинику" />
      <div className="space-y-3 p-3 sm:p-4">
        {status === "missing_session" && (
          <Card className="p-4">
            <div className="text-[13px] text-muted-foreground">Войдите в личный кабинет, чтобы увидеть записи.</div>
            <Button asChild className="mt-3 min-h-[44px] sm:min-h-[36px]">
              <Link to="/self-hosted/login">Войти</Link>
            </Button>
          </Card>
        )}
        {status === "loading" && <Card className="p-4 text-[13px] text-muted-foreground">Загружаем записи…</Card>}
        {status === "error" && <Card className="p-4 text-[13px] text-destructive" role="alert">{error}</Card>}
        {overview && (
          <>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Текущая запись
              </div>
              {overview.nextAppointment ? (
                <div className="mt-2 text-[14px]">
                  {formatDateTime(overview.nextAppointment.startedAt)} · {overview.nextAppointment.clinic.name || "Клиника"}
                </div>
              ) : (
                <div className="mt-2 text-[13px] text-muted-foreground">Активных записей нет.</div>
              )}
            </Card>
            <Card className="p-4">
              <div className="text-[13px] font-semibold">Самозапись пациента</div>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Отправьте удобное время и причину обращения. Сотрудник клиники подтвердит время и свяжется с вами.
              </p>
              <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitBookingRequest}>
                <label className="grid gap-1 text-[12px] font-medium">
                  Предпочтительно с
                  <input
                    aria-label="Предпочтительное начало записи"
                    type="datetime-local"
                    className="min-h-[44px] rounded-md border border-input bg-background px-3 text-[13px]"
                    value={preferredFrom}
                    onChange={(event) => setPreferredFrom(event.target.value)}
                    required
                  />
                </label>
                <label className="grid gap-1 text-[12px] font-medium">
                  До
                  <input
                    aria-label="Предпочтительное окончание записи"
                    type="datetime-local"
                    className="min-h-[44px] rounded-md border border-input bg-background px-3 text-[13px]"
                    value={preferredTo}
                    onChange={(event) => setPreferredTo(event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-[12px] font-medium sm:col-span-2">
                  Причина обращения
                  <textarea
                    aria-label="Причина запроса на запись"
                    className="min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-[13px]"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    required
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <Button type="submit" className="min-h-[44px]" disabled={submitStatus === "saving"}>
                    {submitStatus === "saving" ? "Отправляем…" : "Отправить запрос"}
                  </Button>
                  <div
                    role={submitStatus === "error" ? "alert" : "status"}
                    aria-live={submitStatus === "error" ? "assertive" : "polite"}
                    className={submitStatus === "error" ? "text-[13px] text-destructive" : "text-[13px] text-muted-foreground"}
                  >
                    {submitMessage}
                  </div>
                </div>
              </form>
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b border-border p-4 text-[13px] font-semibold">Последние запросы</div>
              {overview.bookingRequests.length === 0 ? (
                <div className="p-4 text-[13px] text-muted-foreground">Запросов на запись пока нет.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {overview.bookingRequests.map((request) => (
                    <li key={request.id} className="grid gap-1 p-4 text-[13px]">
                      <div className="font-medium">{request.reason || "Запрос на запись"}</div>
                      <div className="text-muted-foreground">
                        {formatDateTime(request.preferredFrom)} · {request.status}
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

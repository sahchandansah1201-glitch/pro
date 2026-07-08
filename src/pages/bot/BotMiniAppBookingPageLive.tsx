import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarClock, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { createSelfHostedPatientPortalBookingRequest } from "@/lib/self-hosted-patient-portal-api";
import { usePatientPortalOverview } from "@/pages/patient/usePatientPortalOverview";

function toIsoDateTime(value: string): string {
  return value ? new Date(value).toISOString() : "";
}

export default function BotMiniAppBookingPageLive() {
  const { session, status, overview, error, reload } = usePatientPortalOverview();
  const [preferredFrom, setPreferredFrom] = useState("");
  const [preferredTo, setPreferredTo] = useState("");
  const [reason, setReason] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);

  async function submitBookingRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitStatus("saving");
    setSubmitMessage("Отправляем заявку в клинику.");
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
    setLastReason(reason);
    setSubmitStatus("saved");
    setSubmitMessage("Заявка на запись отправлена в клинику.");
    setPreferredFrom("");
    setPreferredTo("");
    setReason("");
    await reload();
  }

  return (
    <div className="min-h-screen bg-muted/40 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex items-start gap-3 rounded-lg border bg-background p-4 shadow-sm">
          <Link
            to="/me/booking"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
            aria-label="Вернуться к записи"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-tight">Помощник записи</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Заявка попадёт сотруднику клиники для подтверждения времени.
            </p>
          </div>
        </div>

        {status === "missing_session" && (
          <Card className="p-4">
            <div className="text-[13px] text-muted-foreground">Войдите в личный кабинет, чтобы отправить заявку.</div>
            <Button asChild className="mt-3 min-h-[44px]">
              <Link to="/self-hosted/login">Войти</Link>
            </Button>
          </Card>
        )}

        {status === "loading" && <Card className="p-4 text-[13px] text-muted-foreground">Загружаем данные записи…</Card>}
        {status === "error" && <Card className="p-4 text-[13px] text-destructive" role="alert">{error}</Card>}

        {overview && (
          <>
            <Card className="space-y-2 p-4">
              <div className="flex items-center gap-2 text-[13px] font-semibold">
                <CalendarClock className="h-4 w-4" aria-hidden />
                Данные записи
              </div>
              <div className="grid gap-1 text-[13px] text-muted-foreground">
                <span>{overview.patient.fullName || "Пациент"}</span>
                <span>{overview.patient.clinic.name || "Клиника"}</span>
              </div>
              {overview.nextAppointment ? (
                <div className="text-[13px]">
                  Ближайший приём: {formatDateTime(overview.nextAppointment.startedAt)}
                </div>
              ) : (
                <div className="text-[13px] text-muted-foreground">Активных записей нет.</div>
              )}
            </Card>

            <Card className="p-4">
              <form className="grid gap-3" onSubmit={submitBookingRequest}>
                <label className="grid gap-1 text-[12px] font-medium">
                  Предпочтительное начало
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
                <label className="grid gap-1 text-[12px] font-medium">
                  Причина обращения
                  <textarea
                    aria-label="Причина запроса на запись"
                    className="min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-[13px]"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={500}
                    required
                  />
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" className="min-h-[44px]" disabled={submitStatus === "saving"}>
                    {submitStatus === "saving" ? "Отправляем…" : "Отправить заявку"}
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

            {submitStatus === "saved" && lastReason && (
              <Card className="flex items-start gap-3 p-4">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
                <div className="text-[13px]">
                  <div className="font-semibold">Заявка создана</div>
                  <div className="mt-1 text-muted-foreground">{lastReason}</div>
                </div>
              </Card>
            )}

            <Card className="overflow-hidden">
              <div className="border-b p-4 text-[13px] font-semibold">Последние заявки</div>
              {overview.bookingRequests.length === 0 ? (
                <div className="p-4 text-[13px] text-muted-foreground">Заявок на запись пока нет.</div>
              ) : (
                <ul className="divide-y">
                  {overview.bookingRequests.slice(0, 5).map((request) => (
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

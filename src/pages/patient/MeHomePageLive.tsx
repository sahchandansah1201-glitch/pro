import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, CalendarClock, FileText, ScanSearch, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { deletePortalPersonalUploads152Fz } from "@/lib/self-hosted-onboarding-api";
import { usePatientPortalOverview } from "./usePatientPortalOverview";

function LoginRequired() {
  return (
    <Card className="m-4 p-4">
      <div className="text-[15px] font-semibold">Требуется вход пациента</div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Войдите в личный кабинет, чтобы открыть свои записи, заключения и напоминания.
      </p>
      <Button asChild className="mt-3 min-h-[44px] sm:min-h-[36px]">
        <Link to="/self-hosted/login">Войти</Link>
      </Button>
    </Card>
  );
}

export default function MeHomePageLive() {
  const { session, status, overview, error, reload } = usePatientPortalOverview();
  const [privacyNote, setPrivacyNote] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const patientName = overview?.patient.fullName || "пациент";
  const latestReport = overview?.reports[0] || null;

  async function handleDeletePersonalUploads() {
    setDeleteBusy(true);
    const res = await deletePortalPersonalUploads152Fz({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    });
    setDeleteBusy(false);
    if (res.ok && res.value) {
      setPrivacyNote(res.value.messageRu);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Личный кабинет" subtitle={patientName} />
      {status === "missing_session" ? (
        <LoginRequired />
      ) : (
        <div className="space-y-3 p-3 sm:p-4">
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
            style={{
              background: "hsl(var(--success) / 0.08)",
              borderColor: "hsl(var(--success) / 0.30)",
              color: "hsl(var(--success))",
            }}
          >
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>Данные личного кабинета загружены из системы клиники.</span>
          </div>

          {status === "loading" && <Card className="p-4 text-[13px] text-muted-foreground">Загружаем личный кабинет…</Card>}
          {status === "error" && (
            <Card className="p-4">
              <div role="alert" className="text-[13px] text-destructive">{error || "Не удалось загрузить личный кабинет."}</div>
              <Button variant="outline" className="mt-3 min-h-[44px] sm:min-h-[36px]" onClick={() => void reload()}>
                Повторить
              </Button>
            </Card>
          )}

          {overview && (
            <>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[14px] font-semibold">
                      <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                      Паспорт контроля кожи:{" "}
                      {overview.skinPassport?.active ? "активен бессрочно" : "ожидает подтверждения очного визита"}
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      {overview.skinPassport?.active
                        ? `Статус верифицированного пациента клиники подтверждён${overview.skinPassport.activatedAt ? ` (${formatDateTime(overview.skinPassport.activatedAt)})` : ""}. Проверка снимков доступна без суточных и месячных ограничений.`
                        : "После очного осмотра у дерматолога клиники активируется бессрочный Паспорт контроля кожи. Проверка снимков открыта без ограничений."}
                    </p>
                    {privacyNote ? (
                      <p role="status" className="mt-2 text-[12px] font-medium text-primary">
                        {privacyNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" className="min-h-[44px] text-[12px] sm:min-h-[36px]">
                      <Link to="/check">Проверить новый снимок</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={deleteBusy}
                      onClick={() => void handleDeletePersonalUploads()}
                      className="min-h-[44px] gap-1.5 text-[12px] text-destructive sm:min-h-[36px]"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Удалить мои черновые снимки (152-ФЗ)
                    </Button>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <CalendarClock className="h-4 w-4" aria-hidden />
                    Ближайший приём
                  </div>
                  {overview.nextAppointment ? (
                    <div className="mt-2">
                      <div className="text-[15px] font-semibold">{formatDateTime(overview.nextAppointment.startedAt)}</div>
                      <div className="text-[12px] text-muted-foreground">{overview.nextAppointment.clinic.name || "Клиника"}</div>
                    </div>
                  ) : (
                    <div className="mt-2 text-[13px] text-muted-foreground">Активных записей нет.</div>
                  )}
                  <Button asChild variant="outline" className="mt-3 w-full min-h-[44px] text-[12px] sm:min-h-[36px]">
                    <Link to="/me/booking">
                      Управление записью <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <FileText className="h-4 w-4" aria-hidden />
                    Последнее заключение
                  </div>
                  {latestReport ? (
                    <div className="mt-2">
                      <div className="text-[13px] font-medium">{formatDate(latestReport.visitDate)} · {latestReport.clinic.name || "Клиника"}</div>
                      <p className="mt-1 line-clamp-3 text-[12px] text-muted-foreground">{latestReport.summary || latestReport.patientSafeText}</p>
                      <Button asChild variant="outline" className="mt-3 w-full min-h-[44px] text-[12px] sm:min-h-[36px]">
                        <Link to={`/me/reports/${latestReport.id}`}>Открыть отчёт</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2 text-[13px] text-muted-foreground">Заключений пока нет.</div>
                  )}
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Bell className="h-4 w-4" aria-hidden />
                    Напоминания
                  </div>
                  {overview.reminders.length === 0 ? (
                    <div className="mt-2 text-[13px] text-muted-foreground">Напоминаний нет.</div>
                  ) : (
                    <ul className="mt-2 space-y-1.5 text-[12px]">
                      {overview.reminders.slice(0, 3).map((item) => (
                        <li key={item.id} className="flex items-start justify-between gap-2">
                          <span className="min-w-0 truncate">{item.title}</span>
                          <span className="shrink-0 text-muted-foreground">{formatDate(item.dueAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button asChild variant="outline" className="mt-3 w-full min-h-[44px] text-[12px] sm:min-h-[36px]">
                    <Link to="/me/reminders">Все напоминания</Link>
                  </Button>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                    <ScanSearch className="h-4 w-4" aria-hidden />
                    История очагов
                  </div>
                  <div className="mt-2">
                    <div className="text-[13px] font-medium">Проверенный протокол</div>
                    <p className="mt-1 line-clamp-3 text-[12px] text-muted-foreground">
                      История показывает только опубликованные клиникой сведения для пациента.
                    </p>
                    <Button asChild variant="outline" className="mt-3 w-full min-h-[44px] text-[12px] sm:min-h-[36px]">
                      <Link to="/me/history">Открыть историю очагов</Link>
                    </Button>
                  </div>
                </Card>
              </div>

              <Card className="p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-[13px] font-semibold">История заключений</div>
                  <Button asChild size="sm" variant="outline" className="min-h-[44px] sm:min-h-[32px]">
                    <Link to="/me/reports">Все заключения</Link>
                  </Button>
                </div>
                {overview.reports.length === 0 ? (
                  <div className="text-[13px] text-muted-foreground">Заключений пока нет.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {overview.reports.slice(0, 5).map((report) => (
                      <li key={report.id} className="flex items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium">{formatDate(report.visitDate)} · {report.clinic.name || "Клиника"}</div>
                          <p className="line-clamp-1 text-[12px] text-muted-foreground">{report.summary || report.patientSafeText}</p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="shrink-0 min-h-[44px] sm:min-h-[32px]">
                          <Link to={`/me/reports/${report.id}`}>Открыть</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
}

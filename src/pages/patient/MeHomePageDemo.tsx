import { Link } from "react-router-dom";
import { CalendarClock, FileText, Bell, ShieldAlert, ArrowRight, ScanSearch } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatDate } from "@/lib/format";
import {
  DEMO_PATIENT_GREETING,
  getDerivedReminders,
  getNextAppointment,
  getSafeReports,
} from "./patient-data";

const DEMO_BANNER =
  "Учебный режим. Это раздел пациента. Дальнейшие шаги определяет врач на очном приёме.";

export default function MeHomePage() {
  const next = getNextAppointment();
  const reports = getSafeReports();
  const latestReport = reports[reports.length - 1];
  const reminders = getDerivedReminders().slice(0, 3);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Личный кабинет" subtitle={`Здравствуйте, ${DEMO_PATIENT_GREETING}.`} />

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

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <CalendarClock className="h-4 w-4" aria-hidden />
              Ближайший приём
            </div>
            {next ? (
              <div className="mt-2">
                <div className="text-[15px] font-semibold">{formatDateTime(next.slotAt)}</div>
                <div className="text-[12px] text-muted-foreground">{next.clinicName}</div>
              </div>
            ) : (
              <div className="mt-2 text-[13px] text-muted-foreground">Активных записей нет.</div>
            )}
            <Button asChild variant="outline" className="mt-3 w-full min-h-[44px] text-[12px] sm:min-h-[36px]">
              <Link to="/me/booking">
                Записаться <ArrowRight className="h-3.5 w-3.5" aria-hidden />
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
                <div className="text-[13px] font-medium">{formatDate(latestReport.visitDate)} · {latestReport.clinicName}</div>
                <p className="mt-1 line-clamp-3 text-[12px] text-muted-foreground">{latestReport.summary}</p>
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
            {reminders.length === 0 ? (
              <div className="mt-2 text-[13px] text-muted-foreground">Напоминаний нет.</div>
            ) : (
              <ul className="mt-2 space-y-1.5 text-[12px]">
                {reminders.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate">{r.title}</span>
                    <span className="shrink-0 text-muted-foreground">{formatDate(r.dueAt)}</span>
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
              <div className="text-[13px] font-medium">Протокол наблюдения</div>
              <p className="mt-1 line-clamp-3 text-[12px] text-muted-foreground">
                Только врачом проверенные сведения, без внутренних полей и технических ссылок.
              </p>
              <Button asChild variant="outline" className="mt-3 w-full min-h-[44px] text-[12px] sm:min-h-[36px]">
                <Link to="/me/history">Открыть историю очагов</Link>
              </Button>
            </div>
          </Card>
        </div>

        {reports.length > 0 && (
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[13px] font-semibold">История заключений</div>
              <Button asChild size="sm" variant="outline" className="min-h-[44px] sm:min-h-[32px]">
                <Link to="/me/reports">Все заключения</Link>
              </Button>
            </div>
            <ul className="divide-y divide-border">
              {reports.slice(-5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{formatDate(r.visitDate)} · {r.clinicName}</div>
                    <p className="line-clamp-1 text-[12px] text-muted-foreground">{r.summary}</p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0 min-h-[44px] sm:min-h-[32px]">
                    <Link to={`/me/reports/${r.id}`}>Открыть</Link>
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

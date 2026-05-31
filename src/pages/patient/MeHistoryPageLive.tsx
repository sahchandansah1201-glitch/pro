import { Link } from "react-router-dom";
import { CalendarClock, FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { usePatientPortalOverview } from "./usePatientPortalOverview";

function LoginRequired() {
  return (
    <Card className="m-4 p-4">
      <div className="text-[15px] font-semibold">Требуется production-вход пациента</div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Войдите через self-hosted backend, чтобы открыть историю.
      </p>
      <Button asChild className="mt-3 min-h-[44px] sm:min-h-[36px]">
        <Link to="/self-hosted/login">Войти в production</Link>
      </Button>
    </Card>
  );
}

export default function MeHistoryPageLive() {
  const { status, overview, error, reload } = usePatientPortalOverview();

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="История очагов" subtitle="Production · safe protocol boundary" />
      {status === "missing_session" ? (
        <LoginRequired />
      ) : (
        <div className="space-y-3 p-3 sm:p-4">
          <section
            aria-label="Контур безопасного протокола"
            className="rounded-md border px-3 py-3 text-[12px]"
            style={{
              background: "hsl(var(--success) / 0.08)",
              borderColor: "hsl(var(--success) / 0.30)",
              color: "hsl(var(--success))",
            }}
          >
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <div className="min-w-0">
                <div className="font-semibold">Контур безопасного протокола</div>
                <p className="mt-1">
                  self-hosted backend пока не отдаёт проверенный протокол очагов. История доступна через
                  выпущенные заключения и только после врачебной проверки.
                </p>
              </div>
            </div>
          </section>

          {status === "loading" && <Card className="p-4 text-[13px] text-muted-foreground">Загружаем историю…</Card>}
          {status === "error" && (
            <Card className="p-4">
              <div role="alert" className="text-[13px] text-destructive">{error || "Не удалось загрузить историю."}</div>
              <Button variant="outline" className="mt-3 min-h-[44px] sm:min-h-[36px]" onClick={() => void reload()}>
                Повторить
              </Button>
            </Card>
          )}

          {overview && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
              <Card className="min-w-0 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-semibold">Заключения с историей наблюдения</h2>
                    <p className="text-[12px] text-muted-foreground">
                      Полный протокол очагов появится после отдельного backend-контракта и проверки клиникой.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="min-h-[44px] text-[12px] sm:min-h-[36px]">
                    <Link to="/me/reports">Все заключения</Link>
                  </Button>
                </div>

                {overview.reports.length === 0 ? (
                  <div className="rounded-lg border p-3 text-[13px] text-muted-foreground">
                    Выпущенных заключений пока нет.
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {overview.reports.slice(0, 6).map((report) => (
                      <li key={report.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-[13px] font-semibold">
                            <FileText className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="min-w-0 truncate">{formatDate(report.visitDate)} · {report.clinic.name || "Клиника"}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
                            {report.summary || report.patientSafeText}
                          </p>
                        </div>
                        <Button asChild size="sm" variant="outline" className="shrink-0 min-h-[44px] sm:min-h-[32px]">
                          <Link to={`/me/reports/${report.id}`}>Открыть</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="min-w-0 p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold">
                  <CalendarClock className="h-4 w-4" aria-hidden />
                  Следующий шаг
                </div>
                <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  Если нужно уточнить историю наблюдения, используйте запись на контроль. Пациенту не показываются
                  врачебные черновики и технические поля.
                </p>
                <Button asChild variant="outline" className="mt-3 w-full min-h-[44px] text-[12px] sm:min-h-[36px]">
                  <Link to="/me/booking">Записаться на контроль</Link>
                </Button>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

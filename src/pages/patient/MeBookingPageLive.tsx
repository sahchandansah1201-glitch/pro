import { Link } from "react-router-dom";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { usePatientPortalOverview } from "./usePatientPortalOverview";

export default function MeBookingPageLive() {
  const { status, overview, error } = usePatientPortalOverview();
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Запись на приём" subtitle="Production · self-hosted backend" />
      <div className="space-y-3 p-3 sm:p-4">
        {status === "missing_session" && (
          <Card className="p-4">
            <div className="text-[13px] text-muted-foreground">Войдите в production, чтобы увидеть записи.</div>
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
                Production-самозапись будет отдельным write-контрактом. Сейчас кабинет пациента показывает
                только backend-owned состояние записей; для изменения времени обратитесь в клинику.
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

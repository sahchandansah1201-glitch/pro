import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { usePatientPortalOverview } from "./usePatientPortalOverview";

export default function MeRemindersPageLive() {
  const { status, overview, error } = usePatientPortalOverview();
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Напоминания" subtitle="Production · read-only patient reminders" />
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
        )}
      </div>
    </div>
  );
}

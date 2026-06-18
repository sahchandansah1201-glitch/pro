import { useMemo, useState } from "react";
import { Bell, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getDerivedReminders } from "./patient-data";

type LocalState = "planned" | "done" | "postponed";
const STATE_LABEL: Record<LocalState, string> = {
  planned: "Запланировано",
  done: "Выполнено",
  postponed: "Отложено",
};

const SOURCE_LABEL = {
  followup: "Рекомендация после визита",
  appointment: "Предстоящий приём",
  report: "Заключение",
} as const;

const DEMO_BANNER =
  "Учебный режим. Напоминания показывают пример работы кабинета. Дальнейшие шаги определяет врач.";

export default function MeRemindersPage() {
  const reminders = useMemo(() => getDerivedReminders(), []);
  const [states, setStates] = useState<Record<string, LocalState>>(
    () => Object.fromEntries(reminders.map((r) => [r.id, "planned" as LocalState])),
  );

  const setState = (id: string, s: LocalState) =>
    setStates((prev) => ({ ...prev, [id]: s }));

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Напоминания" subtitle="Контрольные осмотры и плановые приёмы." />

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

        {reminders.length === 0 ? (
          <Card className="p-6 text-center text-[13px] text-muted-foreground">
            <Bell className="mx-auto mb-2 h-5 w-5" aria-hidden /> Напоминаний пока нет.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {reminders.map((r) => {
              const s = states[r.id] ?? "planned";
              return (
                <Card key={r.id} className="p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium">{r.title}</div>
                      <div className="text-[12px] text-muted-foreground">
                        {SOURCE_LABEL[r.source]} · до {formatDate(r.dueAt)}
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-full border px-2 py-0.5 text-[10px]"
                      style={{
                        color:
                          s === "done"
                            ? "hsl(var(--success))"
                            : s === "postponed"
                              ? "hsl(var(--warning))"
                              : "hsl(var(--info))",
                        borderColor:
                          s === "done"
                            ? "hsl(var(--success))"
                            : s === "postponed"
                              ? "hsl(var(--warning))"
                              : "hsl(var(--info))",
                      }}
                    >
                      {STATE_LABEL[s]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={s === "done" ? "default" : "outline"}
                      className="min-h-[44px] sm:min-h-[32px]"
                      onClick={() => setState(r.id, "done")}
                    >
                      Отметить выполнено
                    </Button>
                    <Button
                      size="sm"
                      variant={s === "postponed" ? "default" : "outline"}
                      className="min-h-[44px] sm:min-h-[32px]"
                      onClick={() => setState(r.id, "postponed")}
                    >
                      Отложить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] sm:min-h-[32px]"
                      onClick={() => setState(r.id, "planned")}
                    >
                      Вернуть в план
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

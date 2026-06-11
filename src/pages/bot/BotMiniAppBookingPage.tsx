import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, Calendar, CheckCircle2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CLINICS } from "@/lib/mock-data";
import type { Clinic } from "@/lib/domain";
import { cn } from "@/lib/utils";

type Step = "clinic" | "slot" | "confirm" | "done";

type Slot = {
  id: string;
  dayLabel: string;
  time: string;
};

const SLOTS: Slot[] = [
  { id: "s-1", dayLabel: "Завтра, 5 мая", time: "09:30" },
  { id: "s-2", dayLabel: "Завтра, 5 мая", time: "11:00" },
  { id: "s-3", dayLabel: "Завтра, 5 мая", time: "15:45" },
  { id: "s-4", dayLabel: "Ср, 6 мая", time: "10:15" },
  { id: "s-5", dayLabel: "Ср, 6 мая", time: "14:00" },
  { id: "s-6", dayLabel: "Ср, 6 мая", time: "17:30" },
  { id: "s-7", dayLabel: "Чт, 7 мая", time: "09:00" },
  { id: "s-8", dayLabel: "Чт, 7 мая", time: "12:30" },
];

const STEPS: { key: Step; label: string }[] = [
  { key: "clinic", label: "Клиника" },
  { key: "slot", label: "Время" },
  { key: "confirm", label: "Подтверждение" },
];

let demoCounter = 0;
const nextId = (prefix: string) => {
  demoCounter += 1;
  return `${prefix}-demo-${demoCounter.toString().padStart(3, "0")}`;
};

function partnerLabel(tier: Clinic["partnerTier"]) {
  if (tier === "owned") return "Собственная клиника сети";
  if (tier === "partner") return "Партнёрская клиника";
  return "Внешняя клиника";
}

export default function BotMiniAppBookingPage() {
  const [step, setStep] = useState<Step>("clinic");
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [demoLeadId, setDemoLeadId] = useState<string | null>(null);
  const [demoApptId, setDemoApptId] = useState<string | null>(null);

  const clinic = useMemo(() => CLINICS.find((c) => c.id === clinicId) ?? null, [clinicId]);
  const slot = useMemo(() => SLOTS.find((s) => s.id === slotId) ?? null, [slotId]);

  const activeIdx = STEPS.findIndex((s) => s.key === (step === "done" ? "confirm" : step));

  function handleConfirm() {
    setDemoLeadId(nextId("lead"));
    setDemoApptId(nextId("appt"));
    setStep("done");
  }

  function handleReset() {
    setStep("clinic");
    setClinicId(null);
    setSlotId(null);
    setDemoLeadId(null);
    setDemoApptId(null);
  }

  return (
    <div className="min-h-screen bg-muted/40 px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 lg:flex-row lg:items-start">
        {/* Мобильная форма записи */}
        <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-3xl border bg-background shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-2 border-b bg-card px-4 py-3">
            <Link
              to="/bot-sim"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="Вернуться в бот"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1">
              <div className="text-sm font-semibold leading-tight">Запись в клинику</div>
              <div className="text-xs text-muted-foreground">Форма записи · демо</div>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-1 border-b bg-card px-4 py-2 text-[11px] text-muted-foreground">
            {STEPS.map((s, i) => (
              <div key={s.key} className="flex flex-1 items-center gap-1">
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium",
                    i <= activeIdx
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className={cn("truncate", i === activeIdx && "text-foreground font-medium")}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && <span className="mx-1 h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>

          {/* Safe context */}
          <div className="flex items-start gap-2 border-b bg-amber-50 px-4 py-3 text-[12px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="space-y-1 leading-snug">
              <div>Предварительная рекомендация из бота. Это не диагноз.</div>
              <div className="text-amber-800/80 dark:text-amber-200/80">
                Окончательное решение принимает врач на очном приёме.
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-3 px-4 py-4">
            {step === "clinic" && (
              <>
                <div className="text-xs text-muted-foreground">Шаг 1. Выберите клинику</div>
                {CLINICS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setClinicId(c.id);
                      setStep("slot");
                    }}
                    className="flex w-full min-h-[44px] flex-col gap-1 rounded-lg border bg-card p-3 text-left transition hover:border-primary hover:bg-accent"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{c.address}</div>
                    <div className="flex items-center gap-2 pt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {partnerLabel(c.partnerTier)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Маршрут · приоритет {c.routingPriority}
                      </span>
                    </div>
                  </button>
                ))}
              </>
            )}

            {step === "slot" && clinic && (
              <>
                <div className="text-xs text-muted-foreground">
                  Шаг 2. Выберите время · {clinic.name}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SLOTS.map((s) => {
                    const active = slotId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSlotId(s.id)}
                        className={cn(
                          "flex min-h-[56px] flex-col items-start justify-center rounded-lg border px-3 py-2 text-left transition",
                          active
                            ? "border-primary bg-primary/10"
                            : "bg-card hover:border-primary/60 hover:bg-accent",
                        )}
                      >
                        <span className="text-[11px] text-muted-foreground">{s.dayLabel}</span>
                        <span className="text-sm font-semibold">{s.time}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1"
                    onClick={() => setStep("clinic")}
                  >
                    Назад
                  </Button>
                  <Button
                    className="min-h-[44px] flex-1"
                    disabled={!slotId}
                    onClick={() => setStep("confirm")}
                  >
                    Продолжить
                  </Button>
                </div>
              </>
            )}

            {step === "confirm" && clinic && slot && (
              <>
                <div className="text-xs text-muted-foreground">Шаг 3. Подтверждение</div>
                <div className="space-y-2 rounded-lg border bg-card p-3">
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <div className="font-medium">{clinic.name}</div>
                      <div className="text-xs text-muted-foreground">{clinic.address}</div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="text-sm">
                      <div className="font-medium">{slot.dayLabel}, {slot.time}</div>
                      <div className="text-xs text-muted-foreground">Демонстрационный слот</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
                  В демо-режиме запись не отправляется в клинику.
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="min-h-[44px] flex-1"
                    onClick={() => setStep("slot")}
                  >
                    Назад
                  </Button>
                  <Button className="min-h-[44px] flex-1" onClick={handleConfirm}>
                    Подтвердить демо-запись
                  </Button>
                </div>
              </>
            )}

            {step === "done" && clinic && slot && (
              <>
                <div className="flex flex-col items-center gap-2 rounded-lg border bg-card p-4 text-center">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                  <div className="text-sm font-semibold">Демо-запись создана локально</div>
                  <div className="text-xs text-muted-foreground">
                    В реальной версии оператор клиники получит заявку.
                  </div>
                </div>
                <div className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
                  В демо-режиме запись не отправляется в клинику. Заявка и запись созданы только в памяти страницы.
                </div>
                <div className="space-y-1 rounded-lg border bg-card p-3 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Клиника</span>
                    <span className="text-right font-medium">{clinic.name}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Слот</span>
                    <span className="font-medium">{slot.dayLabel}, {slot.time}</span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Заявка</span>
                    <span>создана локально</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Запись</span>
                    <span>создана локально</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <Button asChild variant="outline" className="min-h-[44px]">
                    <Link to="/bot-sim">Вернуться в бот</Link>
                  </Button>
                  <Button variant="ghost" className="min-h-[44px]" onClick={handleReset}>
                    Создать ещё одну демо-запись
                  </Button>
                  <div
                    className="cursor-not-allowed select-none rounded-md border border-dashed px-3 py-2 text-center text-[11px] text-muted-foreground"
                    aria-disabled
                  >
                    Передача в /operator недоступна в демо
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Desktop demo status */}
        <aside className="hidden w-full max-w-sm lg:block">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Демо-статус</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Шаг</div>
                <div className="font-medium">
                  {step === "done" ? "Готово" : STEPS[activeIdx]?.label}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-xs text-muted-foreground">Клиника</div>
                <div className="font-medium">{clinic ? clinic.name : "—"}</div>
                {clinic && (
                  <div className="text-xs text-muted-foreground">{clinic.address}</div>
                )}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Слот</div>
                <div className="font-medium">
                  {slot ? `${slot.dayLabel}, ${slot.time}` : "—"}
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-xs text-muted-foreground">Локальная заявка</div>
                <div>{demoLeadId ? "создана" : "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Локальная запись</div>
                <div>{demoApptId ? "создана" : "—"}</div>
              </div>
              <div className="rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
                Все данные создаются только в памяти страницы. Внешние системы и мессенджер не используются.
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

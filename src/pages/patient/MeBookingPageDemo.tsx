import { useMemo, useState } from "react";
import { Check, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { getClinics } from "@/lib/mock-data";
import { DEMO_SERVICES, buildDemoSlots } from "./patient-data";

const DEMO_BANNER =
  "Учебный режим. Запись сохраняется только на этом экране и не отправляется в клинику.";

type Step = "clinic" | "service" | "slot" | "confirm" | "done";

export default function MeBookingPage() {
  const clinics = getClinics();
  const slots = useMemo(() => buildDemoSlots(), []);

  const [step, setStep] = useState<Step>("clinic");
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const clinicName = clinics.find((c) => c.id === clinicId)?.name ?? "—";
  const serviceName = DEMO_SERVICES.find((s) => s.id === serviceId)?.name ?? "—";

  const reset = () => {
    setStep("clinic");
    setClinicId(null);
    setServiceId(null);
    setSlot(null);
  };

  const STEPS: { key: Step; label: string }[] = [
    { key: "clinic", label: "Клиника" },
    { key: "service", label: "Услуга" },
    { key: "slot", label: "Время" },
    { key: "confirm", label: "Подтверждение" },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Запись на приём" subtitle="Клиника → услуга → время → подтверждение." />

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

        <ol className="flex flex-wrap gap-1 text-[12px]" aria-label="Шаги записи">
          {STEPS.map((s, idx) => {
            const done = STEPS.findIndex((x) => x.key === step) > idx || step === "done";
            const active = s.key === step;
            return (
              <li
                key={s.key}
                className={`rounded-md border px-2 py-1 ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : done
                      ? "border-success/40 bg-success/5 text-success"
                      : "border-border text-muted-foreground"
                }`}
              >
                {idx + 1}. {s.label}
              </li>
            );
          })}
        </ol>

        {step === "clinic" && (
          <Card className="p-3">
            <div className="mb-2 text-[13px] font-semibold">Выберите клинику</div>
            <div className="grid grid-cols-1 gap-2">
              {clinics.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setClinicId(c.id); setStep("service"); }}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-left text-[12px] min-h-[44px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-muted-foreground">{c.address}</div>
                </button>
              ))}
            </div>
          </Card>
        )}

        {step === "service" && (
          <Card className="p-3">
            <div className="mb-2 text-[13px] font-semibold">Выберите услугу</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEMO_SERVICES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setServiceId(s.id); setStep("slot"); }}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-left text-[12px] min-h-[44px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {s.name}
                </button>
              ))}
            </div>
            <Button variant="outline" className="mt-3 min-h-[44px] sm:min-h-[36px]" onClick={() => setStep("clinic")}>Назад</Button>
          </Card>
        )}

        {step === "slot" && (
          <Card className="p-3">
            <div className="mb-2 text-[13px] font-semibold">Выберите время</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {slots.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { setSlot(iso); setStep("confirm"); }}
                  className="rounded-md border border-border bg-surface px-2 py-2 text-[12px] min-h-[44px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {formatDateTime(iso)}
                </button>
              ))}
            </div>
            <Button variant="outline" className="mt-3 min-h-[44px] sm:min-h-[36px]" onClick={() => setStep("service")}>Назад</Button>
          </Card>
        )}

        {step === "confirm" && (
          <Card className="p-3">
            <div className="mb-2 text-[13px] font-semibold">Подтвердите запись</div>
            <dl className="grid grid-cols-2 gap-y-1 text-[12px]">
              <dt className="text-muted-foreground">Клиника</dt><dd>{clinicName}</dd>
              <dt className="text-muted-foreground">Услуга</dt><dd>{serviceName}</dd>
              <dt className="text-muted-foreground">Время</dt><dd>{slot ? formatDateTime(slot) : "—"}</dd>
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="min-h-[44px] sm:min-h-[36px]" onClick={() => setStep("done")}>Подтвердить запись</Button>
              <Button variant="outline" className="min-h-[44px] sm:min-h-[36px]" onClick={() => setStep("slot")}>Назад</Button>
            </div>
          </Card>
        )}

        {step === "done" && (
          <Card className="p-4">
            <div className="flex items-center gap-2 text-success">
              <Check className="h-5 w-5" aria-hidden />
              <span className="text-[14px] font-semibold">Учебная запись создана на этом экране</span>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Запись хранится только на этой странице и не отправляется в клинику. В рабочем режиме сотрудник клиники подтвердит запись и пришлёт уведомление.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-y-1 text-[12px]">
              <dt className="text-muted-foreground">Клиника</dt><dd>{clinicName}</dd>
              <dt className="text-muted-foreground">Услуга</dt><dd>{serviceName}</dd>
              <dt className="text-muted-foreground">Время</dt><dd>{slot ? formatDateTime(slot) : "—"}</dd>
            </dl>
            <Button variant="outline" className="mt-3 min-h-[44px] sm:min-h-[36px]" onClick={reset}>Новая запись</Button>
          </Card>
        )}
      </div>
    </div>
  );
}

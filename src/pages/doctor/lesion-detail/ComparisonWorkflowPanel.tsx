import { Button } from "@/components/ui/button";

export type ComparisonWorkflowStep = {
  key: string;
  label: string;
  done: boolean;
  statusLabel: string;
  nextActionLabel: string;
  actionLabel: string;
  actionHref: string;
};

type ComparisonWorkflowPanelProps = {
  steps: ComparisonWorkflowStep[];
  workflowReady: boolean;
  firstBlocker: string | null;
};

export function ComparisonWorkflowPanel({
  steps,
  workflowReady,
  firstBlocker,
}: ComparisonWorkflowPanelProps) {
  const completedSteps = steps.filter((step) => step.done).length;
  const currentStepIndex = steps.findIndex((step) => !step.done);
  const currentStep =
    currentStepIndex >= 0
      ? steps[currentStepIndex]
      : {
          key: "workflow-ready",
          label: "Итог",
          done: workflowReady,
          statusLabel: workflowReady ? "готов" : "проверьте порядок",
          nextActionLabel: "Проверить итог врачебного порядка",
          actionLabel: "Открыть итог проверки",
          actionHref: "#comparison-workflow-gate",
        };

  return (
    <section
      role="region"
      aria-label="Рабочий шаг сравнения"
      className="mb-3 rounded-md border border-border bg-muted/20 p-2.5"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">Что делать сейчас</p>
          <h3 className="mt-1 text-[13px] font-semibold">
            Следующий шаг: {currentStep.nextActionLabel}
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Ближайшее действие: <span className="font-medium text-foreground">{currentStep.actionLabel}</span>.
            Динамический вывод выключен, измерения выключены, выдача пациенту выключена.
          </p>
          {firstBlocker && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Первое ограничение: {firstBlocker}
            </p>
          )}
        </div>
        <div className="flex min-w-[180px] flex-col items-start gap-2 lg:items-end">
          <span className="rounded-sm border border-border bg-background px-2 py-1 text-[12px] font-medium">
            Прогресс проверки: {completedSteps}/{steps.length}
          </span>
          <Button asChild size="sm" className="min-h-[44px] text-[12px] sm:h-8 sm:min-h-8">
            <a href={currentStep.actionHref}>{currentStep.actionLabel}</a>
          </Button>
        </div>
      </div>
      <ol className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-8" aria-label="Этапы сравнения снимков">
        {steps.map((step, index) => {
          const state = step.done ? "done" : index === currentStepIndex ? "current" : "locked";
          const stateLabel = step.done ? "закрыто" : state === "current" ? "текущий шаг" : "ожидает";
          const stateClass = step.done
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : state === "current"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-border bg-background text-muted-foreground";
          return (
            <li key={step.key} className={`min-w-0 rounded-sm border px-2 py-1.5 ${stateClass}`}>
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px]">
                  {index + 1}
                </span>
                <span className="truncate text-[12px] font-medium">{step.label}</span>
              </div>
              <p className="mt-1 truncate text-[11px]">{stateLabel}</p>
              <p className="mt-0.5 truncate text-[11px] opacity-80">{step.statusLabel}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

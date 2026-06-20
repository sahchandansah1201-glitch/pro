import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PatientDeliveryGate } from "./PatientDeliveryReadinessPanels";

function ApprovalRequirementLine({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground";

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

export function PatientDeliveryApprovalRequirementsPanel({
  gates,
  onApprovalRequirementsReview,
}: {
  gates: PatientDeliveryGate[];
  onApprovalRequirementsReview: () => void;
}) {
  const readyCount = gates.filter((gate) => gate.ready).length;
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const requirementRows = [
    {
      title: "Ответственный клиники",
      detail: "должен принять отдельное рабочее решение",
      status: "не назначен",
    },
    {
      title: "Правила хранения",
      detail: "сроки и порядок хранения должны быть закрыты до решения",
      status: "требуют проверки",
    },
    {
      title: "Безопасность данных",
      detail: "пациентские строки, ссылки, файлы и коды не выводятся",
      status: "сохранена",
    },
    {
      title: "Повторный просмотр",
      detail: "перед любым запуском нужен повторный контроль всех правил",
      status: "обязателен",
    },
  ];

  return (
    <Card role="region" aria-label="Требования к утверждению выдачи" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Требования к решению
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Что должно быть решено отдельно</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Этот блок только собирает условия для будущего рабочего решения клиники. Он не открывает доступ пациенту,
            не публикует файлы и не создаёт ссылки.
          </p>
        </div>
        <Badge variant="secondary" className="min-h-[28px] px-2.5 py-1 text-[12px]">
          включение запрещено
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {requirementRows.map((row) => (
            <div key={row.title} className="rounded-md border p-3">
              <div className="text-[13px] font-semibold leading-snug">{row.title}</div>
              <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{row.detail}</div>
              <div className="mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold">
                {row.status}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Итог для администратора</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Подготовка требований остаётся локальной памяткой. Для включения нужен отдельный утверждённый порядок.
            </p>
          </div>
          <div className="grid gap-2">
            <ApprovalRequirementLine
              label="Проверки закрыты"
              value={`${readyCount}/${gates.length}`}
              tone={readyCount === gates.length ? "success" : "default"}
            />
            <ApprovalRequirementLine
              label="Открыто препятствий"
              value={blockerCount}
              tone={blockerCount > 0 ? "warning" : "success"}
            />
            <ApprovalRequirementLine label="Доступ пациенту" value="закрыт" tone="success" />
            <ApprovalRequirementLine label="Файлы и ссылки" value="не опубликованы" tone="success" />
          </div>
          <Button
            variant="outline"
            className="min-h-[44px] justify-center sm:min-h-[36px]"
            onClick={onApprovalRequirementsReview}
          >
            Подготовить требования к утверждению
          </Button>
        </div>
      </div>
    </Card>
  );
}

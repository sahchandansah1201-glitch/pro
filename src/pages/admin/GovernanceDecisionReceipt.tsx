import { Card } from "@/components/ui/card";
import type { GovernanceDecisionReceipt } from "./governance-decision-receipt";

export function GovernanceDecisionReceiptCard({ receipt }: { receipt: GovernanceDecisionReceipt }) {
  return (
    <Card role="status" aria-label="Временная заметка о решении клиники" className="p-3 text-[12px]">
      <div className="font-semibold">Временная заметка сохранена</div>
      <p className="mt-1 text-muted-foreground">
        {receipt.decision === "delivery_blocked"
          ? "Выдача пациенту остаётся выключенной: сначала закройте открытые проверки."
          : "Проверки закрыты, но выдача пациенту остаётся выключенной до отдельного утверждения клиники."}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 tabular-nums text-muted-foreground">
        <span>Открыто проверок: <b className="text-foreground">{receipt.openGateCount}</b></span>
        <span>Препятствий: <b className="text-foreground">{receipt.blockerCount}</b></span>
      </div>
      <p className="mt-1 text-muted-foreground">
        Заметка действует только в этой вкладке браузера и привязана к текущему входу и итоговым числам. Это не рабочий акт клиники.
        Пациентские данные, файлы, ссылки и служебные коды не сохранялись.
      </p>
    </Card>
  );
}

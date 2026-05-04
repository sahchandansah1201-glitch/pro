import { PageHeader } from "@/components/shell/PageHeader";
import { useRole } from "@/context/RoleContext";

interface KpiProps {
  label: string;
  value: string;
  hint?: string;
}

function Kpi({ label, value, hint }: KpiProps) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-[20px] font-semibold leading-none">{value}</div>
      {hint && <div className="mt-1 text-[12px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { label } = useRole();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Обзор"
        subtitle={`Сводка по клинике. Текущая роль: ${label}.`}
      />

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Визиты сегодня" value="14" hint="из них 3 повторных" />
          <Kpi label="Ожидают заключения" value="5" hint="старше 24 ч: 1" />
          <Kpi label="Лиды из бота" value="22" hint="за сутки" />
          <Kpi label="Срочные маршруты" value="2" hint="требуют осмотра" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-md border border-border bg-surface p-3 lg:col-span-2">
            <div className="mb-2 text-[13px] font-semibold">Очередь работы</div>
            <p className="text-[12px] text-muted-foreground">
              Здесь появится список визитов, изображений на проверку и лидов из бота.
              Реализуется в задачах 3–6 плана.
            </p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <div className="mb-2 text-[13px] font-semibold">Состояние системы</div>
            <ul className="space-y-1 text-[12px] text-muted-foreground">
              <li>Bot gateway: мок</li>
              <li>Device Bridge: не подключён</li>
              <li>Интеграции CRM/ERP: DryRun</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

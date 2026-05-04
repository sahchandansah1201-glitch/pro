import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const isString = typeof subtitle === "string";
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border bg-surface px-6 py-4">
      <div className="min-w-0">
        <h1 className="h-page">{title}</h1>
        {subtitle && (isString ? <p className="h-page-sub">{subtitle}</p> : <div className="mt-1">{subtitle}</div>)}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  note?: string;
  /** Дополнительный баннер про переход на бэкенд (для /sys/* и /admin/integrations). */
  backendNote?: string;
}

export function PlaceholderPage({ title, subtitle, note, backendNote }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="space-y-3 p-4">
        {backendNote && (
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
            <span>{backendNote}</span>
          </div>
        )}
        <div className="rounded-md border border-dashed border-border bg-surface p-6 text-[13px] text-muted-foreground">
          {note ?? "Раздел будет реализован в следующих задачах плана. Здесь появятся таблицы, фильтры и панели работы."}
        </div>
      </div>
    </div>
  );
}

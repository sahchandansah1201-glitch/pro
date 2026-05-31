import { Card } from "@/components/ui/card";

/**
 * Compact operating panel for admin subpages.
 *
 * Keeps admin pages consistent: each panel is a standalone section with a
 * visible h2, short hint, and dense body content. No patient-level data.
 */
export function AdminOpsCard({
  title,
  hint,
  children,
  action,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card role="region" aria-label={title} className="p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold leading-tight">{title}</h2>
          {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </Card>
  );
}

export function AdminMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "warning" | "destructive" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : tone === "info"
            ? "text-info"
            : "text-foreground";

  return (
    <div className="rounded-md border border-border bg-surface px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[16px] font-semibold leading-tight tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}

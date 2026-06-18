import { cn } from "@/lib/utils";

export type RiskLevel = "low" | "moderate" | "high" | "urgent";

const LABELS: Record<RiskLevel, string> = {
  low: "Низкий",
  moderate: "Умеренный",
  high: "Высокий",
  urgent: "Срочный",
};

const STYLES: Record<RiskLevel, string> = {
  low: "bg-risk-low-soft text-risk-low border-risk-low/30",
  moderate: "bg-risk-moderate-soft text-risk-moderate border-risk-moderate/30",
  high: "bg-risk-high-soft text-risk-high border-risk-high/30",
  urgent: "bg-risk-urgent text-risk-urgent-foreground border-risk-urgent",
};

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

/**
 * Метка риска. Цвет токенов риска используется ТОЛЬКО вместе с текстом —
 * ни один пользователь не должен опираться только на цвет.
 */
export function RiskBadge({ level, className }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none",
        STYLES[level],
        className,
      )}
      aria-label={`Уровень внимания: ${LABELS[level]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {LABELS[level]}
    </span>
  );
}

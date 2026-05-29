import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  CircleDot,
  Info,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipTone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

const TONE_CLASSES: Record<ChipTone, string> = {
  neutral: "border-border bg-surface-muted text-foreground",
  info: "border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info)/0.10)] text-[hsl(var(--info))]",
  success: "border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.10)] text-[hsl(var(--success))]",
  warning: "border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.10)] text-[hsl(var(--warning))]",
  danger: "border-[hsl(var(--destructive)/0.35)] bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]",
  primary: "border-[hsl(var(--primary)/0.35)] bg-[hsl(var(--primary-soft))] text-[hsl(var(--primary))]",
};

const TONE_ICON: Record<ChipTone, LucideIcon> = {
  neutral: Circle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  primary: CircleDot,
};

export function StatusChip({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: ChipTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  const ResolvedIcon = Icon ?? TONE_ICON[tone];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[11px] font-medium leading-none whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <ResolvedIcon className="h-3 w-3" aria-hidden />
      <span>{children}</span>
    </span>
  );
}

export function SectionHeader({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="section-bar">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[13px] font-semibold leading-snug text-foreground">{title}</h3>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {right ? <div className="flex items-center gap-1.5">{right}</div> : null}
    </div>
  );
}

export function DeviceStatusDot({
  label,
  state,
}: {
  label: string;
  state: "connected" | "warning" | "disconnected";
}) {
  const tone: ChipTone = state === "connected" ? "success" : state === "warning" ? "warning" : "danger";
  const text =
    state === "connected" ? "подключён" : state === "warning" ? "внимание" : "не подключён";
  return (
    <StatusChip tone={tone}>
      {label}: {text}
    </StatusChip>
  );
}

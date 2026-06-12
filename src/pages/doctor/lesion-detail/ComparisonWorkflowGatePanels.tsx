import {
  CheckCircle2,
  Image as ImageIcon,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type BackendStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type ProtectedRenderStatus = "idle" | "loading" | "ready" | "error";
type MeasurementPolicyStatus = "not_approved" | "review_required" | "approved_for_technical_review";
type ProductionAnalysisPolicyStatus = "not_approved" | "review_required" | "approved_for_production_analysis";
type ReviewerAssignmentMode = "primary" | "second_required" | "second_completed";
type ReviewerWorkflowStatus = "reviewer_accepted" | "reviewer_rejected";

export type ProtectedRenderReadinessItem = {
  label: string;
  ready: boolean;
  detail: string;
};

export type ReviewerWorkflowGateItem = {
  label: string;
  ready: boolean;
  detail: string;
};

const WORKFLOW_LABEL: Record<ReviewerWorkflowStatus, string> = {
  reviewer_accepted: "Порядок проверки принят",
  reviewer_rejected: "Порядок проверки отклонён",
};

export function ComparisonProtectedPreviewPanel({
  canLoad,
  status,
  message,
  readiness,
  onLoad,
}: {
  canLoad: boolean;
  status: ProtectedRenderStatus;
  message: string;
  readiness: ProtectedRenderReadinessItem[];
  onLoad: () => void;
}) {
  return (
    <div id="comparison-protected-preview" className="mb-2 rounded-md border border-border bg-muted/20 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Защищённая передача снимков
          </div>
          <div className="text-[12px] font-medium">Защищённые превью врача</div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={!canLoad || status === "loading"}
          onClick={onLoad}
        >
          <ImageIcon className="h-3.5 w-3.5" aria-hidden />
          {status === "loading" ? "Загрузка" : "Подготовить защищённые превью"}
        </Button>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Снимки открываются только через систему клиники: без временных ссылок, путей хранения и выдачи пациенту.
      </p>
      <div
        role="region"
        aria-label="Готовность закрытого просмотра"
        className="mt-2 grid gap-1 rounded-sm border border-border bg-background p-2"
      >
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Готовность закрытого просмотра
        </div>
        {readiness.map((item) => (
          <div key={item.label} className="flex min-w-0 items-start gap-1.5 text-[11px]">
            {item.ready ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-low" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <div className="min-w-0">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground"> · {item.detail}</span>
            </div>
          </div>
        ))}
      </div>
      {message && (
        <p
          className={`mt-1 text-[12px] ${
            status === "ready" ? "text-primary" : "text-muted-foreground"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}

export function ComparisonMeasurementPolicyPanel({
  statusLabel,
  backendStatus,
  message,
  approveDisabled,
  onReview,
}: {
  statusLabel: string;
  backendStatus: BackendStatus;
  message: string;
  approveDisabled: boolean;
  onReview: (status: MeasurementPolicyStatus) => void;
}) {
  return (
    <section
      role="region"
      id="comparison-measurement-policy"
      aria-label="Политика измерений"
      className="mt-2 rounded-md border border-border bg-muted/20 p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Политика измерений
          </div>
          <div className="text-[12px] font-medium">{statusLabel}</div>
        </div>
        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          миллиметры выключены
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
        <span>Правила разрешают только технический порядок врачебной проверки.</span>
        <span>Измерения остаются выключены: нет миллиметров, площади, клинического размера или вывода о динамике.</span>
        <span>Выдача пациенту: выключена</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving" || approveDisabled}
          onClick={() => onReview("approved_for_technical_review")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Утвердить технические правила
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving"}
          onClick={() => onReview("review_required")}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Нужен разбор правил
        </Button>
      </div>
      {message && (
        <p
          className={`mt-2 text-[12px] font-medium ${
            backendStatus === "error" ? "text-destructive" : "text-primary"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  );
}

export function ComparisonReviewerAssignmentPanel({
  assignmentStatusLabel,
  secondReviewStatusLabel,
  backendStatus,
  message,
  disabled,
  onAssign,
}: {
  assignmentStatusLabel: string;
  secondReviewStatusLabel: string;
  backendStatus: BackendStatus;
  message: string;
  disabled: boolean;
  onAssign: (mode: ReviewerAssignmentMode) => void;
}) {
  return (
    <section
      role="region"
      id="comparison-reviewer-assignment"
      aria-label="Назначение проверяющего"
      className="mt-2 rounded-md border border-border bg-muted/20 p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Назначение проверяющего
          </div>
          <div className="text-[12px] font-medium">
            {assignmentStatusLabel} · {secondReviewStatusLabel}
          </div>
        </div>
        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          личность скрыта
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
        <span>Внутренний код проверяющего уходит только в систему клиники.</span>
        <span>Имена, контакты проверяющего и идентификаторы пары не выводятся на экран.</span>
        <span>Выдача пациенту: выключена · медицинские измерения выключены</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving" || disabled}
          onClick={() => onAssign("primary")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Назначить проверяющего
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving" || disabled}
          onClick={() => onAssign("second_required")}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Потребовать повторную проверку
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving" || disabled}
          onClick={() => onAssign("second_completed")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Повторная проверка завершена
        </Button>
      </div>
      {message && (
        <p
          className={`mt-2 text-[12px] font-medium ${
            backendStatus === "error" ? "text-destructive" : "text-primary"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  );
}

export function ComparisonAnalysisPolicyPanel({
  statusLabel,
  backendStatus,
  message,
  approveDisabled,
  onReview,
}: {
  statusLabel: string;
  backendStatus: BackendStatus;
  message: string;
  approveDisabled: boolean;
  onReview: (status: ProductionAnalysisPolicyStatus) => void;
}) {
  return (
    <section
      role="region"
      id="comparison-analysis-policy"
      aria-label="Правила рабочего анализа"
      className="mt-2 rounded-md border border-border bg-muted/20 p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Правила рабочего анализа
          </div>
          <div className="text-[12px] font-medium">{statusLabel}</div>
        </div>
        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          вывод выключен
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
        <span>Правила разрешают только рабочую готовность, не вывод о динамике.</span>
        <span>Клинический вывод о динамике: выключен · выдача пациенту: выключена</span>
        <span>Сначала должны быть закрыты технические правила, назначение проверяющего и повторная проверка.</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving" || approveDisabled}
          onClick={() => onReview("approved_for_production_analysis")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Утвердить правила анализа
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving"}
          onClick={() => onReview("review_required")}
        >
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Нужен разбор правил анализа
        </Button>
      </div>
      {message && (
        <p
          className={`mt-2 text-[12px] font-medium ${
            backendStatus === "error" ? "text-destructive" : "text-primary"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  );
}

export function ComparisonWorkflowGatePanel({
  ready,
  items,
  backendStatus,
  message,
  onReview,
}: {
  ready: boolean;
  items: ReviewerWorkflowGateItem[];
  backendStatus: BackendStatus;
  message: string;
  onReview: (status: ReviewerWorkflowStatus) => void;
}) {
  return (
    <section
      role="region"
      id="comparison-workflow-gate"
      aria-label="Врачебный порядок проверки"
      className="mt-2 rounded-md border border-border bg-muted/20 p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Врачебный порядок проверки
          </div>
          <div className="text-[12px] font-medium">
            Проверка: {ready ? "готова" : "заблокирована"}
          </div>
        </div>
        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          без выдачи пациенту
        </span>
      </div>
      <div className="mt-2 grid gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 items-start gap-1.5 text-[11px]">
            {item.ready ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-low" aria-hidden />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-moderate" aria-hidden />
            )}
            <div className="min-w-0">
              <span className="font-medium">{item.label}</span>
              <span className="text-muted-foreground"> · {item.detail}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving" || !ready}
          onClick={() => onReview("reviewer_accepted")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {WORKFLOW_LABEL.reviewer_accepted}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving"}
          onClick={() => onReview("reviewer_rejected")}
        >
          <XCircle className="h-3.5 w-3.5" aria-hidden /> {WORKFLOW_LABEL.reviewer_rejected}
        </Button>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
        <span>Порядок подтверждает только готовность к врачебному просмотру.</span>
        <span>Не диагноз, не динамика, не медицинское измерение.</span>
        <span>Выдача пациенту: выключена</span>
      </div>
      {message && (
        <p
          className={`mt-2 text-[12px] font-medium ${
            backendStatus === "error" ? "text-destructive" : "text-primary"
          }`}
          role="status"
        >
          {message}
        </p>
      )}
    </section>
  );
}

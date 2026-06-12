import {
  CheckCircle2,
  ClipboardList,
  Crosshair,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export type CaptureConditionCheck = {
  label: string;
  ready: boolean;
  detail: string;
};

export type CalibrationReadinessCheck = {
  label: string;
  ready: boolean;
  detail: string;
};

export type TechnicalGeometryMarker = {
  target: "A" | "B";
  x: number;
  y: number;
};

type BackendStatus = "idle" | "saving" | "saved" | "local_only" | "error";
type TechnicalReviewStatus = "technical_ready" | "needs_recapture" | "not_suitable_for_comparison";

const TECHNICAL_REVIEW_LABEL: Record<TechnicalReviewStatus, string> = {
  technical_ready: "Технически готово",
  needs_recapture: "Нужен переснимок",
  not_suitable_for_comparison: "Не использовать для динамики",
};

const formatGeometryMarker = (marker: TechnicalGeometryMarker) => `${marker.target} x${marker.x} y${marker.y}`;

export function ComparisonCaptureQaPanel({
  checks,
  ready,
}: {
  checks: CaptureConditionCheck[];
  ready: boolean;
}) {
  return (
    <section
      id="comparison-capture-qa"
      aria-label="Контроль условий съёмки"
      className="mt-3 rounded-md border border-border bg-background p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Контроль условий съёмки
          </div>
          <p className="mt-1 text-[12px] font-medium">
            Итог: {ready ? "условия технически повторяемы" : "нужна повторяемая съёмка"}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${
            ready
              ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
              : "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
          }`}
        >
          {ready ? (
            <CheckCircle2 className="h-3 w-3" aria-hidden />
          ) : (
            <ShieldAlert className="h-3 w-3" aria-hidden />
          )}
          {ready ? "Готово к техсравнению" : "Нужен контроль"}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5">
        {checks.map((item) => (
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
      <p className="mt-2 text-[11px] text-muted-foreground">
        Не является клинической оценкой динамики; показывает только повторяемость условий съёмки.
      </p>
    </section>
  );
}

export function ComparisonGeometryPanel({
  markers,
  onSetMarker,
  onClearMarkers,
}: {
  markers: TechnicalGeometryMarker[];
  onSetMarker: (target: TechnicalGeometryMarker["target"]) => void;
  onClearMarkers: () => void;
}) {
  return (
    <section
      role="region"
      id="comparison-geometry"
      aria-label="Техническая геометрия"
      className="mt-2 rounded-md border border-border bg-muted/20 p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Техническая геометрия
          </div>
          <div className="text-[12px] font-medium">Маркеры: {markers.length}/2</div>
        </div>
        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          проценты кадра
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          onClick={() => onSetMarker("A")}
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden /> Поставить маркер A
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          onClick={() => onSetMarker("B")}
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden /> Поставить маркер B
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={markers.length === 0}
          onClick={onClearMarkers}
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Очистить маркеры
        </Button>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
        <span>Координаты нормализованы: проценты кадра</span>
        <span>
          {markers.length > 0
            ? markers.map((item) => formatGeometryMarker(item)).join(" · ")
            : "Нет активных маркеров"}
        </span>
        <span>Не является медицинским измерением</span>
        <span>Выдача пациенту: выключена</span>
      </div>
    </section>
  );
}

export function ComparisonCalibrationPanel({
  checks,
  ready,
  backendStatus,
  message,
  calibrationLimitSaved,
  onSave,
}: {
  checks: CalibrationReadinessCheck[];
  ready: boolean;
  backendStatus: BackendStatus;
  message: string;
  calibrationLimitSaved: boolean;
  onSave: () => void;
}) {
  return (
    <section
      role="region"
      id="comparison-calibration"
      aria-label="Калибровка просмотра"
      className="mt-2 rounded-md border border-border bg-muted/20 p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Калибровка просмотра
          </div>
          <div className="text-[12px] font-medium">
            Калибровка: {ready ? "готова" : "не готова"}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] ${
            ready
              ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
              : "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
          }`}
        >
          {ready ? (
            <CheckCircle2 className="h-3 w-3" aria-hidden />
          ) : (
            <ShieldAlert className="h-3 w-3" aria-hidden />
          )}
          {ready ? "Готово" : "Ограничено"}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5">
        {checks.map((item) => (
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
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
        <span>Измерения в миллиметрах недоступны</span>
        <span>Не используйте маркеры как размер очага</span>
        <span>Выдача пациенту: выключена</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving"}
          onClick={onSave}
        >
          <ClipboardList className="h-3.5 w-3.5" aria-hidden /> Зафиксировать ограничение калибровки
        </Button>
        {(message || calibrationLimitSaved) && (
          <span className="text-[12px] font-medium text-primary" role="status">
            {message || "Ограничение калибровки зафиксировано локально"}
          </span>
        )}
      </div>
    </section>
  );
}

export function ComparisonTechnicalReviewPanel({
  backendStatus,
  message,
  readyDisabled,
  onReview,
}: {
  backendStatus: BackendStatus;
  message: string;
  readyDisabled: boolean;
  onReview: (status: TechnicalReviewStatus) => void;
}) {
  return (
    <section
      role="region"
      id="comparison-technical-review"
      aria-label="Технический разбор просмотра"
      className="mt-2 rounded-md border border-border bg-muted/20 p-2"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Технический разбор просмотра
          </div>
          <div className="text-[12px] font-medium">Решение по паре снимков</div>
        </div>
        <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
          служебные метки
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving" || readyDisabled}
          onClick={() => onReview("technical_ready")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {TECHNICAL_REVIEW_LABEL.technical_ready}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving"}
          onClick={() => onReview("needs_recapture")}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> {TECHNICAL_REVIEW_LABEL.needs_recapture}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] text-[12px] sm:min-h-[32px]"
          disabled={backendStatus === "saving"}
          onClick={() => onReview("not_suitable_for_comparison")}
        >
          <XCircle className="h-3.5 w-3.5" aria-hidden /> {TECHNICAL_REVIEW_LABEL.not_suitable_for_comparison}
        </Button>
      </div>
      <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground">
        <span>Решение техническое: не диагноз, не динамика, не измерение.</span>
        <span>Сначала сохраняется черновик проверки просмотра, затем журнал разбора.</span>
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

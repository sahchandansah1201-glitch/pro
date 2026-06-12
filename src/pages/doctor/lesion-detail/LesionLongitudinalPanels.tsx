import { RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ClinicalImage, Visit } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import type {
  SelfHostedLesionLongitudinalQaAction,
  SelfHostedLesionLongitudinalQaDTO,
} from "@/lib/self-hosted-clinical-workspace-api";

export type LongitudinalQaLoadStatus = "idle" | "loading" | "loaded" | "error";

export type LongitudinalVisitGroup = {
  visitId: string;
  visit: Visit | null;
  date: string;
  images: ClinicalImage[];
  assessmentCount: number;
  bestQuality: number;
  devices: string[];
  kinds: string[];
  sources: string[];
};

export type LongitudinalPairStatus = "ready" | "warning" | "blocked";

export type LongitudinalPair = {
  id: string;
  previous: LongitudinalVisitGroup;
  current: LongitudinalVisitGroup;
  previousImage: ClinicalImage;
  currentImage: ClinicalImage;
  status: LongitudinalPairStatus;
  reasons: string[];
};

const IMAGE_KIND: Record<ClinicalImage["kind"], string> = {
  overview: "Обзорный",
  dermoscopy: "Дерматоскопия",
  macro: "Макро",
  body_map: "Карта тела",
};

const LONGITUDINAL_PAIR_LABEL: Record<LongitudinalPairStatus, string> = {
  ready: "Сопоставимо",
  warning: "Сопоставимо с предупреждением",
  blocked: "Не сопоставимо",
};

const LONGITUDINAL_QA_STATUS_LABEL: Record<SelfHostedLesionLongitudinalQaDTO["readiness"]["status"], string> = {
  blocked: "Динамика заблокирована",
  needs_review: "Нужен технический разбор",
  technical_ready: "Техническая проверка готова",
};

const LONGITUDINAL_QA_ACTION_LABEL: Record<SelfHostedLesionLongitudinalQaAction, string> = {
  review_queue: "Разобрать очередь снимков",
  request_recapture: "Запросить переснимок",
  verify_production_asset: "Проверить рабочие снимки",
  exclude_from_dynamic_review: "Исключить из динамического разбора",
  complete_capture_metadata: "Дозаполнить данные съёмки",
  complete_device_metadata: "Дозаполнить данные устройства",
  check_device_bridge: "Проверить связь с устройством",
  complete_capture_protocol: "Дозаполнить протокол съёмки",
  complete_calibration: "Закрыть калибровку",
  place_markers: "Поставить технические маркеры",
  approve_measurement_policy: "Утвердить правила измерений",
  approve_production_analysis_policy: "Утвердить правила анализа",
  assign_reviewer: "Назначить проверяющего",
  complete_second_review: "Закрыть повторную проверку",
  continue_review: "Продолжить врачебный разбор",
};

const compactList = (values: string[]) => (values.length > 0 ? values.join(", ") : "—");

const imageDisplayLabel = (image: ClinicalImage) => `Снимок ${formatDate(image.capturedAt)}`;
const defaultDeviceLabel = (deviceId: string | null | undefined) => (deviceId ? "устройство указано" : "без устройства");

export function LongitudinalHistorySection({
  groups,
  pairs,
  formatDevice = defaultDeviceLabel,
}: {
  groups: LongitudinalVisitGroup[];
  pairs: LongitudinalPair[];
  formatDevice?: (deviceId: string | null | undefined) => string;
}) {
  const totalImages = groups.reduce((count, group) => count + group.images.length, 0);
  const comparablePairs = pairs.filter((pair) => pair.status !== "blocked").length;
  const blockedPairs = pairs.filter((pair) => pair.status === "blocked").length;

  return (
    <Card className="p-3 sm:p-4">
      <section aria-label="Продольная история очага">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold">Продольная история очага</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Технический обзор снимков одного очага между визитами. Не является оценкой динамики или клиническим выводом.
            </p>
          </div>
          <span className="rounded-sm border border-border bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
            Выдача пациенту: выключена
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Визиты</div>
            <div className="mt-1 font-medium">Визитов с фото: {groups.length}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Снимки</div>
            <div className="mt-1 font-medium">Снимков: {totalImages}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Пары</div>
            <div className="mt-1 font-medium">Сопоставимых пар: {comparablePairs}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Ограничения</div>
            <div className="mt-1 font-medium">Ограничений: {blockedPairs}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)]">
          <div className="min-w-0 rounded-md border border-border bg-background p-2">
            <h3 className="text-[12px] font-semibold">Визиты с фото</h3>
            <ul className="mt-2 divide-y divide-border">
              {groups.map((group) => (
                <li key={group.visitId} className="grid gap-1 py-2 text-[12px] sm:grid-cols-[120px_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <div className="font-medium text-[12px]">Визит {formatDate(group.date)}</div>
                    <div className="text-[11px] text-muted-foreground">служебный код скрыт</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5">
                        Снимков: {group.images.length}
                      </span>
                      <span className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5">
                        Оценок: {group.assessmentCount}
                      </span>
                      <span className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5">
                        Лучшее качество: {Math.round(group.bestQuality * 100)}%
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {compactList(group.kinds)} · {compactList(group.sources)} · {compactList(group.devices)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 rounded-md border border-border bg-background p-2">
            <h3 className="text-[12px] font-semibold">Пары между визитами</h3>
            {pairs.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Недостаточно повторяемых условий, чтобы собрать техническую пару.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {pairs.map((pair) => (
                  <li key={pair.id} className="rounded-sm border border-border bg-muted/20 p-2 text-[12px]">
                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium">
                          {imageDisplayLabel(pair.previousImage)} → {imageDisplayLabel(pair.currentImage)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDate(pair.previous.date)} → {formatDate(pair.current.date)} · {IMAGE_KIND[pair.currentImage.kind]} · {formatDevice(pair.currentImage.deviceId)}
                        </div>
                      </div>
                      <span
                        className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${
                          pair.status === "ready"
                            ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                            : pair.status === "warning"
                              ? "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
                              : "border-destructive/30 bg-destructive/10 text-destructive"
                        }`}
                      >
                        {LONGITUDINAL_PAIR_LABEL[pair.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {pair.reasons.map((reason) => (
                        <span key={reason} className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px]">
                          {reason}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <p
          className="mt-3 flex items-start gap-2 rounded-md border px-2 py-1.5 text-[12px]"
          style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.30)", color: "hsl(var(--warning))" }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Техническая история помогает выбрать пары для врачебного разбора. Не оценивайте динамику без повторяемых условий съёмки и врачебной проверки.
          </span>
        </p>
      </section>
    </Card>
  );
}

export function LongitudinalQaGateSection({
  qa,
  canRefresh,
  loadStatus,
  message,
  onRefresh,
}: {
  qa: SelfHostedLesionLongitudinalQaDTO;
  canRefresh: boolean;
  loadStatus: LongitudinalQaLoadStatus;
  message: string;
  onRefresh: () => void;
}) {
  const readiness = qa.readiness;

  return (
    <Card className="p-3 sm:p-4">
      <section aria-label="Готовность продольной проверки">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold">Готовность продольной проверки</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Техническая проверка перед любым разбором динамики. Не создаёт вывод о динамике.
            </p>
          </div>
          <span
            className={`rounded-sm border px-2 py-1 text-[11px] ${
              readiness.status === "technical_ready"
                ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                : readiness.status === "needs_review"
                  ? "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {LONGITUDINAL_QA_STATUS_LABEL[readiness.status]}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-10">
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Пары</div>
            <div className="mt-1 font-medium">Пар: {readiness.candidatePairCount}</div>
            <div className="text-[11px] text-muted-foreground">Визитов: {readiness.visitCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Готовые пары</div>
            <div className="mt-1 font-medium">Технически готово: {readiness.technicalReadyPairCount}</div>
            <div className="text-[11px] text-muted-foreground">Снимков: {readiness.imageCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Пересъёмка</div>
            <div className="mt-1 font-medium">Переснять: {readiness.needsRecaptureCount}</div>
            <div className="text-[11px] text-muted-foreground">Не использовать: {readiness.notSuitableForComparisonCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Данные</div>
            <div className="mt-1 font-medium">Не хватает: {readiness.missingCaptureMetadataCount}</div>
            <div className="text-[11px] text-muted-foreground">Устройство: {readiness.deviceEvidenceNotReadyCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Снимки</div>
            <div className="mt-1 font-medium">Проверить: {readiness.productionAssetNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Доступ через клинику</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Связь</div>
            <div className="mt-1 font-medium">Проверить: {readiness.deviceBridgeQualityNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Разбор: {readiness.unreviewedPairCount}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Протокол</div>
            <div className="mt-1 font-medium">Проверить: {readiness.captureProtocolNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Протокол съёмки</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Правила</div>
            <div className="mt-1 font-medium">Проверить: {readiness.measurementPolicyNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Измерения выключены</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Анализ</div>
            <div className="mt-1 font-medium">Проверить: {readiness.productionAnalysisPolicyNotReadyCount}</div>
            <div className="text-[11px] text-muted-foreground">Динамика выключена</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 text-[12px]">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Калибровка</div>
            <div className="mt-1 font-medium">Ограничений: {readiness.calibrationBlockedCount}</div>
            <div className="text-[11px] text-muted-foreground">Маркеры: {readiness.markerMissingCount}</div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
          <div className="min-w-0 rounded-md border border-border bg-background p-2">
            <h3 className="text-[12px] font-semibold">Блокеры рабочей проверки</h3>
            {qa.blockers.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">Блокеров рабочей проверки нет. Клинический вывод всё равно не создаётся.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {qa.blockers.map((blocker) => (
                  <li key={blocker.code} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border bg-muted/20 px-2 py-1.5 text-[12px]">
                    <span className="font-medium">{blocker.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {blocker.count} · {LONGITUDINAL_QA_ACTION_LABEL[blocker.nextAction]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 rounded-md border border-border bg-background p-2">
            <h3 className="text-[12px] font-semibold">Действия</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {qa.nextActions.map((action) => (
                <span key={action} className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5 text-[11px]">
                  {LONGITUDINAL_QA_ACTION_LABEL[action]}
                </span>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 min-h-[44px] text-[12px] sm:min-h-[32px]"
              onClick={onRefresh}
              disabled={!canRefresh || loadStatus === "loading"}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Обновить рабочую проверку
            </Button>
            {message && <p className="mt-2 text-[12px] text-muted-foreground">{message}</p>}
          </div>
        </div>

        <p
          className="mt-3 flex items-start gap-2 rounded-md border px-2 py-1.5 text-[12px]"
          style={{ background: "hsl(var(--warning) / 0.08)", borderColor: "hsl(var(--warning) / 0.30)", color: "hsl(var(--warning))" }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Вывод о динамике: выключен. Выдача пациенту: выключена. Медицинские измерения и клинические заключения доступны только после отдельного врачебного порядка.
          </span>
        </p>
      </section>
    </Card>
  );
}

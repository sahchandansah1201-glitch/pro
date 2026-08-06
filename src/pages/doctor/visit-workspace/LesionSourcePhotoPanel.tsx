import { Camera, CircleCheck, Image as ImageIcon, MapPin, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LesionSourceLocalization } from "@/pages/doctor/lesion-source-localization";

const COVERAGE_LABEL = {
  captured: "Снято полностью",
  partial: "Снято частично",
  not_captured: "Не снято",
} as const;

const CONFIRMATION_LABEL = {
  confirmed: "Подтверждено врачом",
  needs_review: "Нужно подтверждение врача",
  not_applicable: "Подтверждать нечего",
} as const;

interface Props {
  localization: LesionSourceLocalization;
  onOpenSource: (imageId: string) => void;
  onOpenCapture: () => void;
}

export function LesionSourcePhotoPanel({
  localization,
  onOpenSource,
  onOpenCapture,
}: Props) {
  const hasSource = Boolean(
    localization.overviewImageId &&
      localization.syntheticAssetPath &&
      localization.imagePoint,
  );

  return (
    <section
      aria-labelledby="lesion-source-heading"
      className="mt-3 border-t border-border pt-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="lesion-source-heading" className="text-[13px] font-semibold text-foreground">
          Источник положения
        </h3>
        <span
          className={`rounded-sm border px-1.5 py-0.5 text-[11px] font-medium ${
            localization.coverage === "captured"
              ? "border-success/40 bg-success/10 text-success"
              : localization.coverage === "partial"
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-border bg-surface-muted text-muted-foreground"
          }`}
        >
          {COVERAGE_LABEL[localization.coverage]}
        </span>
      </div>

      {hasSource ? (
        <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(128px,0.78fr)_minmax(0,1.22fr)]">
          <div>
            <div className="relative mx-auto aspect-[2/3] max-h-72 overflow-hidden border border-border bg-surface-muted">
              <img
                src={localization.syntheticAssetPath!}
                alt={`Синтетический обзорный снимок: ${localization.anatomicalRegion}, ${localization.anatomicalSubregion}`}
                className="h-full w-full object-contain"
              />
              <span
                data-testid="source-photo-marker"
                data-x={localization.imagePoint!.x}
                data-y={localization.imagePoint!.y}
                className="absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-destructive shadow-[0_0_0_2px_hsl(var(--destructive))]"
                style={{
                  left: `${localization.imagePoint!.x * 100}%`,
                  top: `${localization.imagePoint!.y * 100}%`,
                }}
                aria-label="Положение очага на исходном снимке"
              />
            </div>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              Синтетический обзорный снимок · не данные пациента
            </p>
          </div>

          <div className="min-w-0">
            <dl className="grid grid-cols-1 gap-2 text-[11px]">
              <div>
                <dt className="text-muted-foreground">Анатомическая область</dt>
                <dd className="font-medium text-foreground">
                  {localization.anatomicalRegion} · {localization.anatomicalSubregion}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Проверка положения</dt>
                <dd className="flex items-center gap-1 font-medium text-foreground">
                  {localization.clinicianConfirmation === "confirmed" ? (
                    <CircleCheck className="h-3.5 w-3.5 text-success" aria-hidden />
                  ) : (
                    <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden />
                  )}
                  {CONFIRMATION_LABEL[localization.clinicianConfirmation]}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Связь со снимками</dt>
                <dd className="font-medium text-foreground">
                  Обзорный снимок
                  {localization.linkedDermoscopyImageId ? " · дерматоскопия связана" : ""}
                </dd>
              </div>
            </dl>

            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {localization.note}
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 min-h-11 w-full justify-center text-[12px]"
              onClick={() => onOpenSource(localization.overviewImageId!)}
            >
              <ImageIcon className="mr-1 h-3.5 w-3.5" aria-hidden />
              Открыть исходный снимок
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 border-l-2 border-warning bg-warning/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-foreground">{localization.note}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Запросите дополнительный ракурс только с согласия пациента.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-2 min-h-11 text-[12px]"
            onClick={onOpenCapture}
          >
            <Camera className="mr-1 h-3.5 w-3.5" aria-hidden />
            Перейти к съёмке
          </Button>
        </div>
      )}
    </section>
  );
}

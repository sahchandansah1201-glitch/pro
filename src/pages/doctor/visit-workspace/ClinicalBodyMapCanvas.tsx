import { useEffect, useId, useRef, useState } from "react";

import { ClinicalBodyAtlas } from "@/components/clinical/ClinicalBodyAtlas";
import {
  CLINICAL_BODY_ATLAS_HEIGHT,
  CLINICAL_BODY_ATLAS_WIDTH,
  clinicalBodyProfileLabel,
  clinicalBodyRegionHitMapPath,
  type ClinicalBodyProfile,
  type ClinicalBodyView,
} from "@/lib/clinical-body-atlas";
import {
  clinicalBodyRegionsForView,
  type ClinicalBodyRegion,
} from "@/lib/clinical-body-regions";
import {
  bodyMapSurfaceBadge,
  bodyMapSurfaceLabel,
} from "@/pages/doctor/body-map-model";

export interface BodyMapCanvasPoint {
  id: string;
  num: number;
  x: number;
  y: number;
  selected: boolean;
  label: string;
  onSelect: () => void;
}

export interface ClinicalBodyRegionPlacement {
  view: ClinicalBodyView;
  x: number;
  y: number;
  regionId: string;
  regionLabel: string;
}

interface ClinicalBodyMapCanvasProps {
  profile: ClinicalBodyProfile;
  view: ClinicalBodyView;
  points: BodyMapCanvasPoint[];
  pending: { x: number; y: number; regionId?: string } | null;
  demoPoints: BodyMapCanvasPoint[];
  zoom?: number;
  onPlace: (placement: ClinicalBodyRegionPlacement) => void;
  onModelReadyChange?: (ready: boolean) => void;
}

function scalpShape(regionId: string) {
  switch (regionId) {
    case "scalp-anterior":
      return <rect x={42} y={92} width={156} height={64} />;
    case "scalp-posterior":
      return <rect x={42} y={245} width={156} height={63} />;
    case "scalp-left":
      return <rect x={42} y={156} width={53} height={89} />;
    case "scalp-right":
      return <rect x={145} y={156} width={53} height={89} />;
    default:
      return <rect x={95} y={156} width={50} height={89} />;
  }
}

function markerDisplayPosition(
  point: BodyMapCanvasPoint,
  allPoints: BodyMapCanvasPoint[],
  zoom: number,
) {
  const cluster = allPoints
    .filter((candidate) => candidate.x === point.x && candidate.y === point.y)
    .sort((left, right) => left.id.localeCompare(right.id));
  if (cluster.length < 2) return { x: point.x, y: point.y };

  const index = cluster.findIndex((candidate) => candidate.id === point.id);
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / cluster.length;
  const radius = 12 / zoom;
  return {
    x: point.x + (Math.cos(angle) * radius) / CLINICAL_BODY_ATLAS_WIDTH,
    y: point.y + (Math.sin(angle) * radius) / CLINICAL_BODY_ATLAS_HEIGHT,
  };
}

function BodyMapMarker({
  point,
  allPoints,
  zoom,
  local = false,
}: {
  point: BodyMapCanvasPoint;
  allPoints: BodyMapCanvasPoint[];
  zoom: number;
  local?: boolean;
}) {
  const display = markerDisplayPosition(point, allPoints, zoom);
  const markerId = local
    ? { "data-local-marker-id": point.id }
    : { "data-marker-id": point.id };
  const primary = "hsl(var(--primary))";
  const foreground = "hsl(var(--foreground))";

  return (
    <g>
      {(display.x !== point.x || display.y !== point.y) && (
        <line
          data-marker-connector={point.id}
          pointerEvents="none"
          x1={point.x * CLINICAL_BODY_ATLAS_WIDTH}
          y1={point.y * CLINICAL_BODY_ATLAS_HEIGHT}
          x2={display.x * CLINICAL_BODY_ATLAS_WIDTH}
          y2={display.y * CLINICAL_BODY_ATLAS_HEIGHT}
          stroke={local ? primary : foreground}
          strokeWidth={1 / zoom}
          strokeDasharray={local ? `${2 / zoom} ${2 / zoom}` : undefined}
        />
      )}
      <g
        {...markerId}
        transform={`translate(${display.x * CLINICAL_BODY_ATLAS_WIDTH} ${display.y * CLINICAL_BODY_ATLAS_HEIGHT}) scale(${1 / zoom}) translate(${-display.x * CLINICAL_BODY_ATLAS_WIDTH} ${-display.y * CLINICAL_BODY_ATLAS_HEIGHT})`}
        onClick={(event) => { event.stopPropagation(); point.onSelect(); }}
        style={{ cursor: "pointer" }}
      >
        <title>{local ? `Локальный учебный очаг: ${point.label}` : `${point.num}. ${point.label}`}</title>
        <circle
          cx={display.x * CLINICAL_BODY_ATLAS_WIDTH}
          cy={display.y * CLINICAL_BODY_ATLAS_HEIGHT}
          r={point.selected ? 8 : 6}
          fill={local || !point.selected ? "hsl(var(--surface))" : primary}
          stroke={local || point.selected ? primary : foreground}
          strokeDasharray={local ? "2 2" : undefined}
          strokeWidth={local ? 1.4 : 1.2}
          opacity={local ? 0.85 : undefined}
        />
        <text
          x={display.x * CLINICAL_BODY_ATLAS_WIDTH}
          y={display.y * CLINICAL_BODY_ATLAS_HEIGHT + 3}
          textAnchor="middle"
          fontSize={8}
          fontWeight={local ? 700 : 600}
          fill={local || !point.selected ? (local ? primary : foreground) : "hsl(var(--primary-foreground))"}
        >
          {point.num}
        </text>
      </g>
    </g>
  );
}

export function ClinicalBodyMapCanvas({
  profile,
  view,
  points,
  pending,
  demoPoints,
  zoom = 1,
  onPlace,
  onModelReadyChange,
}: ClinicalBodyMapCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const clipId = useId().replaceAll(":", "");
  const [hoveredRegion, setHoveredRegion] = useState<ClinicalBodyRegion | null>(null);
  const regions = clinicalBodyRegionsForView(view);
  const ariaLabel = `Карта тела · ${clinicalBodyProfileLabel(profile)} · ${bodyMapSurfaceLabel(view)}`;
  const badge = bodyMapSurfaceBadge(view);
  const hitMapPath = view === "scalp" ? null : clinicalBodyRegionHitMapPath(profile, view);
  const allPoints = [...points, ...demoPoints];
  const atlasKey = `${profile.sex}:${profile.ageBand}:${view}`;
  const [atlasLoadState, setAtlasLoadState] = useState<{
    atlasKey: string;
    status: "loading" | "ready" | "error";
    attempt: number;
  }>({
    atlasKey,
    status: view === "scalp" ? "ready" : "loading",
    attempt: 0,
  });
  const atlasStatus = view === "scalp"
    ? "ready"
    : atlasLoadState.atlasKey === atlasKey
      ? atlasLoadState.status
      : "loading";
  const atlasAttempt = atlasLoadState.atlasKey === atlasKey
    ? atlasLoadState.attempt
    : 0;
  const atlasReady = atlasStatus === "ready";

  useEffect(() => {
    onModelReadyChange?.(atlasReady);
  }, [atlasReady, onModelReadyChange]);

  const placeAtPointer = (region: ClinicalBodyRegion, event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation();
    if (!atlasReady) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onPlace({
      view,
      x: +x.toFixed(5),
      y: +y.toFixed(5),
      regionId: region.id,
      regionLabel: region.label,
    });
  };

  const placeAtAnchor = (region: ClinicalBodyRegion) => {
    if (!atlasReady) return;
    const target = Array.from(
      svgRef.current?.querySelectorAll<SVGGraphicsElement>("[data-region-id]") ?? [],
    ).find((element) => element.dataset.regionId === region.id);
    let point = region.anchor;
    try {
      const bounds = target?.getBBox();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        point = {
          x: +((bounds.x + bounds.width / 2) / CLINICAL_BODY_ATLAS_WIDTH).toFixed(5),
          y: +((bounds.y + bounds.height / 2) / CLINICAL_BODY_ATLAS_HEIGHT).toFixed(5),
        };
      }
    } catch {
      // An unavailable external SVG geometry falls back to the registry anchor.
    }
    onPlace({
      view,
      x: point.x,
      y: point.y,
      regionId: region.id,
      regionLabel: region.label,
    });
  };

  const nudgePending = (dx: number, dy: number) => {
    if (!atlasReady || !pending?.regionId) return;
    const region = regions.find((item) => item.id === pending.regionId);
    if (!region) return;
    const target = Array.from(
      svgRef.current?.querySelectorAll<SVGGraphicsElement>("[data-region-id]") ?? [],
    ).find((element) => element.dataset.regionId === region.id);
    let minX = 0;
    let maxX = 1;
    let minY = 0;
    let maxY = 1;
    try {
      const bounds = target?.getBBox();
      if (bounds && bounds.width > 0 && bounds.height > 0) {
        minX = bounds.x / CLINICAL_BODY_ATLAS_WIDTH;
        maxX = (bounds.x + bounds.width) / CLINICAL_BODY_ATLAS_WIDTH;
        minY = bounds.y / CLINICAL_BODY_ATLAS_HEIGHT;
        maxY = (bounds.y + bounds.height) / CLINICAL_BODY_ATLAS_HEIGHT;
      }
    } catch {
      // If external SVG geometry is unavailable, keep the point inside the atlas.
    }
    onPlace({
      view,
      x: +Math.min(maxX, Math.max(minX, pending.x + dx)).toFixed(5),
      y: +Math.min(maxY, Math.max(minY, pending.y + dy)).toFixed(5),
      regionId: region.id,
      regionLabel: region.label,
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        Коснитесь нужного места на модели или выберите область из списка.
      </p>
      {atlasStatus !== "error" ? (
        <div
          role="status"
          aria-label="Состояние модели"
          aria-live="polite"
          className="rounded-sm border border-border bg-surface px-2 py-1.5 text-[11px] text-muted-foreground"
        >
          {atlasStatus === "loading" ? "Модель загружается…" : "Модель готова"}
        </div>
      ) : (
        <div
          role="alert"
          aria-label="Состояние модели"
          className="rounded-sm border border-warning/40 bg-warning/10 px-2 py-2 text-[11px] text-foreground"
        >
          <div className="font-medium">Не удалось загрузить модель</div>
          <p className="mt-0.5 text-muted-foreground">
            Проверьте соединение и повторите загрузку. Точные метки временно недоступны.
          </p>
          <button
            type="button"
            className="mt-2 inline-flex min-h-11 items-center rounded-sm border border-border bg-surface px-3 text-[12px] font-medium outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setAtlasLoadState({
              atlasKey,
              status: "loading",
              attempt: atlasAttempt + 1,
            })}
          >
            Повторить
          </button>
        </div>
      )}
      {atlasStatus === "error" ? (
        <div
          data-testid="body-map-error-placeholder"
          aria-hidden="true"
          className="flex min-h-80 items-center justify-center rounded-sm border border-dashed border-border bg-surface-muted px-4 text-center text-[12px] text-muted-foreground"
        >
          Модель временно недоступна
        </div>
      ) : (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CLINICAL_BODY_ATLAS_WIDTH} ${CLINICAL_BODY_ATLAS_HEIGHT}`}
          className="block h-auto w-full"
          role="img"
          aria-label={ariaLabel}
        >
          <ClinicalBodyAtlas
            profile={profile}
            view={view}
            imageKey={`${atlasKey}:${atlasAttempt}`}
            onImageLoad={() => setAtlasLoadState({ atlasKey, status: "ready", attempt: atlasAttempt })}
            onImageError={() => setAtlasLoadState({ atlasKey, status: "error", attempt: atlasAttempt })}
          />
        <defs>
          <clipPath id={clipId}>
            <ellipse cx={120} cy={200} rx={78} ry={108} />
          </clipPath>
        </defs>
        <g data-testid="clinical-body-region-hit-map">
          {regions.map((region) => {
            const common = {
              "data-testid": `region-${region.id}`,
              "data-region-id": region.id,
              "data-region-label": region.label,
              fill: "hsl(var(--primary))",
              fillOpacity: hoveredRegion?.id === region.id && zoom <= 2 ? 0.16 : 0.001,
              pointerEvents: atlasReady ? "all" as const : "none" as const,
              onPointerEnter: () => atlasReady && setHoveredRegion(region),
              onClick: (event: React.MouseEvent<SVGElement>) => placeAtPointer(region, event),
              style: { cursor: atlasReady ? "crosshair" : "default" },
            };
            return hitMapPath ? (
              <use key={region.id} href={`${hitMapPath}#region-${region.id}`} {...common} />
            ) : (
              <g key={region.id} clipPath={`url(#${clipId})`} {...common}>
                {scalpShape(region.id)}
              </g>
            );
          })}
        </g>

        <g pointerEvents="none" transform={`scale(${1 / zoom})`}>
          <rect
            x={4}
            y={4}
            rx={2}
            ry={2}
            width={badge.length * 5.4 + 10}
            height={14}
            fill="hsl(var(--primary))"
            opacity={0.9}
          />
          <text
            x={9}
            y={14}
            fontSize={9}
            fontWeight={700}
            letterSpacing="0.5"
            fill="hsl(var(--primary-foreground))"
            stroke="none"
          >
            {badge}
          </text>
        </g>

        {atlasReady && demoPoints.map((point) => (
          <BodyMapMarker
            key={`demo-${point.id}`}
            point={point}
            allPoints={allPoints}
            zoom={zoom}
            local
          />
        ))}

        {atlasReady && points.map((point) => (
          <BodyMapMarker
            key={point.id}
            point={point}
            allPoints={allPoints}
            zoom={zoom}
          />
        ))}

        {atlasReady && pending && (
          <g
            pointerEvents="none"
            transform={`translate(${pending.x * CLINICAL_BODY_ATLAS_WIDTH} ${pending.y * CLINICAL_BODY_ATLAS_HEIGHT}) scale(${1 / zoom}) translate(${-pending.x * CLINICAL_BODY_ATLAS_WIDTH} ${-pending.y * CLINICAL_BODY_ATLAS_HEIGHT})`}
          >
            <circle
              cx={pending.x * CLINICAL_BODY_ATLAS_WIDTH}
              cy={pending.y * CLINICAL_BODY_ATLAS_HEIGHT}
              r={9}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeDasharray="3 2"
              strokeWidth={1.4}
            />
            <text
              x={pending.x * CLINICAL_BODY_ATLAS_WIDTH}
              y={pending.y * CLINICAL_BODY_ATLAS_HEIGHT + 3}
              textAnchor="middle"
              fontSize={10}
              fontWeight={700}
              fill="hsl(var(--primary))"
            >
              +
            </text>
          </g>
        )}
        </svg>
      )}

      <div className="rounded-sm border border-border bg-surface px-2 py-1.5 text-[11px]">
        <span className="font-medium text-foreground">Область под указателем: </span>
        <span role="status" aria-live="polite" className="text-muted-foreground">
          {hoveredRegion?.label ?? "не выбрана"}
        </span>
      </div>
      <label className="block text-[11px] text-muted-foreground">
        Выбрать область с клавиатуры
        <select
          className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground"
          aria-label="Выбрать анатомическую область"
          disabled={!atlasReady}
          value=""
          onChange={(event) => {
            const region = regions.find((item) => item.id === event.target.value);
            if (region) placeAtAnchor(region);
          }}
        >
          <option value="">Выберите область…</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>{region.label}</option>
          ))}
        </select>
      </label>
      {atlasReady && pending?.regionId && (
        <div
          role="group"
          aria-label="Точное положение метки"
          className="rounded-sm border border-border bg-surface p-2"
        >
          <div className="text-[11px] font-medium text-foreground">Уточнить положение с клавиатуры</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {[
              ["Сдвинуть метку влево", "←", -0.005, 0],
              ["Сдвинуть метку вверх", "↑", 0, -0.005],
              ["Сдвинуть метку вниз", "↓", 0, 0.005],
              ["Сдвинуть метку вправо", "→", 0.005, 0],
            ].map(([label, glyph, dx, dy]) => (
              <button
                key={String(label)}
                type="button"
                aria-label={String(label)}
                onClick={() => nudgePending(Number(dx), Number(dy))}
                className="inline-flex h-11 w-11 items-center justify-center rounded-sm border border-border bg-background text-[16px] text-foreground outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {glyph}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Шаг — 0,5% ширины или высоты модели; метка остаётся в выбранной области.
          </p>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {zoom > 2 && "На увеличении контур области скрыт, чтобы не перекрывать точное место метки. "}
        Названия областей — технический анатомический справочник. Врачебная проверка границ ещё не выполнена.
      </p>
    </div>
  );
}

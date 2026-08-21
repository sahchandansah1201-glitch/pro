import { useId, useRef, useState } from "react";

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
  pending: { x: number; y: number } | null;
  demoPoints: BodyMapCanvasPoint[];
  zoom?: number;
  onPlace: (placement: ClinicalBodyRegionPlacement) => void;
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

export function ClinicalBodyMapCanvas({
  profile,
  view,
  points,
  pending,
  demoPoints,
  zoom = 1,
  onPlace,
}: ClinicalBodyMapCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const clipId = useId().replaceAll(":", "");
  const [hoveredRegion, setHoveredRegion] = useState<ClinicalBodyRegion | null>(null);
  const regions = clinicalBodyRegionsForView(view);
  const ariaLabel = `Карта тела · ${clinicalBodyProfileLabel(profile)} · ${bodyMapSurfaceLabel(view)}`;
  const badge = bodyMapSurfaceBadge(view);
  const hitMapPath = view === "scalp" ? null : clinicalBodyRegionHitMapPath(profile, view);

  const placeAtPointer = (region: ClinicalBodyRegion, event: React.MouseEvent<SVGElement>) => {
    event.stopPropagation();
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

  return (
    <div className="space-y-2">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CLINICAL_BODY_ATLAS_WIDTH} ${CLINICAL_BODY_ATLAS_HEIGHT}`}
        className="block h-auto w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <ClinicalBodyAtlas profile={profile} view={view} />
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
              pointerEvents: "all" as const,
              onPointerEnter: () => setHoveredRegion(region),
              onClick: (event: React.MouseEvent<SVGElement>) => placeAtPointer(region, event),
              style: { cursor: "crosshair" },
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

        {demoPoints.map((point) => (
          <g
            key={`demo-${point.id}`}
            data-local-marker-id={point.id}
            transform={`translate(${point.x * CLINICAL_BODY_ATLAS_WIDTH} ${point.y * CLINICAL_BODY_ATLAS_HEIGHT}) scale(${1 / zoom}) translate(${-point.x * CLINICAL_BODY_ATLAS_WIDTH} ${-point.y * CLINICAL_BODY_ATLAS_HEIGHT})`}
            onClick={(event) => { event.stopPropagation(); point.onSelect(); }}
            style={{ cursor: "pointer" }}
          >
            <title>{`Локальный учебный очаг: ${point.label}`}</title>
            <circle
              cx={point.x * CLINICAL_BODY_ATLAS_WIDTH}
              cy={point.y * CLINICAL_BODY_ATLAS_HEIGHT}
              r={point.selected ? 8 : 6}
              fill="hsl(var(--surface))"
              stroke="hsl(var(--primary))"
              strokeDasharray="2 2"
              strokeWidth={1.4}
              opacity={0.85}
            />
            <text
              x={point.x * CLINICAL_BODY_ATLAS_WIDTH}
              y={point.y * CLINICAL_BODY_ATLAS_HEIGHT + 3}
              textAnchor="middle"
              fontSize={8}
              fontWeight={700}
              fill="hsl(var(--primary))"
            >
              {point.num}
            </text>
          </g>
        ))}

        {points.map((point) => (
          <g
            key={point.id}
            data-marker-id={point.id}
            transform={`translate(${point.x * CLINICAL_BODY_ATLAS_WIDTH} ${point.y * CLINICAL_BODY_ATLAS_HEIGHT}) scale(${1 / zoom}) translate(${-point.x * CLINICAL_BODY_ATLAS_WIDTH} ${-point.y * CLINICAL_BODY_ATLAS_HEIGHT})`}
            onClick={(event) => { event.stopPropagation(); point.onSelect(); }}
            style={{ cursor: "pointer" }}
          >
            <title>{`${point.num}. ${point.label}`}</title>
            <circle
              cx={point.x * CLINICAL_BODY_ATLAS_WIDTH}
              cy={point.y * CLINICAL_BODY_ATLAS_HEIGHT}
              r={point.selected ? 8 : 6}
              fill={point.selected ? "hsl(var(--primary))" : "hsl(var(--surface))"}
              stroke={point.selected ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
              strokeWidth={1.2}
            />
            <text
              x={point.x * CLINICAL_BODY_ATLAS_WIDTH}
              y={point.y * CLINICAL_BODY_ATLAS_HEIGHT + 3}
              textAnchor="middle"
              fontSize={8}
              fontWeight={600}
              fill={point.selected ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"}
            >
              {point.num}
            </text>
          </g>
        ))}

        {pending && (
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

      <div className="rounded-sm border border-border bg-surface px-2 py-1.5 text-[11px]">
        <span className="font-medium text-foreground">Область под указателем: </span>
        <span role="status" aria-live="polite" className="text-muted-foreground">
          {hoveredRegion?.label ?? "наведите указатель на модель"}
        </span>
      </div>
      <label className="block text-[11px] text-muted-foreground">
        Выбрать область с клавиатуры
        <select
          className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2 text-[12px] text-foreground"
          aria-label="Выбрать анатомическую область"
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
      <p className="text-[11px] text-muted-foreground">
        {zoom > 2 && "На увеличении контур области скрыт, чтобы не перекрывать точное место метки. "}
        Названия областей — технический анатомический справочник. Врачебная проверка границ ещё не выполнена.
      </p>
    </div>
  );
}

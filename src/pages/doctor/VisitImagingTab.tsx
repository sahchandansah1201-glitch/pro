import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  FileUp,
  HardDrive,
  Smartphone,
  QrCode,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronRight,
  RefreshCw,
  MapPin,
  CloudUpload,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getImagesByVisitId } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import type { ClinicalImage, Lesion, Visit } from "@/lib/domain";
import {
  getAssetDownloadUrl,
  listVisitAssets,
  uploadVisitAsset,
  type AssetsApiError,
  type SafeAssetDTO,
} from "@/lib/clinical-assets-api";

// Порог качества изображения. Ниже — снимок «требует проверки».
const QUALITY_THRESHOLD = 0.8;

// Stage 2E-A: client-side preflight allow-list. Server-side validation
// remains the final authority — this is purely UX guidance.
const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const KIND_LABEL: Record<ClinicalImage["kind"], string> = {
  overview: "Обзор",
  dermoscopy: "Дерматоскопия",
  macro: "Макро",
  body_map: "Body map",
};

const SOURCE_LABEL: Record<ClinicalImage["source"], string> = {
  phone: "Телефон",
  file: "Файл",
  camera: "Камера",
  device_bridge: "Device Bridge",
  local_transfer: "Локальный перенос",
};

type KindFilter = "all" | ClinicalImage["kind"];
type SourceFilter = "all" | ClinicalImage["source"];
type QualityFilter = "all" | "needs_review";
// "all" | "unlinked" | lesionId
type LesionFilter = string;

interface Props {
  visit: Visit;
  patientId: string;
  lesions: Lesion[];
  initialLesionId?: string | null;
  onOpenBodyMap?: (lesionId: string) => void;
  /**
   * Bearer JWT for the clinical assets API. When omitted the imaging tab
   * stays in demo mode and the API panel renders a muted "not configured"
   * status without attempting any network call.
   */
  apiToken?: string | null;
  /** Origin of the Supabase project. Optional for the same reason as the token. */
  apiBaseUrl?: string | null;
}

export function VisitImagingTab({
  visit,
  patientId,
  lesions,
  initialLesionId,
  onOpenBodyMap,
  apiToken,
  apiBaseUrl,
}: Props) {
  const allImages = useMemo(
    () => [...getImagesByVisitId(visit.id)].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    [visit.id],
  );

  const lesionMap = useMemo(() => {
    const m = new Map<string, Lesion>();
    for (const l of lesions) m.set(l.id, l);
    return m;
  }, [lesions]);

  const [lesionFilter, setLesionFilter] = useState<LesionFilter>(
    initialLesionId && lesions.some((l) => l.id === initialLesionId) ? initialLesionId : "all",
  );
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");

  // React to URL-driven lesion changes after mount.
  useEffect(() => {
    if (initialLesionId && lesions.some((l) => l.id === initialLesionId)) {
      setLesionFilter(initialLesionId);
    }
  }, [initialLesionId, lesions]);

  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const showCaptureNotice = (label: string) =>
    setCaptureNotice(`Демо: источник «${label}» выбран, реальный захват будет подключён позже.`);

  const filtered = useMemo(() => {
    return allImages.filter((img) => {
      if (lesionFilter === "unlinked" && img.lesionId !== null) return false;
      if (lesionFilter !== "all" && lesionFilter !== "unlinked" && img.lesionId !== lesionFilter) return false;
      if (kindFilter !== "all" && img.kind !== kindFilter) return false;
      if (sourceFilter !== "all" && img.source !== sourceFilter) return false;
      if (qualityFilter === "needs_review" && !needsReview(img)) return false;
      return true;
    });
  }, [allImages, lesionFilter, kindFilter, sourceFilter, qualityFilter]);

  const [selectedId, setSelectedId] = useState<string | null>(allImages[0]?.id ?? null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Fix 1: keep viewer selection in sync with active filters.
  // Pure derivation — actual state sync happens in useEffect below.
  const effectiveSelectedId =
    selectedId && filtered.some((i) => i.id === selectedId)
      ? selectedId
      : filtered[0]?.id ?? null;

  const selected = effectiveSelectedId
    ? allImages.find((i) => i.id === effectiveSelectedId) ?? null
    : null;

  // Fix 2: never compare an image with itself. Pure derivation.
  const effectiveCompareId =
    compareId && compareId !== effectiveSelectedId ? compareId : null;

  // Sync state to derived values after render.
  useEffect(() => {
    if (effectiveSelectedId !== selectedId) {
      setSelectedId(effectiveSelectedId);
    }
  }, [effectiveSelectedId, selectedId]);

  useEffect(() => {
    if (compareId && compareId === effectiveSelectedId) {
      setCompareId(null);
    }
  }, [compareId, effectiveSelectedId]);

  useEffect(() => {
    if (compareId && !allImages.some((i) => i.id === compareId)) {
      setCompareId(null);
    }
  }, [compareId, allImages]);

  const compare = effectiveCompareId
    ? allImages.find((i) => i.id === effectiveCompareId) ?? null
    : null;

  // Counts for compact summary.
  const summary = useMemo(() => {
    const total = allImages.length;
    const dermoscopy = allImages.filter((i) => i.kind === "dermoscopy").length;
    const lowQuality = allImages.filter(needsReview).length;
    const unlinked = allImages.filter((i) => i.lesionId === null || i.kind === "body_map").length;
    return { total, dermoscopy, lowQuality, unlinked };
  }, [allImages]);

  return (
    <div className="flex flex-col gap-3">
      {/* Patch 3: Capture toolbar — приглушённый фон без тени, отделяет управляющую зону. */}
      <section className="surface-toolbar">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[12px] font-medium text-muted-foreground">Захват</span>
            <CaptureBtn icon={<Smartphone className="h-3.5 w-3.5" />} label="Телефон" onClick={() => showCaptureNotice("Телефон")} />
            <CaptureBtn icon={<FileUp className="h-3.5 w-3.5" />} label="Файл" onClick={() => showCaptureNotice("Файл")} />
            <CaptureBtn icon={<HardDrive className="h-3.5 w-3.5" />} label="Device Bridge" onClick={() => showCaptureNotice("Device Bridge")} />
            <CaptureBtn icon={<QrCode className="h-3.5 w-3.5" />} label="QR / локально" onClick={() => showCaptureNotice("Локальный перенос")} />
          </div>
          <SummaryStrip summary={summary} />
        </div>
        {captureNotice && (
          <div className="border-t border-border bg-surface px-3 py-1.5 text-[12px] text-muted-foreground">
            {captureNotice}
          </div>
        )}
      </section>

      {/* Patch 3: Filters — 2 группы (Что показывать | Откуда/качество), разделитель + счётчик справа. */}
      <section className="surface-toolbar">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-3 py-2">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <FilterSelect
              label="Образование"
              value={lesionFilter}
              onChange={setLesionFilter}
              options={[
                { value: "all", label: "Все образования" },
                { value: "unlinked", label: "Body map / без привязки" },
                ...lesions.map((l) => ({ value: l.id, label: `${l.label} · ${l.bodyZone}` })),
              ]}
            />
            <FilterSelect
              label="Тип"
              value={kindFilter}
              onChange={(v) => setKindFilter(v as KindFilter)}
              options={[
                { value: "all", label: "Все" },
                { value: "overview", label: "Обзор" },
                { value: "dermoscopy", label: "Дерматоскопия" },
                { value: "macro", label: "Макро" },
                { value: "body_map", label: "Body map" },
              ]}
            />
          </div>

          <div className="hidden h-8 w-px self-end bg-border md:block" aria-hidden />

          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <FilterSelect
              label="Источник"
              value={sourceFilter}
              onChange={(v) => setSourceFilter(v as SourceFilter)}
              options={[
                { value: "all", label: "Все" },
                { value: "phone", label: "Телефон" },
                { value: "camera", label: "Камера" },
                { value: "device_bridge", label: "Device Bridge" },
                { value: "local_transfer", label: "Локальный перенос" },
                { value: "file", label: "Файл" },
              ]}
            />
            <FilterSelect
              label="Качество"
              value={qualityFilter}
              onChange={(v) => setQualityFilter(v as QualityFilter)}
              options={[
                { value: "all", label: "Все" },
                { value: "needs_review", label: "Требуют проверки" },
              ]}
            />
          </div>

          <div className="ml-auto self-end text-[13px] tabular-nums text-muted-foreground">
            Показано <span className="font-semibold text-foreground">{filtered.length}</span> из {allImages.length}
          </div>
        </div>
      </section>

      {/* Main: grid + viewer */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Grid */}
        <section className="surface-card lg:col-span-7">
          <div className="section-bar">
            <h2 className="h-section">Снимки визита</h2>
            <span className="h-section-hint">{filtered.length} шт.</span>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 pb-4 text-[13px] text-muted-foreground">
              По выбранным фильтрам снимков нет. Сбросьте фильтры или выберите другой источник.
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-3">
              {filtered.map((img) => {
                const lesion = img.lesionId ? lesionMap.get(img.lesionId) ?? null : null;
                const isSel = img.id === effectiveSelectedId;
                const isCmp = img.id === effectiveCompareId;
                return (
                  <li key={img.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(img.id)}
                      className={`group flex w-full flex-col overflow-hidden rounded-md border text-left transition-colors ${
                        isSel
                          ? "border-primary ring-1 ring-primary"
                          : isCmp
                            ? "border-info"
                            : "border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      <ThumbPlaceholder image={img} />
                      {/* Patch 3: 3 строки вместо 5 — тип+лесион, источник·дата+чип, issues одной строкой. */}
                      <div className="flex flex-col gap-1 px-2 py-2">
                        <div className="flex min-w-0 items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-foreground">
                            {KIND_LABEL[img.kind]}
                          </span>
                          <span className="shrink-0 truncate text-[12px] text-muted-foreground">
                            {lesion ? lesion.label : "без привязки"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] text-muted-foreground">
                            {SOURCE_LABEL[img.source]} · {formatDateTime(img.capturedAt)}
                          </span>
                          <QualityChip image={img} compact />
                        </div>
                        {img.quality.issues.length > 0 && (
                          <div className="truncate text-[12px] text-warning">
                            {img.quality.issues.join(", ")}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Viewer + compare + timeline */}
        <section className="surface-card lg:col-span-5">
          <div className="section-bar">
            <h2 className="h-section">Просмотр</h2>
            {selected && <QualityChip image={selected} />}
          </div>
          {!selected ? (
            <div className="px-4 pb-4 text-[13px] text-muted-foreground">Снимок не выбран.</div>
          ) : (
            <div className="flex flex-col gap-3 px-3 pb-3">
              {/* Zoom toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-muted px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom((z) => clampZoom(z - 0.2))} aria-label="Уменьшить">
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <span className="w-12 text-center text-[12px] tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom((z) => clampZoom(z + 0.2))} aria-label="Увеличить">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setZoom(1)} aria-label="Сбросить масштаб">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <CompareSelect
                  selectedId={selected.id}
                  compareId={effectiveCompareId}
                  onChange={setCompareId}
                  images={allImages}
                  lesionMap={lesionMap}
                />
              </div>

              {/* Preview(s) */}
              <div
                className={`grid gap-2 ${compare ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}
              >
                <PreviewPane image={selected} zoom={zoom} title="Основной" />
                {compare && <PreviewPane image={compare} zoom={zoom} title="Сравнение" />}
              </div>

              {/* Quality panel */}
              <QualityPanel image={selected} />

              {/* Metadata */}
              <ImageMeta image={selected} lesionMap={lesionMap} />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {selected.lesionId ? (
                  <Button asChild size="sm" variant="secondary" className="min-h-[44px] text-[12px] sm:min-h-[32px]">
                    <Link to={`/patients/${patientId}/lesions/${selected.lesionId}`}>
                      Открыть образование <ChevronRight className="ml-0.5 h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                ) : (
                  <span className="text-[12px] text-muted-foreground">Снимок не привязан к образованию.</span>
                )}
                {selected.lesionId && onOpenBodyMap && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                    onClick={() => onOpenBodyMap(selected.lesionId!)}
                  >
                    <MapPin className="mr-1 h-3.5 w-3.5" aria-hidden /> Открыть на Body Map
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-[44px] text-[12px] sm:min-h-[32px]"
                  onClick={() => showCaptureNotice("Повтор снимка")}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Повторить снимок
                </Button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Timeline */}
      <section className="surface-card">
        <div className="section-bar">
          <h2 className="h-section">Таймлайн снимков</h2>
          <span className="h-section-hint">{allImages.length} событий</span>
        </div>
        {allImages.length === 0 ? (
          <div className="px-4 pb-4 text-[13px] text-muted-foreground">Снимков визита нет.</div>
        ) : (
          <ol className="divide-y divide-border">
            {allImages.map((img) => {
              const lesion = img.lesionId ? lesionMap.get(img.lesionId) ?? null : null;
              const isSel = img.id === effectiveSelectedId;
              return (
                <li key={img.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(img.id)}
                    className={`block w-full min-h-[44px] px-4 py-2 text-left ${
                      isSel ? "bg-surface-muted" : "hover:bg-surface-muted"
                    }`}
                  >
                    {/* Mobile: 2-line stacked */}
                    <div className="flex flex-col gap-0.5 sm:hidden">
                      <div className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="tabular-nums text-muted-foreground">{formatDateTime(img.capturedAt)}</span>
                        <QualityChip image={img} compact />
                      </div>
                      <div className="text-[13px] text-foreground">
                        {KIND_LABEL[img.kind]} · {SOURCE_LABEL[img.source]} · {lesion ? lesion.label : "без привязки"}
                      </div>
                    </div>
                    {/* Desktop: dense single row */}
                    <div className="hidden grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 text-[12px] sm:grid">
                      <span className="tabular-nums text-muted-foreground">{formatDateTime(img.capturedAt)}</span>
                      <span className="min-w-0 truncate">
                        {KIND_LABEL[img.kind]} · {SOURCE_LABEL[img.source]} · {lesion ? lesion.label : "без привязки"}
                      </span>
                      <QualityChip image={img} compact />
                    </div>
                  </button>

                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Stage 1E-E · API assets panel. Network calls live in
          src/lib/clinical-assets-api.ts; this component only consumes them. */}
      <ApiAssetsPanel
        visitId={visit.id}
        apiToken={apiToken ?? null}
        apiBaseUrl={apiBaseUrl ?? null}
      />
    </div>
  );
}

// ───────── API assets panel ─────────

interface ApiAssetsPanelProps {
  visitId: string;
  apiToken: string | null;
  apiBaseUrl: string | null;
}

type ErrorContext = "list" | "download" | "upload";

function ApiAssetsPanel({ visitId, apiToken, apiBaseUrl }: ApiAssetsPanelProps) {
  const configured = Boolean(apiToken && apiBaseUrl);
  const [assets, setAssets] = useState<SafeAssetDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<AssetsApiError | null>(null);
  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initial load + manual reload trigger.
  useEffect(() => {
    if (!configured) {
      setAssets(null);
      return;
    }
    let cancelled = false;
    setBusy(true);
    busyRef.current = true;
    setError(null);
    setErrorContext(null);
    listVisitAssets({ token: apiToken, baseUrl: apiBaseUrl, visitId })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setAssets(res.value ?? []);
        } else {
          setError(res.error);
          setErrorContext("list");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
          busyRef.current = false;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configured, apiToken, apiBaseUrl, visitId, reloadTick]);

  const handleUploadClick = useCallback(() => {
    if (!configured) {
      setStatus("Загрузка снимков требует авторизованной сессии API.");
      return;
    }
    fileInputRef.current?.click();
  }, [configured]);

  const processFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      // Guard against duplicate uploads while one is pending. The button
      // is disabled while busy, but drag/drop has no built-in disable.
      if (busyRef.current) return;
      const type = (file.type || "").toLowerCase();
      if (!type.startsWith("image/") || !ACCEPTED_IMAGE_MIME.includes(type)) {
        setError(null);
        setErrorContext(null);
        setStatus("Выберите файл изображения: JPEG, PNG, WebP или HEIC.");
        return;
      }
      setBusy(true);
      busyRef.current = true;
      setUploading(true);
      setError(null);
      setErrorContext(null);
      setStatus(`Загружаем: ${file.name}`);
      const res = await uploadVisitAsset({
        token: apiToken,
        baseUrl: apiBaseUrl,
        visitId,
        file,
        kind: "overview",
        source: "file",
      });
      if (res.ok) {
        setStatus("Снимок загружен.");
        setReloadTick((n) => n + 1);
      } else {
        // Do not clear `assets` — keep already-rendered rows visible.
        setError(res.error);
        setErrorContext("upload");
        setStatus(null);
      }
      setBusy(false);
      busyRef.current = false;
      setUploading(false);
    },
    [apiToken, apiBaseUrl, visitId],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      e.target.value = "";
      await processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!configured || busyRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      setDragActive(true);
    },
    [configured],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (!configured) {
        setStatus("Загрузка снимков требует авторизованной сессии API.");
        return;
      }
      if (busyRef.current) return;
      // Multiple files: only the first is used.
      const file = e.dataTransfer?.files?.[0] ?? null;
      await processFile(file);
    },
    [configured, processFile],
  );

  const handleRefresh = useCallback(() => {
    setStatus(null);
    setError(null);
    setErrorContext(null);
    setReloadTick((n) => n + 1);
  }, []);

  const [preview, setPreview] = useState<
    { asset: SafeAssetDTO; downloadUrl: string } | null
  >(null);

  const handleOpen = useCallback(
    async (asset: SafeAssetDTO) => {
      setBusy(true);
      setError(null);
      setErrorContext(null);
      setStatus("Подготовка ссылки…");
      const res = await getAssetDownloadUrl({
        token: apiToken,
        baseUrl: apiBaseUrl,
        assetId: asset.id,
      });
      setBusy(false);
      if (res.ok && res.value) {
        setStatus(null);
        setPreview({ asset, downloadUrl: res.value.downloadUrl });
      } else if (!res.ok) {
        setError(res.error);
        setErrorContext("download");
        setStatus(null);
      }
    },
    [apiToken, apiBaseUrl],
  );

  const handleClosePreview = useCallback(() => {
    setPreview(null);
  }, []);

  const handleOpenInNewTab = useCallback(() => {
    if (preview) {
      window.open(preview.downloadUrl, "_blank", "noopener,noreferrer");
    }
  }, [preview]);

  return (
    <section className="surface-card" aria-label="API ассеты визита">
      <div className="section-bar">
        <h2 className="h-section">API ассеты</h2>
        <span className="h-section-hint">
          {configured
            ? assets
              ? `${assets.length} шт.`
              : busy
                ? "загрузка…"
                : "—"
            : "демо-режим"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
        <Button
          size="sm"
          variant="secondary"
          className="h-10 gap-1.5 text-[13px] sm:h-8 sm:text-[12px]"
          onClick={handleUploadClick}
          disabled={busy}
          aria-label="Загрузить снимок"
        >
          <CloudUpload className="h-3.5 w-3.5" /> Загрузить снимок
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-10 gap-1.5 text-[13px] sm:h-8 sm:text-[12px]"
          onClick={handleRefresh}
          disabled={!configured || busy}
          aria-label="Обновить список ассетов"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Обновить
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={handleFileChange}
          aria-hidden
          tabIndex={-1}
        />
        <div
          role="button"
          tabIndex={configured && !busy ? 0 : -1}
          aria-label="Перетащите снимок сюда для загрузки"
          aria-disabled={!configured || busy}
          onClick={handleUploadClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleUploadClick();
            }
          }}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          data-active={dragActive ? "true" : "false"}
          className={`flex flex-1 min-w-[180px] flex-wrap items-center gap-x-2 gap-y-0 rounded-md border border-dashed px-2 py-1.5 text-[12px] transition-colors ${
            dragActive
              ? "border-primary bg-primary/5 text-foreground"
              : "border-border text-muted-foreground hover:border-muted-foreground/50"
          } ${!configured || busy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span>Перетащите снимок сюда</span>
          <span aria-hidden>·</span>
          <span>JPEG, PNG, WebP или HEIC</span>
        </div>
      </div>

      {!configured && (
        <p className="px-3 pb-3 text-[12px] text-muted-foreground">
          Демо-режим: API клинических ассетов не сконфигурирован для текущей сессии.
          Загрузка и подписанные ссылки доступны только при авторизованной сессии.
        </p>
      )}

      {status && (
        <p className="px-3 pb-2 text-[12px] text-muted-foreground" role="status">
          {status}
        </p>
      )}

      {error && errorContext && (
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          <p className="text-[12px] text-warning" role="alert">
            {assetsErrorMessage(error, errorContext)}
          </p>
          {errorContext === "list" && (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 gap-1.5 text-[12px]"
              onClick={handleRefresh}
              disabled={busy}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Повторить
            </Button>
          )}
        </div>
      )}

      {configured && assets && assets.length === 0 && !busy && (
        <p className="px-3 pb-3 text-[12px] text-muted-foreground">
          В API ещё нет ассетов для этого визита.
        </p>
      )}

      {configured && assets && assets.length > 0 && (
        <ul className="divide-y divide-border">
          {assets.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
            >
              <div className="min-w-0 text-[12px]">
                <div className="truncate font-medium text-foreground">
                  {KIND_LABEL[a.kind]} · {SOURCE_LABEL[a.source]}
                </div>
                <div className="truncate text-muted-foreground">
                  Снято: {formatDateTime(a.capturedAt)} · качество{" "}
                  {Math.round((a.qualityScore || 0) * 100)}%
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-10 gap-1.5 text-[12px] sm:h-8"
                onClick={() => handleOpen(a)}
                disabled={busy}
                aria-label={`Открыть снимок ${a.id}`}
              >
                <ExternalLink className="h-3.5 w-3.5" /> Открыть
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AssetPreviewDialog
        preview={preview}
        onClose={handleClosePreview}
        onOpenInNewTab={handleOpenInNewTab}
      />
    </section>
  );
}

interface AssetPreviewDialogProps {
  preview: { asset: SafeAssetDTO; downloadUrl: string } | null;
  onClose: () => void;
  onOpenInNewTab: () => void;
}

function AssetPreviewDialog({ preview, onClose, onOpenInNewTab }: AssetPreviewDialogProps) {
  const open = preview !== null;
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Reset image-load state whenever the previewed asset changes (or closes).
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [preview?.asset.id]);

  const isLoading = preview !== null && !imageLoaded && !imageError;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Просмотр снимка</DialogTitle>
          <DialogDescription>
            {preview
              ? `${KIND_LABEL[preview.asset.kind]} · ${SOURCE_LABEL[preview.asset.source]} · ${formatDateTime(preview.asset.capturedAt)} · качество ${Math.round((preview.asset.qualityScore || 0) * 100)}%`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {preview && (
          <div className="flex flex-col gap-3">
            <div
              className="relative overflow-hidden rounded-md border border-border bg-surface-sunken"
              aria-busy={isLoading}
            >
              {imageError ? (
                <p
                  className="px-3 py-6 text-center text-[13px] text-warning"
                  role="alert"
                >
                  Не удалось отобразить изображение. Откройте его в новой вкладке.
                </p>
              ) : (
                <>
                  {isLoading && (
                    <div
                      className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-sunken/80 text-[12px] text-muted-foreground"
                      role="status"
                      aria-live="polite"
                      data-testid="preview-loading"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      <span>Загружаем изображение…</span>
                    </div>
                  )}
                  <img
                    src={preview.downloadUrl}
                    alt={`Клинический снимок ${KIND_LABEL[preview.asset.kind]}`}
                    className="block max-h-[60vh] w-full object-contain"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                  />
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-9 gap-1.5 text-[12px]"
                onClick={onOpenInNewTab}
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Открыть в новой вкладке
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-[12px]"
                onClick={onClose}
              >
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


function scrubLeaks(s: string): string {
  return s
    .replace(/storageObjectPath/gi, "")
    .replace(/storage_object_path/gi, "")
    .replace(/\bexif\w*/gi, "")
    .replace(/\bclinic\/[^\s"'<>]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function assetsErrorMessage(err: AssetsApiError, ctx: ErrorContext): string {
  if (err.kind === "validation") {
    const msg = scrubLeaks(err.message || "");
    if (msg) return msg;
  }
  if (ctx === "list") {
    if (err.kind === "network") return "Сбой сети при загрузке ассетов.";
    if (err.kind === "http") {
      if (err.status === 401 || err.status === 403) return "Недостаточно прав для просмотра ассетов.";
      if (err.status === 404) return "Визит или ассеты не найдены.";
      return "Не удалось загрузить ассеты.";
    }
    return "Не удалось загрузить ассеты.";
  }
  if (ctx === "download") {
    if (err.kind === "network") return "Сбой сети при подготовке ссылки.";
    if (err.kind === "http") {
      if (err.status === 401 || err.status === 403) return "Недостаточно прав для открытия снимка.";
      if (err.status === 404) return "Снимок не найден.";
      return "Не удалось подготовить ссылку.";
    }
    return "Не удалось подготовить ссылку.";
  }
  // upload
  if (err.kind === "network") return "Сбой сети при загрузке снимка.";
  if (err.kind === "http") {
    if (err.status === 401 || err.status === 403) return "Недостаточно прав для загрузки снимка.";
    if (err.status === 422) return "Проверьте файл и параметры снимка.";
    return "Не удалось загрузить снимок.";
  }
  return "Не удалось загрузить снимок.";
}

// ───────── Subcomponents ─────────

function CaptureBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="secondary" className="h-10 gap-1.5 text-[13px] sm:h-8 sm:text-[12px]" onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}

function SummaryStrip({ summary }: { summary: { total: number; dermoscopy: number; lowQuality: number; unlinked: number } }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[12px]">
      <SummaryItem label="Всего" value={summary.total} />
      <SummaryItem label="Дерматоскопия" value={summary.dermoscopy} />
      <SummaryItem label="Требуют проверки" value={summary.lowQuality} tone={summary.lowQuality > 0 ? "warning" : "muted"} />
      <SummaryItem label="Без привязки" value={summary.unlinked} />
    </div>
  );
}

function SummaryItem({ label, value, tone = "muted" }: { label: string; value: number; tone?: "muted" | "warning" }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${tone === "warning" ? "text-warning" : "text-foreground"}`}>{value}</span>
    </span>
  );
}

interface Option {
  value: string;
  label: string;
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-md border border-border bg-surface px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring sm:h-8 sm:text-[12px]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompareSelect({
  selectedId,
  compareId,
  onChange,
  images,
  lesionMap,
}: {
  selectedId: string;
  compareId: string | null;
  onChange: (id: string | null) => void;
  images: ClinicalImage[];
  lesionMap: Map<string, Lesion>;
}) {
  const candidates = images.filter((i) => i.id !== selectedId);
  return (
    <label className="flex items-center gap-1.5 text-[12px]">
      <span className="text-muted-foreground">Сравнить с</span>
      <select
        value={compareId ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-7 rounded-md border border-border bg-surface px-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">— нет —</option>
        {candidates.map((img) => {
          const lesion = img.lesionId ? lesionMap.get(img.lesionId) ?? null : null;
          return (
            <option key={img.id} value={img.id}>
              {KIND_LABEL[img.kind]} · {lesion ? lesion.label : "без привязки"} · {formatDateTime(img.capturedAt)}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function PreviewPane({ image, zoom, title }: { image: ClinicalImage; zoom: number; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{title}</span>
        <span className="truncate">{KIND_LABEL[image.kind]} · {formatDateTime(image.capturedAt)}</span>
      </div>
      <div className="relative h-64 overflow-auto rounded-md border border-border bg-surface-sunken">
        <div
          className="mx-auto"
          style={{ width: `${100 * zoom}%`, minWidth: `${100 * zoom}%` }}
        >
          <ThumbPlaceholder image={image} large />
        </div>
      </div>
    </div>
  );
}

function ThumbPlaceholder({ image, large = false }: { image: ClinicalImage; large?: boolean }) {
  // Детерминированный нейтральный тайл по id/kind. Не загружаем внешние медицинские фото.
  const seed = hashString(image.id);
  const hue = 200 + (seed % 30); // холодный клинический диапазон
  const sat = image.kind === "dermoscopy" ? 18 : 12;
  const light1 = 88 - (seed % 6);
  const light2 = light1 - 8;
  const angle = (seed % 90) - 45;

  return (
    <div
      className={`relative w-full ${large ? "aspect-[4/3]" : "aspect-[4/3]"} overflow-hidden`}
      style={{
        backgroundImage: `linear-gradient(${angle}deg, hsl(${hue} ${sat}% ${light1}%), hsl(${hue} ${sat}% ${light2}%))`,
      }}
      aria-label={`Плейсхолдер снимка ${KIND_LABEL[image.kind]}`}
    >
      {/* Patch 3: классификационные чипы — outline neutral, без uppercase. */}
      <div className="absolute inset-0 flex items-end justify-between p-2 text-[11px] font-medium text-foreground/75">
        <span className="rounded-sm border border-border bg-surface/85 px-1.5 py-0.5">{KIND_LABEL[image.kind]}</span>
        <span className="rounded-sm border border-border bg-surface/85 px-1.5 py-0.5">{SOURCE_LABEL[image.source]}</span>
      </div>
      {/* Условная «рамка снимка» */}
      <div className="pointer-events-none absolute inset-2 rounded-sm border border-foreground/10" />
    </div>
  );
}

function QualityChip({ image, compact = false }: { image: ClinicalImage; compact?: boolean }) {
  const review = needsReview(image);
  const text = review ? "Требует проверки" : "Хорошее качество";
  // Patch 3: статусные чипы — solid с риск-цветом, без uppercase, чуть крупнее.
  const cls = review
    ? "bg-warning text-warning-foreground"
    : "bg-success text-success-foreground";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${cls}`}
      title={`Оценка качества: ${(image.quality.score * 100).toFixed(0)}%`}
    >
      {compact ? `${Math.round(image.quality.score * 100)}%` : text}
    </span>
  );
}

function QualityPanel({ image }: { image: ClinicalImage }) {
  const score = image.quality.score;
  const issues = image.quality.issues;
  const action = recommendedAction(image);
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold">Контроль качества</span>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {(score * 100).toFixed(0)}% · порог {Math.round(QUALITY_THRESHOLD * 100)}%
        </span>
      </div>
      {issues.length > 0 ? (
        <ul className="mt-1 flex flex-wrap gap-1">
          {issues.map((iss) => (
            <li key={iss} className="rounded-sm border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] text-warning">
              {iss}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-[12px] text-muted-foreground">Замечаний не выявлено.</div>
      )}
      <div className="mt-1.5 text-[12px]">
        <span className="text-muted-foreground">Рекомендация: </span>
        <span>{action}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Только контроль качества. Это не клинический диагноз.
      </p>
    </div>
  );
}

function ImageMeta({ image, lesionMap }: { image: ClinicalImage; lesionMap: Map<string, Lesion> }) {
  const lesion = image.lesionId ? lesionMap.get(image.lesionId) ?? null : null;
  const e = image.exifMeta;
  const rows: Array<[string, React.ReactNode]> = [
    ["Тип", KIND_LABEL[image.kind]],
    ["Источник", SOURCE_LABEL[image.source]],
    ["Образование", lesion ? `${lesion.label} · ${lesion.bodyZone}` : "Body map / без привязки"],
    ["Снято", formatDateTime(image.capturedAt)],
    ["Устройство", image.deviceId ?? "—"],
    ["Размер", `${e.width} × ${e.height}`],
    ["ISO", e.iso ?? "—"],
    ["Выдержка", e.shutter ?? "—"],
    ["Диафрагма", e.aperture ?? "—"],
    ["Фокус", e.focalLength ?? "—"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
      {rows.map(([term, value]) => (
        <div key={term} className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/60 pb-1 last:border-b-0 last:pb-0">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="min-w-0 truncate text-right">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ───────── Helpers ─────────

function needsReview(image: ClinicalImage): boolean {
  return image.quality.score < QUALITY_THRESHOLD || image.quality.issues.length > 0;
}

function recommendedAction(image: ClinicalImage): string {
  const issues = image.quality.issues.join(" ").toLowerCase();
  if (image.quality.score < 0.7 || issues.includes("размыт")) {
    return "Повторить снимок: сфокусироваться, при дерматоскопии — обеспечить контакт.";
  }
  if (issues.includes("блик")) {
    return "Снизить блики: использовать поляризацию или изменить угол.";
  }
  if (issues.includes("освещ") || issues.includes("тени")) {
    return "Улучшить освещение: добавить рассеянный свет, убрать тени.";
  }
  if (image.quality.score < QUALITY_THRESHOLD) {
    return "Желательно повторить снимок для уверенного просмотра.";
  }
  return "Можно использовать для просмотра.";
}

function clampZoom(z: number): number {
  return Math.max(0.6, Math.min(2, +z.toFixed(2)));
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Avoid unused-import warning: Camera reserved for future native camera path.
void Camera;

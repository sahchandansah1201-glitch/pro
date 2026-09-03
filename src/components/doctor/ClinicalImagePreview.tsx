import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import type { ClinicalImage } from "@/lib/domain";
import { getSelfHostedAssetDownloadUrl } from "@/lib/self-hosted-asset-api";

type ResolveDownloadUrl = (assetId: string) => ReturnType<typeof getSelfHostedAssetDownloadUrl>;

interface PlaceholderProps {
  image: ClinicalImage;
  kindLabel: string;
  sourceLabel: string;
}

export function ClinicalImagePlaceholder({ image, kindLabel, sourceLabel }: PlaceholderProps) {
  const seed = hashString(image.id);
  const hue = 200 + (seed % 30);
  const saturation = image.kind === "dermoscopy" ? 18 : 12;
  const firstLightness = 88 - (seed % 6);
  const secondLightness = firstLightness - 8;
  const angle = (seed % 90) - 45;

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(${angle}deg, hsl(${hue} ${saturation}% ${firstLightness}%), hsl(${hue} ${saturation}% ${secondLightness}%))`,
      }}
      aria-label={`Плейсхолдер снимка ${kindLabel}`}
    >
      <div className="absolute inset-0 flex items-end justify-between p-2 text-[11px] font-medium text-foreground/75">
        <span className="rounded-sm border border-border bg-surface/85 px-1.5 py-0.5">{kindLabel}</span>
        <span className="rounded-sm border border-border bg-surface/85 px-1.5 py-0.5">{sourceLabel}</span>
      </div>
      <div className="pointer-events-none absolute inset-2 rounded-sm border border-foreground/10" />
    </div>
  );
}

interface PreviewProps extends PlaceholderProps {
  zoom: number;
  title: string;
  capturedAtLabel: string;
  resolveDownloadUrl?: ResolveDownloadUrl;
}

export function ClinicalImagePreview({
  image,
  zoom,
  title,
  kindLabel,
  sourceLabel,
  capturedAtLabel,
  resolveDownloadUrl,
}: PreviewProps) {
  return (
    <div
      className="flex flex-col gap-1"
      data-testid={title === "Основной" ? "selected-image-preview" : undefined}
      data-image-id={image.id}
    >
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">{title}</span>
        <span className="truncate">{kindLabel} · {capturedAtLabel}</span>
      </div>
      <div className="relative h-64 overflow-auto rounded-md border border-border bg-surface-sunken">
        {resolveDownloadUrl ? (
          <ProtectedClinicalImage
            key={image.id}
            image={image}
            zoom={zoom}
            kindLabel={kindLabel}
            resolveDownloadUrl={resolveDownloadUrl}
          />
        ) : (
          <div className="mx-auto" style={{ width: `${100 * zoom}%`, minWidth: `${100 * zoom}%` }}>
            <ClinicalImagePlaceholder image={image} kindLabel={kindLabel} sourceLabel={sourceLabel} />
          </div>
        )}
      </div>
    </div>
  );
}

function ProtectedClinicalImage({
  image,
  zoom,
  kindLabel,
  resolveDownloadUrl,
}: {
  image: ClinicalImage;
  zoom: number;
  kindLabel: string;
  resolveDownloadUrl: ResolveDownloadUrl;
}) {
  const [resolved, setResolved] = useState<{ assetId: string; url: string } | null>(null);
  const [loadErrorAssetId, setLoadErrorAssetId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let disposableUrl: string | null = null;
    setResolved(null);
    setLoadErrorAssetId(null);
    resolveDownloadUrl(image.id).then((result) => {
      const resultUrl = result.ok ? result.value?.downloadUrl ?? null : null;
      if (cancelled) {
        revokeBlobUrl(resultUrl);
        return;
      }
      if (!resultUrl) {
        setLoadErrorAssetId(image.id);
        return;
      }
      disposableUrl = resultUrl;
      setResolved({ assetId: image.id, url: resultUrl });
    });
    return () => {
      cancelled = true;
      revokeBlobUrl(disposableUrl);
    };
  }, [image.id, resolveDownloadUrl]);

  if (loadErrorAssetId === image.id) {
    return (
      <div role="alert" className="flex h-full items-center justify-center px-4 text-center text-[13px] text-warning">
        Не удалось загрузить снимок. Обновите список и повторите попытку.
      </div>
    );
  }
  if (!resolved || resolved.assetId !== image.id) {
    return (
      <div role="status" className="flex h-full items-center justify-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Загружаем защищённый снимок…
      </div>
    );
  }
  return (
    <img
      src={resolved.url}
      alt={`Клинический снимок ${kindLabel}`}
      className="mx-auto block max-w-none object-contain"
      style={{ width: `${100 * zoom}%`, minWidth: `${100 * zoom}%` }}
    />
  );
}

function revokeBlobUrl(url: string | null) {
  if (url?.startsWith("blob:") && typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(url);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

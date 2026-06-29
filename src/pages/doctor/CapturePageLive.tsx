import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, RefreshCcw, Upload } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SafeAssetDTO } from "@/lib/clinical-assets-api";
import { formatDateTime } from "@/lib/format";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import { uploadSelfHostedVisitAsset } from "@/lib/self-hosted-asset-api";
import {
  getSelfHostedVisit,
  listSelfHostedVisitAssets,
  listSelfHostedVisitLesions,
  listSelfHostedVisits,
  type SelfHostedApiError,
  type SelfHostedVisitAssetDTO,
  type SelfHostedVisitDetailDTO,
  type SelfHostedVisitLesionDTO,
  type SelfHostedVisitScheduleItemDTO,
} from "@/lib/self-hosted-visit-api";

type LoadState = "idle" | "loading" | "ready" | "error";
type UploadState = "idle" | "saving";

const KIND_OPTIONS: Array<{ value: SafeAssetDTO["kind"]; label: string }> = [
  { value: "dermoscopy", label: "Дерматоскопия" },
  { value: "overview", label: "Обзорное фото" },
  { value: "macro", label: "Макро" },
];

const STATUS_LABEL: Record<string, string> = {
  draft: "Запланирован",
  in_progress: "В работе",
  signed: "Подписан",
  cancelled: "Отменён",
};

function errorText(error: SelfHostedApiError | null): string {
  if (!error) return "Не удалось загрузить рабочую очередь.";
  if (error.kind === "not_configured") return "Войдите в систему клиники, чтобы открыть съёмку.";
  if (error.kind === "network") return "Система клиники временно недоступна. Повторите попытку.";
  if (error.status === 401) return "Рабочий вход истёк. Войдите снова.";
  if (error.status === 403) return "Недостаточно прав для съёмки в этой клинике.";
  return error.message || "Не удалось загрузить рабочую очередь.";
}

function assetKindLabel(kind: string): string {
  if (kind === "dermoscopy") return "Дерматоскопия";
  if (kind === "report_attachment") return "Вложение";
  return "Обзорное фото";
}

function visitTitle(visit: SelfHostedVisitScheduleItemDTO): string {
  const patient = visit.patient.fullName || "Пациент";
  const time = visit.startedAt ? formatDateTime(visit.startedAt) : "время не указано";
  return `${patient} · ${time}`;
}

function bytesLabel(value: number | null): string {
  if (!value) return "размер не указан";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

function bodyMapHref(visit: SelfHostedVisitDetailDTO | null, lesionId: string) {
  if (!visit?.patient.id) return "/patients";
  const query = lesionId ? `?tab=bodymap&lesion=${encodeURIComponent(lesionId)}` : "?tab=bodymap";
  return `/patients/${visit.patient.id}/visits/${visit.id}${query}`;
}

export default function CapturePageLive() {
  const session = useSelfHostedApiSession();
  const configured = isSelfHostedApiConfigured(session);

  const [visits, setVisits] = useState<SelfHostedVisitScheduleItemDTO[]>([]);
  const [selectedVisitId, setSelectedVisitId] = useState("");
  const [visit, setVisit] = useState<SelfHostedVisitDetailDTO | null>(null);
  const [lesions, setLesions] = useState<SelfHostedVisitLesionDTO[]>([]);
  const [assets, setAssets] = useState<SelfHostedVisitAssetDTO[]>([]);
  const [selectedLesionId, setSelectedLesionId] = useState("");
  const [kind, setKind] = useState<SafeAssetDTO["kind"]>("dermoscopy");
  const [file, setFile] = useState<File | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [error, setError] = useState<SelfHostedApiError | null>(null);
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadVisits() {
      if (!configured) {
        setLoadState("error");
        setError({
          kind: "not_configured",
          code: "not_configured",
          message: "Войдите в систему клиники, чтобы открыть съёмку.",
        });
        return;
      }
      setLoadState("loading");
      const result = await listSelfHostedVisits({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        status: "all",
        limit: 25,
      });
      if (cancelled) return;
      if (!result.ok || !result.value) {
        setLoadState("error");
        setError(result.error);
        return;
      }
      setVisits(result.value.items);
      setError(null);
      setLoadState("ready");
    }
    void loadVisits();
    return () => {
      cancelled = true;
    };
  }, [configured, reloadKey, session.apiBaseUrl, session.apiToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadVisitContext() {
      if (!configured || !selectedVisitId) {
        setVisit(null);
        setLesions([]);
        setAssets([]);
        return;
      }
      const [visitResult, lesionResult, assetResult] = await Promise.all([
        getSelfHostedVisit({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          visitId: selectedVisitId,
        }),
        listSelfHostedVisitLesions({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          visitId: selectedVisitId,
        }),
        listSelfHostedVisitAssets({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          visitId: selectedVisitId,
        }),
      ]);
      if (cancelled) return;
      if (!visitResult.ok || !visitResult.value) {
        setLoadState("error");
        setError(visitResult.error);
        return;
      }
      setVisit(visitResult.value);
      const nextLesions = lesionResult.ok && lesionResult.value ? lesionResult.value : [];
      setLesions(nextLesions);
      setAssets(assetResult.ok && assetResult.value ? assetResult.value : []);
    }
    void loadVisitContext();
    return () => {
      cancelled = true;
    };
  }, [configured, reloadKey, selectedVisitId, session.apiBaseUrl, session.apiToken]);

  useEffect(() => {
    setSelectedVisitId((current) => {
      if (visits.length === 0) return "";
      return visits.some((item) => item.id === current) ? current : visits[0].id;
    });
  }, [visits]);

  useEffect(() => {
    setSelectedLesionId((current) => {
      if (lesions.length === 0) return "";
      return lesions.some((item) => item.id === current) ? current : lesions[0].id;
    });
  }, [lesions]);

  const selectedVisit = useMemo(
    () => visits.find((item) => item.id === selectedVisitId) ?? null,
    [selectedVisitId, visits],
  );
  const selectedLesion = lesions.find((item) => item.id === selectedLesionId) ?? null;
  const activeCount = visits.filter((item) => item.status === "draft" || item.status === "in_progress").length;
  const latestAsset = assets[0] ?? null;

  async function refresh() {
    setMessage("");
    setReloadKey((value) => value + 1);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!selectedVisitId) {
      setMessage("Выберите визит для сохранения снимка.");
      return;
    }
    if (!file) {
      setMessage("Выберите файл снимка.");
      return;
    }
    setUploadState("saving");
    const result = await uploadSelfHostedVisitAsset({
      baseUrl: session.apiBaseUrl,
      token: session.apiToken,
      visitId: selectedVisitId,
      file,
      kind,
      source: "file",
      lesionId: selectedLesionId || null,
    });
    setUploadState("idle");
    if (!result.ok || !result.value) {
      setMessage(result.error?.message || "Не удалось сохранить снимок.");
      return;
    }
    setFile(null);
    setMessage("Снимок сохранён в системе клиники.");
    const assetResult = await listSelfHostedVisitAssets({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      visitId: selectedVisitId,
    });
    if (assetResult.ok && assetResult.value) setAssets(assetResult.value);
  }

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Съёмка"
        subtitle={`${session.user?.displayName ?? "Ассистент"} · рабочая очередь снимков`}
        actions={
          <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={refresh}>
            <RefreshCcw className="h-4 w-4" aria-hidden />
            Обновить
          </Button>
        }
      />

      <main className="space-y-4 p-4" aria-label="Рабочая область съёмки">
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-muted-foreground">
          Источник данных: система клиники. Контроль качества — техническая проверка снимка, не диагноз.
        </div>

        {loadState === "error" && (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
            {errorText(error)}
          </div>
        )}

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-4" aria-label="Сводка съёмки">
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-[12px] font-semibold uppercase text-muted-foreground">Визиты</p>
            <p className="mt-2 text-[24px] font-semibold text-foreground">{visits.length}</p>
            <p className="text-[12px] text-muted-foreground">доступны для роли</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-[12px] font-semibold uppercase text-muted-foreground">Активные</p>
            <p className="mt-2 text-[24px] font-semibold text-foreground">{activeCount}</p>
            <p className="text-[12px] text-muted-foreground">запланированы или в работе</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-[12px] font-semibold uppercase text-muted-foreground">Очаги</p>
            <p className="mt-2 text-[24px] font-semibold text-foreground">{lesions.length}</p>
            <p className="text-[12px] text-muted-foreground">в выбранном визите</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-[12px] font-semibold uppercase text-muted-foreground">Снимки</p>
            <p className="mt-2 text-[24px] font-semibold text-foreground">{assets.length}</p>
            <p className="text-[12px] text-muted-foreground">сохранены по визиту</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]" aria-label="Загрузка снимка">
          <form onSubmit={handleSubmit} className="rounded-md border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Camera className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold text-foreground">Добавить снимок к визиту</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Выберите визит, очаг и файл. Снимок сохранится в рабочей базе клиники.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              <label className="space-y-1 text-[13px] font-medium text-foreground">
                <span>Визит</span>
                <Select value={selectedVisitId} onValueChange={setSelectedVisitId}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="Выберите визит" />
                  </SelectTrigger>
                  <SelectContent>
                    {visits.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {visitTitle(item)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1 text-[13px] font-medium text-foreground">
                <span>Очаг</span>
                <Select value={selectedLesionId || "none"} onValueChange={(value) => setSelectedLesionId(value === "none" ? "" : value)}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue placeholder="Без привязки" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Без привязки</SelectItem>
                    {lesions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}{item.bodyZone ? ` · ${item.bodyZone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1 text-[13px] font-medium text-foreground">
                <span>Тип снимка</span>
                <Select value={kind} onValueChange={(value) => setKind(value as SafeAssetDTO["kind"])}>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="space-y-1 text-[13px] font-medium text-foreground">
                <span>Файл снимка</span>
                <Input
                  aria-label="Файл снимка"
                  className="min-h-11"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" className="min-h-11 gap-2" disabled={uploadState === "saving" || loadState === "loading"}>
                <Upload className="h-4 w-4" aria-hidden />
                {uploadState === "saving" ? "Сохраняем" : "Сохранить снимок"}
              </Button>
              {selectedLesionId && visit && (
                <Button asChild type="button" variant="outline" className="min-h-11">
                  <Link to={bodyMapHref(visit, selectedLesionId)}>Открыть карту тела</Link>
                </Button>
              )}
            </div>

            {message && (
              <div role="status" className="mt-4 rounded-md border border-border bg-surface-muted px-3 py-2 text-[13px] text-foreground">
                {message}
              </div>
            )}
          </form>

          <aside className="rounded-md border border-border bg-surface p-4 shadow-sm" aria-label="Контекст визита">
            <h2 className="text-[16px] font-semibold text-foreground">Выбранный визит</h2>
            {selectedVisit ? (
              <div className="mt-3 space-y-3 text-[13px]">
                <p>
                  <span className="text-muted-foreground">Пациент: </span>
                  <span className="font-medium text-foreground">{selectedVisit.patient.fullName ?? "Пациент"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Клиника: </span>
                  <span className="font-medium text-foreground">{selectedVisit.clinic.name ?? "Клиника"}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Статус: </span>
                  <span className="font-medium text-foreground">{STATUS_LABEL[selectedVisit.status] ?? selectedVisit.status}</span>
                </p>
                {selectedLesion && (
                  <p>
                    <span className="text-muted-foreground">Очаг: </span>
                    <span className="font-medium text-foreground">{selectedLesion.label}{selectedLesion.bodyZone ? ` · ${selectedLesion.bodyZone}` : ""}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Нет визитов для съёмки. Создайте визит у врача или администратора клиники.
              </p>
            )}
          </aside>
        </section>

        <section className="rounded-md border border-border bg-surface shadow-sm" aria-label="Сохранённые снимки">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-[16px] font-semibold text-foreground">Очередь снимков</h2>
              <p className="text-[13px] text-muted-foreground">В очереди снимков: {assets.length}</p>
            </div>
            {latestAsset && (
              <p className="text-[12px] text-muted-foreground">
                Последний снимок: {latestAsset.createdAt ? formatDateTime(latestAsset.createdAt) : "время не указано"}
              </p>
            )}
          </div>

          {loadState === "loading" ? (
            <div className="px-4 py-6 text-[13px] text-muted-foreground">Загружаем рабочую очередь.</div>
          ) : assets.length === 0 ? (
            <div className="px-4 py-6 text-[13px] text-muted-foreground">
              По выбранному визиту ещё нет сохранённых снимков.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {assets.map((asset) => (
                <article key={asset.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-[13px] md:grid-cols-[1fr_1fr_140px] md:items-center">
                  <div className="font-medium text-foreground">{assetKindLabel(asset.kind)}</div>
                  <div className="text-muted-foreground">
                    {asset.capturedAt ? formatDateTime(asset.capturedAt) : "время съёмки не указано"}
                  </div>
                  <div className="text-muted-foreground md:text-right">{bytesLabel(asset.byteSize)}</div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

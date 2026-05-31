import { Link, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Images, Loader2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  fetchSelfHostedPatientPortalPhotoProtocol,
  fetchSelfHostedPatientPortalPhotoProtocolPhoto,
  fetchSelfHostedPatientPortalReport,
  type SelfHostedPatientPortalPhotoProtocol,
  type SelfHostedPatientPortalPhotoProtocolPhoto,
  type SelfHostedPatientPortalReport,
} from "@/lib/self-hosted-patient-portal-api";

type PhotoDownloadState = {
  status: "idle" | "loading" | "ready" | "error";
  objectUrl?: string;
  fileName?: string;
  message?: string;
};

const PHOTO_KIND_LABEL: Record<string, string> = {
  overview_photo: "обзорное фото",
  dermoscopy: "дерматоскопия",
  report_attachment: "вложение отчёта",
};

function photoKindLabel(kind: string): string {
  return PHOTO_KIND_LABEL[kind] || "фото";
}

function isPhotoProtocolRevoked(photoProtocol: SelfHostedPatientPortalPhotoProtocol): boolean {
  return photoProtocol.status === "revoked" || Boolean(photoProtocol.revokedAt);
}

function photoProtocolStatusText(photoProtocol: SelfHostedPatientPortalPhotoProtocol): string {
  return isPhotoProtocolRevoked(photoProtocol)
    ? "Фото-протокол отозван"
    : "метаданные готовы, файлы закрыты backend-контуром";
}

function photoProtocolAuditStateText(photoProtocol: SelfHostedPatientPortalPhotoProtocol): string {
  return isPhotoProtocolRevoked(photoProtocol) ? "отозван клиникой" : "активен до срока доступа";
}

export default function MeReportPageLive() {
  const { id = "" } = useParams();
  const session = useSelfHostedApiSession();
  const [status, setStatus] = useState<"missing_session" | "loading" | "ready" | "error">("loading");
  const [photoStatus, setPhotoStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [report, setReport] = useState<SelfHostedPatientPortalReport | null>(null);
  const [photoProtocol, setPhotoProtocol] = useState<SelfHostedPatientPortalPhotoProtocol | null>(null);
  const [photoDownloads, setPhotoDownloads] = useState<Record<number, PhotoDownloadState>>({});
  const [error, setError] = useState<string | null>(null);
  const photoObjectUrls = useRef<Record<number, string>>({});

  useEffect(() => () => {
    for (const objectUrl of Object.values(photoObjectUrls.current)) {
      URL.revokeObjectURL(objectUrl);
    }
    photoObjectUrls.current = {};
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session.apiToken) {
        setStatus("missing_session");
        setPhotoStatus("idle");
        return;
      }
      setStatus("loading");
      setPhotoStatus("idle");
      setPhotoProtocol(null);
      setPhotoDownloads({});
      const result = await fetchSelfHostedPatientPortalReport({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        reportId: id,
      });
      if (cancelled) return;
      if (result.ok) {
        setReport(result.value);
        setError(null);
        setStatus("ready");
        if (result.value.visitId) {
          setPhotoStatus("loading");
          const photoResult = await fetchSelfHostedPatientPortalPhotoProtocol({
            apiBaseUrl: session.apiBaseUrl,
            apiToken: session.apiToken,
            visitId: result.value.visitId,
          });
          if (cancelled) return;
          if (photoResult.ok) {
            setPhotoProtocol(photoResult.value);
            setPhotoDownloads({});
            setPhotoStatus("ready");
          } else {
            setPhotoProtocol(null);
            setPhotoDownloads({});
            setPhotoStatus("unavailable");
          }
        }
      } else {
        setReport(null);
        setPhotoProtocol(null);
        setPhotoDownloads({});
        setPhotoStatus("idle");
        setError(result.error.message);
        setStatus("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, session.apiBaseUrl, session.apiToken]);

  async function preparePhoto(photo: SelfHostedPatientPortalPhotoProtocolPhoto) {
    if (photoProtocol && isPhotoProtocolRevoked(photoProtocol)) {
      setPhotoDownloads((current) => ({
        ...current,
        [photo.sequence]: {
          status: "error",
          message: "Открытие фото заблокировано после отзыва доступа клиникой.",
        },
      }));
      return;
    }
    const visitId = photoProtocol?.visitId || report?.visitId;
    if (!visitId) {
      setPhotoDownloads((current) => ({
        ...current,
        [photo.sequence]: {
          status: "error",
          message: "Фото сейчас недоступно: backend не вернул визит.",
        },
      }));
      return;
    }
    setPhotoDownloads((current) => ({
      ...current,
      [photo.sequence]: { status: "loading" },
    }));
    const result = await fetchSelfHostedPatientPortalPhotoProtocolPhoto({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      visitId,
      sequence: photo.sequence,
    });
    if (!result.ok) {
      setPhotoDownloads((current) => ({
        ...current,
        [photo.sequence]: {
          status: "error",
          message: result.error.message || "Фото сейчас недоступно: доступ управляется клиникой.",
        },
      }));
      return;
    }
    if (photoObjectUrls.current[photo.sequence]) {
      URL.revokeObjectURL(photoObjectUrls.current[photo.sequence]);
    }
    const objectUrl = URL.createObjectURL(result.value.blob);
    photoObjectUrls.current[photo.sequence] = objectUrl;
    setPhotoDownloads((current) => ({
      ...current,
      [photo.sequence]: {
        status: "ready",
        objectUrl,
        fileName: result.value.fileName,
        message: `Фото ${photo.sequence} подготовлено через защищённый backend.`,
      },
    }));
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Заключение" subtitle="Production · patient-safe report" />
      <div className="space-y-3 p-3 sm:p-4">
        {status === "missing_session" && (
          <Card className="p-4">
            <div className="text-[13px] text-muted-foreground">Войдите в production, чтобы открыть заключение.</div>
            <Button asChild className="mt-3 min-h-[44px] sm:min-h-[36px]">
              <Link to="/self-hosted/login">Войти</Link>
            </Button>
          </Card>
        )}
        {status === "loading" && <Card className="p-4 text-[13px] text-muted-foreground">Загружаем заключение…</Card>}
        {status === "error" && <Card className="p-4 text-[13px] text-destructive" role="alert">{error || "Отчёт не найден."}</Card>}
        {status === "ready" && report && (
          <Card className="p-4">
            <div className="text-[12px] text-muted-foreground">{formatDate(report.visitDate)} · {report.clinic.name || "Клиника"}</div>
            <h2 className="mt-2 text-[18px] font-semibold">Заключение для пациента</h2>
            <p className="mt-3 whitespace-pre-line text-[14px] leading-6">{report.patientSafeText || "Текст заключения пока не опубликован."}</p>
            <section
              aria-label="Безопасность доступа"
              className="mt-4 rounded-md border border-border bg-surface-muted p-3"
            >
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold">Безопасность доступа</h3>
                  <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
                    <dt className="text-muted-foreground">Доступ</dt>
                    <dd>self-hosted кабинет пациента</dd>
                    <dt className="text-muted-foreground">Срок доступа</dt>
                    <dd>{report.accessExpiresAt ? formatDateTime(report.accessExpiresAt) : "управляется backend"}</dd>
                    <dt className="text-muted-foreground">Состав</dt>
                    <dd>безопасный текст, дата визита, клиника</dd>
                    <dt className="text-muted-foreground">Исключено</dt>
                    <dd>внутренняя версия врача, сырые токены, AI/XAI-детали</dd>
                  </dl>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Токен доступа скрыт. Врачебная версия скрыта. Все действия выдачи и отзыва должны фиксироваться на backend.
                  </p>
                </div>
              </div>
            </section>
            <section
              aria-label="Фото-протокол пациента"
              className="mt-3 rounded-md border border-border bg-surface-muted p-3"
            >
              <div className="flex items-start gap-2">
                <Images className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold">Фото-протокол</h3>
                  {photoStatus === "loading" && (
                    <p className="mt-2 text-[12px] text-muted-foreground">Проверяем доступность фото-протокола…</p>
                  )}
                  {photoStatus === "unavailable" && (
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      Фото-протокол пока недоступен в безопасном контуре пациента.
                    </p>
                  )}
                  {photoStatus === "ready" && photoProtocol && (
                    <>
                      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
                        <dt className="text-muted-foreground">Статус</dt>
                        <dd>{photoProtocolStatusText(photoProtocol)}</dd>
                        <dt className="text-muted-foreground">Фото</dt>
                        <dd>{photoProtocol.selectedPhotoCount}</dd>
                        <dt className="text-muted-foreground">Состав</dt>
                        <dd>
                          обзорные {photoProtocol.counts.overviewPhotos}, дерматоскопия {photoProtocol.counts.dermoscopyPhotos}
                        </dd>
                        <dt className="text-muted-foreground">Срок доступа</dt>
                        <dd>{photoProtocol.expiresAt ? formatDateTime(photoProtocol.expiresAt) : "управляется backend"}</dd>
                      </dl>
                      <section
                        aria-label="Отзыв и журнал доступа"
                        className="mt-3 rounded border border-border bg-background px-2 py-2 text-[12px]"
                      >
                        <h4 className="font-medium">Отзыв и журнал доступа</h4>
                        <dl className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
                          <dt className="text-muted-foreground">Состояние</dt>
                          <dd>{photoProtocolAuditStateText(photoProtocol)}</dd>
                          <dt className="text-muted-foreground">Подготовлен</dt>
                          <dd>{photoProtocol.preparedAt ? formatDateTime(photoProtocol.preparedAt) : "нет данных"}</dd>
                          <dt className="text-muted-foreground">Отозван</dt>
                          <dd>{photoProtocol.revokedAt ? formatDateTime(photoProtocol.revokedAt) : "нет"}</dd>
                          <dt className="text-muted-foreground">Аудит</dt>
                          <dd>события фиксируются на backend</dd>
                        </dl>
                        {photoProtocol.auditTrail.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {photoProtocol.auditTrail.map((entry) => (
                              <li key={`${entry.kind}-${entry.occurredAt || entry.label}`} className="flex flex-wrap gap-x-2 gap-y-0.5">
                                <span className="font-medium">{entry.label}</span>
                                <span className="text-muted-foreground">
                                  {entry.occurredAt ? formatDateTime(entry.occurredAt) : "время управляется backend"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <p className="mt-2 text-muted-foreground">
                          Подробный неизменяемый журнал, причины отзыва и служебные данные скрыты в backend.
                        </p>
                      </section>
                      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {photoProtocol.photos.slice(0, 4).map((photo) => (
                          <div
                            key={`${photo.sequence}-${photo.kind}`}
                            className="rounded border border-border bg-background px-2 py-1.5 text-[12px]"
                          >
                            <div className="font-medium">Фото {photo.sequence} · {photoKindLabel(photo.kind)}</div>
                            <div className="text-muted-foreground">
                              {photo.lesionLabel || "Без названия"} · {photo.bodyZone || "зона не указана"}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] sm:min-h-[32px]"
                                disabled={isPhotoProtocolRevoked(photoProtocol) || photoDownloads[photo.sequence]?.status === "loading"}
                                onClick={() => void preparePhoto(photo)}
                              >
                                {photoDownloads[photo.sequence]?.status === "loading" && (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                )}
                                Подготовить фото {photo.sequence}
                              </Button>
                              {photoDownloads[photo.sequence]?.status === "ready" && photoDownloads[photo.sequence]?.objectUrl && (
                                <Button asChild variant="secondary" size="sm" className="min-h-[44px] sm:min-h-[32px]">
                                  <a
                                    href={photoDownloads[photo.sequence]?.objectUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={photoDownloads[photo.sequence]?.fileName}
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                                    Открыть фото {photo.sequence}
                                  </a>
                                </Button>
                              )}
                            </div>
                            <div className="mt-1 text-[12px] text-muted-foreground" aria-live="polite">
                              {isPhotoProtocolRevoked(photoProtocol)
                                ? "Открытие фото заблокировано после отзыва доступа клиникой."
                                : photoDownloads[photo.sequence]?.status === "ready"
                                  ? photoDownloads[photo.sequence]?.message
                                  : "Открытие идёт через защищённый backend после проверки доступа."}
                            </div>
                            {photoDownloads[photo.sequence]?.status === "error" && (
                              <div className="mt-1 text-[12px] text-destructive" role="alert">
                                {photoDownloads[photo.sequence]?.message}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        Сырые файлы, защищённые ссылки и внутренняя версия врача не отображаются. Подготовленное фото открывается только как локальная ссылка браузера.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
            <div className="mt-4 text-[12px] text-muted-foreground">
              Врачебная версия заключения не отображается в пациентском кабинете.
            </div>
            <Button asChild variant="outline" className="mt-4 min-h-[44px] sm:min-h-[36px]">
              <Link to="/me/reports">К списку заключений</Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}

import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Images, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  fetchSelfHostedPatientPortalPhotoProtocol,
  fetchSelfHostedPatientPortalReport,
  type SelfHostedPatientPortalPhotoProtocol,
  type SelfHostedPatientPortalReport,
} from "@/lib/self-hosted-patient-portal-api";

export default function MeReportPageLive() {
  const { id = "" } = useParams();
  const session = useSelfHostedApiSession();
  const [status, setStatus] = useState<"missing_session" | "loading" | "ready" | "error">("loading");
  const [photoStatus, setPhotoStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [report, setReport] = useState<SelfHostedPatientPortalReport | null>(null);
  const [photoProtocol, setPhotoProtocol] = useState<SelfHostedPatientPortalPhotoProtocol | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            setPhotoStatus("ready");
          } else {
            setPhotoProtocol(null);
            setPhotoStatus("unavailable");
          }
        }
      } else {
        setReport(null);
        setPhotoProtocol(null);
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
                        <dd>метаданные готовы, файлы закрыты backend-контуром</dd>
                        <dt className="text-muted-foreground">Фото</dt>
                        <dd>{photoProtocol.selectedPhotoCount}</dd>
                        <dt className="text-muted-foreground">Состав</dt>
                        <dd>
                          обзорные {photoProtocol.counts.overviewPhotos}, дерматоскопия {photoProtocol.counts.dermoscopyPhotos}
                        </dd>
                        <dt className="text-muted-foreground">Срок доступа</dt>
                        <dd>{photoProtocol.expiresAt ? formatDateTime(photoProtocol.expiresAt) : "управляется backend"}</dd>
                      </dl>
                      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {photoProtocol.photos.slice(0, 4).map((photo) => (
                          <div key={`${photo.sequence}-${photo.kind}`} className="rounded border border-border bg-background px-2 py-1.5 text-[12px]">
                            <div className="font-medium">Фото {photo.sequence} · {photo.kind}</div>
                            <div className="text-muted-foreground">
                              {photo.lesionLabel || "Без названия"} · превью скрыто
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        Сырые файлы, защищённые ссылки и внутренняя версия врача не отображаются.
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

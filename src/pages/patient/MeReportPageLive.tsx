import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  fetchSelfHostedPatientPortalReport,
  type SelfHostedPatientPortalReport,
} from "@/lib/self-hosted-patient-portal-api";

export default function MeReportPageLive() {
  const { id = "" } = useParams();
  const session = useSelfHostedApiSession();
  const [status, setStatus] = useState<"missing_session" | "loading" | "ready" | "error">("loading");
  const [report, setReport] = useState<SelfHostedPatientPortalReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!session.apiToken) {
        setStatus("missing_session");
        return;
      }
      setStatus("loading");
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
      } else {
        setReport(null);
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

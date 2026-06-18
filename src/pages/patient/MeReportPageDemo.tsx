import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime } from "@/lib/format";
import { getSafeReportById } from "./patient-data";

const DEMO_BANNER =
  "Учебный режим. Это безопасная версия отчёта для пациента. Полная клиническая информация доступна врачу.";

export default function MeReportPage() {
  const { id = "" } = useParams();
  const report = getSafeReportById(id);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Заключение" subtitle={report ? `${formatDate(report.visitDate)} · ${report.clinicName}` : "Отчёт не найден"} />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{DEMO_BANNER}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="min-h-[44px] sm:min-h-[36px]">
            <Link to="/me"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> К кабинету</Link>
          </Button>
          <Button variant="outline" disabled className="min-h-[44px] sm:min-h-[36px]">
            <Printer className="h-3.5 w-3.5" aria-hidden /> Печать недоступна
          </Button>
        </div>

        {report ? (
          <Card className="p-4">
            <h2 className="text-[14px] font-semibold">Кратко для пациента</h2>
            <p className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">{report.summary}</p>
            <hr className="my-4 border-border" />
            <dl className="grid grid-cols-2 gap-y-1 text-[12px]">
              <dt className="text-muted-foreground">Дата визита</dt>
              <dd>{formatDate(report.visitDate)}</dd>
              <dt className="text-muted-foreground">Клиника</dt>
              <dd>{report.clinicName}</dd>
            </dl>

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
                    <dd>только личный кабинет</dd>
                    <dt className="text-muted-foreground">Срок доступа</dt>
                    <dd>{report.accessExpiresAt ? formatDateTime(report.accessExpiresAt) : "управляется клиникой"}</dd>
                    <dt className="text-muted-foreground">Состав</dt>
                    <dd>безопасный текст, дата визита, клиника</dd>
                    <dt className="text-muted-foreground">Исключено</dt>
                    <dd>внутренняя версия врача, служебные данные, технические детали подсказки</dd>
                  </dl>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Код доступа не показывается. Врачебная версия скрыта. Если нужен повторный осмотр или вопрос врачу, запишитесь на контроль.
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3 min-h-[44px] sm:min-h-[32px]">
                    <Link to="/me/booking">Записаться на контроль</Link>
                  </Button>
                </div>
              </div>
            </section>

            <p className="mt-4 text-[12px] text-muted-foreground">
              Этот текст не заменяет очную консультацию. Подробности и дальнейшие шаги обсудит лечащий врач.
            </p>
          </Card>
        ) : (
          <Card className="p-6 text-center text-[13px] text-muted-foreground">
            Отчёт не найден. Вернитесь в личный кабинет и выберите доступное заключение.
          </Card>
        )}
      </div>
    </div>
  );
}

import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Printer, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getSafeReportById } from "./patient-data";

const DEMO_BANNER =
  "Демо-режим. Это безопасная версия отчёта для пациента. Полная клиническая информация доступна врачу.";

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
            <Printer className="h-3.5 w-3.5" aria-hidden /> Печать / PDF (демо)
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
            <p className="mt-4 text-[12px] text-muted-foreground">
              Этот текст не заменяет очную консультацию. Подробности и план лечения обсудит лечащий врач.
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

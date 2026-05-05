import { Button } from "@/components/ui/button";
import { getReportByVisitId } from "@/lib/mock-data";
import type { Patient, Visit } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  DEMO_NOW_ISO,
  getReportInternalText,
  getReportLinkExpiry,
  getReportSafeText,
} from "@/lib/report-access";

interface Props {
  patient: Patient;
  visit: Visit;
}

export function VisitReportTab({ patient, visit }: Props) {
  const report = getReportByVisitId(visit.id);

  if (!report) {
    return (
      <div className="space-y-3">
        <section className="rounded-md border border-dashed border-border bg-surface p-6 text-center">
          <h2 className="text-[14px] font-semibold">Отчёт по этому визиту ещё не создан.</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Пациент: {patient.fullName} · визит {formatDate(visit.startedAt)}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-3 min-h-[44px] text-[13px] sm:min-h-9"
            disabled
          >
            Сформировать отчёт
          </Button>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Генерация отчёта будет подключена на этапе бэкенда. В MVP данные не записываются.
          </p>
        </section>
      </div>
    );
  }

  const safeText = getReportSafeText(report);
  const internalText = getReportInternalText(report);
  const expiresAt = getReportLinkExpiry(report);
  const expiryMs = expiresAt ? Date.parse(expiresAt) : 0;
  const nowMs = Date.parse(DEMO_NOW_ISO);
  const isActive = expiryMs >= nowMs;

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-border bg-surface p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold">Врачебный отчёт</h2>
            <p className="text-[12px] text-muted-foreground">
              Пациент: {patient.fullName} · визит {formatDate(visit.startedAt)}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-[44px] text-[13px] sm:min-h-9"
            onClick={() => window.print()}
          >
            Печать / PDF
          </Button>
        </div>
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-3">
          <Field term="Сформирован" value={formatDateTime(report.generatedAt)} />
          <Field term="ID отчёта" value={<span className="font-mono">{report.id}</span>} />
          <Field term="Статус ссылки" value={isActive ? "активна" : "истекла"} />
        </dl>
      </section>

      <section className="rounded-md border border-border bg-surface p-3">
        <h3 className="mb-1 text-[13px] font-semibold">Текст для пациента</h3>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed sm:text-[14px]">
          {safeText}
        </p>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Безопасная формулировка для пациента.
        </p>
      </section>

      <section className="rounded-md border border-border bg-surface p-3">
        <h3 className="mb-1 text-[13px] font-semibold">Версия для врача</h3>
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed sm:text-[14px]">
          {internalText}
        </p>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Внутренняя врачебная версия. Не отправляется в CRM по умолчанию.
        </p>
      </section>

      <section className="rounded-md border border-border bg-surface p-3">
        <h3 className="mb-2 text-[13px] font-semibold">Защищённая ссылка отчёта</h3>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2">
          <Field term="Просмотр" value="Защищённый просмотр: демо-ссылка скрыта" />
          {expiresAt && <Field term="Действует до" value={formatDateTime(expiresAt)} />}
          <Field term="Статус" value={isActive ? "активна" : "истекла"} />
        </dl>
        {!isActive && (
          <div className="mt-2 rounded-sm border border-dashed border-border bg-surface-muted px-2 py-1.5 text-[12px] text-muted-foreground">
            Срок действия ссылки истёк. В MVP новая ссылка не создаётся.
          </div>
        )}
      </section>

      <p className="text-[12px] text-muted-foreground">
        Этот отчёт создан после приёма врачом. Он не связан с предварительным анализом из бота.
      </p>
    </div>
  );
}

function Field({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{term}</dt>
      <dd className="text-[13px] text-foreground">{value}</dd>
    </div>
  );
}

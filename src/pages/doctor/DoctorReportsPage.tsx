import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getClinicById,
  getImagesByVisitId,
  getPatientById,
  getReports,
  getVisitById,
} from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import { DEMO_NOW_ISO, getReportLinkExpiry } from "@/lib/report-access";
import type { ClinicalImage, Patient, Report, Visit } from "@/lib/domain";

type ReportRow = {
  report: Report;
  visit: Visit;
  patient: Patient;
  clinicName: string;
  expiresAt: string;
  weakImageCount: number;
  missingConsent: boolean;
  expired: boolean;
};

const EXPIRED_LABEL = "Срок ссылки истёк";

function buildRows(): ReportRow[] {
  return getReports()
    .map((report) => {
      const visit = getVisitById(report.visitId);
      const patient = visit ? getPatientById(visit.patientId) : undefined;
      if (!visit || !patient) return null;

      const images = getImagesByVisitId(visit.id);
      const expiresAt = getReportLinkExpiry(report);

      return {
        report,
        visit,
        patient,
        clinicName: getClinicById(visit.clinicId)?.name ?? "Клиника",
        expiresAt,
        weakImageCount: images.filter(hasTechnicalQualityIssue).length,
        missingConsent: !patient.consents.telemed,
        expired: expiresAt <= DEMO_NOW_ISO,
      };
    })
    .filter((row): row is ReportRow => Boolean(row))
    .sort((a, b) => b.report.generatedAt.localeCompare(a.report.generatedAt));
}

function hasTechnicalQualityIssue(image: ClinicalImage): boolean {
  return image.quality.score < 0.8 || image.quality.issues.length > 0;
}

function blockerCount(row: ReportRow): number {
  return Number(row.weakImageCount > 0) + Number(row.missingConsent) + Number(row.expired);
}

function packetStatus(row: ReportRow): string {
  if (row.weakImageCount > 0) return "Нужно качество фото";
  if (row.missingConsent) return "Нужно согласие";
  if (row.expired) return EXPIRED_LABEL;
  return "Готов пакет";
}

function statusTone(row: ReportRow): string {
  if (row.weakImageCount > 0 || row.missingConsent) {
    return "border-warning/40 bg-warning/10 text-warning";
  }
  if (row.expired) return "border-muted-foreground/30 bg-muted text-muted-foreground";
  return "border-success/40 bg-success/10 text-success";
}

export default function DoctorReportsPage() {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => buildRows(), []);
  const filteredRows = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ru-RU");
    if (!needle) return rows;
    return rows.filter((row) =>
      [
        row.patient.fullName,
        row.patient.code,
        row.clinicName,
        packetStatus(row),
      ]
        .join(" ")
        .toLocaleLowerCase("ru-RU")
        .includes(needle),
    );
  }, [query, rows]);
  const weakRows = filteredRows.filter((row) => row.weakImageCount > 0);
  const consentRows = filteredRows.filter((row) => row.missingConsent);
  const expiredRows = filteredRows.filter((row) => row.expired);

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Центр отчётов"
        subtitle="Врачебная очередь: готовность пакета, блокеры выпуска и переход в отчёт визита."
        actions={
          <Button asChild size="sm" variant="secondary" className="min-h-[40px] text-[12px]">
            <Link to="/visits">К визитам</Link>
          </Button>
        }
      />

      <main className="space-y-5 px-4 py-5 sm:px-6">
        <section
          role="note"
          aria-label="Граница демо-центра отчётов"
          className="surface-card flex items-start gap-3 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground"
        >
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span>
            Демо-центр показывает только операционную готовность отчётов. Сырые
            токены доступа, скрытые ссылки и врачебные черновики не выводятся в
            списке.
          </span>
        </section>

        <section aria-label="Сводка отчётов" className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Всего отчётов" value={filteredRows.length} hint="в текущем фильтре" icon={FileText} />
          <SummaryTile label="Качество фото" value={weakRows.length} hint="проверить перед выпуском" icon={AlertTriangle} />
          <SummaryTile label="Согласие" value={consentRows.length} hint="нужно закрыть" icon={ShieldCheck} />
          <SummaryTile label="Срок ссылки" value={expiredRows.length} hint="требует перевыпуска" icon={Clock} />
        </section>

        <section className="surface-card overflow-hidden" aria-label="Очередь отчётов">
          <div className="section-bar flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="h-section">Очередь отчётов</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Переход открывает вкладку отчёта внутри визита.
              </p>
            </div>
            <div className="flex min-w-[220px] items-center gap-2">
              <Search className="size-4 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Поиск отчёта"
                placeholder="Пациент, код, клиника, статус"
                className="h-9 text-[13px]"
              />
            </div>
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Сводка фильтра отчётов"
              className="w-full text-[12px] text-muted-foreground"
            >
              Найдено {filteredRows.length} из {rows.length}
            </div>
          </div>

          <ul className="divide-y divide-border">
            {filteredRows.map((row) => (
              <li key={row.report.id} className="px-4 py-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_230px_190px] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="min-w-0 text-[14px] font-semibold">
                        <span className="truncate">{row.patient.fullName}</span>
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        {row.patient.code}
                      </Badge>
                      <Badge className={statusTone(row)}>{packetStatus(row)}</Badge>
                    </div>
                    <div className="mt-1 text-[12px] text-muted-foreground">
                      {formatDateTime(row.report.generatedAt)} · {row.clinicName}
                    </div>
                    <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
                      Текст для пациента доступен только внутри отчёта визита после
                      врачебной проверки.
                    </p>
                  </div>

                  <div className="rounded-md border bg-surface px-3 py-2 text-[12px]">
                    <div className="flex items-center gap-1.5 font-medium">
                      <FileText className="size-3.5" aria-hidden />
                      Пакеты пациенту
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      Демо-ссылка скрыта · до {formatDateTime(row.expiresAt)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button asChild size="sm" className="min-h-[44px] w-full sm:min-h-9">
                      <Link to={`/patients/${row.patient.id}/visits/${row.visit.id}?tab=report`}>
                        Открыть отчёт в визите
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="min-h-[44px] w-full sm:min-h-9">
                      <Link to={`/patients/${row.patient.id}`}>Карточка пациента</Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <BlockerPanel
            title="Блокеры выпуска"
            rows={filteredRows.filter((row) => blockerCount(row) > 0)}
          />
          <ReadyPanel rows={filteredRows.filter((row) => blockerCount(row) === 0)} />
        </section>
      </main>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof FileText;
}) {
  return (
    <div className="surface-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums">{value}</div>
          <div className="text-[12px] text-muted-foreground">{hint}</div>
        </div>
        <Icon className="size-4 text-primary" aria-hidden />
      </div>
    </div>
  );
}

function BlockerPanel({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <section className="surface-card overflow-hidden" aria-label={title}>
      <div className="section-bar">
        <h2 className="h-section">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-4 text-[13px] text-muted-foreground">Блокеров нет.</div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.report.id} className="px-4 py-3 text-[13px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{row.patient.fullName}</div>
                  <div className="text-[12px] text-muted-foreground">{formatDateTime(row.report.generatedAt)}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {row.weakImageCount > 0 && <Badge variant="outline">Фото · {row.weakImageCount}</Badge>}
                  {row.missingConsent && <Badge variant="outline">Согласие</Badge>}
                  {row.expired && <Badge variant="outline">{EXPIRED_LABEL}</Badge>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReadyPanel({ rows }: { rows: ReportRow[] }) {
  return (
    <section className="surface-card overflow-hidden" aria-label="Готовые отчёты">
      <div className="section-bar">
        <h2 className="h-section">Готовые отчёты</h2>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-4 text-[13px] text-muted-foreground">
          Все отчёты требуют проверки перед выпуском или перевыпуском пакета.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.report.id} className="flex items-start gap-2 px-4 py-3 text-[13px]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              <span>{row.patient.fullName} · пакет готов к выпуску врачом.</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

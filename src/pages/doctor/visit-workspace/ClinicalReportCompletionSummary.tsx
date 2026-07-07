import type { ReactNode } from "react";

import {
  clinicalReportMissingLabel,
  type SelfHostedClinicalReportPackageDTO,
  type SelfHostedPatientPhotoProtocolReleaseAuditDTO,
} from "@/lib/self-hosted-clinical-report-package-api";
import { formatDateTime } from "@/lib/format";
import { humanDisplayValue, humanFieldTerm } from "./visitWorkspaceLabels";

export function ClinicalReportCompletionSummary({
  reportPackage,
  releaseAudit,
}: {
  reportPackage: SelfHostedClinicalReportPackageDTO;
  releaseAudit: SelfHostedPatientPhotoProtocolReleaseAuditDTO | null;
}) {
  const readiness = reportPackage.readiness;
  const photoProtocol = reportPackage.patientPhotoProtocol;
  const photoProtocolStatus = photoProtocol.status === "metadata_ready_backend_blocked"
    ? "метаданные готовы, выдача заблокирована"
    : "заблокировано";
  return (
    <section aria-label="Готовность клинического отчёта" className="rounded-sm border border-border bg-surface px-3 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-semibold">Готовность отчёта</h3>
          <p className="text-[12px] text-muted-foreground">
            Пакет отчёта хранится в системе клиники. Внешняя выдача отключена.
          </p>
        </div>
        <span className="rounded-sm border border-border bg-surface-muted px-2 py-1 text-[12px] font-medium">
          {readiness.status === "ready" ? "Готов" : "Блокировано"} · {readiness.completionPercent}%
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
        <Field term="Очагов" value={reportPackage.counts.lesions} />
        <Field term="Снимков" value={reportPackage.counts.assets} />
        <Field term="Оценка" value={reportPackage.assessment.status ?? "—"} />
        <Field term="Заключение" value={reportPackage.conclusion.status ?? "—"} />
        <Field term="Отчёт" value={reportPackage.report.status ?? "—"} />
        <Field term="Текст для пациента" value={reportPackage.report.patientTextPresent ? "есть" : "нет"} />
        <Field term="Выгрузка" value={readiness.exportAllowed ? "разрешён" : "закрыт"} />
        <Field term="Выдача пациенту" value={readiness.patientDeliveryAllowed ? "разрешена" : "закрыта"} />
        <Field term="Фото-протокол" value={`${photoProtocol.selectedPhotoCount} фото`} />
        <Field term="Выдача фото" value={photoProtocol.deliveryBoundary.patientDeliveryAllowed ? "разрешена" : "закрыта"} />
      </dl>
      <div
        aria-label="Контур фото-протокола пациента"
        className="mt-3 rounded-sm border border-dashed border-border bg-surface-muted px-2.5 py-2 text-[12px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">Фото-протокол</span>
          <span>{photoProtocolStatus}</span>
        </div>
        <p className="mt-1 text-muted-foreground">
          Фото выбирает врач; сырые файлы, служебные пути, временные ссылки, токены и врачебная версия не выдаются пациенту.
        </p>
        {photoProtocol.missing.length > 0 && <MissingList items={photoProtocol.missing} />}
      </div>
      {releaseAudit && <PhotoProtocolReleaseAuditSummary audit={releaseAudit} />}
      {readiness.missing.length > 0 ? (
        <MissingList items={readiness.missing} className="mt-3 grid grid-cols-1 gap-1 text-[12px] text-muted-foreground sm:grid-cols-2" />
      ) : (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Все проверки отчёта закрыты. Внешние сервисы, служебные пути и временные ссылки не используются.
        </p>
      )}
    </section>
  );
}

function MissingList({ items, className = "mt-2 grid grid-cols-1 gap-1 text-muted-foreground sm:grid-cols-2" }: { items: string[]; className?: string }) {
  return (
    <ul className={className}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-1.5">
          <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
          <span>{clinicalReportMissingLabel(item)}</span>
        </li>
      ))}
    </ul>
  );
}

function PhotoProtocolReleaseAuditSummary({ audit }: { audit: SelfHostedPatientPhotoProtocolReleaseAuditDTO }) {
  const statusLabel = audit.status === "revoked" ? "Отозван" : audit.status === "prepared" ? "Подготовлен" : "Блокирован";
  return (
    <section role="region" aria-label="Журнал выдачи фото" className="mt-3 rounded-sm border border-border bg-surface px-2.5 py-2 text-[12px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold">Журнал выдачи фото</h4>
          <p className="text-muted-foreground">
            Неизменяемый аудит · исходные данные, причины отзыва и служебные идентификаторы скрыты.
          </p>
        </div>
        <span className="rounded-sm border border-border bg-surface-muted px-2 py-1 font-medium">
          {statusLabel} · {audit.summary.eventCount}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field term="Подготовка" value={audit.summary.preparedEvents} />
        <Field term="Политика" value={audit.summary.policyReviewEvents} />
        <Field term="Отзыв" value={audit.summary.revokedEvents} />
        <Field term="Просмотры" value={audit.summary.patientReadEvents} />
        <Field term="Открытия фото" value={audit.summary.proxyDownloadEvents} />
        <Field term="Отказы доступа" value={audit.summary.proxyDeniedEvents} />
      </dl>
      {audit.events.length > 0 ? (
        <ol className="mt-2 grid grid-cols-1 gap-1.5">
          {audit.events.slice(0, 5).map((event, index) => (
            <li key={`${event.kind}-${event.occurredAt ?? index}`} className="grid grid-cols-1 gap-1 rounded-sm border border-border/70 bg-surface-muted px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <span className="font-medium">{event.label}</span>
                <span className="ml-2 text-muted-foreground">{event.actorType === "patient" ? "пациентский контур" : "контур клиники"}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground sm:justify-end">
                <span>{event.occurredAt ? formatDateTime(event.occurredAt) : "время скрыто"}</span>
                {event.reasonPresent && <span>причина есть, текст скрыт</span>}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-muted-foreground">Событий выдачи пока нет.</p>
      )}
    </section>
  );
}

function Field({ term, value }: { term: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-2 border-b border-dashed border-border pb-1.5 last:border-b-0 last:pb-0">
      <dt className="min-w-0 max-w-[70%] break-words text-[12px] leading-snug text-muted-foreground">{humanFieldTerm(term)}</dt>
      <dd className="shrink-0 text-right">{typeof value === "string" ? humanDisplayValue(value) : value}</dd>
    </div>
  );
}

import { Link, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEMO_USERS,
} from "@/lib/users";
import {
  getAssessmentsByVisitId,
  getClinicById,
  getImagesByLesionId,
  getLesionsByPatientId,
  getPatientById,
  getReportsByPatientId,
  getVisitsByPatientId,
} from "@/lib/mock-data";
import { calcAge, formatDate, formatDateTime, sexShort } from "@/lib/format";
import type { Lesion, Visit } from "@/lib/domain";

const VISIT_STATUS: Record<Visit["status"], string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};

const LESION_STATUS: Record<Lesion["status"], string> = {
  active: "Активное",
  monitoring: "Наблюдение",
  removed: "Удалено",
  archived: "Архив",
};

function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return Object.values(DEMO_USERS).find((u) => u.id === id)?.fullName ?? id;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const patient = id ? getPatientById(id) : undefined;

  if (!patient) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Пациент не найден" subtitle="Карточка пациента отсутствует в демо-данных." />
        <div className="p-4">
          <Button asChild size="sm" variant="secondary" className="h-8 text-[12px]">
            <Link to="/patients">К списку пациентов</Link>
          </Button>
        </div>
      </div>
    );
  }

  const visits = getVisitsByPatientId(patient.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const lesions = getLesionsByPatientId(patient.id);
  const reports = getReportsByPatientId(patient.id).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const lastVisit = visits.find((v) => v.status === "closed") ?? visits[0];
  const lastReport = reports[0];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={patient.fullName}
        subtitle={`${patient.code} · ${sexShort(patient.sex)} · ${calcAge(patient.birthDate)} лет · фототип ${patient.phototype}`}
        actions={
          <Button asChild size="sm" variant="secondary" className="h-8 text-[12px]">
            <Link to="/patients">К списку</Link>
          </Button>
        }
      />

      <Tabs defaultValue="overview" className="flex-1">
        <div className="border-b border-border bg-surface px-3">
          <TabsList className="h-9 bg-transparent p-0">
            <TabsTrigger value="overview" className="text-[12px]">Обзор</TabsTrigger>
            <TabsTrigger value="visits" className="text-[12px]">Визиты ({visits.length})</TabsTrigger>
            <TabsTrigger value="lesions" className="text-[12px]">Образования ({lesions.length})</TabsTrigger>
            <TabsTrigger value="reports" className="text-[12px]">Отчёты ({reports.length})</TabsTrigger>
          </TabsList>
        </div>

        {/* Обзор */}
        <TabsContent value="overview" className="m-0 p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <Section title="Демография" className="lg:col-span-4">
              <Field term="ФИО" value={patient.fullName} />
              <Field term="Код" value={<span className="font-mono">{patient.code}</span>} />
              <Field term="Дата рождения" value={`${formatDate(patient.birthDate)} (${calcAge(patient.birthDate)} лет)`} />
              <Field term="Пол" value={patient.sex === "male" ? "Мужской" : "Женский"} />
              <Field term="Фототип" value={patient.phototype} />
            </Section>

            <Section title="Согласия" className="lg:col-span-4">
              <Field term="Обработка ПД" value={patient.consents.pdn ? "Есть" : "Нет"} />
              <Field term="Медицинская съёмка" value={patient.consents.imaging ? "Есть" : "Нет"} />
              <Field term="Телемедицина" value={patient.consents.telemed ? "Есть" : "Нет"} />
            </Section>

            <Section title="Факторы риска" className="lg:col-span-4">
              {patient.riskFactors.length === 0 ? (
                <div className="text-[12px] text-muted-foreground">Не указаны.</div>
              ) : (
                <ul className="space-y-1 text-[13px]">
                  {patient.riskFactors.map((rf) => (
                    <li key={rf} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                      <span>{rf}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Последний визит" className="lg:col-span-6">
              {!lastVisit ? (
                <div className="text-[12px] text-muted-foreground">Визитов нет.</div>
              ) : (
                <>
                  <Field term="Дата" value={formatDateTime(lastVisit.startedAt)} />
                  <Field term="Клиника" value={getClinicById(lastVisit.clinicId)?.name ?? "—"} />
                  <Field term="Врач" value={userName(lastVisit.doctorId)} />
                  <Field term="Статус" value={VISIT_STATUS[lastVisit.status]} />
                  <Field term="Жалоба" value={lastVisit.complaint} />
                </>
              )}
            </Section>

            <Section title="Сводка по образованиям и отчётам" className="lg:col-span-6">
              <Field term="Всего образований" value={lesions.length} />
              <Field term="Активных / наблюдение" value={`${lesions.filter((l) => l.status === "active").length} / ${lesions.filter((l) => l.status === "monitoring").length}`} />
              <Field term="Всего отчётов" value={reports.length} />
              {lastReport && <Field term="Последний отчёт" value={formatDateTime(lastReport.generatedAt)} />}
            </Section>
          </div>
        </TabsContent>

        {/* Визиты */}
        <TabsContent value="visits" className="m-0 p-4">
          {visits.length === 0 ? (
            <Empty text="Визитов у пациента пока нет." />
          ) : (
            <div className="overflow-hidden rounded-md border border-border bg-surface">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[140px]">Дата</th>
                      <th className="w-[110px]">Статус</th>
                      <th>Жалоба</th>
                      <th className="w-[160px]">Клиника</th>
                      <th className="w-[180px]">Врач</th>
                      <th className="w-[60px]" aria-label="Действие" />
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.id}>
                        <td className="text-[12px] text-muted-foreground">{formatDateTime(v.startedAt)}</td>
                        <td>{VISIT_STATUS[v.status]}</td>
                        <td className="max-w-[420px] truncate">{v.complaint}</td>
                        <td className="text-[12px] text-muted-foreground">{getClinicById(v.clinicId)?.name ?? "—"}</td>
                        <td className="text-[12px] text-muted-foreground">{userName(v.doctorId)}</td>
                        <td>
                          <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
                            <Link to={`/patients/${patient.id}/visits/${v.id}`} aria-label={`Открыть визит ${v.id}`}>
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Образования */}
        <TabsContent value="lesions" className="m-0 p-4">
          {lesions.length === 0 ? (
            <Empty text="Образований у пациента не зарегистрировано." />
          ) : (
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {lesions.map((l) => {
                const imageCount = getImagesByLesionId(l.id).length;
                const lastAssessment = visits
                  .flatMap((v) => getAssessmentsByVisitId(v.id).filter((a) => a.lesionId === l.id))
                  .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0];
                return (
                  <li key={l.id} className="rounded-md border border-border bg-surface p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium">{l.label}</div>
                        <div className="truncate text-[12px] text-muted-foreground">{l.bodyZone}</div>
                      </div>
                      <span className="shrink-0 rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {LESION_STATUS[l.status]}
                      </span>
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                      <Stat term="Впервые" value={formatDate(l.firstSeenAt)} />
                      <Stat term="Снимков" value={imageCount} />
                      {lastAssessment && (
                        <>
                          <Stat term="ABCD (TDS)" value={lastAssessment.abcd.total.toFixed(1)} />
                          <Stat term="7-point" value={lastAssessment.sevenPoint.total} />
                        </>
                      )}
                    </dl>
                    <div className="mt-2 flex justify-end">
                      <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
                        <Link to={`/patients/${patient.id}/lesions/${l.id}`}>
                          Открыть <ChevronRight className="ml-0.5 h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* Отчёты */}
        <TabsContent value="reports" className="m-0 p-4">
          {reports.length === 0 ? (
            <Empty text="Отчётов по пациенту пока нет." />
          ) : (
            <ul className="space-y-2">
              {reports.map((r) => (
                <li key={r.id} className="rounded-md border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div className="text-[13px] font-medium">Отчёт от {formatDateTime(r.generatedAt)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Защищённая ссылка действует до {formatDateTime(r.sharedLink.expiresAt)}
                    </div>
                  </div>
                  <div className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Текст для пациента
                  </div>
                  <p className="text-[13px]">{r.patientSafeText}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-border bg-surface ${className ?? ""}`}>
      <div className="border-b border-border bg-surface-muted px-3 py-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
      </div>
      <div className="space-y-1.5 p-3 text-[13px]">{children}</div>
    </section>
  );
}

function Field({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1.5 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-[12px] text-muted-foreground">{term}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  );
}

function Stat({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface p-10 text-center text-[13px] text-muted-foreground">
      {text}
    </div>
  );
}

import { Link } from "react-router-dom";
import { ClipboardList, Search } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLINICS, getPatientById, VISITS } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import type { Visit } from "@/lib/domain";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};

function clinicName(id: string): string {
  return CLINICS.find((clinic) => clinic.id === id)?.name ?? "Клиника";
}

function statusLabel(status: Visit["status"]): string {
  return STATUS_LABEL[status] ?? status;
}

export default function VisitsPageDemo() {
  const visits = [...VISITS].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Визиты"
        subtitle="Демо-расписание на mock-данных. Production-режим использует self-hosted backend."
        actions={
          <Button asChild size="sm">
            <Link to="/capture">Съёмка</Link>
          </Button>
        }
      />
      <div className="space-y-4 px-6 py-6">
        <section
          role="note"
          aria-label="Ограничения демо-режима визитов"
          className="surface-card flex items-start gap-3 px-4 py-3 text-row text-muted-foreground"
        >
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>Демо/dev режим показывает вымышленные визиты из mock-data. Реальные данные пациентов не вводите.</span>
        </section>

        <div className="flex max-w-xl items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value="" readOnly aria-label="Поиск визита в демо-режиме" placeholder="Поиск доступен в production" />
        </div>

        <section className="surface-card overflow-hidden">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_110px_40px] border-b border-border px-4 py-3 text-[12px] font-medium text-muted-foreground">
            <div>Пациент</div>
            <div>Дата и время</div>
            <div>Клиника</div>
            <div>Статус</div>
            <div />
          </div>
          {visits.map((visit) => {
            const patient = getPatientById(visit.patientId);
            return (
              <div
                key={visit.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_110px_40px] items-center border-b border-border px-4 py-3 text-row last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{patient?.fullName ?? "Пациент"}</div>
                  <div className="truncate text-muted-foreground">{patient?.code ?? visit.patientId}</div>
                </div>
                <div>{formatDateTime(visit.startedAt)}</div>
                <div className="truncate">{clinicName(visit.clinicId)}</div>
                <div>{statusLabel(visit.status)}</div>
                <Button asChild variant="ghost" size="icon" aria-label={`Открыть визит ${visit.id}`}>
                  <Link to={`/patients/${visit.patientId}/visits/${visit.id}`}>›</Link>
                </Button>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

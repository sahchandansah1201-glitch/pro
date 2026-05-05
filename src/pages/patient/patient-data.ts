// Patient portal — детерминированные хелперы для демо-пациента.
// SAFETY: только безопасные для пациента данные.

import {
  getAppointments,
  getAssessmentsByVisitId,
  getClinicById,
  getReportsByPatientId,
  getVisitsByPatientId,
} from "@/lib/mock-data";

/** Постоянный демо-пациент портала. */
export const DEMO_PATIENT_ID = "p-001";
export const DEMO_PATIENT_GREETING = "Наталья";

export interface SafeReportRow {
  id: string;
  visitId: string;
  visitDate: string;
  clinicName: string;
  summary: string;
}

export function getSafeReports(): SafeReportRow[] {
  const visits = getVisitsByPatientId(DEMO_PATIENT_ID);
  const reports = getReportsByPatientId(DEMO_PATIENT_ID);
  return reports.map((r) => {
    const v = visits.find((x) => x.id === r.visitId);
    return {
      id: r.id,
      visitId: r.visitId,
      visitDate: v?.startedAt ?? r.generatedAt,
      clinicName: v ? getClinicById(v.clinicId)?.name ?? "—" : "—",
      summary: r.patientSafeText,
    };
  });
}

export function getSafeReportById(id: string): SafeReportRow | undefined {
  return getSafeReports().find((r) => r.id === id);
}

export interface SafeAppointment {
  id: string;
  slotAt: string;
  clinicName: string;
  status: "planned" | "confirmed" | "completed" | "no_show" | "cancelled";
}

export function getSafeAppointments(): SafeAppointment[] {
  return getAppointments()
    .filter((a) => a.patientId === DEMO_PATIENT_ID)
    .map((a) => ({
      id: a.id,
      slotAt: a.slotAt,
      clinicName: getClinicById(a.clinicId)?.name ?? "—",
      status: a.status,
    }))
    .sort((a, b) => a.slotAt.localeCompare(b.slotAt));
}

export function getNextAppointment(): SafeAppointment | undefined {
  const now = Date.now();
  return getSafeAppointments().find(
    (a) => new Date(a.slotAt).getTime() >= now && (a.status === "planned" || a.status === "confirmed"),
  );
}

export interface DerivedReminder {
  id: string;
  title: string;
  dueAt: string;
  source: "followup" | "appointment" | "report";
}

/** Reminders деривируются из followUpPlan и предстоящих визитов. */
export function getDerivedReminders(): DerivedReminder[] {
  const out: DerivedReminder[] = [];
  const visits = getVisitsByPatientId(DEMO_PATIENT_ID);
  for (const v of visits) {
    const ass = getAssessmentsByVisitId(v.id);
    ass.forEach((a, idx) => {
      // Срок: дата визита + 90 дней (детерминированно).
      const due = new Date(v.startedAt);
      due.setDate(due.getDate() + 90);
      out.push({
        id: `rem-fu-${a.id}-${idx}`,
        title: a.followUpPlan,
        dueAt: due.toISOString(),
        source: "followup",
      });
    });
  }
  for (const a of getSafeAppointments()) {
    if (a.status === "planned" || a.status === "confirmed") {
      out.push({
        id: `rem-ap-${a.id}`,
        title: `Напоминание о приёме · ${a.clinicName}`,
        dueAt: a.slotAt,
        source: "appointment",
      });
    }
  }
  for (const r of getSafeReports()) {
    out.push({
      id: `rem-rp-${r.id}`,
      title: "Перечитать заключение врача",
      dueAt: r.visitDate,
      source: "report",
    });
  }
  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** Демо-каталог услуг. Цены отсутствуют намеренно. */
export const DEMO_SERVICES = [
  { id: "svc-derm-cons", name: "Консультация дерматолога" },
  { id: "svc-derm-scope", name: "Дерматоскопия (1 элемент)" },
  { id: "svc-derm-map", name: "Полное картирование невусов" },
  { id: "svc-derm-followup", name: "Контрольный осмотр" },
];

/** Детерминированные слоты на 7 дней вперёд от фиксированной точки. */
export function buildDemoSlots(seedISO = "2026-05-12T09:00:00Z"): string[] {
  const start = new Date(seedISO);
  const slots: string[] = [];
  for (let day = 0; day < 7; day++) {
    for (const hour of [9, 11, 14, 16]) {
      const d = new Date(start);
      d.setDate(d.getDate() + day);
      d.setUTCHours(hour, 0, 0, 0);
      slots.push(d.toISOString());
    }
  }
  return slots;
}

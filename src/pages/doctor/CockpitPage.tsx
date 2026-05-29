import { useMemo, useState } from "react";
import {
  Camera,
  ChevronRight,
  ClipboardList,
  FileText,
  Image as ImageIcon,
  Link2,
  MapPin,
  Plus,
  QrCode,
  RefreshCw,
  Smartphone,
  Stethoscope,
  Upload,
} from "lucide-react";

import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  activeVisit as defaultVisit,
  MONITORING_LABEL,
  QUALITY_LABEL,
  recentRail,
  REPORT_LABEL,
  SOURCE_LABEL,
  SOURCE_TAG_LABEL,
  todayRail,
  type CockpitPhoto,
  type CockpitVisit,
  type MonitoringPlanState,
  type PhotoQuality,
  type RailPatient,
  type ReportState,
} from "./cockpit/cockpit-mock";
import { DeviceStatusDot, SectionHeader, StatusChip, type ChipTone } from "./cockpit/cockpit-ui";

// ---------- helpers ----------

const QUALITY_TONE: Record<PhotoQuality, ChipTone> = {
  good: "success",
  warning: "warning",
  retake: "danger",
  incomparable: "danger",
  unassigned: "info",
};

const MONITORING_TONE: Record<MonitoringPlanState, ChipTone> = {
  insufficient: "danger",
  dermoscopy_only: "warning",
  ready_for_review: "info",
  followup_set: "success",
};

const REPORT_TONE: Record<ReportState, ChipTone> = {
  not_started: "neutral",
  draft: "info",
  blocked_intake: "danger",
  blocked_quality: "danger",
  ready_for_review: "warning",
  confirmed: "success",
};

function thumb(hue: number) {
  // Нейтральный плейсхолдер без людей; мягкий клинический оттенок.
  return {
    background: `linear-gradient(135deg, hsl(${hue} 30% 86%), hsl(${hue} 25% 72%))`,
  } as const;
}

// ---------- Top context bar ----------

function CockpitTopBar({ visit }: { visit: CockpitVisit }) {
  return (
    <div className="surface-toolbar flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <Stethoscope className="h-4 w-4 text-[hsl(var(--primary))]" aria-hidden />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-foreground">
            {visit.patientName}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {visit.sexAge} · ДР {visit.dob} · карта {visit.cardNo}
          </div>
        </div>
      </div>

      <div className="h-8 w-px bg-border" aria-hidden />

      <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
        <span>
          Визит <span className="text-foreground">{visit.date} · {visit.scheduledAt}</span>
        </span>
        <span className="hidden sm:inline">·</span>
        <span className="truncate">{visit.reason}</span>
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-1.5">
        <StatusChip tone={visit.intakeStatus === "complete" ? "success" : visit.intakeStatus === "partial" ? "warning" : "danger"}>
          Анамнез: {visit.intakeStatus === "complete" ? "полный" : visit.intakeStatus === "partial" ? "частично" : "пусто"}
        </StatusChip>
        <StatusChip tone={visit.photoStatus === "complete" ? "success" : visit.photoStatus === "issues" ? "warning" : "info"}>
          Фото: {visit.photoStatus === "complete" ? "готово" : visit.photoStatus === "issues" ? "есть вопросы" : visit.photoStatus === "partial" ? "частично" : "нет"}
        </StatusChip>
        <StatusChip tone={REPORT_TONE[visit.reportStatus]}>
          Отчёт: {REPORT_LABEL[visit.reportStatus]}
        </StatusChip>
        <div className="flex flex-wrap items-center gap-1.5 border-l border-border pl-1.5">
          <DeviceStatusDot label="Телефон" state="connected" />
          <DeviceStatusDot label="Дерматоскоп" state="warning" />
        </div>
        <div className="ml-1 flex items-center gap-1">
          {visit.sources.map((s) => (
            <span
              key={s}
              className="rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              {SOURCE_TAG_LABEL[s]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Left patient rail ----------

function PatientRailGroup({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: RailPatient[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="surface-card flex flex-col overflow-hidden">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold text-foreground">{title}</span>
          <span className="text-[11px] text-muted-foreground">{items.length}</span>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {items.map((p) => {
          const active = p.visitId === selectedId;
          return (
            <li key={p.visitId}>
              <button
                type="button"
                onClick={() => onSelect(p.visitId)}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-muted",
                  active && "bg-[hsl(var(--primary-soft))] hover:bg-[hsl(var(--primary-soft))]",
                )}
                aria-current={active ? "true" : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    p.state === "in_progress" && "bg-[hsl(var(--primary))]",
                    p.state === "scheduled" && "bg-muted-foreground/50",
                    p.state === "done" && "bg-[hsl(var(--success))]",
                    p.state === "recent" && "bg-border",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-[13px]", active ? "font-semibold text-foreground" : "text-foreground")}>
                      {p.patientName}
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{p.time}</span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{p.reason}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Center: anamnesis ----------

function AnamnesisSection({ visit }: { visit: CockpitVisit }) {
  const missing = visit.intake.filter((f) => !f.filled);
  return (
    <section className="surface-card">
      <SectionHeader
        title="Анамнез и данные"
        hint={`${visit.intake.length - missing.length} из ${visit.intake.length} полей заполнено`}
        right={
          <Button variant="outline" size="sm" className="h-7 px-2 text-[12px]">
            Открыть анкету
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 px-4 py-3 md:grid-cols-2">
        {visit.intake.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between gap-3 border-b border-dashed border-border/70 py-1.5 last:border-b-0"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  f.filled ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--destructive))]",
                )}
              />
              <span className="truncate text-[13px] text-foreground">{f.label}</span>
            </div>
            {f.filled ? (
              <span className="text-[11px] text-muted-foreground">заполнено</span>
            ) : (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[12px] text-[hsl(var(--primary))]">
                Дозаполнить
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------- Center: monitoring plan ----------

function MonitoringPlanSection({ visit }: { visit: CockpitVisit }) {
  const state = visit.monitoring;
  const message: Record<MonitoringPlanState, string> = {
    insufficient: "Данных недостаточно для построения плана. Заполните обязательные поля анамнеза.",
    dermoscopy_only: "Возможна только техническая оценка снимков. Прогноз и риск-поддержка заблокированы до заполнения анамнеза.",
    ready_for_review: "Все обязательные данные собраны. Требуется врачебная проверка перед формированием отчёта.",
    followup_set: "Назначен интервал наблюдения. План follow-up сохранён.",
  };
  return (
    <section className="surface-card">
      <SectionHeader
        title="План наблюдения"
        right={<StatusChip tone={MONITORING_TONE[state]}>{MONITORING_LABEL[state]}</StatusChip>}
      />
      <div className="px-4 py-3">
        <p className="text-[13px] leading-relaxed text-foreground">{message[state]}</p>
        <ul className="mt-2 grid grid-cols-1 gap-1 text-[12px] text-muted-foreground md:grid-cols-2">
          <li>· Anamnesis vitae — не заполнено</li>
          <li>· Локальный статус — не описан</li>
          <li>· Солнечные ожоги — не указано</li>
          <li>· Пребывание на солнце — не указано</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[12px]">
            Открыть dermoscopy-only review
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]">
            Что требуется для врачебной проверки
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------- Center: capture ----------

const CAPTURE_TABS = [
  { key: "phone", label: "Телефон", icon: Smartphone },
  { key: "file", label: "Файл", icon: Upload },
  { key: "device", label: "Device Bridge", icon: Stethoscope },
  { key: "qr", label: "QR / локально", icon: QrCode },
] as const;

function CaptureSection({ visit }: { visit: CockpitVisit }) {
  const [tab, setTab] = useState<(typeof CAPTURE_TABS)[number]["key"]>("device");
  return (
    <section className="surface-card">
      <SectionHeader
        title="Съёмка и фото"
        hint={`Визит ${visit.scheduledAt} · ${visit.patientName}`}
        right={
          <span className="text-[11px] text-muted-foreground">
            {visit.photos.length} фото · {visit.photos.filter((p) => p.quality === "good").length} ок
          </span>
        }
      />
      <div className="px-4 pt-3">
        <div className="flex flex-wrap items-center gap-1 border-b border-border">
          {CAPTURE_TABS.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 border-b-2 px-2 py-1.5 text-[12px] transition-colors",
                  active
                    ? "border-[hsl(var(--primary))] text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="rounded-b-md border-x border-b border-border bg-surface-muted px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[12px] text-muted-foreground">
              Контекст: <span className="text-foreground">{visit.patientName}</span> · визит {visit.date} {visit.scheduledAt} · цель —{" "}
              <span className="text-foreground">Очаг #2, плечо</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {tab === "phone" && (
                <Button size="sm" className="h-7 px-2 text-[12px]">
                  <Camera className="mr-1 h-3.5 w-3.5" /> Сканировать фото с телефона
                </Button>
              )}
              {tab === "file" && (
                <Button size="sm" className="h-7 px-2 text-[12px]">
                  <Upload className="mr-1 h-3.5 w-3.5" /> Загрузить файл
                </Button>
              )}
              {tab === "device" && (
                <Button size="sm" className="h-7 px-2 text-[12px]">
                  <Stethoscope className="mr-1 h-3.5 w-3.5" /> Снять с дерматоскопа
                </Button>
              )}
              {tab === "qr" && (
                <Button size="sm" className="h-7 px-2 text-[12px]">
                  <QrCode className="mr-1 h-3.5 w-3.5" /> Создать QR для визита
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 px-2 text-[12px]">
                <MapPin className="mr-1 h-3.5 w-3.5" /> Назначить очаг
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-[12px]">
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Запросить переснимок
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {visit.photos.map((ph) => (
            <PhotoTile key={ph.id} photo={ph} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PhotoTile({ photo }: { photo: CockpitPhoto }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="relative aspect-square w-full" style={thumb(photo.thumbHue)}>
        <span className="absolute left-1.5 top-1.5">
          <StatusChip tone={QUALITY_TONE[photo.quality]}>{QUALITY_LABEL[photo.quality]}</StatusChip>
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded bg-foreground/70 px-1 py-0.5 text-[10px] text-background">
          {photo.capturedAt}
        </span>
      </div>
      <div className="px-2 py-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{SOURCE_LABEL[photo.source]}</span>
          <span className="truncate">{photo.lesionLabel ?? "—"}</span>
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {photo.reason ?? photo.bodyLocation ?? "Локализация не указана"}
        </div>
      </div>
    </div>
  );
}

// ---------- Center: lesion summary ----------

function LesionsSection({ visit }: { visit: CockpitVisit }) {
  const lesions = Array.from(
    visit.photos.reduce((map, photo) => {
      if (!photo.lesionLabel) return map;
      const current = map.get(photo.lesionLabel) ?? {
        label: photo.lesionLabel,
        bodyLocation: photo.bodyLocation ?? "Локализация не указана",
        photoCount: 0,
        issueCount: 0,
      };
      current.photoCount += 1;
      if (photo.quality !== "good") current.issueCount += 1;
      if (photo.bodyLocation) current.bodyLocation = photo.bodyLocation;
      map.set(photo.lesionLabel, current);
      return map;
    }, new Map<string, { label: string; bodyLocation: string; photoCount: number; issueCount: number }>()),
  ).map(([, lesion]) => lesion);

  const assignedPhotoCount = visit.photos.filter((photo) => photo.lesionLabel).length;
  const unassignedCount = visit.photos.filter((photo) => !photo.lesionLabel || !photo.bodyLocation).length;
  const lesionCountLabel = `${lesions.length} ${lesions.length === 1 ? "очаг" : "очага"}`;

  return (
    <section className="surface-card">
      <SectionHeader
        title="Очаги и локализация"
        hint={`${lesionCountLabel} · ${assignedPhotoCount} фото привязано`}
        right={<StatusChip tone={unassignedCount ? "info" : "success"}>{unassignedCount} без локализации</StatusChip>}
      />
      <div className="px-4 py-3">
        <div className="divide-y divide-border rounded-md border border-border bg-surface">
          {lesions.map((lesion) => (
            <div key={lesion.label} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-[150px] flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-[hsl(var(--primary))]" aria-hidden />
                  <span className="text-[13px] font-medium text-foreground">{lesion.label}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{lesion.photoCount} фото</span>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{lesion.bodyLocation}</div>
              </div>
              <StatusChip tone={lesion.issueCount ? "warning" : "success"}>
                {lesion.issueCount ? `${lesion.issueCount} требует проверки` : "готово"}
              </StatusChip>
              <Button size="sm" variant="outline" className="h-6 px-1.5 text-[11px]">
                К снимкам очага
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span>Body Map показан как готовность и счётчики. Полный редактор вынесен в следующий batch.</span>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" disabled>
            Body Map · следующий этап
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------- Center: report ----------

function ReportSection({ visit }: { visit: CockpitVisit }) {
  return (
    <section className="surface-card">
      <SectionHeader
        title="Отчёт"
        right={<StatusChip tone={REPORT_TONE[visit.reportStatus]}>{REPORT_LABEL[visit.reportStatus]}</StatusChip>}
      />
      <div className="px-4 py-3">
        <p className="text-[13px] text-foreground">
          Формирование отчёта недоступно: не заполнены обязательные поля анамнеза. Качество части снимков требует пересъёмки.
        </p>
        <ul className="mt-2 list-disc pl-5 text-[12px] text-muted-foreground">
          <li>Anamnesis vitae, локальный статус, факторы солнца — требуется дозаполнить.</li>
          <li>Очаг #2 — снимок размыт, требуется пересъёмка.</li>
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 px-2 text-[12px]" disabled>
            <FileText className="mr-1 h-3.5 w-3.5" /> Сформировать врачебный отчёт
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" disabled>
            Пациентский пакет · следующий этап
          </Button>
        </div>
      </div>
    </section>
  );
}

// ---------- Right status rail ----------

function StatusRail({ visit }: { visit: CockpitVisit }) {
  const missingCount = visit.intake.filter((f) => !f.filled).length;
  const retake = visit.photos.filter((p) => p.quality === "retake");
  const unassigned = visit.photos.filter((p) => p.quality === "unassigned");
  const incomparable = visit.photos.filter((p) => p.quality === "incomparable");
  const warning = visit.photos.filter((p) => p.quality === "warning");

  return (
    <div className="flex flex-col gap-3">
      {/* Missing data */}
      <div className="surface-card">
        <SectionHeader
          title="Недостающие данные"
          right={<StatusChip tone={missingCount ? "danger" : "success"}>{missingCount}</StatusChip>}
        />
        <ul className="divide-y divide-border">
          {visit.intake
            .filter((f) => !f.filled)
            .map((f) => (
              <li key={f.key} className="flex items-center justify-between px-3 py-1.5">
                <span className="truncate text-[12px] text-foreground">{f.label}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-[hsl(var(--primary))]">
                  Дозаполнить
                </Button>
              </li>
            ))}
        </ul>
      </div>

      {/* Photo quality */}
      <div className="surface-card">
        <SectionHeader
          title="Контроль качества фото"
          hint="техническая оценка"
        />
        <div className="grid grid-cols-2 gap-2 px-3 py-2 text-[12px]">
          <QualityCounter label="Хорошо" count={visit.photos.filter((p) => p.quality === "good").length} tone="success" />
          <QualityCounter label="С предупреждением" count={warning.length} tone="warning" />
          <QualityCounter label="Нужно переснять" count={retake.length} tone="danger" />
          <QualityCounter label="Не сопоставимо" count={incomparable.length} tone="danger" />
          <QualityCounter label="Не привязано" count={unassigned.length} tone="info" />
        </div>
      </div>

      {/* Comparability warning */}
      {incomparable.length > 0 ? (
        <div className="surface-card">
          <SectionHeader
            title="Сопоставимость"
            right={<StatusChip tone="danger">{incomparable.length}</StatusChip>}
          />
          <ul className="divide-y divide-border">
            {incomparable.map((p) => (
              <li key={p.id} className="flex items-start gap-2 px-3 py-2">
                <div className="h-10 w-10 shrink-0 rounded border border-border" style={thumb(p.thumbHue)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-foreground">{p.lesionLabel ?? "Очаг"} · {p.bodyLocation ?? ""}</div>
                  <div className="truncate text-[11px] text-muted-foreground">Причина: {p.reason}</div>
                  <div className="mt-1 flex gap-1">
                    <Button size="sm" variant="outline" className="h-6 px-1.5 text-[11px]">
                      Проверить условия
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Unassigned inbox */}
      <div className="surface-card">
        <SectionHeader
          title="Непривязанные фото"
          right={<StatusChip tone={unassigned.length ? "info" : "neutral"}>{unassigned.length}</StatusChip>}
        />
        <ul className="divide-y divide-border">
          {unassigned.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-muted-foreground">Все фото привязаны.</li>
          ) : (
            unassigned.map((p) => (
              <li key={p.id} className="flex items-start gap-2 px-3 py-2">
                <div className="h-10 w-10 shrink-0 rounded border border-border" style={thumb(p.thumbHue)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-foreground">{SOURCE_LABEL[p.source]}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{p.capturedAt}</span>
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">{p.reason ?? "—"}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" className="h-6 px-1.5 text-[11px]">
                      <Link2 className="mr-1 h-3 w-3" /> Привязать к очагу
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]">
                      <MapPin className="mr-1 h-3 w-3" /> Локализация
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[11px]">
                      Не использовать
                    </Button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Retake queue */}
      <div className="surface-card">
        <SectionHeader
          title="Нужно переснять"
          right={<StatusChip tone={retake.length ? "danger" : "success"}>{retake.length}</StatusChip>}
        />
        <ul className="divide-y divide-border">
          {retake.length === 0 ? (
            <li className="px-3 py-2 text-[12px] text-muted-foreground">Очередь пуста.</li>
          ) : (
            retake.map((p) => (
              <li key={p.id} className="flex items-start gap-2 px-3 py-2">
                <div className="h-10 w-10 shrink-0 rounded border border-border" style={thumb(p.thumbHue)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-foreground">{p.lesionLabel ?? "Очаг"} · {p.bodyLocation ?? ""}</div>
                  <div className="truncate text-[11px] text-muted-foreground">Причина: {p.reason}</div>
                  <div className="mt-1 flex gap-1">
                    <Button size="sm" variant="outline" className="h-6 px-1.5 text-[11px]">
                      <RefreshCw className="mr-1 h-3 w-3" /> Запросить переснимок
                    </Button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Report status */}
      <div className="surface-card">
        <SectionHeader title="Статус отчёта" right={<StatusChip tone={REPORT_TONE[visit.reportStatus]}>{REPORT_LABEL[visit.reportStatus]}</StatusChip>} />
        <div className="px-3 py-2 text-[12px] text-muted-foreground">
          Разблокируйте отчёт: дозаполните анамнез и устраните проблемы качества снимков.
        </div>
      </div>
    </div>
  );
}

function QualityCounter({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: ChipTone;
}) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-surface px-2 py-1.5">
      <span className="truncate text-[11px] text-muted-foreground">{label}</span>
      <StatusChip tone={tone}>{count}</StatusChip>
    </div>
  );
}

// ---------- Business strip (private doctor) ----------

function BusinessStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px]">
      <div>
        Сегодня визитов: <span className="font-semibold text-foreground tabular-nums">6</span>
      </div>
      <div>
        Завершено: <span className="font-semibold text-foreground tabular-nums">2</span>
      </div>
      <div>
        Выручка дня: <span className="font-semibold text-foreground tabular-nums">28 400 ₽</span>
      </div>
      <div className="ml-auto text-muted-foreground">Частная практика · {`MVP-режим`}</div>
    </div>
  );
}

// ---------- Page ----------

export default function CockpitPage() {
  const { role } = useRole();
  const [selectedId, setSelectedId] = useState<string>(defaultVisit.id);

  const visit = useMemo<CockpitVisit>(() => defaultVisit, []);
  const isPrivate = role === "private_doctor";

  return (
    <div className="bg-surface-muted">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-3 py-3">
        {isPrivate ? <BusinessStrip /> : null}

        <CockpitTopBar visit={visit} />

        <div className="grid grid-cols-12 gap-3">
          {/* Patient rail */}
          <aside className="col-span-12 flex flex-col gap-3 md:col-span-3 lg:col-span-2">
            <PatientRailGroup title="Сегодня" items={todayRail} selectedId={selectedId} onSelect={setSelectedId} />
            <PatientRailGroup title="Недавние" items={recentRail} selectedId={selectedId} onSelect={setSelectedId} />
            <Button variant="outline" size="sm" className="h-7 text-[12px]">
              <Plus className="mr-1 h-3.5 w-3.5" /> Новый пациент
            </Button>
          </aside>

          {/* Center workspace */}
          <main className="col-span-12 flex flex-col gap-3 md:col-span-9 lg:col-span-7">
            <AnamnesisSection visit={visit} />
            <MonitoringPlanSection visit={visit} />
            <CaptureSection visit={visit} />
            <LesionsSection visit={visit} />
            <ReportSection visit={visit} />
          </main>

          {/* Right rail */}
          <aside className="col-span-12 lg:col-span-3">
            <StatusRail visit={visit} />
          </aside>
        </div>

        <footer className="flex items-center gap-2 px-1 py-2 text-[11px] text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          UX-демо. Поддержка принятия решений — финальное медицинское заключение делает врач.
          <ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden />
          <ImageIcon className="h-3.5 w-3.5" aria-hidden />
          <span>Фото — нейтральные плейсхолдеры, без идентификации.</span>
        </footer>
      </div>
    </div>
  );
}

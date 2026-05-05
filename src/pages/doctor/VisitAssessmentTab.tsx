import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RiskBadge, type RiskLevel } from "@/components/clinical/RiskBadge";
import {
  getAssessmentsByVisitId,
  getImagesByLesionId,
} from "@/lib/mock-data";
import type { Assessment, ClinicalImage, Lesion, Visit } from "@/lib/domain";
import { DEMO_USERS } from "@/lib/users";
import { formatDateTime } from "@/lib/format";
import { BODY_MAP_DEMO_NOW, bodyMapSurfaceLabel } from "@/pages/doctor/body-map-model";

const LESION_STATUS: Record<Lesion["status"], string> = {
  active: "Активное",
  monitoring: "Наблюдение",
  removed: "Удалено",
  archived: "Архив",
};

const IMAGE_KIND_LABEL: Record<ClinicalImage["kind"], string> = {
  overview: "обзор",
  dermoscopy: "дерматоскопия",
  macro: "макро",
  body_map: "body map",
};

function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return Object.values(DEMO_USERS).find((u) => u.id === id)?.fullName ?? id;
}

function isLocalDraftId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("local-lesion-");
}

type QualityStatus = "ok" | "review" | "none";

function qualityStatus(images: ClinicalImage[]): QualityStatus {
  if (images.length === 0) return "none";
  const needsReview = images.some((i) => i.quality.score < 0.8 || i.quality.issues.length > 0);
  return needsReview ? "review" : "ok";
}

function qualityLabel(s: QualityStatus): string {
  if (s === "ok") return "ok";
  if (s === "review") return "needs review";
  return "no images";
}

interface Props {
  visit: Visit;
  lesions: Lesion[];
  selectedLesionId?: string | null;
  onSelectLesion?: (lesionId: string) => void;
  onOpenImaging?: (lesionId: string) => void;
  onOpenConclusion?: (lesionId: string) => void;
}

export function VisitAssessmentTab({
  visit,
  lesions,
  selectedLesionId,
  onSelectLesion,
  onOpenImaging,
  onOpenConclusion,
}: Props) {
  const visitAssessments = useMemo(() => getAssessmentsByVisitId(visit.id), [visit.id]);

  if (lesions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface p-6 text-[13px] text-muted-foreground">
        У пациента не зарегистрировано образований. Добавьте образование на вкладке Body map.
      </div>
    );
  }

  const isDraftParam = isLocalDraftId(selectedLesionId);
  const fromParam =
    selectedLesionId && !isDraftParam
      ? lesions.find((l) => l.id === selectedLesionId) ?? null
      : null;
  const withAssessment = lesions.find((l) => visitAssessments.some((a) => a.lesionId === l.id));
  const selectedLesion = fromParam ?? withAssessment ?? lesions[0];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* Lesion navigator */}
      <aside className="lg:col-span-4 xl:col-span-3">
        {isDraftParam && (
          <div
            role="status"
            className="mb-3 rounded-md border border-dashed border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground"
          >
            Локальный демо-очаг нужно сохранить на бэкенде перед оценкой.
          </div>
        )}
        <Section title="Образования пациента">
          <ul className="-mx-3 -mb-3 divide-y divide-border">
            {lesions.map((l) => {
              const has = visitAssessments.some((a) => a.lesionId === l.id);
              const lImages = getImagesByLesionId(l.id);
              const isSel = l.id === selectedLesion.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => onSelectLesion?.(l.id)}
                    aria-pressed={isSel}
                    className={`flex min-h-[44px] w-full flex-col gap-1 px-3 py-2 text-left text-[13px] transition-colors sm:min-h-[40px] ${
                      isSel
                        ? "bg-[hsl(var(--primary-soft))] text-[hsl(var(--accent-foreground))]"
                        : "bg-surface hover:bg-surface-muted"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium">{l.label}</span>
                      <span className="shrink-0 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {LESION_STATUS[l.status]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                      <span className="truncate">{l.bodyZone}</span>
                      <span className="shrink-0 tabular-nums">
                        {lImages.length} сн. · {has ? "оценка ✓" : "без оценки"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      </aside>

      <div className="grid grid-cols-1 gap-3 lg:col-span-8 lg:grid-cols-2 xl:col-span-9">
        <SelectedLesionPanel
          lesion={selectedLesion}
          assessment={visitAssessments.find((a) => a.lesionId === selectedLesion.id) ?? null}
          onOpenImaging={onOpenImaging}
          onOpenConclusion={onOpenConclusion}
        />
      </div>
    </div>
  );
}

// ───────── Selected lesion panel ─────────

function SelectedLesionPanel({
  lesion,
  assessment,
  onOpenImaging,
  onOpenConclusion,
}: {
  lesion: Lesion;
  assessment: Assessment | null;
  onOpenImaging?: (lesionId: string) => void;
  onOpenConclusion?: (lesionId: string) => void;
}) {
  const images = getImagesByLesionId(lesion.id);
  const quality = qualityStatus(images);
  const surface = lesion.mapPoint?.view ?? "front";

  return (
    <>
      <Section title="Контекст выбранного очага" className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Field term="Очаг" value={<span className="font-medium">{lesion.label}</span>} />
            <Field term="Зона тела" value={lesion.bodyZone} />
            <Field term="Поверхность / проекция" value={bodyMapSurfaceLabel(surface)} />
            <Field term="Статус образования" value={LESION_STATUS[lesion.status]} />
          </div>
          <div>
            <Field
              term="Снимков в визите"
              value={<span className="tabular-nums">{images.length}</span>}
            />
            <Field
              term="Качество снимков"
              value={
                <span
                  data-testid="quality-summary"
                  className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${
                    quality === "ok"
                      ? "border-border bg-surface-muted text-foreground"
                      : quality === "review"
                        ? "border-[hsl(var(--risk-medium))] bg-surface-muted text-foreground"
                        : "border-dashed border-border bg-surface-muted text-muted-foreground"
                  }`}
                >
                  {qualityLabel(quality)}
                </span>
              }
            />
            <Field
              term="Текущая оценка"
              value={assessment ? "есть" : <span className="text-muted-foreground">нет</span>}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-[44px] sm:min-h-[32px]"
            onClick={() => onOpenImaging?.(lesion.id)}
          >
            К снимкам этого очага
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-[44px] sm:min-h-[32px]"
            onClick={() => onOpenConclusion?.(lesion.id)}
          >
            К заключению по визиту
          </Button>
        </div>
      </Section>

      <Section title="Связанные снимки" className="lg:col-span-2">
        <ImageContext images={images} />
      </Section>

      {assessment ? (
        <ExistingAssessmentPanels assessment={assessment} />
      ) : (
        <DemoAssessmentForm key={lesion.id} lesion={lesion} />
      )}
    </>
  );
}

// ───────── Existing assessment ─────────

function ExistingAssessmentPanels({ assessment }: { assessment: Assessment }) {
  return (
    <>
      <Section title="ABCD (Total Dermoscopy Score)">
        <ScoreRow term="Asymmetry" hint="асимметрия" value={assessment.abcd.asymmetry} />
        <ScoreRow term="Border" hint="граница" value={assessment.abcd.border} />
        <ScoreRow term="Color" hint="цвет" value={assessment.abcd.color} />
        <ScoreRow term="Diameter" hint="диаметр" value={assessment.abcd.diameter} />
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
          <span className="text-[12px] font-medium text-muted-foreground">TDS</span>
          <span className="text-[16px] font-semibold tabular-nums">{assessment.abcd.total.toFixed(1)}</span>
        </div>
      </Section>

      <Section title="7-point checklist">
        <ScoreRow term="Major" hint="основные признаки" value={assessment.sevenPoint.major} />
        <ScoreRow term="Minor" hint="второстепенные признаки" value={assessment.sevenPoint.minor} />
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
          <span className="text-[12px] font-medium text-muted-foreground">Сумма</span>
          <span className="text-[16px] font-semibold tabular-nums">{assessment.sevenPoint.total}</span>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Шкала используется как структурированная заметка. Диагноз ставит врач.
        </p>
      </Section>

      <Section title="AI-поддержка решения" className="lg:col-span-2">
        <AiSupportPanel assessment={assessment} />
      </Section>

      <Section title="Решение врача (мок, только просмотр)" className="lg:col-span-2">
        <Field term="Заключение" value={assessment.doctorConclusion || "—"} />
        <Field term="План наблюдения" value={assessment.followUpPlan || "—"} />
        <Field term="Принял" value={userName(assessment.decidedBy)} />
        <Field term="Когда" value={formatDateTime(assessment.decidedAt)} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Существующая мок-запись врача. Редактирование появится на вкладке «Заключение».
        </p>
      </Section>
    </>
  );
}

// ───────── Demo assessment form (local-only) ─────────

interface DemoAssessmentDraft {
  abcdTotal: string;
  sevenPointTotal: string;
  followUpPlan: string;
  doctorComment: string;
  createdAt: string;
}

function DemoAssessmentForm({ lesion }: { lesion: Lesion }) {
  const [abcdTotal, setAbcdTotal] = useState("");
  const [sevenPointTotal, setSevenPointTotal] = useState("");
  const [followUpPlan, setFollowUpPlan] = useState("");
  const [doctorComment, setDoctorComment] = useState("");
  const [saved, setSaved] = useState<DemoAssessmentDraft | null>(null);

  // Reset when lesion changes (extra safety, key={lesion.id} also resets state).
  useEffect(() => {
    setSaved(null);
  }, [lesion.id]);

  const onSave = () => {
    setSaved({
      abcdTotal: abcdTotal.trim(),
      sevenPointTotal: sevenPointTotal.trim(),
      followUpPlan: followUpPlan.trim(),
      doctorComment: doctorComment.trim(),
      createdAt: BODY_MAP_DEMO_NOW,
    });
  };

  return (
    <Section title="Локальная демо-оценка" className="lg:col-span-2">
      <p className="mb-3 text-[12px] text-muted-foreground">
        Для этого образования ещё нет сохранённой оценки. Заполните демо-форму — она существует
        только в UI текущего визита и не изменяет мок-данные.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField id="demo-abcd" label="ABCD total">
          <Input
            id="demo-abcd"
            inputMode="decimal"
            value={abcdTotal}
            onChange={(e) => setAbcdTotal(e.target.value)}
            placeholder="например, 4.8"
            className="min-h-[44px] sm:min-h-[32px]"
          />
        </FormField>
        <FormField id="demo-7p" label="7-point total">
          <Input
            id="demo-7p"
            inputMode="numeric"
            value={sevenPointTotal}
            onChange={(e) => setSevenPointTotal(e.target.value)}
            placeholder="например, 3"
            className="min-h-[44px] sm:min-h-[32px]"
          />
        </FormField>
        <FormField id="demo-followup" label="План наблюдения" className="md:col-span-2">
          <Textarea
            id="demo-followup"
            value={followUpPlan}
            onChange={(e) => setFollowUpPlan(e.target.value)}
            rows={2}
            placeholder="Контроль через 3 мес., дерматоскопия повторно."
          />
        </FormField>
        <FormField id="demo-comment" label="Комментарий врача" className="md:col-span-2">
          <Textarea
            id="demo-comment"
            value={doctorComment}
            onChange={(e) => setDoctorComment(e.target.value)}
            rows={3}
            placeholder="Краткая заметка для коллег."
          />
        </FormField>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-[44px] sm:min-h-[32px]"
          onClick={onSave}
        >
          Сохранить демо-оценку
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Локально, без сети и хранилища.
        </span>
      </div>

      {saved && (
        <div
          role="status"
          data-testid="demo-assessment-preview"
          className="mt-3 rounded-md border border-border bg-surface-muted p-3 text-[12px]"
        >
          <div className="mb-1 text-[12px] font-medium">Демо-оценка создана локально</div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-muted-foreground">ABCD total</dt>
            <dd className="tabular-nums">{saved.abcdTotal || "—"}</dd>
            <dt className="text-muted-foreground">7-point total</dt>
            <dd className="tabular-nums">{saved.sevenPointTotal || "—"}</dd>
            <dt className="text-muted-foreground">План наблюдения</dt>
            <dd>{saved.followUpPlan || "—"}</dd>
            <dt className="text-muted-foreground">Комментарий</dt>
            <dd>{saved.doctorComment || "—"}</dd>
            <dt className="text-muted-foreground">Время (демо)</dt>
            <dd className="tabular-nums">{formatDateTime(saved.createdAt)}</dd>
          </dl>
        </div>
      )}
    </Section>
  );
}

function FormField({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ?? ""}>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

// ───────── AI support ─────────

function AiSupportPanel({ assessment }: { assessment: Assessment }) {
  const ai = assessment.aiSupport;
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
      <div className="space-y-2 md:col-span-7">
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={ai.riskLevel as RiskLevel} />
          <span className="text-[12px] text-muted-foreground">
            Уверенность модели:{" "}
            <span className="font-medium tabular-nums text-foreground">{Math.round(ai.confidence * 100)}%</span>
          </span>
        </div>

        <div>
          <div className="mb-1 text-[12px] font-medium text-muted-foreground">Подозреваемые признаки</div>
          {ai.suspectedFeatures.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">—</div>
          ) : (
            <ul className="space-y-0.5 text-[13px]">
              {ai.suspectedFeatures.map((f) => (
                <li key={f} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1 text-[12px] font-medium text-muted-foreground">Маркеры неопределённости</div>
          {ai.uncertaintyNotes.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">Не зафиксированы.</div>
          ) : (
            <ul className="space-y-0.5 text-[13px]">
              {ai.uncertaintyNotes.map((f) => (
                <li key={f} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1 text-[12px] font-medium text-muted-foreground">XAI-заметки</div>
          <p className="text-[13px]">{ai.xaiNotes || "—"}</p>
        </div>

        <p className="rounded-sm border border-dashed border-border bg-surface-muted px-2 py-1.5 text-[11px] text-muted-foreground">
          {ai.disclaimer} AI — это поддержка решения, не диагноз. Окончательное решение принимает врач.
        </p>
      </div>

      <div className="md:col-span-5">
        <div className="mb-1 text-[12px] font-medium text-muted-foreground">XAI placeholder</div>
        <XaiPlaceholder seed={assessment.id} />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Демонстрационная карта внимания. Не используется для постановки диагноза.
        </p>
      </div>
    </div>
  );
}

function XaiPlaceholder({ seed }: { seed: string }) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const cells = Array.from({ length: 64 }, (_, i) => ((h >>> ((i * 7) % 24)) & 0xff) / 255);

  return (
    <div
      role="img"
      aria-label="XAI placeholder: демонстрационная карта внимания"
      className="grid aspect-square w-full overflow-hidden rounded-sm border border-border"
      style={{ gridTemplateColumns: "repeat(8, 1fr)" }}
    >
      {cells.map((v, i) => (
        <div
          key={i}
          style={{ background: `hsl(var(--primary) / ${(0.08 + v * 0.55).toFixed(2)})` }}
        />
      ))}
    </div>
  );
}

function ImageContext({ images }: { images: ClinicalImage[] }) {
  if (images.length === 0) {
    return <Empty text="К образованию пока не привязано ни одного снимка." />;
  }
  const kindCounts = images.reduce<Record<string, number>>((acc, im) => {
    acc[im.kind] = (acc[im.kind] ?? 0) + 1;
    return acc;
  }, {});
  const issues = images.flatMap((i) => i.quality.issues);
  const uniqueIssues = Array.from(new Set(issues));
  const lowQuality = images.filter((i) => i.quality.score < 0.8 || i.quality.issues.length > 0).length;

  return (
    <>
      <Field term="Снимков всего" value={<span className="tabular-nums">{images.length}</span>} />
      <Field
        term="Типы"
        value={
          <span>
            {Object.entries(kindCounts)
              .map(([k, n]) => `${IMAGE_KIND_LABEL[k as ClinicalImage["kind"]] ?? k} · ${n}`)
              .join(", ")}
          </span>
        }
      />
      <Field
        term="Требуют проверки"
        value={<span className="tabular-nums">{lowQuality} из {images.length}</span>}
      />
      <div className="mt-2">
        <div className="mb-1 text-[12px] text-muted-foreground">Замечания к качеству</div>
        {uniqueIssues.length === 0 ? (
          <div className="text-[12px] text-muted-foreground">Не зафиксированы.</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {uniqueIssues.map((iss) => (
              <span
                key={iss}
                className="rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {iss}
              </span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ScoreRow({ term, hint, value }: { term: string; hint: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1.5 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{term}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <div className="shrink-0 text-[14px] font-semibold tabular-nums">{value.toFixed(1)}</div>
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

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border bg-surface-muted px-2 py-3 text-[12px] text-muted-foreground">
      {text}
    </div>
  );
}

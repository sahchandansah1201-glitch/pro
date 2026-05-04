import { useMemo, useState } from "react";

import { RiskBadge, type RiskLevel } from "@/components/clinical/RiskBadge";
import {
  getAssessmentsByVisitId,
  getImagesByLesionId,
} from "@/lib/mock-data";
import type { Assessment, ClinicalImage, Lesion, Visit } from "@/lib/domain";
import { DEMO_USERS } from "@/lib/users";
import { formatDateTime } from "@/lib/format";

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

interface Props {
  visit: Visit;
  lesions: Lesion[];
}

export function VisitAssessmentTab({ visit, lesions }: Props) {
  const visitAssessments = useMemo(() => getAssessmentsByVisitId(visit.id), [visit.id]);

  const initialId = useMemo(() => {
    if (lesions.length === 0) return null;
    const withAssessment = lesions.find((l) => visitAssessments.some((a) => a.lesionId === l.id));
    return (withAssessment ?? lesions[0]).id;
  }, [lesions, visitAssessments]);

  const [selectedId, setSelectedId] = useState<string | null>(initialId);

  if (lesions.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface p-6 text-[13px] text-muted-foreground">
        У пациента не зарегистрировано образований. Добавьте образование на вкладке Body map.
      </div>
    );
  }

  const selectedLesion = lesions.find((l) => l.id === selectedId) ?? lesions[0];
  const assessment = visitAssessments.find((a) => a.lesionId === selectedLesion.id) ?? null;
  const images = getImagesByLesionId(selectedLesion.id);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
      {/* Lesion navigator */}
      <aside className="lg:col-span-4 xl:col-span-3">
        <Section title="Образования пациента">
          <ul className="-mx-3 -mb-3 divide-y divide-border">
            {lesions.map((l) => {
              const has = visitAssessments.some((a) => a.lesionId === l.id);
              const imageCount = getImagesByLesionId(l.id).length;
              const isSel = l.id === selectedLesion.id;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    aria-pressed={isSel}
                    className={`flex min-h-[44px] w-full flex-col gap-1 px-3 py-2 text-left text-[13px] transition-colors ${
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
                        {imageCount} сн. · {has ? "оценка ✓" : "без оценки"}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      </aside>

      {/* Assessment panels */}
      <div className="grid grid-cols-1 gap-3 lg:col-span-8 lg:grid-cols-2 xl:col-span-9">
        <Section title="ABCD (Total Dermoscopy Score)">
          {assessment ? (
            <>
              <ScoreRow term="Asymmetry" hint="асимметрия" value={assessment.abcd.asymmetry} />
              <ScoreRow term="Border" hint="граница" value={assessment.abcd.border} />
              <ScoreRow term="Color" hint="цвет" value={assessment.abcd.color} />
              <ScoreRow term="Diameter" hint="диаметр" value={assessment.abcd.diameter} />
              <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-[12px] font-medium text-muted-foreground">TDS</span>
                <span className="text-[16px] font-semibold tabular-nums">{assessment.abcd.total.toFixed(1)}</span>
              </div>
            </>
          ) : (
            <Empty text="Оценка ABCD для этого образования ещё не заполнена в демо-данных." />
          )}
        </Section>

        <Section title="7-point checklist">
          {assessment ? (
            <>
              <ScoreRow term="Major" hint="основные признаки" value={assessment.sevenPoint.major} />
              <ScoreRow term="Minor" hint="второстепенные признаки" value={assessment.sevenPoint.minor} />
              <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
                <span className="text-[12px] font-medium text-muted-foreground">Сумма</span>
                <span className="text-[16px] font-semibold tabular-nums">{assessment.sevenPoint.total}</span>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Шкала используется как структурированная заметка. Диагноз ставит врач.
              </p>
            </>
          ) : (
            <Empty text="7-point checklist для этого образования ещё не заполнен в демо-данных." />
          )}
        </Section>

        <Section title="AI-поддержка решения" className="lg:col-span-2">
          {assessment ? (
            <AiSupportPanel assessment={assessment} />
          ) : (
            <Empty text="AI-поддержка для этого образования отсутствует в демо-данных." />
          )}
        </Section>

        <Section title="Контекст снимков">
          <ImageContext images={images} />
        </Section>

        <Section title="Решение врача (мок, только просмотр)">
          {assessment ? (
            <>
              <Field term="Заключение" value={assessment.doctorConclusion || "—"} />
              <Field term="План наблюдения" value={assessment.followUpPlan || "—"} />
              <Field term="Принял" value={userName(assessment.decidedBy)} />
              <Field term="Когда" value={formatDateTime(assessment.decidedAt)} />
              <p className="mt-2 text-[11px] text-muted-foreground">
                Существующая мок-запись врача. Редактирование появится на вкладке «Заключение».
              </p>
            </>
          ) : (
            <Empty text="Решение врача по этому образованию ещё не зафиксировано." />
          )}
        </Section>
      </div>
    </div>
  );
}

// ───────── Subcomponents ─────────

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

      {/* XAI placeholder */}
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
  // Deterministic hash → grid heat cells.
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const cells = Array.from({ length: 64 }, (_, i) => {
    const v = ((h >>> ((i * 7) % 24)) & 0xff) / 255;
    return v;
  });

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
          style={{
            background: `hsl(var(--primary) / ${(0.08 + v * 0.55).toFixed(2)})`,
          }}
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
  const lowQuality = images.filter((i) => i.quality.score < 0.6).length;

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
        term="Низкое качество"
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

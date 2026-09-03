import type { ClinicalImage } from "@/lib/domain";
import { TECHNICAL_QUALITY_NOT_ASSESSED } from "@/lib/safe-clinical-image-adapter";
import {
  CLINICAL_IMAGE_QUALITY_THRESHOLD,
  isClinicalImageReviewNeeded,
} from "@/lib/clinical-image-quality";

export function ClinicalImageQualityChip({
  image,
  compact = false,
}: {
  image: ClinicalImage;
  compact?: boolean;
}) {
  const notAssessed = image.quality.issues.includes(TECHNICAL_QUALITY_NOT_ASSESSED);
  const review = isClinicalImageReviewNeeded(image);
  const text = notAssessed ? "Качество не оценено" : review ? "Требует проверки" : "Хорошее качество";
  const className = review
    ? "bg-warning text-warning-foreground"
    : "bg-success text-success-foreground";

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${className}`}
      title={notAssessed ? "Техническое качество не оценено" : `Оценка качества: ${(image.quality.score * 100).toFixed(0)}%`}
    >
      {compact ? (notAssessed ? "Не оценено" : `${Math.round(image.quality.score * 100)}%`) : text}
    </span>
  );
}

export function ClinicalImageQualityPanel({ image }: { image: ClinicalImage }) {
  const notAssessed = image.quality.issues.includes(TECHNICAL_QUALITY_NOT_ASSESSED);
  const issues = image.quality.issues;

  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold">Контроль качества</span>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {notAssessed
            ? "Качество не оценено"
            : `${(image.quality.score * 100).toFixed(0)}% · порог ${Math.round(CLINICAL_IMAGE_QUALITY_THRESHOLD * 100)}%`}
        </span>
      </div>
      {issues.length > 0 ? (
        <ul className="mt-1 flex flex-wrap gap-1">
          {issues.map((issue) => (
            <li key={issue} className="rounded-sm border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] text-warning">
              {issue === TECHNICAL_QUALITY_NOT_ASSESSED ? "Качество не оценено" : issue}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-[12px] text-muted-foreground">Замечаний не выявлено.</div>
      )}
      <div className="mt-1.5 text-[12px]">
        <span className="text-muted-foreground">Рекомендация: </span>
        <span>{notAssessed ? "Проведите техническую проверку снимка перед сравнением." : recommendedAction(image)}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Только контроль качества. Это не клинический диагноз.
      </p>
    </div>
  );
}

function recommendedAction(image: ClinicalImage): string {
  const issues = image.quality.issues.join(" ").toLowerCase();
  if (image.quality.score < 0.7 || issues.includes("размыт")) {
    return "Повторить снимок: сфокусироваться, при дерматоскопии — обеспечить контакт.";
  }
  if (issues.includes("блик")) return "Снизить блики: использовать поляризацию или изменить угол.";
  if (issues.includes("освещ") || issues.includes("тени")) {
    return "Улучшить освещение: добавить рассеянный свет, убрать тени.";
  }
  if (image.quality.score < CLINICAL_IMAGE_QUALITY_THRESHOLD) {
    return "Желательно повторить снимок для уверенного просмотра.";
  }
  return "Можно использовать для просмотра.";
}

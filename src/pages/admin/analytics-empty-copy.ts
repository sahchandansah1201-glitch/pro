/**
 * Единый словарь текстов пустых состояний для /admin/analytics.
 *
 * Назначение:
 *   - все формулировки empty-states собраны в одном месте,
 *     чтобы их легко было менять и в будущем переводить (i18n);
 *   - страница не должна хардкодить тексты пустых блоков —
 *     только ключи из этого словаря.
 *
 * Ключи соответствуют шести секциям /admin/analytics. Если в странице
 * появится новая секция со своим empty-state, добавляйте новый ключ
 * сюда, а не строку в JSX.
 */

export type EmptyStateKey =
  | "leads"
  | "sources"
  | "clinics"
  | "analysisCards"
  | "imageQuality"
  | "botDialogs";

export interface EmptyStateCopy {
  title: string;
  /**
   * Подсказка. Если функция — она получит человекочитаемый
   * лейбл выбранного периода (например, «Март 2026») и должна
   * вернуть готовый текст. Это позволяет учитывать период там,
   * где это уместно, и оставлять статический текст там, где не нужно.
   */
  hint: string | ((rangeLabel: string) => string);
}

/** Универсальная подсказка по периоду для секций, зависящих от диапазона. */
const byRange = (rangeLabel: string) =>
  `Нет данных за период «${rangeLabel}». Попробуйте выбрать другой диапазон.`;

export const ANALYTICS_EMPTY_COPY: Record<EmptyStateKey, EmptyStateCopy> = {
  leads: { title: "Нет лидов", hint: byRange },
  sources: { title: "Нет источников", hint: byRange },
  clinics: {
    title: "Нет клиник",
    // Клиники не зависят от периода — справочный текст.
    hint: "Добавьте клиники в справочнике, чтобы увидеть маршрутизацию.",
  },
  analysisCards: {
    title: "Нет карточек предварительной оценки",
    hint: byRange,
  },
  imageQuality: { title: "Нет снимков", hint: byRange },
  botDialogs: { title: "Нет диалогов", hint: byRange },
};

/** Резолвер: возвращает готовые `title` и `hint` для конкретного ключа. */
export function resolveEmptyCopy(
  key: EmptyStateKey,
  rangeLabel: string,
): { title: string; hint: string } {
  const c = ANALYTICS_EMPTY_COPY[key];
  return {
    title: c.title,
    hint: typeof c.hint === "function" ? c.hint(rangeLabel) : c.hint,
  };
}

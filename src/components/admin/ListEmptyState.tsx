import { SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Понятное пустое состояние для admin-списков с фильтрами и поиском.
 *
 * Показывает:
 *  - заголовок («Ничего не найдено»);
 *  - перечисление активных фильтров и поискового запроса (демо-чипы);
 *  - подсказку с дальнейшими шагами;
 *  - кнопку «Сбросить фильтры» (демо-действие через onReset).
 *
 * Без сетевых вызовов, clipboard, storage, медиа.
 */

export interface ListEmptyStateProps {
  itemNoun: string;            // "врачей" | "услуг" | "клиник"
  query?: string;              // текущий поиск (если есть)
  activeFilters?: string[];    // человекочитаемые подписи активных фильтров
  totalUnfiltered: number;     // сколько всего записей без фильтров (для подсказки)
  onReset?: () => void;        // сбрасывает поиск и фильтры
  hint?: string;               // дополнительная подсказка
}

export function ListEmptyState({
  itemNoun,
  query,
  activeFilters = [],
  totalUnfiltered,
  onReset,
  hint,
}: ListEmptyStateProps) {
  const hasQuery = !!query?.trim();
  const hasFilters = activeFilters.length > 0;
  const canReset = (hasQuery || hasFilters) && !!onReset;

  return (
    <Card
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3 p-6 text-center"
    >
      <div
        aria-hidden
        className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <SearchX className="h-5 w-5" />
      </div>

      <div className="space-y-1">
        <div className="text-[14px] font-semibold">
          Ничего не найдено
        </div>
        <p className="max-w-md text-[12px] text-muted-foreground">
          По текущим условиям нет {itemNoun}. Всего в демо-каталоге:{" "}
          <span className="tabular-nums">{totalUnfiltered}</span>.
        </p>
      </div>

      {(hasQuery || hasFilters) && (
        <ul
          aria-label="Активные условия"
          className="flex flex-wrap items-center justify-center gap-1"
        >
          {hasQuery && (
            <li className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground">
              поиск: «{query!.trim()}»
            </li>
          )}
          {activeFilters.map((f) => (
            <li
              key={f}
              className="rounded-full border border-border bg-surface px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {f}
            </li>
          ))}
        </ul>
      )}

      <p className="max-w-md text-[12px] text-muted-foreground">
        {hint ??
          "Попробуйте упростить запрос, убрать один из фильтров или сбросить условия."}
      </p>

      {canReset && (
        <Button
          type="button"
          variant="outline"
          onClick={onReset}
          aria-label={`Сбросить поиск и фильтры ${itemNoun}`}
          className="min-h-[44px] sm:min-h-[36px]"
        >
          Сбросить фильтры
        </Button>
      )}

      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Демо-режим
      </div>
    </Card>
  );
}

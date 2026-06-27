import { Button } from "@/components/ui/button";

/**
 * Компактный пагинатор для admin-списков.
 *
 * - Plain text-кнопки с min-h-[44px] на mobile и min-h-[32px] на sm+.
 * - aria-label на навигационных кнопках, focus-visible ring через Button.
 * - Не показываем при единственной странице, но всегда сообщаем диапазон.
 */
export interface ListPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  rangeLabel: string;
  canPrev: boolean;
  canNext: boolean;
  onPageChange: (page: number) => void;
  itemNoun?: string; // "врачей", "услуг", "клиник"
}

export function ListPagination({
  page,
  pageCount,
  total,
  rangeLabel,
  canPrev,
  canNext,
  onPageChange,
  itemNoun = "записей",
}: ListPaginationProps) {
  if (total === 0) return null;

  return (
    <nav
      aria-label={`Пагинация ${itemNoun}`}
      className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
        {rangeLabel} {itemNoun}
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPrev}
            aria-label="Первая страница"
            onClick={() => onPageChange(1)}
            className="min-h-[44px] min-w-11 px-2 sm:min-h-[32px]"
          >
            «
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canPrev}
            aria-label="Предыдущая страница"
            onClick={() => onPageChange(page - 1)}
            className="min-h-[44px] min-w-11 px-2 sm:min-h-[32px]"
          >
            ←
          </Button>
          <span
            className="min-w-[92px] text-center text-[12px] tabular-nums text-muted-foreground"
            aria-current="page"
          >
            Страница {page} из {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canNext}
            aria-label="Следующая страница"
            onClick={() => onPageChange(page + 1)}
            className="min-h-[44px] min-w-11 px-2 sm:min-h-[32px]"
          >
            →
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canNext}
            aria-label="Последняя страница"
            onClick={() => onPageChange(pageCount)}
            className="min-h-[44px] min-w-11 px-2 sm:min-h-[32px]"
          >
            »
          </Button>
        </div>
      )}
    </nav>
  );
}

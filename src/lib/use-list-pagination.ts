import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Хук пагинации для admin-списков.
 * - На mobile дефолтный размер страницы меньше, чтобы карточки умещались.
 * - При смене зависимостей фильтров (deps) текущая страница сбрасывается на 1.
 */
export function useListPagination<T>(
  items: T[],
  opts: { mobilePageSize?: number; desktopPageSize?: number; deps?: unknown[] } = {},
) {
  const { mobilePageSize = 5, desktopPageSize = 10, deps = [] } = opts;
  const isMobile = useIsMobile();
  const pageSize = isMobile ? mobilePageSize : desktopPageSize;

  const [page, setPage] = useState(1);

  // Сбрасываем страницу при изменении фильтров/поиска или режима экрана.
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, ...deps]);

  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);

  return {
    visible,
    page: safePage,
    pageCount,
    pageSize,
    total,
    setPage,
    canPrev: safePage > 1,
    canNext: safePage < pageCount,
    rangeLabel:
      total === 0
        ? "0 из 0"
        : `${start + 1}–${Math.min(start + pageSize, total)} из ${total}`,
  };
}

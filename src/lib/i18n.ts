// Простая система локализации интерфейсных подсказок (RU по умолчанию).
// Используется для aria-label, title, placeholder и других системных текстов,
// которые иначе остались бы на английском (например, в shadcn-примитивах).

export type Locale = "ru";

export const DEFAULT_LOCALE: Locale = "ru";

const dict: Record<Locale, Record<string, string>> = {
  ru: {
    "ui.pagination": "Постраничная навигация",
    "ui.pagination.prev": "Предыдущая страница",
    "ui.pagination.next": "Следующая страница",
    "ui.pagination.more": "Ещё страницы",
    "ui.sidebar.toggle": "Переключить боковую панель",
    "ui.breadcrumb": "Хлебные крошки",
    "ui.dialog.close": "Закрыть",
    "ui.select.placeholder": "—",
  },
};

let currentLocale: Locale = DEFAULT_LOCALE;

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function t(key: string, fallback?: string): string {
  return dict[currentLocale]?.[key] ?? fallback ?? key;
}

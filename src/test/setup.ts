import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Отключаем имитацию загрузки секций /admin/analytics в тестах,
// чтобы существующие тесты сразу видели реальный контент / empty-states.
(window as unknown as { __ANALYTICS_LOADING_MS__?: number }).__ANALYTICS_LOADING_MS__ = 0;

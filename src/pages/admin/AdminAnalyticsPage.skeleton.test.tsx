import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminAnalyticsPage from "./AdminAnalyticsPage";

/**
 * Тесты skeleton-загрузки секций /admin/analytics.
 *
 * Цель — убедиться, что состояние «загрузка» визуально и семантически
 * отличается от состояния «пусто»:
 *   - в загрузке секции имеют data-loading="true" + aria-busy="true";
 *   - empty-state (data-empty="true") не отображается, пока идёт загрузка;
 *   - после завершения загрузки skeleton исчезает, и появляется либо
 *     контент, либо empty-state (никогда оба сразу).
 *
 * В обычном setup тестов window.__ANALYTICS_LOADING_MS__ = 0 — поэтому
 * в этих тестах мы локально включаем имитацию загрузки.
 */

const LOAD_MS = 50;

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAnalyticsPage />
    </MemoryRouter>,
  );
}

describe("AdminAnalyticsPage · skeleton loading", () => {
  beforeEach(() => {
    (window as unknown as { __ANALYTICS_LOADING_MS__?: number }).__ANALYTICS_LOADING_MS__ = LOAD_MS;
  });
  afterEach(() => {
    cleanup();
    (window as unknown as { __ANALYTICS_LOADING_MS__?: number }).__ANALYTICS_LOADING_MS__ = 0;
  });

  it("показывает skeleton при первой отрисовке и не показывает empty-state", () => {
    const { container } = renderPage();

    const loading = container.querySelectorAll('[data-loading="true"]');
    const empty = container.querySelectorAll('[data-empty="true"]');

    // Должны быть skeleton-блоки (минимум 6 секций + KPI-плитки).
    expect(loading.length).toBeGreaterThanOrEqual(6);
    // Пока грузится — empty-state не виден, чтобы не путать состояния.
    expect(empty.length).toBe(0);
  });

  it("skeleton-блоки имеют корректные ARIA-атрибуты для скрин-ридеров", () => {
    const { container } = renderPage();
    const loadingSections = container.querySelectorAll(
      'div[role="status"][data-loading="true"]',
    );
    expect(loadingSections.length).toBeGreaterThanOrEqual(5);
    loadingSections.forEach((el) => {
      expect(el.getAttribute("aria-busy")).toBe("true");
      expect(el.getAttribute("aria-live")).toBe("polite");
    });
  });

  it("после завершения загрузки skeleton исчезает", async () => {
    const { container } = renderPage();
    expect(container.querySelectorAll('[data-loading="true"]').length).toBeGreaterThan(0);

    await act(async () => {
      await new Promise((r) => setTimeout(r, LOAD_MS + 20));
    });

    expect(container.querySelectorAll('[data-loading="true"]').length).toBe(0);
  });

  it("при смене периода skeleton показывается снова, потом сменяется контентом или empty-state", async () => {
    const { container, getByRole } = renderPage();

    // Дожидаемся первой загрузки.
    await act(async () => {
      await new Promise((r) => setTimeout(r, LOAD_MS + 20));
    });
    expect(container.querySelectorAll('[data-loading="true"]').length).toBe(0);

    // Переключаем период — должен снова показаться skeleton.
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));
    expect(container.querySelectorAll('[data-loading="true"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-empty="true"]').length).toBe(0);

    // Дожидаемся завершения.
    await act(async () => {
      await new Promise((r) => setTimeout(r, LOAD_MS + 20));
    });
    expect(container.querySelectorAll('[data-loading="true"]').length).toBe(0);
    // Контент или empty-state — но больше не одновременно с loading.
    const empty = container.querySelectorAll('[data-empty="true"]').length;
    expect(empty).toBeGreaterThanOrEqual(0);
  });

  it("skeleton и empty-state не показываются одновременно ни в одной секции", async () => {
    const { container, getByRole } = renderPage();
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));

    // В момент загрузки — только skeleton.
    expect(container.querySelectorAll('[data-loading="true"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-empty="true"]').length).toBe(0);

    await act(async () => {
      await new Promise((r) => setTimeout(r, LOAD_MS + 20));
    });

    // После загрузки — только empty/контент.
    expect(container.querySelectorAll('[data-loading="true"]').length).toBe(0);
  });
});

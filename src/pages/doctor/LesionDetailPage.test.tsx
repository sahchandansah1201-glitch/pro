import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LESION_COMPARISON_DRAFTS_STORAGE_KEY } from "@/lib/lesion-comparison-drafts";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
} from "@/lib/self-hosted-api-session";
import { CALIBRATED_VIEWER_QA_IDS, PROTECTED_RENDER_QA_IDS } from "@/lib/mock-data";
import LesionDetailPage from "./LesionDetailPage";

const j = (...p: string[]) => p.join("");
const FORBIDDEN = [
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("shared", "Link"),
  j("storage", "Path"),
  j("photo", "Ref"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("external", "User", "Ref"),
  j("protected", "Analysis", "Link"),
];

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id/lesions/:lesionId" element={<LesionDetailPage />} />
        <Route path="*" element={<div>fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

const selectComparePair = (...imageIds: string[]) => {
  for (const imageId of imageIds) {
    const row = document.querySelector<HTMLElement>(`[data-image-id="${imageId}"]`);
    if (!row) throw new Error(`Image row not found: ${imageId}`);
    fireEvent.click(within(row).getByRole("button", { name: /Сравнить/ }));
  }
};

describe("LesionDetailPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("p-004/l-008: показывает образование, снимки и ссылку на визит", () => {
    renderAt("/patients/p-004/lesions/l-008");
    expect(screen.getByText(/Очаг B/)).toBeInTheDocument();
    // Текущий визит содержит пару снимков; технические image IDs не выводятся врачу.
    expect(document.querySelector('[data-image-id="i-011"]')).toBeTruthy();
    expect(document.querySelector('[data-image-id="i-012"]')).toBeTruthy();
    expect(screen.getAllByText(/Снимок 09\.03\.2026/).length).toBeGreaterThan(0);
    expect(screen.getByText("Оценка врача")).toBeInTheDocument();
    expect(screen.queryByText("a-005")).toBeNull();
    // ссылка на визит
    const link = screen.getAllByRole("link", { name: /визит/i }).find((a) =>
      a.getAttribute("href")?.includes("/patients/p-004/visits/v-005"),
    );
    expect(link).toBeTruthy();
    expect(screen.queryByText(/таймлайн снимков, сравнение/i)).toBeNull();
  });

  it("shows a longitudinal lesion history across visits with technical comparison boundaries", () => {
    renderAt("/patients/p-004/lesions/l-008");

    const history = screen.getByRole("region", { name: /Продольная история очага/ });
    expect(within(history).getByText(/Визитов с фото: 2/)).toBeInTheDocument();
    expect(within(history).getByText(/Снимков: 4/)).toBeInTheDocument();
    expect(within(history).getByText(/Сопоставимых пар: 1/)).toBeInTheDocument();
    expect(within(history).getByText(/Ограничений: 1/)).toBeInTheDocument();
    expect(within(history).getByText(/Визит 20\.02\.2026/)).toBeInTheDocument();
    expect(within(history).getByText(/Визит 09\.03\.2026/)).toBeInTheDocument();
    expect(history.textContent ?? "").not.toMatch(/\bv-011\b|\bv-005\b/);
    expect(within(history).getAllByText(/Снимок 20\.02\.2026 → Снимок 09\.03\.2026/).length).toBeGreaterThan(0);
    expect(within(history).getByText(/Сопоставимо с предупреждением/)).toBeInTheDocument();
    expect(within(history).getByText(/Не сопоставимо/)).toBeInTheDocument();
    expect(within(history).getByText(/Не является оценкой динамики или клиническим выводом/)).toBeInTheDocument();
    expect(history.textContent ?? "").not.toMatch(
      /storagePath|photoRef|heatmapRef|modelVersion|sharedLink|token|session|меланома|рак кожи|вероятность/i,
    );
  });

  it("shows a longitudinal QA gate before dynamic interpretation", () => {
    renderAt("/patients/p-004/lesions/l-008");

    const qaGate = screen.getByRole("region", { name: /Готовность продольной проверки/ });
    expect(within(qaGate).getByText(/Динамика заблокирована/)).toBeInTheDocument();
    expect(within(qaGate).getByText(/Технически готово/)).toBeInTheDocument();
    expect(within(qaGate).getByText(/Нужен переснимок/)).toBeInTheDocument();
    expect(within(qaGate).getByText(/Не создаёт вывод о динамике/)).toBeInTheDocument();
    expect(within(qaGate).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();
    expect(qaGate.textContent ?? "").not.toMatch(
      /storagePath|photoRef|heatmapRef|modelVersion|sharedLink|token|session|меланома|рак кожи|вероятность/i,
    );
  });

  it("loads longitudinal readiness gate from clinic system without protected identifiers", async () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            patientId: PROTECTED_RENDER_QA_IDS.patientId,
            lesionId: PROTECTED_RENDER_QA_IDS.lesionId,
            label: "Очаг защищённого доступа",
            readiness: {
              status: "technical_ready",
              visitCount: 2,
              imageCount: 4,
              candidatePairCount: 2,
              reviewedPairCount: 2,
              technicalReadyPairCount: 2,
              needsRecaptureCount: 0,
              notSuitableForComparisonCount: 0,
              unreviewedPairCount: 0,
              missingCaptureMetadataCount: 0,
              calibrationBlockedCount: 0,
              markerMissingCount: 0,
              technicalRolloutReady: true,
              dynamicConclusionAllowed: true,
            },
            blockers: [],
            nextActions: ["continue_review"],
            boundaries: {
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              pairKeysExposed: true,
              imageIdsExposed: true,
              storagePathsExposed: true,
              signedUrlsIssued: true,
              rawImageBytesExposed: true,
              doctorOnlyTextExposed: true,
              clinicalConclusionGenerated: true,
            },
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderAt(`/patients/${PROTECTED_RENDER_QA_IDS.patientId}/lesions/${PROTECTED_RENDER_QA_IDS.lesionId}`);

    const qaGate = screen.getByRole("region", { name: /Готовность продольной проверки/ });
    fireEvent.click(within(qaGate).getByRole("button", { name: /Обновить рабочую проверку/ }));

    expect(await within(qaGate).findByText(/Рабочая проверка обновлена/)).toBeInTheDocument();
    expect(within(qaGate).getByText(/Техническая проверка готова/)).toBeInTheDocument();
    expect(within(qaGate).getByText(/Вывод о динамике: выключен/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/api/v1/patients/${PROTECTED_RENDER_QA_IDS.patientId}/lesions/${PROTECTED_RENDER_QA_IDS.lesionId}/longitudinal-qa`,
      expect.objectContaining({ method: "GET" }),
    );
    expect(qaGate.textContent ?? "").not.toMatch(
      /pairKey|imageIds|i-011|i-012|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|меланома|рак кожи|вероятность/i,
    );
  });

  it("p-004/l-007: снимок есть, но структурированной оценки нет", () => {
    renderAt("/patients/p-004/lesions/l-007");
    expect(screen.getByText(/Послеоперационная зона/)).toBeInTheDocument();
    expect(document.querySelector('[data-image-id="i-010"]')).toBeTruthy();
    expect(
      screen.getByText(/Структурированная оценка не зафиксирована/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Оценок по образованию пока нет/)).toBeInTheDocument();
  });

  it("неизвестный lesionId — безопасный not-found", () => {
    renderAt("/patients/p-004/lesions/l-zzz");
    expect(screen.getByText(/Образование не найдено/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /К карточке пациента/i }),
    ).toBeInTheDocument();
  });

  it("неизвестный пациент — not-found", () => {
    renderAt("/patients/p-zzz/lesions/l-008");
    expect(screen.getByText(/Пациент не найден/)).toBeInTheDocument();
  });

  it("кнопки демо-действий меняют только локальное состояние", () => {
    renderAt("/patients/p-004/lesions/l-008");
    const row = document.querySelector<HTMLElement>('[data-image-id="i-011"]')!;
    const openBtn = within(row).getByRole("button", { name: /Открыть снимок/ });
    fireEvent.click(openBtn);
    expect(openBtn).toHaveAttribute("aria-pressed", "true");
    expect(within(row).getByText(/Открыт в просмотрщике/)).toBeInTheDocument();

    const compareBtn = within(row).getByRole("button", { name: /Сравнить/ });
    fireEvent.click(compareBtn);
    expect(compareBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("показывает связь данных, ленту дат и предупреждение о несопоставимых снимках", () => {
    renderAt("/patients/p-004/lesions/l-008");

    expect(screen.getByText(/Связь данных/)).toBeInTheDocument();
    expect(screen.getByText(/Карта, снимки и отчёт связаны/)).toBeInTheDocument();
    expect(screen.getAllByText(/Служебный код скрыт/i).length).toBeGreaterThan(0);
    expect(screen.queryByText("l-008")).toBeNull();
    expect(screen.getByText(/Лента дат очага/)).toBeInTheDocument();
    expect(screen.getAllByText(/FotoFinder Handyscope/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/без устройства/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/С предупреждением/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Нужен переснимок/).length).toBeGreaterThan(0);

    selectComparePair("i-011", "i-012");

    expect(screen.getByText(/Сравнение по датам/)).toBeInTheDocument();
    expect(screen.getByText(/условия съёмки не сопоставимы/i)).toBeInTheDocument();
  });

  it("shows a richer Comparison Matrix with capture-condition differences and safety boundary", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const matrix = screen.getByRole("table", { name: /Матрица сравнения/ });
    expect(within(matrix).getAllByText(/Снимок A/).length).toBeGreaterThan(0);
    expect(within(matrix).getAllByText(/Снимок B/).length).toBeGreaterThan(0);
    expect(within(matrix).getByText(/Внутренний код скрыт/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Дата/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Тип снимка/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Источник/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Устройство/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Качество/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Сопоставимость/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Разные условия съёмки/)).toBeInTheDocument();
    expect(screen.getByText(/Нельзя оценивать динамику без врачебной проверки/i)).toBeInTheDocument();
  });

  it("turns a non-comparable image pair into doctor actions without unsafe copy", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const review = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    expect(within(review).getByText(/Техническая сопоставимость/)).toBeInTheDocument();
    expect(within(review).getAllByText(/Не сопоставимо/).length).toBeGreaterThan(0);
    expect(within(review).getByText(/Разные условия съёмки/)).toBeInTheDocument();
    expect(within(review).getByText(/Есть технические замечания/)).toBeInTheDocument();
    expect(within(review).getByText(/Не оценивайте динамику/i)).toBeInTheDocument();

    fireEvent.click(within(review).getByRole("button", { name: /Запросить переснимок/ }));
    expect(within(review).getAllByText(/Переснимок запрошен/).length).toBeGreaterThan(0);

    fireEvent.click(within(review).getByRole("button", { name: /Исключить из сравнения/ }));
    expect(within(review).getAllByText(/Пара исключена из сравнения/).length).toBeGreaterThan(0);

    fireEvent.click(within(review).getByRole("button", { name: /Добавить ограничение в отчёт/ }));
    expect(within(review).getAllByText(/Ограничение добавлено в черновик отчёта/).length).toBeGreaterThan(0);

    expect(review.textContent ?? "").not.toMatch(/меланома|рак кожи|вероятность меланомы|token|storage/i);
  });

  it("opens a full-screen comparison view for the selected pair", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const focus = within(dialog).getByRole("region", { name: /Рабочий шаг сравнения/ });
    expect(within(focus).getByText(/Что делать сейчас/)).toBeInTheDocument();
    expect(within(focus).getByText(/Следующий шаг: Закрыть условия съёмки/)).toBeInTheDocument();
    expect(within(focus).getByText(/Ближайшее действие:/)).toBeInTheDocument();
    expect(within(focus).getAllByText(/Открыть контроль условий/).length).toBeGreaterThan(0);
    expect(within(focus).getByText(/Первое ограничение: Тип снимка · разный тип снимка/)).toBeInTheDocument();
    expect(within(focus).getByText(/Прогресс проверки: 1\/8/)).toBeInTheDocument();
    expect(within(focus).getByRole("link", { name: /Открыть контроль условий/ })).toHaveAttribute(
      "href",
      "#comparison-capture-qa",
    );
    expect(within(focus).getByRole("list", { name: /Этапы сравнения снимков/ })).toBeInTheDocument();
    expect(within(dialog).getByText(/Снимок A/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Снимок B/)).toBeInTheDocument();
    expect(dialog.textContent ?? "").not.toContain("i-011");
    expect(dialog.textContent ?? "").not.toContain("i-012");
    expect(within(dialog).getByText(/Условия съёмки/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Техническая сопоставимость/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Не сопоставимо/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Не оценивайте динамику/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /Запросить переснимок/ }));
    expect(within(dialog).getByText(/Переснимок запрошен/)).toBeInTheDocument();

    expect(dialog.textContent ?? "").not.toMatch(/меланома|рак кожи|вероятность меланомы|token|storage/i);
  });

  it("shows capture-condition QA details without clinical conclusions", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const captureQa = within(dialog).getByRole("region", { name: /Контроль условий съёмки/ });

    expect(within(captureQa).getByText(/Контроль условий съёмки/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/Итог: нужна повторяемая съёмка/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/Тип снимка/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/разный тип снимка/i)).toBeInTheDocument();
    expect(within(captureQa).getByText(/Источник/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/разные источники/i)).toBeInTheDocument();
    expect(within(captureQa).getByText(/Устройство/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/FotoFinder Handyscope \/ без устройства/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/Качество/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/минимум 67%/i)).toBeInTheDocument();
    expect(within(captureQa).getByText(/Замечания качества/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/размытие, тени/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/Не является клинической оценкой динамики/)).toBeInTheDocument();
    expect(captureQa.textContent ?? "").not.toMatch(/меланома|рак кожи|вероятность меланомы|лечение|token|storage/i);
  });

  it("marks same-device QA UUID previews as technically repeatable", () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    renderAt(
      `/patients/${PROTECTED_RENDER_QA_IDS.patientId}/lesions/${PROTECTED_RENDER_QA_IDS.lesionId}`,
    );

    selectComparePair(PROTECTED_RENDER_QA_IDS.imageAId, PROTECTED_RENDER_QA_IDS.imageBId);
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const captureQa = within(dialog).getByRole("region", { name: /Контроль условий съёмки/ });

    expect(within(captureQa).getByText(/Итог: условия технически повторяемы/)).toBeInTheDocument();
    expect(within(captureQa).getByText(/один тип снимка/i)).toBeInTheDocument();
    expect(within(captureQa).getByText(/один источник/i)).toBeInTheDocument();
    expect(within(captureQa).getByText(/одно устройство/i)).toBeInTheDocument();
    expect(within(captureQa).getByText(/минимум 89%/i)).toBeInTheDocument();
    expect(within(captureQa).getByText(/нет замечаний качества/i)).toBeInTheDocument();
    expect(captureQa.textContent ?? "").not.toMatch(/меланома|рак кожи|вероятность меланомы|лечение|token|storage/i);
  });

  it("supports local zoom, pan and technical annotation in full-screen comparison without patient delivery", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    expect(within(tools).getByText(/Масштаб 100%/)).toBeInTheDocument();
    expect(within(tools).getByText(/Смещение x0 \/ y0/)).toBeInTheDocument();
    expect(within(tools).getByText(/Измерения отключены/)).toBeInTheDocument();
    expect(within(tools).getByText(/Защищённые превью врача/)).toBeInTheDocument();
    expect(within(tools).getByRole("button", { name: /Подготовить защищённые превью/ })).toBeDisabled();
    expect(within(tools).getByText(/Система клиники не подключена/)).toBeInTheDocument();

    fireEvent.click(within(tools).getByRole("button", { name: /Увеличить/ }));
    fireEvent.click(within(tools).getByRole("button", { name: /Сместить вправо/ }));
    expect(within(tools).getByText(/Масштаб 125%/)).toBeInTheDocument();
    expect(within(tools).getByText(/Смещение x\+12 \/ y0/)).toBeInTheDocument();

    fireEvent.click(within(tools).getByRole("button", { name: /Показать центр/ }));
    expect(within(tools).getByText(/Разметка: центр/)).toBeInTheDocument();

    const note = within(tools).getByLabelText(/Техническая заметка/);
    fireEvent.change(note, { target: { value: "Разный угол и мягкий фокус, нужна повторяемая съёмка." } });
    fireEvent.click(within(tools).getByRole("button", { name: /Зафиксировать техническую заметку/ }));
    expect(within(tools).getByText(/Техническая заметка зафиксирована локально/)).toBeInTheDocument();
    expect(within(tools).getAllByText(/Выдача пациенту: выключена/).length).toBeGreaterThan(0);

    expect(dialog.textContent ?? "").not.toMatch(
      /меланома|рак кожи|вероятность меланомы|лечение|token|storage|signedUrl|photoRef|modelVersion/i,
    );
  });

  it("supports normalized technical geometry markers without medical measurement", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    const geometry = within(tools).getByRole("region", { name: /Техническая геометрия/ });

    expect(within(geometry).getByText(/Маркеры: 0\/2/)).toBeInTheDocument();
    expect(within(geometry).getByText(/Координаты нормализованы: проценты кадра/)).toBeInTheDocument();

    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер A/ }));
    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер B/ }));

    expect(within(geometry).getByText(/Маркеры: 2\/2/)).toBeInTheDocument();
    expect(within(geometry).getByText(/A x48 y52/)).toBeInTheDocument();
    expect(within(geometry).getByText(/B x52 y52/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Технический маркер A · x48 y52/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Технический маркер B · x52 y52/)).toBeInTheDocument();
    expect(within(geometry).getByText(/Не является медицинским измерением/)).toBeInTheDocument();
    expect(within(geometry).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();

    fireEvent.click(within(geometry).getByRole("button", { name: /Очистить маркеры/ }));
    expect(within(geometry).getByText(/Маркеры: 0\/2/)).toBeInTheDocument();

    expect(dialog.textContent ?? "").not.toMatch(
      /меланома|рак кожи|вероятность меланомы|лечение|token|storage|signedUrl|photoRef|modelVersion|patientSafeText/i,
    );
  });

  it("shows calibration readiness gates without enabling measurements", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    const calibration = within(tools).getByRole("region", { name: /Калибровка просмотра/ });

    expect(within(calibration).getByText(/Калибровка: не готова/)).toBeInTheDocument();
    expect(within(calibration).getByText(/Профиль устройства/)).toBeInTheDocument();
    expect(within(calibration).getByText(/FotoFinder Handyscope \/ без устройства/)).toBeInTheDocument();
    expect(within(calibration).getByText(/Размер кадра/)).toBeInTheDocument();
    expect(within(calibration).getByText(/2048×2048 \/ 3000×2000/)).toBeInTheDocument();
    expect(within(calibration).getByText(/Масштабная шкала/)).toBeInTheDocument();
    expect(within(calibration).getByText(/шкала не обнаружена/)).toBeInTheDocument();
    expect(within(calibration).getByText(/Измерения в миллиметрах недоступны/)).toBeInTheDocument();
    expect(within(calibration).getByText(/Не используйте маркеры как размер очага/)).toBeInTheDocument();
    expect(within(calibration).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();

    fireEvent.click(within(calibration).getByRole("button", { name: /Зафиксировать ограничение калибровки/ }));
    expect(within(calibration).getByText(/Ограничение калибровки зафиксировано локально/)).toBeInTheDocument();

    expect(dialog.textContent ?? "").not.toMatch(
      /меланома|рак кожи|вероятность меланомы|лечение|token|storage|signedUrl|photoRef|modelVersion|patientSafeText/i,
    );
  });

  it("saves technical marker and calibration QA to self-hosted backend without patient delivery", async () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-1",
            visitId: "v-005",
            lesionId: "l-008",
            pairKey: "l-008:i-011+i-012",
            imageIds: ["i-011", "i-012"],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
            calibrationStatus: "not_ready",
            calibrationReasons: ["scale_marker_missing"],
            captureMetadataStatus: "needs_review",
            medicalMeasurementAllowed: false,
            patientDeliveryAllowed: false,
            protectedFieldsExposed: false,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    const geometry = within(tools).getByRole("region", { name: /Техническая геометрия/ });
    const calibration = within(tools).getByRole("region", { name: /Калибровка просмотра/ });

    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер A/ }));
    fireEvent.click(within(calibration).getByRole("button", { name: /Зафиксировать ограничение калибровки/ }));

    expect(await within(calibration).findByText(/Проверка просмотра сохранена в системе клиники/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/v-005/lesion-comparison-viewer-qa",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.stringify(fetchMock.mock.calls[0]?.[1]);
    expect(body).toContain("technicalMarkers");
    expect(body).toContain("scale_marker_missing");
    expect(body).not.toMatch(
      /storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи/i,
    );
    expect(dialog.textContent ?? "").toMatch(/Выдача пациенту: выключена/);
  });

  it("persists a technical viewing review after saving the viewing check", async () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-1",
            visitId: "v-005",
            lesionId: "l-008",
            pairKey: "l-008:i-011+i-012",
            imageIds: ["i-011", "i-012"],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
            calibrationStatus: "not_ready",
            calibrationReasons: ["scale_marker_missing"],
            captureMetadataStatus: "needs_review",
            review: url.includes("/review")
              ? {
                  status: "needs_recapture",
                  reasons: ["repeat_capture_required"],
                  reviewedAt: "2026-05-19T10:50:00.000Z",
                  reviewedByUserId: "doctor-1",
                }
              : { status: "unreviewed", reasons: [], reviewedAt: null, reviewedByUserId: null },
            medicalMeasurementAllowed: false,
            patientDeliveryAllowed: false,
            protectedFieldsExposed: false,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    const geometry = within(tools).getByRole("region", { name: /Техническая геометрия/ });
    const review = within(tools).getByRole("region", { name: /Технический разбор просмотра/ });

    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер A/ }));
    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер B/ }));
    fireEvent.click(within(review).getByRole("button", { name: /Нужен переснимок/ }));

    expect(await within(review).findByText(/Технический разбор просмотра сохранён в системе клиники/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3001/api/v1/visits/v-005/lesion-comparison-viewer-qa",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://localhost:3001/api/v1/visits/v-005/lesion-comparison-viewer-qa/review",
      expect.objectContaining({ method: "PATCH" }),
    );
    const reviewBody = JSON.stringify(fetchMock.mock.calls[1]?.[1]);
    expect(reviewBody).toContain("needs_recapture");
    expect(reviewBody).toContain("repeat_capture_required");
    expect(reviewBody).not.toMatch(
      /storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи|patientSafeText/i,
    );
    expect(within(review).getByText(/Решение техническое: не диагноз, не динамика, не измерение/)).toBeInTheDocument();
    expect(within(review).getAllByText(/Выдача пациенту: выключена/).length).toBeGreaterThan(0);
  });

  it("keeps clinic-system previews non-calibrated until a scale marker exists", () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    renderAt(
      `/patients/${PROTECTED_RENDER_QA_IDS.patientId}/lesions/${PROTECTED_RENDER_QA_IDS.lesionId}`,
    );

    selectComparePair(PROTECTED_RENDER_QA_IDS.imageAId, PROTECTED_RENDER_QA_IDS.imageBId);
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    const calibration = within(tools).getByRole("region", { name: /Калибровка просмотра/ });

    expect(within(calibration).getByText(/Калибровка: не готова/)).toBeInTheDocument();
    expect(within(calibration).getByText(/одно устройство: FotoFinder Handyscope/)).toBeInTheDocument();
    expect(within(calibration).getByText(/один размер: 2048×2048/)).toBeInTheDocument();
    expect(within(calibration).getByText(/шкала не обнаружена/)).toBeInTheDocument();
    expect(within(calibration).getAllByText(/миллиметры недоступны/).length).toBeGreaterThan(0);

    expect(dialog.textContent ?? "").not.toMatch(
      /меланома|рак кожи|вероятность меланомы|лечение|token|storage|signedUrl|photoRef|modelVersion|patientSafeText/i,
    );
  });

  it("accepts clinical-grade reviewer workflow only after calibrated technical review gates", async () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const reviewerWorkflow = url.endsWith("/reviewer-workflow")
        ? {
            status: "reviewer_accepted",
            reasons: ["calibrated_reviewer_workflow_ready"],
            reviewedAt: "2026-05-19T10:55:00.000Z",
            reviewedByUserId: "doctor-1",
            gate: {
              technicalReviewReady: true,
              calibrationReady: true,
              captureMetadataReady: true,
              markerGateReady: true,
              measurementPolicyApproved: true,
              productionAnalysisPolicyApproved: true,
              reviewerAssignmentReady: true,
              secondReviewReady: true,
              medicalMeasurementAllowed: true,
              patientDeliveryAllowed: true,
              clinicalConclusionGenerated: true,
            },
          }
        : {
            status: "technical_gate_blocked",
            reasons: [],
            reviewedAt: null,
            reviewedByUserId: null,
            gate: {
              technicalReviewReady: false,
              calibrationReady: true,
              captureMetadataReady: true,
              markerGateReady: true,
              measurementPolicyApproved: url.endsWith("/measurement-policy"),
              productionAnalysisPolicyApproved: url.endsWith("/production-analysis-policy"),
              reviewerAssignmentReady: url.endsWith("/reviewer-assignment"),
              secondReviewReady: url.endsWith("/reviewer-assignment"),
              medicalMeasurementAllowed: false,
              patientDeliveryAllowed: false,
              clinicalConclusionGenerated: false,
            },
          };
      return new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-calibrated",
            visitId: CALIBRATED_VIEWER_QA_IDS.visitId,
            lesionId: CALIBRATED_VIEWER_QA_IDS.lesionId,
            pairKey: `${CALIBRATED_VIEWER_QA_IDS.lesionId}:${CALIBRATED_VIEWER_QA_IDS.imageAId}+${CALIBRATED_VIEWER_QA_IDS.imageBId}`,
            imageIds: [CALIBRATED_VIEWER_QA_IDS.imageAId, CALIBRATED_VIEWER_QA_IDS.imageBId],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
            calibrationStatus: "ready",
            calibrationReasons: [],
            captureMetadataStatus: "ready",
            review: url.endsWith("/review") || url.endsWith("/reviewer-workflow")
              ? {
                  status: "technical_ready",
                  reasons: ["technical_review_ready"],
                  reviewedAt: "2026-05-19T10:50:00.000Z",
                  reviewedByUserId: "doctor-1",
                }
              : { status: "unreviewed", reasons: [], reviewedAt: null, reviewedByUserId: null },
            reviewerWorkflow,
            measurementPolicy: url.endsWith("/measurement-policy") || url.endsWith("/reviewer-workflow")
              || url.endsWith("/reviewer-assignment")
              || url.endsWith("/production-analysis-policy")
              ? {
                  status: "approved_for_technical_review",
                  reasons: ["technical_measurement_policy_approved_no_mm_output"],
                  reviewedAt: "2026-05-19T10:53:00.000Z",
                  reviewedByUserId: "doctor-1",
                  medicalMeasurementAllowed: true,
                  patientDeliveryAllowed: true,
                  clinicalOutputGenerated: true,
                }
              : {
                  status: "not_approved",
                  reasons: [],
                  reviewedAt: null,
                  reviewedByUserId: null,
                  medicalMeasurementAllowed: false,
                  patientDeliveryAllowed: false,
                  clinicalOutputGenerated: false,
                },
            productionAnalysisPolicy: url.endsWith("/production-analysis-policy") || url.endsWith("/reviewer-workflow")
              ? {
                  status: "approved_for_production_analysis",
                  reasons: ["production_analysis_policy_approved_no_dynamic_conclusion"],
                  reviewedAt: "2026-05-19T11:04:00.000Z",
                  reviewedByUserId: "doctor-1",
                  medicalMeasurementAllowed: true,
                  patientDeliveryAllowed: true,
                  clinicalOutputGenerated: true,
                }
              : {
                  status: "not_approved",
                  reasons: [],
                  reviewedAt: null,
                  reviewedByUserId: null,
                  medicalMeasurementAllowed: false,
                  patientDeliveryAllowed: false,
                  clinicalOutputGenerated: false,
                },
            reviewerAssignment: url.endsWith("/reviewer-assignment") || url.endsWith("/reviewer-workflow")
              || url.endsWith("/production-analysis-policy")
              ? {
                  status: "second_review_completed",
                  reasons: ["second_review_required_for_clinical_grade_workflow"],
                  assignedAt: "2026-05-19T10:57:00.000Z",
                  reviewerIdentityExposed: true,
                  patientDeliveryAllowed: true,
                  medicalMeasurementAllowed: true,
                }
              : {
                  status: "unassigned",
                  reasons: [],
                  assignedAt: null,
                  reviewerIdentityExposed: false,
                  patientDeliveryAllowed: false,
                  medicalMeasurementAllowed: false,
                },
            secondReview: url.endsWith("/reviewer-assignment") || url.endsWith("/reviewer-workflow")
              || url.endsWith("/production-analysis-policy")
              ? {
                  status: "completed",
                  reasons: ["second_review_completed_metadata_only"],
                  reviewedAt: "2026-05-19T10:58:00.000Z",
                  reviewerIdentityExposed: true,
                  patientDeliveryAllowed: true,
                  medicalMeasurementAllowed: true,
                }
              : {
                  status: "not_required",
                  reasons: [],
                  reviewedAt: null,
                  reviewerIdentityExposed: false,
                  patientDeliveryAllowed: false,
                  medicalMeasurementAllowed: false,
                },
            medicalMeasurementAllowed: true,
            patientDeliveryAllowed: true,
            protectedFieldsExposed: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAt(
      `/patients/${CALIBRATED_VIEWER_QA_IDS.patientId}/lesions/${CALIBRATED_VIEWER_QA_IDS.lesionId}`,
    );

    selectComparePair(CALIBRATED_VIEWER_QA_IDS.imageAId, CALIBRATED_VIEWER_QA_IDS.imageBId);
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    const geometry = within(tools).getByRole("region", { name: /Техническая геометрия/ });
    const calibration = within(tools).getByRole("region", { name: /Калибровка просмотра/ });
    const review = within(tools).getByRole("region", { name: /Технический разбор просмотра/ });
    const policy = within(tools).getByRole("region", { name: /Политика измерений/ });
    const assignment = within(tools).getByRole("region", { name: /Назначение проверяющего/ });
    const analysisPolicy = within(tools).getByRole("region", { name: /Правила рабочего анализа/ });
    const workflow = within(tools).getByRole("region", { name: /Врачебный порядок проверки/ });

    expect(within(calibration).getByText(/Калибровка: готова/)).toBeInTheDocument();
    expect(within(calibration).getByText(/шкала обнаружена/)).toBeInTheDocument();
    expect(within(calibration).getByText(/миллиметры доступны для проверки просмотра/)).toBeInTheDocument();
    expect(within(workflow).getByText(/Проверка: заблокирована/)).toBeInTheDocument();

    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер A/ }));
    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер B/ }));
    fireEvent.click(within(review).getByRole("button", { name: /^Технически готово$/ }));
    expect(await within(review).findByText(/Технический разбор просмотра сохранён в системе клиники/)).toBeInTheDocument();
    expect(within(workflow).getByText(/Проверка: заблокирована/)).toBeInTheDocument();

    fireEvent.click(within(policy).getByRole("button", { name: /Утвердить технические правила/ }));
    expect(await within(policy).findByText(/Правила измерений сохранены в системе клиники/)).toBeInTheDocument();
    expect(within(policy).getByText(/Измерения остаются выключены/)).toBeInTheDocument();
    expect(within(workflow).getByText(/Проверка: заблокирована/)).toBeInTheDocument();

    fireEvent.click(within(assignment).getByRole("button", { name: /Повторная проверка завершена/ }));
    expect(await within(assignment).findByText(/Назначение проверяющего сохранено в системе клиники/)).toBeInTheDocument();
    expect(within(assignment).getByText(/контакты проверяющего.*не выводятся/i)).toBeInTheDocument();
    expect(within(workflow).getByText(/Проверка: заблокирована/)).toBeInTheDocument();

    fireEvent.click(within(analysisPolicy).getByRole("button", { name: /Утвердить правила анализа/ }));
    expect(await within(analysisPolicy).findByText(/Правила анализа сохранены в системе клиники/)).toBeInTheDocument();
    expect(within(analysisPolicy).getByText(/Клинический вывод о динамике: выключен/)).toBeInTheDocument();
    expect(within(workflow).getByText(/Проверка: готова/)).toBeInTheDocument();

    fireEvent.click(within(workflow).getByRole("button", { name: /Порядок проверки принят/ }));
    expect(await within(workflow).findByText(/Врачебный порядок проверки сохранён в системе клиники/)).toBeInTheDocument();
    expect(dialog.textContent ?? "").not.toContain(CALIBRATED_VIEWER_QA_IDS.imageAId);
    expect(dialog.textContent ?? "").not.toContain(CALIBRATED_VIEWER_QA_IDS.imageBId);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/api/v1/visits/${CALIBRATED_VIEWER_QA_IDS.visitId}/lesion-comparison-viewer-qa/reviewer-workflow`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/api/v1/visits/${CALIBRATED_VIEWER_QA_IDS.visitId}/lesion-comparison-viewer-qa/measurement-policy`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/api/v1/visits/${CALIBRATED_VIEWER_QA_IDS.visitId}/lesion-comparison-viewer-qa/reviewer-assignment`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/api/v1/visits/${CALIBRATED_VIEWER_QA_IDS.visitId}/lesion-comparison-viewer-qa/production-analysis-policy`,
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(
      /storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи|diagnosis|treatment|dynamicConclusion|clinicalDynamicConclusion|patientSafeText/i,
    );
    expect(within(workflow).getByText(/Не диагноз, не динамика, не медицинское измерение/)).toBeInTheDocument();
    expect(within(workflow).getAllByText(/Выдача пациенту: выключена/).length).toBeGreaterThan(0);
  });

  it("loads protected previews from the production UUID QA fixture through backend proxy", async () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    const previewUrls = ["blob:protected-preview-a", "blob:protected-preview-b"];
    const createObjectURL = vi.fn(() => previewUrls.shift() ?? "blob:protected-preview-fallback");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderAt(
      `/patients/${PROTECTED_RENDER_QA_IDS.patientId}/lesions/${PROTECTED_RENDER_QA_IDS.lesionId}`,
    );

    selectComparePair(PROTECTED_RENDER_QA_IDS.imageAId, PROTECTED_RENDER_QA_IDS.imageBId);
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    const readiness = within(tools).getByRole("region", { name: /Готовность закрытого просмотра/ });
    expect(within(readiness).getByText(/Вход в систему клиники/)).toBeInTheDocument();
    expect(within(readiness).getByText(/Внутренние коды/)).toBeInTheDocument();
    expect(within(readiness).getByText(/Защищённая передача/)).toBeInTheDocument();
    expect(within(readiness).getByText(/Выдача пациенту/)).toBeInTheDocument();

    const loadButton = within(tools).getByRole("button", { name: /Подготовить защищённые превью/ });
    expect(loadButton).not.toBeDisabled();
    fireEvent.click(loadButton);

    expect(await within(tools).findByText(/Защищённые превью загружены через систему клиники/)).toBeInTheDocument();
    expect(within(dialog).getByAltText(/Защищённый снимок A/)).toHaveAttribute("src", "blob:protected-preview-a");
    expect(within(dialog).getByAltText(/Защищённый снимок B/)).toHaveAttribute("src", "blob:protected-preview-b");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/api/v1/patients/${PROTECTED_RENDER_QA_IDS.patientId}/lesions/${PROTECTED_RENDER_QA_IDS.lesionId}/images/${PROTECTED_RENDER_QA_IDS.imageAId}/render`,
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      `http://localhost:3001/api/v1/patients/${PROTECTED_RENDER_QA_IDS.patientId}/lesions/${PROTECTED_RENDER_QA_IDS.lesionId}/images/${PROTECTED_RENDER_QA_IDS.imageBId}/render`,
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(dialog.textContent ?? "").not.toMatch(
      /storagePath|object_bucket|object_key|signed_url|qrToken|sessionId|doctorVersionText|patientSafeText|меланома|рак кожи/i,
    );

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:protected-preview-a");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:protected-preview-b");
  });

  it("persists a structured doctor comparison draft without patient delivery", () => {
    const { unmount } = renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const review = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    fireEvent.click(within(review).getByRole("button", { name: /Запросить переснимок/ }));
    fireEvent.click(within(review).getByRole("button", { name: /Сохранить черновик решения/ }));

    expect(within(review).getByText(/Черновик решения сохранён/)).toBeInTheDocument();
    expect(within(review).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();
    expect(window.localStorage.getItem(LESION_COMPARISON_DRAFTS_STORAGE_KEY)).toContain("retake");
    expect(window.localStorage.getItem(LESION_COMPARISON_DRAFTS_STORAGE_KEY) ?? "").not.toMatch(
      /storagePath|photoRef|heatmapRef|modelVersion|sharedLink|token|session|меланома|рак кожи/i,
    );

    unmount();
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const restoredReview = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    expect(within(restoredReview).getByText(/Черновик решения загружен/)).toBeInTheDocument();
    expect(within(restoredReview).getAllByText(/Переснимок запрошен/).length).toBeGreaterThan(0);
    expect(within(restoredReview).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();
  });

  it("saves the comparison draft to self-hosted backend when the doctor session is configured", async () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "draft-1",
            visitId: "v-005",
            lesionId: "l-008",
            pairKey: "l-008:i-011+i-012",
            imageIds: ["i-011", "i-012"],
            action: "retake",
            comparability: "not_comparable",
            reasons: ["Разные условия съёмки"],
            patientDeliveryAllowed: false,
            protectedFieldsExposed: false,
            savedAt: "2026-06-02T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const review = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    fireEvent.click(within(review).getByRole("button", { name: /Запросить переснимок/ }));
    fireEvent.click(within(review).getByRole("button", { name: /Сохранить черновик решения/ }));

    expect(await within(review).findByText(/Журнал проверки сохранён в системе клиники/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/v-005/lesion-comparison-draft",
      expect.objectContaining({ method: "PATCH" }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(JSON.stringify(requestInit)).not.toMatch(
      /storagePath|photoRef|heatmapRef|modelVersion|sharedLink|token|session|меланома|рак кожи/i,
    );
  });

  it("links the lesion to the full Body Map in the source visit", () => {
    renderAt("/patients/p-004/lesions/l-008");

    const bodyMapLink = screen.getByRole("link", { name: /Открыть на карте тела/ });
    expect(bodyMapLink).toHaveAttribute(
      "href",
      "/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008",
    );
  });

  it("в DOM нет запрещённых токенов", () => {
    const { container } = renderAt("/patients/p-004/lesions/l-008");
    const html = container.innerHTML;
    for (const t of FORBIDDEN) {
      expect(html, `forbidden token ${t}`).not.toContain(t);
    }
    expect(html).not.toMatch(/mock:\/\//);
  });
});

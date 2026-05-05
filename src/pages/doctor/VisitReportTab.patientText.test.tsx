import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VisitWorkspacePage from "./VisitWorkspacePage";
import {
  normalizePatientText,
  validatePatientText,
  PATIENT_TEXT_MAX_CHARS,
  PATIENT_TEXT_MAX_LINES,
  PATIENT_TEXT_MAX_LINE_LEN,
} from "./VisitReportTab";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
        <Route path="*" element={<div>fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("normalizePatientText", () => {
  it("normalizes CRLF and CR to LF", () => {
    expect(normalizePatientText("a\r\nb\rc")).toBe("a\nb\nc");
  });
  it("collapses 3+ blank lines to 2 newlines (one empty line)", () => {
    expect(normalizePatientText("a\n\n\n\nb")).toBe("a\n\nb");
  });
  it("strips trailing spaces and outer blank lines, replaces NBSP", () => {
    const input = "\n  hello \u00A0world  \n\n  bye  \n";
    expect(normalizePatientText(input)).toBe("  hello  world\n\n  bye");
  });
});

describe("validatePatientText", () => {
  it("rejects empty input", () => {
    const r = validatePatientText("   ");
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/не может быть пустым/);
  });
  it("rejects < and > characters", () => {
    const r = validatePatientText("hello <script>");
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/Символы.*запрещены/);
  });
  it("rejects too many lines", () => {
    const r = validatePatientText(
      Array.from({ length: PATIENT_TEXT_MAX_LINES + 1 }, (_, i) => `l${i}`).join("\n"),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/строк/);
  });
  it("rejects too long line", () => {
    const r = validatePatientText("a".repeat(PATIENT_TEXT_MAX_LINE_LEN + 1));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/в одной строке/i);
  });
  it("rejects too many chars overall", () => {
    const longLine = "a".repeat(PATIENT_TEXT_MAX_LINE_LEN);
    const r = validatePatientText(
      Array.from({ length: 10 }, () => longLine).join("\n"),
    );
    expect(r.ok).toBe(false);
    expect(r.chars).toBeGreaterThan(PATIENT_TEXT_MAX_CHARS);
  });
  it("accepts valid text and reports counters", () => {
    const r = validatePatientText("Здравствуйте.\nЖдём вас на приём.");
    expect(r.ok).toBe(true);
    expect(r.lines).toBe(2);
    expect(r.chars).toBeGreaterThan(0);
  });
});

describe("VisitReportTab · patient text editor", () => {
  const path = "/patients/p-004/visits/v-005?tab=report&lesion=l-008";

  it("template buttons replace and append patient text; counters update", () => {
    renderAt(path);
    fireEvent.click(screen.getByTestId("tpl-monitoring-replace"));
    const textarea = screen.getByLabelText(/Текст для пациента/) as HTMLTextAreaElement;
    expect(textarea.value).toMatch(/повторный осмотр через 3 месяца/);

    const counter = screen.getByTestId("patient-text-counter");
    expect(counter.textContent).toMatch(/симв\./);
    expect(counter.textContent).toMatch(/строк/);

    fireEvent.click(screen.getByTestId("tpl-urgent-append"));
    expect(textarea.value).toMatch(/повторный осмотр через 3 месяца/);
    expect(textarea.value).toMatch(/в ближайшие дни/);
  });

  it("shows validation error for forbidden < character and disables Save", () => {
    renderAt(path);
    const textarea = screen.getByLabelText(/Текст для пациента/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "плохо <b>тег" } });

    const errors = screen.getByTestId("patient-text-errors");
    expect(within(errors).getByText(/Символы.*запрещены/)).toBeInTheDocument();

    const saveBtn = screen.getByRole("button", {
      name: /Сформировать демо-отчёт/,
    }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const sendBtn = screen.getByRole("button", {
      name: /Отправить пациенту \(демо\)/,
    }) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
  });

  it("normalize button collapses excess blank lines and CRLF in textarea", () => {
    renderAt(path);
    const textarea = screen.getByLabelText(/Текст для пациента/) as HTMLTextAreaElement;
    fireEvent.change(textarea, {
      target: { value: "a\r\n\r\n\r\n\r\nb   \n   " },
    });
    fireEvent.click(screen.getByTestId("patient-text-normalize"));
    expect(textarea.value).toBe("a\n\nb");
  });

  it("Отправить пациенту (демо) остаётся disabled даже после save и применения шаблона", () => {
    renderAt(path);
    fireEvent.click(screen.getByTestId("tpl-self-care-replace"));
    fireEvent.click(screen.getByRole("button", { name: /Сформировать демо-отчёт/ }));

    const sendBtn = screen.getByRole("button", {
      name: /Отправить пациенту \(демо\)/,
    }) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
  });
});

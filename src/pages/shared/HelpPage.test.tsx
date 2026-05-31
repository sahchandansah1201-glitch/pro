import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import HelpPage from "./HelpPage";

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
  j("suspected", "Features"),
  j("uncertainty", "Notes"),
  j("xai", "Notes"),
];

const NETWORK_TOKENS = [
  j("fetch", "("), j("ax", "ios"), j("XML", "Http", "Request"), j("send", "Beacon"),
  j("navigator", ".", "clipboard"), j("media", "Devices"), j("local", "Storage"), j("session", "Storage"),
];

const renderHelp = () =>
  render(
    <MemoryRouter initialEntries={["/help"]}>
      <Routes>
        <Route path="/help" element={<HelpPage />} />
        <Route path="*" element={<div>fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("HelpPage", () => {
  it("рендерит заголовок и баннер безопасности", () => {
    renderHelp();
    expect(screen.getByText("Справка")).toBeInTheDocument();
    expect(screen.getByText(/RoleGuard.+UX-симуляция/i)).toBeInTheDocument();
    expect(screen.getByText(/AI.+поддержка/i)).toBeInTheDocument();
    expect(screen.getByText(/Финальное медицинское решение/i)).toBeInTheDocument();
  });

  it("не показывает текст старого PlaceholderPage", () => {
    renderHelp();
    expect(screen.queryByText(/Документация по ролям и потокам\./)).toBeNull();
  });

  it("содержит ссылки на ключевые группы маршрутов", () => {
    renderHelp();
    const expected = ["/patients", "/capture", "/operator", "/admin", "/admin/governance", "/sys/users", "/me"];
    for (const path of expected) {
      const link = screen.getAllByRole("link").find((a) => a.getAttribute("href") === path);
      expect(link, `link for ${path}`).toBeTruthy();
    }
  });

  it("у всех навигационных ссылок есть href", () => {
    renderHelp();
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a.getAttribute("href")).toMatch(/^[/#]/);
    }
  });

  it("в DOM нет запрещённых токенов", () => {
    const { container } = renderHelp();
    const html = container.innerHTML;
    for (const t of FORBIDDEN) {
      expect(html, `forbidden token ${t}`).not.toContain(t);
    }
  });

  it("исходный код HelpPage и App.tsx не содержат сетевых API и запрещённых токенов", () => {
    const help = readFileSync(resolve(__dirname, "HelpPage.tsx"), "utf8");
    const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
    for (const src of [help, app]) {
      for (const t of FORBIDDEN) expect(src).not.toContain(t);
      for (const t of NETWORK_TOKENS) expect(src).not.toContain(t);
    }
  });

  it("App.tsx больше не импортирует HelpPage из Placeholders", () => {
    const app = readFileSync(resolve(__dirname, "../../App.tsx"), "utf8");
    expect(app).not.toMatch(/HelpPage[^"]*from\s+["'].*Placeholders/);
    expect(app).toMatch(/from\s+["']\.\/pages\/shared\/HelpPage["']/);
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";
import SelfHostedLoginPage from "./SelfHostedLoginPage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/self-hosted/login"]}>
      <Routes>
        <Route path="/self-hosted/login" element={<SelfHostedLoginPage />} />
        <Route path="/patients" element={<div data-testid="patients-route">Пациенты</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SelfHostedLoginPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders the self-hosted login form", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: "Вход в self-hosted backend" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Адрес backend")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Пароль")).toBeInTheDocument();
  });

  it("logs into the self-hosted backend, stores the session and redirects to /patients", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        stage: "4D",
        tokenType: "Bearer",
        accessToken: "jwt-1",
        expiresInSeconds: 3600,
        user: {
          id: "u-1",
          displayName: "Демо Доктор",
          roles: [{ role: "doctor", clinicId: "c-1" }],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    await userEvent.clear(screen.getByLabelText("Адрес backend"));
    await userEvent.type(screen.getByLabelText("Адрес backend"), "http://localhost:8080");
    await userEvent.type(screen.getByLabelText("Email"), "doctor@example.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "secret");
    await userEvent.click(
      screen.getByRole("button", { name: /Войти в self-hosted backend/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("patients-route")).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(SELF_HOSTED_API_TOKEN_KEY)).toBe("jwt-1");
    expect(window.localStorage.getItem(SELF_HOSTED_API_BASE_URL_KEY)).toBe(
      "http://localhost:8080",
    );
    expect(window.localStorage.getItem(SELF_HOSTED_API_USER_KEY)).toContain("Демо Доктор");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("http://localhost:8080/api/v1/auth/login");
  });

  it("surfaces invalid_credentials backend error in a polite alert", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        { error: { code: "invalid_credentials", message: "Invalid credentials." } },
        { status: 401 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    await userEvent.clear(screen.getByLabelText("Адрес backend"));
    await userEvent.type(screen.getByLabelText("Адрес backend"), "http://localhost:8080");
    await userEvent.type(screen.getByLabelText("Email"), "doctor@example.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "wrong");
    await userEvent.click(
      screen.getByRole("button", { name: /Войти в self-hosted backend/i }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid credentials.");
    expect(window.localStorage.getItem(SELF_HOSTED_API_TOKEN_KEY)).toBeNull();
  });

  it("shows active session and lets the user sign out of the self-hosted backend", async () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-existing");
    window.localStorage.setItem(
      SELF_HOSTED_API_USER_KEY,
      JSON.stringify({ id: "u-1", displayName: "Демо Доктор", roles: ["doctor"] }),
    );

    renderPage();

    expect(screen.getByText("Активная self-hosted сессия")).toBeInTheDocument();
    expect(screen.getByText("Демо Доктор")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Выйти из self-hosted backend/i }),
    );
    await waitFor(() => {
      expect(window.localStorage.getItem(SELF_HOSTED_API_TOKEN_KEY)).toBeNull();
    });
    // base URL preserved on logout for convenience
    expect(window.localStorage.getItem(SELF_HOSTED_API_BASE_URL_KEY)).toBe(
      "http://localhost:8080",
    );
  });
});

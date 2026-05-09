import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { AuthContext, type AuthContextValue } from "@/context/auth-context";

const isConfiguredMock = vi.fn(() => true);
vi.mock("@/lib/supabase-client", () => ({
  isSupabaseConfigured: () => isConfiguredMock(),
  getSupabaseUrl: () => "https://abc.supabase.co",
  getSupabaseClient: () => null,
  __resetSupabaseClientForTests: () => {},
}));

import { LoginForm } from "@/components/auth/LoginForm";

const noop = async () => ({ error: null });
const baseValue: AuthContextValue = {
  status: "anonymous",
  session: null,
  user: null,
  accessToken: null,
  apiBaseUrl: null,
  signInWithPassword: noop,
  signInWithGoogle: noop,
  signOut: noop,
};

function renderWith(value: Partial<AuthContextValue>, ui: ReactNode = <LoginForm />) {
  return render(
    <AuthContext.Provider value={{ ...baseValue, ...value }}>{ui}</AuthContext.Provider>,
  );
}

beforeEach(() => {
  isConfiguredMock.mockReturnValue(true);
});

describe("LoginForm", () => {
  it("renders email/password fields and both buttons", () => {
    renderWith({});
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /войти$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
  });

  it("submits email/password and calls signInWithPassword", async () => {
    const signInWithPassword = vi.fn(async () => ({ error: null }));
    const onSuccess = vi.fn();
    renderWith({ signInWithPassword }, <LoginForm onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(/пароль/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /войти$/i }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith("a@b.co", "pw"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
  });

  it("shows alert on signInWithPassword error", async () => {
    const signInWithPassword = vi.fn(async () => ({ error: new Error("bad creds") }));
    renderWith({ signInWithPassword });

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(/пароль/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /войти$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("bad creds");
  });

  it("disables controls while status === 'loading'", () => {
    renderWith({ status: "loading" });
    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/пароль/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /войти$/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /google/i })).toBeDisabled();
  });

  it("Google button calls signInWithGoogle", async () => {
    const signInWithGoogle = vi.fn(async () => ({ error: null }));
    renderWith({ signInWithGoogle });
    fireEvent.click(screen.getByRole("button", { name: /google/i }));
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalled());
  });

  it("shows unconfigured copy when supabase is not configured", () => {
    isConfiguredMock.mockReturnValue(false);
    renderWith({});
    expect(screen.getByText(/Подключите Lovable Cloud для входа/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });
});

import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, ServerCog, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginToSelfHostedBackend } from "@/lib/self-hosted-auth-api";
import {
  clearSelfHostedApiSession,
  useSelfHostedApiSession,
  writeSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

const DEFAULT_BASE_URL = String(import.meta.env.VITE_SELF_HOSTED_API_BASE_URL ?? "").trim();

export const SELF_HOSTED_LOGIN_HEADING = "Вход в self-hosted backend";
export const SELF_HOSTED_LOGIN_SUBTITLE =
  "Подключение к локальному API /api/v1 без managed-runtime интеграций.";

export default function SelfHostedLoginPage() {
  const navigate = useNavigate();
  const session = useSelfHostedApiSession();
  const [apiBaseUrl, setApiBaseUrl] = useState(session.apiBaseUrl || DEFAULT_BASE_URL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await loginToSelfHostedBackend({
      apiBaseUrl: apiBaseUrl,
      email,
      password,
    });
    setSubmitting(false);
    if (!result.ok || !result.value) {
      setError(result.error?.message ?? "Не удалось выполнить вход.");
      return;
    }
    writeSelfHostedApiSession({
      apiBaseUrl,
      apiToken: result.value.accessToken,
      user: result.value.user,
    });
    navigate("/patients", { replace: true });
  }

  function handleSignOut() {
    clearSelfHostedApiSession();
    setEmail("");
    setPassword("");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="w-full max-w-lg rounded-md border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <ServerCog className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">
              {SELF_HOSTED_LOGIN_HEADING}
            </h1>
            <p className="text-[12px] text-muted-foreground">{SELF_HOSTED_LOGIN_SUBTITLE}</p>
          </div>
        </div>

        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Вход выполняется через POST /api/v1/auth/login. Токен сохраняется в локальном
            браузере и используется только для self-hosted API.
          </span>
        </div>

        {session.apiToken ? (
          <section
            aria-labelledby="self-hosted-active-session"
            className="mb-4 rounded-md border border-border bg-surface-muted p-3 text-[12px] text-muted-foreground"
          >
            <h2 id="self-hosted-active-session" className="mb-1 text-[13px] font-medium text-foreground">
              Активная self-hosted сессия
            </h2>
            <p>
              Текущий пользователь:{" "}
              <span className="font-medium text-foreground">
                {session.user?.displayName || "self-hosted user"}
              </span>
              {session.user?.roles?.length ? ` · роли: ${session.user.roles.join(", ")}` : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild type="button" size="sm" className="h-8 text-[12px]">
                <Link to="/patients">Открыть пациентов</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-[12px]"
                onClick={handleSignOut}
              >
                Выйти из self-hosted backend
              </Button>
            </div>
          </section>
        ) : null}

        <form aria-label="Форма входа в self-hosted backend" onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="self-hosted-base-url" className="text-[12px]">
              Адрес backend
            </Label>
            <Input
              id="self-hosted-base-url"
              type="url"
              autoComplete="off"
              placeholder="http://localhost:8080"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              className="h-9 text-[13px]"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              По умолчанию подставляется VITE_SELF_HOSTED_API_BASE_URL. Поле перезаписывает значение
              для текущего браузера.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="self-hosted-email" className="text-[12px]">
              Email
            </Label>
            <Input
              id="self-hosted-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-9 text-[13px]"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="self-hosted-password" className="text-[12px]">
              Пароль
            </Label>
            <Input
              id="self-hosted-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-9 text-[13px]"
              required
            />
          </div>

          {error ? (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="submit" size="sm" disabled={submitting} className="h-9 gap-1.5 text-[13px]">
              <LogIn className="h-4 w-4" aria-hidden />
              {submitting ? "Входим…" : "Войти в self-hosted backend"}
            </Button>
            <Link
              to="/login"
              className="text-[12px] text-muted-foreground underline-offset-2 hover:underline"
            >
              К демо-логину
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

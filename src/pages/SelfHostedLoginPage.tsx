import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, CircleAlert, CircleHelp, Eye, EyeOff, LogIn, RefreshCw, ServerCog, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginToSelfHostedBackend } from "@/lib/self-hosted-auth-api";
import {
  clearSelfHostedApiSession,
  useSelfHostedApiSession,
  writeSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import { isProductionAppMode } from "@/lib/app-mode";
import {
  buildProductionBootstrapChecklist,
  fetchSelfHostedBootstrapStatus,
  type ProductionBootstrapChecklistItem,
  type ProductionBootstrapCheckStatus,
} from "@/lib/self-hosted-bootstrap-api";

const DEFAULT_BASE_URL = String(import.meta.env.VITE_SELF_HOSTED_API_BASE_URL ?? "").trim();

export const SELF_HOSTED_LOGIN_HEADING = "Дерматолог Про — рабочий вход";
export const SELF_HOSTED_LOGIN_SUBTITLE =
  "Вход в систему клиники через рабочий контур клиники.";

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    clinic_admin: "администратор клиники",
    doctor: "врач",
    operator: "оператор",
    patient: "пациент",
    system_admin: "системный администратор",
  };
  return labels[role] ?? "роль скрыта";
}

export default function SelfHostedLoginPage() {
  const navigate = useNavigate();
  const session = useSelfHostedApiSession();
  const productionMode = isProductionAppMode();
  const [apiBaseUrl, setApiBaseUrl] = useState(session.apiBaseUrl || DEFAULT_BASE_URL);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialsInvalid, setCredentialsInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapChecking, setBootstrapChecking] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapChecklist, setBootstrapChecklist] = useState<ProductionBootstrapChecklistItem[]>(
    () => buildProductionBootstrapChecklist(null),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCredentialsInvalid(false);
    setSubmitting(true);
    const result = await loginToSelfHostedBackend({
      apiBaseUrl: apiBaseUrl,
      email,
      password,
    });
    setSubmitting(false);
    if (!result.ok || !result.value) {
      setError(result.error?.message ?? "Не удалось выполнить вход.");
      setCredentialsInvalid(result.error?.code === "invalid_credentials" || result.error?.status === 401);
      return;
    }
    writeSelfHostedApiSession({
      apiBaseUrl,
      apiToken: result.value.accessToken,
      user: result.value.user,
    });
    navigate(productionMode ? "/" : "/patients", { replace: true });
  }

  function handleSignOut() {
    clearSelfHostedApiSession();
    setEmail("");
    setPassword("");
    setPasswordVisible(false);
    setCredentialsInvalid(false);
  }

  async function handleBootstrapCheck() {
    setBootstrapError(null);
    setBootstrapChecking(true);
    const result = await fetchSelfHostedBootstrapStatus({ apiBaseUrl });
    setBootstrapChecking(false);
    if (!result.ok || !result.value) {
      setBootstrapError(result.error?.message ?? "Не удалось проверить готовность входа.");
      setBootstrapChecklist(buildProductionBootstrapChecklist(null));
      return;
    }
    setBootstrapChecklist(buildProductionBootstrapChecklist(result.value));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="grid w-full max-w-5xl gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)]">
        <section className="rounded-md border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <ServerCog className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {productionMode ? "Рабочий режим" : "Учебный режим"}
              </p>
              <h1 className="text-[18px] font-semibold leading-tight">
                {SELF_HOSTED_LOGIN_HEADING}
              </h1>
              <p className="text-[12px] text-muted-foreground">{SELF_HOSTED_LOGIN_SUBTITLE}</p>
            </div>
          </div>

          <ProductionBootstrapPanel
            checking={bootstrapChecking}
            error={bootstrapError}
            checklist={bootstrapChecklist}
            onCheck={handleBootstrapCheck}
          />
        </section>

      <div className="w-full rounded-md border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <ServerCog className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <h2 className="text-[15px] font-semibold leading-tight">
              Войти в систему клиники
            </h2>
            <p className="text-[12px] text-muted-foreground">Используйте учётку администратора или сотрудника клиники.</p>
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
            Вход выполняется через систему клиники. Данные входа хранятся только в текущем браузере.
          </span>
        </div>

        {session.apiToken ? (
          <section
            aria-labelledby="self-hosted-active-session"
            className="mb-4 rounded-md border border-border bg-surface-muted p-3 text-[12px] text-muted-foreground"
          >
            <h2 id="self-hosted-active-session" className="mb-1 text-[13px] font-medium text-foreground">
              Вход активен
            </h2>
            <p>
              Текущий пользователь:{" "}
              <span className="font-medium text-foreground">
                {session.user?.displayName || "пользователь"}
              </span>
              {session.user?.roles?.length ? ` · роли: ${session.user.roles.map(roleLabel).join(", ")}` : null}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button asChild type="button" size="sm" className="min-h-11 text-[12px]">
                <Link to="/patients">Открыть пациентов</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 text-[12px]"
                onClick={handleSignOut}
              >
                Выйти из системы клиники
              </Button>
            </div>
          </section>
        ) : null}

        <form aria-label="Форма входа в систему клиники" onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="self-hosted-base-url" className="text-[12px]">
              Адрес системы клиники
            </Label>
            <Input
              id="self-hosted-base-url"
              type="url"
              autoComplete="off"
              placeholder="http://localhost:8080"
              value={apiBaseUrl}
              onChange={(event) => setApiBaseUrl(event.target.value)}
              className="h-11 text-[13px]"
              required
            />
            <p className="text-[11px] text-muted-foreground">
              По умолчанию используется адрес, заданный при установке. Поле меняет адрес только для текущего браузера.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="self-hosted-email" className="text-[12px]">
              Эл. почта
            </Label>
            <Input
              id="self-hosted-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setError(null);
                setCredentialsInvalid(false);
              }}
              className="h-11 text-[13px]"
              aria-invalid={credentialsInvalid}
              aria-errormessage={credentialsInvalid ? "self-hosted-login-error" : undefined}
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="self-hosted-password" className="text-[12px]">
              Пароль
            </Label>
            <div className="relative">
              <Input
                id="self-hosted-password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError(null);
                  setCredentialsInvalid(false);
                }}
                className="h-11 pr-12 text-[13px]"
                aria-invalid={credentialsInvalid}
                aria-errormessage={credentialsInvalid ? "self-hosted-login-error" : undefined}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-11 w-11 rounded-l-none"
                aria-label={passwordVisible ? "Скрыть введённые символы" : "Показать введённые символы"}
                aria-pressed={passwordVisible}
                title={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
              </Button>
            </div>
          </div>

          {error ? (
            <div
              id="self-hosted-login-error"
              role="alert"
              aria-live="polite"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="submit" size="sm" disabled={submitting} className="min-h-11 gap-1.5 text-[13px]">
              <LogIn className="h-4 w-4" aria-hidden />
              {submitting ? "Входим…" : "Войти"}
            </Button>
            {!productionMode ? (
              <Link
                to="/login"
                className="inline-flex min-h-11 min-w-11 items-center rounded-md px-2 text-[12px] text-muted-foreground underline-offset-2 hover:underline"
              >
                К учебному входу
              </Link>
            ) : null}
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

function ProductionBootstrapPanel({
  checking,
  error,
  checklist,
  onCheck,
}: {
  checking: boolean;
  error: string | null;
  checklist: ProductionBootstrapChecklistItem[];
  onCheck: () => void;
}) {
  return (
    <section aria-labelledby="production-bootstrap-heading" className="space-y-4">
      <div>
        <h2 id="production-bootstrap-heading" className="text-[15px] font-semibold text-foreground">
          Готовность входа
        </h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Перед первым входом проверьте систему клиники, базу данных, файлы клиники
          и локальный вход.
        </p>
      </div>

      <div className="rounded-md border border-border bg-surface-muted p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[12px] font-medium text-foreground">Чек-лист готовности</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1.5 text-[12px]"
            onClick={onCheck}
            disabled={checking}
            aria-label="Проверить готовность входа"
          >
            <RefreshCw className={checking ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
            {checking ? "Проверяем…" : "Проверить"}
          </Button>
        </div>

        {error ? (
          <div
            role="alert"
            className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
          >
            {error}
          </div>
        ) : null}

        <ul className="space-y-2" aria-label="Чек-лист готовности входа">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-start gap-2 text-[12px]">
              <BootstrapStatusIcon status={item.status} />
              <span>
                <span className="font-medium text-foreground">{item.label}</span>
                <span className="block text-muted-foreground">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-md border border-border bg-surface p-3 text-[12px] text-muted-foreground">
        <div className="mb-1 font-medium text-foreground">Первый администратор</div>
        <p>
          Если вход ещё невозможен, создайте первого администратора по инструкции развёртывания,
          затем удалите временный ключ доступа.
        </p>
      </div>
    </section>
  );
}

function BootstrapStatusIcon({ status }: { status: ProductionBootstrapCheckStatus }) {
  if (status === "ready") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />;
  if (status === "attention") return <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />;
  return <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />;
}

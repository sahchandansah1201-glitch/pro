import { useCallback, useContext, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoleContext } from "@/context/role-context";
import { formatDateTime } from "@/lib/format";
import {
  fetchPatientPortalAccessStatus,
  provisionPatientPortalAccess,
  type PatientPortalAccessStatusDTO,
  type ProvisionedPatientPortalAccessDTO,
} from "@/lib/self-hosted-onboarding-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

interface PatientPortalAccessCardProps {
  patientId: string;
}

export function PatientPortalAccessCard({ patientId }: PatientPortalAccessCardProps) {
  const roleCtx = useContext(RoleContext);
  const session = useSelfHostedApiSession();
  const isConfigured = isSelfHostedApiConfigured(session);

  const sessionRoles = session.user?.roles ?? [];
  const activeRole = roleCtx?.role ?? null;
  const canManagePortalAccess =
    activeRole === "doctor"
    || activeRole === "clinic_admin"
    || activeRole === "system_admin"
    || sessionRoles.some((r) => r === "doctor" || r === "clinic_admin" || r === "system_admin");

  const [statusData, setStatusData] = useState<PatientPortalAccessStatusDTO | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState<ProvisionedPatientPortalAccessDTO | null>(null);

  const loadStatus = useCallback(async () => {
    if (!isConfigured || !canManagePortalAccess) return;
    const res = await fetchPatientPortalAccessStatus({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      patientId,
    });
    if (res.ok && res.value) {
      setStatusData(res.value);
      if (res.value.linkedAccounts[0]?.email) {
        setEmailInput(res.value.linkedAccounts[0].email);
      }
    }
  }, [canManagePortalAccess, isConfigured, patientId, session.apiBaseUrl, session.apiToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  if (!isConfigured || !canManagePortalAccess) {
    return null;
  }

  async function handleProvision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await provisionPatientPortalAccess({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      patientId,
      email: emailInput.trim() || undefined,
      activateSkinPassport: true,
    });
    setBusy(false);
    if (!res.ok || !res.value) {
      setError(res.error?.message || "Не удалось выдать доступ пациенту.");
      return;
    }
    setProvisioned(res.value);
    await loadStatus();
  }

  const existingAccount = statusData?.linkedAccounts?.[0] ?? null;

  return (
    <section
      aria-label="Доступ пациента в личный кабинет и Паспорт кожи"
      className="surface-card overflow-hidden lg:col-span-12"
    >
      <header className="section-bar">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="h-section">Доступ пациента в личный кабинет и Паспорт контроля кожи</h2>
        </div>
        <span className="h-section-hint">выдача учётной записи роли Пациент</span>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-2 text-[13px]">
          {existingAccount ? (
            <div className="rounded-md border border-border bg-surface-muted p-3">
              <div className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
                <span>Подключён вход пациента: {existingAccount.email}</span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Паспорт контроля кожи:{" "}
                <span className="font-medium text-foreground">
                  {existingAccount.skinPassportActive ? "активен бессрочно" : "ожидает подтверждения визита"}
                </span>
                {existingAccount.skinPassportActivatedAt
                  ? ` · с ${formatDateTime(existingAccount.skinPassportActivatedAt)}`
                  : ""}
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              У пациента пока нет учётной записи для входа в личный кабинет. Вы можете создать вход и сразу активировать бессрочный Паспорт контроля кожи.
            </p>
          )}

          {provisioned ? (
            <div
              role="status"
              className="rounded-md border border-primary/30 bg-primary/5 p-3 text-[12px]"
            >
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
                Доступ пациента выдан (передайте реквизиты пациенту)
              </div>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Эл. почта для входа:</dt>
                  <dd className="mt-1">
                    <Input
                      readOnly
                      value={provisioned.email}
                      aria-label="Эл. почта выданного доступа пациента"
                      onFocus={(e) => e.currentTarget.select()}
                      className="h-9 font-mono text-[12px]"
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Временный пароль (показывается один раз):</dt>
                  <dd className="mt-1">
                    <Input
                      readOnly
                      value={provisioned.temporaryPassword}
                      aria-label="Временный пароль выданного доступа пациента"
                      onFocus={(e) => e.currentTarget.select()}
                      className="h-9 font-mono text-[12px]"
                    />
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-[12px] text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <form onSubmit={handleProvision} className="space-y-3 rounded-md border border-border p-3">
          <label className="grid gap-1 text-[12px] font-medium">
            Эл. почта пациента (или оставьте пустым для автосоздания по коду карты)
            <Input
              type="email"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="patient@example.ru"
              className="min-h-11 text-[13px]"
            />
          </label>
          <Button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full text-[13px]"
          >
            {busy
              ? "Формируем доступ…"
              : existingAccount
                ? "Сбросить пароль и обновить доступ пациента"
                : "Выдать доступ пациенту и открыть Паспорт кожи"}
          </Button>
        </form>
      </div>
    </section>
  );
}

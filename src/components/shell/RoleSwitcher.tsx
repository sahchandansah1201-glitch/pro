import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck } from "lucide-react";
import { useRole } from "@/context/role-context";
import { useAuth } from "@/context/use-auth";
import { clearSelfHostedApiSession, isSelfHostedApiConfigured, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import { Button } from "@/components/ui/button";

/** Account display/logout only. The historical export name no longer selects roles. */
export function RoleSwitcher() {
  const { label, currentUser } = useRole();
  const { status, accessToken, signOut, user } = useAuth();
  const session = useSelfHostedApiSession();
  const selfHosted = isSelfHostedApiConfigured(session);
  const connected = selfHosted || (status === "authenticated" && Boolean(accessToken));
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const displayName = selfHosted ? session.user?.displayName : currentUser?.fullName ?? user?.email;

  const handleLogout = async () => {
    if (pending || status === "loading") return;
    setPending(true);
    setLogoutError(null);
    try {
      if (status === "authenticated" && accessToken) {
        const { error } = await signOut();
        if (error) throw error;
      }
      if (selfHosted) clearSelfHostedApiSession();
      navigate(selfHosted ? "/self-hosted/login" : "/login", { replace: true });
    } catch {
      setLogoutError("Не удалось выйти. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        data-testid={selfHosted ? "production-session-chip" : "auth-session-chip"}
        className="hidden max-w-[260px] items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-1 text-[11px] text-muted-foreground sm:inline-flex"
        title={connected ? `${displayName ?? "Пользователь"} · ${label}` : "Нужен рабочий вход"}
        aria-label={connected ? `Рабочий вход активен: ${displayName ?? label}` : "Рабочий вход не подключён"}
      >
        <ShieldCheck className={connected ? "h-3 w-3 text-success" : "h-3 w-3 text-muted-foreground"} aria-hidden />
        <span className="truncate">{connected ? displayName ?? label : "Нет рабочего входа"}</span>
      </span>
      {connected && (
        <Button type="button" variant="ghost" size="sm" className="min-h-11 min-w-11 px-3 text-[12px]"
          onClick={() => { void handleLogout(); }}
          aria-label={selfHosted ? "Выйти из рабочей системы" : "Выйти из аккаунта"}
          disabled={pending || status === "loading"} aria-busy={pending || status === "loading" || undefined}>
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">{pending ? "Выход…" : "Выйти"}</span>
        </Button>
      )}
      {logoutError && <span role="alert" data-testid="logout-error" className="text-[11px] text-destructive">{logoutError}</span>}
    </div>
  );
}

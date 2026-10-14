import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Stethoscope } from "lucide-react";

import { useAuth } from "@/context/use-auth";
import { ROLE_BY_ID } from "@/lib/roles";
import { LoginForm } from "@/components/auth/LoginForm";
import { roleFromAuthUser } from "@/lib/auth-role";
import { canRoleAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import { isSelfHostedApiConfigured, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";

/** Accept only same-origin absolute paths starting with a single "/". */
function safeFromPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.startsWith("/\\")) return null;
  return value;
}

/** Real entry only. Server authorization remains the security boundary. */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { status, accessToken, user } = useAuth();
  const selfHostedSession = useSelfHostedApiSession();
  const selfHostedEntry = isSelfHostedApiConfigured(selfHostedSession) || !isSupabaseConfigured();

  const handleRealLoginSuccess = () => {
    // No-op: real navigation is handled by the auth-state effect below.
  };

  useEffect(() => {
    if (selfHostedEntry) {
      navigate("/self-hosted/login", { replace: true, state: location.state });
      return;
    }
    if (status !== "authenticated" || !accessToken) return;
    const mapped = roleFromAuthUser(user);
    const fromState = (location.state as { from?: unknown } | null)?.from;
    const from = safeFromPath(fromState);
    const target =
      mapped ? (from && canRoleAccess(mapped, from) ? from : ROLE_BY_ID[mapped].home) : "/";
    navigate(target, { replace: true });
  }, [selfHostedEntry, status, accessToken, user, navigate, location.state]);

  if (selfHostedEntry) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted p-6">
      <div className="w-full max-w-lg rounded-md border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" aria-hidden />
          <div>
            <h1 className="text-[15px] font-semibold leading-tight">Дерматолог Про</h1>
            <p className="text-[12px] text-muted-foreground">Клиническая поддержка решений</p>
          </div>
        </div>

        <section aria-labelledby="login-real-heading" className="mb-6">
          <h2
            id="login-real-heading"
            className="mb-2 text-[13px] font-semibold leading-tight"
          >
            Вход в Дерматолог Про
          </h2>
          <LoginForm onSuccess={handleRealLoginSuccess} />
        </section>

      </div>
    </div>
  );
}

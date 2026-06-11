import { Outlet } from "react-router-dom";
import { LogOut, Search, ShieldCheck } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { DemoNotice } from "@/components/shell/DemoNotice";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRole } from "@/context/role-context";
import {
  clearSelfHostedApiSession,
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import { isProductionAppMode } from "@/lib/app-mode";
import { selfHostedRoleLabel } from "@/lib/self-hosted-role";

/**
 * AppShell — каркас рабочего места врача.
 * Desktop-first, плотный продуктовый UI, фиксированный верхний тулбар.
 */
export function AppLayout() {
  const { label } = useRole();
  const productionMode = isProductionAppMode();
  const selfHostedSession = useSelfHostedApiSession();
  const productionLabel = isSelfHostedApiConfigured(selfHostedSession)
    ? selfHostedRoleLabel(selfHostedSession)
    : "Self-hosted login required";

  return (
    <SidebarProvider>
      <div className="workstation-shell flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          {!productionMode ? <DemoNotice /> : null}

          <header className="workstation-toolbar">
            <SidebarTrigger />
            <div className="mx-2 hidden h-5 w-px bg-border md:block" />
            <div className="hidden text-[13px] text-muted-foreground md:block">
              Рабочее место ·{" "}
              <span className="text-foreground">{productionMode ? productionLabel : label}</span>
            </div>

            <div className="ml-3 hidden max-w-md flex-1 md:flex">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск пациента, визита, лида…"
                  className="h-11 pl-7 text-[13px]"
                  aria-label="Глобальный поиск"
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {productionMode ? (
                <ProductionSessionChip
                  displayName={selfHostedSession.user?.displayName ?? null}
                  roleLabel={productionLabel}
                  connected={isSelfHostedApiConfigured(selfHostedSession)}
                />
              ) : (
                <RoleSwitcher />
              )}
            </div>
          </header>

          <main className="flex-1 overflow-auto bg-surface-muted">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ProductionSessionChip({
  displayName,
  roleLabel,
  connected,
}: {
  displayName: string | null;
  roleLabel: string;
  connected: boolean;
}) {
  const handleLogout = () => {
    clearSelfHostedApiSession();
    window.location.assign("/self-hosted/login");
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <span
        data-testid="production-session-chip"
        className="hidden max-w-[260px] items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-1 text-[11px] text-muted-foreground sm:inline-flex"
        title={connected ? `${displayName ?? "Self-hosted user"} · ${roleLabel}` : "Self-hosted session required"}
        aria-label={connected ? `Self-hosted сессия активна: ${displayName ?? roleLabel}` : "Self-hosted сессия не подключена"}
      >
        <ShieldCheck className={connected ? "h-3 w-3 text-success" : "h-3 w-3 text-muted-foreground"} aria-hidden />
        <span className="truncate">{connected ? (displayName ?? roleLabel) : "Нет live-сессии"}</span>
      </span>
      {connected ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 px-3 text-[12px]"
          onClick={handleLogout}
          aria-label="Выйти из self-hosted backend"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Выйти</span>
        </Button>
      ) : null}
    </div>
  );
}

import { Outlet } from "react-router-dom";
import { Search } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { DemoNotice } from "@/components/shell/DemoNotice";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { Input } from "@/components/ui/input";
import { useRole } from "@/context/RoleContext";

/**
 * AppShell — каркас рабочего места врача.
 * Desktop-first, плотный продуктовый UI, фиксированный верхний тулбар.
 */
export function AppLayout() {
  const { label } = useRole();

  return (
    <SidebarProvider>
      <div className="workstation-shell flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <DemoNotice />

          <header className="workstation-toolbar">
            <SidebarTrigger className="h-8 w-8" />
            <div className="mx-2 hidden h-5 w-px bg-border md:block" />
            <div className="hidden text-[13px] text-muted-foreground md:block">
              Рабочее место · <span className="text-foreground">{label}</span>
            </div>

            <div className="ml-3 hidden max-w-md flex-1 md:flex">
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск пациента, визита, лида…"
                  className="h-8 pl-7 text-[13px]"
                  aria-label="Глобальный поиск"
                />
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <RoleSwitcher />
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

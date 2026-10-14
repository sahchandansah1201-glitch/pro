import { useState, type FormEvent } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { RoleSwitcher } from "@/components/shell/RoleSwitcher";
import { Input } from "@/components/ui/input";
import { useRole } from "@/context/role-context";

/**
 * AppShell — каркас рабочего места врача.
 * Desktop-first, плотный продуктовый UI, фиксированный верхний тулбар.
 */
export function AppLayout() {
  const { label, roles } = useRole();
  const navigate = useNavigate();
  const [globalSearch, setGlobalSearch] = useState("");
  const canSearchPatients = roles.some((role) => ["doctor", "private_doctor", "assistant"].includes(role));

  const handleGlobalSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = globalSearch.trim();
    if (!query) return;
    navigate(`/patients?search=${encodeURIComponent(query)}`);
  };

  return (
    <SidebarProvider>
      <div className="workstation-shell flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">

          <header className="workstation-toolbar">
            <SidebarTrigger />
            <div className="mx-2 hidden h-5 w-px bg-border md:block" />
            <div className="hidden text-[13px] text-muted-foreground md:block">
              Рабочее место ·{" "}
              <span className="text-foreground">{label}</span>
            </div>

            {canSearchPatients ? (
              <form
                role="search"
                aria-label="Поиск пациентов"
                className="ml-3 hidden max-w-md flex-1 md:flex"
                onSubmit={handleGlobalSearch}
              >
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Поиск пациента…"
                    className="h-11 pl-7 text-[13px]"
                    aria-label="Поиск пациентов"
                    value={globalSearch}
                    onChange={(event) => setGlobalSearch(event.target.value)}
                  />
                </div>
              </form>
            ) : null}

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

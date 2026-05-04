import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Calendar,
  Image as ImageIcon,
  Bot,
  Building2,
  Plug,
  ShieldCheck,
  Activity,
  Cpu,
  FileText,
  Bell,
  HelpCircle,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useRole } from "@/context/RoleContext";
import type { Role } from "@/lib/roles";

interface NavItem {
  title: string;
  url: string;
  icon: typeof Users;
  roles: Role[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ALL: Role[] = ["doctor", "assistant", "clinic_admin", "private_doctor", "operator", "system_admin"];
const CLINICAL: Role[] = ["doctor", "assistant", "private_doctor"];
const ADMIN: Role[] = ["clinic_admin", "private_doctor", "system_admin"];

const NAV: NavGroup[] = [
  {
    label: "Клиника",
    items: [
      { title: "Обзор", url: "/", icon: LayoutDashboard, roles: ALL },
      { title: "Пациенты", url: "/patients", icon: Users, roles: [...CLINICAL, "clinic_admin", "operator"] },
      { title: "Визиты", url: "/visits", icon: Stethoscope, roles: CLINICAL },
      { title: "Расписание", url: "/schedule", icon: Calendar, roles: [...CLINICAL, "clinic_admin"] },
      { title: "Изображения", url: "/images", icon: ImageIcon, roles: CLINICAL },
    ],
  },
  {
    label: "Каналы",
    items: [
      { title: "Бот и лиды", url: "/bot", icon: Bot, roles: ["clinic_admin", "operator", "private_doctor"] },
      { title: "Отчёты пациента", url: "/reports", icon: FileText, roles: [...CLINICAL, "clinic_admin"] },
      { title: "Напоминания", url: "/reminders", icon: Bell, roles: [...CLINICAL, "clinic_admin", "operator"] },
    ],
  },
  {
    label: "Администрирование",
    items: [
      { title: "Клиника и услуги", url: "/clinic", icon: Building2, roles: ADMIN },
      { title: "Интеграции", url: "/integrations", icon: Plug, roles: ADMIN },
      { title: "Устройства", url: "/devices", icon: Cpu, roles: ADMIN },
      { title: "Доступ и роли", url: "/access", icon: ShieldCheck, roles: ["system_admin", "clinic_admin"] },
      { title: "Аудит", url: "/audit", icon: Activity, roles: ["system_admin", "clinic_admin"] },
    ],
  },
  {
    label: "Поддержка",
    items: [{ title: "Справка", url: "/help", icon: HelpCircle, roles: ALL }],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role } = useRole();

  const isActive = (path: string) => (path === "/" ? pathname === "/" : pathname.startsWith(path));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {!collapsed && (
          <div className="px-3 pt-3 pb-2">
            <div className="text-[13px] font-semibold tracking-tight text-sidebar-foreground">
              Дерматолог Про
            </div>
            <div className="text-[11px] text-sidebar-foreground/60">Клиническая поддержка решений</div>
          </div>
        )}

        {NAV.map((group) => {
          const visible = group.items.filter((i) => i.roles.includes(role));
          if (visible.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {visible.map((item) => (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                        <NavLink to={item.url} end={item.url === "/"} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span className="text-[13px]">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}

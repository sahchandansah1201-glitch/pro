import {
  LayoutDashboard,
  Users,
  Camera,
  Building2,
  Stethoscope,
  Plug,
  Bot,
  BarChart3,
  Headphones,
  ShieldCheck,
  Cpu,
  Activity,
  KeyRound,
  FileText,
  CalendarPlus,
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
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Меню разбито по ролевым зонам (UX-only).
 * Сайдбар показывает только зону(ы) активной демо-роли —
 * никакой смеси /admin, /operator, /sys, /me с общими путями.
 */
const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  doctor: [
    {
      label: "Клиника",
      items: [
        { title: "Рабочий стол", url: "/desk", icon: LayoutDashboard },
        { title: "Пациенты", url: "/patients", icon: Users },
        { title: "Съёмка", url: "/capture", icon: Camera },
      ],
    },
  ],
  private_doctor: [
    {
      label: "Клиника",
      items: [
        { title: "Рабочий стол", url: "/desk", icon: LayoutDashboard },
        { title: "Пациенты", url: "/patients", icon: Users },
        { title: "Съёмка", url: "/capture", icon: Camera },
      ],
    },
    {
      label: "Администрирование",
      items: [
        { title: "Клиника", url: "/admin", icon: Building2 },
        { title: "Услуги", url: "/admin/services", icon: Stethoscope },
        { title: "Интеграции", url: "/admin/integrations", icon: Plug },
        { title: "Бот", url: "/admin/bot", icon: Bot },
        { title: "Аналитика", url: "/admin/analytics", icon: BarChart3 },
      ],
    },
  ],
  assistant: [
    {
      label: "Съёмка",
      items: [
        { title: "Захват фото", url: "/capture", icon: Camera },
        { title: "Пациенты", url: "/patients", icon: Users },
      ],
    },
  ],
  clinic_admin: [
    {
      label: "Администрирование",
      items: [
        { title: "Обзор", url: "/admin", icon: LayoutDashboard },
        { title: "Врачи", url: "/admin/doctors", icon: Stethoscope },
        { title: "Услуги", url: "/admin/services", icon: FileText },
        { title: "Клиники", url: "/admin/clinics", icon: Building2 },
        { title: "Интеграции", url: "/admin/integrations", icon: Plug },
        { title: "Бот", url: "/admin/bot", icon: Bot },
        { title: "Аналитика", url: "/admin/analytics", icon: BarChart3 },
      ],
    },
  ],
  operator: [
    {
      label: "Поддержка",
      items: [
        { title: "Очередь диалогов", url: "/operator", icon: Headphones },
      ],
    },
  ],
  system_admin: [
    {
      label: "Система",
      items: [
        { title: "Пользователи", url: "/sys/users", icon: ShieldCheck },
        { title: "Устройства", url: "/sys/devices", icon: Cpu },
        { title: "Аудит", url: "/sys/audit", icon: Activity },
        { title: "API-ключи", url: "/sys/api-keys", icon: KeyRound },
      ],
    },
  ],
  patient: [
    {
      label: "Кабинет",
      items: [
        { title: "Главная", url: "/me", icon: LayoutDashboard },
        { title: "Запись", url: "/me/booking", icon: CalendarPlus },
        { title: "Напоминания", url: "/me/reminders", icon: Bell },
      ],
    },
  ],
};

const SHARED: NavGroup = {
  label: "Поддержка",
  items: [{ title: "Справка", url: "/help", icon: HelpCircle }],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { role } = useRole();

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  const groups = [...NAV_BY_ROLE[role], SHARED];

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

        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
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
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

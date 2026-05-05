import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Users, Stethoscope, User, Bot, Building2, Server, Lock, Search, X, ChevronDown, ChevronUp } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RouteRef {
  path: string;
  description: string;
}

interface RoleRef {
  title: string;
  responsibilities: string;
  routes: string[];
}

const ROLES: RoleRef[] = [
  {
    title: "Врач / Ассистент",
    responsibilities:
      "Ведение визита, документация образований, дерматоскопия, ABCD/7-point, итоговое заключение.",
    routes: ["/desk", "/patients", "/capture"],
  },
  {
    title: "Администратор клиники",
    responsibilities:
      "Доктора, услуги, расписание, маршрутизация, интеграции, бот-настройки, аналитика клиники.",
    routes: ["/admin", "/admin/doctors", "/admin/services", "/admin/clinics", "/admin/integrations", "/admin/bot", "/admin/analytics"],
  },
  {
    title: "Оператор поддержки",
    responsibilities:
      "Мониторинг диалогов бота, помощь с записью, эскалация в клинику. Не ставит диагноз.",
    routes: ["/operator"],
  },
  {
    title: "Системный администратор",
    responsibilities:
      "Пользователи и роли, устройства, аудит, API-ключи. Безопасность и конфигурация контура.",
    routes: ["/sys/users", "/sys/devices", "/sys/audit", "/sys/api-keys"],
  },
  {
    title: "Пациент",
    responsibilities:
      "Личный кабинет: безопасные заключения, запись, напоминания. Без врачебных деталей и AI-внутренностей.",
    routes: ["/me", "/me/reports", "/me/booking", "/me/reminders"],
  },
];

const CLINICAL: RouteRef[] = [
  { path: "/desk", description: "Очередь визитов и приоритеты дня." },
  { path: "/patients", description: "Список пациентов с фильтрами." },
  { path: "/patients/:id", description: "Карточка пациента: визиты, образования, история." },
  { path: "/patients/:id/visits/:visitId", description: "Рабочая область визита: интейк, body map, снимки, оценка, заключение, отчёт." },
  { path: "/patients/:id/lesions/:lesionId", description: "Образование: хронология снимков и оценок." },
  { path: "/capture", description: "Захват снимков: телефон, файл, камера, дерматоскоп." },
];

const PATIENT: RouteRef[] = [
  { path: "/me", description: "Главная личного кабинета." },
  { path: "/me/reports", description: "Безопасные заключения для пациента." },
  { path: "/me/reports/:id", description: "Конкретное заключение." },
  { path: "/me/booking", description: "Запись на приём в клинику-партнёр." },
  { path: "/me/reminders", description: "Напоминания и контрольные осмотры." },
];

const BOT: RouteRef[] = [
  { path: "/bot-sim", description: "Симулятор Telegram-бота: воронка лида." },
  { path: "/bot-sim/miniapp/booking", description: "Mini App для записи на приём." },
  { path: "/operator", description: "Консоль оператора поддержки." },
  { path: "/operator/dialogs/:id", description: "Диалог с пользователем бота." },
];

const ADMIN_ROUTES: RouteRef[] = [
  { path: "/admin", description: "Главная администратора клиники." },
  { path: "/admin/doctors", description: "Доктора и расписание." },
  { path: "/admin/services", description: "Услуги, тарифы, длительности." },
  { path: "/admin/clinics", description: "Клиники и филиалы." },
  { path: "/admin/integrations", description: "CRM/ERP/мессенджер-интеграции." },
  { path: "/admin/bot", description: "Настройки бота, тексты, маршрутизация." },
  { path: "/admin/analytics", description: "Аналитика клиники." },
];

const SYS_ROUTES: RouteRef[] = [
  { path: "/sys/users", description: "Пользователи и назначения ролей." },
  { path: "/sys/devices", description: "Дерматоскопы, Device Bridge, локальная передача." },
  { path: "/sys/audit", description: "Журнал событий и доступа." },
  { path: "/sys/api-keys", description: "API-ключи интеграций." },
];

const DATA_POLICY = [
  "Никаких медицинских персональных данных в CRM/ERP/мессенджеры.",
  "Снимки не передаются во внешние системы — только защищённые ссылки.",
  "В CRM не уходит диагноз: только статус лида и факт записи.",
  "Внутренности AI/XAI остаются в клинической рабочей области.",
  "Пациентское заключение и клиническая карточка анализа — разные документы.",
  "Защищённые ссылки на анализ отделены от врачебных отчётов.",
];

function RouteList({ items }: { items: RouteRef[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((r) => (
        <li key={r.path} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-baseline sm:gap-3">
          <Link
            to={r.path.replace(/:[^/]+/g, "—")}
            className="inline-flex min-h-[44px] items-center font-mono text-[12px] text-primary hover:underline focus:outline-none focus-visible:underline sm:min-h-0"
          >
            {r.path}
          </Link>
          <span className="text-[12px] text-muted-foreground">{r.description}</span>
        </li>
      ))}
    </ul>
  );
}

function Section({
  id, icon: Icon, title, children,
}: { id?: string; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-3 sm:p-4">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden /> {title}
      </h2>
      <div className="mt-2">{children}</div>
    </Card>
  );
}

const ANCHORS: { id: string; label: string; has: (f: ReturnType<typeof Object>) => boolean }[] = [
  { id: "roles", label: "Роли", has: (f) => f.roles.length > 0 },
  { id: "clinical", label: "Клинический поток", has: (f) => f.clinical.length > 0 },
  { id: "patient", label: "Пациентский поток", has: (f) => f.patient.length > 0 },
  { id: "bot", label: "Бот и запись", has: (f) => f.bot.length > 0 },
  { id: "admin", label: "Администрирование", has: (f) => f.admin.length > 0 },
  { id: "sys", label: "Системный контур", has: (f) => f.sys.length > 0 },
  { id: "policy", label: "Политика данных", has: (f) => !f.searching },
];

function matchRoute(r: RouteRef, q: string) {
  return r.path.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
}

function matchRole(r: RoleRef, q: string) {
  return (
    r.title.toLowerCase().includes(q) ||
    r.responsibilities.toLowerCase().includes(q) ||
    r.routes.some((p) => p.toLowerCase().includes(q))
  );
}

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [bannerOpen, setBannerOpen] = useState(true);
  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) {
      return {
        roles: ROLES,
        clinical: CLINICAL,
        patient: PATIENT,
        bot: BOT,
        admin: ADMIN_ROUTES,
        sys: SYS_ROUTES,
      };
    }
    return {
      roles: ROLES.filter((r) => matchRole(r, q)),
      clinical: CLINICAL.filter((r) => matchRoute(r, q)),
      patient: PATIENT.filter((r) => matchRoute(r, q)),
      bot: BOT.filter((r) => matchRoute(r, q)),
      admin: ADMIN_ROUTES.filter((r) => matchRoute(r, q)),
      sys: SYS_ROUTES.filter((r) => matchRoute(r, q)),
    };
  }, [q]);

  const totalMatches =
    filtered.roles.length +
    filtered.clinical.length +
    filtered.patient.length +
    filtered.bot.length +
    filtered.admin.length +
    filtered.sys.length;

  const isSearching = q.length > 0;
  const nothingFound = isSearching && totalMatches === 0;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Справка" subtitle="Роли, маршруты и ограничения MVP" />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="note"
          aria-label="Граничные условия безопасности"
          className="sticky top-2 z-10 rounded-md border px-3 py-2 text-[12px] shadow-sm backdrop-blur"
          style={{
            background: "hsl(var(--warning) / 0.12)",
            borderColor: "hsl(var(--warning) / 0.30)",
            color: "hsl(var(--warning))",
          }}
        >
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex-1">
              <button
                type="button"
                onClick={() => setBannerOpen((v) => !v)}
                aria-expanded={bannerOpen}
                aria-controls="safety-banner-body"
                className="flex min-h-[32px] w-full items-center justify-between gap-2 text-left font-medium focus:outline-none focus-visible:underline"
              >
                <span>Безопасность и границы MVP</span>
                {bannerOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                )}
              </button>
              {bannerOpen && (
                <ul id="safety-banner-body" className="mt-1 space-y-1">
                  <li>RoleGuard — это UX-симуляция, а не реальная граница безопасности.</li>
                  <li>Не используйте реальные данные пациентов в демо-контуре.</li>
                  <li>AI — только поддержка принятия решений, не диагноз.</li>
                  <li>Финальное медицинское решение принимает врач.</li>
                </ul>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по ролям и маршрутам, например: визит, /admin, оператор"
            aria-label="Поиск по разделам справки"
            className="h-11 pl-9 pr-20 text-[13px]"
          />
          {isSearching && (
            <div
              className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1"
              aria-live="polite"
            >
              <span className="text-[11px] text-muted-foreground">
                {totalMatches} {totalMatches === 1 ? "совпадение" : "совп."}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="pointer-events-auto h-8 w-8"
                aria-label="Очистить поиск"
                onClick={() => setQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {nothingFound && (
          <Card className="p-4 text-[12px] text-muted-foreground">
            Ничего не найдено по запросу «{query}». Попробуйте другое ключевое слово.
          </Card>
        )}

        {filtered.roles.length > 0 && (
          <Section icon={Users} title="Роли">
            <ul className="divide-y divide-border">
              {filtered.roles.map((r) => (
                <li key={r.title} className="py-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13px] font-medium">{r.title}</span>
                    {r.routes.map((p) => (
                      <Badge key={p} variant="outline" className="font-mono text-[11px]">
                        {p}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{r.responsibilities}</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {filtered.clinical.length > 0 && (
          <Section icon={Stethoscope} title="Клинический поток">
            <RouteList items={filtered.clinical} />
          </Section>
        )}

        {filtered.patient.length > 0 && (
          <Section icon={User} title="Пациентский поток">
            <RouteList items={filtered.patient} />
          </Section>
        )}

        {filtered.bot.length > 0 && (
          <Section icon={Bot} title="Бот и запись">
            <RouteList items={filtered.bot} />
          </Section>
        )}

        {filtered.admin.length > 0 && (
          <Section icon={Building2} title="Администрирование">
            <RouteList items={filtered.admin} />
          </Section>
        )}

        {filtered.sys.length > 0 && (
          <Section icon={Server} title="Системный контур">
            <RouteList items={filtered.sys} />
          </Section>
        )}

        {!isSearching && (
          <Section icon={Lock} title="Политика данных">
            <ul className="space-y-1.5 text-[12px]">
              {DATA_POLICY.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] italic text-muted-foreground">
              Демо-контур: данные мок, интеграции и сетевые вызовы отсутствуют. На бэкенд-этапе политика будет реализована технически: разделение хранилищ, маскирование, аудит, протоколирование доступа.
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}

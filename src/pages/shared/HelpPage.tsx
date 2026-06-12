import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Users, Stethoscope, User, Bot, Building2, Server, Lock, Search, X, ChevronDown, ChevronUp, Check, Ban } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RouteRef {
  path: string;
  description: string;
}

const ROUTE_LABELS: Record<string, string> = {
  "/desk": "Рабочий стол",
  "/patients": "Пациенты",
  "/patients/:id": "Карточка пациента",
  "/patients/:id/visits/:visitId": "Рабочая область визита",
  "/patients/:id/lesions/:lesionId": "Карточка образования",
  "/capture": "Съёмка",
  "/me": "Личный кабинет",
  "/me/reports": "Заключения",
  "/me/reports/:id": "Заключение",
  "/me/booking": "Запись на приём",
  "/me/reminders": "Напоминания",
  "/bot-sim": "Помощник записи",
  "/bot-sim/miniapp/booking": "Форма записи",
  "/operator": "Очередь оператора",
  "/operator/dialogs/:id": "Диалог с пользователем",
  "/admin": "Операционный центр",
  "/admin/doctors": "Врачи",
  "/admin/services": "Услуги",
  "/admin/clinics": "Клиники",
  "/admin/integrations": "Интеграции",
  "/admin/bot": "Помощник записи",
  "/admin/analytics": "Аналитика",
  "/admin/governance": "Управление доступом",
  "/sys/users": "Пользователи",
  "/sys/devices": "Устройства",
  "/sys/audit": "Журнал событий",
  "/sys/api-keys": "Ключи доступа",
};

function routeLabel(path: string) {
  return ROUTE_LABELS[path] ?? path;
}

interface RoleRef {
  title: string;
  responsibilities: string;
  routes: string[];
  safe: string[];
  forbidden: string[];
}

const ROLES: RoleRef[] = [
  {
    title: "Врач / Ассистент",
    responsibilities:
      "Ведение визита, документация образований, дерматоскопия, клинические шкалы, итоговое заключение.",
    routes: ["/desk", "/patients", "/capture"],
    safe: [
      "Документировать образования и снимки.",
      "Использовать автоматическую подсказку как помощь врачу.",
      "Формировать заключение и пациентский отчёт.",
    ],
    forbidden: [
      "Передавать автоматическую подсказку как окончательный диагноз.",
      "Отправлять снимки во внешние мессенджеры или учётные системы.",
      "Работать с реальными данными пациентов в учебном контуре.",
    ],
  },
  {
    title: "Администратор клиники",
    responsibilities:
      "Доктора, услуги, расписание, маршрутизация, интеграции, настройки помощника записи, аналитика клиники.",
    routes: ["/admin", "/admin/doctors", "/admin/services", "/admin/clinics", "/admin/integrations", "/admin/bot", "/admin/analytics", "/admin/governance"],
    safe: [
      "Управлять докторами, услугами и расписанием.",
      "Настраивать маршрутизацию заявок и тексты помощника записи.",
      "Смотреть агрегированную аналитику клиники.",
    ],
    forbidden: [
      "Открывать клинические карточки и снимки.",
      "Менять врачебные заключения.",
      "Выгружать медицинские данные во внешние учётные системы.",
    ],
  },
  {
    title: "Оператор поддержки",
    responsibilities:
      "Наблюдение за обращениями, помощь с записью, передача в клинику. Не ставит диагноз.",
    routes: ["/operator"],
    safe: [
      "Помогать с записью и навигацией по помощнику записи.",
      "Эскалировать сложные случаи в клинику.",
      "Отвечать в безопасных формулировках.",
    ],
    forbidden: [
      "Интерпретировать снимки или автоматическую подсказку.",
      "Давать медицинские рекомендации.",
      "Запрашивать у пациента ПДн сверх необходимого.",
    ],
  },
  {
    title: "Системный администратор",
    responsibilities:
      "Пользователи и роли, устройства, журнал действий, ключи доступа. Безопасность и настройка контура.",
    routes: ["/sys/users", "/sys/devices", "/sys/audit", "/sys/api-keys"],
    safe: [
      "Назначать роли и управлять доступами.",
      "Подключать устройства и ключи доступа для интеграций.",
      "Просматривать журнал действий.",
    ],
    forbidden: [
      "Открывать клинические данные пациентов.",
      "Хранить ключи и секреты во фронтенде.",
      "Отключать аудит и логирование доступа.",
    ],
  },
  {
    title: "Пациент",
    responsibilities:
      "Личный кабинет: безопасные заключения, запись, напоминания. Без врачебных деталей и технических деталей подсказки.",
    routes: ["/me", "/me/reports", "/me/booking", "/me/reminders"],
    safe: [
      "Смотреть пациент-безопасные заключения.",
      "Записываться на приём и принимать напоминания.",
      "Загружать снимки только по запросу врача или клиники.",
    ],
    forbidden: [
      "Видеть технические детали подсказки и врачебные пометки.",
      "Получать диагноз от помощника записи автоматически.",
      "Делиться чужими медицинскими данными.",
    ],
  },
];

const CLINICAL: RouteRef[] = [
  { path: "/desk", description: "Очередь визитов и приоритеты дня." },
  { path: "/patients", description: "Список пациентов с фильтрами." },
  { path: "/patients/:id", description: "Карточка пациента: визиты, образования, история." },
  { path: "/patients/:id/visits/:visitId", description: "Рабочая область визита: анамнез, карта тела, снимки, оценка, заключение, отчёт." },
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
  { path: "/bot-sim", description: "Учебный помощник записи: путь от фото к заявке." },
  { path: "/bot-sim/miniapp/booking", description: "Форма записи на приём." },
  { path: "/operator", description: "Консоль оператора поддержки." },
  { path: "/operator/dialogs/:id", description: "Диалог с пользователем помощника записи." },
];

const ADMIN_ROUTES: RouteRef[] = [
  { path: "/admin", description: "Главная администратора клиники." },
  { path: "/admin/doctors", description: "Доктора и расписание." },
  { path: "/admin/services", description: "Услуги, тарифы, длительности." },
  { path: "/admin/clinics", description: "Клиники и филиалы." },
  { path: "/admin/integrations", description: "Внешние учётные системы и мессенджеры." },
  { path: "/admin/bot", description: "Настройки помощника записи, тексты, маршрутизация." },
  { path: "/admin/analytics", description: "Аналитика клиники." },
  { path: "/admin/governance", description: "Правила доступа, сеансы пациента, сроки хранения, журнал решений." },
];

const SYS_ROUTES: RouteRef[] = [
  { path: "/sys/users", description: "Пользователи и назначения ролей." },
  { path: "/sys/devices", description: "Дерматоскопы, локальная связь устройства, локальная передача." },
  { path: "/sys/audit", description: "Журнал событий и доступа." },
  { path: "/sys/api-keys", description: "Ключи доступа интеграций." },
];

const DATA_POLICY = [
  "Никаких медицинских персональных данных во внешние учётные системы и мессенджеры.",
  "Снимки не передаются во внешние системы — только защищённые ссылки.",
  "Во внешнюю учётную систему не уходит диагноз: только статус заявки и факт записи.",
  "Технические детали автоматической подсказки остаются в клинической рабочей области.",
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
            className="inline-flex min-h-[44px] items-center text-[12px] font-medium text-primary hover:underline focus:outline-none focus-visible:underline sm:min-h-0"
          >
            {routeLabel(r.path)}
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

const ANCHORS = [
  { id: "roles", label: "Роли" },
  { id: "clinical", label: "Клинический поток" },
  { id: "patient", label: "Пациентский поток" },
  { id: "bot", label: "Помощник записи" },
  { id: "admin", label: "Администрирование" },
  { id: "sys", label: "Системный контур" },
  { id: "policy", label: "Правила данных" },
] as const;

function matchRoute(r: RouteRef, q: string) {
  return (
    r.path.toLowerCase().includes(q) ||
    routeLabel(r.path).toLowerCase().includes(q) ||
    r.description.toLowerCase().includes(q)
  );
}

function matchRole(r: RoleRef, q: string) {
  return (
    r.title.toLowerCase().includes(q) ||
    r.responsibilities.toLowerCase().includes(q) ||
    r.routes.some((p) => p.toLowerCase().includes(q)) ||
    r.safe.some((s) => s.toLowerCase().includes(q)) ||
    r.forbidden.some((s) => s.toLowerCase().includes(q))
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
      <PageHeader title="Справка" subtitle="Роли, маршруты и границы текущей версии" />

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
                className="flex min-h-11 w-full items-center justify-between gap-2 text-left font-medium focus:outline-none focus-visible:underline"
              >
                <span>Безопасность и границы текущей версии</span>
                {bannerOpen ? (
                  <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
                )}
              </button>
              {bannerOpen && (
                <ul id="safety-banner-body" className="mt-1 space-y-1">
                  <li>Проверка доступа на экране — учебная, а не реальная граница безопасности.</li>
                  <li>Не используйте реальные данные пациентов в учебном контуре.</li>
                  <li>Автоматическая подсказка — только помощь врачу, не диагноз.</li>
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
            placeholder="Поиск по ролям и разделам, например: визит, запись, оператор"
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

        <nav aria-label="Разделы справки" className="flex flex-wrap gap-1.5">
          {ANCHORS.map((a) => {
            const available =
              (a.id === "roles" && filtered.roles.length > 0) ||
              (a.id === "clinical" && filtered.clinical.length > 0) ||
              (a.id === "patient" && filtered.patient.length > 0) ||
              (a.id === "bot" && filtered.bot.length > 0) ||
              (a.id === "admin" && filtered.admin.length > 0) ||
              (a.id === "sys" && filtered.sys.length > 0) ||
              (a.id === "policy" && !isSearching);
            return (
              <a
                key={a.id}
                href={`#${a.id}`}
                aria-disabled={!available}
                onClick={(e) => {
                  if (!available) {
                    e.preventDefault();
                    return;
                  }
                  e.preventDefault();
                  document.getElementById(a.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`inline-flex min-h-11 items-center rounded-md border px-2.5 text-[12px] transition-colors ${
                  available
                    ? "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                    : "pointer-events-none border-dashed border-border/60 text-muted-foreground/60"
                }`}
              >
                {a.label}
              </a>
            );
          })}
        </nav>

        {nothingFound && (
          <Card className="p-4 text-[12px] text-muted-foreground">
            Ничего не найдено по запросу «{query}». Попробуйте другое ключевое слово.
          </Card>
        )}

        {filtered.roles.length > 0 && (
          <Section id="roles" icon={Users} title="Роли">
            <ul className="divide-y divide-border">
              {filtered.roles.map((r) => (
                <li key={r.title} className="py-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13px] font-medium">{r.title}</span>
                    {r.routes.map((p) => (
                      <Badge key={p} variant="outline" className="text-[11px]">
                        {routeLabel(p)}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{r.responsibilities}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div
                      className="rounded-md border px-2.5 py-2"
                      style={{
                        background: "hsl(var(--success) / 0.06)",
                        borderColor: "hsl(var(--success) / 0.25)",
                      }}
                    >
                      <div
                        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: "hsl(var(--success))" }}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden /> Можно
                      </div>
                      <ul className="mt-1 space-y-1 text-[12px]">
                        {r.safe.map((s) => (
                          <li key={s} className="flex items-start gap-1.5">
                            <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div
                      className="rounded-md border px-2.5 py-2"
                      style={{
                        background: "hsl(var(--destructive) / 0.06)",
                        borderColor: "hsl(var(--destructive) / 0.25)",
                      }}
                    >
                      <div
                        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
                        style={{ color: "hsl(var(--destructive))" }}
                      >
                        <Ban className="h-3.5 w-3.5" aria-hidden /> Нельзя
                      </div>
                      <ul className="mt-1 space-y-1 text-[12px]">
                        {r.forbidden.map((s) => (
                          <li key={s} className="flex items-start gap-1.5">
                            <span aria-hidden className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {filtered.clinical.length > 0 && (
          <Section id="clinical" icon={Stethoscope} title="Клинический поток">
            <RouteList items={filtered.clinical} />
          </Section>
        )}

        {filtered.patient.length > 0 && (
          <Section id="patient" icon={User} title="Пациентский поток">
            <RouteList items={filtered.patient} />
          </Section>
        )}

        {filtered.bot.length > 0 && (
          <Section id="bot" icon={Bot} title="Помощник записи">
            <RouteList items={filtered.bot} />
          </Section>
        )}

        {filtered.admin.length > 0 && (
          <Section id="admin" icon={Building2} title="Администрирование">
            <RouteList items={filtered.admin} />
          </Section>
        )}

        {filtered.sys.length > 0 && (
          <Section id="sys" icon={Server} title="Системный контур">
            <RouteList items={filtered.sys} />
          </Section>
        )}

        {!isSearching && (
          <Section id="policy" icon={Lock} title="Правила данных">
            <ul className="space-y-1.5 text-[12px]">
              {DATA_POLICY.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <span aria-hidden className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] italic text-muted-foreground">
              Учебный контур: данные условные, интеграции и сетевые вызовы отсутствуют. В рабочем контуре это закрывается технически: разделением хранилищ, маскированием, журналом действий и протоколированием доступа.
            </p>
          </Section>
        )}
      </div>
    </div>
  );
}

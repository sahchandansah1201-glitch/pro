import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLINICS,
  getAnalysisCards,
  getDialogs,
  getLeads,
} from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────────────
// Безопасные шаблоны (RU). Все формулировки — без диагнозов и обещаний.
// ─────────────────────────────────────────────────────────────────────

type TemplateKey =
  | "greeting"
  | "photo_instruction"
  | "quality_failed"
  | "safe_recommendation"
  | "booking_cta"
  | "operator_escalation"
  | "follow_up";

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  greeting: "Приветствие",
  photo_instruction: "Инструкция по фото",
  quality_failed: "Не прошло проверку качества",
  safe_recommendation: "Безопасная рекомендация",
  booking_cta: "Призыв к записи",
  operator_escalation: "Эскалация на оператора",
  follow_up: "Напоминание о повторе",
};

const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  greeting:
    "Здравствуйте. Это бот клиники «Дерма-Про». Помогу подготовить материалы для очного приёма. Это не диагноз, решение принимает врач.",
  photo_instruction:
    "Сделайте снимок при ровном дневном свете, без вспышки, на расстоянии ~15 см. Кадр без бликов и теней. Это нужно только для подготовки к очному осмотру.",
  quality_failed:
    "Снимок не подходит для предварительной оценки. Пожалуйста, повторите фото по инструкции. Это не диагноз: решение всё равно принимает врач очно.",
  safe_recommendation:
    "Спасибо. Рекомендуем очный осмотр у дерматолога. Это не диагноз — итоговое решение принимает врач после личного приёма.",
  booking_cta:
    "Можно записаться на ближайший приём в партнёрской клинике. Запись подтвердит администратор.",
  operator_escalation:
    "Передаю диалог оператору поддержки. Он поможет с записью и ответит на вопросы. Медицинские выводы делает только врач.",
  follow_up:
    "Напоминание: рекомендован контрольный осмотр. Это не диагноз — оценку состояния делает врач очно.",
};

// ─────────────────────────────────────────────────────────────────────
// Меню бота
// ─────────────────────────────────────────────────────────────────────

type MenuKey =
  | "new_analysis"
  | "instruction"
  | "why"
  | "booking"
  | "help"
  | "about";

interface MenuItem {
  key: MenuKey;
  label: string;
  purpose: string;
  enabled: boolean;
}

const DEFAULT_MENU: MenuItem[] = [
  { key: "new_analysis", label: "Новый анализ", purpose: "Запуск сценария подготовки фото", enabled: true },
  { key: "instruction", label: "Инструкция", purpose: "Как сделать корректный снимок", enabled: true },
  { key: "why", label: "Зачем это", purpose: "Объяснение цели и ограничений", enabled: true },
  { key: "booking", label: "Запись", purpose: "Переход к записи в клинику", enabled: true },
  { key: "help", label: "Помощь", purpose: "Передача оператору поддержки", enabled: true },
  { key: "about", label: "О проекте", purpose: "Кратко о клинике и о боте", enabled: true },
];

// ─────────────────────────────────────────────────────────────────────
// Аудит (локальный, без сети)
// ─────────────────────────────────────────────────────────────────────

interface AuditEntry {
  id: string;
  ts: string;
  text: string;
}

function nowIso() {
  return new Date().toISOString();
}

// ─────────────────────────────────────────────────────────────────────
// Страница
// ─────────────────────────────────────────────────────────────────────

export default function AdminBotSettingsPage() {
  const [menu, setMenu] = useState<MenuItem[]>(DEFAULT_MENU);
  const [templates, setTemplates] =
    useState<Record<TemplateKey, string>>(DEFAULT_TEMPLATES);
  const [defaultClinicId, setDefaultClinicId] = useState<string>(
    CLINICS[0]?.id ?? "",
  );
  const [urgentClinicId, setUrgentClinicId] = useState<string>(
    CLINICS[0]?.id ?? "",
  );
  const [audit, setAudit] = useState<AuditEntry[]>([
    {
      id: "init",
      ts: nowIso(),
      text: "Открыт раздел «Настройки бота» (локальная сессия, без отправки).",
    },
  ]);
  const [dryRun, setDryRun] = useState<string | null>(null);

  // KPI — только агрегаты
  const kpi = useMemo(() => {
    const dialogs = getDialogs();
    const leads = getLeads();
    const cards = getAnalysisCards();
    const total = dialogs.length;
    const active = dialogs.filter((d) => d.state !== "closed").length;
    const botLeads = leads.filter(
      (l) => l.source === "telegram" || l.source === "whatsapp",
    ).length;
    const repeat = cards.filter((c) => c.ctaType === "repeat_photo").length;
    const urgent = cards.filter(
      (c) => c.routingRisk === "high" || c.routingRisk === "urgent",
    ).length;
    return { total, active, botLeads, repeat, urgent };
  }, []);

  function appendAudit(text: string) {
    setAudit((a) => [
      { id: `${Date.now()}-${a.length}`, ts: nowIso(), text },
      ...a,
    ].slice(0, 30));
  }

  function toggleMenu(key: MenuKey) {
    setMenu((items) =>
      items.map((it) =>
        it.key === key ? { ...it, enabled: !it.enabled } : it,
      ),
    );
    const item = menu.find((m) => m.key === key);
    if (item) {
      appendAudit(
        `Пункт меню «${item.label}» — ${item.enabled ? "выключен" : "включён"} (локально).`,
      );
    }
  }

  function updateTemplate(key: TemplateKey, value: string) {
    setTemplates((t) => ({ ...t, [key]: value }));
  }

  function resetTemplates() {
    setTemplates(DEFAULT_TEMPLATES);
    appendAudit("Шаблоны сброшены к значениям по умолчанию (локально).");
  }

  function checkMenu() {
    const enabled = menu.filter((m) => m.enabled).length;
    appendAudit(`Проверка меню: включено ${enabled} из ${menu.length} пунктов.`);
  }

  function checkTemplates() {
    const need = ["safe_recommendation", "quality_failed", "follow_up"] as const;
    const ok = need.every((k) =>
      /это не диагноз|решение принимает врач/i.test(templates[k]),
    );
    appendAudit(
      ok
        ? "Проверка шаблонов: все ключевые шаблоны содержат безопасную оговорку."
        : "Проверка шаблонов: в одном из ключевых шаблонов отсутствует безопасная оговорка.",
    );
  }

  function buildDryRun() {
    const payload = {
      event: "bot.settings.dry_run",
      menu: menu.filter((m) => m.enabled).map((m) => m.key),
      templatesChecked: true,
      routing: {
        defaultClinicId,
        urgentClinicId,
      },
      externalCalls: false,
      sendsMessages: false,
    };
    setDryRun(JSON.stringify(payload, null, 2));
    appendAudit("Сформирован DryRun-сценарий (локально, без отправки).");
  }

  const greetingPreview = templates.greeting;
  const qualityFailedPreview = templates.quality_failed;
  const safeRecommendationPreview = templates.safe_recommendation;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Настройки бота"
        subtitle="Меню, безопасные шаблоны, маршрутизация и эскалация"
      />

      {/* Safety banner */}
      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
        MVP: реальные Telegram API и рассылки отключены. Бот не ставит диагноз.
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Kpi label="Всего диалогов" value={kpi.total} />
        <Kpi label="Активные диалоги" value={kpi.active} />
        <Kpi label="Лиды из бота" value={kpi.botLeads} />
        <Kpi label="Нужен повтор фото" value={kpi.repeat} />
        <Kpi label="Срочная маршрутизация" value={kpi.urgent} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* LEFT — настройки */}
        <div className="min-w-0 space-y-6">
          {/* Меню бота */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Меню бота</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {menu.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start justify-between gap-3 rounded-md border bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-[12px] text-muted-foreground">
                      {item.purpose}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={item.enabled ? "default" : "secondary"}>
                      {item.enabled ? "вкл" : "выкл"}
                    </Badge>
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={() => toggleMenu(item.key)}
                      aria-label={`Переключить пункт меню «${item.label}»`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Шаблоны */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Безопасные шаблоны</CardTitle>
              <Button size="sm" variant="outline" onClick={resetTemplates}>
                Сбросить шаблоны
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-[12px] text-muted-foreground">
                Шаблоны не отправляются пользователям в MVP. Любые правки —
                только в локальной сессии.
              </p>
              {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((k) => (
                <div key={k} className="space-y-1.5">
                  <Label htmlFor={`tpl-${k}`} className="text-[13px]">
                    {TEMPLATE_LABELS[k]}
                  </Label>
                  <Textarea
                    id={`tpl-${k}`}
                    value={templates[k]}
                    onChange={(e) => updateTemplate(k, e.target.value)}
                    rows={3}
                    className="font-normal"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Маршрутизация и эскалация */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Маршрутизация и эскалация
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <RuleRow
                cond="Качество фото < 80% или есть замечания"
                action="Запросить повторное фото"
              />
              <RuleRow
                cond="Маршрутизация: high / urgent"
                action="Передать оператору + приоритетная запись"
              />
              <RuleRow
                cond="Пользователь просит помощь"
                action="Передать оператору"
              />
              <RuleRow
                cond="Пропущено напоминание о повторе"
                action="Передать оператору на ревью"
              />
              <RuleRow
                cond="Диалог закрыт"
                action="Никаких автоматических действий"
              />

              <Separator />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[13px]">Клиника по умолчанию</Label>
                  <Select
                    value={defaultClinicId}
                    onValueChange={(v) => {
                      setDefaultClinicId(v);
                      appendAudit(`Клиника по умолчанию изменена на ${v}.`);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINICS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">
                    Клиника для срочных случаев
                  </Label>
                  <Select
                    value={urgentClinicId}
                    onValueChange={(v) => {
                      setUrgentClinicId(v);
                      appendAudit(`Срочная клиника изменена на ${v}.`);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLINICS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Реальный routing engine будет на этапе backend.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — превью + аудит */}
        <div className="min-w-0 space-y-6">
          {/* Превью */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Превью бота</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mx-auto w-full max-w-[320px] rounded-2xl border bg-background p-3 shadow-sm">
                <div className="mb-2 text-center text-[11px] text-muted-foreground">
                  Локальное превью · сообщения не отправляются
                </div>
                <div className="space-y-2">
                  <BubbleBot text={greetingPreview} />
                  <BubbleBot text={qualityFailedPreview} />
                  <BubbleBot text={safeRecommendationPreview} />
                  <Button
                    size="sm"
                    className="w-full"
                    disabled
                    aria-label="Демо-кнопка записи, в MVP неактивна"
                  >
                    Записаться (демо)
                  </Button>
                </div>
                <Separator className="my-3" />
                <div className="text-[11px] text-muted-foreground">
                  Активные пункты меню:{" "}
                  {menu
                    .filter((m) => m.enabled)
                    .map((m) => m.label)
                    .join(" · ") || "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Демо-аудит */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Демо-аудит</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={checkMenu}>
                  Проверить меню
                </Button>
                <Button size="sm" variant="outline" onClick={checkTemplates}>
                  Проверить шаблоны
                </Button>
                <Button size="sm" onClick={buildDryRun}>
                  Сформировать DryRun сценария
                </Button>
              </div>

              {dryRun && (
                <pre className="max-h-64 overflow-auto rounded-md border bg-muted/40 p-2 text-[11px] leading-snug">
                  {dryRun}
                </pre>
              )}

              <div className="space-y-1">
                <div className="text-[12px] font-medium text-muted-foreground">
                  Журнал действий (локально)
                </div>
                <ul className="max-h-64 space-y-1 overflow-auto text-[12px]">
                  {audit.map((a) => (
                    <li
                      key={a.id}
                      className="rounded border bg-card px-2 py-1"
                    >
                      <span className="text-muted-foreground">
                        {new Date(a.ts).toLocaleTimeString("ru-RU")}
                      </span>{" "}
                      — {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Вспомогательные компоненты
// ─────────────────────────────────────────────────────────────────────

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function RuleRow({ cond, action }: { cond: string; action: string }) {
  return (
    <div className="grid gap-1 rounded-md border bg-card px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-3">
      <div className="text-[13px]">
        <span className="text-muted-foreground">Условие: </span>
        {cond}
      </div>
      <div className="hidden text-muted-foreground sm:block">→</div>
      <div className="text-[13px]">
        <span className="text-muted-foreground">Действие: </span>
        {action}
      </div>
    </div>
  );
}

function BubbleBot({ text }: { text: string }) {
  return (
    <div className="max-w-[90%] rounded-2xl rounded-bl-sm border bg-muted/40 px-3 py-2 text-[12px] leading-snug">
      {text}
    </div>
  );
}

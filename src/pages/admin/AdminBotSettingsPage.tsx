import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  dryRunAdminClinicBotSettings,
  listAdminClinicBotSettings,
  updateAdminClinicBotSettings,
  type AdminClinicBotSettingsDTO,
} from "@/lib/self-hosted-admin-api";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}


const LIVE_BOT_STEPS = [
  { id: "consent", label: "Согласие и ограничение" },
  { id: "location", label: "Локализация" },
  { id: "timeline", label: "Срок и изменение" },
  { id: "photo", label: "Фото" },
  { id: "booking", label: "Запись" },
];

const LIVE_TEMPLATE_LABELS: Record<string, string> = {
  greeting: "Приветствие",
  photoInstruction: "Инструкция по фото",
  operatorHandoff: "Передача оператору",
  bookingText: "Запись на приём",
};

const LIVE_DEFAULT_TEMPLATES: Record<string, string> = {
  greeting: "Здравствуйте. Помогу подготовить данные для записи к врачу.",
  photoInstruction: "Сделайте общий снимок и крупный план при ровном свете.",
  operatorHandoff: "Передаю обращение оператору клиники для организационной помощи.",
  bookingText: "Выберите удобное время, администратор подтвердит запись.",
};

function botPayload(settings: AdminClinicBotSettingsDTO | null, templates: Record<string, string>, steps: Record<string, boolean>, enabled: boolean) {
  return {
    clinicId: settings?.clinicId ?? "",
    enabled,
    intakeSteps: steps,
    templates,
  };
}

function AdminBotSettingsPageLive() {
  const session = useSelfHostedApiSession();
  const [items, setItems] = useState<AdminClinicBotSettingsDTO[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [steps, setSteps] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LIVE_BOT_STEPS.map((step) => [step.id, true])),
  );
  const [templates, setTemplates] = useState<Record<string, string>>(LIVE_DEFAULT_TEMPLATES);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.clinicId === selectedClinicId) ?? items[0] ?? null,
    [items, selectedClinicId],
  );

  async function load() {
    setLoading(true);
    const result = await listAdminClinicBotSettings({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken });
    setLoading(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    const nextItems = result.value ?? [];
    setItems(nextItems);
    const first = nextItems[0];
    if (first) {
      setSelectedClinicId((current) => current || first.clinicId);
      setEnabled(first.enabled);
      setSteps({ ...Object.fromEntries(LIVE_BOT_STEPS.map((step) => [step.id, true])), ...first.intakeSteps });
      setTemplates({ ...LIVE_DEFAULT_TEMPLATES, ...first.templates });
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  useEffect(() => {
    if (!selected) return;
    setEnabled(selected.enabled);
    setSteps({ ...Object.fromEntries(LIVE_BOT_STEPS.map((step) => [step.id, true])), ...selected.intakeSteps });
    setTemplates({ ...LIVE_DEFAULT_TEMPLATES, ...selected.templates });
  }, [selected]);

  async function saveSettings() {
    if (!selected) {
      setNote("Клиника не выбрана.");
      return;
    }
    setBusy(true);
    const result = await updateAdminClinicBotSettings({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: botPayload(selected, templates, steps, enabled),
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setNote(`Настройки помощника записи сохранены: ${result.value?.clinicName ?? selected.clinicName}`);
    await load();
  }

  async function dryRunSettings() {
    if (!selected) {
      setNote("Клиника не выбрана.");
      return;
    }
    setBusy(true);
    const result = await dryRunAdminClinicBotSettings({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: botPayload(selected, templates, steps, enabled),
    });
    setBusy(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setNote(`Пробный сценарий проверен: ${result.value?.clinicName ?? selected.clinicName}`);
    await load();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Помощник записи" subtitle="Сценарий сбора обращения, записи и передачи оператору." />
      <div className="space-y-3 p-3 sm:p-4">
        <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Рабочий режим: настройки сохраняются в базе клиники. Пробная проверка не отправляет сообщения пациентам.
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card className="p-3">
            <div className="text-[13px] font-semibold">Клиники</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{items.length}</div>
            <div className="text-[12px] text-muted-foreground">доступны для настройки</div>
          </Card>
          <Card className="p-3">
            <div className="text-[13px] font-semibold">Сценарий</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{LIVE_BOT_STEPS.filter((step) => steps[step.id]).length}</div>
            <div className="text-[12px] text-muted-foreground">активных шагов</div>
          </Card>
          <Card className="p-3">
            <div className="text-[13px] font-semibold">Статус</div>
            <div className="mt-2 text-[18px] font-semibold">{enabled ? "Включён" : "Остановлен"}</div>
            <div className="text-[12px] text-muted-foreground">{selected?.lastDryRunAt ? `проверка ${formatTime(selected.lastDryRunAt)}` : "проверки ещё нет"}</div>
          </Card>
        </div>

        <Card className="p-3">
          <div className="mb-3">
            <h2 className="text-[14px] font-semibold">Настройки сценария</h2>
            <p className="text-[12px] text-muted-foreground">Выберите клинику, включите нужные шаги и сохраните шаблоны сообщений.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
            <select
              aria-label="Клиника помощника записи"
              value={selectedClinicId}
              onChange={(event) => setSelectedClinicId(event.target.value)}
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[14px]"
            >
              {items.length === 0 && <option value="">Клиника не выбрана</option>}
              {items.map((item) => (
                <option key={item.clinicId} value={item.clinicId}>
                  {item.clinicName}
                </option>
              ))}
            </select>
            <label className="flex min-h-11 items-center gap-2 text-[13px]">
              <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
              Помощник записи включён для клиники
            </label>
            <Input aria-label="Название выбранной клиники" value={selected?.clinicName ?? ""} readOnly className="h-11" />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
            {LIVE_BOT_STEPS.map((step) => (
              <label key={step.id} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 py-2 text-[12px]">
                <input
                  type="checkbox"
                  checked={steps[step.id] !== false}
                  onChange={(event) => setSteps((current) => ({ ...current, [step.id]: event.target.checked }))}
                />
                {step.label}
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-3">
          <h2 className="text-[14px] font-semibold">Шаблоны сообщений</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Object.entries(LIVE_TEMPLATE_LABELS).map(([key, label]) => (
              <label key={key} className="block text-[12px] font-medium">
                {label}
                <Textarea
                  aria-label={label}
                  value={templates[key] ?? ""}
                  onChange={(event) => setTemplates((current) => ({ ...current, [key]: event.target.value }))}
                  className="mt-1 min-h-24"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" className="min-h-[44px]" onClick={saveSettings} disabled={busy || loading}>
              Сохранить настройки
            </Button>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={dryRunSettings} disabled={busy || loading}>
              Проверить сценарий
            </Button>
          </div>
        </Card>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminBotSettingsPage() {
  const session = useSelfHostedApiSession();
  return <AdminBotSettingsPageLive key={session.revision} />;
}

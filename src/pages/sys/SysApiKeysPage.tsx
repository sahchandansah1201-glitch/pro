import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

/**
 * Sys Service Keys — сервисные ключи интеграций (учебный режим).
 * SAFETY: только маскированные значения. Никогда не генерируем настоящие
 * секреты, не используем clipboard и не делаем сетевых вызовов.
 */

const DEMO_BANNER =
  "Учебный режим. Рабочие роли, аудит, ключи и мост устройств включаются после подключения системы клиники.";

type Status = "active" | "rotating" | "disabled";
const STATUS_LABEL: Record<Status, string> = {
  active: "Активен",
  rotating: "Ротация",
  disabled: "Отозван",
};
const STATUS_TONE: Record<Status, string> = {
  active: "hsl(var(--success))",
  rotating: "hsl(var(--warning))",
  disabled: "hsl(var(--destructive))",
};

interface KeyRow {
  id: string;
  label: string;
  masked: string;
  owner: string;
  env: "demo" | "staging";
  status: Status;
  lastUsedAt: string | null;
  expiresAt: string | null;
  scopes: string[];
}

const ROWS: KeyRow[] = [
  {
    id: "key-001",
    label: "Дерматолог Про · сервис",
    masked: "ключ •••• 01",
    owner: "Платформа · клинические сервисы",
    env: "demo",
    status: "active",
    lastUsedAt: "2026-03-13T08:55:00Z",
    expiresAt: "2026-09-01T00:00:00Z",
    scopes: ["read:visits", "read:reports", "write:appointments"],
  },
  {
    id: "key-002",
    label: "Мост устройств · локальный",
    masked: "ключ •••• 02",
    owner: "Мост устройств · клиника",
    env: "demo",
    status: "rotating",
    lastUsedAt: "2026-03-13T09:01:00Z",
    expiresAt: "2026-04-15T00:00:00Z",
    scopes: ["device:heartbeat", "device:upload"],
  },
  {
    id: "key-003",
    label: "CRM коннектор",
    masked: "ключ •••• 03",
    owner: "Система заявок",
    env: "staging",
    status: "disabled",
    lastUsedAt: "2026-02-28T15:00:00Z",
    expiresAt: null,
    scopes: ["lead:create", "lead:update"],
  },
];

const ENV_LABEL: Record<KeyRow["env"], string> = {
  demo: "учебная",
  staging: "проверочная",
};

const SCOPE_LABEL: Record<string, string> = {
  "read:visits": "читать визиты",
  "read:reports": "читать отчёты",
  "write:appointments": "создавать записи",
  "device:heartbeat": "проверять связь устройств",
  "device:upload": "передавать снимки",
  "lead:create": "создавать заявки",
  "lead:update": "обновлять заявки",
};

function scopeLabel(scopes: string[]): string {
  return scopes.map((scope) => SCOPE_LABEL[scope] ?? "служебное право").join(", ");
}

export default function SysApiKeysPage() {
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Сервисные ключи" subtitle="Доступы для интеграций и внутренних сервисов." />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{DEMO_BANNER}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            variant="outline"
            className="h-9 min-h-[44px] sm:min-h-[32px]"
            onClick={() => setNote("Создание ключа появится после подключения системы клиники. В учебном режиме ключи не генерируются.")}
          >
            Создать ключ
          </Button>
        </div>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        {/* Active keys */}
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Активные ключи
          </h2>

          {/* Desktop */}
          <Card className="hidden p-0 md:block">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Ключ</th>
                  <th className="px-3 py-2">Маска</th>
                  <th className="px-3 py-2">Владелец и права</th>
                  <th className="px-3 py-2">Среда</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2">Последнее использование</th>
                  <th className="px-3 py-2">Действует до</th>
                  <th className="px-3 py-2">Права доступа</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{r.label}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{r.masked}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.owner}</td>
                    <td className="px-3 py-2 text-muted-foreground">{ENV_LABEL[r.env]}</td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ color: STATUS_TONE[r.status], border: `1px solid ${STATUS_TONE[r.status]}` }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.lastUsedAt ? formatDateTime(r.lastUsedAt) : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.expiresAt ? formatDateTime(r.expiresAt) : "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{scopeLabel(r.scopes)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() => setNote(`Обновление ключа «${r.label}» — учебное действие.`)}
                        >
                          Обновить
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() => setNote(`Отзыв ключа «${r.label}» — учебное действие.`)}
                        >
                          Отозвать
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {ROWS.map((r) => (
              <Card key={r.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{r.label}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">{r.masked}</div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{ color: STATUS_TONE[r.status], border: `1px solid ${STATUS_TONE[r.status]}` }}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Владелец</dt>
                  <dd className="text-right">{r.owner}</dd>
                  <dt className="text-muted-foreground">Среда</dt>
                  <dd className="text-right">{ENV_LABEL[r.env]}</dd>
                  <dt className="text-muted-foreground">Последнее использование</dt>
                  <dd className="text-right">{r.lastUsedAt ? formatDateTime(r.lastUsedAt) : "—"}</dd>
                  <dt className="text-muted-foreground">Действует до</dt>
                  <dd className="text-right">{r.expiresAt ? formatDateTime(r.expiresAt) : "—"}</dd>
                  <dt className="text-muted-foreground">Права</dt>
                  <dd className="text-right">{scopeLabel(r.scopes)}</dd>
                </dl>
                <div className="mt-3 flex flex-col gap-1.5">
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(`Обновление ключа «${r.label}» — учебное действие.`)}>
                    Обновить
                  </Button>
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(`Отзыв ключа «${r.label}» — учебное действие.`)}>
                    Отозвать
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Rotation policy */}
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Политика ротации
          </h2>
          <Card className="p-3 text-[12px] text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              <li>Плановое обновление: каждые 90 дней для рабочих ключей, 30 дней для внешних подключений.</li>
              <li>Внеплановая ротация: при смене владельца сервиса или признаках компрометации.</li>
              <li>Ключи выдаются с минимальными правами и ограничены средой использования.</li>
            </ul>
          </Card>
        </section>

        {/* Data policy */}
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Политика данных
          </h2>
          <Card className="p-3 text-[12px] text-muted-foreground">
            По умолчанию во внешние интеграции не передаются: персональные медицинские данные,
            фотографии, тексты заключений и детали машинной обработки. Используются только
            защищённые действия и краткое безопасное описание для пациента.
          </Card>
        </section>
      </div>
    </div>
  );
}

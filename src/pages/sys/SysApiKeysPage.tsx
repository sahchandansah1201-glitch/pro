import { useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { isProductionAppMode } from "@/lib/app-mode";
import { formatDateTime } from "@/lib/format";
import { clearSelfHostedApiSession, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  createAdminServiceKey,
  isAdminSessionExpiredError,
  listAdminServiceKeys,
  revokeAdminServiceKey,
  rotateAdminServiceKey,
  type AdminServiceKeyDTO,
} from "@/lib/self-hosted-admin-api";

const DEMO_BANNER =
  "Учебный режим. Рабочие роли, аудит, ключи и мост устройств включаются после подключения системы клиники.";

const SERVICE_KEY_SCOPES = [
  { value: "device:write", label: "Передача снимков с приборов" },
  { value: "booking:write", label: "Запись и заявки" },
  { value: "directory:read", label: "Чтение справочников" },
  { value: "audit:read", label: "Чтение журнала" },
];

const EXPIRY_OPTIONS = [
  { value: 30, label: "30 дней" },
  { value: 90, label: "90 дней" },
  { value: 180, label: "180 дней" },
];

function scopeLabel(scope: string): string {
  return SERVICE_KEY_SCOPES.find((item) => item.value === scope)?.label ?? "ограниченное действие";
}

function statusLabel(status: AdminServiceKeyDTO["status"]): string {
  return status === "revoked" ? "Отозван" : "Работает";
}

function statusTone(status: AdminServiceKeyDTO["status"]): "default" | "secondary" {
  return status === "revoked" ? "secondary" : "default";
}

function DemoSysApiKeysPage() {
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Служебные ключи" subtitle="Доступы для интеграций и внутренних служб." />
      <div className="space-y-3 p-3 sm:p-4">
        <div role="status" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-900">
          {DEMO_BANNER}
        </div>
        <Card className="p-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
            <div>
              <h2 className="text-[14px] font-semibold">Учебная витрина ключей</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                В учебном режиме настоящие ключи не создаются и не сохраняются.
              </p>
              <Button className="mt-3 min-h-11" variant="outline" onClick={() => setNote("Рабочие ключи создаются только после входа в систему клиники.")}>
                Проверить действие
              </Button>
            </div>
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

function SysApiKeysPageLive() {
  const session = useSelfHostedApiSession();
  const [items, setItems] = useState<AdminServiceKeyDTO[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [oneTimeSecret, setOneTimeSecret] = useState<string | null>(null);
  const [form, setForm] = useState({
    label: "",
    owner: "",
    expiresInDays: 90,
    scopes: ["device:write"],
  });

  const activeCount = useMemo(() => items.filter((item) => item.status === "active").length, [items]);
  const revokedCount = useMemo(() => items.filter((item) => item.status === "revoked").length, [items]);

  function handleError(error: Parameters<typeof adminApiErrorText>[0]) {
    if (isAdminSessionExpiredError(error)) setSessionExpired(true);
    setNote(adminApiErrorText(error));
  }

  function goToLogin() {
    clearSelfHostedApiSession();
    window.location.assign("/self-hosted/login");
  }

  async function load(nextQuery = query) {
    setLoading(true);
    const result = await listAdminServiceKeys({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      search: nextQuery,
    });
    setLoading(false);
    if (!result.ok) {
      handleError(result.error);
      return;
    }
    setItems(result.value ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  function toggleScope(scope: string) {
    setForm((current) => {
      const hasScope = current.scopes.includes(scope);
      const next = hasScope ? current.scopes.filter((item) => item !== scope) : [...current.scopes, scope];
      return { ...current, scopes: next };
    });
  }

  async function submitCreate() {
    if (sessionExpired) return;
    const label = form.label.trim();
    const owner = form.owner.trim();
    if (!label || !owner) {
      setNote("Укажите название ключа и владельца.");
      return;
    }
    if (form.scopes.length === 0) {
      setNote("Выберите хотя бы одну область доступа.");
      return;
    }
    setBusy(true);
    setOneTimeSecret(null);
    const result = await createAdminServiceKey({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: {
        label,
        owner,
        scopes: form.scopes,
        expiresInDays: form.expiresInDays,
      },
    });
    setBusy(false);
    if (!result.ok) {
      handleError(result.error);
      return;
    }
    setOneTimeSecret(result.value?.secretOnce ?? null);
    setNote(`Ключ создан: ${result.value?.label ?? label}. Значение показано один раз.`);
    setForm((current) => ({ ...current, label: "", owner: "" }));
    await load();
  }

  async function rotate(item: AdminServiceKeyDTO) {
    if (sessionExpired) return;
    setBusy(true);
    setOneTimeSecret(null);
    const result = await rotateAdminServiceKey({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      keyId: item.id,
      payload: { expiresInDays: 90 },
    });
    setBusy(false);
    if (!result.ok) {
      handleError(result.error);
      return;
    }
    setOneTimeSecret(result.value?.secretOnce ?? null);
    setNote(`Ключ обновлён: ${result.value?.label ?? item.label}. Новое значение показано один раз.`);
    await load();
  }

  async function revoke(item: AdminServiceKeyDTO) {
    if (sessionExpired) return;
    setBusy(true);
    setOneTimeSecret(null);
    const result = await revokeAdminServiceKey({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      keyId: item.id,
    });
    setBusy(false);
    if (!result.ok) {
      handleError(result.error);
      return;
    }
    setNote(`Ключ отозван: ${result.value?.label ?? item.label}.`);
    await load();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Служебные ключи" subtitle="Рабочие доступы для приборов, заявок и внутренних подключений." />
      <div className="space-y-3 p-3 sm:p-4">
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Рабочий режим: значения ключей показываются только один раз при создании или обновлении. В списке хранится только маска.
        </div>

        {sessionExpired && (
          <Card role="alert" className="border-amber-300 bg-amber-50 p-3 text-amber-900">
            <div className="text-[13px] font-semibold">Сессия истекла</div>
            <p className="mt-1 text-[12px]">Ключи не меняются, пока вы не войдёте заново.</p>
            <Button type="button" className="mt-3 min-h-11" onClick={goToLogin}>
              Войти заново
            </Button>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <Card className="p-3">
            <div className="text-[12px] font-semibold text-muted-foreground">Рабочие ключи</div>
            <div className="mt-2 text-2xl font-semibold">{activeCount}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[12px] font-semibold text-muted-foreground">Отозванные ключи</div>
            <div className="mt-2 text-2xl font-semibold">{revokedCount}</div>
          </Card>
          <Card className="p-3">
            <div className="text-[12px] font-semibold text-muted-foreground">Защита значений</div>
            <div className="mt-2 text-[14px] font-semibold">исходные значения не сохраняются</div>
          </Card>
        </div>

        <Card className="p-3">
          <div className="mb-1 text-[13px] font-semibold">Создать служебный ключ</div>
          <p className="mb-3 text-[12px] text-muted-foreground">
            Используйте отдельный ключ для каждого прибора, внешней записи или служебного подключения.
          </p>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_180px]">
            <Input
              value={form.label}
              onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
              placeholder="Название ключа"
              aria-label="Название служебного ключа"
              className="min-h-11"
              disabled={busy || sessionExpired}
            />
            <Input
              value={form.owner}
              onChange={(event) => setForm((current) => ({ ...current, owner: event.target.value }))}
              placeholder="Владелец или назначение"
              aria-label="Владелец или назначение"
              className="min-h-11"
              disabled={busy || sessionExpired}
            />
            <select
              value={form.expiresInDays}
              onChange={(event) => setForm((current) => ({ ...current, expiresInDays: Number(event.target.value) }))}
              aria-label="Срок действия ключа"
              className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
              disabled={busy || sessionExpired}
            >
              {EXPIRY_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2" aria-label="Области доступа служебного ключа">
            {SERVICE_KEY_SCOPES.map((scope) => (
              <label key={scope.value} className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-[13px]">
                <input
                  type="checkbox"
                  checked={form.scopes.includes(scope.value)}
                  onChange={() => toggleScope(scope.value)}
                  disabled={busy || sessionExpired}
                />
                <span>{scope.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" className="min-h-11" onClick={submitCreate} disabled={busy || sessionExpired}>
              Создать ключ
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => void load()} disabled={busy}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
              Обновить список
            </Button>
          </div>
        </Card>

        {oneTimeSecret && (
          <Card role="status" aria-live="polite" className="border-emerald-300 bg-emerald-50 p-3 text-emerald-950">
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-4 w-4" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold">Новый ключ показан один раз</div>
                <p className="mt-1 text-[12px]">Сохраните его в защищённом месте. После скрытия на экране останется только маска.</p>
                <code className="mt-2 block overflow-x-auto rounded bg-white px-2 py-2 text-[12px]">{oneTimeSecret}</code>
                <Button type="button" variant="outline" className="mt-3 min-h-11 bg-white" onClick={() => setOneTimeSecret(null)}>
                  Скрыть ключ
                </Button>
              </div>
            </div>
          </Card>
        )}

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        <Card className="p-3">
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[14px] font-semibold">Список служебных ключей</h2>
              <p className="text-[12px] text-muted-foreground">Показаны только маски и области доступа. Исходные значения не выводятся.</p>
            </div>
            <Input
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                void load(value);
              }}
              placeholder="Поиск по названию или владельцу"
              aria-label="Поиск служебных ключей"
              className="min-h-11 lg:max-w-sm"
              disabled={busy}
            />
          </div>

          {loading ? (
            <div className="rounded-md border border-dashed border-border p-4 text-[13px] text-muted-foreground">Загружаем служебные ключи…</div>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-[13px] text-muted-foreground">
              Служебных ключей пока нет. Создайте отдельный ключ для первого рабочего подключения.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  role="region"
                  aria-label={`Служебный ключ ${item.label}`}
                  className="rounded-md border border-border bg-background p-3"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-[14px] font-semibold">{item.label}</div>
                        <Badge variant={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground">Владелец: {item.owner}</div>
                      <div className="mt-1 font-mono text-[12px] text-muted-foreground">{item.masked}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" className="min-h-11" onClick={() => rotate(item)} disabled={busy || sessionExpired}>
                        Обновить ключ
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => revoke(item)}
                        disabled={busy || sessionExpired || item.status === "revoked"}
                      >
                        Отозвать ключ
                      </Button>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-1 gap-2 text-[12px] md:grid-cols-2 xl:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">Доступ</dt>
                      <dd>{item.scopes.map(scopeLabel).join(", ")}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Последнее использование</dt>
                      <dd>{item.lastUsedAt ? formatDateTime(item.lastUsedAt) : "не использовался"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Действует до</dt>
                      <dd>{item.expiresAt ? formatDateTime(item.expiresAt) : "без срока"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Создан</dt>
                      <dd>{item.createdAt ? formatDateTime(item.createdAt) : "нет данных"}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-3 text-[12px] text-muted-foreground">
          Значения ключей не записываются в интерфейс и не попадают в список. Для проверки состояния сервера используйте{" "}
          <Link to="/sys/self-hosted-ops" className="font-medium text-foreground underline">
            Рабочий контур
          </Link>
          .
        </Card>
      </div>
    </div>
  );
}

export default function SysApiKeysPage() {
  return isProductionAppMode() ? <SysApiKeysPageLive /> : <DemoSysApiKeysPage />;
}

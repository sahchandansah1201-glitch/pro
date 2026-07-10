import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import {
  getSelfHostedClinicBookingRequest,
  updateSelfHostedClinicBookingRequest,
  type SelfHostedApiError,
  type SelfHostedClinicBookingRequestDTO,
} from "@/lib/self-hosted-clinic-booking-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

const STATUS_LABEL: Record<string, string> = {
  requested: "Новая",
  reviewing: "В работе",
  booked: "Записана",
  cancelled: "Отменена",
};

export default function OperatorDialogPageLive() {
  const { id = "" } = useParams();
  const session = useSelfHostedApiSession();
  const [request, setRequest] = useState<SelfHostedClinicBookingRequestDTO | null>(null);
  const [clinicNote, setClinicNote] = useState("");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<SelfHostedApiError | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const baseArgs = useMemo(
    () => ({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    }),
    [session.apiBaseUrl, session.apiToken],
  );
  const isConfigured = isSelfHostedApiConfigured(session);

  const loadRequest = useCallback(async () => {
    if (!isConfigured) {
      setError({
        kind: "not_configured",
        code: "not_configured",
        message: "Для карточки обращения нужен вход в систему клиники.",
      });
      setLoadStatus("error");
      return;
    }

    setLoadStatus("loading");
    const result = await getSelfHostedClinicBookingRequest({
      ...baseArgs,
      requestId: id,
    });
    if (result.ok && result.value) {
      setRequest(result.value);
      setClinicNote(result.value.clinicNote || "");
      setError(null);
      setLoadStatus("ready");
      return;
    }

    setRequest(null);
    setError(result.error);
    setLoadStatus("error");
  }, [baseArgs, id, isConfigured]);

  useEffect(() => {
    void loadRequest();
  }, [loadRequest]);

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = clinicNote.trim();
    if (!note) {
      setValidationMessage("Введите заметку клиники.");
      return;
    }
    if (!request) return;

    setValidationMessage("");
    setSaving(true);
    const takeIntoWork = request.status === "requested";
    const result = await updateSelfHostedClinicBookingRequest({
      ...baseArgs,
      requestId: request.id,
      payload: {
        ...(takeIntoWork ? { status: "reviewing" as const } : {}),
        clinicNote: note,
      },
    });
    setSaving(false);

    if (result.ok && result.value) {
      setRequest(result.value);
      setClinicNote(result.value.clinicNote || note);
      setActionMessage(
        takeIntoWork
          ? "Заметка сохранена. Обращение взято в работу."
          : "Заметка сохранена.",
      );
      setError(null);
      return;
    }

    setActionMessage("");
    setError(result.error);
  }

  const subtitle = session.user?.displayName
    ? `${session.user.displayName} · обработка заявки на запись`
    : "Обработка заявки на запись";

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Карточка обращения"
        subtitle={subtitle}
        actions={
          <Button asChild size="sm" variant="outline" className="min-h-11 text-[12px]">
            <Link to="/operator/booking-requests">
              <ArrowLeft className="h-4 w-4" aria-hidden /> К запросам
            </Link>
          </Button>
        }
      />

      <main className="flex-1 space-y-5 overflow-auto px-4 py-5 sm:px-6">
        <section
          role="status"
          aria-live="polite"
          className="surface-card flex items-center justify-between gap-3 px-4 py-3 text-row"
        >
          <span>
            {loadStatus === "loading"
              ? "Загружаем обращение…"
              : loadStatus === "error"
                ? "Обращение недоступно."
                : "Данные обращения загружены из системы клиники."}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 text-[12px]"
            onClick={() => void loadRequest()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Обновить
          </Button>
        </section>

        {error && (
          <section role="alert" className="surface-card border-destructive/30 px-4 py-3 text-row text-destructive">
            {publicBookingMessage(error)}
          </section>
        )}

        {request && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="overflow-hidden">
              <header className="section-bar">
                <h2 className="h-section">Заявка пациента</h2>
                <span className="h-section-hint">{STATUS_LABEL[request.status] || request.status}</span>
              </header>
              <div className="space-y-4 p-4">
                <div>
                  <div className="text-[15px] font-semibold">{request.patient.fullName || "Пациент"}</div>
                  <div className="text-meta">Номер пациента скрыт</div>
                </div>
                <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-meta">Предпочтительное время</dt>
                    <dd className="mt-1 text-foreground">{formatMaybeDate(request.preferredFrom)}</dd>
                  </div>
                  <div>
                    <dt className="text-meta">Клиника</dt>
                    <dd className="mt-1 text-foreground">{request.clinic.name || "Не указана"}</dd>
                  </div>
                </dl>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-[13px]">
                  <div className="text-meta">Причина обращения</div>
                  <div className="mt-1 text-foreground">{request.reason || "Не указана"}</div>
                </div>
                <form className="space-y-3" onSubmit={saveNote} noValidate>
                  <label className="grid gap-1 text-[12px] font-medium">
                    Заметка клиники
                    <Textarea
                      aria-label="Заметка клиники по обращению"
                      value={clinicNote}
                      onChange={(event) => setClinicNote(event.target.value)}
                      maxLength={1000}
                      rows={5}
                      className="min-h-[120px]"
                    />
                  </label>
                  <p className="text-meta">Заметка доступна сотрудникам клиники и не отправляется пациенту.</p>
                  {validationMessage && <div role="alert" className="text-[13px] text-destructive">{validationMessage}</div>}
                  <Button type="submit" size="sm" className="min-h-11" disabled={saving}>
                    {saving ? "Сохраняем…" : "Сохранить заметку"}
                  </Button>
                  {actionMessage && <div role="status" aria-live="polite" className="text-[13px] text-muted-foreground">{actionMessage}</div>}
                </form>
              </div>
            </Card>

            <aside className="space-y-5">
              <Card className="p-4 text-[13px]">
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Границы данных
                </div>
                <p className="mt-2 text-muted-foreground">
                  Здесь отображаются только данные, необходимые для записи. Служебные коды и данные подключения скрыты.
                </p>
              </Card>
              <Card className="p-4 text-[13px]">
                <div className="text-meta">Статус</div>
                <div className="mt-1 font-medium">{STATUS_LABEL[request.status] || request.status}</div>
                <div className="mt-3 text-meta">Обновлено</div>
                <div className="mt-1">{formatMaybeDate(request.updatedAt)}</div>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function publicBookingMessage(error: SelfHostedApiError | null): string {
  if (!error) return "Не удалось загрузить обращение.";
  if (error.code === "not_found" || error.status === 404) return "Обращение не найдено или недоступно для вашей клиники.";
  if (error.code === "forbidden" || error.status === 403) return "Недостаточно прав для просмотра обращения.";
  if (error.code === "validation_error") return "Проверьте заметку и повторите сохранение.";
  return error.message || "Не удалось загрузить обращение.";
}

function formatMaybeDate(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "Не указано";
}

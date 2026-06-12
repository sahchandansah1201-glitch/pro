const WORKER_STATUS_LABEL: Record<string, string> = {
  online: "Служба на связи",
  degraded: "Связь нестабильна",
  offline: "Служба не в сети",
  unknown: "Связь не проверена",
  ready: "Готово",
  ok: "Готово",
  blocked: "Блокер",
  warning: "Требует внимания",
  needs_review: "Нужен разбор",
  ready_for_production: "Готово к работе",
  ready_for_rollout: "Готово к включению",
  ready_for_handoff: "Готово к передаче",
  in_review: "На разборе",
};

const COMMAND_STATUS_LABEL: Record<string, string> = {
  queued: "В очереди",
  acknowledged: "Принята",
  completed: "Выполнена",
  failed: "Ошибка",
  cancelled: "Отменена",
};

const POLL_BACKOFF_LABEL: Record<string, string> = {
  "linear-capped": "линейная задержка с ограничением",
};

const RECOVERY_STATE_LABEL: Record<string, string> = {
  retryable_failed: "можно повторить",
  active: "активно",
};

export function sysDeviceStatusLabel(value: string | undefined): string {
  if (!value) return "нет данных";
  return (
    WORKER_STATUS_LABEL[value] ??
    COMMAND_STATUS_LABEL[value] ??
    {
      passed: "Пройдено",
      attention: "Требует внимания",
      ready: "Готово",
      failed: "Ошибка",
      active: "Активно",
    }[value] ??
    "неизвестно"
  );
}

export function pollBackoffLabel(value: string | undefined): string {
  if (!value) return "не указана";
  return POLL_BACKOFF_LABEL[value] ?? "неизвестно";
}

export function recoveryStateLabel(value: string | undefined): string {
  if (!value) return "активно";
  return RECOVERY_STATE_LABEL[value] ?? "неизвестно";
}

type PublicError = {
  code?: string;
  details?: Array<{ field?: string; message: string }>;
  kind?: string;
  message?: string;
  status?: number;
};

export function selfHostedPublicErrorText(
  error: PublicError | null | undefined,
  fallback = "Действие не выполнено.",
): string {
  if (!error) return fallback;
  if (error.code === "placement_conflict") {
    return "Точка уже была изменена. Обновите запись очага перед повторным исправлением.";
  }
  if (error.code === "idempotency_conflict") {
    return "Этот запрос уже использован для другой точки. Обновите карту и повторите добавление.";
  }
  const fields = new Set(error.details?.map((item) => item.field).filter(Boolean));
  if (fields.has("bodyMap.regionId")) {
    return "Точка находится вне выбранной области. Выберите область на модели и поставьте точку заново.";
  }
  if (
    fields.has("bodyMap.atlasSource")
    || fields.has("bodyMap.atlasProfileId")
    || fields.has("bodyMap")
    || fields.has("bodyMap.view")
    || fields.has("bodyRegionId")
  ) {
    return "Модель тела не совпадает с данными пациента или настройками системы. Обновите страницу и поставьте точку заново.";
  }
  if (error.details?.length) return "Проверьте заполненные данные и повторите действие.";
  if (isSelfHostedSessionExpiredError(error)) return "Сессия истекла. Выйдите и войдите в систему заново.";
  if (error.status === 404 || /not_found$/.test(error.code)) {
    return "Запись не найдена или недоступна для текущей клиники.";
  }
  if (error.status === 403 || error.code === "forbidden") return "Недостаточно прав для действия в системе клиники.";
  if (error.code === "database_unavailable" || /database is unavailable/i.test(error.message ?? "")) {
    return "Рабочая база временно недоступна или обновляется. Повторите действие после завершения обновления.";
  }
  if (error.code === "database_not_configured" || /database is not configured/i.test(error.message ?? "")) {
    return "Рабочая база не подключена. Проверьте настройки системы клиники.";
  }
  if (error.kind === "network") return "Система клиники временно недоступна. Повторите попытку.";
  if (error.kind === "not_configured" || error.code === "not_configured") {
    return "Войдите в систему клиники, чтобы выполнить действие.";
  }
  return fallback;
}

function isSelfHostedSessionExpiredError(error: PublicError): boolean {
  return (
    error.status === 401 ||
    error.code === "invalid_token" ||
    error.code === "token_expired" ||
    /expired authorization token|invalid or expired authorization token/i.test(error.message ?? "")
  );
}

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
  if (error.details?.length) return error.details.map((item) => item.message).join(" ");
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
  return sanitizeSelfHostedPublicText(error.message || fallback);
}

function isSelfHostedSessionExpiredError(error: PublicError): boolean {
  return (
    error.status === 401 ||
    error.code === "invalid_token" ||
    error.code === "token_expired" ||
    /expired authorization token|invalid or expired authorization token/i.test(error.message ?? "")
  );
}

function sanitizeSelfHostedPublicText(message: string): string {
  return message
    .replace(/self-hosted backend/gi, "система клиники")
    .replace(/self-hosted/gi, "система клиники")
    .replace(/\bbackend\b/gi, "система клиники")
    .replace(/\bPostgreSQL\b/gi, "рабочая база")
    .trim();
}

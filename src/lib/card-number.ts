/**
 * Преобразует внутренний код пациента (например, "DP-2026-0004") в безопасную
 * для отображения подпись «карта 0004». Внутренний код не должен показываться
 * в основном клиническом UI как идентификатор системы.
 */
export function formatCardNumber(code?: string | null): string {
  if (!code) return "номер скрыт";
  const match = code.match(/^DP-\d{4}-(\d+)$/);
  return match ? `карта ${match[1]}` : `карта ${code}`;
}

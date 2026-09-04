// Малые форматтеры для UI. Чисто презентационные, без бизнес-логики.

const DATE_FMT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const DATE_TIME_FMT = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_FMT.format(d);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return DATE_TIME_FMT.format(d);
}

/** Возраст в полных годах по ISO YYYY-MM-DD. */
export function calcAge(birthDateIso: string | null | undefined): number | null {
  if (!isValidIsoDate(birthDateIso)) return null;
  const d = new Date(`${birthDateIso}T00:00:00Z`);
  const now = new Date();
  if (d > now) return null;
  let years = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) years -= 1;
  return years;
}

export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const SEX_LABELS = { male: "М", female: "Ж" } as const;
export function sexShort(sex: "male" | "female" | null | undefined): string {
  return sex ? SEX_LABELS[sex] : "Не указан";
}

export function formatAge(birthDateIso: string | null | undefined): string {
  const age = calcAge(birthDateIso);
  return age == null ? "Возраст не указан" : `${age} лет`;
}

export function consentLabel(value: boolean | null | undefined): string {
  if (value == null) return "Не зафиксировано";
  return value ? "Есть" : "Нет";
}

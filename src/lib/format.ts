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
export function calcAge(birthDateIso: string): number {
  const d = new Date(birthDateIso);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) years -= 1;
  return years;
}

const SEX_LABELS = { male: "М", female: "Ж" } as const;
export function sexShort(sex: "male" | "female"): string {
  return SEX_LABELS[sex];
}

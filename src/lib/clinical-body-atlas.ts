export type ClinicalBodyAgeBand =
  | "infant"
  | "early_child"
  | "child"
  | "adolescent"
  | "late_adolescent"
  | "adult";

export type ClinicalBodySex = "female" | "male";

export type ClinicalBodyView = "front" | "back" | "left" | "right" | "scalp";

export interface ClinicalBodyProfile {
  sex: ClinicalBodySex;
  ageBand: ClinicalBodyAgeBand;
}

export function currentClinicalBodyAtlasIso(): string {
  return new Date().toISOString();
}

export function clinicalBodyProfileFromAge(
  sex: ClinicalBodySex,
  ageYears: number,
): ClinicalBodyProfile {
  if (ageYears < 1) return { sex, ageBand: "infant" };
  if (ageYears < 5) return { sex, ageBand: "early_child" };
  if (ageYears < 10) return { sex, ageBand: "child" };
  if (ageYears < 15) return { sex, ageBand: "adolescent" };
  if (ageYears < 18) return { sex, ageBand: "late_adolescent" };
  return { sex, ageBand: "adult" };
}

export function clinicalBodyProfileLabel(profile: ClinicalBodyProfile): string {
  const { ageBand, sex } = profile;
  if (ageBand === "infant") {
    return `Младенец · ${sex === "female" ? "девочка" : "мальчик"} · до 1 года`;
  }
  if (ageBand === "early_child") {
    return `Ребёнок · ${sex === "female" ? "девочка" : "мальчик"} · 1–4 года`;
  }
  if (ageBand === "child") {
    return `Ребёнок · ${sex === "female" ? "девочка" : "мальчик"} · 5–9 лет`;
  }
  if (ageBand === "adolescent") {
    return `Подросток · ${sex === "female" ? "девочка" : "мальчик"} · 10–14 лет`;
  }
  if (ageBand === "late_adolescent") {
    return `Подросток · ${sex === "female" ? "девушка" : "юноша"} · 15–17 лет`;
  }
  return sex === "female"
    ? "Женщина · 18 лет и старше"
    : "Мужчина · 18 лет и старше";
}

export type ClinicalBodyAgeBand =
  | "infant"
  | "early_child"
  | "child"
  | "adolescent"
  | "late_adolescent"
  | "adult"
  | "older_adult";

export type ClinicalBodySex = "female" | "male";

export type ClinicalBodyView = "front" | "back" | "left" | "right" | "scalp";

export interface ClinicalBodyProfile {
  sex: ClinicalBodySex;
  ageBand: ClinicalBodyAgeBand;
}

export const CLINICAL_BODY_ATLAS_WIDTH = 240;
export const CLINICAL_BODY_ATLAS_HEIGHT = 400;

const PROFILE_ASSET_NAME: Record<
  ClinicalBodyAgeBand,
  Record<ClinicalBodySex, string>
> = {
  infant: {
    female: "infant_female_1",
    male: "infant_male_1",
  },
  early_child: {
    female: "early_child_female_3",
    male: "early_child_male_3",
  },
  child: {
    female: "child_female_7",
    male: "child_male_7",
  },
  adolescent: {
    female: "adolescent_female_13",
    male: "adolescent_male_13",
  },
  late_adolescent: {
    female: "late_adolescent_female_16",
    male: "late_adolescent_male_16",
  },
  adult: {
    female: "adult_female_30",
    male: "adult_male_30",
  },
  older_adult: {
    female: "older_female_70",
    male: "older_male_70",
  },
};

export type ClinicalBodyAtlasSource = "makehuman-cc0" | "daz-hires-local";

export function clinicalBodyAtlasSource(): ClinicalBodyAtlasSource {
  return import.meta.env.VITE_CLINICAL_BODY_ATLAS_SOURCE === "daz-hires-local"
    ? "daz-hires-local"
    : "makehuman-cc0";
}

export function clinicalBodyProfileAssetName(profile: ClinicalBodyProfile): string {
  return PROFILE_ASSET_NAME[profile.ageBand][profile.sex];
}

export function clinicalBodyAtlasAssetPath(
  profile: ClinicalBodyProfile,
  view: Exclude<ClinicalBodyView, "scalp">,
): string {
  const assetName = clinicalBodyProfileAssetName(profile);
  return clinicalBodyAtlasSource() === "daz-hires-local"
    ? `/clinical-body-atlas-daz-local/${assetName}-${view}.png`
    : `/clinical-body-atlas/${assetName}-${view}.webp`;
}

export function clinicalBodyRegionHitMapPath(
  profile: ClinicalBodyProfile,
  view: Exclude<ClinicalBodyView, "scalp">,
): string {
  const assetName = clinicalBodyProfileAssetName(profile);
  const directory = clinicalBodyAtlasSource() === "daz-hires-local"
    ? "clinical-body-atlas-daz-local"
    : "clinical-body-atlas-regions";
  return `/${directory}/${assetName}-${view}.hitmap.svg`;
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
  if (ageYears >= 65) return { sex, ageBand: "older_adult" };
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
  if (ageBand === "older_adult") {
    return sex === "female"
      ? "Женщина · 65 лет и старше"
      : "Мужчина · 65 лет и старше";
  }
  return sex === "female"
    ? "Женщина · 18–64 года"
    : "Мужчина · 18–64 года";
}

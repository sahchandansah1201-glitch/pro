export const CLINICAL_BODY_ATLAS_PROFILE_NAMES = [
  "infant_female_1",
  "infant_male_1",
  "early_child_female_3",
  "early_child_male_3",
  "child_female_7",
  "child_male_7",
  "adolescent_female_13",
  "adolescent_male_13",
  "late_adolescent_female_16",
  "late_adolescent_male_16",
  "adult_female_30",
  "adult_male_30",
  "older_female_70",
  "older_male_70",
];

export const CLINICAL_BODY_ATLAS_VIEWS = ["front", "back", "left", "right"];

export const CLINICAL_BODY_ATLAS_ASSET_PATHS =
  CLINICAL_BODY_ATLAS_PROFILE_NAMES.flatMap((profile) =>
    CLINICAL_BODY_ATLAS_VIEWS.map(
      (view) => `clinical-body-atlas-daz-local/${profile}-${view}.png`,
    ),
  );

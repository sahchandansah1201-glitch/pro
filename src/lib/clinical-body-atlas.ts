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

const OWNER_APPROVED_MANIFEST_SHA256 =
  "0afadcfdfffb5a6a23e7061ca2fc48eba951e32395eecdde8313e846fac4c741";
const SCALP_REGION_MAP_SHA256 =
  "5ae52826ffe1e09fe58305bff43f26f04395dd1feecd1b8e17811569c0ccd1eb";
const BODY_REGION_MAP_SHA256: Record<string, string> = {
  "adolescent_female_13:back": "d95c0ff7f4c0fe50b8778025c21e0e488339df507d95344b4e190e9c6980da85",
  "adolescent_female_13:front": "2cee8a2ffc1033176172a027297d7478f23a07ecc1fcaad7d8ac7ae7691bf8fd",
  "adolescent_female_13:left": "ec095d9a8812c31a6dc71892d37f6c7233a85cec13b875fb21d683ed4c2eca2c",
  "adolescent_female_13:right": "21a665139fc580d1dcb74383917c8ba911d6ca302758faa6d476149ba1aa2ae8",
  "adolescent_male_13:back": "766fb6fe6d407d8ceeaac39ff63066fe762191bec6cf2cdfd3e6acb539ca0ef3",
  "adolescent_male_13:front": "ad4b0cb05e2b7e7a20080129a7ec57bed92d3c0fb251274e0ee98e12ada84990",
  "adolescent_male_13:left": "5e15f7541b72bbb696f367648b27509fcea4a042ab1d9a9f6390694c3cec4934",
  "adolescent_male_13:right": "67b7ccc4c90c80ac3725b774277f3b0b9ac69a321aeac96ca7d105052e932598",
  "adult_female_30:back": "aeeb35f2487f42784ed30464773df69ee1e5e2ff14ea3199419247f6b6ae836b",
  "adult_female_30:front": "ee7817333ef02099a0cd01cafc495e7c126b62e367e8f2ff4caf69c9a26405a0",
  "adult_female_30:left": "e369634e219ab3bd0c2ecf4fdbcabc843776eb8f0fa401e322e53a9be1c23ea8",
  "adult_female_30:right": "68a0acb470d0dcb9574b0c84ef7bbe2fcd6214ef7ae1f3c46ec32d71ff761787",
  "adult_male_30:back": "22122bb98de4425cd0df5fb6a095efa3ffa75ede0cf473b25469f27705eead53",
  "adult_male_30:front": "7312427a78133592567f88ffc3ef5665bf132ddf74e2328fbb20f2db5e6f9a33",
  "adult_male_30:left": "81592001802005b85f0e34b23c2bff6812d4dc8e1f0a3dda603a6a23d154d381",
  "adult_male_30:right": "b410c145df6d62f26d9cf3766c23de8f1231cdb800b6742558d863024ae5e490",
  "child_female_7:back": "8076439ddc552ef3ddc5f2a8c865d1cfd146fdaf198245d3ee12fba86a18f313",
  "child_female_7:front": "c2d85742615bba3d7ec0975f97479ccae44dfdb1bf9e43e34442e1b0088b934c",
  "child_female_7:left": "a74cdaed4931efc1b3b81ece26131337548e984f80fa9f6e41aabc556dbba953",
  "child_female_7:right": "04e9de180159f7c2a2aa4c6abbe572e18d5dd183740866c6391a4d0fe405245d",
  "child_male_7:back": "112d2df6a8a9ef6bdd4860c8598938a34a98f7142489123321a3393241256e8b",
  "child_male_7:front": "378cdb31b73e80cbee5e04c37cfa0d8bd83f0b0967a3f957fd2d89a307ed636a",
  "child_male_7:left": "1b13c167150dd9296650948981639c23b78e9335395a1bd3d1aae1ed5a4acf8a",
  "child_male_7:right": "f889a03aa41dd722a8691ecd38e3211523e3be98436be0ffc774ec57a4ce7f68",
  "early_child_female_3:back": "0192c9ed477d249f05ca2963625ddf88e6058a9a3bd84fb745d77ec25c70ff03",
  "early_child_female_3:front": "0dcbcd76f7985dd30c0570de359ac0cd26ebb5835b2b979096b57b8f8cd37043",
  "early_child_female_3:left": "a83f7a87456c41c837d5061185b5249462a7d8c0765c76f08d429a2f95c1c92b",
  "early_child_female_3:right": "4fcdda85714e73d58aa0092f3602bb6a3667fc2ec0b94b719556b765b3d7f7c2",
  "early_child_male_3:back": "1881f681f22d294479310dfbdfd4c530fb06388c2243b165572abd0a32ed77f2",
  "early_child_male_3:front": "289cfc38f3de69a1c57a481f5bdb99d2641379d2ca69cc30780a1c554a445caf",
  "early_child_male_3:left": "7c472637db537653b969af97037643481d00bbd822708c172df291abeb09d8a9",
  "early_child_male_3:right": "4d46d946df923723c60339ae0e91f9e2e06378312d16fc057aabde78437c4d76",
  "infant_female_1:back": "02086d4c25ea0bf9505ee4763cad1516ac1bbd29e2cbd9da1efb6059e719879a",
  "infant_female_1:front": "3229e3ed3224ce6b89f114a33be9e7823ec112c72d1dc7b3cffd05e21cbd2252",
  "infant_female_1:left": "0300e98fa0b96f937a96707ad1190ffe74bb031d63a8369a7fd9d186edb1eae5",
  "infant_female_1:right": "4e742a9c768008dd8404ffe2feebbc5177fa3e353fc39ca1c4e3f2612ecef7e0",
  "infant_male_1:back": "5892c6e64d4fbb4c3f9aa52ac0f2aabd2bbee83d8950a0c32f254086e4306563",
  "infant_male_1:front": "4536c3bc3602c836f9f1109e2534a8f13ff7499de6076603b66c3d6a1e3dfe77",
  "infant_male_1:left": "64a106a8c9b4d8ac8e600d4feb7ac3d019dd992158b3323827833e9c3f82109c",
  "infant_male_1:right": "9889c61b4bd2a80388d470a35be587539324671b2801b03718aa40d60f40e7be",
  "late_adolescent_female_16:back": "393b1643d52ff685578b50a942ea1596cc6a33127267fecc5352622e8d997492",
  "late_adolescent_female_16:front": "e18e06250fbd8f1e8abd88d7536a2b5c7b4c1116ecb8f1ace53cf0bdf950e378",
  "late_adolescent_female_16:left": "42b2cf1c0734b1774a49fd54f742bd955c3a70864ef3c7261e7e387f8c9164e1",
  "late_adolescent_female_16:right": "9fbe405755eb8229716ce8c07cc7c6e4ad63c72e01976d7685d00b8ecf741647",
  "late_adolescent_male_16:back": "b8fa4c1950214d7b2644ae4f3fcbf96e90f137655e224a2d49effcbcc050219f",
  "late_adolescent_male_16:front": "b71fc67a5c88cc5884b3d5e78bf06a4cc9dfcf70d613181c599c0ff9a22d52cf",
  "late_adolescent_male_16:left": "585dff12c559f8e11266ebd4853058ef90907c6dabf804546b7e6680b8e100a3",
  "late_adolescent_male_16:right": "487c731e253150277144c47ba4efb6b8baaa06d7116a08d7e2745d7474267f9f",
  "older_female_70:back": "e81c2f9454a8c8af2a7a82c84c4f80ede2590f0495f1f637ff7ef47a509dfe09",
  "older_female_70:front": "89a25f0b211b4bd01d5f784d0fe188eef700a456509c2ee1cefc7c96bec037d8",
  "older_female_70:left": "3ec17761f5c7d2016f99c0cf8a90b9b5adbb34457405f2a6487f8dc4d4d87503",
  "older_female_70:right": "f9cc244aafa8457129ab15c70bd467bde8170795587935154773b154ba575bb1",
  "older_male_70:back": "1e045c085a33e00041c368e122da97264cc8358dbdc68a5892d53c200c995074",
  "older_male_70:front": "0bafcc7669d5bef83b75d5d4fd4e939469c4bdbff9680288d28a5c3b6d54087a",
  "older_male_70:left": "80fc82268a39b77ce8b3efb3a1ec11902b0ffe7497320986c78679917632ef69",
  "older_male_70:right": "44aad89218dcdc2d94aa3a3b7b7aeec317de368fbc73209d4cabe6230d2a9eab",
};

export function clinicalBodyAtlasSource(): ClinicalBodyAtlasSource {
  return "daz-hires-local";
}

export function clinicalBodyAtlasManifestSha256(): string {
  return OWNER_APPROVED_MANIFEST_SHA256;
}

export function clinicalBodyRegionMapSha256(
  profile: ClinicalBodyProfile,
  view: ClinicalBodyView,
): string | null {
  if (view === "scalp") return SCALP_REGION_MAP_SHA256;
  return BODY_REGION_MAP_SHA256[`${clinicalBodyProfileAssetName(profile)}:${view}`] ?? null;
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

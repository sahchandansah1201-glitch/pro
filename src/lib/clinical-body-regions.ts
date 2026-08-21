import type { ClinicalBodyView } from "@/lib/clinical-body-atlas";

export type ClinicalBodySide = "left" | "right" | "midline";
export type ClinicalBodySurface =
  | "anterior"
  | "posterior"
  | "left_lateral"
  | "right_lateral"
  | "superior";

export interface ClinicalBodyRegion {
  id: string;
  code: number;
  label: string;
  view: ClinicalBodyView;
  side: ClinicalBodySide;
  surface: ClinicalBodySurface;
  anchor: { x: number; y: number };
  terminologySource: "FIPAT_TA2_working_alignment";
  terminologyStatus: "technical_review_required";
}

type RegionSeed = Omit<
  ClinicalBodyRegion,
  "code" | "terminologySource" | "terminologyStatus"
>;

const bilateral = (
  view: "front" | "back",
  surface: "anterior" | "posterior",
  key: string,
  labels: { left: string; right: string },
  y: number,
  x = 0.64,
): RegionSeed[] => {
  const leftScreenX = view === "front" ? x : 1 - x;
  const rightScreenX = 1 - leftScreenX;
  return [
    {
      id: `${view}-left-${key}`,
      label: labels.left,
      view,
      side: "left",
      surface,
      anchor: { x: leftScreenX, y },
    },
    {
      id: `${view}-right-${key}`,
      label: labels.right,
      view,
      side: "right",
      surface,
      anchor: { x: rightScreenX, y },
    },
  ];
};

const front: RegionSeed[] = [
  { id: "front-face", label: "Передняя область лица", view: "front", side: "midline", surface: "anterior", anchor: { x: 0.5, y: 0.09 } },
  { id: "front-neck", label: "Передняя область шеи", view: "front", side: "midline", surface: "anterior", anchor: { x: 0.5, y: 0.17 } },
  { id: "front-chest-center", label: "Передняя срединная область грудной клетки", view: "front", side: "midline", surface: "anterior", anchor: { x: 0.5, y: 0.27 } },
  { id: "front-upper-abdomen", label: "Верхняя область живота", view: "front", side: "midline", surface: "anterior", anchor: { x: 0.5, y: 0.38 } },
  { id: "front-umbilical", label: "Пупочная область", view: "front", side: "midline", surface: "anterior", anchor: { x: 0.5, y: 0.45 } },
  { id: "front-lower-abdomen", label: "Нижняя область живота", view: "front", side: "midline", surface: "anterior", anchor: { x: 0.5, y: 0.52 } },
  ...bilateral("front", "anterior", "cheek", { left: "Левая щёчная область", right: "Правая щёчная область" }, 0.1, 0.55),
  ...bilateral("front", "anterior", "chest", { left: "Передняя левая область грудной клетки", right: "Передняя правая область грудной клетки" }, 0.28, 0.59),
  ...bilateral("front", "anterior", "shoulder", { left: "Передняя область левого плеча", right: "Передняя область правого плеча" }, 0.22, 0.72),
  ...bilateral("front", "anterior", "upper-arm", { left: "Передняя поверхность левого плеча", right: "Передняя поверхность правого плеча" }, 0.28, 0.79),
  ...bilateral("front", "anterior", "elbow", { left: "Передняя область левого локтя", right: "Передняя область правого локтя" }, 0.34, 0.84),
  ...bilateral("front", "anterior", "forearm", { left: "Передняя поверхность левого предплечья", right: "Передняя поверхность правого предплечья" }, 0.39, 0.89),
  ...bilateral("front", "anterior", "wrist", { left: "Передняя область левого запястья", right: "Передняя область правого запястья" }, 0.44, 0.92),
  ...bilateral("front", "anterior", "palm", { left: "Ладонная поверхность левой кисти", right: "Ладонная поверхность правой кисти" }, 0.47, 0.94),
  ...bilateral("front", "anterior", "fingers", { left: "Ладонная поверхность пальцев левой кисти", right: "Ладонная поверхность пальцев правой кисти" }, 0.5, 0.96),
  ...bilateral("front", "anterior", "groin", { left: "Левая паховая область", right: "Правая паховая область" }, 0.56, 0.57),
  ...bilateral("front", "anterior", "thigh", { left: "Передняя поверхность левого бедра", right: "Передняя поверхность правого бедра" }, 0.66),
  ...bilateral("front", "anterior", "knee", { left: "Передняя область левого колена", right: "Передняя область правого колена" }, 0.76),
  ...bilateral("front", "anterior", "leg", { left: "Передняя поверхность левой голени", right: "Передняя поверхность правой голени" }, 0.84),
  ...bilateral("front", "anterior", "ankle", { left: "Передняя область левого голеностопного сустава", right: "Передняя область правого голеностопного сустава" }, 0.93),
  ...bilateral("front", "anterior", "foot", { left: "Тыльная поверхность левой стопы", right: "Тыльная поверхность правой стопы" }, 0.97),
  ...bilateral("front", "anterior", "toes", { left: "Тыльная поверхность пальцев левой стопы", right: "Тыльная поверхность пальцев правой стопы" }, 0.99, 0.68),
];

const back: RegionSeed[] = [
  { id: "back-occiput", label: "Затылочная область", view: "back", side: "midline", surface: "posterior", anchor: { x: 0.5, y: 0.09 } },
  { id: "back-neck", label: "Задняя область шеи", view: "back", side: "midline", surface: "posterior", anchor: { x: 0.5, y: 0.17 } },
  { id: "back-thoracic-spine", label: "Задняя срединная область грудной клетки", view: "back", side: "midline", surface: "posterior", anchor: { x: 0.5, y: 0.3 } },
  { id: "back-lumbar-spine", label: "Поясничная область", view: "back", side: "midline", surface: "posterior", anchor: { x: 0.5, y: 0.43 } },
  { id: "back-sacral", label: "Крестцовая область", view: "back", side: "midline", surface: "posterior", anchor: { x: 0.5, y: 0.53 } },
  ...bilateral("back", "posterior", "head", { left: "Левая заднебоковая область головы", right: "Правая заднебоковая область головы" }, 0.1, 0.55),
  ...bilateral("back", "posterior", "scapular", { left: "Левая лопаточная область", right: "Правая лопаточная область" }, 0.28, 0.59),
  ...bilateral("back", "posterior", "shoulder", { left: "Задняя область левого плеча", right: "Задняя область правого плеча" }, 0.22, 0.72),
  ...bilateral("back", "posterior", "upper-arm", { left: "Задняя поверхность левого плеча", right: "Задняя поверхность правого плеча" }, 0.28, 0.79),
  ...bilateral("back", "posterior", "elbow", { left: "Задняя область левого локтя", right: "Задняя область правого локтя" }, 0.34, 0.84),
  ...bilateral("back", "posterior", "forearm", { left: "Задняя поверхность левого предплечья", right: "Задняя поверхность правого предплечья" }, 0.39, 0.89),
  ...bilateral("back", "posterior", "wrist", { left: "Задняя область левого запястья", right: "Задняя область правого запястья" }, 0.44, 0.92),
  ...bilateral("back", "posterior", "hand", { left: "Тыльная поверхность левой кисти", right: "Тыльная поверхность правой кисти" }, 0.47, 0.94),
  ...bilateral("back", "posterior", "fingers", { left: "Тыльная поверхность пальцев левой кисти", right: "Тыльная поверхность пальцев правой кисти" }, 0.5, 0.96),
  ...bilateral("back", "posterior", "buttock", { left: "Левая ягодичная область", right: "Правая ягодичная область" }, 0.56, 0.57),
  ...bilateral("back", "posterior", "thigh", { left: "Задняя поверхность левого бедра", right: "Задняя поверхность правого бедра" }, 0.66),
  ...bilateral("back", "posterior", "knee", { left: "Задняя область левого колена", right: "Задняя область правого колена" }, 0.76),
  ...bilateral("back", "posterior", "calf", { left: "Задняя поверхность левой голени", right: "Задняя поверхность правой голени" }, 0.84),
  ...bilateral("back", "posterior", "ankle", { left: "Задняя область левого голеностопного сустава", right: "Задняя область правого голеностопного сустава" }, 0.93),
  ...bilateral("back", "posterior", "heel", { left: "Пяточная область левой стопы", right: "Пяточная область правой стопы" }, 0.98),
];

const lateral = (side: "left" | "right"): RegionSeed[] => {
  const view = side;
  const surface = side === "left" ? "left_lateral" : "right_lateral";
  const possessive = side === "left" ? "левой" : "правой";
  const adjective = side === "left" ? "Левая" : "Правая";
  const entries: Array<[string, string, number, number]> = [
    ["head", `${adjective} боковая область головы`, 0.5, 0.09],
    ["face", `${adjective} боковая область лица`, 0.43, 0.12],
    ["neck", `${adjective} боковая область шеи`, 0.5, 0.18],
    ["shoulder", `${adjective} боковая область плечевого сустава`, 0.55, 0.23],
    ["thorax", `${adjective} боковая область грудной клетки`, 0.5, 0.3],
    ["abdomen", `${adjective} боковая область живота`, 0.5, 0.43],
    ["hip", `${adjective} боковая область таза`, 0.5, 0.55],
    ["upper-arm", `Боковая поверхность ${possessive} плеча`, 0.65, 0.31],
    ["elbow", `Боковая область ${possessive} локтя`, 0.69, 0.36],
    ["forearm", `Боковая поверхность ${possessive} предплечья`, 0.72, 0.4],
    ["wrist", `Боковая область ${possessive} запястья`, 0.75, 0.44],
    ["hand", `Боковая поверхность ${possessive} кисти`, 0.78, 0.47],
    ["fingers", `Боковая поверхность пальцев ${possessive} кисти`, 0.81, 0.49],
    ["thigh", `Боковая поверхность ${possessive} бедра`, 0.52, 0.66],
    ["knee", `Боковая область ${possessive} колена`, 0.52, 0.76],
    ["leg", `Боковая поверхность ${possessive} голени`, 0.52, 0.85],
    ["ankle", `Боковая область ${possessive} голеностопного сустава`, 0.52, 0.94],
    ["foot", `Боковая поверхность ${possessive} стопы`, 0.56, 0.98],
  ];
  return entries.map(([key, label, x, y]) => ({
    id: `${view}-${key}`,
    label,
    view,
    side,
    surface,
    anchor: { x, y },
  }));
};

const scalp: RegionSeed[] = [
  { id: "scalp-anterior", label: "Передняя область волосистой части головы", view: "scalp", side: "midline", surface: "superior", anchor: { x: 0.5, y: 0.3 } },
  { id: "scalp-vertex", label: "Теменная область волосистой части головы", view: "scalp", side: "midline", surface: "superior", anchor: { x: 0.5, y: 0.5 } },
  { id: "scalp-posterior", label: "Задняя область волосистой части головы", view: "scalp", side: "midline", surface: "superior", anchor: { x: 0.5, y: 0.7 } },
  { id: "scalp-left", label: "Левая область волосистой части головы", view: "scalp", side: "left", surface: "superior", anchor: { x: 0.32, y: 0.5 } },
  { id: "scalp-right", label: "Правая область волосистой части головы", view: "scalp", side: "right", surface: "superior", anchor: { x: 0.68, y: 0.5 } },
];

export const CLINICAL_BODY_REGIONS: ClinicalBodyRegion[] = [
  ...front,
  ...back,
  ...lateral("left"),
  ...lateral("right"),
  ...scalp,
].map((region, index) => ({
  ...region,
  code: index + 1,
  terminologySource: "FIPAT_TA2_working_alignment" as const,
  terminologyStatus: "technical_review_required" as const,
}));

const REGION_BY_ID = new Map(CLINICAL_BODY_REGIONS.map((region) => [region.id, region]));

export function clinicalBodyRegionById(id: string): ClinicalBodyRegion | null {
  return REGION_BY_ID.get(id) ?? null;
}

export function clinicalBodyRegionsForView(view: ClinicalBodyView): ClinicalBodyRegion[] {
  return CLINICAL_BODY_REGIONS.filter((region) => region.view === view);
}

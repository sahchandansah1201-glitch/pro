/**
 * Schematic anterior/posterior body silhouette by figure type.
 * Figure type derived from patient sex and age:
 *   - child (< 14 лет): boy / girl
 *   - adult: man / woman
 *
 * Pure SVG paths in viewBox 200x400. Used as the background layer
 * for the body map; lesion markers are overlaid by the parent.
 */

export type BodyView = "front" | "back";
export type Figure = "man" | "woman" | "boy" | "girl";

export function pickFigure(sex: "male" | "female", ageYears: number): Figure {
  const child = ageYears < 14;
  if (sex === "male") return child ? "boy" : "man";
  return child ? "girl" : "woman";
}

export const FIGURE_LABEL: Record<Figure, string> = {
  man: "мужчина",
  woman: "женщина",
  boy: "мальчик",
  girl: "девочка",
};

interface Props {
  view: BodyView;
  figure: Figure;
}

/**
 * Geometry per figure (proportions, in viewBox units 200x400):
 * - shoulders, waist, hips: relative half-widths
 * - headR: head radius
 * - chestY/waistY/hipY/footY: vertical anchors
 *
 * The same skeletal frame is reused; only proportions change so anatomical
 * landmarks (zone separators, lesion x/y) keep their meaning across figures.
 */
const G: Record<Figure, {
  headCx: number; headCy: number; headRx: number; headRy: number;
  neckW: number; neckTop: number; neckBot: number;
  shoulderY: number; shoulderHalf: number;
  waistY: number; waistHalf: number;
  hipY: number; hipHalf: number;
  armOutX: number; elbowX: number; wristX: number;
  thighOutX: number; ankleX: number;
  legBottomY: number;
}> = {
  man: {
    headCx: 100, headCy: 28, headRx: 20, headRy: 24,
    neckW: 16, neckTop: 50, neckBot: 62,
    shoulderY: 66, shoulderHalf: 38,
    waistY: 150, waistHalf: 32,
    hipY: 200, hipHalf: 36,
    armOutX: 48, elbowX: 40, wristX: 36,
    thighOutX: 30, ankleX: 22,
    legBottomY: 356,
  },
  woman: {
    headCx: 100, headCy: 28, headRx: 19, headRy: 23,
    neckW: 14, neckTop: 49, neckBot: 60,
    shoulderY: 64, shoulderHalf: 30,
    waistY: 150, waistHalf: 24,
    hipY: 205, hipHalf: 38,
    armOutX: 56, elbowX: 50, wristX: 46,
    thighOutX: 32, ankleX: 22,
    legBottomY: 356,
  },
  boy: {
    headCx: 100, headCy: 36, headRx: 22, headRy: 26,
    neckW: 14, neckTop: 60, neckBot: 72,
    shoulderY: 76, shoulderHalf: 30,
    waistY: 156, waistHalf: 26,
    hipY: 200, hipHalf: 30,
    armOutX: 60, elbowX: 56, wristX: 52,
    thighOutX: 36, ankleX: 28,
    legBottomY: 348,
  },
  girl: {
    headCx: 100, headCy: 36, headRx: 21, headRy: 25,
    neckW: 13, neckTop: 60, neckBot: 71,
    shoulderY: 75, shoulderHalf: 28,
    waistY: 156, waistHalf: 24,
    hipY: 202, hipHalf: 32,
    armOutX: 62, elbowX: 58, wristX: 54,
    thighOutX: 36, ankleX: 28,
    legBottomY: 348,
  },
};

export function BodySilhouette({ view, figure }: Props) {
  const stroke = "hsl(var(--border))";
  const fill = "hsl(var(--surface))";
  const zoneStroke = "hsl(var(--border))";
  const g = G[figure];

  // Torso polygon: shoulder → waist → hip on each side.
  const cx = 100;
  const sL = cx - g.shoulderHalf, sR = cx + g.shoulderHalf;
  const wL = cx - g.waistHalf, wR = cx + g.waistHalf;
  const hL = cx - g.hipHalf, hR = cx + g.hipHalf;

  const torso =
    `M${sL},${g.shoulderY} L${sR},${g.shoulderY} ` +
    `L${wR},${g.waistY} L${hR},${g.hipY} ` +
    `L${hL},${g.hipY} L${wL},${g.waistY} Z`;

  // Arms (shoulder → elbow → wrist), simple tapered ribbons.
  const armL =
    `M${sL},${g.shoulderY + 4} L${g.elbowX},${g.waistY} ` +
    `L${g.wristX},${g.hipY + 30} L${g.wristX + 10},${g.hipY + 32} ` +
    `L${g.elbowX + 10},${g.waistY + 6} L${sL + 8},${g.shoulderY + 8} Z`;
  const armR =
    `M${sR},${g.shoulderY + 4} L${200 - g.elbowX},${g.waistY} ` +
    `L${200 - g.wristX},${g.hipY + 30} L${200 - g.wristX - 10},${g.hipY + 32} ` +
    `L${200 - g.elbowX - 10},${g.waistY + 6} L${sR - 8},${g.shoulderY + 8} Z`;

  // Legs.
  const legL =
    `M${hL},${g.hipY} L${cx - g.thighOutX + 4},${g.hipY + 60} ` +
    `L${cx - g.ankleX},${g.legBottomY - 10} L${cx - g.ankleX + 14},${g.legBottomY - 10} ` +
    `L${cx - 4},${g.hipY + 60} L${cx - 4},${g.hipY} Z`;
  const legR =
    `M${hR},${g.hipY} L${cx + g.thighOutX - 4},${g.hipY + 60} ` +
    `L${cx + g.ankleX},${g.legBottomY - 10} L${cx + g.ankleX - 14},${g.legBottomY - 10} ` +
    `L${cx + 4},${g.hipY + 60} L${cx + 4},${g.hipY} Z`;

  // Hand / foot ovals.
  const handY = g.hipY + 36;
  const handLx = g.wristX + 5;
  const handRx = 200 - g.wristX - 5;
  const footY = g.legBottomY;

  // Subtle female chest hint (front view, woman only) — schematic curve, not anatomical detail.
  const chestHint =
    figure === "woman" && view === "front" ? (
      <>
        <path
          d={`M${cx - 12},${g.shoulderY + 28} q12,12 24,0`}
          fill="none"
          stroke={zoneStroke}
          strokeWidth={0.8}
          opacity={0.7}
        />
      </>
    ) : null;

  // Slight waist hint for girl (front).
  const waistHint =
    figure === "girl" && view === "front" ? (
      <line
        x1={wL + 2}
        y1={g.waistY + 4}
        x2={wR - 2}
        y2={g.waistY + 4}
        stroke={zoneStroke}
        strokeDasharray="2 3"
        opacity={0.5}
      />
    ) : null;

  return (
    <g fill={fill} stroke={stroke} strokeWidth={1}>
      {/* Head */}
      <ellipse cx={g.headCx} cy={g.headCy} rx={g.headRx} ry={g.headRy} />
      {/* Hair hint for back view of female figures */}
      {view === "back" && (figure === "woman" || figure === "girl") && (
        <path
          d={`M${g.headCx - g.headRx + 1},${g.headCy} q0,${g.headRy + 8} ${g.headRx - 1},${g.headRy + 14} q${g.headRx - 1},-6 ${g.headRx - 1},-${g.headRy + 14}`}
          fill="hsl(var(--surface-muted))"
          stroke={stroke}
          strokeWidth={0.8}
        />
      )}
      {/* Neck */}
      <rect x={cx - g.neckW / 2} y={g.neckTop} width={g.neckW} height={g.neckBot - g.neckTop} />
      {/* Arms first (under torso visually) */}
      <path d={armL} />
      <path d={armR} />
      {/* Torso */}
      <path d={torso} />
      {/* Legs */}
      <path d={legL} />
      <path d={legR} />
      {/* Hands */}
      <ellipse cx={handLx} cy={handY} rx={8} ry={11} />
      <ellipse cx={handRx} cy={handY} rx={8} ry={11} />
      {/* Feet */}
      <ellipse cx={cx - g.ankleX + 7} cy={footY} rx={12} ry={7} />
      <ellipse cx={cx + g.ankleX - 7} cy={footY} rx={12} ry={7} />

      {chestHint}
      {waistHint}

      {/* Schematic anatomical separators */}
      <g stroke={zoneStroke} strokeDasharray="2 2" opacity={0.55} fill="none">
        {view === "front" ? (
          <>
            <line x1={wL} y1={g.shoulderY + 50} x2={wR} y2={g.shoulderY + 50} />
            <line x1={wL} y1={g.waistY} x2={wR} y2={g.waistY} />
            <line x1={cx} y1={g.neckBot} x2={cx} y2={g.hipY} />
          </>
        ) : (
          <>
            <line x1={wL} y1={g.shoulderY + 60} x2={wR} y2={g.shoulderY + 60} />
            <line x1={wL} y1={g.waistY + 10} x2={wR} y2={g.waistY + 10} />
            <line x1={cx} y1={g.neckBot} x2={cx} y2={g.hipY} />
          </>
        )}
      </g>
    </g>
  );
}

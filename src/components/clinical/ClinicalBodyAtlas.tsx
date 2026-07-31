import type {
  ClinicalBodyAgeBand,
  ClinicalBodyProfile,
  ClinicalBodyView,
} from "@/lib/clinical-body-atlas";

interface AtlasGeometry {
  headCy: number;
  headRx: number;
  headRy: number;
  neckHalf: number;
  shoulderY: number;
  shoulderHalf: number;
  chestY: number;
  chestHalf: number;
  waistY: number;
  waistHalf: number;
  hipY: number;
  hipHalf: number;
  crotchY: number;
  elbowY: number;
  wristY: number;
  handY: number;
  armReach: number;
  handLength: number;
  kneeY: number;
  ankleY: number;
  footY: number;
  kneeHalf: number;
  calfHalf: number;
  ankleHalf: number;
  footLength: number;
}

const AGE_GEOMETRY: Record<ClinicalBodyAgeBand, AtlasGeometry> = {
  infant: {
    headCy: 43,
    headRx: 34,
    headRy: 42,
    neckHalf: 10,
    shoulderY: 103,
    shoulderHalf: 29,
    chestY: 139,
    chestHalf: 34,
    waistY: 194,
    waistHalf: 34,
    hipY: 226,
    hipHalf: 35,
    crotchY: 250,
    elbowY: 172,
    wristY: 220,
    handY: 232,
    armReach: 6,
    handLength: 16,
    kneeY: 316,
    ankleY: 362,
    footY: 382,
    kneeHalf: 19,
    calfHalf: 18,
    ankleHalf: 10,
    footLength: 19,
  },
  early_child: {
    headCy: 39,
    headRx: 29,
    headRy: 34,
    neckHalf: 8,
    shoulderY: 91,
    shoulderHalf: 29,
    chestY: 129,
    chestHalf: 33,
    waistY: 183,
    waistHalf: 32,
    hipY: 218,
    hipHalf: 34,
    crotchY: 243,
    elbowY: 162,
    wristY: 215,
    handY: 226,
    armReach: 9,
    handLength: 17,
    kneeY: 307,
    ankleY: 361,
    footY: 382,
    kneeHalf: 18.5,
    calfHalf: 17.5,
    ankleHalf: 9.5,
    footLength: 20,
  },
  child: {
    headCy: 36,
    headRx: 25,
    headRy: 29,
    neckHalf: 8,
    shoulderY: 83,
    shoulderHalf: 31,
    chestY: 121,
    chestHalf: 31,
    waistY: 174,
    waistHalf: 28,
    hipY: 211,
    hipHalf: 32,
    crotchY: 237,
    elbowY: 154,
    wristY: 212,
    handY: 225,
    armReach: 12,
    handLength: 18,
    kneeY: 299,
    ankleY: 360,
    footY: 382,
    kneeHalf: 17,
    calfHalf: 15.5,
    ankleHalf: 9,
    footLength: 21,
  },
  adolescent: {
    headCy: 33,
    headRx: 22,
    headRy: 25,
    neckHalf: 8,
    shoulderY: 74,
    shoulderHalf: 34,
    chestY: 113,
    chestHalf: 33,
    waistY: 165,
    waistHalf: 28,
    hipY: 203,
    hipHalf: 34,
    crotchY: 229,
    elbowY: 148,
    wristY: 210,
    handY: 232,
    armReach: 15,
    handLength: 19,
    kneeY: 294,
    ankleY: 360,
    footY: 383,
    kneeHalf: 17,
    calfHalf: 16,
    ankleHalf: 9,
    footLength: 23,
  },
  late_adolescent: {
    headCy: 30,
    headRx: 19.5,
    headRy: 22.5,
    neckHalf: 8.5,
    shoulderY: 67,
    shoulderHalf: 36,
    chestY: 106,
    chestHalf: 35,
    waistY: 158,
    waistHalf: 29,
    hipY: 198,
    hipHalf: 35,
    crotchY: 223,
    elbowY: 143,
    wristY: 210,
    handY: 233,
    armReach: 16,
    handLength: 20,
    kneeY: 289,
    ankleY: 360,
    footY: 383,
    kneeHalf: 17,
    calfHalf: 16,
    ankleHalf: 9,
    footLength: 24,
  },
  adult: {
    headCy: 29,
    headRx: 19,
    headRy: 22,
    neckHalf: 9,
    shoulderY: 65,
    shoulderHalf: 36,
    chestY: 104,
    chestHalf: 35,
    waistY: 157,
    waistHalf: 29,
    hipY: 198,
    hipHalf: 36,
    crotchY: 223,
    elbowY: 142,
    wristY: 210,
    handY: 234,
    armReach: 17,
    handLength: 21,
    kneeY: 288,
    ankleY: 360,
    footY: 383,
    kneeHalf: 17,
    calfHalf: 16.5,
    ankleHalf: 9,
    footLength: 25,
  },
};

function geometryFor(profile: ClinicalBodyProfile): AtlasGeometry {
  const base = AGE_GEOMETRY[profile.ageBand];
  const g = { ...base };

  if (profile.ageBand === "adolescent") {
    if (profile.sex === "female") {
      g.waistHalf -= 1;
      g.hipHalf += 2;
    } else {
      g.shoulderHalf += 2;
      g.chestHalf += 1;
    }
  }

  if (profile.ageBand === "late_adolescent" || profile.ageBand === "adult") {
    if (profile.sex === "female") {
      g.shoulderHalf -= 1;
      g.waistHalf -= 3;
      g.hipHalf += 3;
    } else {
      g.shoulderHalf += 5;
      g.chestHalf += 4;
      g.waistHalf += 3;
      g.hipHalf -= 1;
      g.neckHalf += 1.5;
    }
  }

  return g;
}

function Head({ g, view }: { g: AtlasGeometry; view: "front" | "back" }) {
  const cx = 100;
  const top = g.headCy - g.headRy;
  const bottom = g.headCy + g.headRy;
  const jawHalf = g.headRx * (g.headRx >= 24 ? 0.72 : 0.58);
  const outline = [
    `M${cx},${top}`,
    `C${cx - g.headRx * 0.78},${top} ${cx - g.headRx},${g.headCy - 8} ${cx - g.headRx * 0.94},${g.headCy + 4}`,
    `C${cx - g.headRx * 0.82},${g.headCy + 14} ${cx - jawHalf},${bottom - 4} ${cx},${bottom + 2}`,
    `C${cx + jawHalf},${bottom - 4} ${cx + g.headRx * 0.82},${g.headCy + 14} ${cx + g.headRx * 0.94},${g.headCy + 4}`,
    `C${cx + g.headRx},${g.headCy - 8} ${cx + g.headRx * 0.78},${top} ${cx},${top} Z`,
  ].join(" ");

  return (
    <g data-part="head">
      <path d={outline} />
      <path d={`M${cx - g.headRx * 0.92},${g.headCy - 1} q-5,2 -2,10 q3,3 5,-1`} fill="none" />
      <path d={`M${cx + g.headRx * 0.92},${g.headCy - 1} q5,2 2,10 q-3,3 -5,-1`} fill="none" />
      {view === "front" ? (
        <g data-part="face" fill="none">
          <path d={`M${cx - 10},${g.headCy - 4} q5,-3 10,0 q5,-3 10,0`} opacity={0.7} />
          <circle cx={cx - 7} cy={g.headCy - 2.5} r={1.1} fill="currentColor" stroke="none" />
          <circle cx={cx + 7} cy={g.headCy - 2.5} r={1.1} fill="currentColor" stroke="none" />
          <path d={`M${cx},${g.headCy} q-2,7 1,9`} />
          <path d={`M${cx - 5},${g.headCy + 14} q5,2 10,0`} />
        </g>
      ) : (
        <path
          data-part="occipital-guide"
          d={`M${cx - g.headRx * 0.55},${g.headCy - 12} q${g.headRx * 0.55},-7 ${g.headRx * 1.1},0`}
          fill="none"
          opacity={0.45}
        />
      )}
    </g>
  );
}

function Arm({ g, side }: { g: AtlasGeometry; side: "left" | "right" }) {
  const cx = 100;
  const shoulderX = cx - g.shoulderHalf;
  const elbowOuter = shoulderX - g.armReach;
  const wristOuter = elbowOuter - 5;
  const handBottom = g.handY + g.handLength;
  const path = [
    `M${shoulderX + 8},${g.shoulderY + 3}`,
    `C${shoulderX - 3},${g.shoulderY + 7} ${elbowOuter - 1},${g.elbowY - 13} ${elbowOuter},${g.elbowY}`,
    `C${elbowOuter},${g.elbowY + 18} ${wristOuter},${g.wristY - 8} ${wristOuter + 1},${g.wristY + 2}`,
    `L${wristOuter - 2},${g.handY + 4}`,
    `C${wristOuter - 5},${g.handY + 10} ${wristOuter - 3},${handBottom - 3} ${wristOuter + 1},${handBottom}`,
    `C${wristOuter + 3},${handBottom + 1} ${wristOuter + 4},${handBottom - 7} ${wristOuter + 5},${handBottom - 8}`,
    `C${wristOuter + 6},${handBottom + 1} ${wristOuter + 9},${handBottom + 1} ${wristOuter + 10},${handBottom - 9}`,
    `C${wristOuter + 11},${handBottom} ${wristOuter + 14},${handBottom} ${wristOuter + 14},${handBottom - 10}`,
    `C${wristOuter + 17},${handBottom - 2} ${wristOuter + 20},${handBottom - 5} ${wristOuter + 17},${g.handY + 7}`,
    `L${wristOuter + 13},${g.wristY + 1}`,
    `C${wristOuter + 14},${g.wristY - 10} ${elbowOuter + 10},${g.elbowY + 17} ${elbowOuter + 11},${g.elbowY}`,
    `C${elbowOuter + 12},${g.elbowY - 12} ${shoulderX + 12},${g.shoulderY + 14} ${shoulderX + 16},${g.shoulderY + 8} Z`,
  ].join(" ");
  const transform = side === "right" ? "translate(200 0) scale(-1 1)" : undefined;

  return (
    <g data-part={`${side}-arm`} transform={transform}>
      <path d={path} />
      <g fill="none" opacity={0.55}>
        <path d={`M${wristOuter + 4},${g.handY + 9} l1,${g.handLength - 7}`} />
        <path d={`M${wristOuter + 8},${g.handY + 8} l1,${g.handLength - 6}`} />
        <path d={`M${wristOuter + 12},${g.handY + 8} l0,${g.handLength - 7}`} />
        <path d={`M${wristOuter + 4},${g.handY + 7} q6,4 12,0`} />
      </g>
    </g>
  );
}

function Leg({ g, side }: { g: AtlasGeometry; side: "left" | "right" }) {
  const cx = 100;
  const hipOuter = cx - g.hipHalf;
  const kneeOuter = cx - g.kneeHalf;
  const kneeInner = cx - 5;
  const ankleOuter = cx - g.ankleHalf - 3;
  const ankleInner = cx - 4;
  const innerThigh = cx - 12;
  const footTip = ankleOuter - g.footLength;
  const path = [
    `M${hipOuter},${g.hipY - 2}`,
    `C${hipOuter - 1},${g.hipY + 22} ${kneeOuter - 5},${g.kneeY - 27} ${kneeOuter},${g.kneeY}`,
    `C${cx - g.calfHalf - 3},${g.kneeY + 20} ${ankleOuter - 1},${g.ankleY - 20} ${ankleOuter},${g.ankleY}`,
    `C${ankleOuter - 2},${g.ankleY + 10} ${footTip + 4},${g.footY - 4} ${footTip},${g.footY}`,
    `C${footTip + 7},${g.footY + 5} ${ankleInner + 7},${g.footY + 5} ${ankleInner + 10},${g.footY - 2}`,
    `C${ankleInner + 4},${g.footY - 13} ${ankleInner},${g.ankleY + 8} ${ankleInner},${g.ankleY}`,
    `C${ankleInner},${g.kneeY + 28} ${kneeInner},${g.kneeY + 19} ${kneeInner},${g.kneeY}`,
    `C${kneeInner},${g.kneeY - 25} ${innerThigh},${g.crotchY + 9} ${innerThigh},${g.crotchY}`,
    `C${innerThigh - 8},${g.crotchY - 4} ${hipOuter + 7},${g.hipY + 12} ${hipOuter},${g.hipY - 2} Z`,
  ].join(" ");
  const transform = side === "right" ? "translate(200 0) scale(-1 1)" : undefined;

  return (
    <g data-part={`${side}-leg`} transform={transform}>
      <path d={path} />
      <g fill="none" opacity={0.5}>
        <path d={`M${kneeOuter + 4},${g.kneeY - 2} q5,4 10,0`} />
        <path d={`M${footTip + 5},${g.footY} l3,-4 M${footTip + 10},${g.footY + 1} l3,-4 M${footTip + 15},${g.footY + 2} l3,-4`} />
      </g>
    </g>
  );
}

function FrontBackAtlas({
  profile,
  g,
  view,
}: {
  profile: ClinicalBodyProfile;
  g: AtlasGeometry;
  view: "front" | "back";
}) {
  const cx = 100;
  const neckTop = g.headCy + g.headRy - 1;
  const torso = [
    `M${cx - g.neckHalf},${neckTop}`,
    `C${cx - g.neckHalf - 1},${g.shoulderY - 10} ${cx - g.shoulderHalf + 15},${g.shoulderY - 8} ${cx - g.shoulderHalf + 8},${g.shoulderY - 4}`,
    `C${cx - g.shoulderHalf + 2},${g.shoulderY - 1} ${cx - g.shoulderHalf},${g.shoulderY + 3} ${cx - g.chestHalf},${g.chestY}`,
    `C${cx - g.chestHalf + 2},${g.chestY + 20} ${cx - g.waistHalf},${g.waistY - 10} ${cx - g.waistHalf},${g.waistY}`,
    `C${cx - g.waistHalf},${g.waistY + 18} ${cx - g.hipHalf},${g.hipY - 8} ${cx - g.hipHalf},${g.hipY}`,
    `C${cx - g.hipHalf + 3},${g.hipY + 15} ${cx - 13},${g.crotchY - 4} ${cx},${g.crotchY + 2}`,
    `C${cx + 13},${g.crotchY - 4} ${cx + g.hipHalf - 3},${g.hipY + 15} ${cx + g.hipHalf},${g.hipY}`,
    `C${cx + g.hipHalf},${g.hipY - 8} ${cx + g.waistHalf},${g.waistY + 18} ${cx + g.waistHalf},${g.waistY}`,
    `C${cx + g.waistHalf},${g.waistY - 10} ${cx + g.chestHalf - 2},${g.chestY + 20} ${cx + g.chestHalf},${g.chestY}`,
    `C${cx + g.chestHalf},${g.chestY} ${cx + g.shoulderHalf - 2},${g.shoulderY - 1} ${cx + g.shoulderHalf - 8},${g.shoulderY - 4}`,
    `C${cx + g.shoulderHalf - 15},${g.shoulderY - 8} ${cx + g.neckHalf + 1},${g.shoulderY - 10} ${cx + g.neckHalf},${neckTop} Z`,
  ].join(" ");
  const adultFemale =
    profile.sex === "female" &&
    (profile.ageBand === "late_adolescent" || profile.ageBand === "adult");

  return (
    <>
      <Arm g={g} side="left" />
      <Arm g={g} side="right" />
      <Leg g={g} side="left" />
      <Leg g={g} side="right" />
      <path data-part="torso" d={torso} />
      <Head g={g} view={view} />
      <g data-part="anatomical-landmarks" fill="none" opacity={0.62}>
        {view === "front" ? (
          <>
            <path d={`M${cx - 22},${g.shoulderY + 13} q11,7 22,5 q11,2 22,-5`} />
            <path d={`M${cx},${g.shoulderY + 18} L${cx},${g.waistY - 14}`} strokeDasharray="3 3" />
            <circle cx={cx} cy={(g.waistY + g.hipY) / 2} r={1.6} fill="currentColor" stroke="none" />
            {adultFemale && (
              <g data-part="adult-female-chest">
                <path d={`M${cx - 24},${g.chestY - 1} q10,11 22,1`} />
                <path d={`M${cx + 24},${g.chestY - 1} q-10,11 -22,1`} />
              </g>
            )}
          </>
        ) : (
          <>
            <path d={`M${cx},${g.shoulderY + 10} L${cx},${g.hipY - 12}`} strokeDasharray="3 3" />
            <path d={`M${cx - 22},${g.shoulderY + 20} q-4,17 6,29`} />
            <path d={`M${cx + 22},${g.shoulderY + 20} q4,17 -6,29`} />
            <path d={`M${cx - 15},${g.waistY + 18} q15,6 30,0`} />
            <path d={`M${cx - g.hipHalf + 9},${g.hipY + 7} q12,12 ${g.hipHalf - 9},12`} />
            <path d={`M${cx + g.hipHalf - 9},${g.hipY + 7} q-12,12 -${g.hipHalf - 9},12`} />
          </>
        )}
      </g>
    </>
  );
}

function SideAtlas({
  profile,
  g,
  view,
}: {
  profile: ClinicalBodyProfile;
  g: AtlasGeometry;
  view: "left" | "right";
}) {
  const cx = 100;
  const top = g.headCy - g.headRy;
  const bottom = g.headCy + g.headRy;
  const adultFemale =
    profile.sex === "female" &&
    (profile.ageBand === "late_adolescent" || profile.ageBand === "adult");
  const youngChild = profile.ageBand === "infant" || profile.ageBand === "early_child";
  const chestFront = 118 + (adultFemale ? 7 : profile.sex === "male" ? 5 : 0);
  const bellyFront = 113 + (youngChild ? 5 : 0);
  const hipBack = 78 - (adultFemale ? 5 : 0);
  const head = [
    `M${cx - 2},${top}`,
    `C${cx + 10},${top} ${cx + g.headRx - 3},${g.headCy - 11} ${cx + g.headRx - 2},${g.headCy - 5}`,
    `L${cx + g.headRx + 7},${g.headCy + 1}`,
    `L${cx + g.headRx - 1},${g.headCy + 5}`,
    `Q${cx + g.headRx + 1},${g.headCy + 10} ${cx + g.headRx - 4},${g.headCy + 12}`,
    `Q${cx + g.headRx - 7},${bottom - 2} ${cx + 6},${bottom + 2}`,
    `C${cx - 8},${bottom + 1} ${cx - g.headRx},${g.headCy + 11} ${cx - g.headRx},${g.headCy - 2}`,
    `C${cx - g.headRx},${g.headCy - 14} ${cx - 14},${top} ${cx - 2},${top} Z`,
  ].join(" ");
  const body = [
    `M${cx - 8},${bottom - 1}`,
    `C${cx - 8},${g.shoulderY - 11} 87,${g.shoulderY - 6} 84,${g.shoulderY}`,
    `C81,${g.chestY} 84,${g.waistY} ${hipBack + 5},${g.waistY}`,
    `C${hipBack},${g.waistY + 18} ${hipBack - 4},${g.hipY - 4} ${hipBack},${g.hipY + 8}`,
    `C84,${g.hipY + 25} 84,${g.kneeY - 20} 86,${g.kneeY}`,
    `C84,${g.kneeY + 25} 87,${g.ankleY - 20} 87,${g.ankleY}`,
    `C86,${g.footY - 8} 88,${g.footY} 94,${g.footY + 1}`,
    `L${cx + g.footLength},${g.footY + 1}`,
    `C${cx + g.footLength + 4},${g.footY - 4} ${cx + 9},${g.footY - 10} ${cx + 7},${g.ankleY}`,
    `C${cx + 8},${g.ankleY - 22} ${cx + 10},${g.kneeY + 25} ${cx + 9},${g.kneeY}`,
    `C${cx + 12},${g.kneeY - 20} ${cx + 13},${g.crotchY + 8} ${cx + 8},${g.hipY + 8}`,
    `C${bellyFront + 2},${g.hipY - 4} ${bellyFront},${g.waistY + 12} ${bellyFront},${g.waistY}`,
    `C${bellyFront},${g.waistY - 20} ${chestFront},${g.chestY + 12} ${chestFront},${g.chestY}`,
    `C${chestFront - 1},${g.shoulderY + 12} ${cx + 7},${g.shoulderY - 6} ${cx + 7},${bottom - 1} Z`,
  ].join(" ");
  const arm = [
    `M${cx + 5},${g.shoulderY + 8}`,
    `C${cx + 13},${g.shoulderY + 18} ${cx + 14},${g.elbowY - 12} ${cx + 12},${g.elbowY}`,
    `L${cx + 10},${g.wristY}`,
    `C${cx + 9},${g.handY + 8} ${cx + 10},${g.handY + g.handLength} ${cx + 14},${g.handY + g.handLength}`,
    `C${cx + 18},${g.handY + g.handLength - 5} ${cx + 17},${g.handY + 6} ${cx + 15},${g.wristY}`,
    `L${cx + 20},${g.elbowY}`,
    `C${cx + 21},${g.elbowY - 13} ${cx + 16},${g.shoulderY + 13} ${cx + 9},${g.shoulderY + 6} Z`,
  ].join(" ");
  const mirror = view === "left" ? "translate(200 0) scale(-1 1)" : undefined;

  return (
    <g transform={mirror} data-part="side-profile">
      <path data-part="side-body" d={body} />
      <path data-part="side-head" d={head} />
      <path data-part="side-arm" d={arm} />
      <g fill="none" opacity={0.62}>
        <path d={`M${cx + g.headRx - 7},${g.headCy - 3} l5,1`} />
        <path d={`M${cx - 7},${g.headCy + 1} q-6,6 0,12 q6,3 9,-2`} />
        <path d={`M${cx + 8},${g.kneeY - 1} q-6,5 -12,0`} />
        <path d={`M${cx + 9},${g.handY + 9} l7,1 M${cx + 9},${g.handY + 14} l7,1`} />
      </g>
    </g>
  );
}

function ScalpAtlas({ g }: { g: AtlasGeometry }) {
  const rx = 58 + (g.headRx - 19) * 1.1;
  const ry = 78 + (g.headRy - 22) * 1.15;
  return (
    <g data-part="scalp">
      <ellipse cx={100} cy={200} rx={rx} ry={ry} />
      <path d={`M${100 - rx},190 q-10,10 0,22 M${100 + rx},190 q10,10 0,22`} fill="none" />
      <path d="M100 123 C86 139 82 168 82 198 C82 230 88 252 100 276" fill="none" strokeDasharray="3 3" opacity={0.5} />
      <path d="M100 123 C114 139 118 168 118 198 C118 230 112 252 100 276" fill="none" strokeDasharray="3 3" opacity={0.5} />
      <path d="M78 158 q22,-18 44,0" fill="none" opacity={0.55} />
      <g fill="currentColor" stroke="none" opacity={0.62}>
        <circle cx={100} cy={132} r={2} />
        <circle cx={100} cy={268} r={2} />
      </g>
    </g>
  );
}

export function ClinicalBodyAtlas({
  profile,
  view,
}: {
  profile: ClinicalBodyProfile;
  view: ClinicalBodyView;
}) {
  const g = geometryFor(profile);
  const fill = "hsl(var(--surface))";
  const stroke = "hsl(var(--muted-foreground))";

  return (
    <g
      data-testid="clinical-body-atlas"
      data-age-band={profile.ageBand}
      data-sex={profile.sex}
      data-view={view}
      data-head-rx={g.headRx}
      data-shoulder-y={g.shoulderY}
      data-crotch-y={g.crotchY}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.15}
      strokeLinecap="round"
      strokeLinejoin="round"
      color={stroke}
    >
      {view === "front" || view === "back" ? (
        <FrontBackAtlas profile={profile} g={g} view={view} />
      ) : view === "left" || view === "right" ? (
        <SideAtlas profile={profile} g={g} view={view} />
      ) : (
        <ScalpAtlas g={g} />
      )}
    </g>
  );
}

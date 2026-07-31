import {
  CLINICAL_BODY_ATLAS_HEIGHT,
  CLINICAL_BODY_ATLAS_WIDTH,
  clinicalBodyAtlasAssetPath,
  type ClinicalBodyProfile,
  type ClinicalBodyView,
} from "@/lib/clinical-body-atlas";

const ATLAS_BACKGROUND = "#061015";
const ATLAS_SKIN = "#d8c3b5";
const ATLAS_LINE = "#8e786d";

function ScalpAtlas() {
  return (
    <g data-part="scalp">
      <rect
        width={CLINICAL_BODY_ATLAS_WIDTH}
        height={CLINICAL_BODY_ATLAS_HEIGHT}
        fill={ATLAS_BACKGROUND}
      />
      <ellipse
        cx={120}
        cy={200}
        rx={78}
        ry={108}
        fill={ATLAS_SKIN}
        stroke={ATLAS_LINE}
        strokeWidth={1.5}
      />
      <path
        d="M42 188 q-12 12 0 25 M198 188 q12 12 0 25"
        fill="none"
        stroke={ATLAS_LINE}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <g
        fill="none"
        stroke={ATLAS_LINE}
        strokeLinecap="round"
        strokeWidth={1.15}
      >
        <path d="M120 94 C101 120 95 157 95 200 C95 245 103 278 120 306" />
        <path d="M120 94 C139 120 145 157 145 200 C145 245 137 278 120 306" />
        <path d="M67 200 H173" strokeDasharray="4 4" opacity={0.7} />
        <path d="M120 102 V298" strokeDasharray="4 4" opacity={0.7} />
      </g>
      <circle cx={120} cy={200} r={4} fill={ATLAS_LINE} opacity={0.75} />
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
  const assetPath =
    view === "scalp" ? null : clinicalBodyAtlasAssetPath(profile, view);

  return (
    <g
      data-testid="clinical-body-atlas"
      data-age-band={profile.ageBand}
      data-sex={profile.sex}
      data-view={view}
      data-source="makehuman-cc0-parametric"
    >
      {assetPath ? (
        <>
          <rect
            width={CLINICAL_BODY_ATLAS_WIDTH}
            height={CLINICAL_BODY_ATLAS_HEIGHT}
            fill={ATLAS_BACKGROUND}
          />
          <image
            data-part="atlas-image"
            href={assetPath}
            x={0}
            y={0}
            width={CLINICAL_BODY_ATLAS_WIDTH}
            height={CLINICAL_BODY_ATLAS_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          />
        </>
      ) : (
        <ScalpAtlas />
      )}
    </g>
  );
}

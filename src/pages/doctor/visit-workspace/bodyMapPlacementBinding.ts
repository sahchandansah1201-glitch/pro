import type { Lesion } from "@/lib/domain";
import {
  clinicalBodyAtlasManifestSha256,
  clinicalBodyAtlasSource,
  clinicalBodyProfileAssetName,
  clinicalBodyRegionMapSha256,
  type ClinicalBodyProfile,
} from "@/lib/clinical-body-atlas";

export type BodyMapBindingField = "source" | "profile" | "manifest" | "map";

export interface BodyMapPlacementBinding {
  exact: boolean;
  mismatchFields: BodyMapBindingField[];
}

export function bodyMapPlacementBinding(
  lesion: Lesion,
  profile: ClinicalBodyProfile,
): BodyMapPlacementBinding {
  const mismatchFields: BodyMapBindingField[] = [];
  if (lesion.bodyAtlasSource !== clinicalBodyAtlasSource()) mismatchFields.push("source");
  if (lesion.bodyAtlasProfileId !== clinicalBodyProfileAssetName(profile)) mismatchFields.push("profile");
  if (lesion.bodyAtlasManifestSha256 !== clinicalBodyAtlasManifestSha256()) mismatchFields.push("manifest");
  if (lesion.bodyRegionMapSha256 !== clinicalBodyRegionMapSha256(profile, lesion.mapPoint.view)) {
    mismatchFields.push("map");
  }
  return { exact: mismatchFields.length === 0, mismatchFields };
}

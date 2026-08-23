#!/usr/bin/env python3
"""Generate fail-closed pixel masks and SVG hit maps for the body atlas.

The output is a technical navigation layer, not a diagnosis or a clinician-
validated anatomical segmentation. A non-zero mask value exists only where the
source image alpha channel contains the rendered body.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


WIDTH = 240
HEIGHT = 400
VIEWS = ("front", "back", "left", "right")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--regions", required=True, type=Path)
    parser.add_argument("--source-name", required=True)
    parser.add_argument("--copy-images", action="store_true")
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def discover(source_dir: Path) -> list[tuple[str, str, Path]]:
    found: list[tuple[str, str, Path]] = []
    for path in sorted(source_dir.rglob("*")):
        if path.suffix.lower() not in {".png", ".webp"}:
            continue
        if path.stem in VIEWS:
            profile, view = path.parent.name, path.stem
        else:
            view = next((item for item in VIEWS if path.stem.endswith(f"-{item}")), "")
            if not view:
                continue
            profile = path.stem[: -(len(view) + 1)]
        found.append((profile, view, path))
    return found


def contained_alpha(path: Path) -> tuple[np.ndarray, Image.Image]:
    source = Image.open(path).convert("RGBA")
    contained = source.copy()
    contained.thumbnail((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    offset = ((WIDTH - contained.width) // 2, (HEIGHT - contained.height) // 2)
    canvas.alpha_composite(contained, offset)
    alpha = np.asarray(canvas.getchannel("A"))
    return alpha >= 32, canvas


def age_head_end(profile: str) -> float:
    if profile.startswith("infant_"):
        return 0.22
    if profile.startswith("early_child_"):
        return 0.19
    if profile.startswith("child_"):
        return 0.17
    if profile.startswith("adolescent_") or profile.startswith("late_adolescent_"):
        return 0.155
    return 0.15


def region_code(regions: dict[str, dict[str, Any]], region_id: str) -> int:
    try:
        return int(regions[region_id]["code"])
    except KeyError as error:
        raise KeyError(f"Unknown region id emitted by generator: {region_id}") from error


def classify_frontal(
    profile: str,
    view: str,
    body: np.ndarray,
    regions: dict[str, dict[str, Any]],
) -> np.ndarray:
    ys, xs = np.where(body)
    ymin, ymax = int(ys.min()), int(ys.max())
    xmin, xmax = int(xs.min()), int(xs.max())
    center = float(np.median(xs))
    height = max(1.0, float(ymax - ymin))
    global_half = max(center - xmin, xmax - center, 1.0)
    head_end = age_head_end(profile)
    neck_end = head_end + 0.055

    pelvis_row = min(ymax, int(round(ymin + height * 0.51)))
    pelvis_x = np.where(body[pelvis_row])[0]
    torso_half = max(8.0, float(np.percentile(np.abs(pelvis_x - center), 85))) if pelvis_x.size else global_half * 0.2
    mask = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)

    for y, x in zip(ys.tolist(), xs.tolist()):
        t = (y - ymin) / height
        distance = abs(x - center)
        screen_left = x < center
        if view == "front":
            side = "right" if screen_left else "left"
        else:
            side = "left" if screen_left else "right"

        if t < head_end:
            if distance < global_half * 0.035:
                rid = "front-face" if view == "front" else "back-occiput"
            else:
                rid = f"{view}-{side}-cheek" if view == "front" else f"{view}-{side}-head"
        elif t < neck_end and distance < torso_half * 0.75:
            rid = f"{view}-neck"
        elif t < 0.54 and distance > torso_half * 0.82:
            progress = (distance - torso_half * 0.82) / max(1.0, global_half - torso_half * 0.82)
            if progress < 0.12:
                part = "shoulder"
            elif progress < 0.34:
                part = "upper-arm"
            elif progress < 0.43:
                part = "elbow"
            elif progress < 0.7:
                part = "forearm"
            elif progress < 0.78:
                part = "wrist"
            elif progress < 0.91:
                part = "palm" if view == "front" else "hand"
            else:
                part = "fingers"
            rid = f"{view}-{side}-{part}"
        elif t < 0.34:
            if distance < torso_half * 0.18:
                rid = "front-chest-center" if view == "front" else "back-thoracic-spine"
            else:
                rid = f"{view}-{side}-chest" if view == "front" else f"{view}-{side}-scapular"
        elif t < 0.42:
            rid = "front-upper-abdomen" if view == "front" else "back-thoracic-spine"
        elif t < 0.49:
            rid = "front-umbilical" if view == "front" else "back-lumbar-spine"
        elif t < 0.57:
            if distance < torso_half * 0.22:
                rid = "front-lower-abdomen" if view == "front" else "back-sacral"
            else:
                rid = f"{view}-{side}-groin" if view == "front" else f"{view}-{side}-buttock"
        else:
            if t < 0.72:
                part = "thigh"
            elif t < 0.79:
                part = "knee"
            elif t < 0.91:
                part = "leg" if view == "front" else "calf"
            elif t < 0.95:
                part = "ankle"
            elif t < 0.985:
                part = "foot" if view == "front" else "heel"
            else:
                part = "toes" if view == "front" else "heel"
            rid = f"{view}-{side}-{part}"
        mask[y, x] = region_code(regions, rid)
    return mask


def classify_lateral(
    profile: str,
    view: str,
    body: np.ndarray,
    regions: dict[str, dict[str, Any]],
) -> np.ndarray:
    ys, xs = np.where(body)
    ymin, ymax = int(ys.min()), int(ys.max())
    xmin, xmax = int(xs.min()), int(xs.max())
    height = max(1.0, float(ymax - ymin))
    width = max(1.0, float(xmax - xmin))
    center = float(np.median(xs))
    head_end = age_head_end(profile)
    neck_end = head_end + 0.055
    mask = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)

    # Side-view arms are partly superimposed on the trunk. This deterministic
    # split is a review aid; the manifest keeps clinician validation open.
    for y, x in zip(ys.tolist(), xs.tolist()):
        t = (y - ymin) / height
        horizontal = (x - center) / width
        if t < head_end:
            part = "face" if abs(horizontal) > 0.04 and t > head_end * 0.35 else "head"
        elif t < neck_end:
            part = "neck"
        elif t < neck_end + 0.035:
            part = "shoulder"
        elif 0.23 <= t < 0.52 and abs(horizontal) > 0.08:
            progress = min(1.0, max(0.0, (t - 0.23) / 0.29))
            if progress < 0.12:
                part = "shoulder"
            elif progress < 0.32:
                part = "upper-arm"
            elif progress < 0.43:
                part = "elbow"
            elif progress < 0.68:
                part = "forearm"
            elif progress < 0.77:
                part = "wrist"
            elif progress < 0.91:
                part = "hand"
            else:
                part = "fingers"
        elif t < 0.36:
            part = "thorax"
        elif t < 0.5:
            part = "abdomen"
        elif t < 0.59:
            part = "hip"
        elif t < 0.72:
            part = "thigh"
        elif t < 0.79:
            part = "knee"
        elif t < 0.91:
            part = "leg"
        elif t < 0.96:
            part = "ankle"
        else:
            part = "foot"
        mask[y, x] = region_code(regions, f"{view}-{part}")
    return mask


def svg_path_for_code(mask: np.ndarray, code: int) -> str:
    commands: list[str] = []
    for y in range(HEIGHT):
        xs = np.where(mask[y] == code)[0]
        if not xs.size:
            continue
        start = previous = int(xs[0])
        for value in xs[1:]:
            x = int(value)
            if x != previous + 1:
                commands.append(f"M{start} {y}h{previous - start + 1}v1H{start}z")
                start = x
            previous = x
        commands.append(f"M{start} {y}h{previous - start + 1}v1H{start}z")
    return "".join(commands)


def write_hit_map(path: Path, mask: np.ndarray, regions: dict[str, dict[str, Any]]) -> None:
    region_paths: list[str] = []
    for region in regions.values():
        code = int(region["code"])
        path_data = svg_path_for_code(mask, code)
        if path_data:
            region_paths.append(
                f'<path id="region-{region["id"]}" data-region-code="{code}" d="{path_data}"/>'
            )
    content = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {HEIGHT}">'
        + "".join(region_paths)
        + "</svg>\n"
    )
    path.write_text(content, encoding="utf-8")


def main() -> None:
    args = parse_args()
    region_payload = json.loads(args.regions.read_text(encoding="utf-8"))
    region_items = region_payload["regions"]
    regions = {item["id"]: item for item in region_items}
    if len(region_items) >= 256:
        raise RuntimeError("Single-channel mask supports at most 255 anatomical regions")

    sources = discover(args.source_dir)
    profiles = sorted({profile for profile, _, _ in sources})
    if len(profiles) != 14 or len(sources) != 56:
        raise RuntimeError(f"Expected 14 profiles and 56 views, got {len(profiles)} and {len(sources)}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    for profile, view, source_path in sources:
        body, contained = contained_alpha(source_path)
        if not body.any():
            raise RuntimeError(f"Empty body silhouette: {source_path}")
        mask = (
            classify_frontal(profile, view, body, regions)
            if view in {"front", "back"}
            else classify_lateral(profile, view, body, regions)
        )
        body_pixels = int(body.sum())
        covered_pixels = int(np.count_nonzero(mask[body]))
        background_false_positives = int(np.count_nonzero(mask[~body]))
        unknown_codes = sorted(set(np.unique(mask).tolist()) - {0} - {int(item["code"]) for item in region_items})
        if covered_pixels != body_pixels or background_false_positives or unknown_codes:
            raise RuntimeError(f"Mask invariant failed for {profile}/{view}")

        stem = f"{profile}-{view}"
        mask_path = args.output_dir / f"{stem}.mask.png"
        hit_map_path = args.output_dir / f"{stem}.hitmap.svg"
        Image.fromarray(mask, mode="L").save(mask_path, optimize=True)
        write_hit_map(hit_map_path, mask, regions)

        asset_name = None
        if args.copy_images:
            asset_name = f"{stem}.png"
            if source_path.suffix.lower() == ".png":
                shutil.copy2(source_path, args.output_dir / asset_name)
            else:
                Image.open(source_path).convert("RGBA").save(args.output_dir / asset_name, optimize=True)

        counts = Counter(int(value) for value in mask[body].tolist())
        records.append({
            "profile": profile,
            "view": view,
            "sourcePath": str(source_path),
            "sourceSha256": sha256(source_path),
            "asset": asset_name,
            "mask": mask_path.name,
            "hitMap": hit_map_path.name,
            "maskSha256": sha256(mask_path),
            "hitMapSha256": sha256(hit_map_path),
            "bodyPixels": body_pixels,
            "coveredPixels": covered_pixels,
            "coveragePercent": round(covered_pixels * 100 / body_pixels, 4),
            "backgroundFalsePositives": background_false_positives,
            "overlapPixels": 0,
            "regionPixelCounts": {str(code): count for code, count in sorted(counts.items())},
        })

    manifest = {
        "schemaVersion": 1,
        "sourceName": args.source_name,
        "terminologyStatus": "technical_review_required",
        "clinicalValidation": "not_performed",
        "width": WIDTH,
        "height": HEIGHT,
        "profiles": profiles,
        "regions": region_items,
        "records": records,
    }
    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"PASS {len(profiles)}/14 profiles, {len(records)}/56 views, "
        "100% silhouette coverage, 0 background pixels, 0 overlap pixels"
    )


if __name__ == "__main__":
    main()

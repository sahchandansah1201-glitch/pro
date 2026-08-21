#!/usr/bin/env python3
"""Refine front-view clinical body atlas renders for point placement.

The Blender render remains the anatomical source of truth. This deterministic
post-process replaces only the front-view hands with open palms and simplifies
the facial linework. Other views are copied byte-for-byte.
"""

from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


PROFILES = (
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
)

VIEWS = ("front", "back", "left", "right")
CANVAS_WIDTH = 720
CANVAS_HEIGHT = 1200
CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT
MAKEHUMAN_BODY_VERTEX_COUNT = 13_380
FIGURE_COLOR = (250, 247, 237, 255)
OUTLINE_COLOR = (18, 31, 33, 255)
DETAIL_COLOR = (42, 57, 59, 235)
HAND_BONE_PREFIXES = ("wrist", "metacarpal", "finger")

HEAD_HEIGHT_RATIOS = {
    "infant": 0.245,
    "early_child": 0.215,
    "child": 0.19,
    "adolescent": 0.175,
    "late_adolescent": 0.165,
    "adult": 0.155,
    "older": 0.155,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--weights-file", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--profiles", default=",".join(PROFILES))
    return parser.parse_args()


def profile_group(profile: str) -> str:
    for group in HEAD_HEIGHT_RATIOS:
        if profile.startswith(f"{group}_"):
            return group
    raise ValueError(f"Unknown profile: {profile}")


def load_weights(path: Path) -> dict[str, list[tuple[int, float]]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {
        name: [(int(vertex), float(weight)) for vertex, weight in entries]
        for name, entries in payload["weights"].items()
    }


def load_obj_vertices(path: Path) -> np.ndarray:
    vertices = []
    with path.open(encoding="utf-8", errors="strict") as source:
        for line in source:
            if line.startswith("v "):
                vertices.append(tuple(float(value) for value in line.split()[1:4]))
    if not vertices:
        raise ValueError(f"OBJ contains no vertices: {path}")
    return np.asarray(vertices, dtype=np.float64)


def hand_vertex_indices(
    vertex_count: int,
    weights: dict[str, list[tuple[int, float]]],
    side: str,
) -> np.ndarray:
    influence = np.zeros(vertex_count, dtype=np.float64)
    for bone_name, entries in weights.items():
        if not bone_name.endswith(f".{side}"):
            continue
        stem = bone_name.rsplit(".", 1)[0]
        if not stem.startswith(HAND_BONE_PREFIXES):
            continue
        for vertex, weight in entries:
            if vertex < vertex_count:
                influence[vertex] += weight
    return np.flatnonzero(influence >= 0.38)


def project_front(vertices: np.ndarray) -> np.ndarray:
    minimum = vertices.min(axis=0)
    maximum = vertices.max(axis=0)
    center = (minimum + maximum) * 0.5
    height = maximum[1] - minimum[1]
    width = maximum[0] - minimum[0]
    vertical_scale = height * 1.055
    horizontal_scale = width / CANVAS_ASPECT * 1.055
    ortho_scale = max(vertical_scale, horizontal_scale)

    projected = np.empty((len(vertices), 2), dtype=np.float64)
    projected[:, 0] = CANVAS_WIDTH * 0.5 + (
        (vertices[:, 0] - center[0]) / ortho_scale * CANVAS_HEIGHT
    )
    projected[:, 1] = CANVAS_HEIGHT * 0.5 - (
        (vertices[:, 1] - center[1]) / ortho_scale * CANVAS_HEIGHT
    )
    return projected


def convex_hull(points: np.ndarray) -> list[tuple[int, int]]:
    unique = sorted({(int(round(x)), int(round(y))) for x, y in points})
    if len(unique) <= 2:
        return unique

    def cross(origin, a, b):
        return (a[0] - origin[0]) * (b[1] - origin[1]) - (
            a[1] - origin[1]
        ) * (b[0] - origin[0])

    lower = []
    for point in unique:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    upper = []
    for point in reversed(unique):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    return lower[:-1] + upper[:-1]


def normalize(vector: np.ndarray) -> np.ndarray:
    length = float(np.linalg.norm(vector))
    if length < 1e-6:
        raise ValueError("Cannot normalize a zero-length vector")
    return vector / length


def superellipse_points(
    center: np.ndarray,
    axis: np.ndarray,
    across: np.ndarray,
    half_length: float,
    half_width: float,
) -> list[tuple[int, int]]:
    points = []
    for index in range(64):
        angle = math.tau * index / 64
        cosine = math.copysign(abs(math.cos(angle)) ** 0.65, math.cos(angle))
        sine = math.copysign(abs(math.sin(angle)) ** 0.65, math.sin(angle))
        point = center + axis * half_length * cosine + across * half_width * sine
        points.append((round(point[0]), round(point[1])))
    return points


def draw_open_palm(
    image: Image.Image,
    projected: np.ndarray,
    weights: dict[str, list[tuple[int, float]]],
    side: str,
    profile: str,
) -> None:
    hand_indices = hand_vertex_indices(len(projected), weights, side)
    hand_points = projected[hand_indices]
    wrist = project_weighted_center(projected, weights, f"wrist.{side}")
    elbow = project_weighted_center(projected, weights, f"lowerarm02.{side}")
    toward_center = normalize(np.asarray((CANVAS_WIDTH * 0.5 - wrist[0], 0.0)))
    forearm_axis = normalize(wrist - elbow)
    arm_axis = normalize(
        np.asarray((toward_center[0] * 0.30 + forearm_axis[0] * 0.08, 0.96))
    )
    perpendicular = np.asarray((-arm_axis[1], arm_axis[0]))
    if float(np.dot(perpendicular, toward_center)) < 0:
        perpendicular *= -1

    relative = hand_points - wrist
    original_extent = max(
        float(np.ptp(hand_points[:, 0])),
        float(np.ptp(hand_points[:, 1])),
        float(np.max(np.linalg.norm(relative, axis=1))),
    )
    hand_length = max(48.0, min(70.0, original_extent * 1.02))
    group = profile_group(profile)
    if group in {"infant", "early_child"}:
        hand_length *= 1.05

    erase = Image.new("L", image.size, 0)
    erase_draw = ImageDraw.Draw(erase)
    hull = convex_hull(hand_points)
    if hull:
        erase_draw.polygon(hull, fill=255)
    erase_draw.ellipse(
        (
            wrist[0] - hand_length * 0.22,
            wrist[1] - hand_length * 0.22,
            wrist[0] + hand_length * 0.22,
            wrist[1] + hand_length * 0.22,
        ),
        fill=255,
    )
    erase = erase.filter(ImageFilter.MaxFilter(31))
    erase_array = np.asarray(erase)
    alpha = np.asarray(image.getchannel("A")).copy()
    alpha[erase_array > 0] = 0
    image.putalpha(Image.fromarray(alpha, mode="L"))

    scale = 4
    mask = Image.new("L", (CANVAS_WIDTH * scale, CANVAS_HEIGHT * scale), 0)
    draw = ImageDraw.Draw(mask)

    def scaled(point: np.ndarray) -> tuple[int, int]:
        return round(point[0] * scale), round(point[1] * scale)

    palm_length = hand_length * 0.43
    palm_width = hand_length * 0.33
    palm_center = wrist + arm_axis * palm_length * 0.48
    palm = superellipse_points(
        palm_center * scale,
        arm_axis,
        perpendicular,
        palm_length * 0.55 * scale,
        palm_width * 0.50 * scale,
    )
    draw.polygon(palm, fill=255)
    draw.line(
        (scaled(wrist - arm_axis * 5), scaled(palm_center)),
        fill=255,
        width=round(palm_width * 0.72 * scale),
    )

    finger_bases = (-0.30, -0.10, 0.10, 0.30)
    finger_lengths = (0.42, 0.53, 0.50, 0.41)
    finger_spread = (-0.16, -0.055, 0.055, 0.16)
    distal_center = wrist + arm_axis * palm_length * 0.90
    finger_width = hand_length * 0.085
    for offset, length_ratio, spread in zip(
        finger_bases,
        finger_lengths,
        finger_spread,
    ):
        base = distal_center + perpendicular * palm_width * offset
        direction = normalize(arm_axis + perpendicular * spread)
        tip = base + direction * hand_length * length_ratio
        draw.line(
            (scaled(base), scaled(tip)),
            fill=255,
            width=round(finger_width * scale),
        )
        radius = finger_width * scale * 0.5
        tip_scaled = scaled(tip)
        draw.ellipse(
            (
                tip_scaled[0] - radius,
                tip_scaled[1] - radius,
                tip_scaled[0] + radius,
                tip_scaled[1] + radius,
            ),
            fill=255,
        )

    thumb_base = palm_center + perpendicular * palm_width * 0.46
    thumb_direction = normalize(arm_axis * 0.38 + perpendicular * 0.93)
    thumb_tip = thumb_base + thumb_direction * hand_length * 0.30
    draw.line(
        (scaled(thumb_base), scaled(thumb_tip)),
        fill=255,
        width=round(finger_width * 1.08 * scale),
    )
    thumb_radius = finger_width * 0.54 * scale
    thumb_scaled = scaled(thumb_tip)
    draw.ellipse(
        (
            thumb_scaled[0] - thumb_radius,
            thumb_scaled[1] - thumb_radius,
            thumb_scaled[0] + thumb_radius,
            thumb_scaled[1] + thumb_radius,
        ),
        fill=255,
    )

    outline_radius = 2 * scale
    dilated = mask.filter(ImageFilter.MaxFilter(outline_radius * 2 + 1))
    outline = Image.new("RGBA", dilated.size, OUTLINE_COLOR)
    fill = Image.new("RGBA", mask.size, FIGURE_COLOR)
    hand = Image.new("RGBA", mask.size, (0, 0, 0, 0))
    hand.alpha_composite(Image.composite(outline, hand, dilated))
    hand.alpha_composite(Image.composite(fill, Image.new("RGBA", mask.size), mask))

    crease = ImageDraw.Draw(hand)
    crease_start = palm_center + arm_axis * palm_length * 0.12
    crease_end = palm_center + arm_axis * palm_length * 0.43
    crease.line(
        (
            scaled(crease_start - perpendicular * palm_width * 0.22),
            scaled(crease_end + perpendicular * palm_width * 0.20),
        ),
        fill=DETAIL_COLOR,
        width=round(1.15 * scale),
    )
    hand = hand.resize(image.size, Image.Resampling.LANCZOS)
    image.alpha_composite(hand)


def project_weighted_center(
    projected: np.ndarray,
    weights: dict[str, list[tuple[int, float]]],
    bone_name: str,
) -> np.ndarray:
    entries = [
        (vertex, weight)
        for vertex, weight in weights.get(bone_name, ())
        if vertex < len(projected) and weight >= 0.35
    ]
    if not entries:
        raise ValueError(f"No projected vertices found for bone: {bone_name}")
    indices = np.asarray([vertex for vertex, _weight in entries])
    values = np.asarray([weight for _vertex, weight in entries])
    return np.average(projected[indices], axis=0, weights=values)


def draw_friendly_face(image: Image.Image, profile: str) -> None:
    rgba = np.asarray(image)
    alpha = rgba[:, :, 3]
    ys, xs = np.where(alpha > 10)
    body_top = int(ys.min())
    body_height = int(ys.max() - body_top + 1)
    head_height = body_height * HEAD_HEIGHT_RATIOS[profile_group(profile)]
    sample_y = min(CANVAS_HEIGHT - 1, round(body_top + head_height * 0.43))
    head_x = np.flatnonzero(alpha[sample_y] > 10)
    if not len(head_x):
        raise ValueError(f"Cannot locate head for profile: {profile}")
    center_x = float((head_x.min() + head_x.max()) * 0.5)
    face_width = float(head_x.max() - head_x.min() + 1)
    center_y = body_top + head_height * 0.48
    body_pixels = rgba[
        round(body_top + head_height * 1.20) : round(body_top + head_height * 1.45),
        round(center_x - face_width * 0.20) : round(center_x + face_width * 0.20),
        :3,
    ]
    body_alpha = alpha[
        round(body_top + head_height * 1.20) : round(body_top + head_height * 1.45),
        round(center_x - face_width * 0.20) : round(center_x + face_width * 0.20),
    ]
    opaque_body = body_pixels[body_alpha > 200]
    sampled_figure = tuple(
        int(value) for value in np.median(opaque_body, axis=0)
    ) + (255,)

    scale = 4
    overlay = Image.new("RGBA", (CANVAS_WIDTH * scale, CANVAS_HEIGHT * scale))
    draw = ImageDraw.Draw(overlay)

    face_box = (
        round((center_x - face_width * 0.34) * scale),
        round((center_y - head_height * 0.31) * scale),
        round((center_x + face_width * 0.34) * scale),
        round((center_y + head_height * 0.31) * scale),
    )
    draw.ellipse(face_box, fill=sampled_figure)

    line_width = max(3, round(head_height * 0.0075 * scale))
    eye_y = (center_y - head_height * 0.075) * scale
    eye_offset = face_width * 0.17 * scale
    eye_half = face_width * 0.095 * scale
    eye_lift = head_height * 0.012 * scale
    for side in (-1, 1):
        eye_x = center_x * scale + side * eye_offset
        upper = (
            (eye_x - eye_half, eye_y + eye_lift * 0.45),
            (eye_x, eye_y - eye_lift),
            (eye_x + eye_half, eye_y + eye_lift * 0.45),
        )
        lower = (
            (eye_x - eye_half, eye_y + eye_lift * 0.45),
            (eye_x, eye_y + eye_lift * 1.35),
            (eye_x + eye_half, eye_y + eye_lift * 0.45),
        )
        draw.line(upper, fill=DETAIL_COLOR, width=line_width, joint="curve")
        draw.line(
            lower,
            fill=(*DETAIL_COLOR[:3], 175),
            width=max(2, round(line_width * 0.62)),
            joint="curve",
        )
        brow_y = eye_y - head_height * 0.070 * scale
        draw.line(
            (
                (eye_x - eye_half * 0.92, brow_y + eye_lift * 0.35),
                (eye_x, brow_y - eye_lift * 0.28),
                (eye_x + eye_half * 0.92, brow_y),
            ),
            fill=(*DETAIL_COLOR[:3], 190),
            width=max(2, round(line_width * 0.70)),
            joint="curve",
        )
        pupil_radius = max(1.7, head_height * 0.0052 * scale)
        draw.ellipse(
            (
                eye_x - pupil_radius,
                eye_y - pupil_radius * 0.65,
                eye_x + pupil_radius,
                eye_y + pupil_radius * 1.35,
            ),
            fill=DETAIL_COLOR,
        )

    nose_y = (center_y + head_height * 0.050) * scale
    nose_half = face_width * 0.032 * scale
    draw.line(
        (
            ((center_x - face_width * 0.012) * scale, nose_y - head_height * 0.055 * scale),
            ((center_x - face_width * 0.018) * scale, nose_y - head_height * 0.010 * scale),
            ((center_x - nose_half / scale) * scale, nose_y),
            ((center_x + nose_half / scale) * scale, nose_y),
        ),
        fill=DETAIL_COLOR,
        width=max(3, round(line_width * 0.72)),
        joint="curve",
    )

    mouth_y = (center_y + head_height * 0.155) * scale
    mouth_half = face_width * 0.105 * scale
    smile = head_height * 0.012 * scale
    draw.line(
        (
            (center_x * scale - mouth_half, mouth_y - smile * 0.15),
            (center_x * scale, mouth_y + smile),
            (center_x * scale + mouth_half, mouth_y - smile * 0.15),
        ),
        fill=DETAIL_COLOR,
        width=line_width,
        joint="curve",
    )

    overlay = overlay.resize(image.size, Image.Resampling.LANCZOS)
    image.alpha_composite(overlay)


def refine_front(
    source: Path,
    target: Path,
    profile: str,
    obj_source: Path,
    weights: dict[str, list[tuple[int, float]]],
) -> None:
    image = Image.open(source).convert("RGBA")
    vertices = load_obj_vertices(obj_source)
    projected = project_front(vertices)[:MAKEHUMAN_BODY_VERTEX_COUNT]
    draw_open_palm(image, projected, weights, "L", profile)
    draw_open_palm(image, projected, weights, "R", profile)
    draw_friendly_face(image, profile)
    image.save(target, optimize=True)


def main() -> None:
    args = parse_args()
    profiles = tuple(filter(None, args.profiles.split(",")))
    unknown_profiles = sorted(set(profiles) - set(PROFILES))
    if unknown_profiles:
        raise ValueError(f"Unknown profiles: {unknown_profiles}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    weights = load_weights(args.weights_file)
    for profile in profiles:
        for view in VIEWS:
            source = args.input_dir / f"{profile}-{view}.png"
            target = args.output_dir / source.name
            if view == "front":
                refine_front(
                    source,
                    target,
                    profile,
                    args.source_dir / f"{profile}.obj",
                    weights,
                )
            else:
                shutil.copyfile(source, target)
            print("REFINED", profile, view, target)

    print("CLINICAL_BODY_LINE_ATLAS_REFINEMENT_OK", len(profiles), len(VIEWS))


if __name__ == "__main__":
    main()

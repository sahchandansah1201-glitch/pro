#!/usr/bin/env python3
"""Render a compact visual QA sheet from an atlas region-map manifest."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


VIEW_ORDER = {"front": 0, "back": 1, "left": 2, "right": 3}
AGE_ORDER = {
    "infant": 0,
    "early_child": 1,
    "child": 2,
    "adolescent": 3,
    "late_adolescent": 4,
    "adult": 5,
    "older": 6,
}


def profile_age(profile: str) -> str:
    return next(key for key in AGE_ORDER if profile.startswith(f"{key}_"))


def colour(code: np.ndarray) -> np.ndarray:
    result = np.zeros((*code.shape, 4), dtype=np.uint8)
    active = code > 0
    result[..., 0] = (code.astype(np.uint16) * 67 % 191 + 48).astype(np.uint8)
    result[..., 1] = (code.astype(np.uint16) * 101 % 191 + 48).astype(np.uint8)
    result[..., 2] = (code.astype(np.uint16) * 149 % 191 + 48).astype(np.uint8)
    result[..., 3] = np.where(active, 92, 0).astype(np.uint8)
    return result


def contained(path: Path) -> Image.Image:
    source = Image.open(path).convert("RGBA")
    source.thumbnail((240, 400), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (240, 400), (6, 16, 21, 255))
    canvas.alpha_composite(source, ((240 - source.width) // 2, (400 - source.height) // 2))
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    payload = json.loads(args.manifest.read_text(encoding="utf-8"))
    records = sorted(
        payload["records"],
        key=lambda item: (
            AGE_ORDER[profile_age(item["profile"])],
            0 if "_female_" in item["profile"] else 1,
            VIEW_ORDER[item["view"]],
        ),
    )
    tile_width, tile_height = 180, 330
    sheet = Image.new("RGB", (tile_width * 8, tile_height * 7), "#e9eef2")
    draw = ImageDraw.Draw(sheet)

    for index, record in enumerate(records):
        row, column = divmod(index, 8)
        source_path = Path(record["sourcePath"])
        if not source_path.is_absolute():
            source_path = Path.cwd() / source_path
        mask_path = args.manifest.parent / record["mask"]
        base = contained(source_path)
        mask = np.asarray(Image.open(mask_path).convert("L"))
        overlay = Image.fromarray(colour(mask), mode="RGBA")
        base.alpha_composite(overlay)
        preview = base.resize((180, 300), Image.Resampling.LANCZOS).convert("RGB")
        x, y = column * tile_width, row * tile_height
        sheet.paste(preview, (x, y))
        label = f'{record["profile"]} · {record["view"]}'
        draw.text((x + 4, y + 306), label, fill="#182333")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(args.output, optimize=True)
    print(f"PASS visual QA sheet: {len(records)} views -> {args.output}")


if __name__ == "__main__":
    main()

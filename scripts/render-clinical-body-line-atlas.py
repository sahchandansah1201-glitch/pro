#!/usr/bin/env python3
"""Render the clinical body atlas as original flat medical line art.

Run with Blender, for example:

    blender --background --python scripts/render-clinical-body-line-atlas.py -- \
      --source-dir /tmp/skindoctor-clinical-atlas-source \
      --output-dir /tmp/skindoctor-clinical-body-line-atlas

The source directory must contain the MakeHuman-derived OBJ files named in
``PROFILES``. The generated PNG files are build artifacts; production uses the
committed WebP derivatives.
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector


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

VIEWS = {
    "front": (0.0, -1.0, 0.0),
    "back": (0.0, 1.0, 0.0),
    "left": (-1.0, 0.0, 0.0),
    "right": (1.0, 0.0, 0.0),
}

CANVAS_WIDTH = 720
CANVAS_HEIGHT = 1200
CANVAS_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT
FIGURE_COLOR = (0.98, 0.97, 0.93, 1.0)
EYE_COLOR = (0.10, 0.15, 0.16, 1.0)
OUTLINE_COLOR = (0.07, 0.12, 0.13)
DETAIL_COLOR = (0.13, 0.19, 0.20)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument(
        "--profiles",
        default=",".join(PROFILES),
        help="Comma-separated profile names.",
    )
    parser.add_argument(
        "--views",
        default=",".join(VIEWS),
        help="Comma-separated view names.",
    )
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)


def make_emission_material(name: str, color: tuple[float, float, float, float]):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    emission = nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = color
    emission.inputs["Strength"].default_value = 1.0
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    return material


def world_bounds(obj) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[index] for point in points) for index in range(3))),
        Vector(tuple(max(point[index] for point in points) for index in range(3))),
    )


def point_at(obj, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_scene() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = CANVAS_WIDTH
    scene.render.resolution_y = CANVAS_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 70
    scene.render.film_transparent = True
    scene.render.use_freestyle = True
    scene.view_settings.view_transform = "Standard"

    freestyle = bpy.context.view_layer.freestyle_settings
    freestyle.mode = "EDITOR"
    freestyle.crease_angle = math.radians(104)
    freestyle.use_suggestive_contours = True
    freestyle.use_ridges_and_valleys = False
    freestyle.use_material_boundaries = True
    freestyle.use_culling = True

    silhouette = freestyle.linesets[0]
    silhouette.name = "Clinical silhouette"
    silhouette.select_silhouette = True
    silhouette.select_contour = True
    silhouette.select_external_contour = True
    silhouette.select_border = True
    silhouette.select_crease = False
    silhouette.select_ridge_valley = False
    silhouette.select_suggestive_contour = False
    silhouette.select_material_boundary = False
    silhouette.linestyle.color = OUTLINE_COLOR
    silhouette.linestyle.alpha = 1.0
    silhouette.linestyle.thickness = 2.8
    silhouette.linestyle.caps = "ROUND"

    detail = freestyle.linesets.new("Clinical surface detail")
    detail.select_silhouette = False
    detail.select_contour = False
    detail.select_external_contour = False
    detail.select_border = False
    detail.select_crease = False
    detail.select_ridge_valley = False
    detail.select_suggestive_contour = True
    detail.select_material_boundary = True
    detail.linestyle.color = DETAIL_COLOR
    detail.linestyle.alpha = 0.86
    detail.linestyle.thickness = 1.45
    detail.linestyle.caps = "ROUND"

    if scene.world is None:
        scene.world = bpy.data.worlds.new("Clinical atlas world")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (1.0, 1.0, 1.0, 0.0)
    background.inputs["Strength"].default_value = 0.0


def import_profile(source_dir: Path, profile: str):
    source = source_dir / f"{profile}.obj"
    if not source.is_file():
        raise FileNotFoundError(source)

    bpy.ops.wm.obj_import(
        filepath=os.fspath(source),
        forward_axis="NEGATIVE_Z",
        up_axis="Y",
    )
    imported = list(bpy.context.selected_objects)
    body = max(imported, key=lambda obj: len(obj.data.vertices))

    if len(imported) > 1:
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()

    eye_slots = {
        index
        for index, material in enumerate(body.data.materials)
        if material and "eye" in material.name.lower()
    }
    eye_faces = {
        polygon.index
        for polygon in body.data.polygons
        if polygon.material_index in eye_slots
    }

    for polygon in body.data.polygons:
        polygon.use_smooth = True

    subdivision = body.modifiers.new(name="Clinical line smoothing", type="SUBSURF")
    subdivision.subdivision_type = "CATMULL_CLARK"
    subdivision.levels = 1
    subdivision.render_levels = 1

    body.data.materials.clear()
    body.data.materials.append(make_emission_material("Atlas figure", FIGURE_COLOR))
    body.data.materials.append(make_emission_material("Atlas eyes", EYE_COLOR))
    for polygon in body.data.polygons:
        polygon.material_index = 1 if polygon.index in eye_faces else 0

    minimum, maximum = world_bounds(body)
    body.location -= (minimum + maximum) * 0.5
    bpy.context.view_layer.update()
    return body, *world_bounds(body)


def setup_camera(minimum: Vector, maximum: Vector, view_vector) -> None:
    center = (minimum + maximum) * 0.5
    height = maximum.z - minimum.z
    width = maximum.x - minimum.x
    depth = maximum.y - minimum.y
    projected_width = depth if abs(view_vector[0]) > 0.5 else width
    vertical_scale = height * 1.055
    horizontal_scale = projected_width / CANVAS_ASPECT * 1.055
    ortho_scale = max(vertical_scale, horizontal_scale)
    distance = max(height, width, depth) * 3.2

    camera_data = bpy.data.cameras.new("Clinical orthographic camera")
    camera = bpy.data.objects.new("Clinical orthographic camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = center + Vector(view_vector) * distance
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    point_at(camera, center)
    bpy.context.scene.camera = camera


def render_profile(
    source_dir: Path,
    output_dir: Path,
    profile: str,
    view_name: str,
) -> None:
    clear_scene()
    _body, minimum, maximum = import_profile(source_dir, profile)
    setup_camera(minimum, maximum, VIEWS[view_name])
    output = output_dir / f"{profile}-{view_name}.png"
    bpy.context.scene.render.filepath = os.fspath(output)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", profile, view_name, output)


def main() -> None:
    args = parse_args()
    profiles = tuple(filter(None, args.profiles.split(",")))
    views = tuple(filter(None, args.views.split(",")))
    unknown_profiles = sorted(set(profiles) - set(PROFILES))
    unknown_views = sorted(set(views) - set(VIEWS))
    if unknown_profiles or unknown_views:
        raise ValueError(
            f"Unknown profiles={unknown_profiles}; unknown views={unknown_views}"
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    clear_scene()
    setup_scene()
    for profile in profiles:
        for view_name in views:
            render_profile(args.source_dir, args.output_dir, profile, view_name)

    print("CLINICAL_BODY_LINE_ATLAS_RENDER_OK", len(profiles), len(views))


if __name__ == "__main__":
    main()

# Clinical body atlas

## Decision

The body-map workspace uses original flat clinical line art rendered from
parametric human models. It follows the familiar medical-atlas convention of a
light figure, dark contour, four orthographic views, visible hands and feet, and
restrained surface landmarks. The models preserve a consistent coordinate
surface while showing age-dependent head, trunk, limb, shoulder, and pelvic
proportions.

Seven age profiles are available:

- under 1 year;
- 1-4 years;
- 5-9 years;
- 10-14 years;
- 15-17 years;
- 18-64 years;
- 65 years and older.

Each profile has female and male front, back, left, and right views. The scalp
uses a dedicated orientation diagram with vertex and quadrant guides.

## Source and license

The meshes were generated with MakeHuman Community 1.3. MakeHuman states that
exported models are released under CC0, allowing their use and modification in
the product without carrying MakeHuman's application license into the product.

- MakeHuman source: https://github.com/makehumancommunity/makehuman
- MakeHuman generated-model FAQ:
  https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html
- MakeHuman body modeling documentation:
  https://static.makehumancommunity.org/makehuman/docs/modeling_the_body.html

## Alternatives considered

- The previous hand-drawn SVG was rejected because its proportions and surface
  detail were too schematic for lesion placement.
- SMPL was not selected because its official model license is limited to
  non-commercial scientific research unless a separate commercial license is
  obtained.
- Generated photographs were not selected because they are harder to keep
  anatomically consistent across age, sex, and four orthographic views and may
  imply a real patient identity.

MakeHuman was selected because one parametric source controls age, sex, weight,
muscle, height, and body proportions, and its exported models are CC0. The
production atlas uses a flat light material, clinical contour lines, and a fixed
orthographic camera. This keeps the surface readable without suggesting a
diagnosis or representing a real patient. A user-provided screenshot was used
only to establish the visual direction; no image, tracing, or interface asset
from that application is included in the product.

## Generation profile

The source parameters use representative ages 1, 3, 7, 13, 16, 30, and 70.
Height and body-proportion controls stay neutral; weight and muscle are kept in
the middle of their ranges with small age-appropriate adjustments. The Blender
renderer in `scripts/render-clinical-body-line-atlas.py` creates original
transparent PNGs with silhouette and surface-detail line sets. Every model is
rendered from identical front, back, left, and right orthographic cameras and
committed as a 720 x 1200 WebP. The interface fits each image to a stable
240 x 400 coordinate surface so existing normalized lesion positions remain
compatible. The committed assets, not MakeHuman or Blender, are production
runtime dependencies.

## Product boundary

The atlas is a placement surface only. It does not infer a diagnosis, severity,
or anatomical finding. Lesion coordinates remain normalized and the backend
contract is unchanged.

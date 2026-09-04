# Clinical body atlas

## Active product decision

The doctor body-map workspace uses only the owner-approved static render package
`clinical-body-atlas-daz-age-sex-matrix-hires-r2-2026-08-06`. The active
runtime source is `daz-hires-local`; the former MakeHuman line-art package is a
legacy compatibility artifact and is not selectable by the doctor UI or the
self-hosted runtime configuration.

The exact deployable manifest SHA-256 is:

```text
0afadcfdfffb5a6a23e7061ca2fc48eba951e32395eecdde8313e846fac4c741
```

## Coverage and resolution

Seven age profiles are available:

- under 1 year;
- 1-4 years;
- 5-9 years;
- 10-14 years;
- 15-17 years;
- 18-64 years;
- 65 years and older.

Each profile has female and male front, back, left, and right views: 14 models
and 56 static rendered PNG files in total. Every render is `2880 x 4320` RGBA.
The doctor can zoom to 800% while the displayed surface remains within the
native pixel dimensions. The scalp keeps its dedicated orientation diagram.

## Source and rights boundary

This exact high-resolution package was rendered with DAZ Studio 6 from Genesis
9 characters and the installed age morph products documented in the source
package. The owner explicitly selected the rendered models for product use and
confirmed their right to use the resulting assets.

Only static rendered PNG files are included in the product. DAZ source assets,
textures, morph files and `.duf` files are not copied. Earlier MakeHuman-derived
line-art images remain in repository history for compatibility and auditability,
but are not an active runtime source.

## Runtime geometry

The high-resolution images are fitted without distortion to the stable
`240 x 400` normalized coordinate surface. A package-specific mask and SVG hit
map is generated from every exact render. The manifest binds each source image,
mask and hit map by SHA-256. The backend rejects a placement when the active
source, patient profile, manifest hash, map hash, view, region or point does not
match the pinned package.

The generated navigation masks provide technical coverage of the rendered
silhouette. They do not constitute clinical acceptance of the 114 anatomical
labels or borders.

## Clinical boundary

The atlas is a navigation index only. It does not diagnose a lesion, estimate
risk, recommend treatment or replace a source photograph. The source photograph
remains the clinical primary record. The two under-one-year profiles still need
separate physician/anatomist confirmation of age-specific proportions, and all
114 terminology rows and 56 rendered borders remain subject to the signed
clinical review gate.

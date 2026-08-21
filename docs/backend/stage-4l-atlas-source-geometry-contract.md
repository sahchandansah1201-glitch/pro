# Stage 4L · Atlas source and geometry contract

Status: local implementation gate. Production, asset distribution and clinical
validation remain out of scope.

## Contract delta

Before this gate, a body-map write carried only `view`, normalized coordinates,
`regionId` and optional `detailId`. The backend checked the registry id, view and
coordinate range, but trusted the UI to decide which profile/source map had been
clicked and whether the point was inside the claimed region.

After this gate, every new or corrected placement must also carry:

- `atlasSource`: `makehuman-cc0` or `daz-hires-local`;
- `atlasProfileId`: the stable age/sex profile asset id.

The backend owns the trust decision. It derives the expected profile from the
patient sex and age at `visit.startedAt` (falling back to immutable
`visit.createdAt`), requires the request source to match its configured source,
verifies the configured manifest SHA-256, loads the exact profile/view hit map,
and rejects a point outside the claimed region. Request-provided hashes are not
accepted.

Successful writes persist the server-derived source, profile id, manifest hash
and region-map hash beside the placement. Historical rows remain readable with
all four fields null. The schema change is additive; application rollback leaves
the columns in place.

## Deployable packages

`makehuman-cc0` is the only package committed to and copied by the backend image.
Its manifest is pinned by the backend default configuration. `daz-hires-local`
is accepted only when an operator explicitly provides a local atlas directory
and the expected manifest SHA-256. This contract does not grant distribution
rights and does not copy, commit, publish or deploy DAZ assets.

## Geometry rules

- Hit maps use the owned generator grammar of integer one-pixel horizontal runs
  in a `240 x 400` SVG view box.
- Coordinates are rounded to five decimals for persistence, then mapped to the
  corresponding zero-based atlas pixel for validation.
- The claimed `regionId` path must cover that pixel.
- Scalp regions use the same clipped ellipse and five rectangles rendered by the
  UI; their canonical geometry string is hashed as the map version.
- Missing, malformed, unpinned or source/profile-mismatched maps fail closed.

## Compatibility and affected consumers

- UI production create/correction payloads add source and profile id.
- Backend create/correction services require atlas context only when `bodyMap`
  is present; non-body-map lesion writes are unchanged.
- Lesion read/write DTOs expose the four persisted atlas metadata fields.
- OpenAPI `BodyMapPlacementRequest` documents the two new required fields.
- No new HTTP header or CORS rule is introduced.

## Acceptance criteria

1. A point inside the exact profile/view/region is accepted and returns
   server-derived hashes.
2. Source mismatch, profile mismatch and point-outside-region each return a
   field-specific `422` without a lesion mutation.
3. A malformed or missing hit map and an unpinned local package fail closed.
4. Create replay and optimistic correction preserve their existing contracts.
5. PostgreSQL proves additive migration, metadata persistence and audit coupling
   on synthetic data.
6. The rendered doctor route remains usable at desktop and mobile widths with
   native Russian recovery copy.

## Safety boundary

This validates technical consistency between a click and a versioned atlas map.
It does not clinically validate the 114 labels/borders, identify an individual
finger or toe automatically, diagnose a lesion, or make the generic atlas a
substitute for the source photograph.

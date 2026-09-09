# WagerProof achievement medals

The 24 approved concepts across six families now have editable Blender review
masters, standalone USDZ exports, manifests, and actual exported-model renders.
All bodies, reverse surfaces, and raised front details follow the approved bow.

[Review the complete collection](COLLECTION-REVIEW.md)

| Family | Awards | Review |
| --- | --- | --- |
| Getting Started | First Agent, First Follow, First Picks | [Shields](SHIELD-REVIEW.md) |
| Agent Experience | 10, 50, 100, 500 graded picks | [Tickets](experience/family-review.md) |
| Winning Streaks | 3, 5, 10, 15 wins | [Flames](streaks/family-review.md) |
| Performance | First Win, +10 Units, +25 Units, Consistent 55% | [Diamonds](performance/family-review.md) |
| Leaderboard | Top 100, Top 10, Number One | [Crowns](leaderboard/family-review.md) |
| Exploration | Game Analyst, Props Scout, Trend Explorer, System Builder, WagerBot Partner, Connected Researcher | [Compasses](exploration/family-review.md) |

## Delivery boundary

All 24 medals are integrated into the native iOS achievement collection through six optimized, cached RealityKit family hierarchies. The app implements durable server unlocks, personalized curved engraving and celebrations. The updated signed build is installed on the selected iPhone 14 Pro. See `docs/achievements-ios.md` and `docs/achievements-backend.md` at the repository root for validation and deployment details.

The approved image concepts are retained under `references/`. Their silhouettes,
color progression, and front symbols guided these models. The user's later
curvature corrections apply to every family, including numerals and small details.

## Rebuild

Blender 5.2.0 LTS is installed at
`/Applications/Blender.app/Contents/MacOS/Blender`. Background execution requires
the elevated shell environment on this machine to avoid a startup crash.

The five newer families use `scripts/medal_studio.py` and these entry points:

- `scripts/build-experience-medals.py`
- `scripts/build-streak-medals.py`
- `scripts/build-performance-medals.py`
- `scripts/build-leaderboard-medals.py`
- `scripts/build-exploration-medals.py`

For example:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --python-exit-code 1 --python scripts/build-exploration-medals.py
```

A full run builds every family variant, saves packed `.blend` masters, exports
USDZs, reimports them, checks closed outward meshes, and renders front/angle
views for each plus representative top/back views. `-- --preview --variant
<slug-or-label>` renders a single variant's angle and top for iteration. All
`usdz-*.png` files are renders of the reimported export.

The three original shields retain their own shared builder and wrappers:
`build-first-agent-medal.py`, `build-first-follow-medal.py`, and
`build-first-picks-medal.py`. For those builders, run `-- --proof` separately
after the source build. Their revision 2 backups preserve the earlier bow.

## Geometry and materials

- Local construction coordinates: +X right, +Y up, +Z front. USD exports are Y-up.
- Shared bowed surface: `0.135 + sqrt(5.6^2 - 3.8*x^2 - y^2) - 5.6`.
- Front layers use constant relief offsets over that surface. Exact cap normals
  keep reflections smooth across the bend.
- New polygon meshes use conforming triangle subdivision along long edges.
  This retains the curvature with fewer faces than uniform refinement.
- Bronze, silver, gold, satin reverse, colored acrylic, and ivory enamel are
  separate editable material roles. Flame cells and emerald crown panels retain
  their own colors.
- The compass chassis has four physical open arcs and four cardinal bridges.
  Its actual export front render also passed an alpha-sample check in
  `exploration/openings-verification.json`.

## Personalization contract

Each export contains a named root, a `<Prefix>_Front_Frame`, and rear engraving,
name, caption, and date anchors. Sample inscription geometry appears in the
Blender master and review renders only. It is excluded from the USDZ. The
native app fits recipient text to the curved reverse using the manifest
and anchors.

The studio HDR comes from Honeydew origin/main
`c1f75ce808b396d1351e2f6934616752824b0027` and is packed into each Blender file.
Sample text uses SF Pro Rounded Bold; exported assets contain no user text or
font dependency.

## Verification

Each manifest records source and actual USDZ reimport geometry results, finite
vertices/normals, bound materials, coordinate orientation, and exclusion of
studio lights/cameras and sample text from exports. Shields additionally retain
their independent USD geometry reports.

```sh
python3 scripts/verify-achievement-asset-catalog.py
```

This checks all 24 deliveries and their existing audit reports without repeating
mesh processing. `catalog-verification.json` stores the final collection result.

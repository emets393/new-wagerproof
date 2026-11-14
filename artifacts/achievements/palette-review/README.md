# Family palette revision

The current palette replaces the original lime treatment with six distinct families. The comparison sheet contains actual reimported USDZ renders under the same studio lighting.

| Family | Face | Accent |
|---|---|---|
| Getting Started | Emerald #008B48 | Mint check; neutral pixel faces |
| Experience | Sapphire #175BC5 | Ice-blue numeral enamel |
| Win Streaks | Ember #E74712 | Amber #FFAB25 side cells |
| Performance | Amethyst #763AB9 | Pale lilac enamel |
| Leaderboard | Ruby #AA1644 | Rose #E64C70 side panels |
| Exploration | Teal #008D94 | Aqua #45CABB details, mint enamel |

Tier metals, shapes, curves, cutouts and engraved reverses are unchanged. All 24 current Blender masters, standalone exports, six iOS family exports and 24 bundled thumbnails are updated. Older multi-angle review renders and simulator captures predate this palette pass; use this folder and current front thumbnails for the new colors.

The reproducible source is `scripts/medal_palette.py`, applied by the shared export function. `scripts/recolor-achievement-medals.py` revises existing verified geometry without rebuilding it. Previous runtime exports and thumbnails are preserved in `artifacts/achievements/revisions/pre-family-colors.zip`.

This is an asset-only revision. The running simulator app has not been rebuilt or reinstalled for this pass.

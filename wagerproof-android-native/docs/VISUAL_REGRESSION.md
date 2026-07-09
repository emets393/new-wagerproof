# Android visual regression harness

The debug build contains an isolated `VisualRegressionActivity` modeled after
iOS `ScreenshotHarness`. It renders a named scenario directly and never enters
`RootHost`, changes production routes, or ships in release builds.

## Capture

Use a portrait Pixel 8 / API 35 emulator for reference captures:

```bash
cd wagerproof-android-native
NORMALIZE_DEVICE=1 ./scripts/capture_android_visuals.sh all
```

Capture one surface while iterating:

```bash
SKIP_INSTALL=1 ./scripts/capture_android_visuals.sh game-nba-collapsed /tmp/wagerproof-visuals
```

Capture only the fixture-backed smoke matrix:

```bash
SKIP_INSTALL=1 NORMALIZE_DEVICE=1 ./scripts/capture_android_visuals.sh stable
```

The script installs the debug APK, disables system animations, requests SystemUI
demo mode (10:00, full battery, stable network icons), launches each
scenario with `--es scenario <slug>`, performs the declared collapse gesture,
captures PNGs, records device metadata, and restores animation/viewport settings
on exit. `NORMALIZE_DEVICE=1` applies the reference 1080×2400 / 420 dpi viewport.

The authoritative scenario and CI matrix is
`app/src/debug/assets/visual-regression-matrix.json`. CI can shard with:

```bash
jq -r '.scenarios[].slug' app/src/debug/assets/visual-regression-matrix.json
```

## Stability policy

Rows marked `stable: true` are fixture-backed and suitable for review/baseline
promotion. Rows marked false intentionally capture a first-load seam involving
an app-local store, RevenueCat SDK surface, remote imagery, or an infinite
animation. They remain useful screenshots but must not become pixel-golden
assertions until those dependencies gain injectable clocks/image loaders/stores.

No threshold-based pixel assertion is committed yet: font rasterization,
RevenueCat dashboard UI, remote logos, and animated pixel-wave surfaces are not
stable across physical GPUs. CI should first archive the PNG matrix as an
artifact; promote only stable rows to golden comparison once the reference
emulator image is pinned.

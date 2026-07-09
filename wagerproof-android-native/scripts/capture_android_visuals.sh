#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MATRIX="$ROOT/app/src/debug/assets/visual-regression-matrix.json"
PACKAGE="com.wagerproof.mobile.debug"
COMPONENT="$PACKAGE/com.wagerproof.app.visual.VisualRegressionActivity"
SELECTION="${1:-all}"
OUTPUT="${2:-$ROOT/build/visual-regression}"
ADB="${ADB:-adb}"

command -v "$ADB" >/dev/null || { echo "adb is required" >&2; exit 1; }
command -v jq >/dev/null || { echo "jq is required to read $MATRIX" >&2; exit 1; }

mkdir -p "$OUTPUT"

if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  "$ROOT/gradlew" -p "$ROOT" :app:installDebug
fi

old_window="$($ADB shell settings get global window_animation_scale | tr -d '\r')"
old_transition="$($ADB shell settings get global transition_animation_scale | tr -d '\r')"
old_animator="$($ADB shell settings get global animator_duration_scale | tr -d '\r')"

restore_device() {
  $ADB shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null 2>&1 || true
  $ADB shell settings put global window_animation_scale "$old_window" >/dev/null
  $ADB shell settings put global transition_animation_scale "$old_transition" >/dev/null
  $ADB shell settings put global animator_duration_scale "$old_animator" >/dev/null
  if [[ "${NORMALIZE_DEVICE:-0}" == "1" ]]; then
    $ADB shell wm size reset >/dev/null
    $ADB shell wm density reset >/dev/null
  fi
}
trap restore_device EXIT

$ADB shell settings put global window_animation_scale 0 >/dev/null
$ADB shell settings put global transition_animation_scale 0 >/dev/null
$ADB shell settings put global animator_duration_scale 0 >/dev/null
$ADB shell settings put global sysui_demo_allowed 1 >/dev/null 2>&1 || true
$ADB shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null 2>&1 || true
$ADB shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1000 >/dev/null 2>&1 || true
$ADB shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false >/dev/null 2>&1 || true
$ADB shell am broadcast -a com.android.systemui.demo -e command network -e wifi show -e level 4 -e mobile hide >/dev/null 2>&1 || true

if [[ "${NORMALIZE_DEVICE:-0}" == "1" ]]; then
  $ADB shell wm size 1080x2400 >/dev/null
  $ADB shell wm density 420 >/dev/null
fi

capture() {
  local slug="$1"
  local delay_ms="$2"
  local gesture="$3"

  $ADB shell am force-stop "$PACKAGE"
  $ADB shell am start -W -n "$COMPONENT" --es scenario "$slug" >/dev/null
  sleep "$(awk "BEGIN { print $delay_ms / 1000 }")"

  if [[ "$gesture" == "collapse" ]]; then
    local size width height x y1 y2
    size="$($ADB shell wm size | tail -1 | sed 's/.*: //' | tr -d '\r')"
    width="${size%x*}"
    height="${size#*x}"
    x=$((width / 2))
    y1=$((height * 75 / 100))
    y2=$((height * 30 / 100))
    $ADB shell input swipe "$x" "$y1" "$x" "$y2" 350
    sleep 0.25
  fi

  $ADB exec-out screencap -p > "$OUTPUT/$slug.png"
  echo "$slug -> $OUTPUT/$slug.png"
}

if [[ "$SELECTION" == "all" || "$SELECTION" == "stable" ]]; then
  filter='.scenarios[]'
  if [[ "$SELECTION" == "stable" ]]; then
    filter='.scenarios[] | select(.stable == true)'
  fi
  while IFS=$'\t' read -r slug delay gesture; do
    capture "$slug" "$delay" "$gesture"
  done < <(jq -r "$filter | [.slug, (.delay_ms // 500), (.gesture // \"none\")] | @tsv" "$MATRIX")
else
  row="$(jq -r --arg slug "$SELECTION" '.scenarios[] | select(.slug == $slug) | [.slug, (.delay_ms // 500), (.gesture // "none")] | @tsv' "$MATRIX")"
  [[ -n "$row" ]] || { echo "Unknown scenario: $SELECTION" >&2; exit 2; }
  IFS=$'\t' read -r slug delay gesture <<< "$row"
  capture "$slug" "$delay" "$gesture"
fi

$ADB shell wm size > "$OUTPUT/device.txt"
$ADB shell wm density >> "$OUTPUT/device.txt"
$ADB shell getprop ro.product.model >> "$OUTPUT/device.txt"
cp "$MATRIX" "$OUTPUT/matrix.json"

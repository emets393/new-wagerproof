#!/usr/bin/env bash
# Fail if a release artifact ships without the Meta app id compiled in.
#
# This exists because the failure it catches already shipped: FACEBOOK_APP_ID was
# injected-only, nothing injected it, so BuildConfig.FACEBOOK_APP_ID compiled to "" and
# MetaAnalyticsService.initialize() bailed on its blank check every launch. The code was
# all there and every build said BUILD SUCCESSFUL; Meta received nothing, not even the
# auto-logged install. Only the artifact tells the truth, so check the artifact.
#
# Usage: scripts/verify-meta-attribution.sh <path to .aab or .apk>
set -euo pipefail

ARTIFACT="${1:?usage: verify-meta-attribution.sh <app-release.aab|app-release.apk>}"
META_APP_ID="${META_APP_ID:-935005752525075}"

[ -f "$ARTIFACT" ] || { echo "Artifact not found: $ARTIFACT" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# AABs keep dex under base/dex/, APKs at the root. Ask for both; unzip -q exits
# non-zero when a pattern matches nothing, hence the || true plus the count check.
unzip -q -o "$ARTIFACT" 'base/dex/*.dex' '*.dex' -d "$WORK" 2>/dev/null || true
DEX_COUNT="$(find "$WORK" -name '*.dex' | wc -l | tr -d ' ')"
[ "$DEX_COUNT" -gt 0 ] || { echo "No dex found in $ARTIFACT" >&2; exit 1; }

# --binary-files=text, not `strings`: R8 stores the id as a plain UTF-8 dex string and
# not every runner image ships binutils.
if find "$WORK" -name '*.dex' -exec grep -l --binary-files=text "$META_APP_ID" {} + >/dev/null 2>&1; then
  echo "OK: Meta app id $META_APP_ID present in $(basename "$ARTIFACT") ($DEX_COUNT dex)."
else
  echo "ERROR: Meta app id $META_APP_ID is absent from $ARTIFACT." >&2
  echo "Attribution would ship dead — no install, registration, paywall or purchase" >&2
  echo "events reach Meta. Check FACEBOOK_APP_ID in app/build.gradle.kts." >&2
  exit 1
fi

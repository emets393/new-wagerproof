#!/bin/sh
#
# ci_post_clone.sh — Xcode Cloud post-clone hook.
#
# Runs right after Xcode Cloud clones the repo, before dependency resolution
# and build. Its only job is to regenerate Wagerproof.xcodeproj from
# project.yml via XcodeGen.
#
# Why this is needed: this repo is a monorepo, and project.pbxproj is
# committed (not gitignored) for convenience, but project.yml is the real
# source of truth (see project.yml's header comment). A committed pbxproj can
# silently drift out of sync with project.yml if someone edits the spec
# without re-running `xcodegen generate` locally before pushing — Xcode Cloud
# has no local dev step to catch that, so regenerate unconditionally here to
# guarantee the build always reflects project.yml.
#
# Homebrew is preinstalled on Xcode Cloud's macOS image, so `brew install
# xcodegen` needs no bootstrapping.
set -eu

if ! command -v xcodegen >/dev/null 2>&1; then
    echo "ci_post_clone: xcodegen not found — installing via Homebrew"
    brew install xcodegen
fi

cd "${CI_PRIMARY_REPOSITORY_PATH}/wagerproof-ios-native"
echo "ci_post_clone: regenerating Wagerproof.xcodeproj from project.yml"
xcodegen generate

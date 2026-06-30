#!/usr/bin/env bash
#
# Conductor workspace dependency bootstrap.
#
# Companion to scripts/conductor-setup.sh (which materializes gitignored .env
# files). Every Conductor workspace is a fresh git worktree, and node_modules is
# gitignored — so a brand-new workspace has NO installed deps and npm-based local
# tooling can't run. Most visibly the agents-v3 Trigger.dev worker:
# `npm run dev` / `npx trigger.dev dev` can't even resolve its deps until you
# `cd agents-v3 && npm install` by hand. This script does that install in every
# workspace so each one is ready to run out of the box.
#
# Safe to re-run: a directory whose node_modules already exists is skipped, so
# repeated setup runs are fast. (Lockfile bumps are picked up by a manual
# `npm install` — see agents-v3/README.md.)
#
# Conductor runs this automatically via .conductor/settings.toml (scripts.setup),
# chained after conductor-setup.sh. To install by hand from a workspace:
#   bash scripts/conductor-deps.sh
#
# See .conductor/README.md for the full setup guide.

set -euo pipefail

# --- Manifest: every dir with its own package.json a workspace must install ---
# Add new npm projects here (relative to the repo root).
NPM_DIRS=(
  "agents-v3"
)

log()  { printf '  conductor-deps: %s\n' "$*"; }
warn() { printf '  conductor-deps: WARNING: %s\n' "$*" >&2; }

workspace="${CONDUCTOR_WORKSPACE_PATH:-$PWD}"

if ! command -v npm >/dev/null 2>&1; then
  warn "npm not found on PATH — skipping dependency install."
  warn "install Node 20+ (https://nodejs.org), then re-run: bash scripts/conductor-deps.sh"
  exit 0
fi

installed=0
for rel in "${NPM_DIRS[@]}"; do
  dir="$workspace/$rel"

  if [[ ! -f "$dir/package.json" ]]; then
    warn "$rel has no package.json — skipping"
    continue
  fi

  # Idempotent: a populated node_modules means this workspace is already set up.
  if [[ -d "$dir/node_modules" ]]; then
    log "$rel/node_modules present — skipping"
    continue
  fi

  log "installing $rel deps…"
  # `npm ci` for a clean, lockfile-exact install when a lockfile exists; fall
  # back to `npm install` otherwise. A failure here (e.g. offline) must not abort
  # the whole workspace setup — surface it and let the user re-run by hand.
  if [[ -f "$dir/package-lock.json" ]]; then
    ( cd "$dir" && npm ci ) || { warn "npm ci failed in $rel — run 'cd $rel && npm install' once online"; continue; }
  else
    ( cd "$dir" && npm install ) || { warn "npm install failed in $rel — run it by hand once online"; continue; }
  fi
  installed=$((installed + 1))
  log "installed $rel deps"
done

log "done — installed deps in $installed dir(s)"

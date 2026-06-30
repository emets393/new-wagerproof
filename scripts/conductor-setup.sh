#!/usr/bin/env bash
#
# Conductor workspace env bootstrap.
#
# Every Conductor workspace is a fresh git worktree. .env files are gitignored
# (they hold secrets), so a brand-new workspace starts with NO env files and
# local tooling cannot boot — e.g. the agents-v3 Trigger.dev worker dies with
# "supabaseUrl is required". This script copies the canonical .env files from a
# single secret source into the new workspace so every workspace is ready to run
# without hand-copying secrets.
#
# Secrets never enter git:
#   - Every destination path must be gitignored; the script refuses to write a
#     path that `git check-ignore` does not confirm as ignored.
#   - Copied files are chmod 600 (owner read/write only).
#
# Secret source (where the filled-in canonical .env files live), first match wins:
#   1. $WAGERPROOF_SECRETS_DIR  — explicit override; keep secrets fully outside
#                                 any checkout (e.g. ~/.config/wagerproof). Use
#                                 the same relative layout as the repo
#                                 (.env, agents-v3/.env).
#   2. $CONDUCTOR_ROOT_PATH     — the main repo checkout (default). Fill in your
#                                 env files there once; every workspace inherits
#                                 them.
#
# Safe to re-run. Conductor runs it automatically via .conductor/settings.toml
# (scripts.setup). To provision by hand from a workspace:
#   bash scripts/conductor-setup.sh
#
# See .conductor/README.md for the full setup guide.

set -euo pipefail

# --- Manifest: every gitignored env file a workspace needs ------------------
# Add new env files here (relative to the repo root). Each should have a
# committed "<path>.example" template alongside it.
ENV_FILES=(
  ".env"
  "agents-v3/.env"
)

log()  { printf '  conductor-setup: %s\n' "$*"; }
warn() { printf '  conductor-setup: WARNING: %s\n' "$*" >&2; }

# Only materialize local secret files on a local Mac workspace. Cloud workspaces
# receive secrets through Conductor managed environment variables, not files.
if [[ "${CONDUCTOR_IS_LOCAL:-1}" == "0" ]]; then
  log "cloud workspace — skipping local .env materialization"
  exit 0
fi

workspace="${CONDUCTOR_WORKSPACE_PATH:-$PWD}"

# Resolve the secret source directory (see header for precedence).
if [[ -n "${WAGERPROOF_SECRETS_DIR:-}" ]]; then
  src="${WAGERPROOF_SECRETS_DIR%/}"
elif [[ -n "${CONDUCTOR_ROOT_PATH:-}" ]]; then
  src="${CONDUCTOR_ROOT_PATH%/}"
else
  # Manual run outside Conductor: fall back to the git root.
  src="$(git -C "$workspace" rev-parse --show-toplevel 2>/dev/null || echo "$workspace")"
fi

# If the secret source IS this workspace, there is nothing to copy into it
# (this is the case when the script runs inside the root checkout itself).
src_real="$(cd "$src" 2>/dev/null && pwd -P || true)"
ws_real="$(cd "$workspace" 2>/dev/null && pwd -P || true)"
if [[ -n "$src_real" && "$src_real" == "$ws_real" ]]; then
  log "secret source is this workspace ($src) — nothing to copy"
  exit 0
fi

if [[ ! -d "$src" ]]; then
  warn "secret source '$src' does not exist — skipping (no .env files materialized)"
  warn "set WAGERPROOF_SECRETS_DIR or populate the root checkout, then re-run."
  exit 0
fi

missing_src=()
copied=0
for rel in "${ENV_FILES[@]}"; do
  src_file="$src/$rel"
  dst_file="$workspace/$rel"

  # If git already tracks this path, the worktree checkout provides it — skip.
  # (The repo currently tracks the web `.env`; only truly-gitignored files such
  # as agents-v3/.env need materializing.)
  if git -C "$workspace" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
    log "$rel is tracked by git — provided by the checkout, skipping"
    continue
  fi

  if [[ ! -f "$src_file" ]]; then
    missing_src+=("$rel")
    continue
  fi

  # Security guard: only write to a path git is configured to ignore, so a
  # copied secret can never land on a committable (untracked-but-not-ignored)
  # path and get added by accident.
  if ! git -C "$workspace" check-ignore -q "$rel" 2>/dev/null; then
    warn "'$rel' is neither tracked nor gitignored — refusing to write a secret to a committable path"
    continue
  fi

  mkdir -p "$(dirname "$dst_file")"
  cp "$src_file" "$dst_file"
  chmod 600 "$dst_file"
  copied=$((copied + 1))
  log "wrote $rel"
done

if [[ ${#missing_src[@]} -gt 0 ]]; then
  warn "no canonical secret found in '$src' for: ${missing_src[*]}"
  warn "fill these in the secret source once, then re-run setup. Templates:"
  for rel in "${missing_src[@]}"; do
    [[ -f "$workspace/${rel}.example" ]] && warn "  cp ${rel}.example <secret-source>/${rel}   # then edit"
  done
fi

log "done — materialized $copied env file(s) from $src"

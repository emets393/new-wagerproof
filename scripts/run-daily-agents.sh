#!/usr/bin/env bash
# =============================================================================
# WagerProof Daily Agent Runner (local / cron version)
#
# Use this if you want the agents to run on your laptop instead of GitHub
# Actions.  Add to crontab with:
#
#   crontab -e
#   0 7 * * * /path/to/wagerproof/scripts/run-daily-agents.sh >> /tmp/wagerproof-agents.log 2>&1
#
# Requirements:
#   - Claude Code CLI installed: npm install -g @anthropic-ai/claude-code
#   - ANTHROPIC_API_KEY set in your shell profile or a .env file
#   - gh CLI installed and authenticated: brew install gh && gh auth login
#   - Laptop must be on and connected to the internet at scheduled time
#     (use GitHub Actions for more reliable scheduling)
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${REPO_DIR}/.claude/agent-outputs"
TODAY=$(date +%Y-%m-%d)
BRANCH="agent/daily-improvements-${TODAY}"
LOG_FILE="${LOG_DIR}/run-${TODAY}.log"

# ── Load env vars (optional .env file) ───────────────────────────────────────
if [ -f "${REPO_DIR}/.env" ]; then
  # shellcheck disable=SC1090
  set -a && source "${REPO_DIR}/.env" && set +a
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set. Exiting." >&2
  exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

# ── Setup ─────────────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
cd "$REPO_DIR"

log "=== WagerProof Daily Agent Run: $TODAY ==="
log "Repo: $REPO_DIR"

# Ensure we have the latest main
log "Fetching latest main..."
git fetch origin main

# Create or switch to today's branch
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  log "Branch $BRANCH already exists — checking it out"
  git checkout "$BRANCH"
else
  log "Creating branch $BRANCH from main"
  git checkout -b "$BRANCH" origin/main
fi

# ── Run the Orchestrator ──────────────────────────────────────────────────────
log "Launching Orchestrator agent..."

# claude -p runs a full agentic session non-interactively.
# --dangerously-skip-permissions skips the per-tool approval prompts
# that normally require a human — safe here since this is a trusted,
# isolated repo environment running on your own machine.
claude -p \
  "Read the file .claude/agents/orchestrator.md and execute every
   step described in it exactly as written.

   Injected context:
   - TODAY: ${TODAY}
   - BRANCH: ${BRANCH}
   - DRY_RUN: false

   The branch has already been created and checked out locally.
   After all steps complete, push the branch and open the PR." \
  --dangerously-skip-permissions \
  2>&1 | tee -a "$LOG_FILE"

log "=== Agent run complete ==="

# ── Check if PR was created ───────────────────────────────────────────────────
PR_URL=$(gh pr list --head "$BRANCH" --json url --jq '.[0].url' 2>/dev/null || echo "")

if [ -n "$PR_URL" ]; then
  log "✅ PR created: $PR_URL"
  # Optional: send a desktop notification (macOS)
  if command -v osascript &>/dev/null; then
    osascript -e "display notification \"PR ready to review: $PR_URL\" with title \"WagerProof Agent\""
  fi
else
  log "⚠️  No PR found — check the log at $LOG_FILE"
  # Push branch even if PR creation failed so work is not lost
  git push -u origin "$BRANCH" 2>/dev/null || true
fi

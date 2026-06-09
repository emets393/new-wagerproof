#!/usr/bin/env bash
# Enumerate every `// FIDELITY-WAIVER #NNN: <reason>` in the Swift port and
# cross-check it against the tickets/ directory. Any waiver in code without a
# matching ticket file fails the reviewer gate.
#
# Usage: ./scripts/wagerproof-migration/grep-waivers.sh
# Exits 0 if every waiver maps to a ticket; non-zero otherwise.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SWIFT_ROOT="${REPO_ROOT}/wagerproof_ios_native"
TICKETS="${REPO_ROOT}/docs/wagerproof-migration/tickets"

if [[ ! -d "$SWIFT_ROOT" ]]; then
    echo "❌ Swift source root not found at $SWIFT_ROOT"
    exit 1
fi

mkdir -p "$TICKETS"

# Find every waiver tag — accept `FIDELITY-WAIVER #042: ...` with optional `:`
WAIVERS=$(grep -rEn '// FIDELITY-WAIVER #[0-9]+' "$SWIFT_ROOT" 2>/dev/null || true)

if [[ -z "$WAIVERS" ]]; then
    echo "✅ No waivers found."
    exit 0
fi

UNTRACKED=()
TRACKED=0
while IFS= read -r line; do
    NUM=$(echo "$line" | grep -oE '#[0-9]+' | head -n1 | tr -d '#')
    if [[ -z "$NUM" ]]; then continue; fi

    # Match any file in tickets/ that starts with NNN- (zero-padded or not)
    TICKET_GLOB=$(ls "$TICKETS"/${NUM}-*.md 2>/dev/null || true)
    # Strip leading zeros before printf %d so "008" doesn't parse as octal
    PADDED=$(printf '%03d' "$((10#$NUM))")
    TICKET_GLOB_PADDED=$(ls "$TICKETS"/${PADDED}-*.md 2>/dev/null || true)

    if [[ -z "$TICKET_GLOB" && -z "$TICKET_GLOB_PADDED" ]]; then
        UNTRACKED+=("$line")
    else
        TRACKED=$((TRACKED + 1))
    fi
done <<< "$WAIVERS"

echo "Tracked waivers: $TRACKED"
echo

if [[ ${#UNTRACKED[@]} -gt 0 ]]; then
    echo "❌ ${#UNTRACKED[@]} waiver(s) without a matching ticket:"
    printf '  %s\n' "${UNTRACKED[@]}"
    exit 2
fi

echo "✅ All waivers map to tickets."

#!/usr/bin/env python3
"""
Phase 4 final-sweep audit. Produces a summary report:
- Re-runs the inventory generator (via subprocess).
- Counts rows by status (missing / candidate / waivered / reviewed).
- Counts waivers in code + tickets/ filings and reports any mismatch.
- Runs xcodebuild to verify the project still compiles.
- Counts parity screenshots; flags any screen-batch that's missing
  empty/loaded/error.

Exits 0 only if all of these hold:
- 0 rows with status=missing
- All `// FIDELITY-WAIVER #NNN` in code map to a tickets/NNN-*.md
- xcodebuild Debug succeeds
- Every screen-batch that flipped to `reviewed` has all three parity PNGs

Usage:
    python3 scripts/wagerproof-migration/phase4-audit.py
"""
import csv
import os
import subprocess
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DOCS = REPO_ROOT / "docs" / "wagerproof-migration"
INVENTORY = DOCS / "inventory.csv"
OVERRIDES = DOCS / "inventory.overrides.csv"
PARITY = DOCS / "parity"
TICKETS = DOCS / "tickets"
SWIFT_ROOT = REPO_ROOT / "wagerproof_ios_native"
INVENTORY_SCRIPT = REPO_ROOT / "scripts" / "wagerproof-migration" / "build-inventory.py"
WAIVERS_SCRIPT = REPO_ROOT / "scripts" / "wagerproof-migration" / "grep-waivers.sh"


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> tuple[int, str]:
    """Run a command, return (exitcode, combined-output)."""
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True,
        check=False,
    )
    output = (result.stdout or "") + (result.stderr or "")
    if check and result.returncode != 0:
        print(f"❌ Command failed: {' '.join(cmd)}")
        print(output)
    return result.returncode, output


def header(s: str) -> None:
    print()
    print(f"━━━ {s} {'━' * (60 - len(s))}")


def status_counts() -> dict[str, int]:
    counts: Counter[str] = Counter()
    with INVENTORY.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            counts[row.get("status", "missing")] += 1
    return dict(counts)


def screens_with_status(target_status: str) -> list[str]:
    rows = []
    with INVENTORY.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("status") == target_status and row.get("type") == "screen":
                rows.append(row["name"])
    return rows


def parity_coverage() -> list[tuple[str, list[str]]]:
    """For each screen directory under parity/, list missing states."""
    if not PARITY.exists():
        return []
    missing: list[tuple[str, list[str]]] = []
    required = {"empty.png", "loaded.png", "error.png"}
    for d in sorted(PARITY.iterdir()):
        if not d.is_dir():
            continue
        present = {p.name for p in d.iterdir() if p.is_file()}
        absent = required - present
        if absent:
            missing.append((d.name, sorted(absent)))
    return missing


def xcodebuild_green() -> bool:
    print("Running xcodebuild — this can take a few minutes…")
    code, _ = run(
        [
            "xcodebuild",
            "-project", "Wagerproof.xcodeproj",
            "-scheme", "Wagerproof",
            "-destination", "platform=iOS Simulator,name=iPhone 16 Pro",
            "-configuration", "Debug",
            "build",
        ],
        cwd=SWIFT_ROOT,
        check=False,
    )
    return code == 0


def main() -> int:
    failures: list[str] = []

    header("Step 1 — regenerate inventory")
    code, out = run(["python3", str(INVENTORY_SCRIPT)], cwd=REPO_ROOT)
    print(out)
    if code != 0:
        failures.append("inventory regenerator failed")

    header("Step 2 — status breakdown")
    counts = status_counts()
    for status, n in sorted(counts.items()):
        print(f"  {status:12s} {n:4d}")
    if counts.get("missing", 0) > 0:
        failures.append(f"{counts.get('missing')} rows still status=missing")
        for s in screens_with_status("missing"):
            print(f"    - missing screen: {s}")
    if counts.get("lazy", 0) > 0:
        failures.append(f"{counts.get('lazy')} rows status=lazy — must be promoted or waivered")
    if counts.get("stub", 0) > 0:
        failures.append(f"{counts.get('stub')} rows status=stub — must be promoted or waivered")

    header("Step 3 — waivers vs tickets")
    code, out = run(["bash", str(WAIVERS_SCRIPT)], cwd=REPO_ROOT, check=False)
    print(out)
    if code != 0:
        failures.append("waivers without tickets present")

    header("Step 4 — parity screenshot coverage")
    missing_parity = parity_coverage()
    if missing_parity:
        for name, absent in missing_parity:
            print(f"  ❌ {name}: missing {absent}")
        failures.append(f"{len(missing_parity)} screen-folder(s) missing parity PNGs")
    else:
        print("  ✅ Every parity folder has empty + loaded + error.")

    header("Step 5 — xcodebuild")
    if xcodebuild_green():
        print("  ✅ Build succeeded.")
    else:
        failures.append("xcodebuild failed")

    header("Final verdict")
    if failures:
        print("❌ FAIL")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("✅ PASS — every gate met.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

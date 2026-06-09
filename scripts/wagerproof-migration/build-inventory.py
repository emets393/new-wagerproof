#!/usr/bin/env python3
"""
Builds docs/wagerproof-migration/inventory.csv from the wagerproof-mobile/ source tree.

For every .ts / .tsx file, classifies type by path and extracts:
- rn_path
- name (basename without ext)
- type: screen | sheet | component | store | service | hook | util | type | module | layout | constant
- routes: Expo Router route path (only for files under app/)
- backend_calls: supabase.from(...), supabase.functions.invoke(...), fetch(...) URLs
- storage_keys: AsyncStorage / SecureStore / MMKV keys
- target_swift_path: deterministic mapping to wagerproof_ios_native/...
- status: defaults to "missing" unless overridden by inventory.overrides.csv

Re-run after every implementer batch.
"""
import csv
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
MOBILE_ROOT = REPO_ROOT / "wagerproof-mobile"
OUT_CSV = REPO_ROOT / "docs" / "wagerproof-migration" / "inventory.csv"
OVERRIDES_CSV = REPO_ROOT / "docs" / "wagerproof-migration" / "inventory.overrides.csv"

EXCLUDE_DIRS = {"node_modules", ".expo", "dist", "ios", "android", ".pixel-art-venv", "build"}
EXCLUDE_PATH_FRAGMENTS = (".d.ts",)  # generated type defs


def classify(rel_path: Path, source: str) -> str:
    parts = rel_path.parts
    name = rel_path.stem.lower()

    if parts[0] == "app":
        if rel_path.name == "_layout.tsx":
            return "layout"
        return "screen"

    if parts[0] == "components":
        if "bottom" in name and "sheet" in name:
            return "sheet"
        if name.endswith("modal") or "modal" in name.split("_"):
            return "sheet"
        if "Modalize" in source or "BottomSheetModal" in source or "showModal" in source:
            return "sheet"
        return "component"

    if parts[0] == "contexts":
        return "store"
    if parts[0] == "hooks":
        return "hook"
    if parts[0] == "services":
        return "service"
    if parts[0] == "utils":
        return "util"
    if parts[0] == "types":
        return "type"
    if parts[0] == "constants":
        return "constant"
    if parts[0] == "config":
        return "config"
    if parts[0] == "modules":
        return "module"
    if parts[0] == "plugins":
        return "plugin"
    if parts[0] == "targets":
        return "target"
    if parts[0] == "assets":
        return "asset"
    if parts[0] == "supabase":
        return "edge-function"
    if parts[0] == "scripts":
        return "script"

    return "other"


def route_for(rel_path: Path) -> str:
    """Compute Expo Router route from app/ path."""
    parts = list(rel_path.parts)
    if parts[0] != "app":
        return ""
    parts = parts[1:]
    if not parts:
        return ""

    last = parts[-1]
    if last == "_layout.tsx" or last == "_layout.ts":
        return f"[layout] /{'/'.join(p for p in parts[:-1] if not _is_group(p))}".rstrip("/") or "[layout] /"

    name_no_ext = last.rsplit(".", 1)[0]
    cleaned = []
    for p in parts[:-1]:
        if _is_group(p):
            continue
        cleaned.append(p)
    if name_no_ext != "index":
        cleaned.append(name_no_ext)
    route = "/" + "/".join(cleaned)
    return route or "/"


def _is_group(seg: str) -> bool:
    return seg.startswith("(") and seg.endswith(")")


SUPABASE_FROM_RE = re.compile(r"\.from\(['\"]([\w-]+)['\"]\)")
SUPABASE_FN_RE = re.compile(r"\.functions\.invoke\(['\"]([\w-]+)['\"]")
SUPABASE_RPC_RE = re.compile(r"\.rpc\(['\"]([\w-]+)['\"]")
FETCH_URL_RE = re.compile(r"fetch\(['\"`](https?://[^'\"`]+)['\"`]")
STORAGE_KEY_RE = re.compile(
    r"(?:AsyncStorage|SecureStore|MMKV|storage)\.(?:get|set|remove)Item(?:Async)?\(['\"]([\w@:/.\-]+)['\"]"
)


def extract_signals(source: str) -> tuple[str, str]:
    tables = sorted(set(SUPABASE_FROM_RE.findall(source)))
    fns = sorted(set(SUPABASE_FN_RE.findall(source)))
    rpcs = sorted(set(SUPABASE_RPC_RE.findall(source)))
    urls = sorted(set(FETCH_URL_RE.findall(source)))

    pieces = []
    if tables:
        pieces.append("from:" + ",".join(tables))
    if fns:
        pieces.append("fn:" + ",".join(fns))
    if rpcs:
        pieces.append("rpc:" + ",".join(rpcs))
    if urls:
        pieces.append("http:" + ",".join(urls))

    storage = sorted(set(STORAGE_KEY_RE.findall(source)))
    return ";".join(pieces), ",".join(storage)


def target_swift_path(rel_path: Path, kind: str) -> str:
    """Deterministic mapping rn → swift."""
    parts = rel_path.parts
    name = rel_path.stem
    pascal = _pascal(name)

    if kind == "screen":
        # app/(drawer)/(tabs)/picks.tsx → Features/Picks/PicksView.swift
        # app/(auth)/login.tsx → Features/Auth/LoginView.swift
        # app/(drawer)/(tabs)/agents/[id]/index.tsx → Features/Agents/AgentDetailView.swift
        scope = _route_scope(parts)
        feature = _feature_from_screen(parts, name)
        swift_name = _screen_swift_name(parts, name)
        return f"wagerproof_ios_native/Wagerproof/Features/{feature}/{swift_name}.swift"

    if kind == "layout":
        feature = _feature_from_screen(parts, name)
        return f"wagerproof_ios_native/Wagerproof/Features/{feature}/{feature}Router.swift"

    if kind == "sheet":
        feature = _feature_from_component(parts, name)
        return f"wagerproof_ios_native/Wagerproof/Features/{feature}/Sheets/{pascal}.swift"

    if kind == "component":
        feature = _feature_from_component(parts, name)
        return f"wagerproof_ios_native/Wagerproof/Features/{feature}/Components/{pascal}.swift"

    if kind == "store":
        return f"wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/{pascal}.swift"

    if kind == "hook":
        # Hooks fold into stores (Observable methods/computed properties).
        return f"wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/Hooks/{pascal}.swift"

    if kind == "service":
        return f"wagerproof_ios_native/WagerproofKit/Sources/WagerproofServices/{pascal}.swift"

    if kind == "util":
        return f"wagerproof_ios_native/WagerproofKit/Sources/WagerproofKit/Utilities/{pascal}.swift"

    if kind == "type":
        return f"wagerproof_ios_native/WagerproofKit/Sources/WagerproofModels/{pascal}.swift"

    if kind == "constant":
        return f"wagerproof_ios_native/WagerproofKit/Sources/WagerproofDesign/Constants/{pascal}.swift"

    if kind == "config":
        return f"wagerproof_ios_native/WagerproofKit/Sources/WagerproofKit/Configuration/{pascal}.swift"

    if kind == "module":
        # Native modules — keep but evaluate per case
        return f"wagerproof_ios_native/Wagerproof/Modules/{pascal}.swift"

    if kind == "plugin":
        return f"wagerproof_ios_native/scripts/plugins/{name}.swift"

    if kind == "target":
        return f"wagerproof_ios_native/Targets/{pascal}.swift"

    if kind == "edge-function":
        return "[backend-unchanged]"

    if kind == "script":
        return f"wagerproof_ios_native/scripts/{rel_path.name}"

    if kind == "asset":
        return "[asset-rebundle]"

    return f"wagerproof_ios_native/Wagerproof/Misc/{pascal}.swift"


def _pascal(name: str) -> str:
    # use- prefix on hooks → strip + PascalCase the rest
    if name.startswith("use") and len(name) > 3 and name[3].isupper():
        name = name[3:]
    # Strip leading underscore for layouts
    name = name.lstrip("_")
    parts = re.split(r"[-_]", name)
    return "".join(p[:1].upper() + p[1:] for p in parts if p)


def _route_scope(parts: tuple) -> str:
    for p in parts:
        if _is_group(p):
            return p.strip("()")
    return ""


def _feature_from_screen(parts, name: str) -> str:
    # Heuristic by route scope + filename
    scope = _route_scope(parts)
    n = name.lower()
    full = "/".join(parts).lower()
    if scope == "auth":
        return "Auth"
    if scope == "onboarding":
        return "Onboarding"
    if scope == "modals":
        if "secret" in n:
            return "Settings"
        if "delete" in n:
            return "Settings"
        if "discord" in n:
            return "Settings"
        if "widget" in n:
            return "Settings"
        return "Modals"

    if "agents/" in full or "agent" in n:
        return "Agents"
    # The (tabs)/index.tsx is the Games dashboard tab
    if n == "index" and "(tabs)" in full and "agents" not in full:
        return "Games"
    if n == "picks":
        return "Picks"
    if "chat" in n:
        return "Chat"
    if "voice" in n:
        return "Voice"
    if "wagerbot" in n:
        return "Chat"
    if "outlier" in n:
        return "Outliers"
    if "scoreboard" in n:
        return "Scoreboard"
    if "editor" in n:
        return "EditorPicks"
    if "feature-request" in n:
        return "FeatureRequests"
    if "settings" in n:
        return "Settings"
    if "roast" in n:
        return "Roast"
    if "regression" in n or "betting-trend" in n or "model-accuracy" in n:
        return "Analytics"
    if "mlb" in n:
        return "MLB"
    if "nba" in n:
        return "NBA"
    if "ncaab" in n:
        return "NCAAB"
    if "nfl" in n:
        return "NFL"
    if "cfb" in n:
        return "CFB"
    if "asset-library" in n:
        return "DevTools"
    if "pixel-office" in n:
        return "DevTools"
    return "Misc"


def _feature_from_component(parts, name: str) -> str:
    """Map components/<dir>/<name>.tsx → Features/<Feature>/."""
    # Subdirectory override first
    subdir = parts[1] if len(parts) > 2 else None
    map_subdir = {
        "agents": "Agents",
        "chat": "Chat",
        "game-cards": "GameCards",
        "learn-wagerproof": "LearnMore",
        "mlb": "MLB",
        "nba": "NBA",
        "ncaab": "NCAAB",
        "nfl": "NFL",
        "cfb": "CFB",
        "onboarding": "Onboarding",
        "roast": "Roast",
        "navigation": "Navigation",
        "ui": "DesignSystem",
        "charts": "Charts",
    }
    if subdir in map_subdir:
        return map_subdir[subdir]

    n = name.lower()
    # Best-effort feature inference from filename
    if "agent" in n:
        return "Agents"
    if "wagerbot" in n or "chat" in n:
        return "Chat"
    if "editor" in n:
        return "EditorPicks"
    if "live" in n and "score" in n:
        return "Scoreboard"
    if "polymarket" in n:
        return "Components/Polymarket"
    if "outlier" in n:
        return "Outliers"
    if "mlb" in n:
        return "MLB"
    if "nba" in n:
        return "NBA"
    if "ncaab" in n:
        return "NCAAB"
    if "nfl" in n:
        return "NFL"
    if "cfb" in n:
        return "CFB"
    if "voice" in n:
        return "Voice"
    if "onboarding" in n:
        return "Onboarding"
    if "paywall" in n or "revenuecat" in n or "customer" in n:
        return "Paywall"
    if "settings" in n or "delete" in n or "secret" in n:
        return "Settings"
    if "meta" in n or "test" in n:
        return "DevTools"
    if "splash" in n or "blur" in n or "shimmer" in n or "loading" in n:
        return "DesignSystem"
    if "error" in n or "offline" in n or "banner" in n:
        return "DesignSystem"
    if "side" in n and "menu" in n:
        return "Navigation"
    if "sport" in n or "filter" in n or "sportsbook" in n:
        return "GameCards"
    if "pick" in n:
        return "Picks"
    if "review" in n:
        return "Settings"
    if "team" in n:
        return "DesignSystem"
    if "h2h" in n or "betting" in n or "trends" in n or "stats" in n or "model" in n or "weather" in n or "splits" in n or "accuracy" in n or "line" in n:
        return "GameCards"
    if "game" in n:
        return "GameCards"
    return "Components"


def _screen_swift_name(parts, name: str) -> str:
    """Build the Swift View name for a screen file."""
    # Dynamic routes: app/(drawer)/(tabs)/agents/[id]/index.tsx → AgentDetailView
    full_path = "/".join(parts)
    if "[id]/index" in full_path:
        # Get the parent dir name
        idx = parts.index("[id]")
        feature_name = parts[idx - 1] if idx > 0 else "Detail"
        return _pascal(feature_name.rstrip("s")) + "DetailView"
    if "[id]" in parts:
        idx = parts.index("[id]")
        feature_name = parts[idx - 1]
        leaf = name
        # e.g., agents/[id]/settings.tsx → AgentDetailSettingsView
        return _pascal(feature_name.rstrip("s")) + "Detail" + _pascal(leaf) + "View"
    if "[id]" in name:
        # e.g., public/[id].tsx
        feature_name = parts[-2] if len(parts) > 1 else "Detail"
        return _pascal(feature_name) + "DetailView"
    if name == "index":
        feature = _feature_from_screen(parts, name)
        return feature + "View"
    # Inside agents/ subfolder, prefix Agent to disambiguate
    if "agents" in parts and name != "index":
        return "Agent" + _pascal(name) + "View"
    return _pascal(name) + "View"


def load_overrides() -> dict:
    overrides = {}
    if not OVERRIDES_CSV.exists():
        return overrides
    with OVERRIDES_CSV.open() as f:
        reader = csv.DictReader(f)
        for row in reader:
            if "rn_path" in row and row["rn_path"]:
                overrides[row["rn_path"]] = row
    return overrides


def main() -> int:
    if not MOBILE_ROOT.exists():
        print(f"ERROR: {MOBILE_ROOT} does not exist", file=sys.stderr)
        return 1

    overrides = load_overrides()
    rows = []

    for root, dirs, files in os.walk(MOBILE_ROOT):
        # Prune excluded dirs in-place
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
        for fname in files:
            if not (fname.endswith(".tsx") or fname.endswith(".ts")):
                continue
            if any(frag in fname for frag in EXCLUDE_PATH_FRAGMENTS):
                continue
            full = Path(root) / fname
            rel = full.relative_to(MOBILE_ROOT)
            try:
                source = full.read_text(errors="replace")
            except Exception:
                source = ""

            kind = classify(rel, source)
            backend, storage = extract_signals(source)
            route = route_for(rel)
            target = target_swift_path(rel, kind)
            name = rel.stem

            override = overrides.get(f"wagerproof-mobile/{rel.as_posix()}", {})
            status = override.get("status", "missing")
            note = override.get("note", "")
            reviewer = override.get("reviewer", "")
            reviewed_at = override.get("reviewed_at", "")

            rows.append({
                "rn_path": f"wagerproof-mobile/{rel.as_posix()}",
                "name": name,
                "type": kind,
                "routes": route,
                "backend_calls": backend,
                "storage_keys": storage,
                "target_swift_path": target,
                "status": status,
                "note": note,
                "reviewer": reviewer,
                "reviewed_at": reviewed_at,
            })

    rows.sort(key=lambda r: (r["type"], r["rn_path"]))

    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "rn_path", "name", "type", "routes", "backend_calls", "storage_keys",
            "target_swift_path", "status", "note", "reviewer", "reviewed_at",
        ])
        writer.writeheader()
        writer.writerows(rows)

    # Summary
    counts = {}
    by_status = {}
    for r in rows:
        counts[r["type"]] = counts.get(r["type"], 0) + 1
        by_status[r["status"]] = by_status.get(r["status"], 0) + 1

    print(f"Wrote {len(rows)} rows → {OUT_CSV}")
    print()
    print("By type:")
    for k in sorted(counts):
        print(f"  {k:12s} {counts[k]:4d}")
    print()
    print("By status:")
    for k in sorted(by_status):
        print(f"  {k:12s} {by_status[k]:4d}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

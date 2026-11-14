"""Fantasy-Points-era research layer for the props surfaces — ADDITIVE (owner 2026-09-21: keep
everything already on the props, add what the FP work built).

Two sources, both written by the fp-data-inseason job (Tue/Thu):
  nfl_prop_model_preds  — score_props_week.py projections: pred, edge vs line, per-market fire
                          threshold, tier (robust / 2025-strong / ...), fires
  nfl_prop_narratives   — the Player Prop Report reads: direction, score, n_for/n_against, facts.tells
                          (each tell = {dir, src, w, text} with its seasons + counts in the text)

fetch_layer(season, week) -> {(player_id, market): {...}} for the builders to merge.
Nothing here gates a bet: is_bettable stays the validated P-flag set."""
import os, requests, pandas as pd
from functools import lru_cache

BASE_URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1"
HERE = os.path.dirname(os.path.abspath(__file__))


def _key():
    for p in (os.path.join(HERE, "..", "..", ".env.local"), os.path.join(HERE, ".env.local")):
        if os.path.exists(p):
            for ln in open(p):
                if ln.startswith("SUPABASE_SERVICE_KEY="):
                    return ln.strip().split("=", 1)[1]
    return os.environ.get("SUPABASE_SERVICE_KEY", "")


def _fetch(table, params):
    k = _key(); h = {"apikey": k, "Authorization": f"Bearer {k}"}
    out, off = [], 0
    while True:
        r = requests.get(f"{BASE_URL}/{table}?{params}&limit=1000&offset={off}", headers=h, timeout=60)
        r.raise_for_status(); rows = r.json(); out += rows
        if len(rows) < 1000: return out
        off += 1000


@lru_cache(maxsize=4)
def fetch_layer(season, week, max_tells=8):
    """Merge key = (player_id, market). Missing tables / empty weeks -> {} (builders keep running).
    Cached per (season, week) so a per-player loop can call it freely."""
    layer = {}
    try:
        for r in _fetch("nfl_prop_model_preds", f"season=eq.{season}&week=eq.{week}&select=player_id,market,line,pred,edge,threshold,tier,fires"):
            layer.setdefault((str(r["player_id"]), r["market"]), {}).update(
                fp_pred=r.get("pred"), fp_edge=r.get("edge"), fp_threshold=r.get("threshold"),
                fp_tier=r.get("tier"), fp_fires=bool(r.get("fires")), fp_line=r.get("line"))
    except Exception as e:
        print(f"  [fp layer] nfl_prop_model_preds unavailable ({e})")
    try:
        for r in _fetch("nfl_prop_narratives", f"season=eq.{season}&week=eq.{week}&select=player_id,market,line,direction,score,n_for,n_against,summary,facts"):
            if not r.get("player_id"): continue
            facts = r.get("facts") or {}
            tells = [{"dir": t.get("dir"), "src": t.get("src"), "text": t.get("text")} for t in (facts.get("tells") or [])][:max_tells]
            layer.setdefault((str(r["player_id"]), r["market"]), {}).update(
                report_read=r.get("direction"), report_score=r.get("score"), report_for=r.get("n_for"),
                report_against=r.get("n_against"), report_summary=r.get("summary"), report_tells=tells, report_line=r.get("line"))
    except Exception as e:
        print(f"  [fp layer] nfl_prop_narratives unavailable ({e})")
    n_m = sum(1 for v in layer.values() if "fp_pred" in v); n_r = sum(1 for v in layer.values() if "report_read" in v)
    print(f"  [fp layer] {n_m} model projections, {n_r} report reads for {season} wk{week}")
    return layer


def attach_to_props(df, layer):
    """Add the fp_* / report_* columns to the props frame (player_id + market keyed)."""
    # fp_* deliberately absent: computed upstream, never surfaced (see research_for_player)
    cols = ["report_read", "report_score", "report_for", "report_against", "report_tells"]
    vals = {c: [] for c in cols}
    for pid, mk in zip(df.player_id.astype(str), df.market):
        v = layer.get((pid, mk), {})
        for c in cols: vals[c].append(v.get(c))
    for c in cols: df[c] = vals[c]
    return df


def research_for_player(pid, markets, layer):
    """Per-market research block for a player page: the FP model + the report read."""
    out = {}
    for mk in markets:
        v = layer.get((str(pid), mk))
        if not v: continue
        block = {}
        # ⛔ THE PROJECTION IS COMPUTED BUT NEVER SURFACED (owner, 2026-10-07). score_props_week.py
        # still writes nfl_prop_model_preds and the fp_* columns, because three prop signals are
        # derived from them (P14, P17, P18) — but no client sees a per-market forecast. The product
        # is stats, the posted line, and a pick on the spotlight players only.
        # Do NOT re-add fp_model here without that instruction being reversed.
        # ⛔ The regression-report prop picks are retired (owner 2026-10-07) and replaced by the
        # spotlight board. Nothing from nfl_prop_narratives is surfaced.
        if False:
            pass
        if block: out[mk] = block
    return out

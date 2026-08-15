"""Prop RANKING layer — the deterministic shortlist agents choose from (owner 2026-08-15).
One row per candidate prop bet: model pred, line, edge, direction, VALIDATED-cell tag
(production thresholds: P17 rush_yds line-pred>=10 UNDER; P18 pass_tds pred-line>=0.5 OVER;
P14 attempts line-pred>=1.5 UNDER), and a composite rank. Tier A = validated cell fires;
Tier B = top-decile |edge| in its market (context candidate, NOT a validated bet).
Usage: python3 prop_rank.py [season week]  (demo: grades vs actuals when present)"""
import sys
import numpy as np, pandas as pd

SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2025
WEEK = int(sys.argv[2]) if len(sys.argv) > 2 else 1

MKT_LABEL = {"player_rush_yds": "Rush Yds", "player_pass_tds": "Pass TDs",
             "player_pass_yds": "Pass Yds", "player_receptions": "Receptions",
             "player_reception_yds": "Rec Yds", "player_rush_attempts": "Rush Att",
             "player_pass_attempts": "Pass Att", "player_pass_completions": "Completions"}

def validated_cell(m, pred, line):
    """Production signal thresholds -> (signal_key, side, record) or None."""
    d = pred - line
    if m == "player_rush_yds" and d <= -10:
        return ("P17_rush_yds_model_under", "UNDER", "58.5% / +10% ROI")
    if m == "player_pass_tds" and d >= 0.5:
        return ("P18_pass_tds_model_over", "OVER", "63-69% / +5-9% ROI")
    if m in ("player_rush_attempts", "player_pass_attempts") and d <= -1.5:
        return ("P14_attempts_model_under", "UNDER", "56-59% / +5-7% ROI")
    return None

def rank(df, names):
    df = df[df.close_line.notna() & df.pred.notna()].copy()
    df["edge"] = df.pred - df.close_line
    # scale-free edge for cross-market Tier-B ranking (yards vs tds vs catches)
    df["edge_z"] = df.groupby("market").edge.transform(lambda s: (s - s.mean()) / s.std())
    rows = []
    for _, r in df.iterrows():
        v = validated_cell(r.market, r.pred, r.close_line)
        side = v[1] if v else ("OVER" if r.edge > 0 else "UNDER")
        tier = "A-validated" if v else ("B-context" if abs(r.edge_z) >= 1.28 else None)
        if tier is None:
            continue
        rows.append(dict(
            player=names.get(r.player_id, r.player_id), market=MKT_LABEL.get(r.market, r.market),
            side=side, line=r.close_line, model=round(float(r.pred), 1),
            edge=round(float(r.edge), 1), tier=tier,
            signal=v[0] if v else None, record=v[2] if v else "context only — not a validated bet",
            actual=r.actual if pd.notna(r.actual) else None))
    out = pd.DataFrame(rows)
    if out.empty:
        return out
    out["_t"] = (out.tier != "A-validated").astype(int)
    out = out.sort_values(["_t", "edge"], key=lambda s: s.abs() if s.name == "edge" else s,
                          ascending=[True, False]).drop(columns="_t")
    # one prop per player (best rank wins) — the NBA prop law: never stack one player
    out = out.drop_duplicates("player", keep="first").reset_index(drop=True)
    return out

if __name__ == "__main__":
    p = pd.read_parquet("data/nfl_prop_edge_preds.parquet")
    p = p[(p.season == SEASON) & (p.week == WEEK)]
    prof = pd.read_parquet("data/nfl_player_profiles.parquet") if __import__("os").path.exists("data/nfl_player_profiles.parquet") else None
    if prof is not None and "player_id" in prof.columns:
        nm = dict(zip(prof.player_id, prof.player_name + " (" + prof.team.fillna("?") + ")"))
    else:
        po = pd.read_parquet("data/player_offense.parquet")
        latest = po.sort_values(["season", "week"]).drop_duplicates("player_id", keep="last")
        nm = dict(zip(latest.player_id, latest.player_name + " (" + latest.team.fillna("?") + ")"))
    sl = rank(p, nm)
    print(f"=== PROP SHORTLIST {SEASON} wk{WEEK}: {len(sl)} candidates "
          f"({(sl.tier=='A-validated').sum()} validated / {(sl.tier=='B-context').sum()} context) ===\n")
    show = sl.head(25).copy()
    if show.actual.notna().any():
        def grade(r):
            if pd.isna(r.actual): return "—"
            if r.actual == r.line: return "push"
            won = (r.actual > r.line) == (r.side == "OVER")
            return "WIN" if won else "loss"
        show["result"] = show.apply(grade, axis=1)
    print(show.to_string(index=False))
    if "result" in show.columns:
        g = show[show.result.isin(["WIN", "loss"])]
        ga = g[g.tier == "A-validated"]
        print(f"\ngraded: validated tier {(ga.result=='WIN').sum()}-{(ga.result=='loss').sum()}"
              f" | full shortlist {(g.result=='WIN').sum()}-{(g.result=='loss').sum()}")

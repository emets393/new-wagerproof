#!/usr/bin/env python3
"""ANYTIME TD — PER-PLAYER TENDENCY PROFILES BY SITUATION (owner, 2026-09-19).
One sheet per player on this season's board with 20+ priced games 2023-25 (data/_atd_redzone_frame.parquet). For each situation:
his hit rate and the book's implied rate INSIDE the situation vs OUTSIDE it, the difference in (hit − implied), the sign in every
season with 4+ games on each side, and STABLE = same sign every season (2+ seasons).
Situations (all values ENTERING the game):
  team play-calling   pass-heavy vs run-heavy inside the 20 / inside the 10 / inside the 5 (above / below league median that week)
  team volume         red-zone trips high vs low (inside-20 snaps per game); team TDs per game high vs low
  his usage           inside-20 / inside-10 / inside-5 snap share above vs below HIS median; inside-5 rush share; inside-10 targets;
                      end-zone target share; role rising vs not (last-3 inside-5 share ≥ season + .10)
  opponent            TDs allowed high vs low; end-zone targets allowed high vs low; inside-5 rushes allowed high vs low
  context             home vs away; former team; homecoming; birthday
Writes out/atd_player_profiles_2026.md and data/_atd_player_profiles_2026.parquet."""
import os, sys, numpy as np, pandas as pd, requests, warnings
warnings.filterwarnings("ignore"); HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE); sys.path.insert(0, os.path.dirname(HERE)); import football_report_lib as lib
env = lib.load_env(); H = lib.hdr(env); SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 2026
def fetch(table, params):
    j = requests.get(f"{lib.SUPA}/{table}?{params}", headers=H, timeout=60).json(); return j if isinstance(j, list) else []
D = pd.read_parquet("data/_atd_redzone_frame.parquet"); D["res"] = D.scored - D.p_best; roi = lambda x: 100 * (x.scored * x.pay - (1 - x.scored)).mean() if len(x) else np.nan
LG = {c: D[c].median() for c in ("e_t_in20_pass","e_t_in10_pass","e_t_in5_pass","e_t_in20","e_t_td","e_o_td","e_o_ez_tgt","e_o_in5_att")}
SIT = [("pass-heavy inside the 20", lambda g: g.e_t_in20_pass >= LG["e_t_in20_pass"], "run-heavy inside the 20"), ("pass-heavy inside the 10", lambda g: g.e_t_in10_pass >= LG["e_t_in10_pass"], "run-heavy inside the 10"), ("pass-heavy inside the 5", lambda g: g.e_t_in5_pass >= LG["e_t_in5_pass"], "run-heavy inside the 5"),
       ("team red-zone trips high", lambda g: g.e_t_in20 >= LG["e_t_in20"], "trips low"), ("team TDs/game high", lambda g: g.e_t_td >= LG["e_t_td"], "team TDs low"),
       ("his inside-20 snap share above his norm", lambda g: g.e_in20_snap_sh >= g.e_in20_snap_sh.median(), "below"), ("his inside-10 snap share above his norm", lambda g: g.e_in10_snap_sh >= g.e_in10_snap_sh.median(), "below"), ("his inside-5 snap share above his norm", lambda g: g.e_in5_snap_sh >= g.e_in5_snap_sh.median(), "below"),
       ("his inside-5 rush share above his norm", lambda g: g.e_in5_att_sh.fillna(0) >= g.e_in5_att_sh.fillna(0).median(), "below"), ("his inside-10 targets above his norm", lambda g: g.e_in10_tgt >= g.e_in10_tgt.median(), "below"), ("his end-zone target share above his norm", lambda g: g.e_ez_sh.fillna(0) >= g.e_ez_sh.fillna(0).median(), "below"),
       ("goal-line role rising (last 3 ≥ season + .10)", lambda g: g.role_trend >= 0.10, "not rising"),
       ("opponent allows many TDs", lambda g: g.e_o_td >= LG["e_o_td"], "stingy opponent"), ("opponent allows many end-zone targets", lambda g: g.e_o_ez_tgt >= LG["e_o_ez_tgt"], "few"), ("opponent allows many inside-5 rushes", lambda g: g.e_o_in5_att >= LG["e_o_in5_att"], "few"),
       ("home", lambda g: g.is_home.astype(bool), "away"), ("vs a former team", lambda g: g.revenge.fillna(False).astype(bool), "other games"), ("homecoming (visiting near his birthplace)", lambda g: g.hc.fillna(False).astype(bool), "other games"), ("birthday week", lambda g: g.birthday3.fillna(False).astype(bool), "other games")]
board = pd.DataFrame(fetch("nfl_slate_props", f"select=player_id,player_name,team,position&season=eq.{SEASON}&market=eq.player_anytime_td&limit=5000")).drop_duplicates("player_id")
act = set(board.player_id) if len(board) else set(D[D.season == 2025].player_id)
rows, md = [], [f"# Anytime touchdown — player tendencies by situation, {SEASON} board\n", "Each player: how often he scores vs how often the book says he will, split by the situation he is in. Values are entering the game. A tendency is listed only when the sign holds in every season with 4+ games on each side. Nothing here is a pick.\n"]
lg_res = D.res.mean()
for pid, g in D.groupby("player_id"):
    if pid not in act or len(g) < 20: continue
    g = g.sort_values(["season","week"]); nm = g.player_name.iloc[0]; pos = g.position.iloc[0]; tends = []; allrows = []
    for lab, fn, anti in SIT:
        m = fn(g); a, b = g[m], g[~m]
        if len(a) < 6 or len(b) < 6: continue
        d_in, d_out = a.res.mean(), b.res.mean(); diff = d_in - d_out; seas = []
        for s, gg in g.groupby("season"):
            mm = m.loc[gg.index]; aa, bb = gg[mm], gg[~mm]
            if len(aa) >= 4 and len(bb) >= 4: seas.append((s, aa.res.mean() - bb.res.mean()))
        stable = len(seas) >= 2 and len({np.sign(v) for _, v in seas}) == 1 and abs(diff) >= 0.08
        r = dict(player=nm, pos=pos, situation=lab, anti=anti, n_in=len(a), hit_in=a.scored.mean(), imp_in=a.p_best.mean(), roi_in=roi(a), n_out=len(b), hit_out=b.scored.mean(), imp_out=b.p_best.mean(), roi_out=roi(b), diff=diff, seasons=" ".join(f"{s}:{100*v:+.0f}" for s, v in seas), stable=stable); allrows.append(r); rows.append(r)
        if stable: tends.append(r)
    ov = g.res.mean(); md.append(f"## {nm} ({pos}) — {len(g)} priced games 2023-25\n- Overall: scores {100*g.scored.mean():.0f}% of games vs {100*g.p_best.mean():.0f}% implied ({100*ov:+.0f} pts; league {100*lg_res:+.0f}); flat-betting him {roi(g):+.0f}% at the best price.\n")
    if tends:
        md.append("- Tendencies that hold every season:")
        for r in sorted(tends, key=lambda r: -abs(r["diff"])): md.append(f"  - **{r['situation']}**: scores {100*r['hit_in']:.0f}% vs {100*r['imp_in']:.0f}% implied (n={r['n_in']}, {r['roi_in']:+.0f}% at best price) — {r['anti']}: {100*r['hit_out']:.0f}% vs {100*r['imp_out']:.0f}% (n={r['n_out']}). Gap {100*r['diff']:+.0f} pts; by season {r['seasons']}.")
    else: md.append("- No situation moves his scoring vs the book in a way that holds every season.")
    md.append("")
R = pd.DataFrame(rows); R.to_parquet(f"data/_atd_player_profiles_{SEASON}.parquet", index=False); open(f"out/atd_player_profiles_{SEASON}.md", "w").write("\n".join(md))
P = R.groupby("player").agg(pos=("pos","first"), n_sit=("situation","size"), n_stable=("stable","sum")).reset_index()
print(f"{P.shape[0]} players on the {SEASON} anytime-TD board with 20+ priced games | {len(R)} player-situation pairs | stable (every season, gap ≥ 8 pts): {int(R.stable.sum())} ({100*R.stable.mean():.1f}%) — a coin with two seasons and the 8-pt gate gives roughly 15-20%")
S = R[R.stable].copy(); S["abs"] = S["diff"].abs(); pd.set_option("display.width", 250)
print("\nSTABLE TENDENCIES, largest gaps first (hit vs implied inside the situation | outside | gap | per-season gaps):")
print(S.sort_values("abs", ascending=False).head(45)[["player","pos","situation","n_in","hit_in","imp_in","roi_in","n_out","hit_out","imp_out","diff","seasons"]].assign(hit_in=lambda x: 100*x.hit_in, imp_in=lambda x: 100*x.imp_in, hit_out=lambda x: 100*x.hit_out, imp_out=lambda x: 100*x.imp_out, diff=lambda x: 100*x["diff"]).round(0).to_string(index=False))
print("\nWHICH SITUATIONS produce stable tendencies most often (count of players, positive gap / negative gap):")
print(S.groupby("situation").apply(lambda x: f"{int((x['diff']>0).sum())} up / {int((x['diff']<0).sum())} down").to_string())
print(f"\nwrote out/atd_player_profiles_{SEASON}.md and data/_atd_player_profiles_{SEASON}.parquet")

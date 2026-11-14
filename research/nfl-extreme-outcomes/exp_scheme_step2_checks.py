#!/usr/bin/env python3
"""Why is step 2 null? Two diagnostics.
  A. RELIABILITY: is (team's EPA in scheme s − its overall EPA) a stable trait?  split-half within
     season (odd vs even weeks) and year-over-year, for offense and defense, every dim/level.
  B. ORACLE SHARES: rebuild the adjustment with the ACTUAL scheme shares of the game (cheating on
     step 1) and with heavier shrinkage (K = 8, 16 games). If even the oracle adds nothing, the
     scheme-conditioned idea fails at the data level, not the prediction level."""
import io, contextlib, importlib.util as iu, numpy as np, pandas as pd
spec = iu.spec_from_file_location("s2", "exp_scheme_step2.py"); S2 = iu.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(S2)
db, ru, DIMS, LG, TEST = S2.db, S2.ru, S2.DIMS, S2.LG, S2.TEST
cor = lambda a, b: np.corrcoef(a, b)[0, 1]
print("=" * 100); print("A) RELIABILITY of scheme-specific skill  (EPA in scheme − overall EPA), team-season level"); print("=" * 100)
print(f"  {'side':4s} {'dim':6s} {'level':8s} {'split-half r':>12s} {'YoY r':>7s} {'plays/team-season':>18s}")
for dim, levels in list(DIMS.items()) + [("bx", ("heavy", "light"))]:
    frame = ru if dim == "bx" else db
    for side, tag in (("posteam", "O"), ("defteam", "D")):
        f = frame[frame[dim].notna()].copy(); f["par"] = f.week % 2
        for lv in levels:
            def dev(g):
                a = g[g[dim] == lv].epa; return a.mean() - g.epa.mean() if len(a) >= 20 else np.nan
            h = f.groupby(["season", side, "par"]).apply(dev).unstack("par").dropna()
            sh = cor(h[0], h[1]) if len(h) > 30 else np.nan
            y = f.groupby(["season", side]).apply(dev).rename("v").reset_index(); y["nxt"] = y.season + 1
            j = y.merge(y, left_on=["nxt", side], right_on=["season", side]); yoy = cor(j.v_x, j.v_y) if len(j) > 30 else np.nan
            n = f[f[dim] == lv].groupby(["season", side]).size().mean()
            print(f"  {tag:4s} {dim:6s} {lv:8s} {sh:12.2f} {yoy:7.2f} {n:18.0f}")
print("  (a usable trait needs split-half r >= 0.30, the gate every FP unit had to pass)")

print("\n" + "=" * 100); print("B) ORACLE — adjustment built from the game's ACTUAL scheme shares, and heavier shrinkage"); print("=" * 100)
G = S2.G.copy()
for Kg in (4, 8, 16):
    # rebuild entering rates with K games of shrinkage
    OFF = None; DEF = None
    for dim, levels in list(DIMS.items()) + [("bx", ("heavy", "light"))]:
        frame = ru if dim == "bx" else db
        for side, tag in (("posteam", "O"), ("defteam", "D")):
            a = S2.agg(frame, dim, levels, side)
            kp = [Kg * a.all_n.mean()] + [Kg * a[f"{lv}_n"].mean() for lv in levels]
            r = S2.entering_rate(a, [("all_epa", "all_n")] + [(f"{lv}_epa", f"{lv}_n") for lv in levels], kp)
            r.columns = [f"{tag}_{dim}_{c}" for c in r.columns]; a = pd.concat([a[["game_id", "team"]], r], axis=1)
            if tag == "O": OFF = a if OFF is None else OFF.merge(a, on=["game_id", "team"])
            else: DEF = a if DEF is None else DEF.merge(a, on=["game_id", "team"])
    X = G[["season", "week", "game_id", "off", "def", "pass_epa", "rush_epa"] + [f"D_{d}_share" for d in list(DIMS) + ["bx"]]].copy()
    X = X.merge(OFF.rename(columns={"team": "off"}), on=["game_id", "off"]).merge(DEF.rename(columns={"team": "def"}), on=["game_id", "def"])
    X = X[X.season.isin(TEST)]
    for dim, levels in list(DIMS.items()) + [("bx", ("heavy", "light"))]:
        lv0, lv1 = levels; s0 = X[f"D_{dim}_share"] / 100; s1 = 1 - s0     # ACTUAL share this game (oracle)
        X[f"{dim}_adj"] = s0 * ((X[f"O_{dim}_{lv0}"] - X[f"O_{dim}_all"]) + (X[f"D_{dim}_{lv0}"] - X[f"D_{dim}_all"])) + s1 * ((X[f"O_{dim}_{lv1}"] - X[f"O_{dim}_all"]) + (X[f"D_{dim}_{lv1}"] - X[f"D_{dim}_all"]))
    X["pass_B"] = X.O_shell_all + X.D_shell_all - LG["shell"]["all"]; X["pass_A"] = X[["shell_adj", "mz_adj", "bl_adj"]].sum(axis=1)
    X["rush_B"] = X.O_bx_all + X.D_bx_all - LG["bx"]["all"]; X["rush_A"] = X.bx_adj
    T = X.dropna(subset=["pass_B", "pass_A", "pass_epa", "rush_B", "rush_A", "rush_epa"])
    print(f"  K={Kg:2d} games | PASS: identity {cor(T.pass_B, T.pass_epa):+.3f}  +oracle-scheme {cor(T.pass_B + T.pass_A, T.pass_epa):+.3f}  corr(adj, residual) {cor(T.pass_A, T.pass_epa - T.pass_B):+.3f}"
          f" | RUSH: identity {cor(T.rush_B, T.rush_epa):+.3f}  +oracle {cor(T.rush_B + T.rush_A, T.rush_epa):+.3f}  corr(adj, resid) {cor(T.rush_A, T.rush_epa - T.rush_B):+.3f}  n={len(T)}")
# does the ACTUAL scheme share itself (not team-specific skill) explain production? i.e. the league-level effect of scheme on output
X["pass_res"] = X.pass_epa - X.pass_B
print("\n  league-level: correlation of the game's ACTUAL scheme share with the offense's residual production (no team-specific skill involved):")
for dim in list(DIMS) + ["bx"]:
    y = X.rush_epa - X.rush_B if dim == "bx" else X.pass_res; m = X[f"D_{dim}_share"].notna() & y.notna()
    print(f"    {dim:6s} share of {DIMS.get(dim, ('heavy',))[0]:6s}: r={cor(X.loc[m, f'D_{dim}_share'], y[m]):+.3f}")

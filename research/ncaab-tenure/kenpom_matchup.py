#!/usr/bin/env python3
"""Owner 2026-11-02: BOTH teams' preseason KenPom components, jointly. Own offense x opponent defense, own defense x opponent
offense, own tempo x opponent tempo, own overall x opponent overall -- for every non-power team Nov-Dec and inside the
young-and-new cell as a dog of 7+. Cells = BACK record (%). National rank bands: good = 1-100, mid = 101-225, bad = 226+."""
import numpy as np, pandas as pd, importlib.util, io, contextlib
spec = importlib.util.spec_from_file_location("kp", "kenpom_profile.py"); kp = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(kp)
D, S, C = kp.D, kp.S, kp.C; rec, shuffle_p = kp.rec, kp.shuffle_p
band = lambda s: pd.cut(s, [0, 100, 225, 400], labels=["good(1-100)", "mid(101-225)", "bad(226+)"])
tband = lambda s: pd.cut(s, [0, 120, 240, 400], labels=["fast(1-120)", "avg(121-240)", "slow(241+)"])
def cell(s):
    w, l = rec(s); return f"{w}-{l} ({100*w/max(1,w+l):.1f}%)" if w + l >= 30 else f"{w}-{l} (thin)"
def grid(x, mask, rcol, ccol, rlab, clab, title, rb=band, cb=band):
    sub = x[mask].copy(); sub["r"] = rb(sub[rcol]); sub["c"] = cb(sub[ccol])
    g = sub.groupby(["r", "c"]).apply(cell).unstack()
    g.index.name = f"OWN {rlab}"; g.columns.name = f"OPP {clab}"
    print(f"\n   {title}  (n={len(sub):,})"); print(g.to_string())
    # the diagonal reads: advantage vs disadvantage
    return sub
def ladder(x, mask, col, bins, labels, title, placebo):
    print(f"\n   {title}")
    b = pd.cut(x[col], bins, labels=labels)
    for lab in labels:
        s = x[mask & (b == lab)]; p = x[placebo & (b == lab)]
        if len(s) < 40: print(f"      {lab:<34} n={len(s)} thin"); continue
        w, l = rec(s); pw, pl = rec(p); per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
        print(f"      {lab:<34} BACK {w}-{l} ({100*w/(w+l):.1f}%) spr {s.spread.mean():+.1f} | {per} | Jan-Feb {pw}-{pl} ({100*pw/max(1,pw+pl):.1f}%)")
for x in (D, S, C):
    x["o_minus_d"] = x.oe_rk - x.o_de_rk            # my offense rank minus their defense rank: negative = my O outranks their D
    x["d_minus_o"] = x.de_rk - x.o_oe_rk            # my defense rank minus their offense rank
    x["em_gap"] = x.em_rk - x.o_em_rk               # overall rank gap (negative = I am the better team)
nd, jf = S.novdec, S.janfeb
print("=== A. ALL NON-POWER TEAMS, Nov-Dec, both teams' preseason KenPom (BACK the non-power team) ===")
grid(S, nd, "oe_rk", "o_de_rk", "OFFENSE", "DEFENSE", "my offense vs their defense")
grid(S, nd, "de_rk", "o_oe_rk", "DEFENSE", "OFFENSE", "my defense vs their offense")
grid(S, nd, "tempo_rk", "o_tempo_rk", "TEMPO", "TEMPO", "my tempo vs their tempo", tband, tband)
grid(S, nd, "em_rk", "o_em_rk", "OVERALL", "OVERALL", "my overall vs their overall")
GB = [-400, -150, -60, -15, 15, 60, 150, 400]; GL = ["mine 150+ better", "mine 60-150 better", "mine 15-60 better", "even", "theirs 15-60 better", "theirs 60-150 better", "theirs 150+ better"]
ladder(S, nd, "o_minus_d", GB, GL, "ladder: my OFFENSE rank vs their DEFENSE rank", jf)
ladder(S, nd, "d_minus_o", GB, GL, "ladder: my DEFENSE rank vs their OFFENSE rank", jf)
ladder(S, nd, "em_gap", GB, GL, "ladder: overall rank gap", jf)
print("\n   style cross: which unit wins the matchup? (non-power, Nov-Dec)")
oadv = S.o_minus_d <= -60; dadv = S.d_minus_o <= -60; odis = S.o_minus_d >= 60; ddis = S.d_minus_o >= 60
for lab, m in [("my O beats their D by 60+ AND my D beats their O by 60+", oadv & dadv), ("O edge only (D matchup even/lost)", oadv & ~dadv), ("D edge only (O matchup even/lost)", dadv & ~oadv),
               ("lose both matchups by 60+", odis & ddis), ("my O beats their D, but their O beats my D (shootout mismatch)", oadv & ddis), ("my D beats their O, but their D beats my O (grind)", dadv & odis)]:
    s = S[nd & m]; p = S[jf & m]; w, l = rec(s); pw, pl = rec(p); per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
    print(f"      {lab:<64} BACK {w}-{l} ({100*w/max(1,w+l):.1f}%) spr {s.spread.mean():+.1f} | {per} | Jan-Feb {100*pw/max(1,pw+pl):.1f}%" + (f" | shuffle p {shuffle_p(nd & m, S):.3f}" if w + l >= 100 else ""))
print("\n   same cross, UNDERDOGS only (spread > 0):")
for lab, m in [("O edge 60+ (any D)", oadv), ("D edge 60+ (any O)", dadv), ("both edges 60+", oadv & dadv), ("shootout mismatch", oadv & ddis), ("grind mismatch", dadv & odis), ("lose both by 60+", odis & ddis)]:
    s = S[nd & m & (S.spread > 0)]; w, l = rec(s); per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
    print(f"      {lab:<64} BACK {w}-{l} ({100*w/max(1,w+l):.1f}%) spr {s.spread.mean():+.1f} | {per}")
print("\n\n=== B. YOUNG-AND-NEW CELL as dog of 7+, Nov-Dec, both teams' preseason KenPom ===")
cm = C.novdec & (C.spread >= 7)
cb3 = lambda s: pd.qcut(s.rank(method="first"), 3, labels=["best3rd", "mid", "worst3rd"])
grid(C, cm, "oe_rk", "o_de_rk", "OFFENSE (tercile in cell)", "DEFENSE", "cell dog: my offense vs their defense", cb3, band)
grid(C, cm, "de_rk", "o_oe_rk", "DEFENSE (tercile in cell)", "OFFENSE", "cell dog: my defense vs their offense", cb3, band)
grid(C, cm, "tempo_rk", "o_tempo_rk", "TEMPO", "TEMPO", "cell dog: my tempo vs their tempo", tband, tband)
grid(C, cm, "em_rk", "o_em_rk", "OVERALL (tercile in cell)", "OVERALL", "cell dog: my overall vs their overall", cb3, band)
ladder(C, cm, "o_minus_d", [-400, -100, 0, 100, 400], ["my O 100+ better than their D", "my O 0-100 better", "their D 0-100 better", "their D 100+ better"], "cell dog ladder: my offense vs their defense", C.janfeb & (C.spread >= 7))
ladder(C, cm, "d_minus_o", [-400, -100, 0, 100, 400], ["my D 100+ better than their O", "my D 0-100 better", "their O 0-100 better", "their O 100+ better"], "cell dog ladder: my defense vs their offense", C.janfeb & (C.spread >= 7))
ladder(C, cm, "tempo_gap", [-30, -5, -1.5, 1.5, 5, 30], ["I'm 5+ slower", "2-5 slower", "even", "2-5 faster", "5+ faster"], "cell dog ladder: tempo gap (possessions)", C.janfeb & (C.spread >= 7))
print("\n   cell dog, opponent outside top 50, by what the opponent is built on:")
oo = cm & (C.o_em_rk > 50); C["o_imb"] = C.o_oe_rk - C.o_de_rk
for lab, m in [("opponent offense-led (O rank 40+ better than D)", C.o_imb <= -40), ("opponent balanced", C.o_imb.abs() < 40), ("opponent defense-led (D rank 40+ better than O)", C.o_imb >= 40),
               ("opponent fast (tempo top 120)", C.o_tempo_rk <= 120), ("opponent slow (241+)", C.o_tempo_rk >= 241), ("opponent offense top 100", C.o_oe_rk <= 100), ("opponent defense top 100", C.o_de_rk <= 100)]:
    s = C[oo & m]; w, l = rec(s); per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
    print(f"      {lab:<52} BACK {w}-{l} ({100*w/max(1,w+l):.1f}%) spr {s.spread.mean():+.1f} | {per}")

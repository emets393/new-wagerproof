#!/usr/bin/env python3
"""Two follow-ups to kenpom_profile.py: (1) rated non-power teams (preseason KenPom top 100 on O, D or overall) look over-priced
early -- grade the FADE as a favorite with shuffle null + placebo; (2) inside the young-and-new cell as a dog of 7+, ladder the
OPPONENT's preseason rank."""
import numpy as np, pandas as pd, importlib.util, io, contextlib
spec = importlib.util.spec_from_file_location("kp", "kenpom_profile.py"); kp = importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(kp)
D, S, C = kp.D, kp.S, kp.C; rec, shuffle_p = kp.rec, kp.shuffle_p
def fade(mask, label, x, placebo=None, shuffle=True):
    s = x[mask]; w, l = rec(s); roi = 100 * (l * 100 / 110 - w) / max(1, w + l)
    per = " ".join(f"{str(y)[2:]}:{rec(g)[1]}-{rec(g)[0]}" for y, g in s.groupby("season_end"))
    ex = f" | shuffle p {shuffle_p(mask, x):.3f}" if shuffle and len(s) >= 40 else ""
    if placebo is not None:
        p = x[placebo]; pw, pl = rec(p); ex += f" | Jan-Feb fade {pl}-{pw} ({100*pl/max(1,pw+pl):.1f}%)"
    print(f"   {label:<66} FADE {l}-{w} ({100*l/max(1,w+l):.1f}%, ROI {roi:+.1f}%) spr {s.spread.mean():+.1f} | {per}{ex}")
nd, jf, e10 = S.novdec, S.janfeb, S.early10
print("=== 1. FADE the rated non-power team early (preseason KenPom) ===")
for lab, m in [("overall top 100", S.em_rk <= 100), ("overall top 50", S.em_rk <= 50), ("offense top 100", S.oe_rk <= 100), ("defense top 100", S.de_rk <= 100), ("offense OR defense top 100", (S.oe_rk <= 100) | (S.de_rk <= 100)), ("overall 101-150", (S.em_rk > 100) & (S.em_rk <= 150))]:
    fade(nd & m, f"Nov-Dec, {lab}", S, placebo=jf & m)
    fade(nd & m & (S.spread <= -7), f"  ... as favorite of 7+", S, placebo=jf & m & (S.spread <= -7))
    fade(nd & m & (S.spread <= -7) & (S.o_csize != "power"), f"  ... favorite of 7+ vs a non-power opponent", S, placebo=jf & m & (S.spread <= -7) & (S.o_csize != "power"))
    fade(nd & m & (S.spread > 0), f"  ... as underdog", S, placebo=jf & m & (S.spread > 0))
    fade(e10 & m, f"first 10 games, {lab}", S, placebo=jf & m)
print("\n   favorite-of-7+ ladder by preseason overall rank band (non-power, Nov-Dec, FADE side):")
for lo, hi in [(1, 50), (51, 100), (101, 150), (151, 200), (201, 300), (301, 400)]:
    m = (S.em_rk >= lo) & (S.em_rk <= hi) & (S.spread <= -7); fade(nd & m, f"  rank {lo}-{hi}", S, placebo=jf & m, shuffle=False)
print("\n   is it the same as 'kept roster / cohesive' or a different animal? top-100 favorites of 7+ Nov-Dec by cohesion:")
m = (S.em_rk <= 100) & (S.spread <= -7)
fade(nd & m & (S.core_share >= 0.25), "  3rd+-year players 25%+ of minutes", S, shuffle=False); fade(nd & m & (S.core_share < 0.25), "  under 25%", S, shuffle=False)
fade(nd & m & (S.upper_share >= 0.6), "  Jr/Sr 60%+ of minutes", S, shuffle=False); fade(nd & m & (S.upper_share < 0.6), "  under 60%", S, shuffle=False)
print("\n=== 2. YOUNG-AND-NEW cell as dog of 7+, Nov-Dec, by the OPPONENT's preseason overall rank ===")
cnd = C.novdec & (C.spread >= 7)
def back(mask, label, x):
    s = x[mask]; w, l = rec(s); roi = 100 * (w * 100 / 110 - l) / max(1, w + l); per = " ".join(f"{str(y)[2:]}:{rec(g)[0]}-{rec(g)[1]}" for y, g in s.groupby("season_end"))
    print(f"   {label:<50} BACK {w}-{l} ({100*w/max(1,w+l):.1f}%, ROI {roi:+.1f}%) spr {s.spread.mean():+.1f} | {per}")
for lo, hi in [(1, 25), (26, 50), (51, 100), (101, 150), (151, 250), (251, 400)]:
    back(cnd & (C.o_em_rk >= lo) & (C.o_em_rk <= hi), f"opponent rank {lo}-{hi}", C)
back(cnd & (C.o_em_rk > 50), "opponent outside top 50", C); back(cnd & (C.o_em_rk > 50) & (C.spread >= 12.5), "  ... and dog of 12.5+", C); back(cnd & (C.o_em_rk > 50) & (C.spread < 12.5), "  ... dog of 7 to 12", C)
back(cnd & (C.o_em_rk > 50) & (C.o_csize == "power"), "  ... vs power-conference opponent outside top 50", C); back(cnd & (C.o_em_rk > 50) & (C.o_csize != "power"), "  ... vs non-power opponent", C)
back(C.janfeb & (C.spread >= 7) & (C.o_em_rk > 50), "  Jan-Feb placebo (dog 7+, opp outside top 50)", C)
print(f"   shuffle p, cell dog 7+ vs opponent outside top 50: {shuffle_p(cnd & (C.o_em_rk > 50), C):.3f}")

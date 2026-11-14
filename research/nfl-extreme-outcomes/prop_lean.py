#!/usr/bin/env python3
"""The directional count behind the lean tag and the default-market choice.

⛔ WHAT THIS IS NOT. Agreement does not predict. Measured on 14,516 graded lines 2023-26:
unanimous readings win 50.1% against a 50.1% baseline, +0.45pp, ROI -7.0%. Confirmed three times
now (the spotlight's own confidence was anti-predictive, the gap composite's dose-response was
noise). So this is a BROWSE affordance — "everything on this card says the same thing" — and the
UI must never present it as a ranking of quality or call the top of the list the best plays.

It earns its place for two jobs only:
  * pick which market a player's pill opens on, instead of an arbitrary one;
  * tag a player whose readings line up but who is not a spotlight pick.

THE RULE. Each reading votes over (+1) or under (-1) for one market, or abstains. A reading
abstains when its blob is absent or its margin is inside the dead zone — a near-zero reading is
not weak evidence, it is no evidence, and counting it as agreement is how the old board got a
denominator it could not compare across markets.

COMPARABILITY. Markets carry different numbers of readings (receiving has route and alignment
data a QB does not), so a raw count cannot be compared across a player's markets. Rank on
`net_share` = (for - against) / populated, and require `populated >= MIN_POP` so a 2-of-2 does
not beat a 7-of-9.
"""
MIN_POP = 3          # fewer readings than this and the player's pill falls back to market order
# ⛔ THE TAG IS UNANIMOUS, NOT "MAJORITY". Tuned on 2026 wk5, 554 posted player-markets:
#   majority (>=70% of 3+)   199 tags — 36% of the board, which is not a signal, it is wallpaper
#   >=80% of 3+              141
#   unanimous, 5+ readings    29 — but ALL RECEIVING, because only receiving markets have five
#                                  readings to begin with: routes, alignment and coverage do not
#                                  exist for a rush or pass prop. A flat floor silently excludes
#                                  every QB and RB.
#   unanimous, 4+ readings    55 — 10% of the board, spread across every market family:
#                                  rec_yds 18, receptions 17, rush_yds 9, rush_att 7, pass_att 3
# A tag a third of the board carries tells a user nothing and trains them to ignore it.
# ⛔ pass_completions and pass_tds top out at TWO readings and can never qualify. That is honest —
# there is no per-market substrate for them — and the UI should not imply the tag was considered.
LEAN_MIN_POP = 4     # readings required before the tag can fire
LEAN_SHARE = 1.00    # all of them must agree
DEAD = {             # dead zones: below this a reading abstains
    "pct": 0.03,     # a rate within 3% of its league twin
    "line": 0.04,    # a projection within 4% of the line
}
MARKET_STAT = {
    "player_reception_yds": "rec_yds", "player_receptions": "receptions",
    "player_rush_yds": "rush_yds", "player_rush_attempts": "rush_att",
    "player_pass_yds": "pass_yds", "player_pass_tds": "pass_td",
    "player_pass_attempts": "pass_att", "player_pass_completions": "completions",
}
# which readings are in scope for which market — a route tree says nothing about rush attempts
SCOPE = {
    "routes":      {"player_reception_yds", "player_receptions"},
    "alignment":   {"player_reception_yds", "player_receptions"},
    "coverage":    {"player_reception_yds", "player_receptions"},
    "throw_depth": {"player_pass_yds", "player_pass_completions", "player_pass_attempts"},
    "run_concept": {"player_rush_yds", "player_rush_attempts"},
}


def _sign(v, dead):
    return 0 if v is None or abs(v) < dead else (1 if v > 0 else -1)


def readings(page, market):
    """[(name, vote)] for one player-market. vote in {-1,0,1}; 0 means it abstained."""
    out = []
    stat = MARKET_STAT.get(market)
    line = next((m.get("line") for m in (page.get("markets") or []) if m.get("key") == market), None)
    cards = page.get("fp_cards") or {}
    mu = (cards.get("matchup") or {})

    # 1. the engine's own projection against the line
    proj = ((page.get("projection") or {}).get(market) or {}).get("value")
    if proj is not None and line:
        out.append(("projection", _sign(proj / line - 1, DEAD["line"])))

    # 2. his own season baseline against the line
    base = (page.get("baseline") or {}).get(stat) if stat else None
    if base is not None and line:
        out.append(("baseline", _sign(base / line - 1, DEAD["line"])))

    # 3. what this defence allows his position, against the league
    vp = mu.get("vs_position") or {}
    a, l = vp.get(f"{stat}_actual"), vp.get(f"{stat}_league")
    if a is not None and l:
        out.append(("allowance", _sign(a / l - 1, DEAD["pct"])))

    # 4. the alignment mix he actually plays, against the league at that mix
    if market in SCOPE["alignment"]:
        al = mu.get("vs_alignment") or {}
        role = cards.get("role") or {}
        dw = lw = 0.0
        for k in ("wide", "slot", "inline", "backfield"):
            sh = role.get(f"align_{k}_share") or 0
            cell = al.get(k) or {}
            if sh and cell.get("yds_actual") is not None and cell.get("yds_league"):
                dw += sh * cell["yds_actual"]; lw += sh * cell["yds_league"]
        if lw:
            out.append(("alignment", _sign(dw / lw - 1, DEAD["pct"])))

    # 5. his route tree against what they give up on those branches
    if market in SCOPE["routes"]:
        rts = cards.get("routes") or []
        num = den = 0.0
        for leaf in rts:
            n, d, lg = leaf.get("routes"), leaf.get("def_yards_per_route_actual"), \
                       leaf.get("def_yards_per_route_league")
            if n and d is not None and lg:
                num += n * (d - lg); den += n * lg
        if den:
            out.append(("routes", _sign(num / den, DEAD["pct"])))

    # 6. coverage: his rate in each shell, weighted by how often they run it
    sc = page.get("scheme") or {}
    sp, ov, dfn = sc.get("player_splits") or {}, sc.get("player_overall") or {}, sc.get("defense") or {}
    if market in SCOPE["coverage"] and ov.get("ypt"):
        num = den = 0.0
        for fam, cell in sp.items():
            rate = ((dfn.get(fam) or {}) or {}).get("rate")
            if rate and (cell or {}).get("ypt") is not None:
                num += rate * cell["ypt"]; den += rate
        if den:
            out.append(("coverage", _sign((num / den) / ov["ypt"] - 1, DEAD["pct"])))

    # 7/8. the per-market substrates, each against its league twin
    for blob, name in (("throw_depth", "depth"), ("run_concept", "concept")):
        if market not in SCOPE[blob]:
            continue
        by = (cards.get(blob) or {}).get("by") or {}
        num = den = 0.0
        for cell in by.values():
            n = (cell or {}).get("attempts")
            d, lg = (cell or {}).get("def_yards_per_attempt"), \
                    (cell or {}).get("def_yards_per_attempt_league")
            if n and d is not None and lg:
                num += n * (d - lg); den += n * lg
        if den:
            out.append((name, _sign(num / den, DEAD["pct"])))
    return out


def score(page, market):
    r = readings(page, market)
    pop = [x for _, x in r if x != 0]
    f, a = sum(1 for x in pop if x > 0), sum(1 for x in pop if x < 0)
    n = len(pop)
    return dict(market=market, readings=r, populated=n, n_for=f, n_against=a,
                direction=("over" if f > a else "under" if a > f else "split"),
                net_share=(abs(f - a) / n) if n else 0.0,
                lean=bool(n >= LEAN_MIN_POP and f != a
                          and (max(f, a) / n) >= LEAN_SHARE))


def best_market(page):
    """Which market the player's pill should open on: most one-sided, ties to more readings."""
    cand = [score(page, m["key"]) for m in (page.get("markets") or [])
            if m.get("status") == "posted" and m.get("key") in MARKET_STAT]
    cand = [c for c in cand if c["populated"] >= MIN_POP]
    if not cand:
        return None
    return sorted(cand, key=lambda c: (-c["net_share"], -c["populated"]))[0]

# Venue Brief #1 — HCA persistence, altitude, primetime/TV proxy (NCAAB)

Non-neutral games from sides_table. T-60 prices. BE 52.4%. 2026-07-17.

## A — team-specific HCA persistence: PRICED

Prior-season venue ATS residual (≥10 home games history) does NOT predict:
strong-venue back-home 49.4%, weak-venue back-away 50.2%. Books already rate
Rupp/Cameron etc. Venue reputation carries no edge by itself.

## B — ALTITUDE: real, both directions (the market under-adjusts a constant)

- Altitude home (CO/WY/NM/UT/MT schools) vs lowland visitor → BACK HOME:
  53.4% / +2.0% (n=702; 54/53/57/50) — visitors cover 46.6%.
- Altitude team ON ROAD (descending) → FADE: 52.5% / +0.2% (n=650) — their
  home-inflated profile overprices them at sea level.
Modest as standalone bets; belongs in the MODEL as home/away altitude flags.

## C — primetime / obscure proxy (tip time + day + KP-rank marquee)

- **PRIMETIME marquee (both KP top-40, 7-10pm ET) → game UNDER: 54.6% /
  +4.3% (n=377), strengthening by season (48/52/54/65)** — the anti-public
  under, same shape as NFL primetime unders.
- PRIMETIME home side covers: favs 55.6%/+6.1% (n=315), dogs 57.6%/+10.1%
  (n=59) — big-stage home teams outperform.
- **OBSCURE weekday games (both KP >100, pre-7pm Mon-Thu) → BACK AWAY:
  53.2% / +1.7% (n=757, non-negative ALL 4 seasons)** — empty-gym home
  teams cover only 46.8%. Books price an AVERAGE HCA; crowd-less games have
  less of it. Mechanically clean; refine with actual attendance (in CBBD raw)
  and real broadcast data (ESPN scoreboard) later.

## Referee data: no historical officials feed in CBBD or the KenPom API —
parked until a source exists.

## Status: TRACK-PLUS family "venue/spotlight": V1 obscure-away (4/4 seasons),
V2 primetime-marquee under, V3 primetime home, V4 altitude flags (model
features + small standalone lean).


## D — attendance refinement (2026-07-17, attendance_ncaab.parquet, 25,122 games)

- Low attendance ALONE: mostly priced (away 51.0-51.1%).
- **COMBO: obscure weekday AND attendance ≤25th pct → BACK AWAY 53.8% /
  +2.8% (n=409, 54/59/55/51 — all four seasons).** Upgrades V1.
- Packed gyms (≥11.5k): away covers only 47.9% — crowds are real HCA beyond
  pricing at the top end too.
- Attendance relative to venue norm: nothing (49.4%) — absolute emptiness is
  what matters, not a below-average night.

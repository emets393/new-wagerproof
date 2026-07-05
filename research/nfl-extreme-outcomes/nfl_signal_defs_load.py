"""Load the NFL signal dictionary into nfl_signal_defs (research Supabase).

One row per rule that can appear in nfl_dryrun_flags.rule / nfl_dryrun_picks.signal_keys.
Mirrors cfb_signal_defs so the same Swift "what is this signal" sheet renders both
sports. default_conviction uses the shared CFB enum: mammoth|high|med|low|lean|none.

Tier intent: active harness sides/totals + consensus_totals_HC + P11 carry real
conviction; the 1H model (M*) and K-signals are tracking-tier (paper-traded 2026)
and therefore default_conviction="low" with display-only treatment in the picks.

Usage:  python3 nfl_signal_defs_load.py
"""
import json
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent
URL = "https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/nfl_signal_defs"

# signal_key, display_name, market, one_liner, definition, why_it_works, bet_direction, typical_hit, default_conviction
DEFS = [
    # ---------------- FG harness — sides (active) ----------------
    ("sides_model", "Sides Model", "spread",
     "The locked spread model's pick when its margin and win-prob agree.",
     "Harness BASE+21 matchup-net ensemble. A pick fires only when the classifier "
     "(win probability) and the regressor (predicted margin vs the opener) point the "
     "same direction by the confluence thresholds.",
     "Requiring both heads to agree filters out coin-flip games and leaves the spots "
     "where the model has a genuine read against the opening number.",
     "Side the model favors", "~53% product-style, +CLV", "med"),
    ("legacy_primetime", "Legacy Model — Primetime Follow", "spread",
     "In primetime, follow our older EPA model instead of fading it.",
     "Same previous-generation EPA cover model as Legacy Fade, but in primetime windows "
     "(TNF/SNF/MNF) the rule FOLLOWS it — backing whichever side the legacy model favors "
     "at the opener.",
     "The fade pattern flips under the lights: primetime lines are shaped by different "
     "money, and the legacy model's read has held up in those windows (61.8% in 2025).",
     "Same side the legacy model favors.", "~60-62%", "high"),
    ("legacy_fade", "Legacy Model Fade", "spread",
     "Bet against our older EPA model when it is overconfident in a daytime game.",
     "WagerProof's previous-generation EPA model still grades every game and outputs a "
     "home-spread-cover probability. When that model is at an extreme on a NON-primetime "
     "game (80%+ on one side, or 20% or less) this rule takes the OPPOSITE side at the "
     "opener: if the legacy model loves the home team, bet the away side; if it loves the "
     "away team, bet home.",
     "At its confidence extremes the legacy model is overfit to the same storyline the "
     "market has already baked into the line, so its strongest regular-season opinions "
     "have historically been wrong often enough that the other side covers. The stronger "
     "the legacy lean, the better the fade has performed (dose-response).",
     "Opposite of the legacy model's lean — fade the side it loves.", "~60-65%", "high"),
    ("fade_pr_in_tight_game", "Fade Power-Rating in Tight Game", "spread",
     "Fade the power-rating favorite when the game projects tight.",
     "In near-pickem games the model fades the side the raw power rating prefers.",
     "Power ratings overstate edges in evenly matched games; the market's tight number "
     "is sharper than the rating gap.",
     "Side indicated by the rule", "~64%", "med"),
    ("tight_soft_ml_fade_home", "Tight Soft-ML Fade Home", "spread",
     "Fade the home side when the moneyline is soft in a tight game.",
     "Tight spread + a moneyline that prices the home team softer than the spread "
     "implies -> fade home.",
     "A soft home ML signals the market does not actually trust the home favorite; the "
     "spread is the side to oppose.",
     "Away / fade home", "62% / +18% ROI", "high"),
    ("spread_dog_cover_fade_home", "Spread Dog-Cover Fade Home", "spread",
     "Fade home when the dog-cover profile lines up.",
     "Home-favorite spots whose dog-cover regression profile flags the home number as "
     "inflated.",
     "Identifies home favorites the market has padded past their true cover rate.",
     "Away / fade home", "~60%", "med"),
    ("top_vs_top_pt_home", "Top-vs-Top Points Home", "spread",
     "Back the home side when two strong teams meet.",
     "Both teams rate near the top of the slate by points model; take the indicated "
     "home side.",
     "In top-vs-top matchups home-field is systematically under-priced relative to the "
     "quality gap.",
     "Home side", "65%", "high"),
    ("dk_heavy_home_juice", "DK Heavy Home Juice", "spread",
     "Book-specific heavy home juice tell.",
     "DraftKings prices unusually heavy juice on the home side; follow the indicated "
     "side.",
     "A book leaning hard on one side's price reveals where it wants action and where "
     "the sharp number sits.",
     "Side indicated by the rule", "61%", "high"),

    # ---------------- FG harness — totals (active) ----------------
    ("dk_giant_fav_over", "DK Giant-Favorite Over", "total",
     "Over when a giant favorite shows on DraftKings.",
     "Large-spread favorite games (DK book read) lean Over the posted total.",
     "Blowout scripts produce garbage-time and pace-up scoring the total under-prices.",
     "Over", "65%", "high"),
    ("receiver_over", "Receiver Over", "total",
     "Receiving-environment Over signal.",
     "Games whose receiving/passing matchup profile favors the Over.",
     "Pass-funnel matchups generate more plays and points than the closing total "
     "reflects.",
     "Over", "~58%", "med"),
    ("receiver_over_HC", "Receiver Over (High Conviction)", "total",
     "Stronger-tier receiving Over.",
     "Receiver Over signal at its high-conviction threshold.",
     "Same edge as receiver_over but only the strongest reads, which historically hit "
     "harder.",
     "Over", "60%+", "high"),
    ("total_low_line_over", "Low-Line Over", "total",
     "Over on a suspiciously low total.",
     "Totals set well below the model's number on the low end -> Over.",
     "Markets over-shade defensive narratives; low totals revert upward.",
     "Over", "~58%", "med"),
    ("total_high_line_under", "High-Line Under", "total",
     "Under on an inflated total.",
     "Totals set well above the model's number on the high end -> Under.",
     "Shootout hype inflates high totals past sustainable scoring.",
     "Under", "~58%", "med"),
    ("wind_under", "Wind Under", "total",
     "Under in high-wind outdoor games.",
     "Outdoor game with forecast wind above the threshold -> Under.",
     "Wind suppresses the passing and kicking game, cutting scoring below the total.",
     "Under", "~60%", "high"),

    # ---------------- FG harness — tracking ----------------
    ("primetime_tight_favorite", "Primetime Tight Favorite (tracking)", "spread",
     "Primetime tight-favorite angle, on probation.",
     "Tight primetime favorite spot; regressed in 2025 so it is tracked, not bet.",
     "Tracked to confirm whether the historical primetime-favorite edge re-stabilizes.",
     "Favorite", "regressed 2025", "low"),
    ("primetime_tight_under", "Primetime Tight Under (tracking)", "total",
     "Primetime tight-game Under, on probation.",
     "Under in tight primetime games; regressed in 2025 so it is tracked, not bet.",
     "Tracked to see if the low-scoring primetime tendency returns.",
     "Under", "regressed 2025", "low"),
    ("bot_vs_bot_under", "Bottom-vs-Bottom Under (tracking)", "total",
     "Two weak offenses -> Under, on probation.",
     "Both teams rate near the bottom; Under angle, regressed in 2025 so tracked only.",
     "Tracked to confirm the weak-offense Under tendency.",
     "Under", "regressed 2025", "low"),
    ("bye_collision", "Bye Collision (tracking)", "spread",
     "Bye-week rest mismatch, unproven.",
     "One team off a bye facing a team on normal rest; thin sample, tracked only.",
     "Tracked to build sample on the rest-advantage angle.",
     "Rested side", "thin sample", "low"),
    ("week1_def_under", "Week 1 Defense Under (tracking)", "total",
     "Week 1 defensive Under, unproven.",
     "Week-1 specific defensive Under angle; thin/unproven, tracked only.",
     "Tracked to build a Week-1 sample.",
     "Under", "thin sample", "low"),

    # ---------------- consensus totals (active, locked) ----------------
    ("consensus_totals_HC", "Consensus Totals (High Conviction)", "total",
     "The locked totals model's high-conviction bet.",
     "consensus_totals.py ensemble (b15+b55), strict-open, fires when the agreed edge "
     "lands in the validated 3<=edge<=7 band.",
     "The locked totals product: ~57% / +8% ROI with positive CLV across 4/5 backtest "
     "seasons.",
     "Over or Under per the model", "~57% / +8% ROI", "high"),

    # ---------------- props (active, vaulted) ----------------
    ("P11_atd_implied_over", "ATD-Implied Total Over", "total",
     "Anytime-TD market implies more scoring than the posted total.",
     "Sum the anytime-TD implied probabilities across both rosters, map to an implied "
     "total (fit on 2024); when a game lands in the top slate quintile vs the posted "
     "total, bet the game Over.",
     "The ATD market prices scoring independently of the total and leads it; the top "
     "quintile hit the Over 58-61% for +11-16% ROI.",
     "Over", "58-61% / +11-16% ROI", "high"),
    ("P12_featured_wr_over", "Featured Receiver Yds Over", "player_prop",
     "High-usage receiver whose line lags his own form -> receiving-yards Over.",
     "Player is NFL-tracked (NGS receiving = featured, high-target role) AND his entering "
     "L3 average separation ranks in the top quintile of all receiving-yards props AND the "
     "posted line sits at or below his trailing-3-game receiving average -> bet the Over.",
     "Receiving yards are right-skewed (one long catch drags the mean above the median) "
     "and high-target separators realize that upside most; books anchor near the median "
     "and shade star unders, so the Over clears. Held 72%/69% across 2024/25 and "
     "survives grading at the worst line across books and at the opener (not CLV-inflated).",
     "Receiving yards Over", "70.6% / +32% ROI [72,69]", "high"),
    ("P13_featured_rb_over", "Featured Rusher Yds Over", "player_prop",
     "High-usage back whose line lags his own form -> rushing-yards Over.",
     "Player is NFL-tracked (NGS rushing = featured, workhorse carry share) AND his "
     "entering L3 rush efficiency ranks in the top quintile of all rushing-yards props AND "
     "the posted line sits at or below his trailing-3-game rushing average -> bet the Over.",
     "Same right-skew/under-shade mechanism as P12 applied to rushing yards. Hit "
     "82%/79% across 2024/25 for +50% ROI; thinner sample (n=50) so medium conviction.",
     "Rushing yards Over", "80% / +50% ROI [82,79] (thin)", "med"),

    # ---------------- props — attempts volume model (nfl-game-script-analysis) ----------------
    ("P14_attempts_model_under", "Volume Model — Attempts Under", "player_prop",
     "Our volume model projects fewer attempts/carries than the posted line -> Under.",
     "A gradient-boosted model predicts a player's pass or rush attempts from team-offense "
     "pace/pass-rate, the opponent defense, and the game script; when its projection sits "
     "1.5+ below the posted attempts line, bet the Under. Fires on pass-attempts and "
     "rush-attempts only.",
     "Volume overs are shaded (the public loves overs), so the model can't beat the market's "
     "point estimate on accuracy — but when it flags a line as inflated the Under is +EV. "
     "Selective (beats betting every under), favorite-neutral, and held both seasons: "
     "rush attempts 59% / +6-8% ROI, pass attempts 56% / +5%.",
     "Rushing/passing attempts Under", "rush 59% / +7%, pass 56% / +5% [both yrs]", "med"),
    ("P15_attempts_steam_under", "Attempts Steam Under", "player_prop",
     "The attempts line steamed up into the close -> fade it to the Under.",
     "A player's pass- or rush-attempts line rose 1+ from the open to the actionable "
     "(T-60) close -> bet the Under. Pass-attempts and rush-attempts only.",
     "The market over-reacts to a volume/game-script narrative and pushes the attempts "
     "number too high; fading that steam to the Under has cleared both seasons "
     "(rush 60% / +8%, pass 57% / +5%) and is independent of the volume model.",
     "Rushing/passing attempts Under", "rush 60% / +8%, pass 57% / +5% [both yrs]", "med"),
    ("P16_attempts_confluence", "Attempts Under — Model + Steam Confluence", "player_prop",
     "Both the volume model AND the line movement agree on the attempts Under -> premium.",
     "P14 and P15 fire on the same attempts prop: the model projects the line as inflated "
     "AND the line steamed up into the close. Two independent reads on the same Under.",
     "Fundamentals and market movement confirming the same Under is far stronger than "
     "either alone — the confluence hit ~65% for +19% ROI both seasons. Thinner by "
     "construction (agreement is rarer), so premium-but-track.",
     "Rushing/passing attempts Under", "65% / +19% ROI [thin n~90-130, both yrs]", "high"),

    # ---------------- props — line-vs-form & regression keepers (PROPS_BRIEF1) ----------------
    ("P1_pass_yds_form_over", "QB Pass Yds — Line Above Form Over", "player_prop",
     "QB's posted passing line sits above his recent form -> Over.",
     "Quarterback with 4+ games of history whose posted passing-yards line is more than "
     "5% above his trailing-5-game average -> bet the Over.",
     "When the book sets a QB's line above his recent form it is reading a favorable "
     "matchup or script the market hasn't fully bought; trusting the line over the lagging "
     "form has cleared a profit both seasons.",
     "Passing yards Over", "+6-21% ROI (2yr)", "med"),
    ("P2_pass_yds_form_under", "QB Pass Yds — Line Below Form Under", "player_prop",
     "QB's posted passing line sits modestly below his form -> Under.",
     "Quarterback with 4+ games of history whose posted passing-yards line is 5-20% below "
     "his trailing-5-game average -> bet the Under.",
     "A line cut 5-20% under recent form signals the book sees regression the box score "
     "hasn't shown yet; siding with the line against stale form has been +EV both seasons.",
     "Passing yards Under", "+8-12% ROI (2yr)", "med"),
    ("P3_pass_tds_form_over", "QB Pass TDs — Line Above Form Over", "player_prop",
     "QB's passing-TD line is set well above recent form -> Over.",
     "Quarterback with 4+ games of history whose posted passing-TDs line is 40%+ above his "
     "trailing-5-game average -> bet the Over.",
     "A sharply raised passing-TD number reflects a strong scoring-script read the market "
     "underweights; following the raised line beats fading it.",
     "Passing TDs Over", "+EV both seasons (validated)", "low"),
    ("P4_no_history_qb_under", "No-History QB Under", "player_prop",
     "Season-debut / no-history QB -> passing Under.",
     "Quarterback with zero prior games this season on a passing-yards or passing-TDs prop "
     "-> bet the Under.",
     "Books price debut/unproven QBs off optimistic priors; without a track record realized "
     "output skews under, and Week-1 unders have returned +11-37%.",
     "Passing yards/TDs Under", "+11-37% ROI (Wk1, thin)", "low"),
    ("P5_atd_drift_yes", "Anytime TD Drift-Down Yes", "player_prop",
     "ATD yes-price drifted down into the close -> back Yes.",
     "Player's anytime-touchdown YES implied probability fell 5%+ from open to close -> bet "
     "Anytime TD Yes at the closing price.",
     "A drifting-down ATD price leaves the longer (better) number available late while the "
     "usage signal holds; backing the Yes at the close has paid +5-6% on a very large "
     "sample (~1,600/season).",
     "Anytime TD Yes", "+5-6% ROI (n~1600/yr)", "low"),
    ("P7_rush_yds_tough_d_under", "Rush Yds vs Tough Run D Under", "player_prop",
     "Rusher faces a very tough run defense -> rushing Under.",
     "Rushing-yards prop where the opponent's run-defense matchup index is in the toughest "
     "tier (<=0.8), from Week 5 on -> bet the Under.",
     "Elite run defenses suppress rushing yardage more than the posted line accounts for "
     "once a few weeks of matchup data exist; the Under has been +EV both seasons.",
     "Rushing yards Under", "+EV both seasons (validated)", "low"),
    ("P9_pass_tds_regression_over", "Pass TDs Bounce-Back Over", "player_prop",
     "QB under his pass-TD line two straight weeks -> Over next.",
     "Quarterback who finished under his passing-TDs line in each of the last two "
     "prop-weeks -> bet the Over this week.",
     "Passing-TD output is volatile and mean-reverting; two consecutive unders overstate "
     "decline and the bounce-back Over has hit for +11-14% (~100/season).",
     "Passing TDs Over", "+11-14% ROI (n~100/yr)", "low"),
    ("P10_receptions_raised_under", "Receptions Line Raised Under", "player_prop",
     "Receptions line raised two straight weeks -> Under.",
     "Receiver whose receptions line was raised in each of the last two weeks and is higher "
     "again this week -> bet the Under.",
     "Consecutive upward receptions adjustments chase a hot streak the usage can't sustain; "
     "the Under has returned +12-20% (n~60-70), with overs hitting only ~30%.",
     "Receptions Under", "+12.8-19.5% ROI (n~60-70)", "low"),

    # ---------------- 1H model (tracking, paper-trade 2026) ----------------
    ("M1_window_over_k1", "1H Window Over + K1", "h1_total",
     "1H Over when the residual sits in the sweet window and K1 agrees.",
     "Anchored 1H total residual in the 1.25-2.75 band AND the K1 TT-sum signal is on "
     "-> 1H Over.",
     "1H model edge is strongest in the mid residual window; K1 confirmation adds a "
     "second independent read.",
     "1H Over", "tracking 2026", "low"),
    ("M2_k1_model_lean", "K1 + Model Lean Over", "total",
     "Full-game Over when K1 fires and the 1H model leans up.",
     "K1 on AND anchored 1H total residual > 0.5 -> full-game Over.",
     "Two aligned scoring tells (market TT-sum + model residual) historically push the "
     "game Over.",
     "Over", "tracking 2026", "low"),
    ("M3_primetime_fav_tilt", "Primetime 1H Favorite Tilt", "h1_spread",
     "1H favorite tilt in primetime when the cover residual agrees.",
     "SNF/MNF game where the 1H cover residual tilts toward the favorite -> 1H favorite "
     "spread.",
     "Favorites start fast in primetime; the residual confirms the first-half lean.",
     "Favorite 1H spread", "tracking 2026", "low"),
    ("M4_slow_start_dog_fade", "Slow-Start Dog Fade (1H)", "h1_spread",
     "Back the favorite 1H against a slow-starting underdog.",
     "Underdog with a low first-half points-for average AND the 1H cover residual "
     "agrees -> favorite 1H spread.",
     "Chronic slow-starting dogs fall behind early; the 1H spread captures it before "
     "garbage-time backdoors.",
     "Favorite 1H spread", "tracking 2026", "low"),

    # ---------------- K-signals (tracking, H1TT brief keepers) ----------------
    ("K1_tt_sum_q5_over", "TT-Sum Top-Quintile Over", "total",
     "Team-total sum in the top slate quintile -> Over.",
     "Sum both team totals; when (TT-sum minus posted total) ranks in the top 20% of "
     "the slate, bet Over.",
     "When books price both team totals hot relative to the game total, the game total "
     "is lagging the scoring expectation.",
     "Over", "tracking", "low"),
    ("K2_bigfav_home_tt_over", "Big-Favorite Home TT Over", "team_total",
     "Heavy home favorite -> home team total Over.",
     "Home favorite of 7+ -> home team-total Over.",
     "Big home favorites hit their team total via sustained scoring and garbage-time "
     "cushion.",
     "Home TT Over", "tracking", "low"),
    ("K3_h1_steam_follow_small", "1H Steam Follow (small spread)", "h1_spread",
     "Follow 1H spread steam in small-spread games.",
     "1H spread moved >=1pt from open with a full-game spread under 7 -> follow the "
     "side the line moved toward.",
     "First-half line steam in close games reflects sharp money on the early script.",
     "Side the 1H line moved toward", "tracking", "low"),
    ("K5_tt_cut_bounceback_over", "TT Cut Bounce-Back Over", "team_total",
     "Team total cut after a big miss -> bounce-back Over.",
     "A team that badly missed its prior team total (>=8 under) and whose number was "
     "then cut 2+ -> team-total Over.",
     "Books over-correct after one bad scoring game; the cut number is too low for a "
     "bounce-back.",
     "Team TT Over", "tracking", "low"),
    ("K6_tt_raise_momentum_over", "TT Raise Momentum Over", "team_total",
     "Team total raised after a big over -> momentum Over.",
     "A team that beat its prior team total (>=10 over) and whose number was then "
     "raised 3+ -> team-total Over.",
     "Hot offenses keep outscoring even a raised number while the public hesitates to "
     "chase.",
     "Team TT Over", "tracking", "low"),
    ("K7_slow_start_dog_fade_1h", "Slow-Start Dog Fade (1H, market)", "h1_spread",
     "Fade the slow-starting dog on the 1H spread.",
     "Underdog with a low first-half points-for average -> favorite 1H spread "
     "(market-only version of M4).",
     "Identifies dogs that consistently trail early without needing the 1H model.",
     "Favorite 1H spread", "tracking", "low"),
    ("K8_primetime_1h_fav", "Primetime 1H Favorite", "h1_spread",
     "Primetime favorite on the 1H spread.",
     "SNF/MNF game with a non-zero spread -> favorite 1H spread.",
     "Favorites come out sharp under the primetime spotlight and build first-half "
     "leads.",
     "Favorite 1H spread", "tracking", "low"),

    # ---------------- team-total trend keepers (TT_TREND_BRIEF, tracking) ----------------
    ("K9_home_tt_high_over", "High Home TT Over", "team_total",
     "Home team total set at 24+ -> home TT Over.",
     "Closing home team-total line >= 24 -> bet the home team total Over.",
     "Home team-total lines run ~0.8-1.1pt soft every season; the bias is largest on "
     "high-line home favorites, so the Over clears 55%.",
     "Home TT Over", "55% / +6% [54,60,51]", "low"),
    ("K10_home_tt_steam_over", "Home TT Steam Over", "team_total",
     "Home team total steamed up open->close -> home TT Over.",
     "Closing home team-total line moved up >= 0.5 from the open -> home TT Over.",
     "Upward home-TT steam confirms the persistent soft-line bias is being corrected "
     "toward, but not all the way to, fair; following it hits ~55%.",
     "Home TT Over", "55% / +6% [54,59,52]", "low"),
    ("K11_home_tt_over_juiced_fade", "Home TT Over-Juiced Fade", "team_total",
     "Market over-juices the home TT Over -> fade to the Under.",
     "Home TT Over price is juiced >3% (implied prob) above the Under -> bet the home "
     "TT Under.",
     "When the book prices the home Over heavily, the public-side number is inflated "
     "and the contrarian Under has cleared 54-55% the last two seasons.",
     "Home TT Under", "55% / +4% [50,59,55]", "low"),
    ("K12_tt_implies_away_cover", "TTs Imply Away Cover", "spread",
     "Team totals imply home less dominant than the spread -> back away ATS.",
     "(home TT - away TT) + close spread <= -1.5, i.e. the team-total split projects a "
     "smaller home margin than the spread -> bet the away side ATS.",
     "A novel cross-market tell: when the two team totals disagree with the spread "
     "about how dominant the home team is, the team totals have been the sharper read "
     "and the away side covers. Small sample (n~45), 2024/25 only.",
     "Away ATS", "60% / +14% [-,57,55] (thin)", "low"),
]

COLS = ["signal_key", "display_name", "market", "one_liner", "definition",
        "why_it_works", "bet_direction", "typical_hit", "default_conviction"]


def load_key():
    for line in (ROOT.parent.parent / ".env.local").read_text().splitlines():
        if line.startswith("SUPABASE_SERVICE_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("SUPABASE_SERVICE_KEY not found in .env.local")


def main():
    rows = [dict(zip(COLS, d)) for d in DEFS]
    keys = [r["signal_key"] for r in rows]
    assert len(keys) == len(set(keys)), "duplicate signal_key"
    print(f"{len(rows)} signal defs")

    key = load_key()
    hdr = {"apikey": key, "Authorization": f"Bearer {key}",
           "Content-Type": "application/json",
           "Prefer": "resolution=merge-duplicates,return=minimal"}
    resp = requests.post(URL + "?on_conflict=signal_key", headers=hdr,
                         json=rows, timeout=60)
    if resp.status_code not in (200, 201, 204):
        sys.exit(f"{resp.status_code} {resp.text[:300]}")
    print(f"upserted {len(rows)} rows -> nfl_signal_defs")


if __name__ == "__main__":
    main()

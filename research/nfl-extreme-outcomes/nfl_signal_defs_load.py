"""Load the NFL signal dictionary into nfl_signal_defs (research Supabase).

One row per rule that can appear in nfl_slate_flags.rule / nfl_slate_picks.signal_keys.
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
     "Our main spread model's pick.",
     "Our main NFL spread model predicts both the final margin and each team's chance "
     "of covering. A pick only fires when BOTH calculations point to the same side "
     "with enough conviction — if they disagree, we show the numbers but make no pick.",
     "Requiring two independent calculations to agree filters out the coin-flip games "
     "and leaves only the spots where the model has a genuine disagreement with the "
     "betting line.",
     "The side the model favors.", "~53% product-style, +CLV", "med"),
    ("mid_fade_good_defense", "Midseason Defense Fade", "spread",
     "Weeks 4-11: bet against the team with the clearly better defense.",
     "We rank every defense by efficiency (points-per-play allowed, adjusted for situation) "
     "entering each week. When one team's defense ranks at least 40 percentile points better "
     "than its opponent's — a top-10 unit against a bottom-half unit, roughly — and it's weeks "
     "4 through 11, we bet the OTHER team against the spread.",
     "Bettors and books lean on a good defense before it has fully earned it. Through midseason "
     "the better-defense team covered only 40-50% of the time (just 40% in weeks 5-8), so "
     "fading it hit 56.1% across eight seasons (2018-2025), profitable in 7 of 8. By late "
     "December the market catches up and this stops working — which is why it is capped at "
     "week 11 and the late-season rules below take over.",
     "Bet the opponent of the better-defense team.", "56.2% ATS / +7.2% ROI (n=349, wk4-11, 7/8 seasons)", "med"),
    ("late_bad_o_vs_good_d_tt_under", "December Wall — Team Total Under", "team_total",
     "Week 12 on: a weak offense running into a top defense -> its team total goes under.",
     "From week 12 through the end of the regular season, when an offense ranked in the bottom "
     "third of the league faces a defense ranked in the top quarter, we bet that offense's "
     "TEAM TOTAL UNDER.",
     "Good defenses genuinely peak in December — top-quarter defenses allow two fewer points "
     "per game late in the year than in October — and weak offenses fade at the same time. "
     "Books adjust the game total for this but not the weak team's individual number enough. "
     "This hit 69.6% over three seasons (69%, 69%, 71% by year), returning +33% per bet. The "
     "same matchup in midseason is a coin flip, so the calendar is the whole edge.",
     "Bet the weak offense's team total UNDER.", "69.6% / +32.8% ROI (n=46, 3/3 seasons 69-71%)", "med"),
    ("late_good_o_vs_bad_d_tt_over", "December Mismatch — Team Total Over", "team_total",
     "Week 12 on: a top offense facing a bottom defense -> its team total goes over.",
     "The mirror image of the December Wall: from week 12 on, when a top-third offense faces a "
     "bottom-quarter defense, we bet the strong offense's TEAM TOTAL OVER.",
     "Bad defenses don't improve late in the year (they allow the same points in December as "
     "in September) while the best offenses hold steady — so the gap between a top offense and "
     "a bottom defense is at its widest exactly when books are shading team totals down for "
     "winter. This hit 64.9% across three seasons (+24% per bet); the same matchup in "
     "midseason is about 54%.",
     "Bet the strong offense's team total OVER.", "64.9% / +23.9% ROI (n=57, 3/3 seasons 59-75%)", "med"),
    ("late_matchup_under", "December Matchup Under", "total",
     "Week 12 on: a top defense against a bottom offense -> the game total goes under.",
     "From week 12 through the end of the regular season, when either team's defense ranks in "
     "the top quarter AND the opposing offense ranks in the bottom quarter, we bet the game "
     "total UNDER.",
     "Late-season games as a whole actually go OVER slightly more than midseason, so 'it's "
     "December, bet unders' is wrong. What's right is the specific matchup: a peaking defense "
     "against a fading offense went under 58.9% of the time over eight seasons (+12.5% per "
     "bet), versus 47% for the same matchup earlier in the year.",
     "Bet the game total UNDER.", "58.9% / +12.5% ROI (n=95, 2018-25)", "med"),
    ("sharp_action_1to3d", "Sharp Money — Midweek", "spread",
     "Professional money moved the line 1-3 days before kickoff; we ride the side it moved toward.",
     "We watch every sportsbook's line all week. This fires when two things happen at once, "
     "one to three days before kickoff: the sharpest books (the ones pros bet into) are "
     "already ahead of the rest of the market on one side, AND at least three books move "
     "their line in that same direction in the same capture. That combination is the "
     "fingerprint of professional money, not public betting. We take that side at the line "
     "when it was detected.",
     "When this fires, the closing line keeps moving toward the sharp side 79% of the time — "
     "the market agrees with it after the fact. Betting it at detection hit 58% against the "
     "spread over five seasons (2021-2025). Midweek sharp money is real but the market still "
     "has days to adjust, which is why this is the weaker of the two sharp-money signals.",
     "Bet the side the sharp money moved toward, at the detected line.",
     "58.2% ATS (n=47, 2021-25); close follows 79%", "low"),
    ("sharp_action_6h", "Sharp Money — Pre-Kickoff", "spread",
     "Professional money hit the line in the final six hours; we ride it.",
     "Same fingerprint as the midweek version — sharp books leading the market AND three or "
     "more books moving the same way in one capture — but detected inside the last six "
     "hours before kickoff. Late sharp money is the most informed money there is: it arrives "
     "after injury reports, weather, and the week's information are all in.",
     "Late sharp action is the strongest version of this signal: the closing line follows it "
     "94% of the time and the side hit 60% against the spread (+14.5% return) across 2021-"
     "2025. It also matches what we found in college football — the final hours are when the "
     "market's smartest money shows up. College football does NOT get this signal: the same "
     "test failed there, so this is NFL-only.",
     "Bet the side the late sharp money moved toward, at the detected line.",
     "60.0% ATS / +14.5% ROI (n=45, 2021-25); close follows 94%", "med"),
    ("legacy_primetime", "Legacy Model — Primetime Follow", "spread",
     "In primetime, follow our older model instead of fading it.",
     "The same previous-generation model as the Legacy Fade — but in primetime games "
     "(Thursday, Sunday, and Monday night) this rule FOLLOWS its pick instead of "
     "betting against it.",
     "The pattern flips under the lights: primetime lines are shaped by a flood of "
     "casual money, and the older model's read has held up in exactly those windows "
     "(61.8% in 2025).",
     "Same side the legacy model favors.", "61.8% [2025]", "high"),
    ("legacy_fade", "Legacy Model Fade", "spread",
     "Bet against our older model when it is overconfident in a daytime game.",
     "WagerProof's previous-generation model still grades every game and rates each "
     "side's chance to cover. When that older model is extremely confident (80%+ on "
     "one side) in a regular daytime game, this rule bets the OPPOSITE side: if the "
     "old model loves the home team, we bet the away team, and vice versa.",
     "At its confidence extremes, the older model is falling for the same obvious "
     "storyline the betting line has already priced in — so its loudest opinions have "
     "been wrong often enough that the other side profits. And the more confident it "
     "is, the better the fade has performed.",
     "Opposite of the legacy model's lean — fade the side it loves.", "~58% backtest", "high"),
    ("fade_pr_in_tight_game", "Fade Power-Rating in Tight Game", "spread",
     "Bet against the 'better team on paper' in a coin-flip game.",
     "In near-pickem games the model fades the side the raw power rating prefers.",
     "Power ratings overstate edges in evenly matched games; the market's tight number "
     "is sharper than the rating gap.",
     "The side the model points to in a near-pickem.", "~64%", "med"),
    ("tight_soft_ml_fade_home", "Tight Soft-ML Fade Home", "spread",
     "Fade the home side when the moneyline is soft in a tight game.",
     "Tight spread + a moneyline that prices the home team softer than the spread "
     "implies -> fade home.",
     "A soft home ML signals the market does not actually trust the home favorite; the "
     "spread is the side to oppose.",
     "Away / fade home", "62% / +18% ROI", "high"),
    ("spread_dog_cover_fade_home", "Dog-Cover Regression: Buy the Home Favorite", "spread",
     "Back a cold home favorite against a hot away dog.",
     "In a home-favorite game where the away underdog has been running hot against the "
     "spread all season (covering by 3+ points per game) while the home favorite has "
     "been running cold (missing by 3+), we BET THE HOME FAVORITE at the opener.",
     "ATS momentum mean-reverts: the dog's cover streak is baked into an inflated line, "
     "and the favorite's cold streak deflates its number — the regression trade is the "
     "home side. ",
     "Bet the HOME favorite.", "~60%", "med"),
    ("spread_dog_cover_fade_away", "Dog-Cover Regression: Buy the Away Favorite", "spread",
     "Back a cold away favorite against a hot home dog.",
     "Mirror spot: the home underdog has been covering by 3+ per game while the away "
     "favorite has been missing by 3+ — we BET THE AWAY FAVORITE at the opener.",
     "Same mean-reversion mechanism as the home variant, road-favorite version "
     "(validated separately, 63-70% on a small early sample).",
     "Bet the AWAY favorite.", "~63-70% (small n)", "med"),
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
     "The home side in a top-vs-top matchup.", "61%", "high"),

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
     "Tight primetime favorite spot; stopped working in 2025, so we track it without betting it.",
     "Tracked to confirm whether the historical primetime-favorite edge re-stabilizes.",
     "Favorite", "regressed 2025", "low"),
    ("primetime_tight_under", "Primetime Tight Under (tracking)", "total",
     "Primetime tight-game Under, on probation.",
     "Under in tight primetime games; stopped working in 2025, so we track it without betting it.",
     "Tracked to see if the low-scoring primetime tendency returns.",
     "Under", "regressed 2025", "low"),
    ("bot_vs_bot_under", "Bottom-vs-Bottom Under (tracking)", "total",
     "Two weak offenses -> Under, on probation.",
     "Both teams rate near the bottom; Under angle, stopped working in 2025, so we track it without betting it.",
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
    ("consensus_totals_HC", "Totals Model (High Conviction)", "total",
     "Our totals model's strongest bets.",
     "Two versions of our points-scored model must independently agree the posted total "
     "is off by 3 to 7 points — big enough to matter, not so big that the market "
     "probably knows something we don't. Only then does this fire.",
     "The sweet spot matters: tiny disagreements are noise, and enormous ones usually "
     "mean the market has information (injuries, weather) the model lacks. In the 3-7 "
     "point band this hit ~57% with +8% returns across four of five seasons tested.",
     "Over or Under, whichever the model says.", "~57% / +8% ROI", "high"),

    # ---------------- props (active, vaulted) ----------------
    ("P11_atd_implied_over", "TD Market Implies More Scoring — Over", "total",
     "The touchdown-scorer market implies more points than the posted total.",
     "Add up every player's chance of scoring a touchdown (from the anytime-TD "
     "market) for both teams and translate that into an expected game total. When "
     "that number beats the posted total by one of the week's biggest margins, bet "
     "the game Over.",
     "The touchdown-scorer market prices scoring on its own, player by player, and it "
     "has led the game total rather than followed it — the biggest gaps hit the Over "
     "58-61% for +11-16% returns.",
     "Over", "58-61% / +11-16% ROI", "med"),
    ("P12_featured_wr_over", "Featured Receiver Yds Over", "player_prop",
     "A star receiver's line is set below what he's actually been doing -> Over.",
     "A high-usage, featured receiver — one of the best separators in the league that "
     "week — has a receiving-yards line at or below what he's averaged over his last "
     "three games. We bet the Over.",
     "One long catch can blow past a receiving line, and big-play receivers deliver "
     "those the most. Books set star receivers' lines cautiously low because casual "
     "bettors hammer the Over anyway — but for THIS profile of player the Over still "
     "wins: 72% and 69% in the two seasons tested, even when graded at the worst "
     "available line.",
     "Receiving yards Over", "65.6% / +22.8% ROI (n=346, 3 seasons: 62/70/66%)", "high"),
    ("P13_featured_rb_over", "Featured Rusher Yds Over", "player_prop",
     "A workhorse back's line is set below what he's been doing -> Over.",
     "A featured, workhorse running back — among the most efficient runners in the "
     "league that week — has a rushing-yards line at or below his last-three-game "
     "average. We bet the Over.",
     "Same idea as the featured-receiver Over: one long run beats the line, and "
     "efficient workhorses break them most often while their lines stay cautious. Hit "
     "82% and 79% in the two seasons tested, on a smaller sample of games.",
     "Rushing yards Over", "65.0% / +22% ROI (n=60, 3 seasons; 2023 weak on tiny n)", "med"),

    # ---------------- props — attempts volume model (nfl-game-script-analysis) ----------------
    ("P14_attempts_model_under", "Volume Model — Attempts Under", "player_prop",
     "Our model projects fewer attempts/carries than the posted line -> Under.",
     "Our computer model predicts how many passes or carries a player will get from "
     "his team's play speed, run/pass mix, the opponent's defense, and how the game is "
     "likely to unfold. When its projection sits 1.5+ below the posted attempts line, "
     "we bet the Under.",
     "The public loves betting Overs, so books nudge volume lines high. Most of the "
     "time the line is still fair — but when our projection says a line is clearly "
     "inflated, the Under has been profitable in both seasons tested: rush attempts "
     "59%, pass attempts 56%.",
     "Rushing/passing attempts Under", "55.1% / +1-5% ROI (n=1482, 3 seasons; 2023 flat — watch)", "med"),
    ("P15_attempts_steam_under", "Attempts Line Jumped — Under", "player_prop",
     "The attempts line rose sharply before kickoff -> fade it to the Under.",
     "A player's pass- or rush-attempts line rose a full attempt or more between "
     "opening and the final pre-kickoff number. We bet the Under at that raised line.",
     "When a volume line jumps, the market is usually overreacting to a storyline "
     "about how the game will go. Fading that jump to the Under has paid in both "
     "seasons tested (rush 60% / +8%, pass 57% / +5%) — and it works independently of "
     "our own model's opinion.",
     "Rushing/passing attempts Under", "56.5% / +1.9% ROI (n=855, 3 seasons: 52/55/62%)", "med"),
    ("P16_attempts_confluence", "Attempts Under — Model AND Market Agree", "player_prop",
     "Our model AND the line movement both say the attempts line is too high -> premium Under.",
     "Two completely independent warnings on the same prop: our model projects the "
     "attempts line as inflated, AND the line itself jumped upward before kickoff. "
     "When both happen at once, we bet the Under.",
     "The numbers and the market movement pointing at the same Under is far stronger "
     "than either alone — this combination hit ~65% for +19% returns in both seasons "
     "tested. It's rare (two things must line up), which is what makes it premium.",
     "Rushing/passing attempts Under", "61.5% / +12.8% ROI (n=340, 3 seasons: 54/62/68%)", "high"),

    ("P17_rush_yds_model_under", "Volume Model — Rush Yds Under", "player_prop",
     "Our model projects a rusher's yards well below the posted line -> Under.",
     "Our computer model predicts a player's rushing yards from his team's play speed "
     "and run rate, the opponent's run defense, and the likely game flow. When the "
     "projection sits 10+ yards below the posted line, we bet the Under.",
     "Rushing-yards lines get pushed high because the public bets Overs. When our "
     "model says a specific line is inflated, the Under has won 58.5% of the time for "
     "+10% returns across both seasons tested.",
     "Rushing yards Under", "58.5% / +10% ROI [55,63]", "med"),
    ("P18_pass_tds_model_over", "Volume Model — Pass TDs Over", "player_prop",
     "Our model projects a QB's passing TDs well above the posted line -> Over.",
     "Our computer model predicts a quarterback's passing touchdowns from his team's "
     "scoring and passing tendencies, the opponent's pass defense, and the likely game "
     "flow. When the projection sits at least half a touchdown above the posted line, "
     "we bet the Over. Rare by design — it fires only 2-3 times a week.",
     "Bettors tend to doubt multi-touchdown games, so books can keep passing-TD lines "
     "a touch low. When our model is confidently high, the Over has won 63-69% for "
     "+5-9% returns in both seasons tested — and the more confident the model, the "
     "better it has done.",
     "Passing TDs Over", "63-69% / +5-9% ROI [67,63]", "high"),

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
     "Receptions Under", "64.4% / +8.4% ROI (n=135, 3 seasons: 70/65/62%)", "low"),

    # ---------------- 1H model (tracking, paper-trade 2026) ----------------
    ("M1_window_over_k1", "1H Over — Model Edge + Hot Team Totals", "h1_total",
     "Our first-half projection beats the posted 1H total, and the team totals agree.",
     "Our first-half scoring projection sits moderately above the posted first-half "
     "total — a healthy gap, not an extreme one — AND the two team scoring lines add "
     "up hot for this game. Both together -> first-half Over.",
     "The model's first-half edge is most reliable in that middle band (huge gaps "
     "usually mean the market knows something), and the hot team totals are an "
     "independent second opinion.",
     "1H Over", "~57%", "med"),
    ("M2_k1_model_lean", "Game Over — Hot Team Totals + Model Lean", "total",
     "Team totals run hot and our first-half projection leans high -> game Over.",
     "The two team scoring lines add up to more than the game total, AND our own "
     "first-half projection also leans above its posted number. Together -> full-game "
     "Over.",
     "Two separate scoring signals — one from the market's own team totals, one from "
     "our model — pointing the same way has historically pushed games Over.",
     "Over", "tracking 2026", "med"),
    ("M3_primetime_fav_tilt", "Primetime 1H Favorite (model-confirmed)", "h1_spread",
     "Back the favorite in the first half of a primetime game, with the model agreeing.",
     "Sunday or Monday night game where our first-half model also leans toward the "
     "favorite -> bet the favorite on the first-half spread.",
     "Favorites tend to start fast under the primetime lights, and requiring the "
     "model's agreement filters the spots where they don't project to.",
     "Favorite 1H spread", "~58%", "med"),
    ("M4_slow_start_dog_fade", "Slow-Start Dog Fade (1H)", "h1_spread",
     "Back the favorite 1H against a chronically slow-starting underdog.",
     "The underdog has averaged few first-half points all season, and our first-half "
     "model agrees the favorite should lead early -> favorite on the first-half spread.",
     "Teams that chronically fall behind early keep doing it — and the first-half "
     "spread cashes on that before late-game backdoor covers can ruin the full-game "
     "bet.",
     "Favorite 1H spread", "~58%", "med"),

    # ---------------- K-signals (tracking, H1TT brief keepers) ----------------
    ("K1_tt_sum_q5_over", "Team Totals Running Hot — Over", "total",
     "Both team totals add up to more than the game total -> Over.",
     "Add up the two individual team scoring lines and compare the sum to the posted "
     "game total. When that gap is among the biggest 20% of the week's games, we bet "
     "the game Over.",
     "The individual team lines and the game total are set separately — when the team "
     "lines together promise more points than the game total does, the team lines "
     "have been the better read.",
     "Over", "~56%", "med"),
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

    # ---------------- streak-fade signals (STREAK*, mined 2026-07 from Discord theories) ----------------
    ("streak_long_under_over", "Long Under-Streak Over", "total",
     "A team riding a long run of unders -> take the Over.",
     "Either team enters on a 6+ game under streak this season (their last six games all "
     "landed under the total) -> bet the game Over. Streaks are within-season and reset "
     "each year, so this can't fire until a team has six games logged (Week 7 on).",
     "A long under run pulls the posted total down faster than the offense actually "
     "regresses, so by the sixth straight under the number is over-shaded low and the Over "
     "clears. Held 59.6% overall and 67.6% since 2019 with no decay -- but it is "
     "low-frequency (~4-5 games a season), which caps it at medium conviction.",
     "Over", "~60% (67% since 2019, ~4-5/yr)", "med"),
    ("streak_both_under_over", "Colliding Under-Streaks Over (tracking)", "total",
     "Both teams on under streaks meet -> Over, tracked only.",
     "Both teams enter the same game on 4+ game under streaks (within-season) -> bet the "
     "Over. Tracked, not bet.",
     "Two cold-totals teams meeting is a stronger version of the long-under-streak Over "
     "(~59%), but only ~29 such games exist in 24 seasons, so it is paper-traded in 2026 "
     "to build sample before it can be bet.",
     "Over", "~59% (thin, n=29)", "low"),
    ("streak_buylow_ncover", "Cold-Team Buy-Low ATS (tracking)", "spread",
     "Back a team that hasn't covered in 5+ straight -> tracked only.",
     "A team enters on a 5+ game non-cover streak this season -> back THEM to cover this "
     "week (the regression / buy-low side). Tracked, not bet.",
     "The market appears to over-fade teams on long non-cover runs, so backing the bounce "
     "looked +EV historically (56% before 2019) -- but it has regressed to a coin flip "
     "lately (51.5% since 2019, 22% in 2025). On probation until a fresh season confirms "
     "it re-stabilizes.",
     "The cold (non-covering) team ATS", "regressed (56% pre-2019 -> 51% since)", "low"),
    ("streak_cold_vs_hot_ats", "Cold Dog vs Hot Team ATS (tracking)", "spread",
     "Cover-streak team vs non-cover-streak team -> back the cold one, tracked.",
     "One team on a 3+ (or 4+) cover streak faces a team on a matched 3+ (4+) non-cover "
     "streak -> back the cold team ATS. Tracked, not bet.",
     "Matched hot-vs-cold streaks showed the cold team covering 56-64%, but the sample is "
     "small (n=36 at the 4+ threshold) and the edge inverts when the hot team is extremely "
     "hot, so it is paper-traded before it can be bet.",
     "The cold (non-covering) team ATS", "56-64% (thin, noisy)", "low"),
    ("div_dog_to_roadfav", "Divisional Dog-to-Road-Favorite (tracking)", "spread",
     "Home underdog in the first division meeting, now a road favorite in the rematch -> back them.",
     "In a division rematch, a team that was a HOME UNDERDOG in the first meeting and is now the "
     "AWAY FAVORITE in the second meeting -> back that team ATS (they are the away side).",
     "A team the market disrespected at home but now installs as a road favorite has genuinely "
     "leapt the opponent in the market's eyes. The rematch covered 61.8% overall (n=34), with the "
     "edge concentrated in teams that WON the first meeting (72%, n=18) vs a coin flip if they lost "
     "it. Very low frequency (~1-2 a season) and thin, so it is paper-traded before it can be bet.",
     "The road-favorite team ATS", "61.8% (n=34; 72% if won g1) -- thin", "low"),
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

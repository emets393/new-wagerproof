# Cursor build prompt — surface the 3 new NFL prop markets + new prop signals (iOS native)

We added **3 new NFL player-prop markets** and **7 new prop signal badges** to the data warehouse.
They already flow into the app's tables (`nfl_dryrun_props`, `nfl_player_prop_trends`) — the props
feed and detail pages render them with **no change** (the data path is market-agnostic). But a few
**hardcoded maps/enums** need the new keys, and — most importantly — the **prop-signal badge
catalog is hardcoded and silently drops unknown flags**, so the new signals won't show until added.

All changes are in **`wagerproof-ios-native/`** (NFL props + Outliers are iOS-native only; the web
`src/` and Expo `wagerproof-mobile/` apps have no NFL props — do not touch them).

## The 3 new markets (all standard Over/Under prop markets)
| dbKey | Label | Unit |
|---|---|---|
| `player_pass_attempts` | Pass Attempts | attempts |
| `player_rush_attempts` | Rush Attempts | carries |
| `player_pass_completions` | Completions | completions |

These are real, bettable prop markets shown as their own cards (line + over/under prices + season
sparkline + signal badges), exactly like Pass Yards / Rush Yards. `player_pass_completions` is
displayed but carries no signal (no validated edge) — that's expected, not a bug.

---

## 1. `WagerproofKit/Sources/WagerproofModels/NFLPlayerProp.swift`
- **`marketOrder`** (~line 349): add the 3 keys so they sort sensibly instead of last (999).
  Suggested order: after `player_rush_yds`, add `player_pass_attempts`, `player_pass_completions`,
  `player_rush_attempts`.
- **`marketLabels`**: already contains all 3 (Pass Attempts / Completions / Rush Attempts) — **no change.**

## 2. `WagerproofKit/Sources/WagerproofServices/NFLTrendsEngine.swift` (Outliers/Trends)
- **`verb(for:)`** (~lines 780–800) — **bug fix.** The Over/Under case lists specific markets; the 3
  new markets fall to `default → "Hit"/"Missed"`. Add all 3 keys to the **Over/Under** case so
  Outlier cards read "Over 7 of last 10" not "Hit 7 of last 10".
- **`marketLabel(_:)`** (~lines 762–778): add explicit cases → "Pass Attempts", "Rush Attempts",
  "Completions" (matching table above).
- **`playerMarkets(for:)`** fallback (~lines 683–688): add the 3 keys (only used when a trends row's
  `markets` column is empty; keep it consistent).

## 3. `WagerproofKit/Sources/WagerproofModels/OutliersTrends.swift`
- **`OutliersTrendsMarketSection.marketOrder`** (~lines 389–394): add the 3 keys so the new Outlier
  sections sort with the other prop markets, not last.
- **`enum OutliersTrendsPropMarket`** (~lines 108–136): add 3 cases (`dbKey` + `label` per the table)
  so they're individually filterable if/when a prop-market picker is exposed (currently the page
  auto-sections by market, so this is forward-proofing — still add them).

## 4. `WagerproofKit/Sources/WagerproofModels/NFLPropSignalDefinitions.swift` — **CRITICAL**
The `catalog` dict currently only defines **P1–P10**. `resolve(_:)` uses `compactMap`, so **any flag
not in the catalog renders NO badge and NO "what is this signal" sheet entry.** We now emit flags
**P12–P18** on prop cards — they will be invisible until added here.

Add catalog entries for each key below, matching the existing `NFLPropSignalDefinition` struct shape
(same fields the P1–P10 entries use — title/short/detail/bet-direction/etc.). Keys are the short
codes stored in the `flags` array (e.g. `"P14"`). Copy to use:

| Key | Title | What it means (plain language) | Bet direction | Track record |
|---|---|---|---|---|
| `P12` | Featured Receiver Yds Over | High-usage receiver (top-quintile NGS separation) whose posted line lags his own recent form → the receiving-yards Over clears. | Receiving yards **Over** | 70.6% / +32% ROI (2 seasons) |
| `P13` | Featured Rusher Yds Over | Workhorse back (top-quintile NGS efficiency) whose line lags his recent form → rushing-yards Over. | Rushing yards **Over** | 80% / +50% ROI (thin sample) |
| `P14` | Volume Model — Attempts Under | Our volume model projects fewer pass/rush attempts than the posted line — volume overs are shaded, so an inflated attempts line is an Under. | Attempts **Under** | rush 59% / pass 56% (both seasons) |
| `P15` | Attempts Steam Under | The attempts line steamed up into the close; fading that over-reaction has cashed the Under. | Attempts **Under** | rush 60% / pass 57% (both seasons) |
| `P16` | Attempts Under — Model + Steam Confluence | **Premium.** Both the volume model AND the line movement independently point to the attempts Under — two unrelated reads agreeing. | Attempts **Under** | ~65% / +19% ROI (thinner) |
| `P17` | Volume Model — Rush Yds Under | The volume model projects a rusher's yards well below the posted line (inflated rushing over). | Rushing yards **Under** | 58.5% / +10% ROI (both seasons) |
| `P18` | Volume Model — Pass TDs Over | The volume model is confidently high on a QB's passing TDs; passing-TD unders are shaded, so the Over clears. The one over-side model edge. | Passing TDs **Over** | 63–69% / +5–9% ROI (both seasons) |

Notes:
- Match the **conviction/tier styling** the existing entries use: treat **P16** as high/premium and
  **P12** as high; **P13/P14/P15/P17/P18** as medium. (P11 is a game-level signal, not a prop flag —
  do NOT add it here.)
- If the struct has a "direction" or "over/under" field used for badge color, set it per the Bet
  direction column (P12/P13/P18 = Over; P14/P15/P16/P17 = Under).

---

## Out of scope (do NOT change)
- **Prop feed filter sheet** (`NFLPropFeed.swift`): already lists all 3 new markets — no change.
- **Prop card / detail / services** (`NFLPropPlayerCard.swift`, `NFLPropDetailView.swift`,
  `NFLPlayerPropsService.swift`, `OutliersTrendsService.swift`, `OutliersTrendsStore.swift`):
  market-agnostic, already render the new markets — no change.
- **Parlay rule** (volume markets must be the only leg from their game): enforced **server-side** in
  the agent engine (`submit_parlay`); the app only displays finished agent parlays, so **no client
  change is needed** for it.
- **web (`src/`) and Expo (`wagerproof-mobile/`)**: no NFL props — leave untouched.

## Acceptance check
1. A `player_rush_attempts` / `player_pass_attempts` card appears in the props feed/detail with a
   readable label and, when flagged, a **P14/P15/P16** badge whose "what is this signal" sheet shows
   the copy above.
2. A `player_rush_yds` card can show a **P17** badge; a `player_pass_tds` card a **P18** badge; a
   featured WR/RB the **P12/P13** badge — none of these render today.
3. Outliers/Trends shows the 3 new markets as sections reading **"Over N of last M"** (not "Hit").

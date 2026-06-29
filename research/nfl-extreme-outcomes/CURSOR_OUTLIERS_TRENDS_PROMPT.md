# Cursor build prompt — Outliers "Trends" page (NFL first; built for all sports)

Build a **filterable, matchup-specific Trends page** in the app's **Outliers tab**. It surfaces
how teams, coaches, referees, and players have performed against betting markets in the
situations relevant to an upcoming game. All data is **pre-aggregated** in Supabase — the app
only reads, filters, sorts, and renders. Match the existing **WagerProof card styling** (reuse
the look of the current trends/game-card components, e.g. NFLGameBottomSheet's trend section).

Only **NFL** has data right now. NCAAF/MLB/NBA/NCAAB tables don't exist yet → those sports must
render a clean empty state ("Trends coming soon"). Build the UI generically so adding a sport later
is just wiring its tables.

---

## 1. Data sources (Supabase — the SAME project the app reads `nfl_dryrun_*` from: `jpxnjuwglavsjbgbasnl`)

All trend tables have **public-read RLS**. Each is a **point-in-time snapshot**; read the most
recent one for the slate's season (dry-run = season 2025, the `through_week = 11` snapshot).

### Upcoming games (the slate) — `nfl_dryrun_games`
Columns you need: `season, week, home_ab, away_ab, fg_spread_close` (signed; **negative = home
favored**), `slot`, `kickoff`, **`assigned_referee`**. One row per upcoming game.

### Subject trend tables (one `splits` jsonb each)
`splits` shape is identical everywhere:
`splits[market][dimension][window] = { h, l, p, n, pct }`
where **h** = "hit" count (cover / win / over), **l** = miss, **p** = push, **n** = h+l (decided),
**pct** = h/n (0–1). The available markets / dimensions / windows DIFFER per subject:

| Table | Key | Markets | Dimensions | Windows | Matchups? | Coverage notes |
|---|---|---|---|---|---|---|
| `nfl_team_trends` | `team_abbr`, `season`, `through_week` | spread, moneyline, total, team_total, h1_spread, h1_total | overall, home, away, favorite, underdog | 3,5,7 | **yes** `matchups[opp_abbr]` (spread/moneyline/total) | season-scoped |
| `nfl_coach_trends` | `coach`, `through_season`, `through_week` | spread, moneyline, total, team_total, h1_spread, h1_total | overall, home, away, favorite, underdog, division, non_division, primetime, regular | 5,10,15 | **yes** `matchups[opp_abbr]` (all markets w/ data) | `market_coverage` jsonb: spread/ml/total=career, team_total/h1_*=2023-2025 |
| `nfl_referee_trends` | `referee`, `through_season`, `through_week` | spread, moneyline, total, h1_spread, h1_total (**no team_total**) | overall, division, non_division, primetime, regular | 5,10,15 | **no** | HOME-framed (see §4); `market_coverage` same split |
| `nfl_player_prop_trends` | `player_id`, `through_season`, `through_week` | player_pass_yds, player_pass_tds, player_receptions, player_reception_yds, player_rush_yds, player_anytime_td | overall, home, away, division, non_division, primetime, regular | 3,5,7 | **yes** `matchups[opp_abbr]` (per prop market, **cross-season** all years) | `coverage='2024-2025'`; `markets` text[] = which markets this player has |

Also present (use for the card header / labels): team `team_name`; coach `coach`, `current_team`,
`career_games`, `market_coverage`; ref `referee`, `career_games`; player `player_name`, `position`,
`current_team`, `markets`.

---

## 2. Matchup → which subjects to show

For a game `{home_ab=H, away_ab=A, assigned_referee=R}`:
- **Teams (2):** `nfl_team_trends` where `team_abbr in (H, A)`.
- **Coaches (2):** `nfl_coach_trends` where `current_team in (H, A)`. **GOTCHA:** multiple coaches can
  share a `current_team` (former coaches whose last team was that team). Pick the **active** one =
  the row with the **greatest `last_season`** for that `current_team` (e.g. DAL → Schottenheimer
  (2025), not McCarthy (2024)).
- **Referee (1):** `nfl_referee_trends` where `referee = R`. If `assigned_referee` is null, omit ref cards for that game.
- **Players (many):** `nfl_player_prop_trends` where `current_team in (H, A)`. Show **top 4 per team**
  by trend strength (§5) with a **"See all players"** expansion to reveal the rest (sorted).

---

## 3. Game context → which dimension to use (the careful part)

We only show the dimension **side that matches this game**, never both. Derive per game:
- **home/away:** team H is `home`, team A is `away`. (For a player, use their team's side.)
- **favorite/underdog:** from `fg_spread_close` (negative = home favored). Home is `favorite` if
  `fg_spread_close < 0` else `underdog`; away is the opposite. (pick'em → spread 0 → skip fav/dog.)
- **division / non_division:** both teams in the same division (use the static map below) →
  `division`, else `non_division`.
- **primetime / regular:** `primetime` if kickoff hour >= 19:00 ET (covers TNF/SNF/MNF), else `regular`.

So for each subject card you display **overall + only the contextual sides that subject supports**:
- **Team card:** overall, (home|away), (favorite|underdog), + H2H vs opponent (`matchups[opp]`).
- **Coach card:** overall, (home|away), (favorite|underdog), (division|non_division),
  (primetime|regular), + H2H vs opponent team (`matchups[opp]`).
- **Referee card:** overall, (division|non_division), (primetime|regular). (No home/away or fav/dog.)
- **Player card:** overall, (home|away), (division|non_division), (primetime|regular), + H2H vs the
  opponent team (`matchups[opp]`, cross-season). (No favorite/underdog for players.)

**Static NFL division map:**
AFC East BUF MIA NE NYJ · AFC North BAL CIN CLE PIT · AFC South HOU IND JAX TEN · AFC West DEN KC LV LAC
· NFC East DAL NYG PHI WAS · NFC North CHI DET GB MIN · NFC South ATL CAR NO TB · NFC West ARI LA SF SEA.

---

## 4. The stat shown per (subject, market, dimension): most-extreme window, flipped to dominant side

For each market+dimension, the splits give up to 3 windows. Produce ONE displayed stat:
1. **Eligible windows:** those with `n >= 2`. If none, skip this market+dimension.
2. **Flip to the dominant side:** for window `w`, `dominant_pct = max(pct, 1 - pct)`. The displayed
   side is the hit side if `pct >= 0.5`, else the miss side; displayed count = `h` if `pct>=0.5` else `l`.
3. **Pick the most extreme window** = the eligible window with the **highest `dominant_pct`**
   (tie-break: larger `n`). This is the card's value for sorting.
4. **Render** `"{verb} {count} of last {n} {context} ({dominant_pct%})"`.

**Verb by market + side** (hit side / miss side):
- spread → "Covered" / "Failed to cover"  (referee: "Home covered" / "Away covered")
- moneyline → "Won" / "Lost"  (referee: "Home won" / "Away won")
- total, team_total, h1_total → "Over" / "Under"
- h1_spread → "Covered 1H" / "Failed to cover 1H"  (referee: "Home covered 1H" / "Away covered 1H")
- player_anytime_td → "Scored" / "Didn't score"; other player props → "Over" / "Under"

`{context}` = the dimension phrased for display: overall→"games", home→"home games", away→"road games",
favorite→"as a favorite", underdog→"as an underdog", division→"division games",
non_division→"non-division games", primetime→"primetime games", regular→"non-primetime games",
matchup→"vs {OPP}".

Examples: DAL spread/home 3-3 → **"Covered 3 of last 3 home games (100%)"**.
Team total over 2/7 (29%) → flipped → **"Under 5 of last 7 games (71%)"**.

For `market_coverage`/`coverage` that is NOT "career" (i.e. 2023-2025 or 2024-2025), show a small
note on those rows/cards (e.g. a "2023–25" chip) so users know the history is limited.

---

## 5. Card structure, sorting, caps

- **Card = one subject + one bet type** (e.g. "Cowboys — Spread", "Bill Vinovich — Total",
  "CeeDee Lamb — Receiving Yards"). Header: subject name/logo (+ position/team for players, +
  career_games for coach/ref). Inside: the contextual dimension rows from §3–4 (overall first,
  then the contextual sides, then H2H if applicable). Optionally show the upcoming line from the
  slate (e.g. `fg_spread_close`) as context.
- **Card trend value** (for sorting) = its single strongest row's `dominant_pct` (tie-break: `n`).
- **Sort:** always by card trend value, **descending**, within the filtered batch.
- **Single matchup selected:** show all qualifying cards for that game (players capped to top 4/team
  + "See all").
- **"All games" selected:** pool every card across the slate, sort by trend value, show the **top ~50**
  with a **"Show more"** to page further.
- **Minimum sample:** a row needs `n >= 2`; a card with no qualifying rows is dropped.

---

## 6. Filtering UX (4 layers, top of page, clean + easy)

1. **Sport:** NFL · NCAAF · MLB · NBA · NCAAB. Non-NFL → empty state for now.
2. **Matchup:** dropdown/segmented list of upcoming games for the sport (from `nfl_dryrun_games`,
   e.g. "PHI @ DAL"), plus **"All games"** (default). 
3. **Subject:** All · Teams · Coaches · Refs · Players.
4. **Bet type — DYNAMIC on subject:**
   - subject ∈ {Teams, Coaches, Refs} (or All non-player) → **game markets:** Spread, Moneyline,
     Total (Over/Under), Team Total (teams only), 1H Spread, 1H Total. (Refs: no Team Total.)
   - subject = Players → **prop markets:** Anytime TD, Rushing Yards, Receiving Yards, Receptions,
     Passing Yards, Passing TDs.
   - subject = All → group results by subject type; each group offers its own applicable bet types.
   Allow "All bet types" within the applicable set.

Filters compose: e.g. Sport=NFL → Matchup=PHI@DAL → Subject=Players → Bet=Receiving Yards shows only
the player receiving-yards cards for that game, sorted by strongest trend.

---

## 7. Notes / dependencies
- **Point-in-time:** read the latest snapshot per table (`nfl_team_trends`: max `through_week` for the
  season; coach/ref/player: max `through_week` for `through_season`). Dry-run = 2025 / week 11.
- **Other sports** tables (`cfb_*`, `mlb_*`, etc.) don't exist yet → guard for missing tables / empty
  results and show the empty state. The schema will mirror NFL when added.
- **Referee assignments:** `nfl_dryrun_games.assigned_referee` is backfilled for the Wk12 dry-run. In
  production the slate builder populates it from the weekly ref-assignment feed; handle null gracefully.
- Everything is read-only from the app; no writes.

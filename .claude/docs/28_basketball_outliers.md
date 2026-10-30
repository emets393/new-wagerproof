# 28 — Basketball Outliers trends (NBA + NCAAB)

> Backend shipped 2026-10-30 (cfb_automation + CFB Supabase project `jpxnjuwglavsjbgbasnl`).
> Web/iOS/Android rendering is **not built yet** — the web Outliers page still hard-codes
> "Trends coming soon" for both leagues. The "For Cursor" section below is the brief.

## What exists

The football Outliers page renders server-built trend cards (`nfl_outliers_trend_cards`,
`cfb_outliers_trend_cards`; engine `research/cfb-model/cfb_outliers_trend_engine.py`).
Basketball now has the same thing, keyed by **slate date** because the sports are daily:

| Table (CFB project) | Rows | Writer |
|---|---|---|
| `nba_games_hist` | every NBA game since 2020-21: final + first-half scores, consensus close in FG spread / total / ML, 1H spread / total / ML, team totals. Spread = HOME line. Team ids = balldontlie | history: `research/bball-odds/export_nba_games_hist.py` (one-off); current season appended daily by cfb_automation `nba_team_trends_daily.py` from `nba_schedule` + `nba_odds_snapshots` (1H scores: hoopR linescores, ESPN summary fallback) |
| `nba_team_trends` | 30 rows per season (PK `season, team_id`): season-to-date record in 7 markets, cross-season `last5_*`, `game_log`, `splits`, `matchups` — the `ncaab_team_trends` / `nfl_team_trends` contract | `nba_team_trends_daily.py`, 6:30am ET |
| `ncaab_team_trends` | 365 D-I teams, same contract (keyed by CBBD `team_id`) — built 2026-10-28 | `ncaab_team_trends_daily.py`, 6:30am ET |
| `nba_outliers_trend_cards` | today's NBA cards | `bball_outliers_cards.py --sport nba` |
| `ncaab_outliers_trend_cards` | today's college cards | `bball_outliers_cards.py --sport ncaab` |

Cards are rebuilt at 6:30am ET (after the trends tables) and again on every run of the hourly
odds cron (7am–10pm ET) so the attached lines stay current. Each run upserts on `card_id`
and prunes today's cards it did not refresh. Migration: `supabase/migrations/20261030150000_basketball_outliers_trends.sql`.

### Card contract (= `nfl_outliers_trend_cards` with `slate_date` instead of `week`)

`card_id, season, slate_date, game_id, espn_game_id, tip_utc, matchup_label, subject_kind ('team'),
subject_name, subject_detail (abbr), team_abbr, team_id, market_key, bet_type_label, trend_value,
trend_sample_n, sort_rank, trend_hit_side, rows jsonb, betting_lines jsonb, betting_lines_updated_at`.

- `game_id` is the id the `/games` feed uses: NBA = balldontlie game id (`nba_input_values_view.game_id`,
  the ESPN id is in `espn_game_id`); NCAAB = `v_cbb_input_values.game_id` (CBBD id).
- `market_key` ∈ spread · moneyline · total · team_total · h1_spread · h1_total; `bet_type_label` is the display name.
- `rows[]` = `{id, text, coverage_note, dominant_pct, sample_n}` — one row per situation tonight's game is in,
  each the team's most-extreme window of the last 3 / 5 / 7, flipped to the dominant side, min 2 games:
  all games · home / road (college: neutral floor) · favorite / underdog (from today's consensus spread) ·
  NBA division or conference game, college conference game · head-to-head vs tonight's opponent
  (cross-season, last 10 meetings). Example: `Under 5 of last 7 road games (71%)`.
- `betting_lines[]` = `{id, label, line_text, odds_text, book_name: "Consensus", book_logo_url: null, team_abbr}`
  — today's consensus for **the side the trend supports** (owner 2026-10-30): a losing / failed-to-cover trend
  attaches the OPPONENT's moneyline or spread (`team_abbr` = the team to bet, which can differ from the card's
  subject), an under trend attaches `Under 221.5`, a team-total under stays on the subject team's own under.
  `trend_hit_side` tells you whether the line backs (true) or fades (false) the subject. No per-book shopping. NBA has no team-total or 1H-moneyline capture in production, so those
  cards carry no line (the trend rows still render).
- Sort: `sort_rank = dominant_pct × 1000 + sample_n`, best first. Teams only — no coach / referee / player cards.

Head-to-head is a **display record, never a signal** (H2H_BRIEF1: no edge vs the close).

## For Cursor — turn the page on (web first, then iOS/Android)

`src/features/outliers/` today: `OUTLIERS_TRENDS_SPORTS = ['nfl','ncaaf','mlb']`, `sportHasTrendsData()` false for
nba/ncaab, `useOutliersTrends.ts` skips the fetch, `OutliersDashboard` renders `ComingSoonCard`. Change:

1. `types.ts` — add `'nba'`, `'ncaab'` to `OUTLIERS_TRENDS_SPORTS` and `sportHasTrendsData`; `allowedSubjects`
   returns `['teams']` for both (no "All" needed — one subject, like MLB).
2. `outliersTrendsService.ts` — `fetchSlateGames('nba' | 'ncaab')`: reuse the existing `/games` adapters
   (`features/games/api/nbaGames.ts`, `ncaabGames.ts`) for today's ET date, mapping to `OutliersTrendsGame`
   (`id` = the feed id above, `awayAb`/`homeAb` = abbr, `season` = END-year, `week` = 0, `kickoff` = tip).
   `fetchPrecomputedCards` for these sports reads `{sport}_outliers_trend_cards` where
   `slate_date = today ET` (not season/week), `order sort_rank desc`. Parsing is identical to the football path
   (same column names); add `TREND_CARD_COLUMNS` for the two new columns if you want `tip_utc` / `team_id`.
3. `useOutliersTrends.ts` — the football branch already does `fetchSlateGames` → `fetchPrecomputedCards`;
   basketball goes through the same branch once (2) accepts the sport.
4. `teamVisuals.ts` — NBA: ESPN logo by abbr (`https://a.espncdn.com/i/teamlogos/nba/500/{abbr}.png`, note
   ESPN uses `gs`, `no`, `ny`, `sa`, `utah`, `wsh` — the map in `nbaGames.ts` already handles it) and NBA team
   colors; NCAAB: `ncaab_team_mapping.espn_team_id` logo (the feed adapter already resolves it) and initials
   from `team_abbrev`. The card's `teamAbbr` is what `teamVisuals(sport, key)` receives.
5. `TodaysMatchupsGrid` — basketball tiles come from the same slate list; deep link `/games?sport=nba|ncaab&game={id}`.
6. Filtering (`filtering.ts`) is sport-agnostic; the matchup pill keys by `matchupKey(sport, id)` as today.
7. Update `src/features/outliers/README.md` (data flow + "coming soon" paragraphs).

Empty states: before a league's first game of the season every `splits` window still has data (cross-season
trailing), so cards exist from opening night; a day with no games has no rows for that `slate_date` — render the
existing empty-slate state, not "coming soon". iOS reads the football tables directly
(`OutliersTrendsService.swift`); the basketball tables use the same shape with a `slate_date` filter.

## Related

- Doc 27 (`27_ncaab_signals.md`) — the college signals + the `ncaab_team_trends` / `ncaab_games_hist` build.
- Doc 23 — NBA props/pipeline contract. `nba_team_trends` is new there; the NBA detail pane can use it for the
  same head-to-head / last-5 sections the college pane has.

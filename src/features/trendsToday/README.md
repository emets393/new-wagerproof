# Today's Betting Trends (`/todays-trends`)

One split-view tool showing **situational betting trends** for today's MLB, NBA
and NCAAB games. Replaces the three per-sport pages
(`MLBTodayBettingTrends.tsx`, `NBATodayBettingTrends.tsx`,
`NCAABTodayBettingTrends.tsx`), which remain on disk but are no longer routed —
`/mlb|nba|ncaab/todays-betting-trends` now redirect to
`/todays-trends?sport=<sport>`.

**These are historical rates, not model projections.** Each number answers "how
often has this team won/covered/gone over when it was in this exact spot before?"

## Layout

Mirrors `/games`: `SplitViewLayout` with a feed on the left and a detail pane on
the right. `/todays-trends` is registered in `SPLIT_VIEW_ROUTES` in `App.tsx`,
without which the page would sit inside the normal padded scroller and lose its
internal scrolling.

URL state is `?sport=all|mlb|nba|ncaab&game=<id>`. `all` is the default — the
feed merges every league into one slate — and the legacy redirects supply an
explicit league so a bookmark still lands where it used to.

## Data model

The three leagues have different schemas, so every adapter normalizes into one
shape (`types.ts`):

- A **`TrendAngle`** is one situational question ("Rest vs opponent") holding
  both teams' rates.
- Every angle exposes a **side** market and a **total** market. MLB's side
  market is the moneyline win rate; NBA/NCAAB's is the ATS cover rate. Both read
  as `sidePct`, which is why one set of widgets serves all three.
- A **`TrendsVerdict`** rolls the angles up: which side more angles favor, which
  way the total leans, and how many angles agree.

| League | Source (fallback) | Joins | Angles |
|---|---|---|---|
| MLB | `mlb_situational_trends_today` (`mlb_situational_trends`) | `mlb_team_mapping` for branding, `mlb_games_today` for first pitch | 7 |
| NBA | `nba_game_situational_trends_today` (`nba_game_situational_trends`) | `nba_input_values_view` for tipoff | up to 6 |
| NCAAB | `ncaab_game_situational_trends_today` (`ncaab_game_situational_trends`) | `v_cbb_input_values` for tipoff **and** `api_team_id`s | up to 6 |

All on `collegeFootballSupabase`. The `_today` views are primary; the full
tables are a date-bounded fallback used only when the view is missing.

NCAAB logos are keyed on `api_team_id` from `v_cbb_input_values`, not on the
trends view's own `team_id` — they aren't the same identifier. NBA logos come
from an ESPN slug map ported out of the legacy page, because
`getNBATeamLogo()` in `utils/teamLogos.ts` is a stub that always returns the
placeholder.

## Consensus rules (ported, do not drift)

Thresholds live in `api/shared.ts` and are copied from the legacy pages; the
sort scores depend on them.

- **Side lean per angle**: higher rate wins, no threshold, `null` on a tie.
- **Total lean per angle**: a rate above 55% is a real lean, 45-55% is weak
  (it can follow a partner but not lead), below 45% is the opposite lean. MLB
  infers "under" from a low over rate because its rows carry no under column;
  hoops test both columns and treat one-team-over / one-team-under as an
  explicit no-consensus.
- **Sort scores**: MLB weights by rate separation only (no records exist to
  weight by); hoops weight by the smaller sample, so a 100%-in-3-games angle
  can't outrank a 62%-in-40-games one.

## Widgets

Follow `src/features/games/detail/WIDGET_DESIGN.md`. One card answers one
question, the recommendation comes before the evidence, OVER is green + up arrow
and UNDER is blue + down arrow on the word itself, the leaning side gets a check
with the other dimmed to ~35%, and rates are bars diverging from a 50% center
line rather than joined sentences.

MLB is the deep treatment (5 cards); NBA/NCAAB reuse the same primitives with
less depth (3 cards).

| Card | Sports | Shows |
|---|---|---|
| ATS/ML trend read | all | The side verdict, an agreement meter over every angle, and both teams' average rates as one opposed bar in team colors |
| Total trend read | all | Over/under verdict, agreement meter, both teams' average over rates against a 50% line |
| Moneyline by situation | MLB | One opposed bar per angle, paged 3 at a time |
| Over rate by situation | MLB | Per-angle over rates diverging from 50%, with that angle's own consensus in the header |
| Today's spots | MLB | The raw situation labels — the condition behind every percentage |
| Situation by situation | NBA, NCAAB | Per-angle ATS comparison **with W-L records** plus the over/under read, paged 2 at a time |

## Files

```
api/          per-league fetchers + the ported consensus/scoring rules
  shared.ts     thresholds, consensus, verdict rollup, sort scores, time parsing
  hoopsShared.ts NBA+NCAAB share one schema; row type and angle builder live here
hooks/        one React Query cache entry per league, merged client-side
components/   feed panel, list card, league picker, skeleton
detail/       detail pane, presentation primitives, per-sport widget sections
feedUtils.ts  league filter + sort + search + date grouping
types.ts      the normalized model
```

`detail/TrendsDetailPane.tsx` imports `useMasonryGrid` from
`@/features/games/detail/` — the packing rule is identical and the hook is
sport-agnostic, so it isn't duplicated.

## Known differences from the legacy pages

- The NBA page fetched its `ats_home_away_*` / `ou_home_away_*` columns but
  never rendered or scored them, while NCAAB did. Both include the angle here;
  an angle with no data on either side is dropped, so NBA loses nothing when the
  columns are empty.
- Rows whose `team_side` is neither `away` nor `home` are dropped for every
  league. The NBA page guarded this; MLB and NCAAB did not.
- A league that fails to load reports inline instead of blanking the feed.

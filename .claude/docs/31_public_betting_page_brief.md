# Public Betting page — Cursor build brief

> **STATUS: PROPOSAL.** The page is not built. The DATA is live and verified
> (`action_public_splits`, hourly capture, seeded 2026-10-20).
>
> Written against the live schema, read back field by field. Where any older doc disagrees
> with this file, this file is right.

## What this page is

Every betting site shows "76% of bets are on the Chiefs" and stops there. This page shows the
percentages for every sport and market we capture — **and reads the three numbers together**
(tickets, money, line movement) to say when the line is following the money instead of the
crowd. That read is the product. The percentages alone are table stakes.

**⛔ The page describes the market. It never issues a pick.** No conviction tier, no units, no
betslip. "Sharp money is on the under" is a description of where the line and the handle are
going. "Bet the under" is a pick, it belongs to the model on `/games`, and the two must never
compete on the same game in public. Same rule as the props page —
see `29_cursor_props_build_brief.md`.

---

## 1. THE SHARP RULE (this is the whole brief)

The signal is a **three-way conjunction**. Any two of them is noise; all three is the read.

1. The **tickets** are heavy on one side (the public side).
2. The other side's **share of the money is bigger than its share of the tickets**.
3. The **line has moved toward that other side.**

### The worked example — build to this exact case

```
Total opened 223.5, now 220.5          ← moved 3 points toward the UNDER
Bets:   80% OVER   /  20% UNDER        ← the public is on the over
Money:  60% OVER   /  40% UNDER        ← the under has 40% of the money on 20% of the tickets

UNDER money share − UNDER ticket share  =  40 − 20  =  +20pp
Line moved toward the UNDER by 3.0 points

=> SHARP MONEY ON THE UNDER
```

Read it in plain English: four times as many tickets are on the over, but the under is pulling
double its ticket share in actual dollars, and the book has dropped the total three points.
The book is moving for the money, not the ticket count. That is fewer, bigger bets on the
under.

### ⛔ Why the existing logic misses this, and must not be copied

`label_splits_team()` in `cfb_automation/scripts/cfb/vsin_nfl_week_to_supabase.py` (which
produces the `spread_splits_label` / `total_splits_label` strings rendered today in
`NflBettingSplitsSection.tsx`) only says "Sharp Money" when the **handle majority crosses to
the other side** — `bets_side != handle_side`. In the example above the money majority is
still on the over (60%), so that function returns **"Public on Over"** and the sharp under is
invisible. A majority test cannot see this; a **share test** can.

Two more things wrong with the old path that this build fixes:

* It ships a **string** ("Sharp Money on Chiefs") that the UI then regexes a percentage back
  out of. This page carries structured numbers and derives the label in the client.
* It is NFL-only and sourced from VSiN. This page is Action Network across four leagues.
  ⚠ Different providers disagree by a few points on the same game, so **label the source in
  the UI** and do not present the two surfaces as the same measurement.

### Definitions, exactly

Per game-market, with two sides — `away`/`home` for spread and ml, `over`/`under` for totals:

```
ticketSide   = side with more bets%          ticketLead = that bets%
moneyTiltSide = side where money% > bets%    tiltPp     = money% − bets% on that side
```

`tiltPp` is symmetric: with two sides summing to 100, a +20 tilt to the under is the same fact
as a −20 tilt to the over. Compute it once, on the side it favours.

### ⛔ Line direction: `away_close` IS NOT THE CURRENT LINE

This was wrong in the first draft of this brief and it is the single easiest way to ship a
page full of fake signals. `away_close` and `home_close` are **best odds across the books for
each side separately** — for a total the over wants the LOWEST number and the under the
HIGHEST, so the two are not the same line and neither one is the consensus. Measured on
tonight's board:

```
Browns @ Titans   total   open 40.5   best 37.5 (over) / 38.5 (under)   ← 1.0 of book spread
Celtics @ Pistons total   open 222    best 220.5     / 221.5            ← 1.0 of book spread
49ers @ Falcons   spread  open −4.5   best −3 (away)  / +3.5 (home)     ← 0.5 of book spread
```

Taking `away_close − away_open` charges that whole cross-book spread to "movement" and tilts
every game toward the over / the away side. **Use the midpoint:**

```
total:   consensus = (away_close + home_close) / 2
         move = consensus − away_open;  POSITIVE = toward the OVER
         (Browns: (37.5+38.5)/2 = 38.0 vs 40.5 ⇒ −2.5, toward the UNDER — not −3.0)

spread:  consensus = (away_close − home_close) / 2        ← home_close is the away number negated
         move = consensus − away_open;  NEGATIVE = toward the AWAY team
         (49ers: (−3 − 3.5)/2 = −3.25 vs −4.5 ⇒ +1.25, toward Atlanta)

ml:      ⛔ NEVER subtract American odds — +105 → −113 moves TOWARD that side but subtracts
         to −218. Convert to implied probability AND strip the vig on both ends, or a
         best-price pair gets compared to a single vigged opener:
           p(odds)  = odds < 0 ? −odds/(−odds+100) : 100/(odds+100)
           openAway = p(away_open)  / (p(away_open)  + p(home_open))
           nowAway  = p(away_close) / (p(away_close) + p(home_close))
           move     = nowAway − openAway        POSITIVE = toward the away side
```

`movedToward` = the side the line moved toward, or `null` when the move is zero or either
end is missing. ⛔ A missing opener is `null`, never `0` — a flat line and an unknown line
are different facts and only one of them is a signal.

### Thresholds — one exported `THRESHOLDS` const, nothing inline

| | value | note |
|---|---|---|
| `HEAVY_TICKETS` | 60% | matches the existing `SPLITS_HEAVY` so the two surfaces agree on what "heavy" is |
| `LEAN_TICKETS` | 55% | matches `SPLITS_LEAN` |
| `EVEN_BAND` | ±5pp | matches `SPLITS_EVEN_EPS` |
| `SHARP_TILT` | 10pp | money share over ticket share on the same side |
| `STRONG_TILT` | 20pp | the worked example sits exactly here |
| `CONFIRM_MOVE` | 0.5 pts (spread/total), 2pp implied (ml) | smallest move that counts as the line following |
| `STRONG_MOVE` | 1.5 pts (spread/total), 5pp implied (ml) | the example's 3.0 clears this |
| `MIN_TICKETS` | 200 | below this the percentages are three people, not a market |
| `MIN_MINORITY` | 15% | the quiet side must hold at least this share of TICKETS |

### ⛔ Two gates without which this fires on two thirds of the board

Measured against tonight's live 84-game board: the rule as first written produced a tier-1 or
tier-2 candidate on **54 of 84 games (64%)**. A signal that fires on two thirds of a slate is
decoration. With both gates below it produces **5 tier-1 and 5 tier-2 across 84 games (6%)**,
which is what a signal looks like.

1. **Moneyline is excluded from tiers 1-4 — display only.** 44 of those 54 false positives
   were `ml`. The ML public sits on favourites, so ticket splits run 1/99 and 3/97, and a
   single large dog bet then reads as a 70pp "money tilt". `Old Dominion @ LA Tech` tonight:
   4% of tickets, 79% of the money. That is one bet, not sharp action. Render the ml
   percentages and the rail; never label it sharp.
2. **`MIN_MINORITY`: the quiet side needs ≥15% of the tickets.** This kills the degenerate
   end of the same problem — at 1/99 the tilt measure has no floor under it. The worked
   example's under sits at 20% and clears it comfortably.

---

## 2. The tier ladder

Evaluate top to bottom, first match wins. Every tier renders a chip AND a sentence with the
real numbers substituted in. Vocabulary is deliberately the same as the existing widget's
("Sharp Money on…", "Consensus on…", "Public on…", "Slight Lean", "Even Split") so a user
seeing both surfaces sees one language.

| # | Tier | Trigger | Chip | Sentence template |
|---|---|---|---|---|
| 1 | **Sharp money** | `ticketLead ≥ HEAVY` on A · `tiltPp ≥ SHARP_TILT` on B · `movedToward = B` · `moveSize ≥ CONFIRM_MOVE` | `Sharp Money on {B}` — strongest emphasis | "{bets}% of bets are on {A}, but {B} is taking {money}% of the money on {betsB}% of the tickets — and the {market} has moved {open} → {current}. The line is following the money, not the tickets." |
| 1b | **Sharp money, strong** | tier 1 plus `tiltPp ≥ STRONG_TILT` and `moveSize ≥ STRONG_MOVE` | same chip, flagged `strong` | same sentence; the strong flag drives emphasis and sort, not different copy |
| 2 | **Money diverging** | `ticketLead ≥ HEAVY` on A · `tiltPp ≥ SHARP_TILT` on B · line flat, unknown, or moved toward A | `Money on {B}` | "{bets}% of bets are on {A}, but {B} has {money}% of the money. The line hasn't moved for it yet." (or "…and the line has moved the other way.") |
| 3 | **Consensus steam** | `ticketLead ≥ HEAVY` on A · money also on A · `movedToward = A` · `moveSize ≥ CONFIRM_MOVE` | `Consensus on {A}` | "Bets and money are both on {A} ({bets}% / {money}%), and the line has moved with them, {open} → {current}." |
| 4 | **Public, line resisting** | `ticketLead ≥ HEAVY` on A · money also on A · `movedToward = B` | `Public on {A}` + `line moving away` | "{bets}% of bets and {money}% of the money are on {A}, but the line has moved toward {B}." |
| 5 | **Public** | `ticketLead ≥ HEAVY` on A, nothing else | `Public on {A}` | "{bets}% of bets are on {A}." |
| 6 | **Slight lean** | `ticketLead ≥ LEAN` | `Slight Lean to {A}` | "{bets}% of bets are on {A} — a mild lean." |
| 7 | **Even** | both sides inside `EVEN_BAND` | `Even Split` | "The money and the tickets are split." |
| — | **No data** | `has_split = false`, `tickets < MIN_TICKETS`, or the minority ticket side below `MIN_MINORITY` | — | excluded from the feed entirely, see §4 |

⛔ **Tiers 1-4 are spread and total only.** Moneyline rows render their percentages and their
rail like any other market but never receive a tier — see the gate in §1.

**Tier 1 is the headline of the whole page.** The feed's default sort is: tier rank, then
`tiltPp` descending, then `moveSize` descending — deterministic, no magic score. A "Sharp
money only" filter is a first-class control, not a nice-to-have.

Tiers 2 and 4 are the two cases people routinely mislabel as sharp action. Keep them
distinct: tier 2 is money ahead of the line, tier 4 is the line moving against a one-sided
public without the handle backing it.

---

## 3. Where the data is

**CFB** Supabase instance (`VITE_CFB_SUPABASE_URL`), via
`src/integrations/supabase/college-football-client.ts` — same client as `/games` and
`/todays-trends`. Not main.

`action_public_splits` is written hourly by GitHub Actions
(`research/action-splits/snapshot_action.py`), Action Network, **NFL · CFB · NBA · NCAAB**.
No MLB — do not build an MLB chip.

**⛔ It is a CHANGE LOG, not a board.** A row exists only when that game-market moved since
the last capture. Never read the raw table for the page.

| column | |
|---|---|
| `game_id`, `market` | the key. `market` is `'spread' \| 'total' \| 'ml'` |
| `sport` | `'nfl' \| 'cfb' \| 'nba' \| 'ncaab'` |
| `season`, `week`, `slate_date`, `start_time`, `game_type` | `week` is null for basketball; `season` is the END year for basketball (tonight's NBA = 2027), unshifted for football |
| `away`, `home` | feed display names, trimmed |
| `bets_away/home`, `money_away/home` | the percentages, 0-100 — **tickets and money** |
| `away_open`, `home_open` | the opener (AN book 30) |
| `away_close/home_close`, `away_price/home_price` | best odds across real books at capture time; `*_price` is null on every `ml` row by design |
| `tickets` | ticket count, climbs to kickoff |

**⛔ ORIENTATION: the away slot is the AWAY TEAM for spread/ml and the OVER for totals.**
`bets_away` on a total row means bets on the over. Get this backwards and every total on the
page inverts with nothing erroring.

### Prerequisite — the page cannot read this yet

RLS is on with one `mcp_explorer` policy, so **the anon web key sees ZERO rows** — the same
trap as `avatar_picks` in `18_agent_consensus.md`. Do not work around it client-side and do
not apply DDL yourself. This view needs to exist first (Claude applies it; it belongs in
`scripts/sql/`):

```sql
create or replace view public.action_public_splits_board as
with latest as (
  select distinct on (game_id, market) *
  from public.action_public_splits
  order by game_id, market, snap_ts desc
)
select game_id, market, sport, season, week, slate_date, start_time, game_type,
       away, home, snap_ts,
       away_open, home_open, away_close, home_close, away_price, home_price,
       bets_away, bets_home, money_away, money_home, tickets,
       -- ⛔ A 0 or 100 on either side is NO DATA, not unanimity. Citadel @ Texas A&M read as
       -- "100% on the under" until someone looked. Every consumer gates on this.
       (bets_away is not null and bets_home is not null
        and bets_away not in (0, 100) and bets_home not in (0, 100)) as has_split
from latest
where start_time > now() - interval '4 hours';
-- grant select to anon; the raw log stays anon-invisible
```

The page reads `action_public_splits_board` only.

---

## 4. Traps that will silently wreck this

1. **0% / 100% is NO DATA.** Gate on `has_split`, and exclude those rows from the feed rather
   than greying them out. A 0/100 row rendered as a bar is a fabricated 100% consensus.
2. **Thin markets.** `tickets < MIN_TICKETS` are excluded the same way. Small-conference CFB
   games post with a few hundred tickets and will otherwise dominate any tilt sort.
3. **Null opener ≠ flat line.** No opener means no direction. `null`, not `0`.
4. **American odds don't subtract.** See the `ml` rule in §1.
4b. **`*_close` is a best price per side, not the line.** Use the midpoint, per §1. Skipping
   this charges the cross-book spread to "movement" and biases every game toward the over and
   the away side — the Browns total reads as a 3.0-point move instead of its real 2.5.
5. **One line basis.** The open and current values here are Action Network's. `/games` uses
   The Odds API, and the NFL splits label on the game card comes from VSiN. Label the source
   on this page, never compute a gap between an AN number and one of ours, and ⛔ never render
   the AN price as bettable or attach a betslip link — every line we bet or grade comes from
   The Odds API.
6. **Basketball season label** is the end year. An NBA filter built on `season = 2026` returns
   nothing tonight.

---

## 5. The page

Route **`/public-betting`**, nav label **"Public Betting"**.

Structural template is `/todays-trends` — read `src/features/trendsToday/README.md` first,
then mirror it:

* `SplitViewLayout`, feed left, detail right.
* **Register the route in `SPLIT_VIEW_ROUTES` in `src/App.tsx`** — without it the page sits
  in the padded scroller and loses internal scrolling.
* Add to `src/nav-items.tsx`.
* New module `src/features/publicBetting/` with `api/`, `hooks/`, `components/`, `detail/`,
  `types.ts`, `signals.ts`, `signals.test.ts`, and a `README.md` (required by CLAUDE.md,
  written in the trendsToday voice: what it does, where the data is, what must not drift).
* React Query, one query for the slate, filtered client-side. Do not fetch per card.

### Getting the latest pull, per sport / per game / per market

The capture is a change log, so "the current board" is **the newest row per
`(game_id, market)`** — that is exactly what `action_public_splits_board` returns, one row
per game-market, already deduped by the view's `distinct on`. So:

* **One query, no filters beyond ordering**, e.g. `.from('action_public_splits_board')
  .select('*').order('start_time')`. Sport and market filtering happens client-side from that
  single result — the whole board across four leagues is a few hundred rows.
* ⛔ **Never read `action_public_splits` itself**, and never do the latest-per-key reduction in
  the client. The log holds every historical capture; a client-side `max(snap_ts)` would pull
  the entire season to render tonight's board and would get slower every week.
* **Reshape into games, not rows.** The view returns up to three rows per game (spread,
  total, ml). Group by `game_id` into one object per game holding a `markets` map, and treat a
  missing market as absent rather than empty — plenty of games have a spread and total but no
  ml, and basketball posts all three. The feed card renders the selected market; the detail
  pane renders whichever exist.
* **`snap_ts` is per row**, so a game's three markets can have been captured at different
  times. Show the newest of them as the game's "captured {relative} ago", and never average
  them.
* React Query: `staleTime` 5 minutes, `refetchOnWindowFocus` on. The writer runs hourly, so
  anything tighter is wasted requests and anything looser shows a stale board to someone who
  left the tab open.

**All tier logic and all direction logic lives in `signals.ts`** with tests beside it. Vitest
is wired; `src/utils/unitsCalculation.ts` has 28 tests for exactly this reason — a single sign
flip once inverted every bet in an NBA grader.

Required cases. The first five are **real rows off the live board on 2026-10-20**, so they are
fixtures, not invented numbers — copy them verbatim:

| case | row | expected |
|---|---|---|
| tier 1, total | `cfb` Indiana @ Michigan · bets `84/16` · money `64/36` · open `52.5` · best `41.5/41.5` | tier 1, **Sharp Money on the Under**, `tiltPp 20`, `move −11.0`, strong |
| tier 1, spread | `nfl` 49ers @ Falcons · bets `70/30` · money `41/59` · open `−4.5` · best `−3/+3.5` | tier 1, **Sharp Money on Atlanta**, `tiltPp 29`, `move +1.25` |
| tier 1, small move | `nfl` Browns @ Titans · bets `77/23` · money `63/37` · open `40.5` · best `37.5/38.5` | tier 1, Under, `move −2.5` — ⛔ **not** −3.0, which is the dispersion bug |
| tier 2 | `cfb` Houston @ Utah · bets `68/32` · money `42/58` · open `6.5` · best `6.5/−6.5` | tier 2, money on Utah, `move 0` |
| tier 4 | `cfb` Ole Miss @ Texas · bets `85/15` · money `74/26` · open `8.5` · best `3.5/−3` | tier 4 — money tilts to Texas, line moved 5.25 toward Ole Miss |
| ml never sharp | `cfb` Old Dominion @ LA Tech · bets `4/96` · money `79/21` | **no tier** — ml is display-only |
| minority floor | any `spread` with bets `3/97` and a 20pp tilt | **no tier** — fails `MIN_MINORITY` |
| null opener | `away_open = null` | `movedToward = null`, no tier 1/3/4 |
| no data | `bets_away = 0, bets_home = 0` | excluded from the feed |
| ml direction | Celtics/Pistons ml · open `+105/−125` · best `−113/+102` | `movedToward = 'away'` — the case naive subtraction gets backwards |

**URL state:** `?sport=all|nfl|cfb|nba|ncaab&market=spread|total|ml&tier=sharp|all&game=<game_id>`.
Defaults `all` / `spread` / `all`.

**Filters:** sport pills, market pills, and a tier filter with "Sharp money only" as the
first option. ⛔ Build the sport pills from the sports present in the response, not a
hardcoded list — NCAAB has no rows until November and a dead chip returning an empty board
reads as a broken page.

**Feed card:** sport chip · `Away @ Home` · start time · the tier chip · and the hero, which
is the divergence graphic below.

**Detail pane:**
1. Header: teams, start time, ticket count, "Action Network · captured {relative time}".
2. All three markets stacked (spread, total, ml), each with both bars, both percentages, and
   open → current with the arrow. The filtered market is expanded; the others collapse.
3. The tier sentence from §2, in full, as the explanation — this is the "tell them what it
   means" layer and it is written copy, not a research string.
4. A short static "how to read this" block explaining tickets vs money in two sentences.

**Empty states** are first-class: out of season, nothing with usable splits yet, and July
(nothing on any board).

### The graphics

Three visuals, and they are the page. Inline SVG and CSS — **no chart library for these**;
Recharts is in the stack but these are 40px-tall primitives and a chart lib will fight you on
every one of them. Reuse the colours already in the codebase so this page matches `/games`:
`TOTAL_LINE_COLOR = '#10b981'` for the OVER and `'#3b82f6'` for the UNDER (both from
`NflBettingSplitsSection.tsx` / `shared/lineMovement.ts`), and `team.colors.primary` from
`TeamRef` for spread and ml sides.

**1. The divergence bar** — the signature. Two full-width stacked bars sharing one axis:
tickets on top, money underneath, each split left/right at its own percentage, each segment
in its side's colour. Because they share the axis, the two split points not lining up IS the
signal, visible as a step before anyone reads a number. Draw a faint 50% centre tick behind
both. Then the part that makes it read instantly: **fill the gap between the two split points
with a translucent wedge in the colour of the side the money favours.** A game with no
divergence has no wedge; the worked example has a fat under-blue wedge 20pp wide. Percentages
sit at the outer ends in `tabular-nums`.

**2. The line-move rail** — a short horizontal axis with the opener as a hollow marker, the
current as a filled one, and an arrow between them, **coloured to the side the line moved
toward**. Label it `223.5 → 220.5`. A null opener renders the current value alone with no
arrow and no rail; it must not look like a flat line.

**3. The confirmation glyph** — ⛔ this is the one idea the whole design rests on: **the
wedge and the arrow are the same colour exactly when the line is following the money.** That
is the sharp read, shown rather than asserted. When tier 1 fires, put the wedge and the rail
adjacent on the card so the colour match is unmissable, and give the tier-1 chip a subtle
ring in that same colour. A reader should be able to spot tier 1 while scrolling, without
reading a word.

House rules: dark mode via the existing theme tokens, legible at phone width (the bars go
full-width and the rail wraps beneath), `font-variant-numeric: tabular-nums` everywhere a
percentage or a line sits in a column, and any transition respects
`prefers-reduced-motion`. The bars may animate their width on mount; nothing else animates.

**Access:** percentages free, the tier chips and sentences Pro-gated via the existing
`ProGate` / `useAccessControl`. ⛔ Gating is three independent layers — route wrapper, client
check, DB policy — and missing one gives a silent paywall bounce. This view is anon-readable
by design, so the gate here is client-side only and must not be described as security.

---

## 6. Out of scope for v1

* **iOS and Android.** Separate native codebases, separate work. Do not claim parity.
* **MLB.** Not captured.
* **The hourly arc.** The capture log can show *when* the money arrived and when the line
  moved, which is the natural v2 — a sparkline per market. It needs its own game-scoped view;
  do not widen the board view for it.
* **Any pick, grade, or record.** See the spine. Measured historical performance of these
  patterns lives in `research/action-splits/README.md` and is not rendered on the page.

## Definition of done

* `/public-betting` renders NFL, CFB and NBA off `action_public_splits_board`, filterable by
  sport, market and tier.
* The §1 worked example produces `Sharp Money on the Under` on a real card.
* `signals.test.ts` covers every case listed in §5 and passes.
* `npm test` green, `npm run build` clean.
* `src/features/publicBetting/README.md` written.
* No card states or implies a side to bet.

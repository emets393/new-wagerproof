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
popular = side with more bets%        lead   = that bets%
quiet   = the other side
moneySide = side where money% > bets%  tiltPp = money% − bets% on that side
```

`tiltPp` is symmetric: with two sides summing to 100, a +20 tilt to the under is the same fact
as a −20 tilt to the over. Compute it once, on the side it favours.

### ⛔ Line direction: use `away_cons`, NOT `away_close`

This was wrong in the first two drafts of this brief, and the owner caught it off the output:
it was producing **3.25-point spreads**, which no book has ever posted.

`away_close` and `home_close` are **best odds across the books, per side** — on a total the
over wants the lowest number and the under the highest — so the two sides hold different
values and neither is a line. Averaging them recovers the *centre of the cross-book spread*,
which lands on quarter points and is not a thing you can bet.

**`away_cons` / `home_cons` are the line**: Action Network's consensus book (15), carrying the
real posted half-point number — and it is the same book the ticket and money percentages come
from, so the splits and the line finally describe the same market. Verified on a full board:
252 of 252 rows carry one and **none is off the half-point grid**. What the midpoint was
doing to five of eight sampled games:

```
49ers @ Falcons    spread   open −4.5   real −3.5    midpoint said −3.25   ✗
Browns @ Titans    spread   open +2.5   real −1.5    midpoint said −1.75   ✗
Browns @ Titans    total    open 40.5   real 38.5    midpoint said 38.0    ✗
Tennessee @ S.Car  spread   open −2.5   real +2.5    midpoint said  2.25   ✗
Indiana @ Michigan total    open 52.5   real 41.5    midpoint said 41.5    ✓
```

So movement is **consensus minus opener, both real lines**:

```
spread:  move = away_cons − away_open;   NEGATIVE = toward the AWAY team
         (49ers −4.5 → −3.5 ⇒ +1.0, toward Atlanta)
total:   away is the OVER, so POSITIVE = toward the OVER
         (Browns 40.5 → 38.5 ⇒ −2.0, toward the UNDER)
ml:      away_cons holds the consensus PRICE (on a moneyline the price is the line).
         ⛔ NEVER subtract American odds — +105 → −113 moves TOWARD that side but subtracts
         to −218. Strip the vig off both ends and compare probabilities:
           p(odds)  = odds < 0 ? −odds/(−odds+100) : 100/(odds+100)
           openAway = p(away_open) / (p(away_open) + p(home_open))
           nowAway  = p(away_cons) / (p(away_cons) + p(home_cons))
           move     = nowAway − openAway        POSITIVE = toward the away side
```

`*_close` / `*_price` keep their own job: **the best price a bettor can actually get right
now**, which is worth showing beside the consensus line and is never used for movement.

`movedToward` = the side the line moved toward, or `null` when the move is zero or either end
is missing. ⛔ A missing opener is `null`, never `0` — a flat line and an unknown line are
different facts and only one of them is a signal.

### Gates — a row that fails any of these is EXCLUDED from the feed, not greyed out

| gate | why | effect on a real 168-row spread+total board |
|---|---|---|
| `has_split` false (0% or 100% either side) | that is NO DATA, not unanimity. Citadel @ Texas A&M read as "100% on the under" until someone looked | 33 dropped |
| `tickets < 200` | the percentages are a handful of people, not a market | 0 tonight, but small-conference games need it |
| `market = 'ml'` **and** minority ticket side < 15% | ⛔ **moneyline only.** The ML crowd piles onto favourites, so splits run 1/99 and one large dog bet fakes a 70pp divergence — `Old Dominion @ LA Tech`: 4% of tickets, 79% of the money. ⚠ This floor used to apply to every market and was wrongly dropping 25 legitimate 10/90 and 12/88 football games | ml rows only |

### Thresholds — one exported `THRESHOLDS` const, nothing inline

| | value | note |
|---|---|---|
| `DIVERGE_TILT` | 10pp | money share minus ticket share on the same side |
| `STRONG_TILT` | 20pp | drives emphasis and sort, not a different label |
| `HEAVY_TICKETS` | 60% | ⛔ **only used to describe the crowd**, never to gate the money read |
| `LEAN_TICKETS` | 55% | the mild-lean LABEL inside `split`. Also never a gate |
| `CONFIRM_MOVE` | 0.5 pts (spread/total), 2pp implied (ml) | below this the line has not moved |
| `STRONG_MOVE` | 1.5 pts (spread/total), 5pp implied (ml) | emphasis only |
| `MIN_TICKETS` | 200 | the one volume guard |
| `ML_MIN_MINORITY` | 15% | moneyline only, per the gate above |

### ⛔ THE TICKET COUNT GATES NOTHING

This was the structural bug in the first version, and the owner caught it off the screen:
every category that mentioned money sat behind `ticketLead >= 60`, so the divergence test was
nested inside the crowd-intensity test. Any game with a merely mild crowd could not report a
money divergence of **any** size — it fell through to "Slight Lean", which named the TICKET
side. The bigger the divergence on a mildly-split game, the more confidently wrong the label.

Live failures before the fix, all on one board:

```
Boise State @ Washington St  spread  tickets 52/48  money 15/85  → 37pp  called "EVEN SPLIT"
USC @ Wisconsin              total   tickets 59/41  money 37/63  → 22pp  called "Slight Lean to the OVER"
Oklahoma @ Mississippi St    spread  tickets 59/41  money 42/58  → 17pp  missed by ONE point of lead
Duke @ Virginia              spread  tickets 44/56  money 59/41  → 15pp  called "Slight Lean to Virginia"
```

Boise State is the worst case the old design could produce: **the single largest divergence on
the board, 85% of the handle on 48% of the tickets, labelled "Even Split."**

So: **the ticket lead only decides how the sentence describes the crowd.** It never decides
whether the money read is reported. A 52/48 split with 85% of the money on one side is the
strongest read on the board, because it is large bets against small ones with no crowd noise
in the way.

## 2. The categories

```ts
// measures
popular   = bets_away >= bets_home ? 'away' : 'home'   // where the TICKETS are
quiet     = the other side
lead      = max(bets_away, bets_home)
tiltPp    = |money_away − bets_away|
moneySide = money_away > bets_away ? 'away'
          : money_away < bets_away ? 'home' : null      // null only on an exact match

// ⛔ a move under CONFIRM_MOVE is NOT a move. Collapse it once, here, so no category
// has to re-check the size.
effectiveMove = moveSize >= CONFIRM_MOVE ? movedToward : null

diverging = moneySide === quiet   && tiltPp >= DIVERGE_TILT   // money on the quiet side
piling    = moneySide === popular && tiltPp >= DIVERGE_TILT   // money ON the popular side
```

First match wins. ⛔ **Categories 1-5 are spread and total only** — a moneyline row skips to 6.

### When the money disagrees with the crowd

| # | key | fires when | chip | sentence |
|---|---|---|---|---|
| 1 | `sharp_money` | `diverging` and `effectiveMove === quiet` | **Sharp Money on {quiet}** — loud | "{leadPct}% of bets are on {popular}, but {quiet} is taking {moneyPct}% of the money on {betsPct}% of the tickets — and the {market} has moved {open} → {cons}. The line is following the money, not the tickets." |
| 2 | `money_no_move` | `diverging` and `effectiveMove === null` | Money on {quiet} | "{quiet} has {moneyPct}% of the money on {betsPct}% of the tickets. The line hasn't moved for it yet." |
| 3 | `line_fights_money` | `diverging` (so the line moved toward `popular`) | Line fighting the money | "The money leans {quiet}, but the {market} has moved toward {popular}, {open} → {cons}." |

### When the money agrees with the crowd

| # | key | fires when | chip | sentence |
|---|---|---|---|---|
| 4 | `hammered` | `piling` and `effectiveMove === popular` | Hammered on {popular} | "{popular} is taking {leadPct}% of the bets and an even bigger {moneyPct}% of the money, and the line has moved with it." ⛔ Copy must make clear this is the PUBLIC with volume, not sharp action — it is the category most easily mistaken for #1 |
| 5 | `public_loading` | `piling` **and** `effectiveMove !== quiet` | Public loading up on {popular} | "{popular} has {leadPct}% of the bets and {moneyPct}% of the money. The line hasn't followed." |
| 6 | `consensus` | `lead >= HEAVY` and `effectiveMove === popular` | Everyone on {popular} | "Bets and money are both on {popular} ({leadPct}% / {moneyPct}%), and the line moved with them, {open} → {cons}." |
| 7 | `line_pushes_back` | `effectiveMove === quiet` and the money is NOT on the quiet side (so: `lead >= HEAVY`, **or** `piling` — a book fading heavy money is the more useful read than "the line hasn't followed") | Line pushing back | "{leadPct}% of bets and {moneyPct}% of the money are on {popular}, but the line moved toward {quiet}." |
| 8 | `public` | `lead >= HEAVY` | Public on {popular} | "{leadPct}% of bets are on {popular}." |
| 9 | `split` | anything left | Split, **or "Leaning {popular}"** when `lead > LEAN_TICKETS` | even: "The money and the tickets are split." · leaning: "Bets lean {popular} ({leadPct}%) and the money agrees. Nothing unusual." |

⛔ **Three ordering decisions, resolved here so they are not re-litigated in code:**

1. **`hammered` outranks `consensus`.** Money piling ≥10pp onto the popular side *with* the
   line following is strictly more specific than "bets and money agree", so it wins. The
   copy must still say plainly that it is the public with volume, not sharp action.
2. **`line_pushes_back` outranks `public_loading`.** When the money is piling onto the
   popular side and the line moves *against* it anyway, the book fading heavy money is the
   more useful read than "the line hasn't followed yet". This is why #5 carries the
   `effectiveMove !== quiet` guard.
3. **`split` names a mild lean.** On a 57/43 board with no divergence, "Split" is wrong.
   `LEAN_TICKETS: 55` returns to `THRESHOLDS` for this one purpose — a label, never a gate.

### Emphasis, sort, and the one that must stay quiet

```
loud    sharp_money
medium  money_no_move, hammered
quiet   line_fights_money, public_loading, consensus, line_pushes_back, public
none    split
```

Sort: `sharp_money` first by `tiltPp` desc, then `money_no_move`, then `hammered`, then the
rest by `tiltPp` desc. "Sharp money only" stays a first-class filter.

⛔ **`line_pushes_back` must be a muted chip.** It is what most sites sell as "reverse line
movement" and it is the single **biggest** category on a real board — 38 of 168 rows, 23%.
Something that common is a description, not an alert, and dressing it up is how this page
would start lying.

### What a real board looks like

Measured 2026-10-20, 84 games, spread+total only. Use this as a smoke test — if your
distribution is wildly different, a gate or a sign is wrong:

```
line_pushes_back   38      public              14
(excluded)         33      public_loading      11
consensus          31      sharp_money          8
split              24      line_fights_money    6
                           hammered             2
                           money_no_move        1
```


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
| `away_cons`, `home_cons` | ⛔ **THE CURRENT LINE** — consensus book (15), a real posted number, and the book the percentages come from. Price, not value, on `ml` rows |
| `away_cons_price`, `home_cons_price` | the price at that consensus line (null on `ml`, where the price *is* the line) |
| `away_close/home_close`, `away_price/home_price` | best odds across real books at capture time; `*_price` is null on every `ml` row by design |
| `tickets` | ticket count, climbs to kickoff |

**⛔ ORIENTATION: the away slot is the AWAY TEAM for spread/ml and the OVER for totals.**
`bets_away` on a total row means bets on the over. Get this backwards and every total on the
page inverts with nothing erroring.

### The board view — live, and the only thing the page reads

`action_public_splits` itself has RLS with one `mcp_explorer` policy, so **the anon web key
gets ZERO rows from the table** — the same trap as `avatar_picks` in `18_agent_consensus.md`.
The view below is what anon can read, and it is live (verified: 252 rows / 84 games on the
anon key, `[]` from the raw log). ⛔ Do not work around RLS client-side and do not apply DDL
yourself — ask. The definition, for reference, is `scripts/sql/action_public_splits_board.sql`:

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
4b. **`*_close` is a best price per side, not the line — use `*_cons`.** Movement comes from
   the consensus book, per §1. Computing it off `*_close` charges the cross-book spread to
   "movement" and puts quarter-point lines on screen; no book posts a 3.25 spread.
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

**All category logic and all direction logic lives in `signals.ts`** with tests beside it. Vitest
is wired; `src/utils/unitsCalculation.ts` has 28 tests for exactly this reason — a single sign
flip once inverted every bet in an NBA grader.

Required cases. The first five are **real rows off the live board on 2026-10-20**, so they are
fixtures, not invented numbers — copy them verbatim:

| case | row (real, off the 2026-10-20 board) | expected |
|---|---|---|
| `sharp_money`, total | `cfb` Indiana @ Michigan · bets `83/17` · money `64/36` · line `52.5 → 41.5` | **Sharp Money on the Under**, `tiltPp 19`, `move −11.0`, strong |
| `sharp_money`, mild crowd | `cfb` Boise State @ Washington St · bets `52/48` · money `15/85` · line `−16.5 → −13` | **Sharp Money on Washington St**, `tiltPp 37`. ⛔ The regression case: the old rule called this "Even Split" |
| `sharp_money`, spread | `cfb` Duke @ Virginia · bets `44/56` · money `59/41` · line `6.5 → 1.5` | **Sharp Money on Duke** — fires on a 56% crowd, which the old rule could not |
| `sharp_money`, small move | `nfl` Browns @ Titans · bets `77/23` · money `62/38` · line `40.5 → 38.5` | Sharp Money on the Under, `move −2.0` |
| ⛔ no quarter points | any row | every rendered line is a whole or half point. A `.25` means movement came off `*_close` instead of `*_cons` |
| `money_no_move` | `cfb` Houston @ Utah · bets `69/31` · money `47/53` · line `6.5 → 6.5` | **Money on Utah**, line hasn't moved |
| `line_fights_money` | `cfb` Oklahoma @ Mississippi St · bets `59/41` · money `42/58` · line `−1.5 → −4.5` | **Line fighting the money** — money on Miss St, line moved toward Oklahoma |
| `hammered` | `nfl` Bengals @ Ravens · bets `73/27` · money `87/13` · line `3.5 → 3` | **Hammered on Cincinnati** — ⛔ asserts this is NOT `sharp_money`; the money is piling onto the popular side |
| `line_pushes_back` | `cfb` Army @ Tulsa · bets `9/91` · money `10/90` · line `50.5 → 54.5` | **Line pushing back** — 91% on the under, total rose 4 points |
| sub-threshold move | `diverging` with a 0.25-point move | `money_no_move`, NOT `sharp_money` — `effectiveMove` collapses it to null |
| ml never sharp | `cfb` Old Dominion @ LA Tech · bets `4/96` · money `79/21` | skips 1-5 entirely, and is excluded by `ML_MIN_MINORITY` |
| ml floor is ml-only | any `spread` with bets `12/88` | ⛔ **NOT excluded** — this floor applies to moneyline only |
| null opener | `away_open = null` | `movedToward = null` ⇒ `money_no_move` / `public`, never `sharp_money` |
| no data | `bets_away = 0, bets_home = 0` | excluded from the feed |
| ml direction | Celtics/Pistons ml · open `+105/−125` · cons `−113/+102` | `movedToward = 'away'` — the case naive subtraction gets backwards |

⛔ **Smoke test the distribution**, not just the units. The §2 table has a real board's
counts; `sharp_money` on 8 of 168 rows is right, dozens means a gate is missing, and zero
means `away_cons` is null (the writer must have run before the consensus fix).

**URL state:** `?sport=all|nfl|cfb|nba|ncaab&market=spread|total|ml&signal=sharp|all&game=<game_id>`.
Defaults `all` / `spread` / `all`.

**Filters:** sport pills, market pills, and a signal filter with "Sharp money only" as the
first option. ⛔ Build the sport pills from the sports present in the response, not a
hardcoded list — NCAAB has no rows until November and a dead chip returning an empty board
reads as a broken page.

**Feed card:** sport chip · `Away @ Home` · start time · the category chip · and the hero, which
is the divergence graphic below.

**Detail pane:**
1. Header: teams, start time, ticket count, "Action Network · captured {relative time}".
2. All three markets stacked (spread, total, ml), each with both bars, both percentages, and
   open → current with the arrow. The filtered market is expanded; the others collapse.
3. The category sentence from §2, in full, as the explanation — this is the "tell them what it
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
is the sharp read, shown rather than asserted. When `sharp_money` fires, put the wedge and the rail
adjacent on the card so the colour match is unmissable, and give that chip a subtle
ring in that same colour. A reader should be able to spot `sharp_money` while scrolling, without
reading a word.

House rules: dark mode via the existing theme tokens, legible at phone width (the bars go
full-width and the rail wraps beneath), `font-variant-numeric: tabular-nums` everywhere a
percentage or a line sits in a column, and any transition respects
`prefers-reduced-motion`. The bars may animate their width on mount; nothing else animates.

**Access:** percentages free, the category chips and sentences Pro-gated via the existing
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
  sport, market and category.
* The §1 worked example produces `Sharp Money on the Under` on a real card.
* `signals.test.ts` covers every case listed in §5 and passes.
* `npm test` green, `npm run build` clean.
* `src/features/publicBetting/README.md` written.
* No card states or implies a side to bet.

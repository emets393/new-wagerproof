# Cursor prompt — Public Betting page

Paste everything below the line into Cursor. The full spec is
`.claude/docs/31_public_betting_page_brief.md`, which is current and authoritative.

---

⚠ **State of the tree before you start.** Claude has already changed four files in
`src/features/publicBetting/` — `types.ts`, `api/groupBoard.ts`, `signals.ts` and
`signals.test.ts` — to fix a separate bug (quarter-point lines) and to start the
categorization change below. The module compiles and **34 of 39 tests pass**. The 5 red
tests are red *on purpose*: they assert the old seven-tier behaviour. Your job includes
bringing them in line with §2, not reverting to make them green. Nothing else in the module
was touched, so the components, filters and graphics are untouched Cursor work.

The categorization on the Public Betting page is wrong and needs replacing. **Re-read
`.claude/docs/31_public_betting_page_brief.md` — §1 and §2 have been rewritten — and bring
`signals.ts` in line with it.** Where anything you already built disagrees with that file,
the file wins.

## What's wrong

Every category that mentioned money was gated behind a heavy ticket majority (`lead >= 60`),
so the money read was nested inside the crowd read. A game with a mild ticket split could not
report a money divergence of **any size** — it fell through to "Slight Lean", which named the
**ticket** side. So the larger the divergence on a mildly-split game, the more confidently
wrong the label got. Real failures off one board:

```
Boise State @ Washington St  tickets 52/48  money 15/85  → 37pp   called "EVEN SPLIT"
USC @ Wisconsin              tickets 59/41  money 37/63  → 22pp   called "Slight Lean to the OVER"
Oklahoma @ Mississippi St    tickets 59/41  money 42/58  → 17pp   missed by ONE point of lead
Duke @ Virginia              tickets 44/56  money 59/41  → 15pp   called "Slight Lean to Virginia"
```

Boise State is the worst the old design could do: the single biggest divergence on the board —
**85% of the handle on 48% of the tickets** — labelled "Even Split."

## The fix, in one sentence

⛔ **The ticket count gates nothing.** It only decides how the sentence describes the crowd.
A 52/48 ticket split with 85% of the money on one side is the strongest read on the board,
because it is big bets against small ones with no crowd noise in the way.

## The nine categories

Full trigger conditions, chip labels and sentence templates are in §2 of the brief. The shape:

**Money disagrees with the crowd** (the quiet side's share of the money exceeds its share of
the tickets by 10pp or more):

1. `sharp_money` — and the line moved toward it. All three agree. The loud chip.
2. `money_no_move` — the line hasn't moved yet.
3. `line_fights_money` — the line moved the other way.

**Money agrees with the crowd:**

4. `hammered` — money piling onto the popular side, line following. ⛔ Copy must make clear
   this is the public with volume behind it, NOT sharp action. It is the one most easily
   mistaken for #1.
5. `public_loading` — same piling, line hasn't followed.
6. `consensus` — bets and money together, line moved with them.
7. `line_pushes_back` — lopsided bets and money, line moved the other way anyway.
8. `public` — lopsided bets, nothing else notable.
9. `split` — nothing to say. Say nothing.

First match wins. **Categories 1-5 are spread and total only**; a moneyline row skips to 6.

Three things in §2 that are easy to miss and change the output:

- `effectiveMove` collapses any move under `CONFIRM_MOVE` to `null` **once**, so no category
  re-checks the size. A 0.25-point move is not a move.
- `piling` (money onto the *popular* side) is a different thing from `diverging` (money onto
  the *quiet* side) and must not fall into the same branch. Both can exceed 10pp.
- ⛔ `line_pushes_back` gets a **muted** chip. It is what most sites sell as "reverse line
  movement" and it is the single biggest category on a real board — 38 of 168 rows, 23%.
  Something that common is a description, not an alert.

## Gates

A row failing any of these is **excluded from the feed**, not greyed out: either side at 0%
or 100% (that is no data, not unanimity), or under 200 total tickets.

⛔ One gate changed: the "minority side needs 15% of the tickets" floor is now **moneyline
only**. It exists because the ML crowd piles onto favourites, splits run 1/99, and one large
dog bet fakes a 70pp divergence. Applied to every market it was wrongly dropping 25
legitimate 10/90 and 12/88 football games.

## Data reminders

- Read `action_public_splits_board` (live: 252 rows / 84 games, anon-readable). Never the raw
  `action_public_splits` log, and never reduce latest-per-key in JS.
- ⛔ **`away_cons`/`home_cons` are the current line** — the consensus book's real posted
  number. `away_close`/`home_close` are *best odds per side* and cannot be averaged into a
  line; doing so puts quarter-point spreads on screen. Movement is `cons − open`.
- The away slot is the away team for spread/ml and **the OVER for totals**.

## What is already done, and what is left

**Done** (verify, don't redo): `away_cons`/`home_cons` flow from the view through
`BoardRow` → `MarketInput` → `lineDirection`, the two midpoint calculations are gone, and
`MarketRead.tier` is now `MarketRead.category: PublicCategory | null` with an `emphasis`
field. `THRESHOLDS` is renamed per §1.

**Left to you:**

1. The 5 failing tests in `signals.test.ts`, which encode the old ladder. §2 now resolves
   the three ordering questions they hit — `hammered` outranks `consensus`,
   `line_pushes_back` outranks `public_loading`, and `split` names a mild lean via
   `LEAN_TICKETS`. Implement those three and align the tests.
2. `THRESHOLDS.LEAN_TICKETS` needs adding back (label only, never a gate) for the mild-lean
   case in category 9.
3. Every case in §5, as real fixtures.
4. The UI: chip emphasis from `CATEGORY_EMPHASIS` (⛔ `line_pushes_back` renders muted), the
   signal filter, the sort by `CATEGORY_RANK`, and the detail-pane sentences.

## Tests first

§5 of the brief lists the required cases and they are **real rows off the live board**, not
invented numbers — including Boise State as an explicit regression test, and `hammered`
asserting it is *not* `sharp_money`. Get `signals.test.ts` passing before touching the UI.

Then smoke-test the distribution, not just the units. On a real 84-game board, spread+total:

```
line_pushes_back 38    public            14      sharp_money         8
(excluded)       33    public_loading    11      line_fights_money   6
consensus        31                              hammered            2
split            24                              money_no_move       1
```

`sharp_money` on 8 of 168 rows is right. Dozens means a gate is missing. Zero means
`away_cons` is null, which means the capture ran before the consensus fix.

## Done when

Every case in §5 passes, the distribution above roughly reproduces, Boise State @ Washington
St shows **Sharp Money on Washington St** instead of "Even Split", no `.25` line appears
anywhere, `npm test` is green and `npm run build` is clean.

Ask me before applying any SQL, adding a dependency, or touching anything outside
`src/features/publicBetting/`, `src/App.tsx` and `src/nav-items.tsx`.

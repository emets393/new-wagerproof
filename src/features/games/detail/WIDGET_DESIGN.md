# Detail-pane widget design rules

The conventions the MLB widgets were rebuilt around. Apply these to every sport's
sections so `/games` reads as one product rather than five.

Source of truth for examples: `sections/mlb/` (`shared.tsx`, `MlbMarketSection.tsx`,
`MlbSignalsSection.tsx`, `MlbProjectedScoreSection.tsx`).

## 1. One card answers one question

A widget that shows a score *and* a moneyline pick *and* a total pick is three
widgets. Split it. Use a `SegmentedControl` in the card's `accessory` when the
same question has two scopes (Full Game / 1st 5) — one answer on screen at a time,
never both stacked.

Watch for the same content appearing twice in a stack. MLB rendered its F5 panels
inside Projected Score *and* in a separate First-Five Splits card.

## 2. Recommendation first, evidence after

Order inside a card is always:

1. **The pick** — largest thing in the card. Team logo (38px), pick at `text-xl`
   bold, edge right-aligned. Market name is a `9px` uppercase caption above it,
   not a heading.
2. **The verdict** — is this pick actually good? (`HitRateMeter`)
3. **The comparison** — model vs Vegas, with the lean spelled out.
4. **The evidence** — history, collapsed by default.

## 3. Never nest more than one surface

`WidgetCard` already provides a surface. Do **not** put a bordered/tinted box
inside it, and never a box inside that box. Separate sections with
`divide-y divide-black/5 dark:divide-white/10` or a `border-t`, not containers.

MLB was three surfaces deep (`WidgetCard` → `INNER_PANEL` → `CONTEXT_BOX`) and
the regression widget added a duplicate title inside its inner box.

## 4. Every card says what it is

Pass `subtitle` to `WidgetCard`: one plain-language line naming what the user is
looking at and why it matters. Avoid internal vocabulary — "Tier", not "bucket";
"Agrees with model", not "Aligns".

## 5. Visuals over text

- Two numbers that should be compared → **one divided bar**, not two sentences.
- A rate that has a threshold → **a meter with the threshold marked**
  (`HitRateMeter` ticks break-even at 52.4%; below it a "winning" record still
  loses money).
- Signed values across rows → **diverging bars from a center zero line**
  (`TrendStatRow`), so red/green reads before any number does.
- Never emit a bullet-joined sentence of stats
  (`Tue • 103-117 • 46.8% W • -3.68% ROI`). Give each value a column.

## 6. Teams are logos + abbreviations, and large

Logos at 28-38px with the abbreviation always present (fall back to the abbrev on
the club's primary color when a logo 404s). Use real team colors, never hardcoded
blue/red.

**Mark the pick explicitly**: check mark, full opacity, and dim the other side to
~35%. "Who's favored" and "where the model disagrees with the market" are
different questions — a 62% favorite can be the side the model fades.

## 7. Over/Under always carries color + direction

Green + `ArrowUp` for OVER, blue + `ArrowDown` for UNDER — on the pick word
itself, not only on the number beside it. Applies to pick strings parsed out of
text too (see `PickText` in `MLBRegressionPicksForGame`).

## 8. Progressive disclosure for supporting data

History and breakdown tables collapse by default behind a disclosure that
**summarizes while closed** ("2/3 profitable"), so it isn't a blind door.
Expanded, lead with a line explaining what's being shown.

## 9. Long lists paginate, they don't scroll sideways

Full-sentence content in a horizontal scroller forces truncation and hides how
much is left. Use a fixed row window + HeroUI `Pagination`, and pad short pages to
the full height so the pager doesn't jump. See `MlbSignalsSection` (4 rows).

## 10. Derived numbers must reconcile with what's displayed

If a card shows model %, Vegas %, and an edge, the three must agree exactly.
Derive Vegas as `model − edge` rather than de-vigging raw odds — a marginally
more "correct" number that visibly contradicts the headline is worse than a
consistent one. (Also: F5 has no book moneyline on the row, so deriving is the
only approach that covers both scopes.)

## 11. Theme-safe always

No `text-white` / `bg-slate-950` / `text-slate-400`. Use `foreground`,
`muted-foreground`, `muted`, and `bg-black/[0.02] dark:bg-white/[0.03]`. Several
widgets were written for a dark surface and broke in light mode.

## 12. HeroUI: where it earns its place

`Chip` (tones map to verdicts), `Pagination`, `Tabs`, `Tooltip`. **HeroUI ships no
charts** — use Recharts (already a dependency) with HeroUI chrome, which is what
HeroUI's own docs examples do.

Pinned to `@heroui/react@2.7.11`, the last release whose `@heroui/theme` supports
Tailwind 3. Its plugin does *not* redefine `primary`/`secondary`/`foreground`/
`background` — verified by diffing a pre/post CSS build.

## Gotchas

- `onChange={setX}` breaks generic pills. `Dispatch<SetStateAction<T>>` accepts
  `T | ((prev) => T)`, so `T extends string` infers a function type and collapses
  to `string`. Wrap it: `onChange={(v) => setX(v)}`.
- Hooks must precede early returns. Adding `useState`/`useMemo` to a component
  that early-returns on a guard means the memo has to yield an empty value
  instead of being skipped.
- `[&>span:last-child]:truncate` in the sidebar/widget base styles targets the
  last span child — a trailing `<span>` badge steals truncation from the title.
- Typecheck with `npx tsc --noEmit -p tsconfig.app.json`. The root `tsconfig.json`
  has `"files": []` and checks **nothing**, always exiting 0.

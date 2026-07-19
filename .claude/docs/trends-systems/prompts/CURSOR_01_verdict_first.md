# Cursor prompt — Phase 1: verdict-first reframe of Historical Analysis (web)

> Copy everything below the line into Cursor. It is presentation-only and testable immediately with
> `npm run dev` — no backend, RPC, or data changes.

---

## Context

We're evolving WagerProof's Historical Analysis pages toward a "Systems"-style, single-verdict experience
(background: `.claude/docs/trends-systems/00`–`04`). Today a single query dumps ~15–24 numbers at once
(headline + breakdown bars + by-team/coach/referee tables), which reads as cluttered. This task is the first,
purely-visual step: **lead with ONE clear verdict, and move every breakdown behind a collapsed expander
(progressive disclosure).** Do not change any filters, data fetching, RPC calls, or bet-type logic.

## Files

- Pilot on **`src/pages/NFLAnalytics.tsx`** ONLY for this task. (CFB `src/pages/CFBAnalytics.tsx` and MLB
  `src/pages/MLBAnalytics.tsx` will get the identical treatment in a follow-up once we approve the NFL look.)
- Reuse the app's existing UI primitives / design system and dark-mode support already used on the page.

## What to change (NFL page only)

1. **Hero verdict.** Keep the existing headline content (the summary sentence + record + ROI + coverage span
   + baseline + significance/thin-sample treatment) but present it as the visual anchor of the result:
   - Make the hit-rate % the dominant element; keep the one-sentence context (e.g. "Home favorites covered
     **55.7%**, **+6.4u ROI**, over 70 games · 2018–2025").
   - Keep the coverage line ("N games, season range") and baseline comparison directly under it.
   - Preserve all existing color/threshold logic and the thin-sample / significance labels exactly.
2. **Collapse the breakdowns.** Everything that is currently rendered *below* the headline and *above* the
   "this week's games that match" section — i.e. the breakdown **bars** (home/away, fav/dog, over/under) AND
   the **by-team / by-coach / by-referee** sortable tables — must move inside a single, clearly-labeled,
   **collapsed-by-default** expander, e.g. a button reading **"Explore the breakdown ▾"**. Expanding it shows
   exactly today's content, unchanged (same bars, same sortable tables, same behavior). Collapsing hides it.
3. **Keep "This week's games that match"** where it is and visible (do not hide it behind the expander).

## Hard constraints

- **Presentation only.** Do not touch: the RPC calls, `p_filters` construction, bet-type switching, the
  filter sidebar/controls, debounce, or any data shape. No changes to `src/features/analysis/*` or any
  service/hook.
- **Preserve the hard-won UX rules** already in the page: no scroll-jump on filter change (keep results
  mounted + dimmed during refetch, never unmount to skeleton), signed spreads, unambiguous labels.
- Keep it accessible (the expander is a real button, keyboard-toggleable, aria-expanded).
- Don't triplicate yet — NFL only. We'll extract a shared component when we replicate to CFB/MLB.

## Run & hand-off

- Run `npm run dev` and leave it running so I can review at the NFL analytics route before anything is
  committed.
- **Do NOT commit, push, or open a PR.** Leave all changes in the working tree for me to test first.
- When done, tell me: the exact route to open, and a 3–5 line summary of what changed.

## Acceptance checklist

- [ ] NFL result leads with a single dominant verdict (hit% + record + ROI + span + baseline + significance).
- [ ] Breakdown bars + by-team/coach/referee tables are hidden by default, revealed by one expander.
- [ ] "This week's games that match" still shows below, unchanged.
- [ ] Filters, bet-type switching, and refetch behavior are untouched; no scroll-jump.
- [ ] Sanity: no-filter `fg_spread` still shows overall ≈ 50%, favorites cover ≈ 49%.
- [ ] `npm run dev` is running; nothing committed or pushed.

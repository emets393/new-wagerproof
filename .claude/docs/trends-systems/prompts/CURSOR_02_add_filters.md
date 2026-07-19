# Cursor prompt — Phase 2: add the as-of Systems filters (web, NFL pilot)

> Copy below the line into Cursor. The backend is LIVE — the RPC now accepts all these params, so the
> filters will actually return data. Testable with `npm run dev`.

---

## Context

The `nfl_analysis` RPC (warehouse project `jpxnjuwglavsjbgbasnl`) was just extended with ~40 new
season-to-date "as-of-game" filter parameters (win%, ATS%, over%, streaks, PPG/PA, prior-year,
head-to-head). They're documented in `.claude/docs/trends-systems/05_LIVE_FILTER_KEYS.md` (the exact
`p_filters` keys + meanings) and named per `.claude/docs/trends-systems/02_FILTER_TAXONOMY_OURS.md`. Your
job: add UI controls for these on the NFL analytics page and wire them into the existing `p_filters` object.

## File

- **`src/pages/NFLAnalytics.tsx`** ONLY (CFB page gets the same treatment after we approve NFL).

## What to add — new filter groups (match our taxonomy names in doc 02)

Add these as new labeled filter groups alongside the existing ones (Situation / Matchup / Weather / Last
game). Each control sets the corresponding `p_filters` key from doc 05. Use the page's existing control
primitives (range sliders, dual-thumb ranges, tri-state toggles, the same styling as current filters).

1. **Season Record** — win% range (`win_pct_min/max`), win/loss streak ranges (`win_streak_min/max`,
   `loss_streak_min/max`), "Winning record" toggle (`above_500`), "Win% better than opponent"
   (`win_pct_gt_opp`), PPG / PA / point-diff ranges (`ppg_*`, `pa_pg_*`, `point_diff_pg_*`).
2. **Cover Profile** — ATS win% range (`ats_win_pct_min/max`), ATS win streak (`ats_win_streak_min/max`),
   avg cover margin range (`avg_cover_margin_min/max`).
3. **Total Profile** — over% range (`over_pct_min/max`), over/under streak ranges (`over_streak_min/max`,
   `under_streak_min/max`).
4. **Prior Year** — last-season wins range (`prev_wins_min/max`), last-season win% range
   (`prev_win_pct_min/max`), "Made playoffs last year" toggle (`made_playoffs_prev`), "More wins than
   opponent last year" (`more_wins_than_opp_prev`).
5. **Head-to-Head** (last meeting vs this opponent) — tri-state toggles: won last meeting (`h2h_last_win`
   1/0), covered (`h2h_last_ats_win`), went over (`h2h_last_over`); boolean toggles: was home
   (`h2h_last_home`), was favorite (`h2h_last_fav`), same season (`h2h_same_season`); spread comparison:
   lower/higher than last meeting (`h2h_spread_lower` / `h2h_spread_higher`).
6. **Opponent** add-ons (optional, in the Opponent area): `opp_win_pct_*`, `opp_over_pct_*`,
   `opp_win_streak_*`, `opp_prev_win_pct_*`.

Also add a small **"Min games this season"** control (`min_games`) in Season Record — it guards thin
early-season samples.

## Wiring rules

- Follow the EXISTING pattern in the file for building `p_filters` (only include a key when the user has
  set it; omit otherwise). Add matching state + reset + active-filter chips + saved-snapshot fields exactly
  like the current filters (so Save/Reset/share keep working).
- Percent controls: show as 0–100% in the UI but send 0–1 to the RPC (e.g. UI 60% → `win_pct_min: 0.6`).
- Keep the debounce, no-scroll-jump, and dimmed-refetch behavior. Don't touch the RPC, the result
  rendering, or the verdict-first layout from Phase 1.
- These filters apply to all bet types (they describe the situation, not the market) — show them for every
  bet type, same as the existing Situation filters.

## Run & hand-off

- Run `npm run dev`, leave it running. **Do NOT commit or push** — leave changes in the working tree.
- Tell me the route to open and a short summary. Call out any control where the RPC key was ambiguous.

## Acceptance checklist

- [ ] New groups (Season Record, Cover Profile, Total Profile, Prior Year, Head-to-Head) render with working
      controls.
- [ ] Setting each control changes results (e.g. win% ≥ 70% shrinks the sample; H2H "won last meeting"
      filters to a smaller set).
- [ ] Percent controls send 0–1 to the RPC; ranges send `_min`/`_max`; toggles send booleans / 1|0.
- [ ] Save / Reset / active chips include the new filters.
- [ ] Phase-1 verdict-first layout, debounce, and no-scroll-jump are intact.
- [ ] `npm run dev` running; nothing committed.

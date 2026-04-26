# MLB Signals — Adding & Maintaining Signals

This is the playbook for adding, modifying, and tracking custom MLB signals that surface in the app's game cards, the WagerBot chat, and the daily regression report.

## What is a "signal"

A signal is an actionable observation about a game — something a sharp bettor would notice. Examples:
- "Pitcher's xFIP has dropped 0.6 over last 3 starts"
- "Bullpen has thrown 18 IP in 3 days — fatigue risk"
- "Team won G1 by 8+ as a moderate favorite — historical sweet spot"

Signals are stored as JSON objects with three keys: `category`, `severity`, `message`. They're rendered as colored pills on game cards and described in plain English in the LLM-narrated parts of WagerBot and the daily report.

## Architecture (where signals live)

| Component | Path | Role |
|---|---|---|
| **Definition table** | `mlb_signal_definitions` (CFB project) | One row per signal: key, category, severity, label, description, threshold, etc. Drives the legend/educational UI. |
| **Stats table** | `mlb_signal_stats` (CFB project) | Lifetime + L90 W/L/ROI per signal. Refreshed nightly. |
| **Stats refresh fn** | `public.refresh_mlb_signal_stats()` | Recomputes stats from `mlb_game_log`. Run by `pg_cron` job `refresh_mlb_signal_stats_daily` at 10:00 UTC. |
| **The view** | `mlb_game_signals` (CFB project) | Reads today's slate + the signal definitions/stats and emits per-game `home_signals`/`away_signals`/`game_signals` JSON arrays. |
| **Web FE** | `src/pages/MLB.tsx`, `src/pages/MLBDailyRegressionReport.tsx` | Renders signal pills on game cards and as a section on the report page. |
| **Mobile FE** | `wagerproof-mobile/app/(drawer)/(tabs)/mlb-regression-report.tsx` | Mobile equivalent. |
| **WagerBot** | `supabase/functions/wagerbot-chat/tools/get_mlb_predictions.ts` | Passes the signals array to the LLM as part of game context. |

## The full process for adding a NEW signal

### Step 1 — Research the pattern (off-platform)

Run analysis SQL against `mlb_game_log` (CFB project) to validate:
- The condition you're testing for (e.g., "team won G1 by 8+ as moderate fav")
- Win % and ROI of betting that direction
- Sample size and year-by-year stability

Document the rule precisely:
- Bet target (which team is the SUBJECT — the team the signal is about)
- Filter conditions (margin, ML range, series position, etc.)
- Direction: positive (back the subject) or negative (fade the subject)

### Step 2 — Add the signal definition

```sql
INSERT INTO public.mlb_signal_definitions
  (signal_key, category, severity, label, description, metric, threshold_value, threshold_dir, min_games, is_active, notes)
VALUES
  ('your_signal_key', 'series', 'positive',
   'Human Readable Label',
   'One-paragraph description with the historical numbers — used in the legend UI.',
   'metric_used', 8, 'gt', 0, true,
   'Internal note explaining the exact filter conditions');
```

`signal_key` must be unique. Categories currently in use: `pitcher`, `bullpen`, `batting`, `schedule`, `weather`, `park`, `series`. Add new categories sparingly.

### Step 3 — Update `refresh_mlb_signal_stats()` to grade it

Edit the `candidates` CTE inside the function — add a new `CASE WHEN ... THEN 'your_signal_key' END AS sNN` line that captures the same filter as your view CASE branch will use. Make sure to:
- Add it to both the SELECT in `candidates`
- Add it to the `unnest(ARRAY[s1,s2,...])` in the `fires` CTE

After editing, run the function once: `SELECT public.refresh_mlb_signal_stats();` and confirm the new row appears in `mlb_signal_stats`.

### Step 4 — Add the signal to the view

In `mlb_game_signals`, add a CASE branch in BOTH `home_signals` and `away_signals` ARRAY constructors (mirror logic on the home/away side). The branch needs:

- A series-position gate if it's a G2 or G3 signal:
  - G2: `g2h.g2_margin IS NULL` (only one prior game)
  - G3: `g2h.g2_margin IS NOT NULL` (two prior games)
- The actual filter conditions (margin, ML, etc.) on `g1h.g1_margin` / `g1h.g1_ml`
- Reference `ss.your_stat_columns` for the dynamic numbers in the message

Update the `sig_stats` pivot CTE to expose `win_pct`, `roi_pct`, `total_picks` for your new signal. Pattern:

```sql
MAX(CASE WHEN signal_key='your_signal_key' THEN win_pct END)::numeric AS your_win,
MAX(CASE WHEN signal_key='your_signal_key' THEN roi_pct END)::numeric AS your_roi,
MAX(CASE WHEN signal_key='your_signal_key' THEN total_picks END)::int AS your_n,
```

Then the message looks like:
```sql
'★ ' || g.home_team_name || ' fits this pattern — historical (' ||
round(ss.your_win, 1) || '% win, ' ||
CASE WHEN ss.your_roi >= 0 THEN '+' ELSE '' END || round(ss.your_roi, 1) ||
'% ROI · n=' || ss.your_n || '). Lean ' || g.home_team_name || '.'
```

### Step 5 — Apply the migration

Use `apply_migration` (the Supabase MCP tool) so the change is captured in migration history. Title it descriptively, e.g. `add_yoursignal_carryover_signal`. Commit the file in `supabase/migrations/`.

### Step 6 — Verify the signal fires

Query the view live and filter to your new `signal_key` to confirm it surfaces correctly:

```sql
SELECT s.home_team_name, s.away_team_name, sig.signal::jsonb->>'message'
FROM mlb_game_signals s,
LATERAL (SELECT unnest(s.home_signals || s.away_signals) AS signal) sig
WHERE sig.signal::jsonb->>'message' ILIKE '%your distinctive phrase%';
```

If no rows fire today, find a historical date that should have triggered it and confirm via `mlb_game_log`.

### Step 7 — FE — usually no work needed

The web (`src/pages/MLBDailyRegressionReport.tsx`) and mobile (`wagerproof-mobile/app/(drawer)/(tabs)/mlb-regression-report.tsx`) `SeriesSignalsSection` components dynamically pick up any signal from `mlb_game_signals` with `category: 'series'` and render it. Same goes for game card pills via the existing signal-array consumer. **No FE changes are needed when you add a new series signal** — it auto-appears.

If you create a NEW category (not 'series'), update the FE filter in `useMLBSeriesSignals.ts` (or create a new hook) to include it.

### Step 8 — WagerBot — automatic

`get_mlb_predictions.ts` already passes the `home_signals`/`away_signals` arrays to the LLM. Your new signal is automatically included in chat responses.

### Step 9 — Daily regression report

The regression report's narrative is generated by an external Python ETL that reads from CFB Supabase. To get your new signal into the AI-generated narrative:
- **Easy path (no ETL change)**: it already shows up in the `SeriesSignalsSection` card on the report page (added via this playbook).
- **For inclusion in the LLM-narrated `narrative_text`**: contact the ETL maintainer with the signal_key, label, and description. Have them include `mlb_game_signals` rows where category matches the new category in their pre-prompt.

## Modifying or deactivating an existing signal

```sql
UPDATE public.mlb_signal_definitions
SET is_active = false, updated_at = NOW()
WHERE signal_key = 'name_of_signal_to_disable';
```

Note: the view's CASE branches are independent of `is_active`. To stop the signal from surfacing live, ALSO remove or comment out its CASE branch in the view (apply a migration). The flag is mostly for FE legends to know which signals are "blessed".

To **change the threshold** of an existing signal, update both:
1. The CASE branch in the view (the actual gate)
2. The threshold field in `mlb_signal_definitions` (for the legend UI)

After threshold changes, run `SELECT public.refresh_mlb_signal_stats();` to recompute stats with the new rule.

## Tracking a signal's edge over time

The `mlb_signal_stats` table stores both lifetime and L90 (trailing 90 days). When the L90 ROI starts diverging hard from lifetime, the signal may be losing edge. Suggested monitoring queries:

```sql
-- Signals that have decayed
SELECT signal_key, total_picks, win_pct, roi_pct,
       l90_picks, l90_win_pct, l90_roi_pct,
       (l90_roi_pct - roi_pct) AS recent_drift
FROM mlb_signal_stats
WHERE l90_picks >= 10
ORDER BY (l90_roi_pct - roi_pct) ASC;

-- Signals that are heating up
SELECT signal_key, total_picks, roi_pct, l90_roi_pct
FROM mlb_signal_stats
WHERE l90_picks >= 10 AND l90_roi_pct > roi_pct + 5
ORDER BY l90_roi_pct DESC;
```

Set up an alert (Slack/email) if any signal's L90 sample > 20 and its L90 ROI deviates from lifetime by more than 15 percentage points.

## Series signal data flow (for series-position signals specifically)

```
mlb_game_log  ───▶  refresh_mlb_signal_stats()  ───▶  mlb_signal_stats
                                                            │
mlb_schedule  ──┐                                           │
mlb_park_factors│                                           │
mlb_starter_pregame ─────▶  mlb_game_signals  ◀─────────────┘
mlb_bullpen_pregame                │
mlb_batting_pregame                │
mlb_schedule_features              ▼
                              JSON arrays per game
                                   │
            ┌──────────────────────┼──────────────────────────┐
            ▼                      ▼                          ▼
        web FE                 mobile FE              wagerbot-chat
  (game cards + report)   (game cards + report)         (LLM input)
```

The view CTEs `g1_for_home`/`g1_for_away` find the most recent prior game, and `g2_for_home`/`g2_for_away` find the second-most-recent (only present if today is G3+). All series CASE branches use these to determine series position and grade against history.

## Common pitfalls

- **Forgetting the home/away mirror**: any new branch in `home_signals` must have an identical mirror in `away_signals` using the `g.away_team_name` and `g1a`/`g2a` aliases.
- **Hardcoding stats**: don't bake numbers into the message string. Always use `ss.signal_stats_column` so the numbers stay live as the season progresses.
- **Pick-em vs moderate-favorite range overlap**: `-110 to -149` (mod fav) and `-109 to +109` (pick em) are mutually exclusive. The signals' filter conditions should keep them so. Test edge cases (-110 exactly, -149 exactly).
- **Series detection edge cases**: a 6-day gap is the cutoff for "same series." Postponed games or doubleheaders within a series stay grouped. If you find a series-detection bug, fix it in the `g1_for_home` CTE's `BETWEEN CURRENT_DATE - 6` clause AND in `refresh_mlb_signal_stats()` — they must match.
- **mlb_game_log abbr drift**: `mlb_team_mapping` uses `ARI`/`OAK` while `mlb_game_log` uses `AZ`/`ATH`. Avoid joining via team_abbr; always join via `game_pk` + `home_away`.

## Reference: current series signals (as of 2026-04-25)

| signal_key | When it fires | Direction |
|---|---|---|
| `g2_blowout_sweet_spot` | G2; team won G1 by 8+ as moderate fav (-110 to -149) | ★ BACK |
| `g2_blowout_winner` | G2; team won G1 by 8+ outside sweet-spot price band | + Lean |
| `g2_blowout_pick_em_trap` | G2; team won G1 by 8+ in a pick-em (-109 to +109) | ⚠ FADE |
| `g2_blowout_loser` | G2; team got blown out by 8+ in G1 | ⚠ FADE |
| `g2_modfav_5to7_fade` | G2; team won G1 by only 5-7 as moderate fav | ⚠ Soft FADE |
| `g3_massive_blowout_regression` | G3; team won G2 by 15+ runs | ⚠ FADE |
| `g3_blowout_recipient_bounce` | G3; team got blown out by 15+ in G2 | ★ BACK |
| `g3_moderate_fav_regression` | G3; team won G2 by 8+ as moderate fav | ⚠ FADE |
| `g3_heavy_fav_carryover` | G3; team won G2 by 8+ as heavy fav (-150+) | + Lean |

Migrations:
- `supabase/migrations/20260425120000_add_g2_blowout_carryover_signals.sql`
- `supabase/migrations/20260425150000_add_g3_carryover_and_g2_modfav_fade_signals.sql`
- `supabase/migrations/<timestamp>_add_mlb_signal_stats_with_daily_refresh.sql` (stats infra)
- `supabase/migrations/<timestamp>_use_dynamic_signal_stats_in_view.sql` (live numbers in messages)

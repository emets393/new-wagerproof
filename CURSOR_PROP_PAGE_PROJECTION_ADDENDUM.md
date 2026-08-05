# Cursor Addendum: rendering the model projection on the Player Prop page

The `nfl_prop_player_pages` rows now carry a `projection` jsonb — per-market projection
data, already loaded for all 670 week-1 players. Render it as follows. Render-only, as
always: every number comes served; no client math beyond formatting.

## The data

`projection` is keyed by market (only markets with a meaningful projection appear —
absent key ⇒ render the fallback):

```json
{ "player_receptions":    { "kind": "band", "low": 4.0, "median": 5.0, "high": 5.4,
                            "n": 17, "status": "preview", "source": "2025 games" },
  "player_reception_yds": { "kind": "band", "low": 45.8, "median": 61.0, "high": 76.6, ... },
  "player_anytime_td":    { "kind": "rate", "score_rate": 0.12, "n": 17,
                            "status": "preview", "source": "2025 games" } }
```

`status` semantics: `"preview"` = derived from the player's real 2025 game distribution —
a placeholder shape so the UI is final before the model ships. When the per-market model
goes live, the SAME fields carry model output with `status: "model"` and (once books post
lines) an additional served `vs_line` number. **No schema change — build the UI once.**

## Placement: the Model Strip (hero, under the selected market)

Directly beneath the market toggle row, full-width of the hero column:

- **`kind: "band"`** → a horizontal range bar: soft-glow track from `low` to `high`,
  bright median marker with the number above it (`61.0`), `low`/`high` labeled at the
  ends. Label left: **"WAGERPROOF PROJECTION"**. Chip right: **`PREVIEW`** (muted gold)
  while `status === "preview"`; swap to a green **`MODEL`** chip when `status === "model"`.
  When the market's `line` is posted (markets[].status === "posted"), draw the line as a
  white tick on the same bar with a small "LINE 4.5" label — the visual comparison IS the
  product moment. If a served `vs_line` value exists, show it as a delta chip
  (`+0.5 vs line`, green/red by sign); until it's served, show no delta (do not compute it).
- **`kind: "rate"`** (Anytime TD) → compact radial: `12%` center, caption
  "of 2025 games with a TD" (use `source`), same PREVIEW/MODEL chip.
- **Market absent from `projection`** → quiet fallback in the strip:
  "Projection coming soon" (this includes pass-TD markets by policy — never fake one).
- Tooltip on the PREVIEW chip: "Based on his 2025 game-by-game distribution. Live model
  projections replace this at kickoff week."

The strip crossfades with the market toggle like every other cluster (150ms).

## QA
- Jefferson receptions: band 4.0 – **5.0** – 5.4, PREVIEW chip, no delta (line pending).
- Jefferson rushing yards: `projection` has NO key → "Projection coming soon" (his
  degenerate 0-yard band is suppressed server-side).
- Jefferson anytime TD: radial 12%.
- Any rookie: whole strip shows the fallback line.

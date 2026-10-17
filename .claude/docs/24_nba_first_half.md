# NBA first-half markets — data contract for the apps

> Backend shipped 2026-10-16 (cfb_automation `scripts/cfb/nba_model_nightly.py`, `nba_odds_snapshots_fetch.py`,
> DDL `sql/nba_first_half.sql`). Frontend is being built separately. This doc is what the frontend reads.
> Full-game contract: `nba_model_preds` + `nba_slate_flags` (CLAUDE.md data table, PR #171).

Both objects live on the **CFB Supabase project** (`jpxnjuwglavsjbgbasnl`), readable with the anon key.

| object | what | key | refreshed |
|---|---|---|---|
| `nba_model_preds_h1` | One row per game per first-half market (`h1_spread`, `h1_total`) for today and tomorrow. Shape-identical to `nba_model_preds`. | (`espn_game_id`, `model_version`) | 9:20am, 1:20pm, 5:20pm ET |
| `nba_slate_flags` | Rows with `signal_key = 'nba_originator_h1_spread'` are the first-half bets. Copy in `nba_signal_defs`. | (`espn_game_id`, `signal_key`, `market`, `side`) | same runs |
| `nba_odds_snapshots.h1_spread_point` / `h1_total_points` | The first-half lines themselves, per team row per snapshot. The model rows already carry the line used, so the apps normally do not need this. | | 7am, 11am, 2pm, 5pm, 7pm ET |

## Why a separate table

Web, iOS and Android all map a `nba_model_preds` row with `market === 'total' ? total : spread`. A row with
`market = 'h1_spread'` there would be rendered as the full-game spread by every installed build. So the first-half
rows live in `nba_model_preds_h1`. Join to the game the same way as the full game: `game_id` (balldontlie id, same as
`nba_input_values_view.game_id`) first, fallback `(game_date, home_abbr, away_abbr)`.

## Columns (same names as `nba_model_preds`; the meaning shifts to the first half)

| column | `h1_spread` row | `h1_total` row |
|---|---|---|
| `model_home_margin` | model's first-half home margin (+3.1 = home by 3.1 in the half; fair 1H home spread = −3.1) | null |
| `market_home_spread` | posted first-half home spread | null |
| `model_total` | null | model's first-half total |
| `market_total` | null | posted first-half total |
| `disagreement` | `model_home_margin + market_home_spread` (> 0 = model on the home side) | `model_total − market_total` (> 0 = over) |
| `tier` | `bet` (≥ 6 points) / `lean` (≥ 4) / `pass` / `no_line` | **always `pass`** or `no_line` — see below |
| `bet_side` | e.g. `1H BOS -1.5` (prefixed so a card can never confuse it with the full game) | `1H UNDER 112.5` (informational; never a bet) |
| `bet_abbr`, `bet_line`, `home_out`, `away_out`, `as_of`, `model_version` | as full game (`core_h1_spread_v1`) | (`core_h1_total_v1`) |

`no_line` means the books have not posted a first-half number yet. That is normal in the morning: 1H lines usually
appear the afternoon of the game, so the 9:20am rows are often `no_line` and fill in at 1:20pm / 5:20pm. Render the
model number with "line not posted yet" rather than hiding the row.

## What is a bet and what is not

- **First-half spread**: a bet at `tier = bet`, flagged in `nba_slate_flags` as `nba_originator_h1_spread`
  (`market = 'h1_spread'`, `grade_line = 'close'`, `tier = 'tracking'`, conviction `med`). Record from the bet's side,
  wins first, from `nba_signal_defs.record_text`: **23-16 (59.0%) at 6+ points in the 2025-26 live replay**, 47-34 at
  5+; research three seasons 217-155 (58.3%). Candidate tier: 39 live bets is thin. Expect roughly one flag every two
  to three slates.
- **First-half total**: **never a bet.** The production model does not beat the first-half total (54-58 at 7+ in the
  live replay, under 50% at every rung from 5). The prediction is published so it can be tracked this season; show it
  as the model's number if at all, with no verdict, no edge chip, no flag. There is no `nba_signal_defs` row for it.

## Rendering rules

- Label every first-half number "1H" or "First half". The same column names carry the full-game numbers in
  `nba_model_preds`; the table is the only thing that tells them apart.
- Do not derive a first-half pick from the full-game model (half the spread is not the 1H line) and do not average
  the two. The replay split by whether the full-game model also fires is too thin to use (parent ≥ 8 same side 13-7,
  parent below lean 4-4); render the 1H flag on its own.
- `home_win_prob` has no first-half equivalent. There is no first-half moneyline model.

## Reading pattern

```sql
select m.*, f.conviction, f.trigger_text, f.record_text
from nba_model_preds_h1 m
left join nba_slate_flags f
  on f.espn_game_id = m.espn_game_id and f.signal_key = 'nba_originator_h1_spread' and f.market = m.market
where m.game_date in (current_date, current_date + 1)
order by m.game_date, m.espn_game_id, m.market;
```

## Not there yet

- No first-half moneyline or first-half team totals (not captured, not modelled).
- No grading of first-half rows in the warehouse yet; the replay above is the evidence. A live grader lands with
  the season's first closes.

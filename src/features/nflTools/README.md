# NFL Player Prop Matchups

Split-view twin of MLB `/mlb/pitcher-matchups`, mounted at `/nfl/props`.

```
Left:  week slate games (from nfl_prop_player_pages)
Right: defense they face → home/away player board → featured edge
Player row → /nfl/player/:playerId (full orbit breakdown)
```

Default side on a game is **home** (toggle to away). Defense card is the
opponent identity for the selected side.

## Data

| Source | Use |
|---|---|
| `nfl_prop_player_pages` | Players, markets, baseline, scheme, highlights |
| `nfl_player_prop_trends` | Per-opponent records (batched for open game) |

Render-only — no client math beyond formatting.

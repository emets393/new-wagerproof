# Agent Pick Overlap

Shows how many other public agents made the same pick — providing social proof and highlighting consensus.

## Match Rule

Two picks overlap when they share:
- `game_id` (same game)
- `bet_type` (spread, moneyline, or total)
- `lower(trim(pick_selection))` (normalized selection text)

Only **public, active** agents are counted. The source agent is always excluded.

## Database

### Index
```sql
CREATE INDEX idx_avatar_picks_overlap
  ON avatar_picks (game_id, bet_type, (lower(trim(pick_selection))));
```

### RPC: `get_agent_pick_overlap_batch`
- **Input:** `p_pick_ids uuid[]` — array of source pick IDs
- **Output:** rows of `(source_pick_id, overlap_avatar_id, avatar_name, avatar_emoji, avatar_color)`
- **Security:** `SECURITY DEFINER` — reads across agents regardless of RLS
- **Access:** Granted to `authenticated` and `anon` roles
- No server-side limit — client slices for display

Dedup by avatar is guaranteed by the unique constraint `(avatar_id, game_id, bet_type)` on `avatar_picks`.

## TypeScript Types

```typescript
interface OverlapAgentSummary {
  avatar_id: string;
  name: string;
  avatar_emoji: string;
  avatar_color: string;
}

interface AgentPickOverlap {
  totalCount: number;
  agents: OverlapAgentSummary[];
}

// Added to AgentPick:
overlap?: AgentPickOverlap;
```

Defined in both `src/types/agent.ts` and `wagerproof-mobile/types/agent.ts`.

## Service Layer

`enrichPicksWithOverlap(picks: AgentPick[]): Promise<AgentPick[]>`

- Short-circuits on empty array
- Calls RPC with all pick IDs
- Groups results into a `Map<pickId, OverlapAgentSummary[]>`
- Merges onto picks
- **Best-effort:** catches all errors, logs warning, returns original picks on failure

Located in both `src/services/agentPicksService.ts` and `wagerproof-mobile/services/agentPicksService.ts`.

## Hook Integration

Enrichment is wired into the queryFn of:

| Hook | File |
|------|------|
| `useAgentPicks` | `src/hooks/useAgents.ts` |
| `useAgentPicks` | `wagerproof-mobile/hooks/useAgentPicks.ts` |
| `useTodaysPicks` | `wagerproof-mobile/hooks/useAgentPicks.ts` |
| `useTopAgentPicksFeed` | `wagerproof-mobile/hooks/useTopAgentPicksFeed.ts` |

## UI Components

### Web: `src/components/agents/AgentOverlapFooter.tsx`
- Stacked 24px avatar circles with `-space-x-2` overlap
- Emoji on `avatar_color` background (supports gradients)
- `+N` overflow circle when >5 agents
- Text: "X other agents made this pick"
- Rendered inside `AgentPickCard` after the button, before `</CardContent>`

### Mobile: `wagerproof-mobile/components/agents/AgentOverlapFooter.tsx`
- 22px avatar circles with `marginLeft: -8` stacking
- `LinearGradient` for gradient avatar colors
- Dark/light mode border colors
- Rendered inside `AgentPickItem` after the reasoning row

## Edge Cases

| Case | Behavior |
|------|----------|
| Zero overlap | Footer hidden (`return null`) |
| Missing emoji/color | Fallback: emoji `🤖`, color `#6366f1` |
| Private/inactive agent | Not counted (RPC filters) |
| RPC failure | Picks render without overlap, warning logged |
| >5 overlapping agents | 5 avatars + `+N` overflow circle |

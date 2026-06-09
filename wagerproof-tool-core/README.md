# @wagerproof/tool-core

Shared, **runtime-agnostic** WagerProof MCP tool definitions + data access. Zero
runtime dependencies: it never imports `@supabase/supabase-js`, Deno URL modules,
or any Node/Workers API. Callers pass their own Supabase-like clients and an ET
clock; the same tool source runs on every surface.

## Why

WagerProof has three places that need the same data tools:
1. the public **MCP connector** (Cloudflare Worker) — uses this package today,
2. **WagerBot chat** (Supabase Edge Function) — its inlined `tools/*` should be
   replaced by this package (see "Sharing with the Deno chat"),
3. backend **agent pick-generation** — a future agentic loop can call these tools.

Keeping one definition of each tool here avoids drift between surfaces.

## The abstraction (`src/types.ts`)

```ts
interface Tool {
  name; title; description;
  scope: "global" | "user";           // drives which client + which surface
  inputSchema; annotations;           // MCP-facing (readOnlyHint + title)
  execute(input, ctx): Promise<data>;
}

type ToolContext = DataContext & Partial<UserContext> & Partial<PresentationContext>;
//   DataContext        = { main, cfb, today() }   (always)
//   UserContext        = { userId }               (scope:"user" only)
//   PresentationContext= { emit, getBlocks }      (chat only)
```

`main`/`cfb` are `SupabaseLikeClient` — a structural subset of the supabase-js
query builder. A host casts its real client at the boundary
(`client as unknown as SupabaseLikeClient`); tool-core stays dependency-free.

## Tools

- **Global** (`scope:"global"`, in `src/tools/sports/`): `get_sport_predictions`
  (unifies all 5 leagues), `get_game_detail`, `search_games`, `get_market_odds`,
  `get_editor_picks`. Ported from the WagerBot chat tools; the chat-only
  `game_cards` normalization is intentionally not included here.
- **User** (`scope:"user"`, in `src/tools/user/`): `list_my_agents`,
  `get_agent_performance`, `list_my_agent_picks`, `list_my_follows`,
  `get_my_community_activity`, `get_my_record`.

```ts
import { buildTools, indexByName } from "@wagerproof/tool-core";
const tools = buildTools({ includeUserTools: true });   // connector
const byName = indexByName(tools);
```

## Sharing with the Deno chat (next step)

The chat runs on Deno and imports `@supabase/supabase-js` from esm.sh. To consume
this package there, add a Supabase import map / `deno.json` entry pointing
`@wagerproof/tool-core` at this directory, build the chat's `ToolContext` from its
existing clients (cast to `SupabaseLikeClient`), and provide `emit`/`getBlocks`
for the chat-only presentation tools (which stay in the chat layer). Snapshot-test
the formatted tool outputs before/after to guarantee parity.

## Develop

```bash
npm install
npm run typecheck
```

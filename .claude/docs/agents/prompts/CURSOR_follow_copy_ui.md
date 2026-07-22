# Cursor prompt — Follow / Copy-build UI (web + mobile, test locally, NO deploy)

> Copy everything below the line into Cursor. Backend is DONE and live — do not create or
> modify any Supabase migrations, RPCs, or policies. Web tests on `npm run dev`; mobile on
> the Expo iOS simulator. Do NOT commit, push, or deploy.

---

## Context

The agent follow / copy-build backend is live (see `.claude/docs/agents/03_DATABASE_SCHEMA.md`,
sections `user_avatar_follows` and `clone_public_agent`). The product model — get this right:

- **Own agents** = full control (generate, edit, activate).
- **Followed agents** = SPECTATOR ONLY. They appear in the user's agent list and the user
  sees picks whenever the OWNER runs the agent. A follower can NEVER trigger generation —
  never render a generate/run button on an agent the viewer doesn't own.
- **Copy build** = `clone_public_agent` RPC creates a brand-new agent the user OWNS: same
  personality params / insights / sports / archetype / emoji / color / sprite, but 0-0
  record, private, autopilot off. They run THAT one. Copies count against normal creation
  limits.

## Backend contract (already deployed — just call it)

1. **Followed agents list**: `user_avatar_follows` (select own rows: `user_id`, `avatar_id`,
   `followed_at`, `notify_on_pick`, `is_favorite`) → join `avatar_profiles` (public agents
   readable by anyone) + `avatar_performance_cache` for records.
2. **Follow prefs**: authenticated users may UPDATE **only** `is_favorite` and
   `notify_on_pick` on their own follow rows (column-level grant — updating anything else
   is a permission error).
3. **Copy build**:
   ```ts
   const { data: newAgentId, error } = await supabase.rpc('clone_public_agent', {
     p_source_avatar_id: agentId,          // p_name optional; omit to reuse source name
   });
   ```
   Returns the new agent's uuid. Error messages to map (in `error.message`):
   - `agent_limit_reached` → show the existing agent-limit paywall/upsell (free = 1 agent)
   - `source_not_found_or_not_public` → toast "This agent is no longer available"
   - anything else → generic "Couldn't copy this agent, try again"
   Name collisions are handled server-side ("Name (Copy)", "(Copy 2)"…) — never pre-check names.

## Task A — Web (`/agents` split view)

Files: `src/components/agents/split/AgentsListPanel.tsx`, `AgentDetailPane.tsx`,
`AgentDetailHero.tsx`; hook `src/hooks/useAgentFollow.ts`.

1. **BUG FIX first**: `useAgentFollow` queries `.select('id')` on `user_avatar_follows` —
   that table has NO `id` column (composite PK). Select `user_id` (or `avatar_id`) instead
   and verify follow state actually renders true for a followed agent.
2. **My Agents list**: merge followed agents into the list below owned ones under a
   "Following" divider (or a "Following" badge on the card — match existing list style).
   Followed cards show the agent's real record (owner's picks). Favorited follows
   (`is_favorite`) sort first within the Following group; add a star toggle + a
   notifications bell toggle (writes `is_favorite` / `notify_on_pick` on the follow row).
3. **Detail pane for a followed/public agent**: keep the existing public detail
   (picks + record). Ensure NO generate/run controls render unless the viewer owns the
   agent. Add two clearly distinct actions:
   - **Follow / Following** (existing toggle)
   - **Copy build** → confirmation dialog: "This creates YOUR OWN copy of this agent —
     same brain and settings, but a fresh 0-0 record. It won't share the original's
     picks or history." Confirm → call the RPC → on success invalidate the agents list
     query and select the new agent in the split view (`/agents?selected=<newId>`).
4. `agent_limit_reached` → open the same upgrade/paywall surface the create flow uses.

## Task B — Mobile (Expo app, `wagerproof-mobile/`)

Files: `app/(drawer)/(tabs)/agents/index.tsx` (My Agents), `agents/public/[id].tsx`
(public agent detail — Follow button already lives here), `components/agents/AgentCard.tsx`.

1. **My Agents screen**: same merge as web — "Following" section under owned agents,
   spectator badge, favorite star + notify bell backed by the follow row. Tapping a
   followed agent opens `agents/public/[id]` (NOT the owner detail route).
2. **Public agent detail**: add **Copy build** next to Follow with the same confirmation
   copy, RPC call, and error mapping. On success navigate to the new agent's own detail
   route (`agents/[id]`) — it behaves like any owned agent from there (generation works
   because the user owns the copy).
3. `agent_limit_reached` → present the existing RevenueCat paywall used at agent creation.
4. No generation affordances anywhere for non-owned agents.

## Copy/tone (audience is non-technical — keep the two actions unmistakable)

- Follow = "Watch this agent — see its picks when its owner runs it."
- Copy build = "Make your own version — same settings, fresh 0-0 record, you run it."

## Guardrails

- Do NOT touch `supabase/` (migrations/functions), any RPC, or RLS — backend is final.
- Do NOT add client-side inserts into `avatar_profiles` for the copy path — the RPC is
  the only write.
- Reuse existing list-card, toggle, paywall, and toast components; no new design systems.

## Run & hand-off (testing only)

- Web: `npm run dev` → sign in → follow a leaderboard agent → confirm it appears under
  Following with the owner's record and no run button → Copy build → confirm the new 0-0
  agent appears under owned agents and CAN generate.
- Mobile: `npx expo start` → same flow in the iOS simulator, including the
  `agent_limit_reached` paywall on a free account if available.
- Do NOT commit/push/deploy. Report: flows tested, screenshots if possible, and any
  place you had to deviate from this spec.

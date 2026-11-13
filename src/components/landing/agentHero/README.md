# Landing agent hero

The hero on the public landing page (`src/pages/NewLanding.tsx`). It sells the MCP
connector: "Let *[your AI agent]* find you actual high probability bets, with real
live pro data." It replaced `LandingOutliersHero.tsx` as the page's hero; the
Today's Outliers board that hero carried now renders as its own section directly
below (in `NewLanding.tsx`).

| File | What it is |
|---|---|
| `LandingAgentHero.tsx` | The section: laurel/stars/user-count badge, headline with the rotating agent name + logo, CTAs, store badges, demo |
| `AgentConnectMenu.tsx` | The "Add to AI agent" button. Popover on desktop, bottom sheet under 640px |
| `AgentChatDemo.tsx` | Looping scripted chat styled as a Claude window |
| `MarkerHighlight.tsx` | White italic text on a green marker swipe. Also used by the `AIAgentWorkforceSection` heading |
| `heroAgents.ts` | The agents offered, and which ones rotate through the headline |
| `demoScenarios.ts` | The demo's three conversations |

## Page background

The hero's background (`#f4f1ea` light, `#0d0e0e` dark) is the landing page's background:
it is set on the root of `NewLanding.tsx`, and the edge fades in `Testimonials.tsx` and
`UserWinsSection.tsx` fade to the same two colours. Change them together. The MCP
section stays a dark band in light mode because its panels are built white-on-dark.

## Adding or changing an agent

Agents come from `MCP_PROVIDERS` in `src/features/mcp/mcpContent.ts` (each one's
`defaultMode` guide supplies the copy text, instructions and link), so setup copy
stays in one place with the `/mcp` tutorial and `/connect-ai`. Add the provider there,
then add a `fromProvider('<key>')` line and a `SURFACES` entry in `heroAgents.ts`.

Grok is the exception: it is defined inline in `heroAgents.ts` because
`MCP_PROVIDERS` entries need a CLI guide and Grok has none.

`desktopOnly` marks agents whose setup ends in a terminal or desktop app. On a phone
those show "Send to my computer" (the native share sheet) instead of an open link.

## The connect menu launches the agent

Picking an agent does as much of the install as that vendor allows (`launch` in
`heroAgents.ts`, verified 2026-11-13). Every vendor requires the user to confirm inside
their app; none permits a silent install.

| Agent | What the click does |
|---|---|
| Cursor | `cursor://anysphere.cursor-deeplink/mcp/install` — opens the app on its install prompt (documented by Cursor) |
| Hermes | `hermes://mcp/install` — same idea, desktop app (merged Aug 2026) |
| Claude | Opens `claude.ai/customize/connectors?modal=add-custom-connector&connectorName=…&connectorUrl=…` with the dialog prefilled. **Undocumented by Anthropic** — re-test it periodically |
| ChatGPT, Grok | No install link exists. Copies the URL and opens the page it is pasted into |
| Claude Code, OpenClaw | CLI only, no URL scheme. Copies the command |

For the two custom schemes, `launchProtocol` treats "the page never lost focus" as "app not
installed" and falls back to the manual steps. The URL or command is always copied as well,
with an `execCommand` fallback where the async clipboard API is denied.

After any of these, the user lands on the connector's sign-in page
(`wagerproof-mcp/src/auth-app.ts`), which has its own "Create an account" path.

## Demo data is a real snapshot, and it goes stale

`demoScenarios.ts` holds figures captured on 2026-11-13; its header comment lists the source
of each. The demo labels itself with that date. It is static, not a live fetch — refresh it
from the same sources and bump `DEMO_SNAPSHOT_LABEL`. Do not hand-edit numbers.

Each chat should show something a model cannot get from a web search: situational records,
what the public agents are on, the model's own line. The demo also states the case against
its own lean; keep that, it is what makes the rest credible.

**Known gap:** the "Agent consensus" chat shows a `get_game_agent_consensus` tool call. That
RPC exists on Main and feeds the `/games` cards, but the MCP connector does not expose it —
it only has `get_top_community_agent_picks` (top 10). Until a consensus tool is added to
`wagerproof-tool-core`, that chat shows something the connector cannot do.

The demo pauses while off-screen and shows the finished conversation with no
animation under `prefers-reduced-motion`.

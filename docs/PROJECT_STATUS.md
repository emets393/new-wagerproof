# WagerProof — Build Status & Roadmap

A living log of the major initiatives in flight. Add sections as work lands — this is the
single place to see what's built, what's staged, and what's left.

**Last updated:** 2026-06-22

---

## 1. 2026 NFL & CFB Production Pipeline — ✅ LIVE

**What it is:** the machinery that runs our validated NFL & CFB betting models live, every
week of the 2026 season — pulling fresh data, producing the picks/signals the app shows,
grading results, and capturing pre-game odds. These models were previously hand-run on
historical data; now they run themselves on a schedule.

**Built & deployed:**
- **Weekly model runs** — automatically each week: pull live data → run the locked models →
  write the app's game / pick / signal / prop tables (NFL + CFB).
- **1st-half (1H) model** — productionized for live weekly runs.
- **Grading** — after games finish: fill final scores, grade agent picks (against the exact
  sportsbook line the pick used), grade our validated signals, grade player props.
- **Live odds capture** — pre-game odds on a schedule (3×/day for future games, hourly on
  game day), full-game + 1st-half + team-totals, NFL and CFB. Stops at kickoff (never live lines).
- **Hosting** — runs on Render as a blueprint of 5 scheduled jobs. Idle off-season, fires in-season.

**Before Week 1 (Sept 2026):**
- Retrain the models on the latest data preseason (one command) and commit the refreshed model files.
- Deploy the updated grading function.

**Detail:** [14_SEASON_2026_PIPELINE_READINESS.md](../.claude/docs/agents/14_SEASON_2026_PIPELINE_READINESS.md) · pipeline code in `research/`

---

## 2. V3 Agent Upgrade — 🟡 IN PREP (NOT live; ships when we turn V3 on)

**What it is:** a major upgrade to the AI betting agents on our new "V3" agentic engine. Four
parts: agents can cover **multiple sports**, build **parlays**, bet **player props** (only where
we have a proven signal), and a **redesigned set of creation questions**. None of this is live —
it's all staged to ship together when V3 is enabled.

| Part | What | Status |
|---|---|---|
| **Cross-sport agents** | One agent can cover NFL + NBA + MLB, etc. (auto-routed to V3) | ✅ Built, staged |
| **Parlays** | Agents combine picks into multi-leg tickets (2–4 legs) | 🟡 Foundation built (storage, personality dial, steering); bet-submission tool + grading remain |
| **Bettable player props** | Agents bet props — **only props with a validated signal** — straight or as parlay legs | ⬜ Designed, not built |
| **New creation questions** | Simplified, V3-aware personality questions | ✅ Spec'd; not yet wired into the create-agent screens |

**Locked design decisions:**
- Cross-sport agents only run on V3 (the old engine would silently drop games).
- Props are **signal-gated** — agents only bet props we have an edge on; no market picker.
- Per-sport **market allowlist** — users choose which markets each sport can bet (e.g. "NFL:
  full-game spread + 1H total + props; MLB: F5 totals only"), grouped by sport.
- **Bet-timing** question (NFL/CFB only) — bet early on opening lines, or wait for line movement + injuries?
- Odds limits apply to **straight bets only**, not parlay legs.

**Detail:** [13_CROSS_SPORT_AND_PARLAYS.md](../.claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md) (cross-sport + parlays) · [15_V3_PERSONALITY_QUESTIONS.md](../.claude/docs/agents/15_V3_PERSONALITY_QUESTIONS.md) (the question set)

**Testing it safely before launch:** V3 is fully isolated — it runs in "dry-run" mode (generates
picks, writes nothing), it's behind an on/off switch with spend/run caps, and we can test on the
completed **Week-12-2025 dry-run slate** (real games, known results) using private agents no user
can see. So we can exercise the whole generate → grade loop before a single 2026 game.

**Remaining V3 work:**
1. Parlay bet-submission tool + parlay grading (drop-&-re-price when a leg pushes).
2. Bettable signal-gated props (submit path + grading vs player game-logs).
3. Wire the new question set into the create-agent screens (web + mobile + iOS) + archetype presets.

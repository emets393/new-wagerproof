# WagerProof Hackathon — Pre-Season Final Push

The working punch list for the owners' hackathon before the 2026 NFL season. Each item is
a self-contained brief: what we're building, what data backs it, what's missing, and the
build order. Items get appended as they're decided ("add this to the hackathon file").

Conventions: ✅ = data/infra exists today · ⚠️ = small build required first · ⛔ = blocked.

---

## 1. Player Prop Breakdown page (web + apps)

Full-page popup when a user taps a player in NFL props: that player's advanced stats
against THIS week's opponent, organized per prop market. Mockups (v2 visual direction,
Justin Jefferson wk1 vs GB): `research/nfl-extreme-outcomes/out/mockup_player_prop_page.png`,
generator `make_player_prop_mockup.py`.

### Core design principle
**The prop market picks the data, not the player.** A market toggle (chips under the
header) is the page's spine — a RB's rush-yards tab and receiving tab show different
defensive context. Same section skeleton on every tab, different vocabulary:
1. Matchup gauge (one-glance score + plain-English verdict)
2. "The defense he's facing" (2-3 stats max, plain English, donuts/bars w/ league %iles)
3. "How he handles it" (his splits vs league-average markers + TOP-X% badges)
4. **History vs the line** — last-10-games bar strip vs the current prop number
   (most digestible element on the page; from game logs + 915K-row prop history)
5. Lean chip — ONLY when a validated cell fires (see gates below)

### Market × data matrix
| Prop | Defense panel | Player panel | Status |
|---|---|---|---|
| WR/TE receptions | zone vs man rate, pressure rate (pressure→checkdowns→volume) | ypt vs zone/man, target share, catch rate | ✅ |
| WR/TE rec yards | shell (two-high = deep-ball eraser), man rate | ypt vs shells, aDOT, separation, air-yd share | ✅ |
| RB rush yards | heavy/light box rate, run-stuff profile | RYOE, efficiency, **his ypc vs heavy/light box** | ⚠️ player-vs-box table |
| RB rush attempts | light-box rate + game script (spread/total) | carry share, snap share (USAGE family) | ✅ best validated UNDER cell |
| RB receiving | zone+two-high (**checkdown funnel**), blitz rate | target share, ypt | ✅ needs framing only |
| QB pass yards | pressure, blitz, two-high | time-to-throw, CPOE, aggressiveness | ✅ |
| QB pass TDs | same + RZ defense | same + RZ profile | ✅ context ONLY — market is priced, never a lean |
| Anytime TD | RZ TDs allowed | **RZ target/carry share, goal-line role** | ⚠️ RZ-role table |

Data sources: `nfl_def_scheme` (shell/pressure/box, s2d+l8, league %iles),
`nfl_player_vs_scheme` (career ypt/EPA vs man/zone/1-high/2-high), NGS receiving/rushing/
passing parquets, `player_offense` game logs, per-market model feature sets
(`nfl_prop_chosen_v3.json`), prop lines from `nfl_slate_props` when books post.

### Hard rules (from the research program — do not soften)
- **Context-not-edge framing.** The page explains matchups everywhere; the green lean chip
  appears ONLY when a backtested cell fires (rushing UNDERs 62%/+13, receptions
  scheme-UNDER 61.5%/+7.5, receiving band OVERs Tier-2). A lean on every market
  re-creates the tout problem. Pass-TD market NEVER gets a lean (priced via juice).
- **Sample gates.** Player-vs-scheme uses ≥15 career targets. Rookies/backups get a
  designed empty state ("not enough NFL sample vs this look yet"), never blank cells.
- **League context on every number.** 9.0 ypt means nothing alone; with the league-avg
  marker (7.6) and a TOP-13% badge (190-receiver baseline) it reads instantly.

### Pre-build data work (blocks the RB + ATD tabs)
1. **player-vs-box table** — the rushing mirror of `nfl_player_vs_scheme`: each RB's
   ypc/RYOE vs heavy (8+) vs light boxes, career as-of. Same construction, same
   play-level source (`scheme_plays.parquet`). ~a day.
2. **RZ-role table** — red-zone target/carry share + goal-line role per player, from PBP.

### Build order
1. Ship the two missing tables (above)
2. 3-frame mockup: SAME page, one RB, three toggles (rush yds / receptions / ATD) —
   proves the toggle concept better than a WR page
3. Cursor build prompt w/ exact table+column mapping per element
4. Wire lean chips to the validated prop cells (mirrors P-flag infra)

---

## Agents: migrate the V3 loop to OpenAI `/v1/responses` (deferred fix, added 2026-08-07)

OpenAI's 8/5 change made `gpt-5.6*` reject function tools on `/v1/chat/completions` unless
`reasoning_effort='none'`. The pin (agents-v3 deploy `20260805.2`) restored service but turns model
deliberation OFF: output tokens halved (5.3k → 2.7k/run), tool calls −25% (19.4 → 14.5), runs
66s → 37s. Pick rate held (~0.75/run, ~58% pass), so not urgent — but users notice 5–10s "instant"
runs and shallow shortlists. Migrating `agents-v3/src/loop/agenticGenerationLoop.ts` to
`/v1/responses` restores thinking + tools together. Tools/schemas unchanged; request body + SSE
stream parsing change (`consumeChatStreamV3.ts`). Validate with dry-run generations against a live
slate, compare tool-call depth + pick quality vs the chat-completions baseline before deploying.

---

## Bug: agent pick cards can't be shared anymore (added 2026-08-08)

Owner report via users: sharing an agent's pick card no longer works. The share entry point
lives in `wagerproof-ios-native/Wagerproof/Features/Agents/Components/AgentPickFocusView.swift`
(`ShareLink`, presumably rendering the card via `ImageRenderer`) — working reference
implementations of the same pattern: `HistoricalTrendsShareView.swift` and `RoastView.swift`.
Repro + fix: open a pick's focus view, tap share, see what the share sheet receives (empty
payload / failed image render / disabled button are the usual suspects). Check whether the
last agents-UI refactor changed the focus view's data model without updating the share
payload. Web (`src/components/agents/AgentTicketShell.tsx`) may have its own share path —
verify both surfaces before calling it fixed.

---

## Signals: explicit bet direction on EVERY signal, both sports (added 2026-08-08)

Owner rule (2026-08-07, from the OSU regime-fade confusion): a signal's text must SAY the
bet — "→ bet Tulsa +12.5" — because `side=HOME/AWAY` never renders, and a source line that
only names a team reads as *backing* that team even when it fades them. Contradicting
signals must also RENDER against the pick (not be hidden), labeled "Contradicts this pick."

**CFB: ✅ shipped.** `gen_cfb_dryrun_flags.py` appends the bet target to every flag via a
generic `_bet_text()` post-emit (all markets: spread/total/TT/1H/ML, side-aware line flip
for away teams); `gen_cfb_picks.py` writes `counter_signal_keys` on spread/total cards; iOS
`CFBGameBottomSheet.swift` decodes them and synthesizes the opposite-side rows.

**NFL: ⛔ NOT DONE — must ship before NFL Week 1 (Sept 10).**
1. Port `_bet_text()` to the NFL flag generator (`dryrun_wk12_games.py` spot/flag emit) —
   same append-last pattern so no emitter changes.
2. Add `counter_signal_keys` to NFL pick cards (spread/total) mirroring the CFB picks
   generator, and wire the iOS NFL sheet (`NFLGameBottomSheet.swift`) + web NFL detail
   the same way as CFB.
3. Audit existing NFL signal `source` strings: any that name a team they are FADING
   without an explicit bet target are the exact failure mode this rule exists for.

---

*(next items appended below as decided)*

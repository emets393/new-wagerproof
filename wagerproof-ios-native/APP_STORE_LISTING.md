# App Store Listing Copy (iOS)

Source of truth for the App Store product page. Edit here, then push to App Store
Connect. Per-release "What's New" lives in `RELEASE_NOTES.md`, not this file.

App `6757089957` — `com.wagerproof.mobile`. Last synced to ASC: 2026-07-28 (v3.5.9 draft).

| Field | Limit | Current |
|---|---|---|
| Name | 30 | `WagerProof: Sports Research AI` (30/30) |
| Subtitle | 30 | `Bots that find bets for you.` (28/30) |
| Keywords | 100 | 95/100 — see below |
| Promotional text | 170 | 152/170 |
| Description | 4000 | 3921/4000 |

Name and subtitle are set on `appInfoLocalizations`, not `appStoreVersionLocalizations`,
and changing either requires a new version review. **Promotional text is the only field
that can be changed on the LIVE version without review — and it goes public instantly.**

## Keywords

```
betting,picks,NFL,NBA,MLB,NCAA,college,predictions,odds,parlay,spread,props,trends,lines,scores
```

Rules that shaped this list:

- **Never repeat a word already in the name or subtitle.** Apple indexes those separately.
  That rules out: wagerproof, sports, research, ai, bots, find, bets. The previous list
  spent 11 of 100 characters on `sports`, `AI`, and a stray leading space.
- **No spaces after commas** — each one costs an indexable character.
- **Single tokens beat phrases.** Apple builds phrases by combining keywords, so `live`
  plus `scores` covers "live scores" while also feeding "live odds", "NFL scores", etc.
- Dropped `analytics` and `agents` — low search intent, and "bots" in the subtitle already
  covers the agent concept.
- Added `MLB` (was missing entirely despite being the in-season sport), `NCAA` + `college`
  (two of the five sports are college), `props`, `trends`, `lines`.

## Promotional text

```
NFL and college football are live for 2026. Build AI agents that scan the slate, follow the ones that win, and see where our models disagree with Vegas.
```

Seasonal — swap this when football ends. Alternatives kept on file:

- *Agents-first:* Build AI agents that research every game and hand you picks — then check their real record. NFL, CFB, NBA, CBB and MLB models, live lines, and honest grading.
- *Proof-first:* Football is back for 2026. AI agents scan all five sports, show their work, and get graded every night — so you can see which ones actually win before you follow.

## Description

See `asc_description.txt` in the release toolkit, mirrored here:

> WagerProof builds you a team of AI analysts that research games while you sleep.
> *(full text is what's live in ASC — the sections are: AI Agents, Agent Consensus, Model
> Predictions, Outliers, Historical Trends & Systems, Live Scores, WagerBot, Player Props
> & Parlays, Connect to Your AI Assistant, Built for People Who Check the Math, An Honest
> Track Record, Community, Free and Pro, subscription terms, responsible-gambling notice.)*

### What the 2026-07-28 rewrite removed and why

The previous description had been advertising features that no longer exist. Each of these
is an App Store Guideline 2.3.1 (accurate metadata) exposure as well as a refund risk:

| Claim | Reality |
|---|---|
| "EDITOR'S PICKS & EXPERT ANALYSIS — our team of analysts shares their top plays daily" | Editor's Picks is **retired** and removed from the iOS side menu |
| "Teaser Calculator — analyze teaser value with our sharpness tool" | **Never shipped.** Only a `LearnTeaserTool` lesson exists |
| "Bet Slip Grader — paste your parlay and get instant analysis" | **Disabled** (`ENABLE_BET_SLIP_GRADER = false`) |
| "Value Finder / Value Finds" | Now an **admin-only** surface |
| "Yearly: $219.00 / Monthly: $59.99 / Weekly: $14.99" | Actual USA prices are **$79.99 / $29.99 / $14.99**. $59.99 is the *yearly promo*, not monthly |

It also omitted most of what the app actually does now: AI Agents, Agent Consensus,
Historical Trends, Systems, Parlay God, player props, the MCP connector, and MLB.

**Hardcoded prices were removed for good.** They go stale silently, as above. Apple renders
live subscription pricing on the product page and the paywall shows it at point of purchase,
which is what Guideline 3.1.2 actually requires.

## Known issue — support URL

`supportUrl` is set to `https://wagerproof.bet/privacy-policy`. It should be
`https://wagerproof.bet/support`, which exists and returns 200. Not yet changed.

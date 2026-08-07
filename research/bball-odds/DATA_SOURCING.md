# Advanced Basketball Data — Sourcing Report (2026-08-02)

Where WagerProof can BUY tracking-class data (defender distance, shot quality, play types:
cuts, screen types, post-ups, hand-offs) for NBA and NCAAB. Compiled from four research
sweeps: NBA vendors, CBB vendors, sensor/wearable vendors, and a legal deep-dive on
data-rights/licensing. Prices marked UNVERIFIED are third-party reports, not quotes.

## The legal frame (governs every deal below)

- **Nobody owns the facts.** *NBA v. Motorola* (2d Cir. 1997): game stats aren't
  copyrightable; independently gathered data defeats free-riding claims. The lock is
  CONTRACT + access, not IP. A vendor that generates its own data from broadcast video
  (ShotQuality, SkillCorner) is unencumbered by league distribution rights.
- **NBA game tracking is Sony Hawk-Eye (2023-24+), league-controlled.** Betting-data
  distribution: Sportradar (NBA/NHL/MLB), Genius (NFL). No side door.
- **Sportradar's paper:** media tier PROHIBITS gambling-related use (league is a
  third-party beneficiary and can order termination); betting tier presumes a licensed
  sportsbook. Newest T&Cs bar use for "prediction market … or similar offering" — the
  clause to negotiate. Their AI clause bars training on THEIR outputs; ambiguous on raw
  data. Any deal must state in writing: we may train models on the data and sell model
  predictions.
- **Low-latency = expensive/exclusive; delayed = sublicensable** (Sportradar–Genius UK
  settlement structure). We only need pregame/overnight → always negotiate the delayed
  tier.
- **Wearables are legally dead:** NBA CBA bars in-game wearables and bars
  commercialization of practice data (KINEXON, Catapult, Noah — all closed).
- **stats.nba.com ToU** bars gambling/commercial use of NBA Statistics; enforcement
  history is IP-blocking, not lawsuits. Safest posture: features in, raw tables never
  republished. Datacenter IPs are dropped; residential proxies (~$50-150/mo) work.

## Ranked shortlist

### 1. ShotQuality — buy first, both sports (~$1.5k/yr to start)
Broadcast-CV shot-probability model: nearest-defender distance, defender
front/side/behind, crowding, defender height, shooter/defender velocity, ~90-100
variables, play-type descriptors (P&R, cuts, transition, post-ups, drives — no screen
sub-types). NBA + NCAAM (~2015+) + WNBA + intl. Premier tier $249.99/mo or
**$1,499.99/yr incl. API + historical** (docs.api.shotquality.com); enterprise via
partners@shotquality.com (est. low five figures, UNVERIFIED). **Explicitly bettor-facing**
— sells trading feeds to sportsbooks/Kalshi; no gambling-use restriction.
⚠ NO independent validation of their defender-distance accuracy exists; predictiveness
claims are self-published. Buy one season, backtest vs our warehouse + closing line
before shipping anything on it (grade vs T-60 per closing-line policy).

### 2. Synergy Basketball API (Sportradar) — the only source of true play-type logging
Human-logged EVERY possession, every D1 game + NBA: 11-category taxonomy incl. **Cut
(basket/screen/flex/flash sub-types), Off-Screen (pin-down/flare/elevator)**, hand-off,
iso, post-up, P&R both roles, transition by role; defensive matchups; lineups; shot
coords. ~4h post-game (fine for us). NCAA logged since ~2006-07; NBA archive 20+ yrs.
⚠ **API carries current + last 2 seasons only** — historical bulk needs a negotiated
license. ⚠ Betting-adjacent use needs written approval. Comps: D1 team site $15-35k/yr,
NBA team $50-150k/yr (HoopBrief, UNVERIFIED); API pricing unpublished
(sales@sportradar.com). Deal points: (a) betting carve-out in writing, (b) ≥4 back-seasons
for training, (c) delayed tier, (d) model-training + sell-predictions clause.

### 3. SkillCorner — the proprietary-moat option (price unknown)
Broadcast-CV XY tracking (players 25fps + ball XYZ) of **NCAA D1 + G League + intl —
NOT the NBA itself** (their pages contradict; evidence says NBA teams are customers, not
covered). Event layer already tags pick-and-rolls, screens, hand-offs, isolations,
drives, closeouts. Real REST API + Python SDK (skillcorner.readthedocs.io). Aug 2025
KINEXON partnership sells "Conference"/"NCAA" tiers to schools. Sells to betting
operators in soccer; basketball posture UNVERIFIED. Raw material to BUILD our own
cut/screen/defender metrics nobody else can quote. History depth for basketball
unpublished — ask.

### Cheap adds (research inputs, not app display)
- PBP Stats Patreon (from $2/mo) — possession/tracking site; maintenance mode, don't
  build load-bearing infra on it.
- BBall Index Data & Tools $52.50/yr — LEBRON, matchup data, shot charts since 1996.
- stats.nba.com via residential proxy — defender-distance shot splits, drives, touches,
  Synergy play-type aggregates, hustle stats (player-season splits, not per-shot).
  ToU risk: features only, never republish.

### Closed doors (don't spend time)
- Genius/Second Spectrum: no purchasable NBA product; archive not licensable (no public
  path). NCAA deal = March Madness only.
- Sportradar NBA API v8 media tier: gambling prohibition + no tracking aggregates
  (only Court Vision post-game pose, and betting use barred). Reported $1,250-10k+/mo.
- Zelus/Teamworks: per-team exclusive consulting (~$725k/yr), consumes tracking, doesn't
  sell it.
- KINEXON/Catapult/Noah: CBA-barred practice data.
- ShotTracker: real sensors but ~50 programs + Big 12 only, not full D1; media licensing
  exists (Hearst) if we ever want a conference-level product.
- Cerebro (recruiting), Sports Reference bulk ($5k min, redistribution-barred),
  hoop-math (dead Nov 2025), DARKO/CraftedNBA (no commercial license to buy).

## Suggested play

1. ShotQuality Premier now (both sports, $1.5k) → backtest their SQ/defender numbers as
   FEATURES in the CBB panel + NBA originator models; adopt only what survives.
2. Email Sportradar re Synergy NCAA API: betting carve-out + historical depth + price.
   Walk if no history or no carve-out.
3. Email SkillCorner re NCAA tier: leagues covered, seasons of history, betting-adjacent
   license, price. If sane, this is the long-term moat.
4. Meanwhile: build defensive-shot-quality-allowed from the coordinates we already own
   (free), and stand up a residential-proxy puller for stats.nba.com aggregates
   (features only).

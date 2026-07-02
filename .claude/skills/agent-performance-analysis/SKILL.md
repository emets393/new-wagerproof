---
name: agent-performance-analysis
description: Analyze the WagerProof AI-agent population — win-rate & net-units distributions (bell curves, overall + per sport) and what winning agents have in common (personality params + custom-insight prompts). Use when asked to plot/analyze agent performance distributions, compare winners vs losers, check whether agent settings or custom prompts affect results, or find commonalities among top agents.
---

# Agent Performance Analysis

Analyze the whole AI-agent population from the Main Supabase project: distribution of win rate and net units (overall + per sport), and whether an agent's **settings** (personality params) or **custom prompt** (custom insights) correlate with winning.

## Data model (Main project `gnjrklxotmbvnxbnnqgq`, linked)

- `avatar_performance_cache` — one row per agent: `wins, losses, pushes, net_units, stats_by_sport jsonb` ({sport:{wins,losses,pushes,total}}). Public-readable. **`net_units` is overall-only — there is NO per-sport net_units here.**
- `avatar_profiles` — `personality_params jsonb`, `custom_insights jsonb`, `archetype`, `preferred_sports`, `is_public`, `is_active`.
- `avatar_picks` — per-pick rows: `sport, result (won|lost|push|pending), odds (text), units`. Needed to compute **per-sport net units**.

### Definitions (must match these)
- **Win rate = `wins / (wins + losses)`** — pushes excluded from the denominator.
- **Net units (Formula B):** WON + neg odds → `units*(100/|odds|)`; WON + pos odds → `units*(odds/100)`; LOST → `-units`; PUSH/PENDING → 0. Missing/`0` odds → default −110 payout (`100/110`).
- **Cohort filter:** always require **≥20 settled picks** (`wins+losses ≥ 20`) for the "clean" view — tiny samples create 0%/100% spikes that inflate SD. `≥1` shows the raw population.
- **Winner** = `net_units > 0` (true bottom line). Also cross-check top/bottom **decile by net_units** (`ntile(10)`).

### Baseline findings (2026-07, ~805 agents / 609 settled) — sanity check against these
- Win rate ≈ **normal, centered ~50–51%** (≥20: mean 51.4%, SD 6.9%). MLB 49.7% < NBA 53.1% < NCAAB 55.5%. NFL n=2 / CFB n=0 (not graded).
- Net units centered **below zero** (≥20: mean −2.9u, ~37% profitable) — the vig. NBA best (~−0.6u), MLB worst (~−4.1u).
- **No personality signature of winning** — winners' params ≈ field's (risk, confidence, model/Polymarket trust, bet type, underdog lean all ~equal); faint edges: skip-weak-slates 80% vs 70%, slight NBA tilt.
- **Custom prompt ≠ edge** — fill rate/length identical for winners vs losers; agents with *no* philosophy did as well as those with one. Prompt content shapes **variance** (plus-money/underdog = fat right tail; chalk/favorites = slow bleed), not expected value. It's variance-dominated.

## Running queries

Use the Supabase CLI against the **linked** project with CSV output:
```
supabase db query --linked -o csv "<SQL>" 2>/dev/null | grep -E "<data-row-pattern>"
```
Gotchas:
- Default output is a JSON agent-envelope — **always pass `-o csv`**.
- Don't `$`-anchor grep filters (trailing `\r` breaks them); filter by leading token (`^winner,`) or skip header/parse in Python.
- Odds text is dirty: parse with `(regexp_match(coalesce(odds,''),'[+-]?[0-9]+'))[1]::numeric` (NOT `regexp_replace`, which can yield a lone `"-"`), and **guard `o=0`** (else division-by-zero).

### Distribution exports
```sql
-- Win rate + settled count, per agent (overall)
select (wins::numeric/nullif(wins+losses,0)) win_rate, (wins+losses) decided
from avatar_performance_cache where (wins+losses) > 0;

-- Overall net units (from cache)
select net_units, (wins+losses) decided
from avatar_performance_cache where (wins+losses) > 0;

-- Per-sport win rate (from stats_by_sport jsonb)
select s.key sport, (s.value->>'wins')::int wins, (s.value->>'losses')::int losses
from avatar_performance_cache c, jsonb_each(c.stats_by_sport) s
where ((s.value->>'wins')::int + (s.value->>'losses')::int) > 0;

-- Per-sport net units (computed from picks — Formula B)
with settled as (
  select pk.avatar_id, pk.sport, pk.result, pk.units,
    (regexp_match(coalesce(pk.odds,''),'[+-]?[0-9]+'))[1]::numeric o
  from avatar_picks pk where pk.result in ('won','lost','push'))
select sport,
  sum(case when result='won' then units*(case when o is null or o=0 then 100.0/110.0
             when o>0 then o/100.0 else 100.0/abs(o) end)
           when result='lost' then -units else 0 end)::numeric(12,4) net,
  count(*) filter (where result in ('won','lost')) decided
from settled group by avatar_id, sport having count(*) filter (where result in ('won','lost')) > 0;
```

## Building the bell curves (matplotlib)

Create a venv in the scratchpad (`python3 -m venv venv && venv/bin/pip install matplotlib numpy scipy`), then for each metric plot a **histogram (density) + fitted normal overlay** (`scipy.stats.norm.pdf(x, mean, sd)`), a mean line, and a reference line (win rate → **52.38%** break-even at −110; net units → **0u**). Produce: (1) overall two-panel (all settled vs ≥20), (2) per-sport small multiples (MLB/NBA/NCAAB; skip NFL/CFB — too few), (3) an overlay of the fitted curves. Net units is mildly right-skewed (fat tails) — clip the x-domain to ~[p1,p99] for display but compute stats on full data, and note the normal fit is approximate. `open` the PNGs so the user sees them.

## Winners vs losers comparison

### Personality params (all 1–5 scales unless noted)
Keys: `risk_tolerance, confidence_threshold, underdog_lean, over_under_lean, trust_model, trust_polymarket, home_court_boost, trust_team_ratings` (int 1–5); `chase_value, skip_weak_slates, polymarket_divergence_flag, fade_back_to_backs, upset_alert, pace_affects_totals` (bool); `preferred_bet_type` (any/spread/moneyline/total); `max_picks_per_day, max_favorite_odds, min_underdog_odds` (int).
```sql
with base as (
  select ap.personality_params p, pc.net_units,
    (pc.wins::numeric/nullif(pc.wins+pc.losses,0)) wr,
    case when pc.net_units>0 then 'winner' else 'field' end bucket
  from avatar_profiles ap join avatar_performance_cache pc on pc.avatar_id=ap.id
  where (pc.wins+pc.losses)>=20)
select bucket, count(*) n, round(avg(wr)*100,1) win_pct, round(avg(net_units),1) net,
  round(avg((p->>'risk_tolerance')::numeric),2) risk,
  round(avg((p->>'confidence_threshold')::numeric),2) conf,
  round(avg((p->>'underdog_lean')::numeric),2) dog_lean,
  round(avg((p->>'trust_model')::numeric),2) trust_model,
  round(avg((p->>'trust_polymarket')::numeric),2) trust_poly,
  round(avg((p->>'max_picks_per_day')::numeric),2) max_picks,
  round(avg(case when (p->>'chase_value')::boolean then 1 else 0 end),2) chase,
  round(avg(case when (p->>'skip_weak_slates')::boolean then 1 else 0 end),2) skip_weak
from base group by bucket order by bucket;
-- Also: replace `bucket` with ntile(10) over(order by net_units) and compare tile 10 vs 1.
-- Also: group dominant sport per agent = argmax(wins+losses) over stats_by_sport.
```

### Custom insights (free-text user direction)
Keys: `betting_philosophy, target_situations, avoid_situations, perceived_edges`. Measure fill rate + length by bucket, then classify `betting_philosophy` by strategy and compare **mean AND variance** (SD) of net units — the payoff is showing variance, not mean, differs:
```sql
with base as (
  select lower(coalesce(ap.custom_insights->>'betting_philosophy','')) phil, pc.net_units,
    (pc.wins::numeric/nullif(pc.wins+pc.losses,0)) wr
  from avatar_profiles ap join avatar_performance_cache pc on pc.avatar_id=ap.id
  where (pc.wins+pc.losses)>=20)
select case when phil ~ 'plus money|plus-money|[+]100|underdog|(^| )dog' then 'plusmoney_dog'
            when phil ~ 'favorite|chalk|sure thing|grind' then 'chalk_fav'
            when length(trim(phil))=0 then 'no_philosophy' else 'other' end camp,
  count(*) n, round(avg(wr)*100,1) win_pct, round(avg(net_units),1) avg_net,
  round(stddev_samp(net_units),1) sd_net, round(100.0*avg(case when net_units>0 then 1 else 0 end),0) pct_profit
from base group by 1 order by 1;
```

## Interpreting results (be honest, quantify uncertainty)
- Report mean, median, SD, %-profitable, and n. For a small camp, give the ± (SE ≈ SD/√n); a +2.5u mean with SD 13, n=30 straddles zero — call it variance, not edge.
- Frame the headline finding: **win rate ≈ coin-flip, net units net-negative after vig, and neither settings nor prompts show a detectable winning edge** — outcomes are variance-dominated at these sample sizes. Sport (NBA>MLB) is the largest structural factor, and it's modest.
- Caveats to always state: small per-agent samples; observational (not causal); "no *detectable* average effect" ≠ "settings can't matter"; keyword classification of prompts is coarse.

## Related
- Live in-app version of these charts: the iOS "Agents Platform Statistics" screen (Secret Settings) — see `supabase/migrations/20260701120000_agent_performance_distribution_rpc.sql` for the productionized distribution RPCs.
- Unit math: `src/utils/unitsCalculation.ts` (Formula B, canonical); personality param reference: `.claude/docs/agents/02_PERSONALITY_PARAMS.md`.

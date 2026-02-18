# Virtual Picks Expert (Agents) - Overview

## What Is It?

A feature where users build up to 5 AI-powered "Virtual Picks Experts" (Agents) through conversational onboarding. Each agent analyzes WagerProof's prediction data and autonomously generates picks based on its configured personality, risk tolerance, and betting style. Performance is tracked independently like editor picks.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Visibility** | Private by default, opt-in public | Protects user strategies while enabling community |
| **AI Backend** | Supabase Edge Functions + OpenAI | Fits existing patterns |
| **System Prompt** | Remote (DB table `agent_system_prompts`) | Developers iterate without deploys |
| **Platform** | Mobile-first, then web | Primary user base on mobile |
| **Personality** | Parameters only (affects pick selection) | Reasoning stays analytical |
| **Tracking** | Units only (+/- units like editor picks) | Simple, proven system |
| **Editing** | Editable anytime, record stays intact | Flexibility without losing history |
| **Access** | Premium-only feature | Monetization |
| **Pick Generation** | On-demand (when user opens agent) | Cost-efficient, fresh data, no CRON complexity |
| **Leaderboard Ranking** | Net units | Clear performance metric |
| **Animation** | Fake staged "Thinking Trace" | Better UX while edge function runs |
| **Creation Flow** | On-rails chat UI (6-18 steps) | Progressive disclosure |
| **Avatar Visual** | Emoji + background color | Simple, expressive |
| **Grading** | Automated via CRON | Consistent, reliable |

## Tab Changes

| Tab | Before | After |
|-----|--------|-------|
| First tab (`index`) | "Models" with brain icon | "Games" with trophy/wreath icon |
| Second tab (`picks`) | "Picks" with star icon | "Agents" with brain icon |

## Feature Requirements

1. **Agent Limit**: 5 agents per user
2. **Sports Coverage**: NFL, NBA, CFB, NCAAB
3. **Bet Types**: Spread, Moneyline, Total (Over/Under)
4. **10 Archetype Presets**: Quick-start templates for common betting strategies
5. **50+ Personality Parameters**: Full customization for power users
6. **Public Leaderboard**: Opt-in visibility ranked by net units
7. **Follow System**: Users can follow public agents (future)

## High-Level Flow

```
User opens Agents tab
    ↓
Agents Hub (My Agents / Leaderboard tabs)
    ↓
Create New Agent
    ↓
6-step Quick Start (or 18-step Advanced)
    ↓
Agent Detail View
    ↓
Tap to generate picks → ThinkingTrace animation → Picks displayed
    ↓
Automated grading overnight
    ↓
Performance tracked (W-L-P, +/- units)
```

## Related Documentation

- [01_DATA_PAYLOADS.md](./01_DATA_PAYLOADS.md) - 4-payload architecture (system prompt is now remote)
- [02_PERSONALITY_PARAMS.md](./02_PERSONALITY_PARAMS.md) - All personality parameters
- [03_DATABASE_SCHEMA.md](./03_DATABASE_SCHEMA.md) - Database tables (includes `agent_system_prompts`)
- [04_SCREENS.md](./04_SCREENS.md) - Screen specifications
- [05_COMPONENTS.md](./05_COMPONENTS.md) - Component list
- [06_IMPLEMENTATION.md](./06_IMPLEMENTATION.md) - Implementation order (updated with remote prompt tasks)
- [07_GAME_DATA_PAYLOADS.md](./07_GAME_DATA_PAYLOADS.md) - Sport-specific game data with real examples
- [08_PROMPT_MAPPING.md](./08_PROMPT_MAPPING.md) - How personality params map to AI instructions + remote prompt architecture
- [09_GAME_DATA_AUDIT_RUNBOOK.md](./09_GAME_DATA_AUDIT_RUNBOOK.md) - Reusable live payload test + per-sport metric source map

# WagerProof Documentation Index

## Getting Started
- [README.md](README.md) — Project overview, setup, and architecture
- [.env.example](.env.example) — Required environment variables
- [.claude/CLAUDE.md](.claude/CLAUDE.md) — **The authoritative project context file. Start here.**

### The four app codebases
- `src/` — web (React + Vite), **shipping**
- [wagerproof-ios-native/WagerproofKit/README.md](wagerproof-ios-native/WagerproofKit/README.md) — iOS (SwiftUI), **shipping**
- [wagerproof-android-native/README.md](wagerproof-android-native/README.md) — Android (Kotlin), **shipping**
- [wagerproof-mobile/README.md](wagerproof-mobile/README.md) — React Native, **DEPRECATED / phasing out**

## Current Status & Roadmap
- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) — Build status & roadmap. ⚠️ Only §2 (V3) was re-verified 2026-07-25; other sections date to 2026-06-22.

## Architecture & Systems
- [.claude/docs/00_CODEBASE_OVERVIEW.md](.claude/docs/00_CODEBASE_OVERVIEW.md) — Codebase overview. ⚠️ Stale: says "two applications"; there are four.
- [.claude/docs/08_database_caching.md](.claude/docs/08_database_caching.md) — Dual-Supabase architecture and caching. ⚠️ Stale (2025-12).
- [.claude/docs/11_edge_functions.md](.claude/docs/11_edge_functions.md) — Supabase Edge Functions (47 exist; doc covers ~34)
- [.claude/docs/06_auth_seo_deploy.md](.claude/docs/06_auth_seo_deploy.md) — Auth flow, SEO, and deployment

## Features
- [.claude/docs/01_buildship_api.md](.claude/docs/01_buildship_api.md) — BuildShip API integration for WagerBot
- [.claude/docs/02_chat_wagerbot.md](.claude/docs/02_chat_wagerbot.md) — WagerBot chat (web + mobile)
- [.claude/docs/03_payments_billing.md](.claude/docs/03_payments_billing.md) — RevenueCat subscriptions and Stripe
- [.claude/docs/04_sports_predictions.md](.claude/docs/04_sports_predictions.md) — Prediction models and data tables per sport
- [.claude/docs/05_ui_design_theme.md](.claude/docs/05_ui_design_theme.md) — UI design system and theming
- [.claude/docs/07_mobile_features.md](.claude/docs/07_mobile_features.md) — Mobile-specific features and navigation
- [.claude/docs/08_mobile_data_fetching.md](.claude/docs/08_mobile_data_fetching.md) — Mobile data fetching patterns per sport
- [.claude/docs/09_polymarket_integration.md](.claude/docs/09_polymarket_integration.md) — Polymarket widget architecture and caching
- [.claude/docs/10_api_integrations.md](.claude/docs/10_api_integrations.md) — The Odds API, ESPN, weather integrations
- [.claude/docs/12_support_center.md](.claude/docs/12_support_center.md) — Support center: collections, articles, search, static build
- [.claude/docs/13_mlb_signals_playbook.md](.claude/docs/13_mlb_signals_playbook.md) — MLB signals playbook
- [.claude/docs/14_ios_primitives_index.md](.claude/docs/14_ios_primitives_index.md) — iOS native primitive/component index
- [.claude/docs/15_mobile_historical_analysis.md](.claude/docs/15_mobile_historical_analysis.md) — Mobile historical analysis
- [.claude/docs/16_parlay_god.md](.claude/docs/16_parlay_god.md) — Parlay God engine and its surfaces
- [.claude/docs/trends-systems/](.claude/docs/trends-systems/) — Trends filter taxonomy, data coverage, Systems leaderboard (8 docs)
- ~~docs/MLB_PREDICTIONS_PAGE.md~~ — **obsolete**: documents the deleted `src/pages/MLB.tsx`; `/mlb` now redirects into `/games`

## AI Agents System
- [.claude/docs/agents/00_OVERVIEW.md](.claude/docs/agents/00_OVERVIEW.md) — Agent feature overview and key decisions
- [.claude/docs/agents/01_DATA_PAYLOADS.md](.claude/docs/agents/01_DATA_PAYLOADS.md) — 4-payload architecture for AI generation
- [.claude/docs/agents/02_PERSONALITY_PARAMS.md](.claude/docs/agents/02_PERSONALITY_PARAMS.md) — 50+ personality parameters and archetypes
- [.claude/docs/agents/03_DATABASE_SCHEMA.md](.claude/docs/agents/03_DATABASE_SCHEMA.md) — Agent database tables and RLS policies
- [.claude/docs/agents/04_SCREENS.md](.claude/docs/agents/04_SCREENS.md) — Screen-by-screen specifications
- [.claude/docs/agents/05_COMPONENTS.md](.claude/docs/agents/05_COMPONENTS.md) — Component list and props
- [.claude/docs/agents/06_IMPLEMENTATION.md](.claude/docs/agents/06_IMPLEMENTATION.md) — Implementation phases and file list
- [.claude/docs/agents/07_GAME_DATA_PAYLOADS.md](.claude/docs/agents/07_GAME_DATA_PAYLOADS.md) — Real payload examples per sport
- [.claude/docs/agents/08_PROMPT_MAPPING.md](.claude/docs/agents/08_PROMPT_MAPPING.md) — How personality params map to prompts
- [.claude/docs/agents/09_GAME_DATA_AUDIT_RUNBOOK.md](.claude/docs/agents/09_GAME_DATA_AUDIT_RUNBOOK.md) — Data payload testing runbook
- [.claude/docs/agents/10_GENERATION_V2_QUEUE.md](.claude/docs/agents/10_GENERATION_V2_QUEUE.md) — V2 queue-based generation (enqueue/dispatch/worker)
- [.claude/docs/agents/11_PUSH_NOTIFICATIONS.md](.claude/docs/agents/11_PUSH_NOTIFICATIONS.md) — Push notification system
- [.claude/docs/agents/12_PICK_OVERLAP.md](.claude/docs/agents/12_PICK_OVERLAP.md) — Pick overlap tracking and visualization
- [.claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md](.claude/docs/agents/13_CROSS_SPORT_AND_PARLAYS.md) — Cross-sport agents + parlays design (V3)
- [.claude/docs/agents/14_SEASON_2026_PIPELINE_READINESS.md](.claude/docs/agents/14_SEASON_2026_PIPELINE_READINESS.md) — 2026 NFL/CFB live pipeline audit + readiness
- [.claude/docs/agents/15_V3_PERSONALITY_QUESTIONS.md](.claude/docs/agents/15_V3_PERSONALITY_QUESTIONS.md) — V3 personality question set (redesign)
- [.claude/docs/agents/16_PARLAY_AGENTS.md](.claude/docs/agents/16_PARLAY_AGENTS.md) — Parlay-generating agents
- [.claude/docs/agents/17_AGENT_TEST_HARNESS.md](.claude/docs/agents/17_AGENT_TEST_HARNESS.md) — Agent test harness
- [.claude/docs/agents/18_GENERATION_V3_TRIGGERDEV.md](.claude/docs/agents/18_GENERATION_V3_TRIGGERDEV.md) — **V3 on Trigger.dev — the canonical generation engine. Read this one.**
- [agents-v3/README.md](agents-v3/README.md) — The V3 worker itself (tasks, env, deploy)
- [.claude/docs/agents/20_PIXEL_OFFICE_FULL_SPEC.md](.claude/docs/agents/20_PIXEL_OFFICE_FULL_SPEC.md) — Pixel Office spec — ⚠️ **PROPOSAL, not built**
- [.claude/docs/agents/21_PIXEL_OFFICE_ROOM_DESIGN.md](.claude/docs/agents/21_PIXEL_OFFICE_ROOM_DESIGN.md) — Pixel Office room design — ⚠️ **PROPOSAL, not built**
- ~~docs/agent-system-prompt-full.md~~, ~~docs/agent-system-prompt-edge-accuracy-and-situational-trends.md~~ — **obsolete Feb 2026 snapshots.** Agent system prompts now live in the `agent_system_prompts` table and are fetched at runtime by `supabase/functions/shared/promptFetcher.ts`.

## Polymarket Integration
- [docs/polymarket-implementation-docs/README.md](docs/polymarket-implementation-docs/README.md) — Polymarket docs overview and usage scenarios
- [docs/polymarket-implementation-docs/polymarket-api-reference.md](docs/polymarket-implementation-docs/polymarket-api-reference.md) — API endpoints and payloads
- [docs/polymarket-implementation-docs/polymarket-code-patterns.md](docs/polymarket-implementation-docs/polymarket-code-patterns.md) — Reusable code patterns
- [docs/polymarket-implementation-docs/polymarket-implementation-steps.md](docs/polymarket-implementation-docs/polymarket-implementation-steps.md) — Step-by-step integration guide
- [docs/polymarket-implementation-docs/polymarket-troubleshooting.md](docs/polymarket-implementation-docs/polymarket-troubleshooting.md) — Common issues and solutions

## Mobile Setup & Config
- [wagerproof-mobile/docs/ios-widget.md](wagerproof-mobile/docs/ios-widget.md) — iOS Home Screen widget architecture
- [wagerproof-mobile/docs/FACEBOOK_SDK_SETUP.md](wagerproof-mobile/docs/FACEBOOK_SDK_SETUP.md) — Facebook SDK for purchase attribution
- [wagerproof-mobile/docs/web-checkout-redemption.md](wagerproof-mobile/docs/web-checkout-redemption.md) — RevenueCat web checkout flow
- [wagerproof-mobile/WAGERPROOF_BRANDING_LIST.md](wagerproof-mobile/WAGERPROOF_BRANDING_LIST.md) — Brand text and asset audit

## Scripts
- [scripts/README.md](scripts/README.md) — All utility scripts: build, test, debug, data ops — organized by category with usage instructions

## Web App
- [docs/ADMIN_SYSTEM.md](docs/ADMIN_SYSTEM.md) — Admin pages, AI settings, site toggles, access control

## Mobile-Specific
- [wagerproof-mobile/docs/BOTTOM_SHEET_PATTERN.md](wagerproof-mobile/docs/BOTTOM_SHEET_PATTERN.md) — Sport-specific bottom sheet architecture and how to add new sheets
- [wagerproof-mobile/docs/NOTIFICATIONS_DEEP_LINKING.md](wagerproof-mobile/docs/NOTIFICATIONS_DEEP_LINKING.md) — Push notifications, token lifecycle, deep link schemes, tap routing

## Native Apps
- [wagerproof-ios-native/WagerproofKit/README.md](wagerproof-ios-native/WagerproofKit/README.md) — iOS shared SPM package (Models, Services, Stores, Design)
- [wagerproof-ios-native/Wagerproof/Features/Onboarding/README.md](wagerproof-ios-native/Wagerproof/Features/Onboarding/README.md) — 25-step onboarding flow + custom paywall
- [wagerproof-android-native/docs/PARITY.md](wagerproof-android-native/docs/PARITY.md) — Android↔iOS parity status
- [wagerproof-android-native/docs/inventory/](wagerproof-android-native/docs/inventory/) — Android module inventory (11 docs, snapshot 2026-07-07)

## Integrations
- [wagerproof-mcp/README.md](wagerproof-mcp/README.md) — Public read-only MCP connector (Cloudflare Worker)
- [wagerproof-tool-core/README.md](wagerproof-tool-core/README.md) — Shared tool logic behind the MCP connector

## Research
- [docs/MODEL_RESEARCH_FINDINGS.md](docs/MODEL_RESEARCH_FINDINGS.md) — Bet-type ledger: which markets have a confirmed model edge

## Archive
- [docs/wagerproof-migration/REBUILD_PLAN.md](docs/wagerproof-migration/REBUILD_PLAN.md) — Record of the finished RN→SwiftUI port. Frozen 2026-06-12; paths in that tree are stale.
- [docs/MLB_MODEL_INCIDENT_2026_05_07.md](docs/MLB_MODEL_INCIDENT_2026_05_07.md) — Incident postmortem (historical)

## Other
- [docs/BLOG_CONTENT_STRATEGY.md](docs/BLOG_CONTENT_STRATEGY.md) — Blog content and marketing strategy

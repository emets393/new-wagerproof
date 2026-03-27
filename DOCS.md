# WagerProof Documentation Index

## Getting Started
- [README.md](README.md) — Project overview, setup, and architecture
- [.env.example](.env.example) — Required environment variables
- [wagerproof-mobile/README.md](wagerproof-mobile/README.md) — Mobile app setup, navigation, and build process
- [GIT_SUPABASE_SETUP.md](GIT_SUPABASE_SETUP.md) — Git and Supabase project setup notes

## Architecture & Systems
- [.claude/docs/00_CODEBASE_OVERVIEW.md](.claude/docs/00_CODEBASE_OVERVIEW.md) — Full codebase overview (pages, components, services, hooks)
- [.claude/docs/08_database_caching.md](.claude/docs/08_database_caching.md) — Dual-Supabase architecture and caching strategy
- [.claude/docs/11_edge_functions.md](.claude/docs/11_edge_functions.md) — All 35 Supabase Edge Functions
- [.claude/docs/06_auth_seo_deploy.md](.claude/docs/06_auth_seo_deploy.md) — Auth flow, SEO, and deployment (Netlify + EAS)

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
- [docs/MLB_PREDICTIONS_PAGE.md](docs/MLB_PREDICTIONS_PAGE.md) — MLB predictions page implementation
- [.claude/docs/12_support_center.md](.claude/docs/12_support_center.md) — Support center: collections, articles, search, static build

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
- [.claude/docs/agents/20_PIXEL_OFFICE_FULL_SPEC.md](.claude/docs/agents/20_PIXEL_OFFICE_FULL_SPEC.md) — Pixel Office visual system spec
- [.claude/docs/agents/21_PIXEL_OFFICE_ROOM_DESIGN.md](.claude/docs/agents/21_PIXEL_OFFICE_ROOM_DESIGN.md) — Pixel Office room design specs
- [docs/agent-system-prompt-full.md](docs/agent-system-prompt-full.md) — Complete agent system prompt
- [docs/agent-system-prompt-edge-accuracy-and-situational-trends.md](docs/agent-system-prompt-edge-accuracy-and-situational-trends.md) — Agent edge accuracy rules

## Polymarket Integration
- [polymarket-implementation-docs/README.md](polymarket-implementation-docs/README.md) — Polymarket docs overview and usage scenarios
- [polymarket-implementation-docs/polymarket-api-reference.md](polymarket-implementation-docs/polymarket-api-reference.md) — API endpoints and payloads
- [polymarket-implementation-docs/polymarket-code-patterns.md](polymarket-implementation-docs/polymarket-code-patterns.md) — Reusable code patterns
- [polymarket-implementation-docs/polymarket-implementation-steps.md](polymarket-implementation-docs/polymarket-implementation-steps.md) — Step-by-step integration guide
- [polymarket-implementation-docs/polymarket-troubleshooting.md](polymarket-implementation-docs/polymarket-troubleshooting.md) — Common issues and solutions

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

## Other
- [docs/BLOG_CONTENT_STRATEGY.md](docs/BLOG_CONTENT_STRATEGY.md) — Blog content and marketing strategy
- [plan.md](plan.md) — Current onboarding refactor plan

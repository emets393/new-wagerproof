# Scripts

Utility scripts for building, testing, debugging, and data operations. Organized by category below.

## Build & Deploy

These are called by `npm run build` and should not normally be run manually.

| Script | Command | What it does |
|--------|---------|-------------|
| `build-blog.mjs` | `node scripts/build-blog.mjs` | Fetches posts from Ghost CMS and generates static blog HTML pages in `dist/blog/`. Requires `GHOST_URL` and `GHOST_CONTENT_KEY` env vars. |
| `build-support.mjs` | `node scripts/build-support.mjs` | Generates the support/help page HTML in `dist/support/`. |
| `build-sitemap.mjs` | `node scripts/build-sitemap.mjs` | Generates `dist/sitemap.xml` from static pages and blog posts. Run after `build-blog`. |
| `verify-blog-build.mjs` | `node scripts/verify-blog-build.mjs` | Validates blog build output — checks HTML files exist and contain expected content. |
| `prerender.js` | `node scripts/prerender.js` | Pre-renders key routes (`/`, `/home`, `/privacy-policy`, `/terms-and-conditions`) via Puppeteer for SEO. Runs automatically as `postbuild`. |

## Agent Testing

Use these when developing or debugging the AI agent pick generation pipeline.

| Script | Command | What it does |
|--------|---------|-------------|
| `run-agent-pick.mjs` | `node scripts/run-agent-pick.mjs [nba\|ncaab]` | End-to-end agent pick generation — fetches game data, builds payload with edge accuracy and situational trends, calls OpenAI API. Requires `OPENAI_API_KEY`, Supabase credentials. |
| `test-avatar-game-data-payloads.mjs` | `npm run test:avatar-game-data-payloads` | Generates and audits game data payloads for a specific avatar. Use `--avatar-id UUID`, `--date YYYY-MM-DD`, `--strict-polymarket` flags. |
| `test-avatar-pick-audit-flow.mjs` | `npm run test:avatar-pick-audit-flow` | Tests the complete pick audit flow — generation, validation, and response shape. Use `--avatar-id UUID`, `--user-id UUID` flags. |
| `backfill-leaderboard-agents.sql` | Run in Supabase SQL Editor | Seeds 10 test agents with ~70% win rate picks for leaderboard testing. Also patches the performance calculation function. |

**When to use**: Run `test-avatar-game-data-payloads` after changing data fetch logic in edge functions. Run `test-avatar-pick-audit-flow` after changing prompt templates or validation. Run `run-agent-pick` for a full end-to-end smoke test.

**Related docs**: `.claude/docs/agents/09_GAME_DATA_AUDIT_RUNBOOK.md`, `.claude/docs/agents/10_GENERATION_V2_QUEUE.md`

## Edge Function & API Testing

Use these to verify edge functions, streaming endpoints, and external APIs are working.

| Script | Command | What it does |
|--------|---------|-------------|
| `test-edge-function.mjs` | `node scripts/test-edge-function.mjs` | Signs in to Supabase and calls the `get-gemini-key` edge function. Verifies auth + function invocation work. Requires `SUPABASE_EMAIL` and `SUPABASE_PASSWORD` env vars. |
| `test-wagerbot-stream.cjs` | `node scripts/test-wagerbot-stream.cjs` | Sends a test message to the BuildShip WagerBot streaming endpoint and logs the streamed response. Verifies streaming chat works end-to-end. |
| `test-roast-ws.mjs` | `node scripts/test-roast-ws.mjs` | Tests WebSocket connection to Google Gemini API for roast mode audio streaming. Requires `GEMINI_API_KEY` env var and `ws` package. |
| `test-polymarket-cache.sh` | `bash scripts/test-polymarket-cache.sh` | Tests the `update-polymarket-cache` edge function via Supabase CLI. Requires Supabase CLI installed and project linked. |

**When to use**: Run after deploying edge functions to verify they respond correctly. Run `test-wagerbot-stream` after BuildShip workflow changes. Run `test-roast-ws` after voice chat changes.

**Related docs**: `.claude/docs/11_edge_functions.md`, `.claude/docs/01_buildship_api.md`

## Database Diagnostics

Use these to inspect database state, check data availability, and debug data issues.

| Script | Command | What it does |
|--------|---------|-------------|
| `check_nba_predictions.mjs` | `node scripts/check_nba_predictions.mjs` | Checks if NBA predictions table has data. Quick health check for sports data pipeline. |
| `check-basketball-predictions.mjs` | `node scripts/check-basketball-predictions.mjs` | Checks NBA/NCAAB game data and predictions across multiple tables. Requires `.env` with Supabase vars. |
| `check-basketball-db.js` | `node scripts/check-basketball-db.js` | Validates basketball AI completion configs and existing completions in database. |
| `check-ncaab-game-id-mismatch.js` | `node scripts/check-ncaab-game-id-mismatch.js` | Compares NCAAB game IDs between main and CFB Supabase to find mismatches. |
| `check-ncaab-game-structure.js` | `node scripts/check-ncaab-game-structure.js` | Dumps structure of `v_cbb_input_values` view to understand NCAAB data shape. |
| `check-ncaab-logos.js` | `node scripts/check-ncaab-logos.js` | Identifies NCAAB teams missing logo URLs in team mapping table. Requires `.env.local`. |
| `check-ncaab-moneylines.js` | `node scripts/check-ncaab-moneylines.js` | Inspects moneyline columns and odds data structure from NCAAB games. |
| `check-live-sports.js` | `node scripts/check-live-sports.js` | Queries ESPN API endpoints to check which sports have live games right now. |
| `check_settings_esm.js` | `node scripts/check_settings_esm.js` | Reads `site_settings` table (ES module syntax). |
| `check_settings.js` | `node scripts/check_settings.js` | Reads `site_settings` table (CommonJS). Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. |
| `show-ncaab-games.js` | `node scripts/show-ncaab-games.js` | Lists current NCAAB games with team names and dates. |
| `diagnose-ncaab-mapping.js` | `node scripts/diagnose-ncaab-mapping.js` | Dumps `ncaab_team_mapping` table contents for debugging team name issues. |
| `query-basketball-schemas.js` | `node scripts/query-basketball-schemas.js` | Queries NBA/NCAAB table schemas from both Supabase projects to inspect column types. |

**When to use**: Run the `check-*` scripts when game data isn't showing up in the app or predictions seem wrong. The NCAAB scripts are particularly useful since NCAAB has the most complex team mapping.

**Related docs**: `.claude/docs/04_sports_predictions.md`, `.claude/docs/08_mobile_data_fetching.md`

## Polymarket

| Script | Command | What it does |
|--------|---------|-------------|
| `check-polymarket-ncaab-events.js` | `node scripts/check-polymarket-ncaab-events.js` | Checks if Polymarket API has NCAAB events. Useful for verifying sport coverage. |
| `fetch-polymarket-cbb-teams.js` | `node scripts/fetch-polymarket-cbb-teams.js` | Fetches all college basketball teams from Polymarket API with pagination. Saves output to file. |

**Related docs**: `.claude/docs/09_polymarket_integration.md`, `polymarket-implementation-docs/`

## Data Population

One-time or rare scripts for populating reference data.

| Script | Command | What it does |
|--------|---------|-------------|
| `populate-ncaab-team-colors.mjs` | `node scripts/populate-ncaab-team-colors.mjs` | Extracts dominant colors from ESPN team logos and writes to `ncaab_team_mapping` table. Requires `node-vibrant` package. |
| `check-and-grant-admin.sql` | Run in Supabase SQL Editor | Checks user admin status and provides SQL to grant admin role. |

## SQL Utilities

Located in `scripts/sql/`:

| Script | What it does |
|--------|-------------|
| `create_todays_games_predictions_with_accuracy_view.sql` | Creates a Supabase view joining today's games with predictions and accuracy metrics. |
| `get_views_schema_and_columns.sql` | Queries metadata to list all views and their column definitions. |

## Discord

| Script | What it does |
|--------|-------------|
| `test-discord-basketball-picks.html` | HTML page that tests Discord webhook formatting for basketball editor picks. Open in browser. |

**Related docs**: `.claude/docs/11_edge_functions.md` (see `send-discord-notification`)

## Notes

- Most scripts use hardcoded Supabase credentials or expect them in `.env` / `.env.local`. Check the script header before running.
- Scripts prefixed with `check-` are read-only diagnostics. Scripts prefixed with `test-` make API calls but don't modify data (except `backfill-leaderboard-agents.sql`).
- The `npm run test:avatar-*` commands in `package.json` point to scripts in this directory.

# 02 — Services Layer Inventory (WagerproofServices → Kotlin)

Parity contract for porting `wagerproof-ios-native/WagerproofKit/Sources/WagerproofServices/` to
Android (`com.wagerproof.core.services`, Kotlin + supabase-kt + OkHttp).

**File count: 38 Swift files** — 35 top-level service files + 3 in `DummyData/` (DEBUG-only fixtures),
plus 1 bundled JSON resource (`Resources/nfl_dryrun_prop_best_books.json`). Verified 2026-07-06.

Related iOS files documented here because the parity contract requires them (they live outside
`WagerproofServices` but the Android services layer must absorb their behavior):

- `WagerproofStores/AuthStore.swift` — the actual auth flows (email/password, Apple, Google, reset).
- `Wagerproof/Features/Chat/WagerBotVoiceSession.swift` — OpenAI Realtime WebSocket + audio engine.
- `WagerproofSharedKit/AppGroup.swift` + `KeychainStore.swift` — storage keys.

---

## 1. External dependencies (Package.swift / Package.resolved)

| Swift package | Pinned version | Purpose | Android equivalent |
|---|---|---|---|
| `supabase/supabase-swift` | 2.46.0 (from: 2.0.0) | DB / Auth / Functions / RPC | `supabase-kt` (postgrest, auth, functions modules) |
| `RevenueCat/purchases-ios` | 5.78.0 (from: 5.78.0) | Subscriptions | `com.revenuecat.purchases:purchases` (Android SDK) |
| `google/GoogleSignIn-iOS` | 7.1.0 (from: 7.0.0) | Google auth (idToken mint) | Credential Manager + `googleid` (Sign in with Google) |
| `mixpanel/mixpanel-swift` | 4.4.0 (from: 4.3.0) | Analytics | `com.mixpanel.android:mixpanel-android` |
| `airbnb/lottie-ios` | 4.6.0 (from: 4.4.0) | Onboarding animations (Design layer, not Services) | `com.airbnb.android:lottie-compose` |
| `facebook/facebook-ios-sdk` (FacebookCore) | 17.4.0 (from: 17.0.0) | Meta App Events attribution | `com.facebook.android:facebook-core` |

Transitive pins (informational, iOS-only): AppAuth-iOS 1.7.6, gtm-session-fetcher 3.5.0, GTMAppAuth 4.1.1,
swift-asn1/clocks/concurrency-extras/crypto/http-types, xctest-dynamic-overlay.

Layering rule (keep on Android): **Models** (pure data, no SDKs) ← **Services** (SDK wrappers, stateless)
← **Stores** (observable app state). SharedKit ≈ a tiny extension-safe module (App-Group prefs + Keychain).

---

## 2. Supabase projects & client configuration

Two projects, two clients. Defined in `SupabaseConfig.swift` + `SupabaseClients.swift`.

### Main project — `gnjrklxotmbvnxbnnqgq`
- URL: `https://gnjrklxotmbvnxbnnqgq.supabase.co`
- Anon key (**hardcoded in source, deliberately** — comment says keep visible, RLS is the gate):
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduanJrbHhvdG1idm54Ym5ucWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0MDMzOTMsImV4cCI6MjA2NDk3OTM5M30.5jjBRWuvBoXhoYeLPMuvgAOB7izKqXLx7_D3lEfoXLQ`
- Owns: **auth**, profiles, chat threads/messages, agent tables (`avatar_*`), push tokens,
  `polymarket_markets` cache, `live_scores`, `preset_archetypes`, all edge functions.
- iOS wraps it in `actor MainSupabase { static let shared }` with the client as a property.
- Auth session storage: DEBUG builds use UserDefaults-backed storage (Keychain fails on unsigned
  simulator builds — `errSecMissingEntitlement`); RELEASE uses the SDK's Keychain default.
  Android note: supabase-kt persists sessions via SharedPreferences/DataStore by default — no
  equivalent workaround needed, but session persistence must survive process death.

### CFB / research project — `jpxnjuwglavsjbgbasnl`
- URL: `https://jpxnjuwglavsjbgbasnl.supabase.co`
- Anon key (hardcoded):
  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpweG5qdXdnbGF2c2piZ2Jhc25sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTc4NjEsImV4cCI6MjA2ODI3Mzg2MX0.BjOHMysQh3wST-_UR6bJxHngRThlAmOOx4FfSVKRzWo`
- **No auth ever** — anon-role RLS exposes all prediction/sports views.
- Owns: all sports/prediction data — `nfl_predictions_epa`, `nfl_betting_lines`, `nfl_teams`,
  `nfl_dryrun_*`, `cfb_live_weekly_inputs`, `cfb_api_predictions`, `cfb_teams`, `cfb_signal_defs`,
  `cfb_dryrun_games`, `nba_predictions`, `nba_input_values_view`, `ncaab_predictions`,
  `v_cbb_input_values`, `ncaab_team_mapping`, `mlb_*`, `signal_performance`, `*_trends`,
  `*_outliers_trend_cards`, `v_input_values_with_epa`.

`WagerproofAPI.swift` is a trivial facade actor exposing `main`/`cfb` — optional on Android
(a `SupabaseClients` object with `main` and `cfb` `SupabaseClient` singletons suffices).

---

## 3. Auth (AuthStore + GoogleSignInCoordinator)

All auth is Supabase Auth on the **Main** project. `AuthStore` (Stores layer, `@Observable @MainActor`)
subscribes to `client.auth.authStateChanges`; on `signedIn|tokenRefreshed|userUpdated|initialSession`
with a session → phase `.authenticated(userId)` + loads profile; on `signedOut` → `.unauthenticated`.
`passwordRecovery/userDeleted/mfaChallengeVerified` are ignored.

| Flow | Implementation | Notes |
|---|---|---|
| Email sign-in | `client.auth.signIn(email:password:)` | Errors surfaced via `localizedDescription` into `lastError` |
| Email sign-up | `client.auth.signUp(email:password:redirectTo: URL("wagerproof://"))` | `emailRedirectTo` = `wagerproof://` — **byte-for-byte with RN** |
| Password reset | `client.auth.resetPasswordForEmail(email, redirectTo: URL("wagerproof://reset-password"))` | Deep-link scheme must be registered on Android |
| Sign out | `client.auth.signOut()` | Also: RevenueCat `logOut()`, `NotificationService.deactivatePushTokens` are called by callers |
| Apple | View does the ASAuthorization dance → `client.auth.signInWithIdToken(provider: .apple, idToken:, nonce:)` | Android: not applicable (or keep for parity only if Apple-on-Android is desired — generally skip) |
| Google | `GoogleSignInCoordinator` (below) → `client.auth.signInWithIdToken(provider: .google, idToken:, accessToken:)` | User-cancel is silently swallowed |
| Profile load | `from("profiles").select().eq("id", userId).single()` → `Profile` | Failure silent — new sign-ups have no profile yet; onboarding creates it |

### GoogleSignInCoordinator.swift
- Singleton-ish `@MainActor` class; static `configureIfNeeded()` (idempotent) sets `GIDConfiguration`
  with the iOS client ID `142325632215-agrfdkh87j01kgfa4uv4opuohl5l01lq.apps.googleusercontent.com`
  (hardcoded; same as the RN app).
- `signIn(presenting:)` — calls `GIDSignIn.signOut()` FIRST (forces account picker every time, matches
  RN), then runs the flow, returns `(idToken, accessToken)`. Throws `GoogleSignInError.missingIDToken`
  if no idToken.
- **Android**: use Credential Manager `GetGoogleIdOption` with the **web/server client ID** of the same
  Google Cloud project (the iOS client ID won't work for Android; a matching Android OAuth client +
  the web client ID for the idToken audience must exist). Then
  `supabase.auth.signInWith(IDToken) { provider = Google; idToken = ... }`. To mirror "always show
  picker", set `filterByAuthorizedAccounts = false` / clear credential state.

---

## 4. Core service files (A–Z)

### AgentAuthorizedActionsService.swift
- Purpose: generic client for the `agent-authorized-action-v1` edge function (Main project). Every
  authenticated agent server action funnels through it.
- Pattern: `public enum` (namespace of statics). Error enum: `noSession` / `server(String)` /
  `malformedResponse`.
- `invoke<Body, Response>(body:as:fallbackMessage:)` — resolves `client.auth.session` (throws
  `noSession` if nil), calls `client.functions.invoke("agent-authorized-action-v1")` with an
  **explicit `Authorization: Bearer <accessToken>` header** (workaround: SDK sometimes drops auto-auth
  on `verify_jwt=false` functions — replicate the explicit header in Kotlin). Response envelope:
  `{ success: Bool, data: T?, error: String? }`; success+data → return data; else throw
  `server(error ?? fallback)`. Envelope decoding is lenient (missing `success` → false).
- `detailSnapshot(agentId)` — body `{action:"detail_snapshot", agent_id}` → `AgentDetailSnapshot`
  (agent + perf + today's picks + today's generation run + can_view + is_following).
- `createAgent(payload: [String: AnyEncodable])` — `{action:"create_agent", data:{...}}` → `Agent`.
- `updateAgent(agentId, payload)` — `{action:"update_agent", agent_id, data:{...}}` → `Agent`.
- `picksPage(agentId, filter="all", pageSize=20, cursor, includeOverlap=false, gameDate)` — body
  `{action:"picks_page", agent_id, filter, page_size, cursor, include_overlap, game_date}` →
  `AgentPicksPage` (cursor pagination).
- `AnyEncodable` box for heterogeneous payloads → Kotlin: `JsonObject`/`JsonElement` (kotlinx).

### AgentChatService.swift
- Purpose: private user↔agent chat thread. Table `agent_chat_messages` (Main, RLS owner-only).
- `fetchThread(userId, agentId, limit=200)` — select all, `eq user_id`, `eq avatar_id`,
  order `created_at` asc, limit → `[AgentChatMessage]`.
- `sendUserMessage(userId, agentId, content)` — insert `{user_id, avatar_id, role:"user", content}`
  with `returning: .representation` → first row (throws if none) so optimistic UI can swap in the
  canonical id/timestamp.
- `requestAssistantReply(agentId)` — via `AgentAuthorizedActionsService.invoke` with
  `{action:"agent_chat_reply", agent_id}` → `AgentChatMessage` (edge function generates + persists).
- `setFollow(userId, agentId, follow)` — insert/delete row on `user_avatar_follows`
  (`{user_id, avatar_id}`).

### AgentPerformanceService.swift
- Purpose: per-agent perf reads + leaderboard (Main project).
- Enums: `LeaderboardSortMode` = `overall | recent_run | longest_streak | bottom_100`;
  `LeaderboardTimeframe` = `all_time | last_7_days | last_30_days` (with display labels).
- `fetchPerformance(agentId)` — `avatar_performance_cache` select, eq `avatar_id`, limit 1 → first.
- `fetchLeaderboard(limit=100, sport?, sortMode=.overall, excludeUnder10Picks=false,
  timeframe=.allTime, viewerUserId?)` — RPC `get_leaderboard_v2` with params
  `{p_limit, p_sport, p_sort_mode, p_timeframe, p_exclude_under_10_picks, p_viewer_user_id}` →
  `[AgentLeaderboardEntry]`.
- `recalculate(agentId)` — RPC `recalculate_avatar_performance` `{p_avatar_id}` (fire-and-forget).

### AgentPicksService.swift
- Purpose: reads on `avatar_picks` / `avatar_parlays` (Main, RLS) + V3 generation kickoff.
- `fetchPicks(agentId, limit?)` — `avatar_picks` select, eq `avatar_id`, order `game_date` desc,
  `created_at` desc, opt limit. **Decoded with `AgentPick.decodeLossyArray(from: response.data)`** —
  a lossy row-by-row decoder that skips malformed rows instead of failing the batch (replicate in
  Kotlin: decode each JSON array element in try/catch).
- `fetchGradedPickHistory(agentId, limit)` — same + `lt game_date < todayLocal` +
  `in result ["won","lost","push"]`.
- `fetchTodaysPicks(agentId)` — eq `game_date == todayLocal`, order created_at desc, limit 25.
- `fetchUpcomingFeed(agentIds, limit=50)` — in `avatar_id`, `game_date` between today and today+3,
  order created_at desc.
- Parlay siblings over `avatar_parlays` with embedded legs — select string
  `"*, legs:avatar_parlay_legs(*)"` (embed alias keeps JSON key `legs`): `fetchParlays`,
  `fetchGradedParlayHistory` (uses `target_date`), `fetchTodaysParlays`, `fetchUpcomingParlaysFeed`.
  All decode via `AgentParlay.decodeLossyArray`.
- `fetchTopAgentPicksFeed(filterMode="top10", viewerUserId?, searchText?, limit=50, cursor?)` — RPC
  `get_top_agent_picks_feed_v2` `{p_filter_mode, p_viewer_user_id, p_search_text, p_limit, p_cursor}`
  → `[TopAgentPickFeedRow]`.
- `fetchDetailSnapshot` / `fetchPicksPage` — delegates to AgentAuthorizedActionsService.
- `requestTriggerV3Generation(agentId, idempotencyKey?, dryRun?, modelName?)` — edge function
  `trigger-v3-run` with explicit bearer header, body
  `{avatar_id, idempotency_key, dry_run, model_name}` → `GenerationRequestResult`. Caller then polls
  `TriggerRunStatusService`.
- Date helper: `localDateString` = **device-local** `yyyy-MM-dd` (Gregorian components — NOT ET).

### AgentService.swift
- Purpose: CRUD on `avatar_profiles` (Main). Column projections copied from RN:
  - `listColumns` (slim, no JSONB): `id, user_id, name, avatar_emoji, avatar_color, preferred_sports,
    archetype, is_public, is_active, created_at, updated_at, auto_generate, auto_generate_time,
    auto_generate_timezone, is_widget_favorite, last_generated_at, last_auto_generated_at,
    owner_last_active_at, daily_generation_count, last_generation_date`
  - `performanceColumns`: `avatar_id, wins, losses, pushes, total_picks, win_rate, net_units,
    current_streak, best_streak, worst_streak, last_calculated_at`
- `fetchUserAgents(userId)` — agents (eq user_id, order created_at desc) then perf rows
  `in avatar_id`; perf failure swallowed (agents render with `performance: nil`) →
  `[AgentWithPerformance]`.
- `fetchAgent(id)` — `select()` (full row incl. JSONB), limit 1, + perf row (nil on error).
- `delete(agentId)` — delete eq id (FK cascades picks + perf).
- `setActive` / `setPublic` / `setAutoGenerate` — patch `{flag, updated_at: nowISO-with-fractional}`.
- `create(input: CreateAgentInput)` — edge `agent-authorized-action-v1` with
  `{action:"create_agent", data:{ name, avatar_emoji, avatar_color, preferred_sports, archetype,
  personality_params, custom_insights, auto_generate, auto_generate_time, auto_generate_timezone }}`
  (snake_case keys) → `Agent`; server does RevenueCat gating + Zod validation.

### AnalyticsService.swift (Mixpanel)
- Singleton class, `bootstrap(token:)` → `Mixpanel.initialize(token:, trackAutomaticEvents: false)`,
  idempotent. `track(event, properties)`, `identify(userId)` (distinctId = Supabase user id),
  `reset()` on sign-out. All calls guard on `initialized`.
- **Token source**: not hardcoded — intended to come from a generated `Secrets.swift`
  (`scripts/generate-secrets.sh`, mirrors RN `EXPO_PUBLIC_MIXPANEL_TOKEN`). As of today the app's
  `WagerproofApp.init` has a "Phase 2" comment and does not yet call `bootstrap` with a real token.
  Android: read from `BuildConfig`/`local.properties`, same event names as RN's `services/analytics.ts`.

### CFBSignalDefinitionsService.swift
- Purpose: signal glossary for CFB betting signals. Actor with in-memory cache (whole-table, fetched once).
- `definitionsBySource()` — CFB project `cfb_signal_defs` select all → dictionary keyed by
  **normalized** match keys. Each row indexes under many aliases: `source`, `signal_key`,
  `signal_name`, `slug`, `id`, `display_name`, plus per-key hardcoded legacy aliases (e.g. `key_dog` →
  "KEY dog +2.5/3/3.5 (HOME dog)"…). Errors → cached empty map.
- `normalize(String)` — trim, lowercase, `_`/`-`→space, strip non-alphanumerics to spaces, collapse.
- `definition(for:in:)` — tries normalized candidates → `legacySignalKey(for:)` (a ~30-entry hardcoded
  fuzzy mapping of legacy display strings to signal keys — port verbatim) → last-resort fuzzy contains
  scan.
- `normalizedCandidates(for:)` — variants: full string, before `(`, before/after `:`, split on `/`.
- Row decoding uses a `FlexibleText` wrapper (string|int|double|bool → string) because column types
  are inconsistent — replicate with a lenient deserializer in Kotlin.

### CFBTeamsService.swift
- Actor, `ensureLoaded()` once per launch. CFB project `cfb_teams` select
  `team_name, abbr, conference, classification, color, alt_color, logo, logo_dark` →
  `CFBTeamAssets.install(teams)` on main thread (in-memory static team-asset cache used by cards).
  Silent failure.

### GoogleSignInCoordinator.swift — see §3 Auth.

### LiveScoresService.swift
- Purpose: scoreboard = live scores (Main) + model-prediction overlays (CFB project). Actor singleton.
- `getLiveScores()` → `[LiveGame]`:
  1. Main `live_scores` select, `eq is_live=true`, order league asc, away_abbr asc. Normalizes:
     `gameId ?? id`, `period ?? ""`, `lastUpdated ?? now`. **This is the only hard-fail step.**
  2. Concurrently fetch predictions per league (each swallows errors → `[]`):
     - **NFL**: `nfl_predictions_epa` — latest `run_id` where `game_date >= todayUTC` (order run_id
       desc limit 1), then select `training_key, home_team, away_team, home_away_ml_prob,
       home_away_spread_cover_prob, ou_result_prob` for that run; merge lines from
       `nfl_betting_lines` (`training_key, home_spread, away_spread, over_line`).
     - **CFB**: `cfb_live_weekly_inputs` (all) + `cfb_api_predictions` (all), joined by `id`; api row's
       pred scores override input's.
     - **NBA**: `nba_predictions` latest run by `as_of_ts_utc` desc; join `nba_input_values_view`
       (`game_id, home_spread, total_line`). Derived probabilities (port exactly):
       spreadCoverProb = `0.5 ± min(|vegas−model|*0.05, 0.35)` (+ when model < vegas), fallback
       home_win_prob; ouProb = `0.5 ± min(|modelTotal−vegasTotal|*0.02, 0.35)`.
     - **NCAAB**: `ncaab_predictions` latest run; ouProb = predTotal > vegasTotal ? 0.6 : 0.4;
       spread cover proxy = home_win_prob.
  3. Match predictions to live games: league switch on `game.league.uppercased()`
     ("NFL", "CFB"/"NCAAF", "NBA", "NCAAB"). NBA/NCAAB try numeric id first (strip "NBA-"/"NCAAB-"
     prefix), fall back to fuzzy team match. Fuzzy match: exact normalized names, else first-token
     containment both directions on both sides.
  4. `computePredictions` (port exactly — it drives the hitting/missing badges): for ML pick home if
     prob>0.5, hitting = picked side currently leading; spread `adjustedDiff = (home−away)+line`,
     hitting = pickedHome ? >0 : <0; O/U over if prob>0.5, hitting = total vs line. Probability
     displayed is the picked side's (`prob` or `1−prob`). Any hit → `hasAnyHitting = true`.
  CFB fallbacks: mlProb nil → predHome>predAway ? 0.6:0.4; spreadProb nil → homeSpreadDiff>0?0.6:0.4;
  ouProb nil → overLineDiff>0?0.6:0.4. NBA/NCAAB analogous fallbacks off model-fair numbers.

### MetaAnalyticsService.swift (Facebook)
- Singleton; `initialize()` = FB SDK app-launch hook + `isAutoLogAppEventsEnabled = false`
  (only explicit events; RevenueCat does server-side Meta CAPI — avoid double counting).
- `handleAppDelegate(url:options:)` — FB URL callback consumption (deep-link short-circuit).
- `anonymousID()` — `AppEvents.shared.anonymousID`; fed to RevenueCat as `fb_anon_id` subscriber
  attribute for CAPI joins.
- `trackCompleteRegistration(method:)` — `fb_mobile_complete_registration` with
  `registrationMethod`, `fb_content_name: "WagerProof Onboarding"`, `fb_success: "1"`.
- `trackPurchase(amount, currency, params)` — `logPurchase` (trial starts map to Purchase).
- `trackSubscribe(amount, currency, params)` — `Subscribe` event, `valueToSum` = amount,
  `fb_currency` param.
- `flush()` — force-send after paywall conversion.
- Android: `facebook-core` `AppEventsLogger` — `logPurchase(BigDecimal, Currency)`,
  `EVENT_NAME_COMPLETED_REGISTRATION`, `EVENT_NAME_SUBSCRIBE`, `AppEventsLogger.getAnonymousAppDeviceGUID`.
  Disable auto events via manifest `com.facebook.sdk.AutoLogAppEventsEnabled=false`.

### MLBPlayerPropPicksService.swift
- Purpose: MLB "Best Picks Report" (CFB project). Actor singleton.
- `fetchTodaysPicks(reportDate)` — `mlb_player_prop_picks` select all, eq `report_date`, order
  `score` desc → `[MLBPlayerPropBestPick]`. Row decode is fully lenient (flexInt/flexDouble accept
  int|string|double; defaults e.g. side="over", kind="batter", tier="lean"; `rationale` decodes as
  `[String]` or empty).
- `fetchGradeSummary()` — view `v_mlb_player_prop_grade_summary` select all → per tier/market/kind
  aggregate (picks_total/won/lost/push/pending, win_pct, units_staked/won, roi_pct).
- `fetchGradeHistory(limit=200)` — `mlb_player_prop_grades` select (explicit 19-col list), order
  report_date desc, score desc.
- `todayET()` — `yyyy-MM-dd` in America/New_York (report date key).

### MLBPlayerPropsService.swift
- Purpose: MLB player-props matchups feed (CFB project, anon).
- `fetchMatchups()` → `[MLBPropMatchup]`:
  1. `mlb_games_today` — window `official_date` in [todayET, todayET+2], order date+time asc.
     Eligible = not postponed AND both `away_sp_id`/`home_sp_id` AND `game_pk` present.
  2. Concurrent: `mlb_game_lineups` (in game_pk, order batting_order asc);
     `v_mlb_pitcher_archetypes` select `pitcher_id, archetype, k_pct, gb_pct, fb_pct, bb_pct,
     max_fb_velo` eq season, in pitcher_id; `mlb_team_mapping` (all);
     props per game via RPC `get_mlb_player_props_l10({p_game_pk})` fanned out in a task group
     (per-game failure → empty list).
  3. Assembly: abbr/logo resolution order = mapping by team id → mapping by normalized name →
     static `MLBTeams.info` → first-letters fallback (up to 3 initials uppercased). Lineups split by
     team id, sorted by batting order (nil → 999). Starters default hand "R".
- `fetchProps(gamePk)` — single-game RPC refresh, throws.

### MLBTrendsEngine.swift  *(pure logic — no network)*
- Client-side MLB Outliers trend-card builder from `mlb_team_trends` splits/matchups.
- Public API: `allGamesPreviewCap=50`; `trendsAbbr(for:)` / `appAbbr(forTrendsAbbr:)` — app↔trends
  abbr remap table (`ARI→AZ, OAK→ATH, SFG→SF, SDP→SD`); `remapTeamRecord(_:preferredAppAbbr:)`;
  `isDivisionGame(home:away:)` (hardcoded 6-division table); `gameContext(for:)` (fav/dog off ML,
  division scope, day/night, series dimension); `isDayGame(kickoff:)`; `buildCards(...)` (the big
  card assembler over markets `ml, rl, ou, f5_ml, f5_rl, f5_ou`); `marketLabel(_:)`.
- Port as a pure Kotlin object with unit tests against captured fixtures.

### NFLPlayerPropsService.swift
- Purpose: NFL player-props board (CFB project, dry-run tables = the 2026 production data contract;
  only table names change at cutover).
- `fetchPlayers()` — warms `NFLTeamsService`, then `nfl_dryrun_props` select all order
  `player_name` asc (~950 rows, one curated week, no date filter); `nfl_dryrun_games` select
  `game_id, gameday, slot` (best-effort — miss degrades to undated cards). Grouping/shaping is
  delegated to `NFLPlayerProps.group(rows, games, bestBooksFallback)` in Models.
- Best-shop fallback: bundled JSON `nfl_dryrun_prop_best_books.json` keyed `player_id|market`
  (see NFLPropBestBooksBundle) until the table carries those columns.

### NFLPropBestBooksBundle.swift
- Loads the bundled JSON resource once into `index: [String: NFLPropBestBooksRecord]`
  (fields `best_over_book/_name/_logo/_line/_price` + under equivalents). Android: ship the same JSON
  in `assets/` or `res/raw` and lazy-load.

### NFLTeamsService.swift
- Actor, `ensureLoaded()` once. CFB project `nfl_teams` select
  `team_abbr, team_name, team_nick, logo_espn` → `NFLTeamAssets.install`. Silent failure.

### NFLTrendsEngine.swift  *(pure logic — no network)*
- NFL Outliers trend cards: game context, extreme-window stats, card assembly (ports
  `research/nfl-extreme-outcomes/CURSOR_OUTLIERS_TRENDS_PROMPT.md` §3–5).
- Public API: `playerPreviewCap=4`, `allGamesPreviewCap=50`; `isDivisionGame` (8-division table);
  `gameContext(for:)` (fav/dog from `fg_spread_close` sign, division scope, primetime = kickoff hour
  ≥19 ET); `isPrimetime(kickoff:)`; `filterPrecomputedCards(...)` (slate scope + subject + market
  filters + per-team player caps + overflow handling); `effectiveGameMarket(...)`;
  `buildCards(...)`; `marketLabel(_:)`. Team markets: `spread, moneyline, total, team_total,
  h1_spread, h1_total`; referee markets exclude team_total.
- Port as pure Kotlin object; ~840 lines of deterministic logic — highest-value target for
  shared test fixtures.

### NotificationService.swift
- Purpose: push permission + token registration (Main project). Table contract (byte-identical
  to RN):
  - Upsert `user_push_tokens` `{user_id, expo_push_token, platform, device_name, is_active:true,
    last_used_at, updated_at}` `onConflict: "user_id,expo_push_token"`.
  - Upsert `user_notification_preferences` `{user_id, auto_pick_ready:true}` onConflict `user_id`,
    `ignoreDuplicates:true` (failure non-fatal).
  - Sign-out: update `is_active=false` for all user rows.
- iOS stores the **raw APNs hex token in the `expo_push_token` column** (FIDELITY-WAIVER #051); the
  server-side dispatcher branches on token shape. **Android: store the FCM registration token in the
  same column, `platform: "android"`** — the enum already includes `android`. Confirm dispatcher
  handles bare FCM tokens (RN Expo tokens were `ExponentPushToken[...]`).
- `permissionStatus()` / `requestPermission()` — OS dialogs; Android 13+ = `POST_NOTIFICATIONS`
  runtime permission.
- `registerPushToken(userId: UUID)` — no-op if no cached token yet (best-effort, retried next call).
- `postGenerationFinishedNotification(agentId, agentName, picksGenerated, parlaysGenerated,
  succeeded, note?)` — **local** notification for manual agent runs. Only fires when app NOT
  foreground-active; undetermined permission quietly upgrades to provisional (Android: just check/ask
  POST_NOTIFICATIONS). Body composed from pick/parlay counts or the pass note; failure title
  "hit a snag". `threadIdentifier`/request id = `generation-finished-<agentId>` so re-runs replace
  the banner (Android: stable notification id per agent). userInfo:
  `{avatar_id, type:"generation_finished"}`.

### OutliersService.swift
- Purpose: Outliers tab data — week games + value alerts (Polymarket divergence) + fade alerts
  (model extremes). MLB intentionally absent (matches RN).
- `fetchWeekGames()` → `[OutlierGame]` (window: today..+7 days ET; each sport best-effort):
  - **NFL** (CFB proj): `v_input_values_with_epa` order game_date/game_time asc + `nfl_betting_lines`
    (explicit 21-col select incl. handle/bets/splits-label cols) order `as_of_ts` desc; keep FIRST
    row per training_key (= most recent). gameTime = line's `game_time_et` else `"{date}T{time}"`.
    homeSpread = line ?? row; awaySpread = −homeSpread; total = line.over_line ?? ou_vegas_line.
  - **CFB**: `cfb_live_weekly_inputs`; date = first non-nil of start_date/start_time/game_datetime/
    datetime/date parsed to ET day.
  - **NBA**: `nba_input_values_view` order game_date asc; away ML = explicit column else complement
    formula (`ml>0 ? −(ml+100) : 100−ml`); abbrevs fall back to team names.
  - **NCAAB**: `v_cbb_input_values` + `ncaab_team_mapping` (`api_team_id, espn_team_id, team_abbrev`)
    in parallel; logo = `https://a.espncdn.com/i/teamlogos/ncaa/500/{espn_team_id}.png`.
    NOTE: CodingKeys for ML are literally `homeMoneyline`/`awayMoneyline` (camelCase in the view).
  - then `hydratePredictions` (below).
- `hydratePredictions` (CFB proj): NFL — latest run_id from `nfl_predictions_epa`, preds
  `in training_key`; CFB — `cfb_api_predictions` all, joined by numeric id; NBA — `nba_predictions`
  (9-col select), keep latest per game_id by `as_of_ts_utc`, derive coverProb/ouProb with the same
  0.05/0.02 ± cap-0.35 heuristics as LiveScores, spreadDiff = modelFair − vegas, totalDiff analog;
  NCAAB — latest run, preds keyed by game_id, vegas lines from pred row override game. Game id for
  NBA/NCAAB = numeric tail of `gameId.split("_").last`.
- `fetchValueAlerts(weekGames)` — Main project `polymarket_markets` per league:
  select `game_key, market_type, current_away_odds, current_home_odds`, eq league,
  `in game_key` where key = `"{league}_{away}_{home}"`. Skip stale/resolved/no-liquidity:
  any side ≥95 or ≤5, or sum <80. Thresholds: spread side >57 → alert; total (away=Over, home=Under)
  >57; moneyline ≥85 AND book ML better than −200 (or 0/missing).
- `fetchFadeAlerts(weekGames)` — pure thresholds: NFL spread/total conf ≥80 (prob-based);
  CFB |homeSpreadDiff|>10 spread, |overLineDiff|>10 total (confidence = rounded |edge|);
  NBA spread only, |edge|≥9.5; NCAAB spread/total |edge|>5. `predictedTeam` = model-favored side
  (widget computes the fade opposite).
- Date helpers: ET (`America/New_York`) `yyyy-MM-dd`; `formatETDate` parses ISO8601
  (±fractional), bare `yyyy-MM-dd` (trusted as-is), and space-separated ISO.

### OutliersTrendsService.swift
- Purpose: trends snapshots + dry-run slates (CFB project). Queries are slim-column & slate-scoped
  (full-table coach/ref pulls were ~4MB and timed out — keep this discipline on Android).
- `fetchPrecomputedCards(sport, season, week)` — table `nfl_outliers_trend_cards` or
  `cfb_outliers_trend_cards`, eq season+week, order `sort_rank` desc, select 16-col card projection
  (`card_id, game_id, matchup_label, subject_kind, subject_name, subject_detail, team_abbr,
  player_id, market_key, bet_type_label, trend_value, trend_sample_n, headshot_url, rows,
  betting_lines, is_player_overflow`). `rows` / `betting_lines` are JSONB arrays with their own
  shapes (`{id,text,coverage_note,dominant_pct,sample_n}` / `{id,label,line_text,odds_text,
  book_name,book_logo_url,team_abbr}`).
- `fetchSlateGames(sport)` — NFL: anchor = latest (season,week) from `nfl_dryrun_games`, then rows
  for that slate (cols incl. `home_ab/away_ab, fg_spread_close, fg_total_close, kickoff, slot,
  assigned_referee`), order kickoff asc. CFB: same over `cfb_dryrun_games` (no abbr/slot/ref cols).
  MLB: today-ET rows from `mlb_games_today` (ML/spread/total + f5_* cols), filter postponed, then
  enrich: `mlb_signal_features_pregame` (`game_pk, series_game_number`, prefer home rows),
  `mlb_odds_snapshots` (spread/total odds + f5 variants, latest per pk by fetched_at),
  `mlb_team_mapping` for abbrs.
- `fetchNFLBundle()` — slate + `fetchTrendData(games, season, throughWeek = week−1)`:
  parallel selects, all eq season/through_week and scoped `in` team/ref lists —
  `nfl_team_trends` (`team_abbr, team_name, season, through_week, splits, matchups`),
  `nfl_coach_trends` (+ `coach, current_team, career_games, last_season, market_coverage`),
  `nfl_referee_trends` (`referee, career_games, …, splits, market_coverage`),
  `nfl_player_prop_trends` (`player_id, player_name, position, current_team, markets, coverage, …`).
- `fetchMLBBundle()` — slate games → abbr set → `mlb_team_trends` eq season in trendsAbbrs →
  remapped via MLBTrendsEngine; throughDate = max of team throughDates.
- **Splits/matchups JSONB decoding** (port exactly): splits =
  `{market: {dimension: {window: {h, l, p?, n, pct?}}}}` — pct defaults to `h/n`; matchups =
  `{opponentAbbr: {meetings?, <marketKey>: {h, n, pct?}}}`. Lots of lenient decoding
  (int-or-string game_pk, numeric widening) — mirror with custom serializers.

### OutliersWidgetService.swift
- Composes the "Top Outliers" home-screen widget payload: `sync()` = `fetchWeekGames` →
  value+fade alerts concurrently → map to `OutlierAlertForWidget` (id prefixed `value-`/`fade-`,
  confidence = rounded percentage / raw confidence) → sort desc, take 6 → read-modify-write the
  shared App Group JSON payload (only replaces `topOutliers` + `lastUpdated`). Never called from the
  widget process itself (too expensive) — main app only. Android: Glance/AppWidget +
  SharedPreferences/DataStore file shared with the widget.

### PlatformStatsService.swift
- Population analytics RPCs (Main project).
- `fetchAgentDistribution(minDecided=1)` — RPC `get_agent_performance_distribution`
  `{p_min_decided}` → `[AgentStatDatum]` (raw per-agent rows; all re-bucketing is client-side).
- `fetchBinAgents(metric, sport?, lower, upper, minDecided, limit=20)` — RPC
  `get_distribution_bin_agents` `{p_metric ("win_rate"|"net_units"), p_sport, p_lower, p_upper,
  p_min_decided, p_limit}` → `[BinAgent]` (drill-down with pending picks).

### PolymarketService.swift
- Cache-first market lookup. `markets(league, awayTeam, homeTeam)` → `PolymarketGameMarkets?`:
  1. DEBUG dummy-data short-circuit.
  2. Main project `polymarket_markets` select all, eq `game_key == "{league}_{away}_{home}"`,
     eq league. Rows grouped by `market_type` (default `moneyline`) into
     `PolymarketMarket(tokenId, currentAwayOdds, currentHomeOdds, priceHistory: [PolymarketPricePoint])`.
  3. Live gamma-API fallback is **deliberately stubbed** (returns nil; pg_cron refreshes the cache
     hourly). Do not port a live fallback.
- Never writes. Errors → nil (UI placeholder).

### PresetArchetypeService.swift
- `fetchAll()` — Main `preset_archetypes` select, eq `is_active=true`, order `display_order` asc →
  `[PresetArchetypeRow]` (`id, name, emoji, description, color, recommended_sports,
  personality_params (PARTIAL JSONB — sparse overrides), custom_insights, display_order, is_active`).
- `AgentPersonalityParamsPartial` — 27 optional fields (risk_tolerance, underdog_lean,
  over_under_lean, confidence_threshold, chase_value, preferred_bet_type, max_favorite_odds,
  min_underdog_odds, max_picks_per_day, skip_weak_slates, trust_model, trust_polymarket,
  polymarket_divergence_flag, fade_public, public_threshold, weather_impacts_totals,
  weather_sensitivity, trust_team_ratings, pace_affects_totals, weight_recent_form,
  ride_hot_streaks, fade_cold_streaks, trust_ats_trends, regress_luck, home_court_boost,
  fade_back_to_backs, upset_alert). `AgentPersonalityParams.applying(partial)` merges over defaults
  (nil = keep default) — semantics of RN's `{...DEFAULTS, ...partial}`.

### RevenueCatService.swift
- Wraps `Purchases.shared`. **iOS API key: `appl_TFQYZRtHkCBrnaILkniTjsulyHK`** (hardcoded).
  **Android needs its own `goog_…` key from the RevenueCat dashboard.**
- Entitlement identifier: `"WagerProof Pro"`. Placements: `onboarding`, `generic_feature`,
  `agent_feature` (must match dashboard).
- `bootstrap(userId: String? = nil)` — configure (idempotent), DEBUG log level, then
  `collectDeviceIdentifiers()` fire-and-forget.
- `logIn(userId)` → `(customerInfo, created)`; `logOut()` (errors swallowed);
  `customerInfo()`; `currentOffering()`; `offering(forPlacement:)` — placement offering with
  fallback to `offerings.current`; `restorePurchases()`; `syncPurchases()`.
- Helpers: `hasProEntitlement(info)` = active entitlements contains "WagerProof Pro";
  `activeSubscriptionType(info)` — productIdentifier contains lifetime/annual|yearly/monthly →
  `"lifetime" | "yearly" | "monthly"`; `activeProductIdentifier`; `activeExpirationDate`.
- Lifecycle: launch → `bootstrap(nil)`; auth → `logIn(user.id)`; sign-out → `logOut()`.
  A coarse entitlement snapshot is mirrored to App Group prefs (`pro_entitlement_granted_v1`,
  `pro_subscription_type_v1`) so widgets/cold-launch don't flash "free".

### SignalPerformanceService.swift
- Actor with per-`(sport|season)` in-memory cache. `performances(for sport: nfl|cfb, season)` —
  CFB project `signal_performance` select, eq sport + season → keyed by `signal_key`. Errors →
  cached empty map. (Season-to-date record; all-time lives in `*_signal_defs.typical_hit`.)

### SupabaseClients.swift / SupabaseConfig.swift — see §2.

### TopAgentsWidgetService.swift
- Home-screen "Top Agents" widget payload builder (Main project).
- Constants: App Group id `group.com.wagerproof.mobile`, payload key **`widgetPayload`**
  (NOTE: distinct from the unused `AppGroupKey.widgetPayload = "widget_payload_v1"`; the live key is
  `widgetPayload` for Expo-widget compat), maxWidgetAgents=3, picksPerAgent=2.
- `sync(userId)` — fetch + read-modify-write payload (replaces `topAgentPicks` + `lastUpdated` only).
- `fetchTopAgents(userId)`:
  1. `avatar_profiles` select `id, name, avatar_emoji, avatar_color, is_widget_favorite, is_active`,
     eq user_id, eq is_active=true.
  2. `avatar_performance_cache` select 9 cols in avatar_id (failure tolerated → zeroed stats).
  3. Sort favorites first then by net_units desc → win_rate desc → current_streak desc; take 3.
  4. Picks: `avatar_picks` in selected ids, `gte game_date >= today−3` (local), order created_at
     desc, limit 3*2*5 (over-fetch for dedupe). Per agent: prefer today's picks, then historical,
     max 2, dedupe by id.
  5. Emit `TopAgentWidgetData` (emoji default 🤖, color default `#6366f1`, record "W-L" or "W-L-P").
- `readPayload()` / `writePayload(_:)` — JSON **string** stored in App Group UserDefaults under
  `widgetPayload`. `hash(of:)` — deterministic sorted-keys JSON of `{agentId, isFavorite, pickIds}`
  for change detection.

### TriggerRunStatusService.swift
- `fetch(runId)` — edge function `trigger-run-status` (Main), explicit bearer, body `{run_id}` →
  `TriggerV3RunStatus { id, status, metadata, updatedAt, startedAt, finishedAt }`.
- `isTerminal` — status uppercased in {COMPLETED, CANCELED, FAILED, CRASHED, INTERRUPTED, EXPIRED,
  TIMED_OUT, SYSTEM_FAILURE} (the last two were bug fixes — do not drop). `isSuccessful` = COMPLETED.
- `TriggerV3RunMetadata` — camelCase keys `{phase, phaseDetail, currentTool, currentToolDetail,
  turn, maxTurns, toolCalls, picksAccepted, picksRejected, submitAttempt, note}`; ints decoded
  lossily (int|double|string).
- Never call Trigger.dev directly — its run-retrieve API 401s hand-rolled tokens; the edge function
  holds the secret key.

### WagerBotChatService.swift — SSE streaming (CRITICAL, port precisely)

**Transport**: raw `POST https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/<function>` where
function = `wagerbot-chat` (production default) or `wagerbot-agent` (DEBUG model picker only —
RELEASE always uses the default). Headers: `Authorization: Bearer <supabase access token>`,
`Content-Type: application/json`, `Accept: text/event-stream`. Body:
`{"user_message": String, "thread_id": String?, "model": String?}` — **omit** nil fields entirely
(encodeIfPresent), do not send nulls. Timeouts: 60s request/connect, 600s resource (streams can run
minutes — configure OkHttp `readTimeout` generously or 0 with call timeout).

Non-2xx: read up to ~1KB of body, error message = `"Chat request failed (<code>): <body prefix 200>"`
(body is `{"error": string}`).

**Parser state machine** (hand-rolled SSE; Kotlin: okhttp-sse `EventSourceListener` gives you
event/data pairs directly, but verify these semantics):
- Lines are LF-separated; process each line:
  - `event: <name>` → set currentEventName (trimmed).
  - `data: <payload>` →
    - if currentEventName is EMPTY → **raw OpenAI chunk**: skip `[DONE]`; parse JSON, take
      `choices[0].delta.content` (non-empty string) → emit `contentDelta(text)`. Role-only /
      finish_reason chunks ignored.
    - else → parse as custom event (below), then **reset currentEventName to ""** (one data line
      per named event).
  - Blank line → reset currentEventName. `:` comments ignored. Trailing unterminated line flushed
    at EOF.
- Stream ends → emit `done`, finish. Cancellation → finish silently. Unknown event names dropped
  silently (forward compat).

**Custom events** (`event: wagerbot.*`, data = JSON object):

| Event | Fields → emitted value |
|---|---|
| `wagerbot.thread` | `thread_id: String` (required), `created: Bool=false` → `thread(id, created)` |
| `wagerbot.tool_start` | `id, name` (required), `arguments` (any JSON, re-serialized to string) → `toolStart(id, name, argumentsJSON)` |
| `wagerbot.tool_end` | `id, name` (required), `ms: Int=0`, `ok: Bool=false`, `result_summary: String=""` → `toolEnd` |
| `wagerbot.follow_ups` | `questions: [String]=[]` → `followUps` |
| `wagerbot.thread_titled` | `thread_id, title` (required) → `threadTitled` |
| `wagerbot.message_persisted` | `role: String=""` → `messagePersisted` |
| `wagerbot.thinking_delta` | `text: String=""` → `thinkingDelta` |
| `wagerbot.thinking_done` | `summary: String=""` → `thinkingDone` |
| `wagerbot.game_cards` | `cards: [WagerBotChatGameCard]` (snake_case JSON) → `gameCards` |
| `wagerbot.chat_widgets` | `widgets: [WagerBotChatWidget]` → `chatWidgets` |
| `wagerbot.app_components` | `summary: String?`, `components: [WagerBotAppComponent]` → `appComponents` (V2/wagerbot-agent rich tappable components) |
| `wagerbot.error` | `code="unknown"`, `message="Unknown error"` → `error` |

**Message/content-block model** (`WagerBotThreadService`, Main project tables):
- `listThreads(userId)` — `chat_threads` select `id, title, created_at, updated_at, message_count`,
  eq user_id, order updated_at desc.
- `deleteThread(threadId)` / `deleteAllThreads(userId)` — deletes on `chat_threads`.
- `loadMessages(threadId)` — `chat_messages` select `id, role, content, blocks, created_at`, eq
  thread_id, order created_at asc. Shaping rules (port exactly):
  - Drop rows with `role == "tool"` (internal to agent loop).
  - `blocks` JSONB may arrive as a structured array OR **a JSON string** (some deployments) — if
    string, re-parse. Each block entry: `{type, id?, ...}`; missing id → generate `b_<uuid>`.
  - Block types: `text {text}`, `game_cards {cards}`, `chat_widgets {widgets}`,
    `app_components {summary?, components}`, `tool_use {name, arguments: string|object}` (historic
    tool blocks render as completed: `done(ms:0, ok:true, summary:"")`). Unknown types skipped.
  - No blocks but non-empty `content` → single legacy text block id `legacy_<rowId>`.
  - Messages with zero blocks are dropped.
- The **edge function persists messages itself** — the client never writes chat_messages.

### WagerBotModelSelection.swift
- DEBUG-only chat model picker persisted in App Group defaults key `wagerbot_chat_model_debug`.
  Options: default (nil model → `wagerbot-chat`), `gpt-4o` / `deepseek-v4-flash` / `deepseek-v4-pro`
  (→ `wagerbot-agent` with `model` set). Stale stored id falls back to default. RELEASE builds always
  use default — replicate the `#if DEBUG` gate with `BuildConfig.DEBUG`.

### WagerBotVoiceFunctions.swift + WagerBotVoiceSession.swift — Voice (OpenAI Realtime)

**Session mint** (`WagerBotVoiceFunctions.createVoiceSession`):
- Requires logged-in user (rate-limited per account). Resolve `auth.session` first.
- `POST https://gnjrklxotmbvnxbnnqgq.supabase.co/functions/v1/create-wagerbot-voice-session`,
  bearer + JSON body `{voice, rudeness, gameContext?, model?, guidance?}` where voice ∈
  `marin|cedar|ash|…`, rudeness ∈ `friendly|spicy`, model = `gpt-realtime|gpt-realtime-mini` or nil,
  guidance = free-text steering, gameContext = pre-formatted matchup data appended to system prompt.
- Response (camelCase, no remap): `{clientSecret: String, model: String}`. clientSecret is an
  ephemeral `ek_` credential — **never log/persist**. Non-2xx: surface `{"error": string}` verbatim
  (the 429 rate-limit message must reach the user).

**Connection lifecycle** (`WagerBotVoiceSession`, app target):
1. States: `idle → requestingSession → connecting → connected → ending → ended`, plus `error(msg)`.
   Re-entry: transitional states bail; `.connected` tears down first (voice/rudeness switch mid-session).
2. Mic permission → mint session → configure audio (iOS: `.playAndRecord` + `.voiceChat` + speaker
   override; Android: `AudioManager MODE_IN_COMMUNICATION`, AEC via `AcousticEchoCanceler` or
   `VOICE_COMMUNICATION` audio source, speakerphone on).
3. WebSocket: `wss://api.openai.com/v1/realtime?model=<mintedModel>` with
   `Authorization: Bearer <clientSecret>`. **Model in URL MUST equal the minted model** (mismatch →
   opaque "Socket is not connected" rejection). **Do NOT send the legacy `OpenAI-Beta: realtime=v1`
   header** (GA API rejects the Beta shape). **Do NOT send `session.update`** — the edge function
   pre-configures instructions/voice/audio formats/turn_detection:null (PTT); a client session.update
   silently breaks push-to-talk. Wait for the WebSocket open callback before sending anything
   (OkHttp: `WebSocketListener.onOpen`).
4. **Audio format**: 24 kHz, mono, PCM16 little-endian, interleaved, base64 on the wire, both
   directions. Mic: capture native → resample/convert → base64 → `{"type":"input_audio_buffer.append","audio":b64}`
   (~90ms buffers, 4096 frames @44.1kHz). Playback: `response.output_audio.delta` → base64-decode →
   PCM16 → convert to device format → queue (Android: `AudioTrack` streaming).
5. **Push-to-talk**: mic frames forwarded only while PTT held.
   - press: if assistant mid-response → `response.cancel` + `output_audio_buffer.clear` + flush local
     playback queue; then `input_audio_buffer.clear`; start forwarding.
   - release: `input_audio_buffer.commit` then `response.create` (no overrides — session defaults;
     Beta `modalities` param now errors, GA name is `output_modalities` and it's set server-side).
6. **Inbound events handled**: `session.created|updated` (no-op), `response.created` (→ thinking),
   `output_audio_buffer.started` (→ speaking), `output_audio_buffer.stopped|cleared` (→ idle),
   `response.done` (clear thinking if no audio), `response.cancelled`,
   `response.output_audio.delta` (+ legacy `response.audio.delta` fallback) with `delta` = b64 audio,
   `error` → `error.message`. Transcript deltas ignored.
7. Teardown order: cancel receive loop → close WS (`goingAway`) → stop player → stop engine →
   remove tap → deactivate audio. Idempotent.

### WagerproofAPI.swift — facade; see §2.

### DummyData/ (3 files — DEBUG only, compiled out of release)
- `DummyDataMode.swift` — static bool flag in App Group defaults (`dummy_data_mode_debug`); when on,
  stores serve fixtures instead of Supabase (offseason UI development, Secret Settings toggle).
- `DummyData.swift` (362 ln) + `DummyDataGenerated.swift` (1565 ln) — captured real slates
  (NFL/NBA/NCAAB/injuries/Polymarket curves via `scripts/wagerproof-migration/capture-dummy-data.py`)
  + hand-built CFB slate and basketball widget fixtures. Android: port if offseason development
  matters; gate with `BuildConfig.DEBUG`.

---

## 5. Edge functions inventory (all on Main project)

| Function | Caller | Auth | Notes |
|---|---|---|---|
| `wagerbot-chat` | WagerBotChatService | Bearer (required) | SSE stream, production chat |
| `wagerbot-agent` | WagerBotChatService (DEBUG) | Bearer | SSE, multi-provider parallel chat |
| `create-wagerbot-voice-session` | WagerBotVoiceFunctions | Bearer (required, rate-limited) | Mints OpenAI Realtime `ek_` secret |
| `agent-authorized-action-v1` | AgentAuthorizedActionsService, AgentService, AgentChatService | Bearer (explicit header) | Actions: `create_agent`, `update_agent`, `detail_snapshot`, `picks_page`, `agent_chat_reply` |
| `trigger-v3-run` | AgentPicksService | Bearer (explicit) | Starts V3 generation run |
| `trigger-run-status` | TriggerRunStatusService | Bearer (explicit) | Polls Trigger.dev run status server-side |

## 6. RPCs inventory

| RPC | Project | Caller |
|---|---|---|
| `get_leaderboard_v2` | Main | AgentPerformanceService |
| `recalculate_avatar_performance` | Main | AgentPerformanceService |
| `get_top_agent_picks_feed_v2` | Main | AgentPicksService |
| `get_agent_performance_distribution` | Main | PlatformStatsService |
| `get_distribution_bin_agents` | Main | PlatformStatsService |
| `get_mlb_player_props_l10` | CFB | MLBPlayerPropsService |

## 7. Local storage keys

**App Group** (`group.com.wagerproof.mobile`, UserDefaults suite → Android: shared
SharedPreferences/DataStore file; only needed cross-process for widgets):
- `last_notification_route` — pending deep-link route from a notification tap
- `theme_pref` — theme preference
- `admin_mode_enabled` — admin mode toggle
- `widget_payload_v1` — declared in AppGroupKey but the widget services actually use **`widgetPayload`** (legacy Expo-compat key; keep `widgetPayload`)
- `dummy_data_mode_debug` — DEBUG fixtures toggle
- `pro_entitlement_granted_v1`, `pro_subscription_type_v1` — RevenueCat entitlement mirror for widgets/cold launch
- `wagerbot_chat_model_debug` — DEBUG chat model picker
- `onboarding_complete/{userId}` — per-user onboarding completion (matches RN `@wagerproof/onboarding-completed/{userId}`)

**Keychain** (`KeychainStore`, service `com.wagerproof.mobile`, kSecAttrAccessibleAfterFirstUnlock):
generic string store (get/set/remove) → Android: EncryptedSharedPreferences or Keystore-backed store.
Supabase auth session: SDK-managed (Keychain on iOS RELEASE; supabase-kt default settings on Android).

**Deep links**: scheme `wagerproof://` (email confirm) and `wagerproof://reset-password`
(password reset) — register intent filters. Facebook URL callbacks go through
`MetaAnalyticsService.handleAppDelegate` equivalent (`FacebookActivity` handles this automatically
on Android). Notification taps stash a route in `last_notification_route`.

---

## 8. Kotlin porting notes

### Library mapping
| iOS | Android |
|---|---|
| supabase-swift `from().select()…` | `supabase-kt` Postgrest DSL (`postgrest.from(...).select { filter { eq(...) } }`) |
| `functions.invoke(name, options)` | supabase-kt Functions module; for the explicit-bearer workaround pass the `Authorization` header explicitly (verify supabase-kt attaches auth to functions; keep explicit anyway for parity) |
| `URLSession.bytes(for:)` SSE | OkHttp + `okhttp-sse` (`EventSources.createFactory`) — map `onEvent(type, data)`: empty/`"message"` type = raw OpenAI delta, `wagerbot.*` = custom. Confirm okhttp-sse surfaces events with no `event:` header as type `"message"`/null |
| `URLSessionWebSocketTask` (Realtime voice) | OkHttp `WebSocket` — send after `onOpen` only |
| `AVAudioEngine` + converters | `AudioRecord` (VOICE_COMMUNICATION source, 24kHz mono PCM16 native — no resample needed if hardware supports; else resample) + `AudioTrack` streaming |
| GIDSignIn | Credential Manager (`androidx.credentials`) + `GetGoogleIdOption`; then supabase-kt `signInWith(IDToken)` |
| ASAuthorization (Apple) | skip on Android (or Supabase OAuth web flow if Apple login must exist for account continuity) |
| RevenueCat purchases-ios | purchases-android: `Purchases.configure(PurchasesConfiguration(context, "goog_…").appUserID(id))`, `logIn/logOut`, `getOfferings().getCurrentOfferingForPlacement(...)`, `restorePurchases`, entitlement `"WagerProof Pro"` |
| Mixpanel Swift | mixpanel-android: `MixpanelAPI.getInstance(ctx, token, trackAutomaticEvents=false)` |
| FBSDKCoreKit AppEvents | facebook-core AppEventsLogger (auto-events off via manifest) |
| UNUserNotificationCenter + APNs | FCM token + `POST_NOTIFICATIONS` permission + NotificationManager (local notifications) |
| App Group UserDefaults | DataStore/SharedPreferences shared with Glance widget |
| KeychainStore | EncryptedSharedPreferences |
| Swift actors | Kotlin: singleton `object` + `Mutex`/`withContext(Dispatchers.IO)`; in-memory caches guarded by mutex |
| `AsyncThrowingStream<WagerBotStreamEvent>` | `Flow<WagerBotStreamEvent>` (callbackFlow around okhttp-sse; `awaitClose { eventSource.cancel() }`) |
| Codable lenient decoders (FlexibleText/flexInt/JSONFlex) | kotlinx.serialization `JsonElement`-based custom serializers or `isLenient` + manual coercion helpers |

### Behavioral gotchas to preserve
1. **Explicit `Authorization: Bearer` header on every edge-function invoke** — not just SDK auto-auth.
2. **Omit-nil JSON encoding** for chat body and edge payloads (use `explicitNulls = false`).
3. Best-effort degradation everywhere: per-sport fetch failures return empty, perf-cache failures
   keep agents visible, prediction enrichment never fails live scores.
4. Lossy array decoding for `avatar_picks` / `avatar_parlays` (skip bad rows, keep good).
5. Date semantics differ by service: agents use **device-local** yyyy-MM-dd; outliers/MLB use
   **America/New_York**; LiveScores NFL run filter uses **UTC** date. Do not unify.
6. Chat `blocks` column can be a JSON string — re-parse before walking.
7. Voice: no `session.update`, no Beta header, model in URL == minted model, PTT event order
   (clear → append… → commit → response.create).
8. `push token column is expo_push_token` regardless of actual token type; `platform: "android"`.
9. Widget payload key is literally `widgetPayload` (not `widget_payload_v1`).
10. Trends queries must stay slate-scoped/slim-column (full pulls timed out on device).

### File → Kotlin checklist (`com.wagerproof.core.services`)

| # | Swift file | Kotlin target | Type | Notes |
|---|---|---|---|---|
| 1 | SupabaseConfig.swift | `SupabaseConfig.kt` | object | URLs + anon keys |
| 2 | SupabaseClients.swift | `SupabaseClients.kt` | object (main/cfb clients) | session persistence config |
| 3 | WagerproofAPI.swift | (fold into SupabaseClients) | — | facade, optional |
| 4 | GoogleSignInCoordinator.swift | `GoogleSignInHelper.kt` | class | Credential Manager |
| 5 | AnalyticsService.swift | `AnalyticsService.kt` | object | Mixpanel |
| 6 | MetaAnalyticsService.swift | `MetaAnalyticsService.kt` | object | facebook-core |
| 7 | RevenueCatService.swift | `RevenueCatService.kt` | object | needs `goog_` key |
| 8 | NotificationService.swift | `NotificationService.kt` | object | FCM + local notifs + token upsert |
| 9 | WagerBotChatService.swift | `WagerBotChatService.kt` + `WagerBotThreadService.kt` | class + object | okhttp-sse Flow |
| 10 | WagerBotModelSelection.swift | `WagerBotModelSelection.kt` | object | DEBUG-gated |
| 11 | WagerBotVoiceFunctions.swift | `WagerBotVoiceFunctions.kt` | object | session mint |
| 12 | (WagerBotVoiceSession.swift, app target) | `WagerBotVoiceSession.kt` | class | OkHttp WS + AudioRecord/Track |
| 13 | (AuthStore.swift, stores) | `AuthRepository.kt` (services half) | class | auth flows |
| 14 | AgentService.swift | `AgentService.kt` | object | avatar_profiles CRUD |
| 15 | AgentAuthorizedActionsService.swift | `AgentAuthorizedActionsService.kt` | object | edge envelope |
| 16 | AgentPicksService.swift | `AgentPicksService.kt` | object | picks/parlays + trigger-v3-run |
| 17 | AgentPerformanceService.swift | `AgentPerformanceService.kt` | object | leaderboard RPC |
| 18 | AgentChatService.swift | `AgentChatService.kt` | object | agent chat |
| 19 | PresetArchetypeService.swift | `PresetArchetypeService.kt` | object | + partial-params merge |
| 20 | PlatformStatsService.swift | `PlatformStatsService.kt` | object | distribution RPCs |
| 21 | TriggerRunStatusService.swift | `TriggerRunStatusService.kt` | object | run polling |
| 22 | LiveScoresService.swift | `LiveScoresService.kt` | class | prediction math port |
| 23 | PolymarketService.swift | `PolymarketService.kt` | class | cache-only reads |
| 24 | OutliersService.swift | `OutliersService.kt` | class | alerts thresholds |
| 25 | OutliersTrendsService.swift | `OutliersTrendsService.kt` | class | splits/matchups decoders |
| 26 | OutliersWidgetService.swift | `OutliersWidgetService.kt` | object | Glance payload |
| 27 | TopAgentsWidgetService.swift | `TopAgentsWidgetService.kt` | object | Glance payload |
| 28 | NFLTrendsEngine.swift | `NFLTrendsEngine.kt` | object (pure) | shared fixtures/tests |
| 29 | MLBTrendsEngine.swift | `MLBTrendsEngine.kt` | object (pure) | abbr remaps |
| 30 | NFLTeamsService.swift | `NFLTeamsService.kt` | object | asset cache warm |
| 31 | CFBTeamsService.swift | `CFBTeamsService.kt` | object | asset cache warm |
| 32 | CFBSignalDefinitionsService.swift | `CFBSignalDefinitionsService.kt` | class | normalization + legacy aliases |
| 33 | SignalPerformanceService.swift | `SignalPerformanceService.kt` | class | cached |
| 34 | NFLPlayerPropsService.swift | `NFLPlayerPropsService.kt` | class | dryrun tables |
| 35 | NFLPropBestBooksBundle.swift | `NFLPropBestBooksBundle.kt` | object | bundle JSON in assets |
| 36 | MLBPlayerPropsService.swift | `MLBPlayerPropsService.kt` | class | RPC fan-out |
| 37 | MLBPlayerPropPicksService.swift | `MLBPlayerPropPicksService.kt` | class | lenient decode |
| 38 | DummyData/ (3 files) | `debug/DummyData*.kt` | debug source set | optional, DEBUG only |

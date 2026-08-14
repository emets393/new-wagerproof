package com.wagerproof.app

import android.app.Application
import com.wagerproof.core.services.AnalyticsService
import com.wagerproof.core.services.MetaAnalyticsService
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.stores.AdminModeStore
import com.wagerproof.core.stores.AgentConsensusStore
import com.wagerproof.core.stores.AgentDetailStoreRegistry
import com.wagerproof.core.stores.AgentPickAuditStore
import com.wagerproof.core.stores.AgentsStore
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.CFBGameSheetStore
import com.wagerproof.core.stores.FavoriteAgentsStore
import com.wagerproof.core.stores.FollowedAgentsStore
import com.wagerproof.core.stores.GamesStore
import com.wagerproof.core.stores.LeaderboardStore
import com.wagerproof.core.stores.LearnWagerProofStore
import com.wagerproof.core.stores.LiveScoresStore
import com.wagerproof.core.stores.MLBBettingTrendsStore
import com.wagerproof.core.stores.MLBF5SplitsStore
import com.wagerproof.core.stores.MLBGameSheetStore
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.NBAGameSheetStore
import com.wagerproof.core.stores.NBAModelAccuracyStore
import com.wagerproof.core.stores.NCAABGameSheetStore
import com.wagerproof.core.stores.NCAABModelAccuracyStore
import com.wagerproof.core.stores.NFLGameSheetStore
import com.wagerproof.core.stores.OnboardingStore
import com.wagerproof.core.stores.OutliersStore
import com.wagerproof.core.stores.OutliersTrendsStore
import com.wagerproof.core.stores.ParlayGodStore
import com.wagerproof.core.stores.ProAccessStore
import com.wagerproof.core.stores.PropsStore
import com.wagerproof.core.stores.RevenueCatStore
import com.wagerproof.core.stores.ReviewPromptCoordinator
import com.wagerproof.core.stores.RootRouter
import com.wagerproof.core.stores.SearchStore
import com.wagerproof.core.stores.SettingsStore
import com.wagerproof.core.stores.ThemeStore
import com.wagerproof.core.stores.TopAgentPicksFeedStore
import com.wagerproof.core.stores.WagerBotChatStore

/**
 * Manual DI container mirroring iOS's environment-injection graph (doc 08
 * §1.6). iOS scatters store creation across `WagerproofApp`, `MainTabView`, and
 * per-feature `@State`; Android collapses all of it into a single app-scoped
 * graph (doc 08 §1.6 closing note recommends exactly this). Every store here is
 * a process singleton, provided to Compose via [com.wagerproof.app.di.LocalAppGraph].
 *
 * The launch/bootstrap side effects that iOS runs in `App.init` /
 * `WagerproofApp.body.task` live in [WagerproofApplication.onCreate] (process
 * services) and in the root composable's LaunchedEffects (auth-driven work that
 * needs to react to Compose state).
 */
class AppGraph(val application: Application) {

    // --- App-scope stores (iOS: created in WagerproofApp) --------------------

    val revenueCat = RevenueCatStore()
    val adminMode = AdminModeStore()

    // ProAccessStore is a facade over the SAME RC + Admin instances injected into
    // the tree — critical invariant from doc 08 §1.1 so `isPro` reads live state.
    val proAccess = ProAccessStore(revenueCat, adminMode)

    val auth = AuthStore()
    val rootRouter = RootRouter()
    val onboarding = OnboardingStore()
    val theme = ThemeStore()
    val settings = SettingsStore()
    val learn = LearnWagerProofStore()
    val agentPickAudit = AgentPickAuditStore()
    val reviewPrompts = ReviewPromptCoordinator.standard { BuildConfig.VERSION_NAME }

    // --- Shell-scope stores (iOS: created in MainTabView) --------------------

    val mainTab = MainTabStore()
    val games = GamesStore()

    // Sits beside GamesStore rather than inside it: consensus is one RPC per
    // SLATE (the flag threshold scales with the whole day's pick volume) and it
    // lives on the MAIN project, not CFB. See .claude/docs/18_agent_consensus.md.
    val agentConsensus = AgentConsensusStore()

    // Agents family. iOS keeps ONE AgentsStore at the shell (MainTabView:75)
    // and hands it to both AgentsView and SearchView; Android used to build a
    // fresh one per screen, so every tab switch dropped the fetched list, leaked
    // that instance's SupervisorJob and refetched from empty on return. The
    // leaderboard / top-picks / favorites siblings are shell-scoped for the same
    // reason — they back the Agents tab's inner tabs.
    val agents = AgentsStore()
    val agentsLeaderboard = LeaderboardStore()
    val topAgentPicks = TopAgentPicksFeedStore()
    val favoriteAgents = FavoriteAgentsStore()

    // Followed agents back the Following rail + sheet at the top of My Agents.
    // Shell-scoped because the public-detail Follow toggle has to refresh the
    // SAME list the rail renders.
    val followedAgents = FollowedAgentsStore()

    // Agent detail stores are cached app-wide, not remembered per composition:
    // a generation run has to keep polling (and fire its completion
    // notification) after the detail screen is disposed. See the registry KDoc.
    val agentDetailStores = AgentDetailStoreRegistry()

    // Back the NBA/NCAAB tool banners on the Games feed. Shell-scoped so the
    // banner doesn't disappear and refetch each time the user returns to Games.
    val nbaModelAccuracy = NBAModelAccuracyStore()
    val ncaabModelAccuracy = NCAABModelAccuracyStore()

    val props = PropsStore()
    val liveScores = LiveScoresStore()
    val outliers = OutliersStore()
    val outliersTrends = OutliersTrendsStore()
    // One pool/fetch backs every rail and matchup widget. Keeping this at the
    // shell prevents five independently mounted surfaces from rebuilding the
    // same MLB/NFL streak slate.
    val parlayGod = ParlayGodStore()
    val search = SearchStore()
    val wagerBotChat = WagerBotChatStore()
    val mlbBettingTrends = MLBBettingTrendsStore()
    val mlbF5Splits = MLBF5SplitsStore()

    // Per-sport game-detail sheet stores. Cross-tab surfaces (Search, Outliers)
    // resolve a gameId → typed game → open the same sheet as the Games tab, so
    // these are shell-scoped singletons (doc 08 §1.6).
    val nflGameSheet = NFLGameSheetStore()
    val cfbGameSheet = CFBGameSheetStore()
    val nbaGameSheet = NBAGameSheetStore()
    val ncaabGameSheet = NCAABGameSheetStore()
    val mlbGameSheet = MLBGameSheetStore()

    /**
     * Process-level bootstrap that must run before the first frame. Mirrors iOS
     * `WagerproofApp.init()` (doc 08 §1.1). Auth session restore + RC user attach
     * are auth-reactive and run from the root composable, not here.
     *
     * NOTE: [AppGroup.initialize] must run BEFORE this graph is constructed
     * (ThemeStore's init writes to StorePrefs/AppGroup), so it lives in
     * [WagerproofApplication.onCreate] ahead of `AppGraph(...)`, not here.
     */
    fun bootstrap() {
        // Credentials are committed defaults in app/build.gradle.kts (same pair as iOS's
        // Info.plist) — they were injected-only until 2026-08, and since nothing injected
        // them the SDK never booted and Android reported no Meta events at all.
        // Must run BEFORE the RevenueCat bootstrap below — RevenueCatService hands
        // Meta's anonymous install id to RC as `$fbAnonId`, and it can only read
        // that id once the FB SDK is up.
        MetaAnalyticsService.initialize(
            context = application,
            appId = BuildConfig.FACEBOOK_APP_ID,
            clientToken = BuildConfig.FACEBOOK_CLIENT_TOKEN,
        )

        // Mixpanel. Same project token as iOS/web, hardcoded for the same reason
        // (write-only key that ships in every client). Until this runs every
        // AnalyticsService call is a silent no-op — that is exactly why Android
        // had zero onboarding/paywall funnel data.
        AnalyticsService.bootstrap(application, AnalyticsService.MIXPANEL_TOKEN)

        // Bootstrap through the STORE, not the raw service. The store marks
        // itself initialized and installs the single customer-info listener;
        // bypassing it leaves entitlement resolution stuck in Loading forever.
        revenueCat.bootstrap()
    }
}

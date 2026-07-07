package com.wagerproof.app

import android.app.Application
import com.wagerproof.core.services.MetaAnalyticsService
import com.wagerproof.core.services.RevenueCatService
import com.wagerproof.core.shared.AppGroup
import com.wagerproof.core.stores.AdminModeStore
import com.wagerproof.core.stores.AgentPickAuditStore
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.CFBGameSheetStore
import com.wagerproof.core.stores.DebugDataModeStore
import com.wagerproof.core.stores.GamesStore
import com.wagerproof.core.stores.LearnWagerProofStore
import com.wagerproof.core.stores.LiveScoresStore
import com.wagerproof.core.stores.MLBBettingTrendsStore
import com.wagerproof.core.stores.MLBF5SplitsStore
import com.wagerproof.core.stores.MLBGameSheetStore
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.NBAGameSheetStore
import com.wagerproof.core.stores.NCAABGameSheetStore
import com.wagerproof.core.stores.NFLGameSheetStore
import com.wagerproof.core.stores.OnboardingStore
import com.wagerproof.core.stores.OutliersStore
import com.wagerproof.core.stores.OutliersTrendsStore
import com.wagerproof.core.stores.ProAccessStore
import com.wagerproof.core.stores.PropsStore
import com.wagerproof.core.stores.RevenueCatStore
import com.wagerproof.core.stores.RootRouter
import com.wagerproof.core.stores.SearchStore
import com.wagerproof.core.stores.SettingsStore
import com.wagerproof.core.stores.ThemeStore
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
    val debugDataMode = DebugDataModeStore()

    // --- Shell-scope stores (iOS: created in MainTabView) --------------------

    val mainTab = MainTabStore()
    val games = GamesStore()
    val props = PropsStore()
    val liveScores = LiveScoresStore()
    val outliers = OutliersStore()
    val outliersTrends = OutliersTrendsStore()
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
        // Meta SDK (currently only flips an init guard until facebook-core lands).
        MetaAnalyticsService.initialize(application)

        // RevenueCat SDK needs a Context; auth-agnostic + idempotent. iOS calls
        // revenueCat.bootstrap() from body.task; the store forwards to the service.
        RevenueCatService.bootstrap(application, userId = null)
    }
}

package com.wagerproof.app.visual

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import com.wagerproof.app.WagerproofApplication
import com.wagerproof.app.di.LocalAppGraph
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.agents.AgentCreateScreen
import com.wagerproof.app.features.agents.AgentDetailScreen
import com.wagerproof.app.features.agents.AgentSettingsScreen
import com.wagerproof.app.features.agents.AgentsScreen
import com.wagerproof.app.features.auth.AuthGateScreen
import com.wagerproof.app.features.cfb.CFBGameDetailPage
import com.wagerproof.app.features.chat.WagerBotChatScreen
import com.wagerproof.app.features.games.GamesScreen
import com.wagerproof.app.features.mlb.MLBGameDetailPage
import com.wagerproof.app.features.nba.NBAGameDetailPage
import com.wagerproof.app.features.ncaab.NCAABGameDetailPage
import com.wagerproof.app.features.nfl.NFLGameDetailPage
import com.wagerproof.app.features.outliers.OutliersFixtures
import com.wagerproof.app.features.outliers.OutliersScreen
import com.wagerproof.app.features.paywall.PaywallScreen
import com.wagerproof.app.features.props.PropsFixtures
import com.wagerproof.app.features.props.PropsScreen
import com.wagerproof.app.features.props.detail.NflPropDetailScreen
import com.wagerproof.app.features.props.detail.PlayerPropDetailScreen
import com.wagerproof.app.features.search.SearchScreen
import com.wagerproof.app.features.settings.SettingsScreen
import com.wagerproof.app.nav.AppNavigator
import com.wagerproof.app.nav.LocalAppNavigator
import com.wagerproof.app.nav.TabBackStacks
import com.wagerproof.app.ui.theme.WagerproofTheme
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.stores.GamesStore
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.MLBBettingTrendsStore
import com.wagerproof.core.stores.MLBBucketAccuracyStore
import com.wagerproof.core.stores.MLBF5SplitsStore
import com.wagerproof.core.stores.MLBRegressionReportStore
import com.wagerproof.core.stores.RevenueCatStore

/**
 * Deterministic, debug-only screenshot host modeled after iOS ScreenshotHarness.
 * The scenario is selected with `--es scenario <slug>`; production RootHost and
 * navigation are never involved.
 */
class VisualRegressionActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val scenario = VisualScenario.fromSlug(intent.getStringExtra(EXTRA_SCENARIO))
        val graph = (application as WagerproofApplication).graph
        VisualFixtureSeeder.seed(graph, scenario)

        setContent {
            CompositionLocalProvider(LocalAppGraph provides graph) {
                WagerproofTheme {
                    VisualScenarioHost(scenario)
                }
            }
        }
    }

    companion object {
        const val EXTRA_SCENARIO = "scenario"
    }
}

@Composable
private fun VisualScenarioHost(scenario: VisualScenario) {
    val graph = appGraph()
    val navigator = remember { AppNavigator(TabBackStacks(), graph.mainTab) }
    val density = LocalDensity.current
    val safeInsets = WindowInsets.safeDrawing
    val detailTopInset = with(density) { safeInsets.getTop(density).toDp() } + 44.dp
    val detailBottomInset = with(density) { safeInsets.getBottom(density).toDp() } + 24.dp
    CompositionLocalProvider(LocalAppNavigator provides navigator) {
        Box(
            Modifier
                .fillMaxSize()
                .background(AppColors.appSurface)
                .testTag("visual-regression-root"),
        ) {
            when (scenario.surface) {
                VisualSurface.Auth -> AuthGateScreen()
                VisualSurface.Games -> GamesScreen()
                VisualSurface.Props -> PropsScreen()
                VisualSurface.Agents -> AgentsScreen()
                VisualSurface.Outliers -> OutliersScreen()
                VisualSurface.Search -> SearchScreen()
                VisualSurface.NflGame -> NFLGameDetailPage(VisualFixtures.nfl, detailTopInset, detailBottomInset)
                VisualSurface.CfbGame -> CFBGameDetailPage(VisualFixtures.cfb, detailTopInset, detailBottomInset)
                VisualSurface.NbaGame -> NBAGameDetailPage(VisualFixtures.nba, detailTopInset, detailBottomInset)
                VisualSurface.NcaabGame -> NCAABGameDetailPage(VisualFixtures.ncaab, detailTopInset, detailBottomInset)
                VisualSurface.MlbGame -> MLBGameDetailPage(
                    game = VisualFixtures.mlb,
                    topInset = detailTopInset,
                    bottomInset = detailBottomInset,
                    trendsStore = remember { MLBBettingTrendsStore() },
                    f5Store = remember { MLBF5SplitsStore() },
                    propsStore = graph.props,
                    accuracyStore = remember { MLBBucketAccuracyStore() },
                    regressionStore = remember { MLBRegressionReportStore() },
                    onSelectProp = {},
                )
                VisualSurface.MlbProp -> PlayerPropDetailScreen(PropsFixtures.sampleSelection, onBack = {})
                VisualSurface.NflProp -> NflPropDetailScreen(VisualFixtures.nflPropSelection, onBack = {})
                VisualSurface.AgentOwner -> AgentDetailScreen("visual-owner-agent", isPublic = false)
                VisualSurface.AgentPublic -> AgentDetailScreen("visual-public-agent", isPublic = true)
                VisualSurface.AgentCreate -> AgentCreateScreen()
                VisualSurface.AgentSettings -> AgentSettingsScreen("visual-owner-agent")
                VisualSurface.Chat -> WagerBotChatScreen(onDismiss = {}, onOpenSettings = {})
                VisualSurface.Settings -> SettingsScreen(onDismiss = {})
                VisualSurface.Paywall -> PaywallScreen(onDismiss = {})
            }
        }
    }
}

private object VisualFixtureSeeder {
    fun seed(graph: com.wagerproof.app.AppGraph, scenario: VisualScenario) {
        graph.adminMode.debugSet(isAdmin = false)
        graph.revenueCat.debugSet(
            status = if (scenario.locked) RevenueCatStore.EntitlementStatus.Denied else RevenueCatStore.EntitlementStatus.Granted,
            subscriptionType = if (scenario.locked) null else "visual-pro",
            isLoading = false,
        )
        when (scenario.surface) {
            VisualSurface.Games -> graph.games.debugSet(
                nfl = if (scenario.state == VisualState.Loaded) listOf(VisualFixtures.nfl) else emptyList(),
                cfb = if (scenario.state == VisualState.Loaded) listOf(VisualFixtures.cfb) else emptyList(),
                nba = if (scenario.state == VisualState.Loaded) listOf(VisualFixtures.nba) else emptyList(),
                ncaab = if (scenario.state == VisualState.Loaded) listOf(VisualFixtures.ncaab) else emptyList(),
                mlb = if (scenario.state == VisualState.Loaded) listOf(VisualFixtures.mlb) else emptyList(),
                sport = GamesStore.Sport.mlb,
                state = scenario.loadState,
            )
            VisualSurface.Props -> {
                graph.props.selectedSport = com.wagerproof.core.stores.PropsStore.Sport.NFL
                if (scenario.state != VisualState.Loading) {
                    graph.props.debugSetNflPlayers(if (scenario.state == VisualState.Loaded) PropsFixtures.nflBoard else emptyList())
                }
            }
            VisualSurface.Outliers -> Unit // New trend store has no mutation hook; capture its deterministic first-load seam.
            VisualSurface.Search -> {
                graph.games.debugSet(
                    nba = if (scenario.state == VisualState.Loaded) listOf(VisualFixtures.nba) else emptyList(),
                    sport = GamesStore.Sport.nba,
                    state = scenario.loadState,
                )
                graph.search.debugSetRecent(if (scenario.state == VisualState.Loaded) listOf("Lakers", "Josh Allen") else emptyList())
            }
            else -> Unit
        }
    }
}

private val VisualScenario.loadState: LoadState
    get() = when (state) {
        VisualState.Loaded, VisualState.Empty -> LoadState.Loaded
        VisualState.Loading -> LoadState.Loading
    }

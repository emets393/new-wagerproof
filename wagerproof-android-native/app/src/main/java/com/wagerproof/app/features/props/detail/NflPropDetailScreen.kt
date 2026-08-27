package com.wagerproof.app.features.props.detail

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.props.NFLPlayerPropSelection
import com.wagerproof.app.features.props.PropsFormatting
import com.wagerproof.app.features.props.RollingNumber
import com.wagerproof.app.features.props.components.NFLPlayerHeadshot
import com.wagerproof.app.features.props.components.NFLPropSignalDetailSheet
import com.wagerproof.app.features.props.components.NFLPropSignalGroup
import com.wagerproof.app.features.props.detail.nflpage.NflBestLinesBlock
import com.wagerproof.app.features.props.detail.nflpage.NflHeadToHeadBlock
import com.wagerproof.app.features.props.detail.nflpage.NflMatchupComparison
import com.wagerproof.app.features.props.detail.nflpage.NflProjectionStrip
import com.wagerproof.app.features.props.detail.nflpage.NflRecentGamesChart
import com.wagerproof.app.features.props.detail.nflpage.NflSituationsGrid
import com.wagerproof.app.features.props.nflTeamColors
import com.wagerproof.app.features.props.teamGlassDisc
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.NFLPlayerProps
import com.wagerproof.core.models.NFLPropMarket
import com.wagerproof.core.models.NFLPropPageMarket
import com.wagerproof.core.models.NFLPropSignalDefinition
import com.wagerproof.core.models.NFLPropTrendGame
import com.wagerproof.core.models.NFLPropVerdicts
import com.wagerproof.core.models.SignalPerformance
import com.wagerproof.core.services.NFLPropPageService
import com.wagerproof.core.services.NFLPropPlayerDetailBundle
import com.wagerproof.core.services.SignalPerformanceService
import com.wagerproof.core.services.SignalSport
import com.wagerproof.core.services.SportsbookPropMarketOdds
import com.wagerproof.core.services.SportsbookPropOddsService
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.OffsetDateTime
import java.util.Locale
import kotlin.math.roundToInt

/**
 * Full-page NFL player-analysis detail, styled like the MLB prop detail
 * (`PlayerPropDetailScreen`): MLB collapsing hero (134/126) with the market
 * picker + animated L10 hit-% badge in the hero.
 *
 * Content is the web player-analysis page (`src/features/propBreakdown/`):
 * the picker FILTERS to one market (web MarketToggle behavior), and each
 * market renders six sections: WagerProof Projection, Recent Games, Matchup
 * vs the opponent's look, Head-to-Head, Situations, Best Lines.
 *
 * The hero renders instantly from the feed selection; the page + trends rows
 * load per player through `NFLPropPageService` and degrade independently.
 * Port of iOS `NFLPropDetailView.swift`.
 */
@Composable
fun NflPropDetailScreen(
    selection: NFLPlayerPropSelection,
    onBack: () -> Unit,
) {
    val graph = appGraph()
    BackHandler(onBack = onBack)
    DisposableEffect(selection.id) {
        onDispose { graph.reviewPrompts.recordResearchDetailViewed() }
    }
    val scope = rememberCoroutineScope()
    val player = selection.player
    val listState = rememberLazyListState()

    var detail by remember(selection.id) { mutableStateOf<NFLPropPlayerDetailBundle?>(null) }
    var isLoadingDetail by remember(selection.id) { mutableStateOf(true) }
    var bookOddsByMarket by remember(selection.id) { mutableStateOf<Map<String, SportsbookPropMarketOdds>>(emptyMap()) }
    var metricHelp by remember { mutableStateOf<NFLPropMetricHelp?>(null) }
    var selectedSignal by remember { mutableStateOf<SelectedPropSignal?>(null) }
    var propPerfByKey by remember(selection.id) { mutableStateOf<Map<String, SignalPerformance>>(emptyMap()) }

    val initialMarket = remember(selection.id) {
        val preferred = selection.preferredMarket?.let { m -> player.markets.firstOrNull { it.market == m } }
        (preferred ?: player.markets.firstOrNull { it.flags.isNotEmpty() } ?: player.markets.firstOrNull())?.market ?: ""
    }
    var activeMarket by remember(selection.id) { mutableStateOf(initialMarket) }
    var suppressScrollSpy by remember(selection.id) { mutableStateOf(false) }

    // Display markets: the served page order wins; the props-feed rows are the
    // fallback and supply best-book quotes + the game-log fallback per key.
    val displayMarkets = remember(detail, selection.id) {
        val feedByKey = player.markets.associateBy { it.market }
        val pageMarkets = detail?.page?.markets.orEmpty()
        if (pageMarkets.isNotEmpty()) {
            pageMarkets.map { pm -> NflDisplayMarket(pm.key, pm.label, pm, feedByKey[pm.key]) }
        } else {
            player.markets.map { fm -> NflDisplayMarket(fm.market, fm.label, null, fm) }
        }
    }
    val activeDisplayMarket = displayMarkets.firstOrNull { it.key == activeMarket } ?: displayMarkets.firstOrNull()

    LaunchedEffect(listState, displayMarkets) {
        snapshotFlow { listState.firstVisibleItemIndex }
            .distinctUntilChanged()
            .collect { index ->
                if (!suppressScrollSpy) {
                    displayMarkets.getOrNull(index)?.key?.let { activeMarket = it }
                }
            }
    }

    LaunchedEffect(selection.id) {
        val playerId = player.playerId?.takeIf { it.isNotEmpty() }
        detail = if (playerId != null) {
            NFLPropPageService.shared.detail(playerId)
        } else {
            NFLPropPlayerDetailBundle(page = null, trends = null)
        }
        isLoadingDetail = false
        // The served market list can drop the market the feed preferred —
        // snap to the page's first market (web does exactly this).
        val pageKeys = detail?.page?.markets.orEmpty().map { it.key }
        if (pageKeys.isNotEmpty() && activeMarket !in pageKeys) {
            activeMarket = pageKeys.first()
        }
        if (playerId != null) {
            // Union of feed + page market keys: the board is the chart-line
            // fallback for pending page markets and the live Best Lines source.
            val requested = buildSet {
                addAll(player.markets.map { it.market })
                addAll(pageKeys)
            }
            // season/week scoping keeps stale prior-season boards from rendering
            // as live lines (backup-QB pass-TD incident, 2026-08-27).
            bookOddsByMarket = coroutineScope {
                requested.map { m -> async { m to SportsbookPropOddsService.odds(playerId, m, player.season, player.week) } }.awaitAll()
            }.mapNotNull { (m, odds) -> odds?.let { m to it } }.toMap()
        }
        val season = player.season ?: 2026
        propPerfByKey = SignalPerformanceService.shared.performances(SignalSport.NFL, season)
    }

    // Trends game log, falling back to the props-feed season log so Recent
    // Games still renders when the trends row is missing.
    fun trendGames(market: NflDisplayMarket?): List<NFLPropTrendGame> {
        detail?.trends?.recentGameLog?.takeIf { it.isNotEmpty() }?.let { return it }
        val feed = market?.feedMarket ?: return emptyList()
        return feed.recentGames.reversed().mapNotNull { game ->
            val actual = game.actual ?: return@mapNotNull null
            NFLPropTrendGame(
                season = player.season ?: 0,
                week = game.week ?: 0,
                opp = game.opp ?: "",
                actuals = mapOf(feed.market to actual),
            )
        }
    }

    /** Today's grading threshold (web `chartLine`). */
    fun chartLine(market: NflDisplayMarket): Double? =
        market.pageMarket?.line
            ?: market.feedMarket?.closeLine
            ?: bookOddsByMarket[market.key]?.over?.quotes?.firstOrNull { it.line != null }?.line
            ?: if (market.isYesNo) 0.5 else null

    fun bestOverOdds(market: NflDisplayMarket): Double? =
        bookOddsByMarket[market.key]?.over?.quotes?.firstOrNull()?.price?.toDouble()
            ?: market.pageMarket?.overPrice?.toDouble()
            ?: market.feedMarket?.overPrice?.toDouble()

    fun l10Grading(market: NflDisplayMarket): Pair<Int, Int> {
        val line = chartLine(market) ?: return 0 to 0
        val actuals = trendGames(market).take(10).mapNotNull { it.actuals[market.key] }
        return actuals.count { it > line } to actuals.size
    }

    val (teamColor, _) = nflTeamColors(player.team ?: "")
    val (oppColor, _) = nflTeamColors(player.opponent ?: "")
    val opponent = detail?.page?.scheme?.opponent ?: detail?.page?.opponent ?: player.opponent ?: ""

    Box(Modifier.fillMaxSize().background(AppColors.appSurface).navigationBarsPadding()) {
        PropsCollapsingScaffold(
            heroMax = 134.dp,
            heroMin = 126.dp,
            listState = listState,
            aura = { progress -> TeamAuraBackground(teamColor, oppColor, progress) },
            hero = { progress ->
                NflHero(
                    selection = selection,
                    progress = progress,
                    teamColor = teamColor,
                    oppColor = oppColor,
                    kickoff = detail?.page?.kickoff,
                    markets = displayMarkets,
                    activeMarket = activeMarket,
                    grading = activeDisplayMarket?.let(::l10Grading),
                    onSelectMarket = { market ->
                        activeMarket = market
                        val index = displayMarkets.indexOfFirst { it.key == market }
                        if (index >= 0) scope.launch {
                            suppressScrollSpy = true
                            listState.animateScrollToItem(index)
                            delay(450)
                            suppressScrollSpy = false
                        }
                    },
                )
            },
        ) {
            displayMarkets.forEach { market ->
                item(key = market.key) {
                    Column {
                val line = chartLine(market)
                val odds = bestOverOdds(market)
                val page = detail?.page
                val trends = detail?.trends
                val games = trendGames(market)
                val (hits, graded) = l10Grading(market)
                val pageSignals = market.pageMarket?.signals.orEmpty()
                val flags = if (pageSignals.isNotEmpty()) {
                    pageSignals.map { it.key }
                } else {
                    market.feedMarket?.flags.orEmpty()
                }

                // 0. Fired prop signals for THIS market.
                if (flags.isNotEmpty()) {
                    WidgetCollapsingSection(
                        title = widgetTitle("Prop Signals", market),
                        systemImage = "bolt.fill",
                        headline = if (flags.size == 1) {
                            "1 signal fired on this market."
                        } else {
                            "${flags.size} signals fired on this market."
                        },
                    ) {
                        NFLPropSignalGroup(flags) { signal ->
                            selectedSignal = SelectedPropSignal(signal)
                        }
                    }
                }

                // 1. WagerProof Projection.
                    if (isLoadingDetail) {
                        SkeletonSection(widgetTitle("WagerProof Projection", market), "scope")
                    } else {
                        WidgetCollapsingSection(
                            title = widgetTitle("WagerProof Projection", market),
                            systemImage = "scope",
                            headline = NFLPropVerdicts.projectionHeadline(
                                projection = page?.projection?.get(market.key),
                                marketKey = market.key,
                                marketLabel = market.label,
                                line = line,
                                vegasOdds = odds,
                            ),
                            onInfoTap = { metricHelp = NFLPropMetricHelp.all["projection"] },
                        ) {
                            NflProjectionStrip(
                                projection = page?.projection?.get(market.key),
                                rookie = page?.rookie ?: false,
                                marketKey = market.key,
                                line = if (market.isYesNo) null else line,
                                vegasOdds = odds,
                            )
                        }
                    }

                // 2. Recent Games (renders from the feed log until trends arrive).
                    WidgetCollapsingSection(
                        title = widgetTitle("Recent Games", market),
                        systemImage = "chart.bar.fill",
                        headline = NFLPropVerdicts.recentGamesHeadline(
                            hits = hits, graded = graded,
                            isTd = market.isYesNo, hasLine = line != null,
                        ),
                        onInfoTap = { metricHelp = NFLPropMetricHelp.all["recent_games"] },
                    ) {
                        NflRecentGamesChart(
                            games = games,
                            marketKey = market.key,
                            line = line,
                            lineLabel = if (market.isYesNo) "TD" else null,
                        )
                    }

                // 3. Matchup vs the opponent's look — needs the page's scheme.
                if (isLoadingDetail) {
                    SkeletonSection(widgetTitle("Matchup", market), "shield.lefthalf.filled")
                } else if (page?.scheme != null) {
                        WidgetCollapsingSection(
                            title = widgetTitle(if (opponent.isEmpty()) "Matchup" else "Matchup vs $opponent", market),
                            systemImage = "shield.lefthalf.filled",
                            headline = NFLPropVerdicts.matchupHeadline(opponent, page.scheme?.defense?.identity),
                            onInfoTap = { metricHelp = NFLPropMetricHelp.all["matchup"] },
                        ) {
                            NflMatchupComparison(page = page, marketKey = market.key)
                        }
                }

                // 4. Head-to-Head.
                if (trends != null) {
                        WidgetCollapsingSection(
                            title = widgetTitle("Head-to-Head", market),
                            systemImage = "person.2.fill",
                            headline = NFLPropVerdicts.headToHeadHeadline(
                                matchup = trends.matchups[opponent],
                                marketKey = market.key,
                                opponent = opponent,
                            ),
                            onInfoTap = { metricHelp = NFLPropMetricHelp.all["h2h"] },
                        ) {
                            NflHeadToHeadBlock(
                                matchup = trends.matchups[opponent],
                                marketKey = market.key,
                                marketLabel = market.label,
                                opponent = opponent,
                            )
                        }
                }

                // 5. Situations — only when this market has served splits.
                val buckets = trends?.splits?.get(market.key)
                if (!buckets.isNullOrEmpty()) {
                        WidgetCollapsingSection(
                            title = widgetTitle("Situations", market),
                            systemImage = "calendar",
                            headline = NFLPropVerdicts.situationsHeadline(
                                overall = buckets["overall"]?.let(com.wagerproof.core.models.NFLPropTrendsDetail::preferredWindow),
                                marketKey = market.key,
                            ),
                            onInfoTap = { metricHelp = NFLPropMetricHelp.all["situations"] },
                        ) {
                            NflSituationsGrid(buckets = buckets, marketKey = market.key)
                        }
                }

                // 6. Best Lines — live board or precomputed best shops.
                val feedMarket = market.feedMarket
                if (feedMarket != null && (feedMarket.hasBestBooks || bookOddsByMarket[market.key] != null)) {
                        WidgetCollapsingSection(
                            title = widgetTitle("Best Lines", market),
                            systemImage = "dollarsign.circle.fill",
                            onInfoTap = { metricHelp = NFLPropMetricHelp.all["book_odds"] },
                        ) {
                            NflBestLinesBlock(market = feedMarket, live = bookOddsByMarket[market.key])
                        }
                }
                    }
                }
            }
            item { Footnote() }
            item { Spacer(Modifier.height(80.dp)) }
        }

        Box(
            Modifier
                .windowInsetsPadding(WindowInsets.statusBars)
                .padding(8.dp)
                .size(36.dp)
                .clip(CircleShape)
                .background(AppColors.appSurfaceElevated.copy(alpha = 0.85f))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(AppIcon.CHEVRON_LEFT.imageVector, "Back", tint = AppColors.appTextPrimary, modifier = Modifier.size(18.dp))
        }
    }

    metricHelp?.let { help ->
        NFLPropMetricHelpSheet(help = help, onDismiss = { metricHelp = null })
    }
    selectedSignal?.let { selected ->
        NFLPropSignalDetailSheet(
            signal = selected.signal,
            seasonRecord = selected.performanceKey?.let { propPerfByKey[it] },
            onDismiss = { selectedSignal = null },
        )
    }
}

private data class SelectedPropSignal(
    val signal: NFLPropSignalDefinition,
    val performanceKey: String? = performanceKey(signal),
) {
    companion object {
        private fun performanceKey(signal: NFLPropSignalDefinition): String? =
            when (signal.id.uppercase(Locale.US)) {
                "P1" -> "P1_pass_yds_form_over"
                "P2" -> "P2_pass_yds_form_under"
                "P3" -> "P3_pass_tds_form_over"
                "P4" -> "P4_no_history_qb_under"
                "P5" -> "P5_atd_drift_yes"
                "P6" -> null
                "P7" -> "P7_rush_yds_tough_d_under"
                "P9" -> "P9_pass_tds_regression_over"
                "P10" -> "P10_receptions_raised_under"
                "P12" -> "P12_featured_wr_over"
                "P13" -> "P13_featured_rb_over"
                "P14" -> "P14_attempts_model_under"
                "P15" -> "P15_attempts_steam_under"
                "P16" -> "P16_attempts_confluence"
                "P17" -> "P17_rush_yds_model_under"
                "P18" -> "P18_pass_tds_model_over"
                else -> null
            }
    }
}

/**
 * One pickable market: the served page market (posted/pending, line, prices)
 * joined with the props-feed row (best books, game-log fallback). Key sets
 * can differ between the two tables — union by page order.
 */
private data class NflDisplayMarket(
    val key: String,
    val label: String,
    val pageMarket: NFLPropPageMarket?,
    val feedMarket: NFLPropMarket?,
) {
    val isYesNo: Boolean get() = key == "player_anytime_td"
}

@Composable
private fun NflHero(
    selection: NFLPlayerPropSelection,
    progress: Float,
    teamColor: Color,
    oppColor: Color,
    kickoff: String?,
    markets: List<NflDisplayMarket>,
    activeMarket: String,
    grading: Pair<Int, Int>?,
    onSelectMarket: (String) -> Unit,
) {
    val player = selection.player
    val headSize = lerp(50f, 32f, progress).dp
    val detail = (1f - progress * 1.9f).coerceIn(0f, 1f)
    val pct: Int? = grading?.let { (hits, graded) ->
        if (graded > 0) (hits.toDouble() / graded * 100).roundToInt() else null
    }

    Column(
        Modifier
            .fillMaxWidth()
            .padding(start = lerp(20f, 16f, progress).dp, end = 16.dp)
            .padding(top = lerp(8f, 0f, progress).dp, bottom = lerp(0f, 10f, progress).dp),
        verticalArrangement = Arrangement.spacedBy(lerp(8f, 6f, progress).dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            player.week?.let {
                Text("Week $it", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.width(8.dp))
            }
            if (player.opponentLabel.isNotEmpty()) {
                Text(player.opponentLabel, color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.weight(1f))
            Text(
                heroDateLabel(kickoff, player.gameDate, player.slotLabel),
                color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
            )
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(headSize + 8.dp).teamGlassDisc(teamColor, oppColor), contentAlignment = Alignment.Center) {
                NFLPlayerHeadshot(player.playerName, player.playerId, player.headshotUrl, headSize)
            }
            Spacer(Modifier.width(lerp(16f, 12f, progress).dp))
            Column(Modifier.weight(1f)) {
                Text(player.playerName, color = AppColors.appTextPrimary, fontSize = lerp(19f, 16f, progress).sp, fontWeight = FontWeight.Black, maxLines = 1)
                if (detail > 0.04f) {
                    Text(subtitle(selection), color = AppColors.appTextSecondary.copy(alpha = detail), fontSize = 11.sp, maxLines = 1)
                }
            }
            // MLB-style animated L10 hit-% badge for the active market.
            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.Top) {
                    RollingNumber(
                        value = pct?.toString() ?: "—",
                        fontSize = lerp(27f, 21f, progress).sp,
                        color = AppColors.appPrimary,
                        fontWeight = FontWeight.Black,
                    )
                    if (pct != null) {
                        Text("%", color = AppColors.appPrimary, fontSize = lerp(16f, 13f, progress).sp, fontWeight = FontWeight.Black)
                    }
                }
                if (detail > 0.04f && grading != null && grading.second > 0) {
                    Text("${grading.first}/${grading.second} L10", color = AppColors.appTextSecondary.copy(alpha = detail), fontSize = 10.sp)
                }
            }
        }
        if (markets.size > 1) {
            NflNativeMarketPicker(markets, activeMarket, onSelectMarket)
        }
    }
}

/** Material's native single-choice segmented control, synchronized to scroll. */
@Composable
private fun NflNativeMarketPicker(
    markets: List<NflDisplayMarket>,
    activeMarket: String,
    onSelect: (String) -> Unit,
) {
    SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
        markets.forEachIndexed { index, market ->
            SegmentedButton(
                selected = market.key == activeMarket,
                onClick = { onSelect(market.key) },
                shape = SegmentedButtonDefaults.itemShape(index, markets.size),
                modifier = Modifier.weight(1f),
                icon = {},
            ) {
                Text(NFLPlayerProps.marketAbbr(market.key), fontSize = 10.sp, maxLines = 1)
            }
        }
    }
}

private fun widgetTitle(title: String, market: NflDisplayMarket): String =
    "$title · ${market.label}"

@Composable
private fun SkeletonSection(title: String, systemImage: String) {
    WidgetCollapsingSection(title = title, systemImage = systemImage) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(Modifier.width(220.dp).height(14.dp).background(AppColors.appSurfaceMuted, RoundedCornerShape(6.dp)))
            Box(Modifier.fillMaxWidth().height(96.dp).background(AppColors.appSurfaceMuted, RoundedCornerShape(12.dp)))
            Box(Modifier.width(140.dp).height(10.dp).background(AppColors.appSurfaceMuted, RoundedCornerShape(6.dp)))
        }
    }
}

/** "Sun, 1:00 PM" in ET from the page kickoff, else the feed's date · slot. */
private fun heroDateLabel(kickoff: String?, gameDate: String, slot: String?): String {
    kickoff?.let { iso ->
        runCatching {
            val date = OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.of("America/New_York"))
            return date.format(DateTimeFormatter.ofPattern("EEE, h:mm a", Locale.US))
        }
    }
    val date = PropsFormatting.dateLabel(gameDate)
    return if (slot != null) "$date · $slot" else date
}

private fun subtitle(selection: NFLPlayerPropSelection): String {
    val p = selection.player
    val parts = mutableListOf<String>()
    p.position?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    p.team?.let { parts.add(it) }
    p.reportStatus?.takeIf { it.isNotEmpty() }?.let { parts.add(it) }
    return parts.joinToString(" · ")
}

@Composable
private fun Footnote() {
    Text(
        "Projections and matchup splits update weekly. Book boards are point-in-time snapshots — confirm at the book before betting.",
        color = AppColors.appTextMuted, fontSize = 10.sp, fontStyle = FontStyle.Italic,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 14.dp),
    )
}

// MARK: - Metric help

data class NFLPropMetricHelp(val id: String, val title: String, val body: String) {
    companion object {
        val all: Map<String, NFLPropMetricHelp> = listOf(
            Triple(
                "projection", "WagerProof Projection",
                "Our projected stat total for this market, placed against the Vegas line. \"Model\" means the live projection model produced the number; \"Preview\" means it comes from the player's recent game-by-game distribution until the model takes over. For anytime TD we project a probability to score and translate it into fair odds you can compare against the posted price.",
            ),
            Triple(
                "recent_games", "Recent Games",
                "Each bar is the player's actual stat total in one of his last 10 games (oldest left, most recent right). Green cleared TODAY's line; red missed it. The dashed line is today's threshold — historical results are graded against the current number, not the line posted at the time.",
            ),
            Triple(
                "matchup", "Matchup",
                "The player's career production against the defensive look this week's opponent plays most — yards per target for receivers, EPA per dropback for QBs, EPA per rush for backs — compared with his career average. Below it: his per-game averages against similar defenses, how often he cleared this market's line against them, and how often the opponent actually uses each look (with the league percentile).",
            ),
            Triple(
                "h2h", "Head-to-Head",
                "The player's career record for this market against this week's opponent. Needs at least 2 career meetings and 2 graded lines before it renders — otherwise the sample is noise.",
            ),
            Triple(
                "situations", "Situations",
                "The player's recent record for this market by game setting — home, away, division, primetime, and so on — over his last few graded games in each spot. Green is above 75%, amber above 60%.",
            ),
            Triple(
                "book_odds", "Best Lines",
                "The best available over and under across sportsbooks. Live boards come from hourly snapshots of each book's posted prop; when no live board exists, the precomputed best shop from the props loader is shown. Confirm at the book before betting.",
            ),
        ).associate { it.first to NFLPropMetricHelp(it.first, it.second, it.third) }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NFLPropMetricHelpSheet(help: NFLPropMetricHelp, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState, containerColor = AppColors.appSurface) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).padding(20.dp).padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(help.title, color = AppColors.appTextPrimary, fontSize = 22.sp, fontWeight = FontWeight.Black)
            Text(help.body, color = AppColors.appTextSecondary, fontSize = 15.sp)
        }
    }
}

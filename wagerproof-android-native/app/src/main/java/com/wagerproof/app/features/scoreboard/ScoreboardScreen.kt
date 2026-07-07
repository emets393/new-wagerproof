package com.wagerproof.app.features.scoreboard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.scoreboard.components.LiveScoreCard
import com.wagerproof.app.features.scoreboard.components.LiveScoreCardShimmer
import com.wagerproof.app.features.scoreboard.components.LiveScorePredictionCard
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCapsule
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.liquidGlassCapsule
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.LiveGame
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.launch

/**
 * Scoreboard — live games grouped by league with tap-to-detail sheet. iOS
 * `Scoreboard/ScoreboardView` (doc 07 §8). Reached from the side menu (not a
 * bar tab). Compact 2-col grid vs. expanded full-width prediction cards,
 * toggled from the header. 120s polling via [com.wagerproof.core.stores.LiveScoresStore].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScoreboardScreen(modifier: Modifier = Modifier) {
    val graph = appGraph()
    val store = graph.liveScores
    val tabStore = graph.mainTab
    val scope = rememberCoroutineScope()

    var isExpanded by remember { mutableStateOf(false) }
    var selectedFilter by remember { mutableStateOf(SportFilter.All) }
    var selectedGame by remember { mutableStateOf<LiveGame?>(null) }

    // Idempotent poll start on first appear (skip if already loaded by fixtures).
    LaunchedEffect(Unit) {
        if (store.loadState is LoadState.Idle) store.start()
    }

    val filteredGroups = store.groupedByLeague().filter { selectedFilter.matches(it.first) }
    val refreshing = store.isLoading && store.hasLiveGames

    Column(modifier.fillMaxSize().background(AppColors.appSurface)) {
        // Header chrome: settings gear (leading) + title + expand toggle (trailing).
        Row(
            Modifier.fillMaxWidth().padding(horizontal = Spacing.lg, vertical = Spacing.sm),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { tabStore.isSettingsPresented = true }) {
                Icon(AppIcon.GEARSHAPE.imageVector, contentDescription = "Settings", tint = AppColors.appTextPrimary)
            }
            Text(
                "Live Scoreboard",
                color = AppColors.appTextPrimary,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f).padding(start = Spacing.xs),
            )
            IconButton(onClick = { isExpanded = !isExpanded }) {
                Icon(
                    (AppIcon.fromSystemName(
                        if (isExpanded) "arrow.down.right.and.arrow.up.left" else "arrow.up.left.and.arrow.down.right",
                    ) ?: AppIcon.SPORTSCOURT_FILL).imageVector,
                    contentDescription = if (isExpanded) "Compact layout" else "Expanded layout",
                    tint = AppColors.appTextPrimary,
                )
            }
        }

        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { scope.launch { store.refresh() } },
            state = rememberPullToRefreshState(),
            modifier = Modifier.weight(1f),
        ) {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    start = Spacing.lg, end = Spacing.lg, bottom = Spacing.xxl,
                ),
            ) {
                item(key = "filter") {
                    SportFilterBar(selectedFilter) { selectedFilter = it }
                    Text(
                        "Real-time scores & predictions",
                        color = AppColors.appTextSecondary,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(top = Spacing.sm, bottom = Spacing.lg),
                    )
                }

                when {
                    store.lastError != null && !store.hasLiveGames -> item {
                        ErrorBanner(store.lastError!!) { scope.launch { store.refresh() } }
                    }
                    store.isLoading && !store.hasLiveGames -> item { LoadingGrid() }
                    !store.hasLiveGames -> item {
                        EmptyState(
                            "No live games right now",
                            "Check back during gameday for live scores, predictions, and hitting badges.",
                            AppIcon.SPORTSCOURT_FILL,
                        )
                    }
                    filteredGroups.isEmpty() -> item {
                        EmptyState(
                            "No live ${selectedFilter.shortLabel} games",
                            "Try a different sport, or clear the filter to see every live league.",
                            selectedFilter.icon,
                        )
                    }
                    else -> filteredGroups.forEach { (league, games) ->
                        item(key = "hdr-$league") { LeagueHeader(league, games) }
                        if (isExpanded) {
                            itemsIndexed(games, key = { _, g -> "exp-${g.id}" }) { index, game ->
                                LiveScorePredictionCard(
                                    game,
                                    Modifier.padding(top = Spacing.md).staggeredAppear(index),
                                )
                            }
                        } else {
                            // Compact grid: chunk into rows of 2.
                            val rows = games.chunked(2)
                            itemsIndexed(rows, key = { i, _ -> "row-$league-$i" }) { rowIndex, pair ->
                                Row(
                                    Modifier.fillMaxWidth().padding(top = 8.dp),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                ) {
                                    pair.forEachIndexed { colIndex, game ->
                                        LiveScoreCard(
                                            game,
                                            onPress = { selectedGame = game },
                                            modifier = Modifier.weight(1f).staggeredAppear(rowIndex * 2 + colIndex),
                                        )
                                    }
                                    if (pair.size == 1) Box(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    selectedGame?.let { game ->
        LiveScoreDetailSheet(
            game = game,
            onViewFullScoreboard = { isExpanded = true },
            onDismiss = { selectedGame = null },
        )
    }
}

@Composable
private fun SportFilterBar(selected: SportFilter, onSelect: (SportFilter) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = Spacing.sm)
            .liquidGlassCapsule(null)
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SportFilter.entries.forEach { filter ->
            val active = selected == filter
            Box(
                Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (active) AppColors.appPrimary.copy(alpha = 0.2f) else Color.Transparent)
                    .clickable { onSelect(filter) }
                    .padding(vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    filter.shortLabel,
                    color = if (active) AppColors.appTextPrimary else AppColors.appTextSecondary,
                    fontSize = 12.sp,
                    fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
    }
}

@Composable
private fun LeagueHeader(league: String, games: List<LiveGame>) {
    val hittingCount = games.count { it.predictions?.hasAnyHitting == true }
    Row(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appSurface.copy(alpha = 0.95f))
            .padding(vertical = Spacing.sm, horizontal = Spacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            (AppIcon.fromSystemName(leagueSymbol(league)) ?: AppIcon.SPORTSCOURT_FILL).imageVector,
            contentDescription = null,
            tint = AppColors.appPrimary,
            modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(Spacing.sm))
        Text(leagueDisplayName(league), color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Box(Modifier.weight(1f))
        Badge("${games.size} ${if (games.size == 1) "Game" else "Games"}", AppColors.appTextPrimary, AppColors.appSurfaceMuted)
        if (hittingCount > 0) {
            Spacer(Modifier.width(Spacing.sm))
            Badge("$hittingCount Hitting", Color(0xFF22D35F), Color(0xFF22D35F).copy(alpha = 0.1f))
        }
    }
    Box(Modifier.fillMaxWidth().size(1.dp).background(AppColors.appBorder.copy(alpha = 0.4f)))
}

@Composable
private fun Badge(text: String, color: Color, background: Color) {
    Text(
        text,
        color = color,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(background)
            .padding(horizontal = Spacing.sm, vertical = 4.dp),
    )
}

@Composable
private fun LoadingGrid() {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.xl), modifier = Modifier.padding(vertical = Spacing.md)) {
        repeat(2) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.md)) {
                Row(
                    Modifier.fillMaxWidth().shimmering().padding(horizontal = Spacing.xs),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SkeletonCircle(20.dp)
                    Spacer(Modifier.width(Spacing.sm))
                    SkeletonBlock(width = 130.dp, height = 18.dp)
                    Box(Modifier.weight(1f))
                    SkeletonCapsule(width = 56.dp, height = 22.dp)
                }
                repeat(2) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        LiveScoreCardShimmer(Modifier.weight(1f))
                        LiveScoreCardShimmer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyState(title: String, message: String, icon: AppIcon) {
    Column(
        Modifier.fillMaxWidth().padding(vertical = Spacing.xxxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Icon(icon.imageVector, contentDescription = null, tint = AppColors.appTextMuted, modifier = Modifier.size(44.dp))
        Text(title, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ErrorBanner(message: String, onRetry: () -> Unit) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .padding(vertical = Spacing.lg)
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appAccentAmber.copy(alpha = 0.4f), shape)
            .padding(Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.md),
    ) {
        Icon(
            (AppIcon.fromSystemName("exclamationmark.triangle.fill") ?: AppIcon.SPORTSCOURT_FILL).imageVector,
            contentDescription = null,
            tint = AppColors.appAccentAmber,
            modifier = Modifier.size(36.dp),
        )
        Text("Couldn't load live games", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
        Text(
            "Retry",
            color = Color.White,
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .padding(top = Spacing.sm)
                .clip(RoundedCornerShape(50))
                .background(AppColors.appPrimary)
                .clickable { onRetry() }
                .padding(horizontal = Spacing.lg, vertical = Spacing.sm),
        )
    }
}

private fun leagueDisplayName(league: String): String = when (league.uppercase()) {
    "NFL" -> "NFL Games"
    "NCAAF", "CFB" -> "College Football"
    "NBA" -> "NBA Games"
    "NCAAB" -> "College Basketball"
    "NHL" -> "NHL Games"
    "MLB" -> "MLB Games"
    "MLS" -> "MLS Games"
    "EPL" -> "EPL Games"
    else -> "$league Games"
}

private fun leagueSymbol(league: String): String = when (league.uppercase()) {
    "NFL" -> "shield.lefthalf.filled"
    "NCAAF", "CFB" -> "trophy.fill"
    "NBA", "NCAAB" -> "basketball.fill"
    "NHL" -> "hockey.puck.fill"
    "MLB" -> "baseball.fill"
    "MLS", "EPL" -> "soccerball"
    else -> "sportscourt.fill"
}

/**
 * Scoreboard sport filter. Case order matches the canonical league order
 * (NFL → CFB → NBA → NCAAB → MLB). `.cfb` accepts both CFB and NCAAF keys.
 */
enum class SportFilter(val shortLabel: String, private val symbol: String) {
    All("All", "sportscourt.fill"),
    Nfl("NFL", "shield.lefthalf.filled"),
    Cfb("CFB", "trophy.fill"),
    Nba("NBA", "basketball.fill"),
    Ncaab("NCAAB", "basketball.fill"),
    Mlb("MLB", "baseball.fill");

    val icon: AppIcon get() = AppIcon.fromSystemName(symbol) ?: AppIcon.SPORTSCOURT_FILL

    fun matches(league: String): Boolean {
        val upper = league.uppercase()
        return when (this) {
            All -> true
            Nfl -> upper == "NFL"
            Cfb -> upper == "CFB" || upper == "NCAAF"
            Nba -> upper == "NBA"
            Ncaab -> upper == "NCAAB"
            Mlb -> upper == "MLB"
        }
    }
}

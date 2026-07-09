package com.wagerproof.app.features.outliers

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.app.features.shared.hexColor
import com.wagerproof.core.design.components.liquidGlassCapsule
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.NBAModelAccuracyData
import com.wagerproof.core.models.SportLeague
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.MainTabStore
import com.wagerproof.core.stores.NBAModelAccuracyStore
import kotlinx.coroutines.launch
import java.util.Locale
import kotlin.math.abs

/**
 * NBA Model Accuracy list view, pushed from the Outliers hub. Port of iOS
 * `NBAModelAccuracyView.swift`.
 *
 * Layout: explainer banner -> pinned sort pills -> matchup cards (or shimmer /
 * empty / error) -> "How to use" footer. Sort modes mirror RN: Time / Spread /
 * ML / O/U. Tapping a card resolves the game in [GamesStore] and hands off to
 * the NBA game sheet on the Games tab.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun NBAModelAccuracyView(modifier: Modifier = Modifier) {
    val store = remember { NBAModelAccuracyStore() }
    val scope = rememberCoroutineScope()
    val graph = appGraph()

    // `.task` idle-refresh — only fire when we've never loaded.
    LaunchedEffect(Unit) {
        if (store.loadState is LoadState.Idle) store.refresh()
    }

    // Cross-tab handoff: resolve the accuracy row's gameId to a typed NBAGame in
    // GamesStore, open the NBA sheet, then switch to the Games tab. No-op if the
    // game isn't cached.
    val openGamePage: (Int) -> Unit = openGamePage@{ gameId ->
        val idString = gameId.toString()
        val nbaGame = graph.games.games.nba.firstOrNull {
            it.id == idString || it.gameId.toString() == idString
        } ?: return@openGamePage
        graph.nbaGameSheet.openGameSheet(nbaGame)
        graph.mainTab.select(MainTabStore.Tab.Games)
    }

    Column(modifier.fillMaxSize().background(AppColors.appSurface)) {
        Row(Modifier.fillMaxWidth().height(52.dp).padding(horizontal = Spacing.lg), verticalAlignment = Alignment.CenterVertically) {
            Text("NBA Model Accuracy", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            IconButton(onClick = { scope.launch { store.refresh(force = true) } }) {
                Icon(Icons.Rounded.Refresh, "Refresh", tint = AppColors.appTextSecondary)
            }
        }
        PullToRefreshBox(
            isRefreshing = store.loadState.isLoading,
            onRefresh = { scope.launch { store.refresh(force = true) } },
            modifier = Modifier.fillMaxSize(),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = Spacing.xxl),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
        item(key = "explainer") {
            ToolExplainerBanner(
                accentColor = hexColor(0x14B8A6L),
                title = "NBA Model Accuracy",
                titleIcon = "target",
                headline = "Know when the model is dialed in.",
                description = "Our model's track record on similar matchups. High accuracy (65%+) means reliable signal. Low accuracy (35%-) flags a profitable fade.",
                examples = listOf(
                    ToolExplainerExample("hand.thumbsup.fill", "Celtics spread pick — 82% accurate", "Trust", hexColor(0x22C55EL)),
                    ToolExplainerExample("hand.thumbsdown.fill", "Lakers O/U pick — only 38% accurate", "Fade", hexColor(0xEF4444L)),
                    ToolExplainerExample("target", "Nuggets ML pick — 71% accurate", "Trust", hexColor(0x22C55EL)),
                ),
                modifier = Modifier.padding(start = Spacing.lg, top = Spacing.md, end = Spacing.lg),
            )
        }

        // Pinned sort bar — glass capsule over an opaque appSurface strip so the
        // cards scroll cleanly underneath it (matches GamesView/PropsView).
        stickyHeader(key = "sortbar") {
            SortBar(active = store.sortMode, onSelect = { store.sortMode = it })
        }

        when (val state = store.loadState) {
            is LoadState.Idle, is LoadState.Loading -> {
                if (store.accuracyById.isEmpty()) {
                    items(4, key = { "shim-$it" }) {
                        NBAModelAccuracyCardShimmer(
                            Modifier.padding(horizontal = Spacing.lg),
                        )
                    }
                } else {
                    accuracyCards(store.games, openGamePage)
                }
            }
            is LoadState.Loaded, is LoadState.Refreshing -> {
                if (store.games.isEmpty()) {
                    item(key = "empty") { EmptyState() }
                } else {
                    accuracyCards(store.games, openGamePage)
                }
            }
            is LoadState.Failed -> {
                item(key = "error") {
                    ErrorState(state.message) { scope.launch { store.refresh(force = true) } }
                }
            }
        }

        item(key = "howto") {
            HowToUseGuide(Modifier.padding(start = Spacing.lg, top = Spacing.md, end = Spacing.lg))
        }
            }
        }
    }
}

private fun LazyListScope.accuracyCards(
    games: List<NBAModelAccuracyData>,
    onTap: (Int) -> Unit,
) {
    items(games, key = { it.id }) { game ->
        val index = games.indexOf(game)
        NBAModelAccuracyMatchupCard(
            game = game,
            onTap = { onTap(game.gameId) },
            modifier = Modifier
                .padding(horizontal = Spacing.lg)
                .staggeredAppear(index),
        )
    }
}

// MARK: - Sort bar

@Composable
private fun SortBar(active: NBAModelAccuracyStore.SortMode, onSelect: (NBAModelAccuracyStore.SortMode) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(AppColors.appSurface)
            .padding(horizontal = Spacing.lg, vertical = 8.dp)
            .liquidGlassCapsule()
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        SortPill(NBAModelAccuracyStore.SortMode.time, "clock", "Time", active, onSelect)
        SortPill(NBAModelAccuracyStore.SortMode.spread, "target", "Spread", active, onSelect)
        SortPill(NBAModelAccuracyStore.SortMode.moneyline, "chart.bar.fill", "ML", active, onSelect)
        SortPill(NBAModelAccuracyStore.SortMode.ou, "arrow.up.arrow.down", "O/U", active, onSelect)
        Spacer(Modifier.weight(1f))
    }
}

@Composable
private fun SortPill(
    mode: NBAModelAccuracyStore.SortMode,
    icon: String,
    label: String,
    active: NBAModelAccuracyStore.SortMode,
    onSelect: (NBAModelAccuracyStore.SortMode) -> Unit,
) {
    val isActive = active == mode
    Row(
        Modifier
            .clip(CircleShape)
            .background(if (isActive) AppColors.appPrimary else AppColors.appSurfaceMuted)
            .clickable { onSelect(mode) }
            .padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            outlierSymbol(icon),
            contentDescription = null,
            tint = if (isActive) Color.White else AppColors.appTextPrimary,
            modifier = Modifier.size(12.dp),
        )
        Text(
            label,
            color = if (isActive) Color.White else AppColors.appTextPrimary,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

// MARK: - Matchup card
// FIDELITY-WAIVER #280: NBAModelAccuracyMatchupCardView lives outside Outliers
// on iOS (Features/NBA/Components); self-contained equivalent here.

@Composable
private fun NBAModelAccuracyMatchupCard(
    game: NBAModelAccuracyData,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(26.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .clickable { onTap() },
    ) {
        // 4dp neutral-NBA gradient stripe (matches iOS TeamColorPair.neutralNBA).
        Box(
            Modifier
                .fillMaxWidth()
                .height(4.dp)
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            hexColor(0xC9082AL),
                            hexColor(0x17408BL),
                            hexColor(0xC9082AL).copy(alpha = 0.85f),
                            hexColor(0x17408BL).copy(alpha = 0.85f),
                        ),
                    ),
                ),
        )

        Column(
            Modifier.padding(horizontal = 12.dp).padding(top = 12.dp, bottom = 14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            CardHeader(game)
            PickBlock("Spread", spreadPickText(game), spreadEdgeText(game), game.spreadAccuracy?.games, game.spreadAccuracy?.accuracyPct)
            PickBlock("ML Win Prob", mlPickText(game), null, game.mlAccuracy?.games, game.mlAccuracy?.accuracyPct)
            PickBlock("Over/Under", ouPickText(game), ouEdgeText(game), game.ouAccuracy?.games, game.ouAccuracy?.accuracyPct)
        }
    }
}

@Composable
private fun CardHeader(game: NBAModelAccuracyData) {
    Row(
        Modifier.fillMaxWidth().padding(bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlierGlassTeamAvatar(
                logoUrl = OutlierTeamPalette.logoURL(game.awayTeam, SportLeague.NBA),
                initials = game.awayAbbr,
                primary = OutlierTeamPalette.color(game.awayTeam, SportLeague.NBA, OutlierTeamPalette.Slot.away),
                size = 32.dp,
            )
            Text(game.awayAbbr, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            Text(
                "@",
                color = AppColors.appTextSecondary.copy(alpha = 0.6f),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
            OutlierGlassTeamAvatar(
                logoUrl = OutlierTeamPalette.logoURL(game.homeTeam, SportLeague.NBA),
                initials = game.homeAbbr,
                primary = OutlierTeamPalette.color(game.homeTeam, SportLeague.NBA, OutlierTeamPalette.Slot.home),
                size = 32.dp,
            )
            Text(game.homeAbbr, color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.weight(1f))
        Text(
            formatTipoff(game.tipoffTime, game.gameDate),
            color = AppColors.appTextSecondary,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun PickBlock(label: String, pickValue: String, edgeValue: String?, accGames: Int?, accPct: Double?) {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.5f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.weight(1f))
            Text(pickValue, color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            if (edgeValue != null) {
                Text(" (edge $edgeValue)", color = AppColors.appTextSecondary, fontSize = 11.sp)
            }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Accuracy", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            Spacer(Modifier.weight(1f))
            if (accPct != null && accGames != null) {
                Text(
                    String.format(Locale.US, "%.1f%%", accPct),
                    color = accuracyColor(accPct),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(" (n=$accGames)", color = AppColors.appTextSecondary, fontSize = 11.sp)
            } else {
                Text("—", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

// MARK: - Derived display strings (mirror iOS card)

private fun spreadPickText(game: NBAModelAccuracyData): String {
    val homeSpread = game.homeSpread ?: return "—"
    val homePredictedToCover = (game.homeSpreadDiff ?: 0.0) > 0
    val abbr = if (homePredictedToCover) game.homeAbbr else game.awayAbbr
    // RN flips the sign for the away team — show the cover line from that side.
    val line = if (homePredictedToCover) homeSpread else -homeSpread
    return "$abbr ${GameCardFormatting.formatSpread(line)}"
}

private fun spreadEdgeText(game: NBAModelAccuracyData): String? {
    val diff = game.homeSpreadDiff ?: return null
    return "+${roundHalfString(abs(diff))}"
}

private fun mlPickText(game: NBAModelAccuracyData): String {
    val prob = game.mlPickProbRounded ?: return "—"
    val abbr = if (game.mlPickIsHome == true) game.homeAbbr else game.awayAbbr
    return "$abbr ${Math.round(prob * 100)}%"
}

private fun ouPickText(game: NBAModelAccuracyData): String {
    val diff = game.overLineDiff ?: return "—"
    val line = game.overLine ?: return "—"
    val direction = if (diff > 0) "Over" else "Under"
    return "$direction ${GameCardFormatting.formatSpread(line).trim('+')}"
}

private fun ouEdgeText(game: NBAModelAccuracyData): String? {
    val diff = game.overLineDiff ?: return null
    return "+${roundHalfString(abs(diff))}"
}

/** Accuracy palette: green 60%+, yellow neutral, red fade. Matches RN thresholds. */
private fun accuracyColor(pct: Double): Color = when {
    pct >= 60 -> hexColor(0x00C853L)
    pct >= 50 -> hexColor(0xFFD600L)
    else -> hexColor(0xFF5252L)
}

private fun formatTipoff(time: String?, date: String): String =
    if (!time.isNullOrEmpty()) GameCardFormatting.convertTimeToEST(time)
    else GameCardFormatting.formatCompactDate(date)

/** Swift `roundToNearestHalf` returns a String; Android's returns Double? — format here. */
internal fun roundHalfString(value: Double?): String {
    val r = GameCardFormatting.roundToNearestHalf(value) ?: return "—"
    return if (r == r.toLong().toDouble()) r.toLong().toString() else String.format(Locale.US, "%.1f", r)
}

// MARK: - Non-card states

@Composable
private fun EmptyState() {
    Column(
        Modifier.fillMaxWidth().heightIn(min = 260.dp).padding(Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(outlierSymbol("target"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(10.dp))
        Text("No NBA accuracy data today", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(
            "Accuracy buckets populate as today's slate locks in. Pull to refresh.",
            color = AppColors.appTextSecondary,
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().heightIn(min = 260.dp).padding(Spacing.lg),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            outlierSymbol("exclamationmark.triangle.fill"),
            contentDescription = null,
            tint = AppColors.appLoss,
            modifier = Modifier.size(36.dp),
        )
        Spacer(Modifier.height(12.dp))
        Text(
            message,
            color = AppColors.appTextSecondary,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = Spacing.xl),
        )
        Spacer(Modifier.height(12.dp))
        Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary)) {
            Text("Retry", color = Color.White)
        }
    }
}

/** "How to use this tool" footer — mirrors RN's `renderHowToUseTool`. */
@Composable
private fun HowToUseGuide(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(14.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder, shape)
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(outlierSymbol("lightbulb.fill"), contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(16.dp))
            Text("How to use this tool", color = AppColors.appTextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
        Tip("1. Sort by Spread, ML, or O/U to find where the model has been strongest.")
        Tip("2. Prioritize matchups where model confidence and historical hit rate agree.")
        Tip("3. Use this as a signal-check tool, then confirm with injuries, line movement, and your own read.")
    }
}

@Composable
private fun Tip(text: String) {
    Text(text, color = AppColors.appTextSecondary, fontSize = 12.sp, lineHeight = 15.sp)
}

// MARK: - Shimmer placeholder

/**
 * Skeleton for [NBAModelAccuracyMatchupCard]. Mirrors its chrome (26dp glass
 * surface, hairline border, 4dp accent bar) with skeleton blocks where the team
 * header + three pick blocks render. Inner placeholders shimmer; chrome stays solid.
 */
@Composable
private fun NBAModelAccuracyCardShimmer(modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(26.dp)
    Column(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), shape),
    ) {
        Box(Modifier.fillMaxWidth().height(4.dp).background(AppColors.appSkeleton))

        Column(
            Modifier
                .padding(horizontal = 12.dp)
                .padding(top = 12.dp, bottom = 14.dp)
                .shimmering(),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                Modifier.fillMaxWidth().padding(bottom = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SkeletonCircle(32.dp)
                SkeletonBlock(height = 12.dp, width = 30.dp)
                SkeletonCircle(32.dp)
                SkeletonBlock(height = 12.dp, width = 30.dp)
                Spacer(Modifier.weight(1f))
                SkeletonBlock(height = 11.dp, width = 52.dp)
            }
            repeat(3) { PickBlockPlaceholder() }
        }
    }
}

@Composable
private fun PickBlockPlaceholder() {
    val shape = RoundedCornerShape(12.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.5f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.5f), shape)
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SkeletonBlock(height = 12.dp, width = 60.dp)
            Spacer(Modifier.weight(1f))
            SkeletonBlock(height = 12.dp, width = 80.dp)
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            SkeletonBlock(height = 12.dp, width = 56.dp)
            Spacer(Modifier.weight(1f))
            SkeletonBlock(height = 12.dp, width = 64.dp)
        }
    }
}

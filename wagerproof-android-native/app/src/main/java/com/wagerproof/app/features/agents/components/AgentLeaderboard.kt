package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.SkeletonCircle
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentLeaderboardEntry
import com.wagerproof.core.services.AgentPerformanceService
import com.wagerproof.core.stores.AgentEntitlementsStore
import com.wagerproof.core.stores.LeaderboardStore
import com.wagerproof.core.stores.LoadState
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.agentSymbol

private val AccentGreen = Color(0xFF00E676)

/**
 * Native port of iOS `AgentLeaderboardView` (`components/agents/AgentLeaderboard.tsx`).
 * Renders the filter pill rows (when [showsFilters]), a ranked list of public
 * agents (top 3 wrapped in a glow halo), loading skeletons, and empty/error
 * states.
 *
 * Owns no state of its own — binds directly to the injected [store] (@Stable, so
 * its `by mutableStateOf` props are read directly and drive recomposition). Each
 * filter pill tap calls a `setX` setter whose guard re-runs the fetch.
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun AgentLeaderboard(
    store: LeaderboardStore,
    entitlements: AgentEntitlementsStore,
    showsFilters: Boolean = true,
    pinnedHeader: @Composable () -> Unit = {},
    onRowTap: (AgentLeaderboardEntry) -> Unit,
) {
    // First-load kickoff — mirrors iOS `.task { if idle { refresh() } }`.
    LaunchedEffect(Unit) {
        if (store.loadState is LoadState.Idle) store.refresh()
    }

    val listState = rememberLazyListState()
    val entries = store.entries
    val loadState = store.loadState

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxWidth(),
    ) {
        // Pinned section header (the Agents hub lifts its tab/filter bar here).
        // The default empty header collapses to zero height.
        stickyHeader { pinnedHeader() }

        // Inline filter bar (hidden when the host lifts it into a glass header).
        if (showsFilters) {
            item(key = "filters") {
                LeaderboardFilterBar(
                    store = store,
                    modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp),
                )
            }
        }

        when (loadState) {
            // Refreshing = stale-while-revalidate: keep showing rows over the fetch.
            is LoadState.Idle, is LoadState.Loading, is LoadState.Refreshing -> {
                if (entries.isEmpty()) {
                    items(6) { SkeletonRow() }
                } else {
                    leaderboardRows(entries, store, entitlements, onRowTap)
                }
            }
            is LoadState.Loaded -> {
                if (entries.isEmpty()) {
                    item(key = "empty") { EmptyState() }
                } else {
                    leaderboardRows(entries, store, entitlements, onRowTap)
                }
            }
            is LoadState.Failed -> {
                item(key = "error") { ErrorState(loadState.message, store) }
            }
        }

        item(key = "bottom_spacer") { Spacer(Modifier.size(24.dp)) }
    }
}

/** Shared row emission used by both the loaded and stale-loading branches. */
private fun LazyListScope.leaderboardRows(
    entries: List<AgentLeaderboardEntry>,
    store: LeaderboardStore,
    entitlements: AgentEntitlementsStore,
    onRowTap: (AgentLeaderboardEntry) -> Unit,
) {
    // LazyListScope.items(count) member overload — keyed on the stable entry id.
    items(count = entries.size, key = { entries[it].id }) { idx ->
        val entry = entries[idx]
        LeaderboardRow(
            entry = entry,
            rank = idx + 1,
            lockStats = !entitlements.canViewAgentPicks,
            isEntitlementsLoading = entitlements.isLoading,
            isBottomMode = store.isBottomMode,
            onTap = { onRowTap(entry) },
            modifier = Modifier
                .padding(horizontal = 16.dp, vertical = 6.dp)
                // Cascade each row in as it replaces the loading shimmer.
                .staggeredAppear(index = idx),
        )
    }
}

// MARK: - Filter bar

/**
 * Sort-mode + timeframe pill rows plus the 10+ picks toggle. Extracted so it can
 * render inline here or be lifted into the Outliers tab's pinned glass header.
 * Each pill tap flips a store property whose setter re-runs the fetch.
 */
@Composable
private fun LeaderboardFilterBar(
    store: LeaderboardStore,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            AgentPerformanceService.LeaderboardSortMode.values().forEach { mode ->
                FilterPill(
                    label = mode.label,
                    isActive = store.sortMode == mode,
                ) { store.setSortMode(mode) }
            }
        }

        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AgentPerformanceService.LeaderboardTimeframe.values().forEach { tf ->
                FilterPill(
                    label = tf.label,
                    isActive = store.timeframe == tf,
                    isSubtle = true,
                ) { store.setTimeframe(tf) }
            }
            // Toggle-as-button — active state matches the pill treatment.
            FilterPill(
                label = "10+ picks",
                isActive = store.excludeUnder10Picks,
            ) { store.setExcludeUnder10Picks(!store.excludeUnder10Picks) }
        }
    }
}

@Composable
private fun FilterPill(
    label: String,
    isActive: Boolean,
    isSubtle: Boolean = false,
    onClick: () -> Unit,
) {
    val fill = if (isActive) {
        AccentGreen.copy(alpha = 0.15f)
    } else {
        AppColors.appBorder.copy(alpha = if (isSubtle) 0.3f else 0.5f)
    }
    val stroke = if (isActive) AccentGreen.copy(alpha = 0.45f) else AppColors.appBorder.copy(alpha = 0.3f)
    Box(
        Modifier
            .clip(CircleShape)
            .background(fill)
            .border(1.dp, stroke, CircleShape)
            .clickableNoRipple(onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(
            label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = if (isActive) AccentGreen else AppColors.appTextSecondary,
        )
    }
}

// MARK: - Row

@Composable
private fun LeaderboardRow(
    entry: AgentLeaderboardEntry,
    rank: Int,
    lockStats: Boolean,
    isEntitlementsLoading: Boolean,
    isBottomMode: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appBorder.copy(alpha = 0.2f))
            .border(1.dp, AppColors.appBorder.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
            .clickableNoRipple(onTap)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        RankBadge(rank)
        AvatarSection(entry, rank, modifier = Modifier.weight(1f))
        StatsSection(entry, lockStats, isEntitlementsLoading)
        WinRateBadge(entry, isBottomMode)
        Icon(
            agentSymbol("chevron.right"),
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.size(13.dp),
        )
    }
}

@Composable
private fun RankBadge(rank: Int) {
    val color: Color
    val icon: String?
    when (rank) {
        1 -> { color = Color(0xFFFFD700); icon = "trophy.fill" }
        2 -> { color = Color(0xFFC0C0C0); icon = "medal.fill" }
        3 -> { color = Color(0xFFCD7F32); icon = "medal" }
        else -> { color = AppColors.appTextSecondary; icon = null }
    }
    Box(Modifier.size(width = 32.dp, height = 32.dp), contentAlignment = Alignment.Center) {
        if (icon != null) {
            Icon(
                agentSymbol(icon),
                contentDescription = null,
                tint = color,
                modifier = Modifier.size(22.dp),
            )
        } else {
            Text("$rank", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = color)
        }
    }
}

@Composable
private fun AvatarSection(
    entry: AgentLeaderboardEntry,
    rank: Int,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val avatarSize = if (rank <= 3) 44.dp else 36.dp
        val avatar: @Composable () -> Unit = {
            Box(
                Modifier
                    .size(avatarSize)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(AgentColorPalette.avatarGradient(entry.avatarColor)),
                    )
                    .padding(if (rank <= 3) 3.dp else 2.dp),
                contentAlignment = Alignment.Center,
            ) {
                PixelSpriteAvatar(spriteIndex = entry.spriteIndex, modifier = Modifier.fillMaxSize())
            }
        }
        // Top-3 rows get the animated glow halo.
        if (rank <= 3) {
            GlowingCardWrapper(color = AgentColorPalette.primary(entry.avatarColor), cornerRadius = 22.dp) {
                avatar()
            }
        } else {
            avatar()
        }

        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                entry.name,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.appTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                entry.preferredSports.take(2).forEach { sport ->
                    Text(
                        sport.label,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.appTextSecondary,
                    )
                }
                if (entry.preferredSports.size > 2) {
                    Text(
                        "+${entry.preferredSports.size - 2}",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun StatsSection(
    entry: AgentLeaderboardEntry,
    lockStats: Boolean,
    isEntitlementsLoading: Boolean,
) {
    Column(
        modifier = Modifier.widthIn(min = 56.dp),
        horizontalAlignment = Alignment.End,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(
            recordLabel(entry),
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = AppColors.appTextPrimary,
        )
        Box(contentAlignment = Alignment.Center) {
            if (isEntitlementsLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(14.dp),
                    strokeWidth = 1.5.dp,
                    color = AppColors.appTextSecondary,
                )
            } else {
                Text(
                    netUnitsLabel(entry),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Black,
                    color = if (entry.netUnits >= 0) AppColors.appWin else AppColors.appLoss,
                )
            }
            // Lock overlay when the viewer can't see agent picks.
            if (!isEntitlementsLoading && lockStats) {
                Box(
                    Modifier
                        .matchParentSize()
                        .clip(RoundedCornerShape(4.dp))
                        .background(AppColors.appSurface.copy(alpha = 0.85f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        agentSymbol("lock.fill"),
                        contentDescription = null,
                        tint = AppColors.appTextSecondary,
                        modifier = Modifier.size(9.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun WinRateBadge(entry: AgentLeaderboardEntry, isBottomMode: Boolean) {
    val label = entry.winRate?.let { String.format("%.1f%%", it * 100) } ?: "-"
    val color = when {
        isBottomMode -> {
            val wr = entry.winRate
            if (wr != null && wr < 0.35) AppColors.appLoss else Color(0xFFF97316)
        }
        else -> AccentGreen
    }
    Box(Modifier.size(width = 48.dp, height = 16.dp), contentAlignment = Alignment.Center) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = color)
    }
}

private fun recordLabel(entry: AgentLeaderboardEntry): String {
    var s = "${entry.wins}-${entry.losses}"
    if (entry.pushes > 0) s += "-${entry.pushes}"
    return s
}

private fun netUnitsLabel(entry: AgentLeaderboardEntry): String {
    val sign = if (entry.netUnits >= 0) "+" else ""
    return String.format("%s%.2fu", sign, entry.netUnits)
}

// MARK: - Skeleton / empty / error

/**
 * Skeleton placeholder mirroring [LeaderboardRow]'s layout (rank block, avatar,
 * name + sport subtitle, trailing record/units + win-rate badge). The inner
 * group carries the shimmer sweep; the card chrome stays solid.
 */
@Composable
private fun SkeletonRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appBorder.copy(alpha = 0.2f))
            .padding(12.dp)
            .shimmering(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SkeletonBlock(width = 28.dp, height = 20.dp, cornerRadius = 4.dp)
        SkeletonCircle(diameter = 36.dp)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            SkeletonBlock(width = 120.dp, height = 14.dp)
            SkeletonBlock(width = 60.dp, height = 10.dp)
        }
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            SkeletonBlock(width = 44.dp, height = 12.dp)
            SkeletonBlock(width = 52.dp, height = 14.dp)
        }
        SkeletonBlock(width = 40.dp, height = 11.dp)
    }
}

@Composable
private fun EmptyState() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appBorder.copy(alpha = 0.2f))
            .padding(vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            agentSymbol("trophy"),
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.size(48.dp),
        )
        Text(
            "No public agents yet",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextSecondary,
        )
        Text(
            "Be the first to make your agent public!",
            fontSize = 13.sp,
            color = AppColors.appTextSecondary,
        )
    }
}

@Composable
private fun ErrorState(message: String, store: LeaderboardStore) {
    val scope = androidx.compose.runtime.rememberCoroutineScope()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(
            agentSymbol("exclamationmark.triangle"),
            contentDescription = null,
            tint = AppColors.appTextSecondary,
            modifier = Modifier.size(40.dp),
        )
        Text(
            "Couldn't load leaderboard",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.appTextPrimary,
        )
        Text(message, fontSize = 13.sp, color = AppColors.appTextSecondary)
        Row(
            modifier = Modifier
                .clip(CircleShape)
                .background(AccentGreen)
                .clickableNoRipple { scope.launch { store.refresh() } }
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                agentSymbol("arrow.clockwise"),
                contentDescription = null,
                tint = Color.Black,
                modifier = Modifier.size(13.dp),
            )
            Text("Retry", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Color.Black)
        }
    }
}

// Rows/pills are whole-surface tappable with no ripple (iOS `.buttonStyle(.plain)`).
private fun Modifier.clickableNoRipple(onClick: () -> Unit): Modifier = composed {
    val interaction = remember { MutableInteractionSource() }
    clickable(interactionSource = interaction, indication = null, onClick = onClick)
}

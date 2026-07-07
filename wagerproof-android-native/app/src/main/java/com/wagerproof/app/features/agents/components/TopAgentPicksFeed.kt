package com.wagerproof.app.features.agents.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.AgentColorPalette
import com.wagerproof.app.features.agents.agentSymbol
import com.wagerproof.app.features.agents.color
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.liquidGlassCapsule
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.pixeloffice.PixelSpriteAvatar
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.Agent
import com.wagerproof.core.models.AgentPersonalityParams
import com.wagerproof.core.models.AgentPerformance
import com.wagerproof.core.models.AgentSpriteIndex
import com.wagerproof.core.models.AgentWithPerformance
import com.wagerproof.core.models.TopAgentPickFeedRow
import com.wagerproof.core.stores.FavoriteAgentsStore
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.TopAgentPicksFeedStore
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// =====================================================================
// TopAgentPicksFeed — Spotify-style sectioned feed: one glass card per agent
// (rank, sprite avatar, strategy chips, form chart) over a rail of ≤4 mini
// tickets. Port of iOS TopAgentPicksFeed.swift. Reads the @Stable store props
// directly (auto-recompose); pagination via LazyColumn + LaunchedEffect.
// =====================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TopAgentPicksFeed(
    store: TopAgentPicksFeedStore,
    favorites: FavoriteAgentsStore,
    modifier: Modifier = Modifier,
    showsFilters: Boolean = true,
    pinnedHeader: @Composable () -> Unit = {},
    onAgentTap: (String) -> Unit,
    onPickTap: (TopAgentPickFeedRow) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var loadingPickId by remember { mutableStateOf<String?>(null) }

    // Debounced search — pump the store's applySearchText 250ms after typing settles.
    LaunchedEffect(store.searchText) {
        delay(250)
        store.applySearchText(store.searchText)
    }
    // Keep the store's local favorites in sync so the Favorites filter can union them.
    LaunchedEffect(favorites.favoriteIds) {
        store.localFavoriteIds = favorites.favoriteIds
    }

    val refreshing = store.loadState is LoadState.Loading && store.items.isNotEmpty()

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { scope.launch { store.refresh() } },
        modifier = modifier.fillMaxSize(),
    ) {
        LazyColumn(Modifier.fillMaxSize()) {
            item(key = "pinnedHeader") { pinnedHeader() }

            if (showsFilters) {
                item(key = "filters") {
                    FilterRow(
                        selected = store.filterMode,
                        onSelect = { store.filterMode = it },
                        modifier = Modifier.padding(horizontal = Spacing.lg).padding(top = Spacing.sm, bottom = Spacing.md),
                    )
                }
            }

            val state = store.loadState
            val sections = store.sections
            when {
                (state is LoadState.Idle || state is LoadState.Loading) && store.items.isEmpty() -> {
                    items(count = 3) { SkeletonSection() }
                }
                state is LoadState.Failed -> {
                    item { ErrorState(state.message) { scope.launch { store.refresh() } } }
                }
                store.items.isEmpty() -> {
                    item { EmptyState(store) }
                }
                else -> {
                    itemsIndexed(sections) { index, section ->
                        AgentSectionView(
                            section = section,
                            loadingPickId = loadingPickId,
                            isFavorite = favorites.isFavorite(section.agentId),
                            onAgentTap = { onAgentTap(section.agentId) },
                            onFavoriteToggle = { favorites.toggle(section.agentId) },
                            onPickTap = { row ->
                                loadingPickId = row.id
                                onPickTap(row)
                                scope.launch {
                                    delay(500)
                                    if (loadingPickId == row.id) loadingPickId = null
                                }
                            },
                        )
                        // Trigger pagination when the last section renders.
                        LaunchedEffect(section.id, index == sections.lastIndex) {
                            if (index == sections.lastIndex) store.loadMore()
                        }
                    }
                    if (store.loadMoreState is LoadState.Loading) {
                        item {
                            Box(Modifier.fillMaxWidth().padding(vertical = Spacing.lg), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator()
                            }
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(Spacing.xxl)) }
        }
    }
}

// MARK: - Filter row (segmented pills)

@Composable
private fun FilterRow(
    selected: TopAgentPicksFeedStore.FilterMode,
    onSelect: (TopAgentPicksFeedStore.FilterMode) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TopAgentPicksFeedStore.FilterMode.entries.forEach { mode ->
            val active = mode == selected
            Box(
                Modifier
                    .weight(1f)
                    .clip(CircleShape)
                    .then(if (active) Modifier.liquidGlassCapsule(AppColors.brandGreenBright) else Modifier.liquidGlassCapsule())
                    .clickable { onSelect(mode) }
                    .padding(vertical = 8.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    mode.label,
                    color = if (active) AppColors.appTextPrimary else AppColors.appTextSecondary,
                    fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1,
                )
            }
        }
    }
}

// MARK: - Per-agent section

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun AgentSectionView(
    section: TopAgentPicksFeedStore.AgentSection,
    loadingPickId: String?,
    isFavorite: Boolean,
    onAgentTap: () -> Unit,
    onFavoriteToggle: () -> Unit,
    onPickTap: (TopAgentPickFeedRow) -> Unit,
) {
    val header = section.rows.firstOrNull() ?: return
    val shape = RoundedCornerShape(26.dp)
    val accent = AgentColorPalette.primary(header.agentAvatarColor)
    var menuOpen by remember { mutableStateOf(false) }

    Box(Modifier.padding(horizontal = 12.dp, vertical = Spacing.md / 2)) {
        Column(
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
                .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.4f), shape)
                .combinedClickable(onClick = {}, onLongClick = { menuOpen = true }),
        ) {
            AgentHeader(section, header, accent, onAgentTap, Modifier.padding(horizontal = 14.dp).padding(top = 12.dp))
            HorizontalDivider(
                color = AppColors.appBorder.copy(alpha = 0.5f),
                modifier = Modifier.padding(horizontal = 14.dp).padding(top = 10.dp),
            )
            PicksRow(section, accent, loadingPickId, onPickTap, Modifier.padding(top = 10.dp, bottom = 12.dp))
        }
        DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
            DropdownMenuItem(
                text = { Text("View Agent") },
                onClick = { menuOpen = false; onAgentTap() },
                leadingIcon = { Icon(agentSymbol("person.crop.circle"), null) },
            )
            DropdownMenuItem(
                text = { Text(if (isFavorite) "Unfollow ${header.agentName}" else "Follow ${header.agentName}") },
                onClick = { menuOpen = false; onFavoriteToggle() },
                leadingIcon = { Icon(agentSymbol(if (isFavorite) "star.slash" else "star"), null) },
            )
        }
    }
}

@Composable
private fun AgentHeader(
    section: TopAgentPicksFeedStore.AgentSection,
    header: TopAgentPickFeedRow,
    accent: Color,
    onAgentTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    // Rebuild a lightweight Agent so we reuse the real strategy-tag logic + sprite.
    val sports = section.rows.map { it.sport }.distinct()
    val snapshot = Agent(
        id = header.avatarId, userId = "", name = header.agentName,
        avatarEmoji = header.agentAvatarEmoji, avatarColor = header.agentAvatarColor,
        preferredSports = sports, archetype = null,
        personalityParams = header.archivedPersonality ?: AgentPersonalityParams.default,
        isActive = true, createdAt = "",
    )
    val perf = AgentPerformance(
        avatarId = header.avatarId,
        totalPicks = header.agentWins + header.agentLosses + header.agentPushes,
        wins = header.agentWins, losses = header.agentLosses, pushes = header.agentPushes,
        netUnits = header.agentNetUnits, currentStreak = header.agentCurrentStreak,
    )

    Row(modifier = modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        AgentAvatar(header, accent, onAgentTap)
        Column(Modifier.weight(1f, fill = false), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                header.agentRank?.let { RankBadge(it) }
                Text(header.agentName, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            StrategyChips(snapshot, accent)
        }
        Spacer(Modifier.weight(1f))
        AgentFormChart(agent = AgentWithPerformance(agent = snapshot, performance = perf), modifier = Modifier.size(78.dp, 46.dp))
    }
}

@Composable
private fun AgentAvatar(row: TopAgentPickFeedRow, accent: Color, onTap: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Box(
        Modifier
            .size(52.dp)
            .clip(shape)
            .background(AppColors.appSurfaceElevated)
            .background(Brush.linearGradient(AgentColorPalette.avatarGradient(row.agentAvatarColor).map { it.copy(alpha = 0.85f) }), shape)
            .border(1.5.dp, AppColors.appSurfaceElevated, shape)
            .clickable(onClick = onTap),
        contentAlignment = Alignment.Center,
    ) {
        PixelSpriteAvatar(spriteIndex = AgentSpriteIndex.forSeed(row.avatarId), modifier = Modifier.fillMaxSize().padding(3.dp))
    }
}

@Composable
private fun StrategyChips(agent: Agent, primary: Color) {
    val tags = agent.strategyTags.take(2)
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        tags.forEach { tag ->
            val tagColor = if (tag.kind == com.wagerproof.core.models.AgentStrategyKind.ARCHETYPE) primary else tag.color
            Text(
                tag.text, color = tagColor, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .clip(CircleShape)
                    .background(AppColors.appSurfaceMuted.copy(alpha = 0.6f))
                    .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.5f), CircleShape)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
    }
}

@Composable
private fun RankBadge(rank: Int) {
    Box(Modifier.width(28.dp), contentAlignment = Alignment.Center) {
        when (rank) {
            1 -> Icon(agentSymbol("trophy.fill"), null, tint = Color(0xFFFFD700), modifier = Modifier.size(14.dp))
            2 -> Icon(agentSymbol("medal.fill"), null, tint = Color(0xFFC0C0C0), modifier = Modifier.size(14.dp))
            3 -> Icon(agentSymbol("medal"), null, tint = Color(0xFFCD7F32), modifier = Modifier.size(14.dp))
            else -> Text("#$rank", color = AppColors.brandGreenBright, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
}

@Composable
private fun PicksRow(
    section: TopAgentPicksFeedStore.AgentSection,
    accent: Color,
    loadingPickId: String?,
    onPickTap: (TopAgentPickFeedRow) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.md),
        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp),
    ) {
        val rows = section.rows.take(4)
        itemsIndexed(rows, key = { _, row -> row.id }) { index, row ->
            Box(Modifier.staggeredAppear(index)) {
                AgentPickMiniTicket(
                    pick = row.asAgentPick,
                    accent = accent,
                    modifier = Modifier.clickable { onPickTap(row) },
                )
                if (loadingPickId == row.id) {
                    Box(
                        Modifier.matchParentSize().clip(RoundedCornerShape(18.dp)).background(Color.Black.copy(alpha = 0.4f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(color = Color.White)
                    }
                }
            }
        }
    }
}

// MARK: - Skeleton / empty / error

@Composable
private fun SkeletonSection() {
    val shape = RoundedCornerShape(26.dp)
    Column(
        Modifier
            .padding(horizontal = 12.dp, vertical = Spacing.md / 2)
            .fillMaxWidth()
            .clip(shape)
            .background(AppColors.appSurfaceElevated.copy(alpha = 0.55f))
            .border(0.5.dp, AppColors.appBorder.copy(alpha = 0.4f), shape),
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 14.dp).padding(top = 12.dp).shimmering(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SkeletonBlock(height = 48.dp, width = 48.dp, cornerRadius = 13.dp)
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                SkeletonBlock(height = 14.dp, width = 140.dp)
                SkeletonBlock(height = 11.dp, width = 90.dp)
            }
        }
        HorizontalDivider(color = AppColors.appBorder.copy(alpha = 0.5f), modifier = Modifier.padding(horizontal = 14.dp).padding(top = 10.dp))
        LazyRow(
            Modifier.padding(top = 10.dp, bottom = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 4.dp),
        ) {
            items(3) { AgentPickMiniTicketSkeleton() }
        }
    }
}

@Composable
private fun EmptyState(store: TopAgentPicksFeedStore) {
    val searching = store.appliedSearchText.isNotEmpty()
    val title = when {
        searching -> "No matches"
        store.filterMode == TopAgentPicksFeedStore.FilterMode.Top10 -> "No top picks yet"
        store.filterMode == TopAgentPicksFeedStore.FilterMode.Following -> "No followed agents"
        else -> "No favorites yet"
    }
    val icon = when {
        searching -> "magnifyingglass"
        store.filterMode == TopAgentPicksFeedStore.FilterMode.Top10 -> "sparkles"
        store.filterMode == TopAgentPicksFeedStore.FilterMode.Following -> "person.crop.circle.badge.plus"
        else -> "star"
    }
    val message = if (searching) {
        "Nothing matched “${store.appliedSearchText}”. Try a different agent, team, or pick."
    } else {
        store.filterMode.emptyMessage
    }
    Column(
        Modifier.fillMaxWidth().padding(top = Spacing.xl, start = Spacing.xl, end = Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(agentSymbol(icon), null, tint = AppColors.appTextMuted, modifier = Modifier.size(44.dp))
        Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 14.sp)
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit) {
    Column(
        Modifier.fillMaxWidth().padding(top = Spacing.xl, start = Spacing.xl, end = Spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(agentSymbol("exclamationmark.triangle"), null, tint = AppColors.appPending, modifier = Modifier.size(44.dp))
        Text("Couldn't load feed", color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 14.sp)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier
                .clip(CircleShape)
                .background(AppColors.brandGreenBright)
                .clickable(onClick = onRetry)
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Icon(agentSymbol("arrow.clockwise"), null, tint = Color(0xFF0B1010), modifier = Modifier.size(14.dp))
            Text("Retry", color = Color(0xFF0B1010), fontSize = 14.sp, fontWeight = FontWeight.Bold)
        }
    }
}

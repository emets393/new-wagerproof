package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ArrowOutward
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.People
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AnalysisSystemCopy
import com.wagerproof.core.models.AnalysisSystemsLeaderboardRow
import com.wagerproof.core.models.HistoricalAnalysisSavedFilter
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.services.HistoricalAnalysisSavedFiltersService
import com.wagerproof.core.stores.HistoricalAnalysisStore
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.launch

/** Which collection the hub opens on. */
internal enum class SystemsHubTab(val title: String) {
    MY_SYSTEMS("My Systems"),
    LEADERBOARD("Leaderboard"),
}

private sealed interface HubRoute {
    data object List : HubRoute
    data object SaveCurrent : HubRoute
    data class Saved(val id: String) : HubRoute
    data class Leaderboard(val id: String) : HubRoute
    data class CopyLeaderboard(val id: String) : HubRoute
}

/**
 * One home for owned and public systems — port of iOS `SystemsHubSheet` +
 * `SystemsLeaderboardContent` + the two detail views, as a Material bottom sheet
 * with an internal back stack instead of a NavigationStack.
 *
 * Signed-out users get the public leaderboard only (iOS
 * `GuestSystemsLeaderboardSheet`): the board is anon-callable, but saving,
 * renaming and sharing all need a user id.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SystemsHubSheet(
    store: HistoricalAnalysisStore,
    userId: String?,
    initialTab: SystemsHubTab,
    onDismiss: () -> Unit,
    /** One-shot confirmation shown above My Systems (e.g. right after a save). */
    notice: String? = null,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var tab by remember { mutableStateOf(if (userId == null) SystemsHubTab.LEADERBOARD else initialTab) }
    var route by remember { mutableStateOf<HubRoute>(HubRoute.List) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AppColors.appSurface,
    ) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding()) {
            HubHeader(
                title = when (route) {
                    HubRoute.List -> if (userId == null) "Systems Leaderboard" else tab.title
                    HubRoute.SaveCurrent -> "Save System"
                    is HubRoute.CopyLeaderboard -> "Save a Copy"
                    else -> "System Details"
                },
                canGoBack = route != HubRoute.List,
                onBack = { route = HubRoute.List },
                onDone = onDismiss,
            )

            if (route == HubRoute.List && userId != null) {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    SystemsHubTab.entries.forEach { entry ->
                        FilterChip(tab == entry, { tab = entry }, label = { Text(entry.title) })
                    }
                }
            }

            when (val current = route) {
                HubRoute.List -> when (tab) {
                    SystemsHubTab.MY_SYSTEMS -> if (userId != null) {
                        MySystemsList(
                            store = store,
                            userId = userId,
                            notice = notice,
                            onSaveCurrent = { route = HubRoute.SaveCurrent },
                            onOpen = { route = HubRoute.Saved(it.id) },
                            onApply = { store.restoreSaved(it); onDismiss() },
                        )
                    }
                    SystemsHubTab.LEADERBOARD -> LeaderboardList(store) { route = HubRoute.Leaderboard(it.id) }
                }

                HubRoute.SaveCurrent -> if (userId != null) {
                    SaveSystemFlow(store = store, userId = userId, onSaved = { route = HubRoute.List; tab = SystemsHubTab.MY_SYSTEMS })
                }

                is HubRoute.Saved -> {
                    val row = store.savedFilters.firstOrNull { it.id == current.id }
                    if (row == null) {
                        HubMessage("System unavailable", "It may have been deleted on another device.")
                    } else {
                        SavedSystemDetail(row, store.sport) { store.restoreSaved(row); onDismiss() }
                    }
                }

                is HubRoute.Leaderboard -> {
                    val row = store.leaderboard.firstOrNull { it.id == current.id }
                    if (row == null) {
                        HubMessage("System unavailable", "It dropped off the board — pull to refresh.")
                    } else {
                        LeaderboardSystemDetail(
                            row = row,
                            sport = store.sport,
                            onUse = { store.applyLeaderboardSystem(row); onDismiss() },
                            onSaveCopy = if (userId != null && row.filters != null) {
                                { route = HubRoute.CopyLeaderboard(row.id) }
                            } else null,
                        )
                    }
                }

                is HubRoute.CopyLeaderboard -> {
                    val row = store.leaderboard.firstOrNull { it.id == current.id }
                    val snapshot = row?.filters
                    if (userId == null || row == null || snapshot == null) {
                        HubMessage("This system can't be copied", "Its filter rules are unavailable.")
                    } else {
                        SaveSystemFlow(
                            store = store,
                            userId = userId,
                            initialSnapshot = snapshot,
                            initialVerdict = row.effectiveVerdict,
                            initialName = "Copy of ${row.name}",
                            onSaved = { route = HubRoute.List; tab = SystemsHubTab.MY_SYSTEMS },
                        )
                    }
                }
            }
        }
    }

    // Keep the sheet's data warm regardless of which tab opened it.
    LaunchedEffect(userId) { if (userId != null) store.refreshSaved(userId) }
    LaunchedEffect(tab) { if (tab == SystemsHubTab.LEADERBOARD) store.loadLeaderboard() }
}

@Composable
private fun HubHeader(title: String, canGoBack: Boolean, onBack: () -> Unit, onDone: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (canGoBack) {
            IconButton(onBack) { Icon(Icons.Rounded.ArrowBack, "Back", tint = AppColors.appTextSecondary) }
        } else {
            Spacer(Modifier.width(12.dp))
        }
        Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        TextButton(onDone) { Text("Done", color = AppColors.appPrimary) }
    }
}

@Composable
private fun HubMessage(title: String, body: String) {
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Bold)
        Text(body, color = AppColors.appTextSecondary, fontSize = 13.sp, textAlign = TextAlign.Center)
    }
}

// MARK: - My Systems

@Composable
private fun MySystemsList(
    store: HistoricalAnalysisStore,
    userId: String,
    notice: String?,
    onSaveCurrent: () -> Unit,
    onOpen: (HistoricalAnalysisSavedFilter) -> Unit,
    onApply: (HistoricalAnalysisSavedFilter) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var pendingRename by remember { mutableStateOf<HistoricalAnalysisSavedFilter?>(null) }
    var pendingDelete by remember { mutableStateOf<HistoricalAnalysisSavedFilter?>(null) }
    var renameText by remember { mutableStateOf("") }
    val atLimit = store.savedFilters.size >= HistoricalAnalysisSavedFiltersService.MAX_PER_USER

    Column(Modifier.fillMaxWidth().heightIn(max = 620.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("MY SYSTEMS", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            Text(
                "${store.savedFilters.size}/${HistoricalAnalysisSavedFiltersService.MAX_PER_USER}",
                color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.weight(1f))
            IconButton({ scope.launch { store.refreshSaved(userId) } }, Modifier.size(30.dp)) {
                Icon(Icons.Rounded.Refresh, "Refresh my systems", Modifier.size(17.dp), tint = AppColors.appTextSecondary)
            }
            TextButton(onClick = onSaveCurrent, enabled = !atLimit) {
                Text(
                    if (atLimit) "Limit reached" else "Save current",
                    color = if (atLimit) AppColors.appTextMuted else AppColors.appPrimary,
                    fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                )
            }
        }

        notice?.let { message ->
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Icon(Icons.Rounded.CheckCircle, null, Modifier.size(15.dp), tint = AppColors.appPrimary)
                Text(message, color = AppColors.appPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, lineHeight = 16.sp)
            }
        }

        store.savedFiltersError?.let { message ->
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.ErrorOutline, null, Modifier.size(15.dp), tint = AppColors.appAccentAmber)
                Text(message, color = AppColors.appAccentAmber, fontSize = 12.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = { scope.launch { store.refreshSaved(userId) } }) {
                    Text("Retry", color = AppColors.appPrimary, fontSize = 12.sp)
                }
            }
        }

        if (store.savedFilters.isEmpty()) {
            HubMessage("No saved systems yet", "Save the setup you're viewing to use it again.")
        } else {
            LazyColumn(
                Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                itemsIndexed(store.savedFilters, key = { _, row -> row.id }) { _, row ->
                    SavedSystemCard(
                        row = row,
                        sport = store.sport,
                        onOpen = { onOpen(row) },
                        onApply = { onApply(row) },
                        onRename = { pendingRename = row; renameText = row.name },
                        onTogglePublic = { scope.launch { store.setSystemPublic(row.id, !row.isPublic, userId) } },
                        onDelete = { pendingDelete = row },
                    )
                }
            }
        }
    }

    pendingRename?.let { row ->
        AlertDialog(
            onDismissRequest = { pendingRename = null },
            title = { Text("Rename System") },
            text = {
                OutlinedTextField(renameText, { renameText = it }, label = { Text("System name") }, singleLine = true)
            },
            confirmButton = {
                Button(
                    enabled = renameText.isNotBlank(),
                    onClick = {
                        val trimmed = renameText.trim()
                        pendingRename = null
                        if (trimmed.isNotEmpty()) scope.launch { store.renameSystem(row.id, trimmed, userId) }
                    },
                ) { Text("Save") }
            },
            dismissButton = { TextButton({ pendingRename = null }) { Text("Cancel") } },
        )
    }

    pendingDelete?.let { row ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Delete System") },
            text = { Text("Delete “${row.name}”? This can't be undone.") },
            confirmButton = {
                Button(
                    colors = ButtonDefaults.buttonColors(containerColor = AppColors.appLoss),
                    onClick = {
                        pendingDelete = null
                        scope.launch { store.deleteSavedFilter(row.id, userId) }
                    },
                ) { Text("Delete") }
            },
            dismissButton = { TextButton({ pendingDelete = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun SavedSystemCard(
    row: HistoricalAnalysisSavedFilter,
    sport: HistoricalAnalysisSport,
    onOpen: () -> Unit,
    onApply: () -> Unit,
    onRename: () -> Unit,
    onTogglePublic: () -> Unit,
    onDelete: () -> Unit,
) {
    var menuOpen by remember { mutableStateOf(false) }
    val labels = remember(row.id, row.filters) { systemFilterLabels(sport, row.filters) }

    SystemCard(Modifier.fillMaxWidth().clickable(onClick = onOpen)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            SystemGlyph(sport, row.betType)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(row.name, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    "${systemMarketLabel(row.betType)} · ${AnalysisSystemCopy.verdictLabel(row.verdict)}",
                    color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(if (row.isPublic) AppColors.appPrimary else AppColors.appTextMuted))
                Text(
                    if (row.isPublic) "Shared" else "Private",
                    color = if (row.isPublic) AppColors.appPrimary else AppColors.appTextSecondary,
                    fontSize = 10.sp, fontWeight = FontWeight.SemiBold,
                )
            }
            Box {
                IconButton({ menuOpen = true }, Modifier.size(30.dp)) {
                    Icon(Icons.Rounded.MoreVert, "More actions for ${row.name}", Modifier.size(18.dp), tint = AppColors.appTextSecondary)
                }
                DropdownMenu(menuOpen, { menuOpen = false }) {
                    DropdownMenuItem(text = { Text("Apply") }, onClick = { menuOpen = false; onApply() })
                    DropdownMenuItem(text = { Text("Rename") }, onClick = { menuOpen = false; onRename() })
                    DropdownMenuItem(
                        text = { Text(if (row.isPublic) "Make private" else "Share to leaderboard") },
                        onClick = { menuOpen = false; onTogglePublic() },
                    )
                    DropdownMenuItem(text = { Text("Delete", color = AppColors.appLoss) }, onClick = { menuOpen = false; onDelete() })
                }
            }
        }
        HorizontalDivider(color = AppColors.appBorder)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SystemFilterSummary(labels)
            Spacer(Modifier.weight(1f))
            Text(
                AnalysisSystemCopy.sinceSavedLabel(row.sinceSaved),
                color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
            )
            IconButton(onApply, Modifier.size(28.dp)) {
                Icon(Icons.Rounded.ArrowOutward, "Apply ${row.name}", Modifier.size(15.dp), tint = AppColors.appPrimary)
            }
        }
    }
}

@Composable
private fun SavedSystemDetail(
    row: HistoricalAnalysisSavedFilter,
    sport: HistoricalAnalysisSport,
    onApply: () -> Unit,
) {
    val labels = remember(row.id, row.filters) { systemFilterLabels(sport, row.filters) }
    Column(
        Modifier.fillMaxWidth().heightIn(max = 620.dp).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(13.dp), verticalAlignment = Alignment.CenterVertically) {
            SystemGlyph(sport, row.betType, 48.dp)
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(row.name, color = AppColors.appTextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (row.isPublic) Icons.Rounded.People else Icons.Rounded.Lock,
                        null, Modifier.size(13.dp),
                        tint = if (row.isPublic) AppColors.appPrimary else AppColors.appTextSecondary,
                    )
                    Text(
                        if (row.isPublic) "Shared on leaderboard" else "Private system",
                        color = if (row.isPublic) AppColors.appPrimary else AppColors.appTextSecondary,
                        fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }

        SystemCard(Modifier.fillMaxWidth()) {
            DetailRow("Rule") {
                Text(
                    "${AnalysisSystemCopy.verdictLabel(row.verdict)} · ${systemMarketLabel(row.betType)}",
                    color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                )
            }
            HorizontalDivider(color = AppColors.appBorder)
            DetailRow("Filters") {
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    SystemFilterSummary(labels, limit = labels.size)
                }
            }
            HorizontalDivider(color = AppColors.appBorder)
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                SystemMetric("RECORD", AnalysisSystemCopy.recordText(row.sinceSaved))
                SystemMetric("ROI", recordRoiText(row.sinceSaved), metricTint(row.sinceSaved?.roi))
                SystemMetric("UNITS", recordUnitsText(row.sinceSaved), metricTint(row.sinceSaved?.units))
            }
            if (!row.isTrackedSystem) {
                Text(
                    "Saved before bet-side tracking — it restores your filters but isn't graded. Save it again to track a record.",
                    color = AppColors.appTextSecondary, fontSize = 11.sp, lineHeight = 15.sp,
                )
            }
        }

        Button(
            onClick = onApply,
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary),
            modifier = Modifier.fillMaxWidth().height(50.dp),
        ) { Text("Apply This System", fontSize = 15.sp, fontWeight = FontWeight.Bold) }
    }
}

// MARK: - Leaderboard

private enum class LeaderboardSort(val title: String) {
    BEST_ROI("Best ROI"),
    BEST_RECORD("Best Record"),
    MOST_UNITS("Most Units"),
    HOTTEST_STREAK("Hottest Streak"),
}

@Composable
private fun LeaderboardList(
    store: HistoricalAnalysisStore,
    onSelect: (AnalysisSystemsLeaderboardRow) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var sort by remember { mutableStateOf(LeaderboardSort.BEST_ROI) }
    val rows = remember(store.leaderboard, sort) {
        when (sort) {
            // The RPC already ranks by all-time ROI — re-sorting would only add drift.
            LeaderboardSort.BEST_ROI -> store.leaderboard
            LeaderboardSort.BEST_RECORD -> store.leaderboard.sortedByDescending { it.allTime?.hitPct ?: -1.0 }
            LeaderboardSort.MOST_UNITS -> store.leaderboard.sortedByDescending { it.allTime?.units ?: Double.NEGATIVE_INFINITY }
            LeaderboardSort.HOTTEST_STREAK -> store.leaderboard.sortedByDescending { row ->
                row.streak?.takeIf { it.kind == "win" }?.len ?: 0
            }
        }
    }

    Column(Modifier.fillMaxWidth().heightIn(max = 620.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Rounded.EmojiEvents, null, Modifier.size(14.dp), tint = AppColors.appTextSecondary)
            Text("SYSTEMS", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp)
            Text("10+ GAMES", color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            // Android equivalent of iOS's pull-to-refresh on this list.
            IconButton({ scope.launch { store.loadLeaderboard(force = true) } }, Modifier.size(30.dp)) {
                Icon(Icons.Rounded.Refresh, "Refresh leaderboard", Modifier.size(17.dp), tint = AppColors.appTextSecondary)
            }
        }
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            LeaderboardSort.entries.forEach { mode ->
                FilterChip(sort == mode, { sort = mode }, label = { Text(mode.title) })
            }
        }

        val state = store.leaderboardState
        when {
            store.leaderboard.isEmpty() && state is LoadState.Loading -> Row(
                Modifier.fillMaxWidth().height(140.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(10.dp))
                Text("Ranking shared systems…", color = AppColors.appTextSecondary, fontSize = 13.sp)
            }

            store.leaderboard.isEmpty() && state is LoadState.Failed -> Column(
                Modifier.fillMaxWidth().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("Couldn't load leaderboard", color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold)
                Text(state.message, color = AppColors.appTextSecondary, fontSize = 12.sp, textAlign = TextAlign.Center)
                TextButton({ scope.launch { store.loadLeaderboard(force = true) } }) { Text("Retry") }
            }

            store.leaderboard.isEmpty() -> HubMessage(
                "No shared systems yet",
                "Shared ${store.sport.shortTitle} systems appear after 10 matching games have been graded.",
            )

            else -> LazyColumn(
                Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                itemsIndexed(rows, key = { _, row -> row.id }) { index, row ->
                    LeaderboardCard(index + 1, row, store.sport) { onSelect(row) }
                }
            }
        }
    }
}

@Composable
private fun LeaderboardCard(
    rank: Int,
    row: AnalysisSystemsLeaderboardRow,
    sport: HistoricalAnalysisSport,
    onTap: () -> Unit,
) {
    val record = row.allTime
    val labels = remember(row.id, row.filters) { systemFilterLabels(sport, row.filters) }
    SystemCard(Modifier.fillMaxWidth().clickable(onClick = onTap)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            SystemGlyph(sport, row.betType)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("#$rank", color = rankColor(rank), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(row.name, color = AppColors.appTextPrimary, fontSize = 15.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Text(
                    "by ${row.username} · ${systemMarketLabel(row.betType)}",
                    color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                    maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            SystemTemperatureBadge(AnalysisSystemCopy.temperature(row.streak, row.last10))
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("ROI", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp)
                Text(recordRoiText(record), color = metricTint(record?.roi), fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
        HorizontalDivider(color = AppColors.appBorder)
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            SystemFilterSummary(labels, limit = 1)
            Spacer(Modifier.weight(1f))
            // Sample tier is the honesty signal on a hot ROI — 12 games is not 300.
            AnalysisSystemCopy.sampleBadge(record?.n)?.let { badge ->
                Text(
                    badge.label.uppercase(),
                    color = AppColors.appTextMuted, fontSize = 9.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.4.sp,
                )
            }
            Text(
                "${AnalysisSystemCopy.recordText(record)} · ${recordUnitsText(record)}",
                color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

private fun rankColor(rank: Int): Color = when (rank) {
    1 -> Color(0xFFF59E0B)
    2 -> Color(0xFF94A3B8)
    3 -> Color(0xFFB45309)
    else -> AppColors.appTextSecondary
}

@Composable
private fun LeaderboardSystemDetail(
    row: AnalysisSystemsLeaderboardRow,
    sport: HistoricalAnalysisSport,
    onUse: () -> Unit,
    onSaveCopy: (() -> Unit)?,
) {
    val labels = remember(row.id, row.filters) { systemFilterLabels(sport, row.filters) }
    Column(
        Modifier.fillMaxWidth().heightIn(max = 620.dp).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(13.dp), verticalAlignment = Alignment.CenterVertically) {
            SystemGlyph(sport, row.betType, 48.dp)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(row.name, color = AppColors.appTextPrimary, fontSize = 19.sp, fontWeight = FontWeight.Bold)
                Text("by ${row.username}", color = AppColors.appTextSecondary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
            onSaveCopy?.let { TextButton(it) { Text("Save Copy", color = AppColors.appPrimary, fontWeight = FontWeight.SemiBold) } }
        }

        SystemCard(Modifier.fillMaxWidth()) {
            DetailRow("Rule") {
                Text(
                    "${AnalysisSystemCopy.verdictLabel(row.effectiveVerdict)} · ${systemMarketLabel(row.betType)}",
                    color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold,
                )
            }
            HorizontalDivider(color = AppColors.appBorder)
            DetailRow("Filters") {
                Row(Modifier.horizontalScroll(rememberScrollState())) {
                    SystemFilterSummary(labels, limit = maxOf(labels.size, 1))
                }
            }
            HorizontalDivider(color = AppColors.appBorder)
            Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                SystemMetric("RECORD", AnalysisSystemCopy.recordText(row.allTime))
                SystemMetric("ROI", recordRoiText(row.allTime), metricTint(row.allTime?.roi))
                SystemMetric("UNITS", recordUnitsText(row.allTime), metricTint(row.allTime?.units))
            }
            row.last10?.takeIf { it.n > 0 }?.let { last10 ->
                HorizontalDivider(color = AppColors.appBorder)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("LAST 10", color = AppColors.appTextMuted, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.5.sp)
                    Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(3.dp)) {
                        last10.results.take(10).forEach { result ->
                            Box(
                                Modifier
                                    .weight(1f)
                                    .height(7.dp)
                                    .clip(CircleShape)
                                    .background(if (result != 0) AppColors.appWin else AppColors.appLoss),
                            )
                        }
                    }
                    Text("${last10.wins}/${last10.n}", color = AppColors.appTextPrimary, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Button(
            onClick = onUse,
            enabled = row.filters != null,
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.appPrimary),
            modifier = Modifier.fillMaxWidth().height(50.dp),
        ) { Text("Use This System", fontSize = 15.sp, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun DetailRow(label: String, content: @Composable () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(label, color = AppColors.appTextMuted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(52.dp))
        content()
    }
}

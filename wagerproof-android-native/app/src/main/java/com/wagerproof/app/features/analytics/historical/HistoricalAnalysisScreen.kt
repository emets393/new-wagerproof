package com.wagerproof.app.features.analytics.historical

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.BookmarkBorder
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.HistoricalAnalysisBar
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisBreakdownRow
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUpcomingGame
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.services.HistoricalAnalysisSavedFiltersService
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.HistoricalAnalysisStore
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.launch
import kotlin.math.min

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HistoricalAnalysisScreen(sport: HistoricalAnalysisSport, modifier: Modifier = Modifier) {
    val store = remember(sport) { HistoricalAnalysisStore(sport) }
    val graph = appGraph()
    val userId = (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId
    val scope = rememberCoroutineScope()
    var breakdownTab by remember { mutableStateOf("team") }
    var breakdownSort by remember { mutableStateOf("n") }
    var teamSearch by remember { mutableStateOf("") }

    LaunchedEffect(sport, userId) { store.onAppear(userId) }
    DisposableEffect(store) { onDispose(store::close) }
    LaunchedEffect(store.snapshot.selectedConferences) {
        if (store.snapshot.selectedConferences.isNotEmpty() && breakdownTab == "conf") breakdownTab = "team"
    }

    Box(modifier.fillMaxSize().background(AppColors.appSurface)) {
        LazyColumn(
            Modifier.fillMaxSize().alpha(if (store.isRefetching) .55f else 1f),
            contentPadding = PaddingValues(bottom = 28.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            stickyHeader(key = "header") {
                Column(Modifier.background(AppColors.appSurface)) {
                    TitleBar(
                        title = "${sport.shortTitle} Trends",
                        store = store,
                        userId = userId,
                        refresh = { scope.launch { store.fetchNow() } },
                    )
                    HeroSection(store)
                    HistoricalAnalysisFilterBar(store)
                    Spacer(Modifier.height(8.dp))
                    Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder))
                }
            }
            store.analysis?.takeIf { store.hasLoadedOnce }?.let { data ->
                val bars = HistoricalAnalysisFilterBuilder.shownBars(data.bars, store.snapshot)
                if (bars.isNotEmpty()) item("bars") { BreakdownBars(data, bars, Modifier.padding(horizontal = 16.dp)) }
                item("table") {
                    BreakdownTable(
                        sport, store, data, breakdownTab, breakdownSort, teamSearch,
                        onTab = { breakdownTab = it }, onSort = { breakdownSort = it }, onSearch = { teamSearch = it },
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }
            if (store.upcoming.isNotEmpty()) item("upcoming") { UpcomingSection(store, Modifier.padding(horizontal = 16.dp)) }
        }
        if (store.isRefetching) CircularProgressIndicator(Modifier.align(Alignment.TopCenter).padding(top = 6.dp).size(22.dp), strokeWidth = 2.dp)
    }
}

@Composable
private fun TitleBar(
    title: String,
    store: HistoricalAnalysisStore,
    userId: String?,
    refresh: () -> Unit,
) {
    Row(Modifier.fillMaxWidth().height(52.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        IconButton(onClick = refresh) { Icon(Icons.Rounded.Refresh, "Refresh", tint = AppColors.appTextSecondary) }
        if (userId != null) SavedFiltersMenu(store, userId)
    }
}

@Composable
private fun SavedFiltersMenu(store: HistoricalAnalysisStore, userId: String) {
    val scope = rememberCoroutineScope()
    var expanded by remember { mutableStateOf(false) }
    var showSave by remember { mutableStateOf(false) }
    var saveName by remember { mutableStateOf("") }
    Box {
        IconButton(onClick = { expanded = true }) { Icon(Icons.Rounded.BookmarkBorder, "Saved filters", tint = AppColors.appTextSecondary) }
        DropdownMenu(expanded, { expanded = false }) {
            store.savedFilters.forEach { filter ->
                DropdownMenuItem(
                    text = { Text(filter.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    onClick = { expanded = false; store.restoreSaved(filter) },
                    trailingIcon = {
                        IconButton(onClick = { scope.launch { store.deleteSavedFilter(filter.id, userId) } }, modifier = Modifier.size(34.dp)) {
                            Icon(Icons.Rounded.DeleteOutline, "Delete ${filter.name}", Modifier.size(18.dp))
                        }
                    },
                )
            }
            DropdownMenuItem(
                text = { Text(if (store.savedFilters.size >= HistoricalAnalysisSavedFiltersService.MAX_PER_USER) "Saved-filter limit reached" else "Save current…") },
                enabled = store.savedFilters.size < HistoricalAnalysisSavedFiltersService.MAX_PER_USER,
                onClick = { expanded = false; showSave = true },
            )
        }
    }
    if (showSave) AlertDialog(
        onDismissRequest = { showSave = false; saveName = "" },
        title = { Text("Save filter") },
        text = { OutlinedTextField(saveName, { saveName = it }, label = { Text("Name this filter") }, singleLine = true) },
        confirmButton = { Button(enabled = saveName.isNotBlank(), onClick = {
            val name = saveName.trim()
            scope.launch { runCatching { store.saveCurrentFilter(name, userId) }; showSave = false; saveName = "" }
        }) { Text("Save") } },
        dismissButton = { TextButton(onClick = { showSave = false; saveName = "" }) { Text("Cancel") } },
    )
}

@Composable
private fun HeroSection(store: HistoricalAnalysisStore) {
    Box(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
        when (val state = store.loadState) {
            LoadState.Idle, LoadState.Loading -> Row(Modifier.fillMaxWidth().height(100.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp); Spacer(Modifier.width(10.dp)); Text("Loading analysis…", color = AppColors.appTextSecondary)
            }
            is LoadState.Failed -> Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(AppColors.appSurfaceElevated).padding(16.dp)) {
                Text(state.message, color = AppColors.appTextSecondary)
                TextButton(onClick = store::scheduleFetch) { Text("Try again") }
            }
            else -> store.analysis?.let { HeroCard(store, it) }
        }
    }
}

@Composable
private fun HeroCard(store: HistoricalAnalysisStore, data: HistoricalAnalysisResponse) {
    if (data.overall.n == 0) {
        Text("No games match these filters — try widening them.", color = AppColors.appTextSecondary,
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(AppColors.appSurfaceElevated).padding(16.dp))
        return
    }
    val metrics = HistoricalAnalysisCopy.headlineMetrics(store.snapshot, data)
    val subject = HistoricalAnalysisCopy.headlineSubject(store.sport, store.snapshot)
    val delta = metrics.hitPct - data.baselinePct
    val significance = HistoricalAnalysisCopy.significance(metrics.n, metrics.hitPct).first
    Box(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(AppColors.appSurfaceElevated)) {
        Box(Modifier.align(Alignment.CenterStart).padding(vertical = 12.dp).width(4.dp).height(112.dp).background(AppColors.appPrimary, RoundedCornerShape(2.dp)))
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(
                "$subject ${HistoricalAnalysisCopy.verb(store.betType)} ${HistoricalAnalysisCopy.trimmed(metrics.hitPct)}% " +
                    "(${metrics.wins} of ${metrics.n} ${HistoricalAnalysisCopy.noun(store.snapshot)})" +
                    (metrics.roi?.let { " · ${HistoricalAnalysisCopy.signedPct(it)} ROI" } ?: ""),
                color = AppColors.appTextPrimary, fontSize = 18.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold,
            )
            Text("${if (delta >= 0) "+" else ""}${HistoricalAnalysisCopy.trimmed(delta)} pts vs ${HistoricalAnalysisCopy.trimmed(data.baselinePct)}% baseline · $significance", color = AppColors.appTextSecondary, fontSize = 13.sp)
            Text(HistoricalAnalysisCopy.scopeNote(store.sport, store.snapshot), color = AppColors.appTextSecondary.copy(alpha = .85f), fontSize = 11.sp, lineHeight = 15.sp)
            Text("${data.coverage.nGames} games · ${HistoricalAnalysisCopy.yearRange(data.coverage.seasonMin, data.coverage.seasonMax)}" + if (store.isLimitedHistory) " · Limited history" else "", color = if (store.isLimitedHistory) AppColors.appAccentAmber else AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun BreakdownBars(data: HistoricalAnalysisResponse, bars: List<HistoricalAnalysisBar>, modifier: Modifier = Modifier) {
    CardColumn(modifier) {
        Text("BREAKDOWN", color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = .8.sp)
        Text("The same ${data.coverage.nGames} games, split by situation.", color = AppColors.appTextSecondary, fontSize = 11.sp)
        bars.forEach { bar ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(AppColors.appSurfaceMuted.copy(alpha = .45f)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(HistoricalAnalysisCopy.dimensionLabels[bar.dimension] ?: bar.dimension, color = AppColors.appTextSecondary, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                bar.options.forEach { option ->
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(Modifier.fillMaxWidth()) {
                            Text(HistoricalAnalysisCopy.sideLabel(data.betType, option.side), fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                            Text("${HistoricalAnalysisCopy.trimmed(option.hitPct)}% (${option.wins} of ${option.n})", color = if (option.hitPct >= 52.4) AppColors.appWin else AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                        HitRateBar(option.hitPct, data.baselinePct)
                        Row(Modifier.fillMaxWidth()) {
                            Text("vs ${HistoricalAnalysisCopy.trimmed(data.baselinePct)}% baseline", color = AppColors.appTextSecondary, fontSize = 10.sp, modifier = Modifier.weight(1f))
                            option.roi?.let { Text("${HistoricalAnalysisCopy.signedPct(it)} ROI", color = if (it >= 0) AppColors.appWin else AppColors.appLoss, fontSize = 10.sp) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HitRateBar(hitPct: Double, baseline: Double) {
    val fill = AppColors.appWin.copy(alpha = .55f)
    val track = AppColors.appSurfaceMuted
    val marker = AppColors.appTextPrimary.copy(alpha = .45f)
    Canvas(Modifier.fillMaxWidth().height(8.dp)) {
        drawLine(track, start = androidx.compose.ui.geometry.Offset(4f, size.height / 2), end = androidx.compose.ui.geometry.Offset(size.width - 4f, size.height / 2), strokeWidth = size.height, cap = StrokeCap.Round)
        drawLine(fill, start = androidx.compose.ui.geometry.Offset(4f, size.height / 2), end = androidx.compose.ui.geometry.Offset(size.width * min(hitPct, 100.0).toFloat() / 100f, size.height / 2), strokeWidth = size.height, cap = StrokeCap.Round)
        val x = size.width * baseline.toFloat() / 100f
        drawLine(marker, androidx.compose.ui.geometry.Offset(x, 0f), androidx.compose.ui.geometry.Offset(x, size.height), strokeWidth = 2f)
    }
}

@Composable
private fun BreakdownTable(
    sport: HistoricalAnalysisSport,
    store: HistoricalAnalysisStore,
    data: HistoricalAnalysisResponse,
    tab: String,
    sort: String,
    search: String,
    onTab: (String) -> Unit,
    onSort: (String) -> Unit,
    onSearch: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val tabs = if (sport == HistoricalAnalysisSport.NFL) listOf("team" to "By Team", "coach" to "By Coach", "ref" to "By Referee")
    else if (HistoricalAnalysisCopy.activeConferences(store.snapshot).isEmpty()) listOf("team" to "By Team", "conf" to "By Conference") else listOf("team" to "By Team")
    val rows = when (tab) { "coach" -> data.byCoach.orEmpty(); "ref" -> data.byReferee.orEmpty(); "conf" -> data.byConference.orEmpty(); else -> data.byTeam }
    val sorted = when (sort) { "hit" -> rows.sortedByDescending { it.hitPct }; "roi" -> rows.sortedByDescending { it.roi ?: -999.0 }; else -> rows.sortedByDescending { it.n } }
    val visible = if (tab == "team" && search.isNotBlank()) sorted.filter { it.label.contains(search, ignoreCase = true) } else sorted
    CardColumn(modifier) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            tabs.forEach { (key, label) -> FilterChip(tab == key, { onTab(key) }, label = { Text(label) }) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("n" to "Games", "hit" to "${HistoricalAnalysisCopy.outcomeLabel(store.betType)} %")
                .plus(if (store.betType in HistoricalAnalysisBetType.moneylineMarkets) emptyList() else listOf("roi" to "ROI"))
                .forEach { (key, label) -> FilterChip(sort == key, { onSort(key) }, label = { Text(label) }) }
        }
        if (tab == "team" && rows.size > 12) OutlinedTextField(search, onSearch, leadingIcon = { Icon(Icons.Rounded.Search, null) }, trailingIcon = { if (search.isNotEmpty()) IconButton({ onSearch("") }) { Icon(Icons.Rounded.Close, "Clear search") } }, placeholder = { Text("Search teams…") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        if (visible.isEmpty()) Text(if (rows.isEmpty()) "No results with enough games (min 3)." else "No teams match \"$search\".", color = AppColors.appTextSecondary, modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp))
        visible.take(75).forEachIndexed { index, row ->
            BreakdownRow(sport, store, row, showAvatar = tab == "team")
            if (index != visible.take(75).lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder))
        }
    }
}

@Composable
private fun BreakdownRow(sport: HistoricalAnalysisSport, store: HistoricalAnalysisStore, row: HistoricalAnalysisBreakdownRow, showAvatar: Boolean) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        if (showAvatar) TeamAvatar(sport, row.label, store.cfbLogos)
        Text(row.label, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        Text("${row.n}g", fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).background(AppColors.appSurfaceMuted).padding(horizontal = 6.dp, vertical = 2.dp))
        Text("${HistoricalAnalysisCopy.trimmed(row.hitPct)}%", color = when { row.hitPct > 50 -> AppColors.appWin; row.hitPct < 50 -> AppColors.appLoss; else -> AppColors.appTextPrimary }, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(50.dp))
        if (store.betType !in HistoricalAnalysisBetType.moneylineMarkets) Text(row.roi?.let(HistoricalAnalysisCopy::signedPct) ?: "—", color = if ((row.roi ?: 0.0) >= 0) AppColors.appWin else AppColors.appLoss, fontSize = 12.sp, modifier = Modifier.width(54.dp))
    }
}

@Composable
private fun UpcomingSection(store: HistoricalAnalysisStore, modifier: Modifier = Modifier) {
    CardColumn(modifier.border(1.dp, AppColors.appPrimary.copy(alpha = .25f), RoundedCornerShape(14.dp))) {
        Text("This week's games that match (${store.upcoming.size})", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        store.upcoming.forEach { game -> UpcomingRow(store, game) }
    }
}

@Composable
private fun UpcomingRow(store: HistoricalAnalysisStore, game: HistoricalAnalysisUpcomingGame) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(AppColors.appSurfaceMuted.copy(alpha = .5f)).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        TeamAvatar(store.sport, game.team, store.cfbLogos)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(game.matchup, fontSize = 14.sp, fontWeight = FontWeight.Medium)
            Text(HistoricalAnalysisCopy.lineForBet(store.betType, game), color = AppColors.appTextSecondary, fontSize = 12.sp)
            Text(HistoricalAnalysisCopy.fmtKickoff(game.kickoff), color = AppColors.appTextSecondary, fontSize = 11.sp)
        }
    }
}

@Composable
private fun TeamAvatar(sport: HistoricalAnalysisSport, team: String, cfbLogos: Map<String, String>) {
    val url = if (sport == HistoricalAnalysisSport.NFL) NFLTeamAssets.logo(team) else cfbLogos[team]
    val initials = team.split(' ').mapNotNull { it.firstOrNull() }.take(2).joinToString("")
    RemoteImage(url, team, Modifier.size(24.dp), ContentScale.Fit, error = { InitialsDisc(initials, 24.dp) })
}

@Composable
private fun CardColumn(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(AppColors.appSurfaceElevated).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(11.dp),
        content = content,
    )
}

package com.wagerproof.app.features.analytics.historical

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.imePadding
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
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.IosShare
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Visibility
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.di.appGraph
import com.wagerproof.app.features.shared.InitialsDisc
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AnalysisSystemCopy
import com.wagerproof.core.models.HistoricalAnalysisBar
import com.wagerproof.core.models.HistoricalAnalysisBarOption
import com.wagerproof.core.models.HistoricalAnalysisBetType
import com.wagerproof.core.models.HistoricalAnalysisBreakdownRow
import com.wagerproof.core.models.HistoricalAnalysisFilterBuilder
import com.wagerproof.core.models.HistoricalAnalysisResponse
import com.wagerproof.core.models.HistoricalAnalysisSport
import com.wagerproof.core.models.HistoricalAnalysisUpcomingGame
import com.wagerproof.core.models.MLBTeams
import com.wagerproof.core.models.NFLTeamAssets
import com.wagerproof.core.services.HistoricalAnalysisSavedFiltersService
import com.wagerproof.core.stores.AuthStore
import com.wagerproof.core.stores.HistoricalAnalysisStore
import com.wagerproof.core.stores.LoadState
import kotlinx.coroutines.launch
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun HistoricalAnalysisScreen(sport: HistoricalAnalysisSport, modifier: Modifier = Modifier) {
    val store = remember(sport) { HistoricalAnalysisStore(sport) }
    val graph = appGraph()
    val userId = (graph.auth.phase as? AuthStore.Phase.Authenticated)?.userId
    val scope = rememberCoroutineScope()
    // Keyed on sport: the tab set differs per sport (venue is MLB-only, coach/ref NFL-only).
    var breakdownTab by remember(sport) { mutableStateOf("team") }
    var breakdownSort by remember(sport) { mutableStateOf("n") }
    var teamSearch by remember(sport) { mutableStateOf("") }
    var showShareSheet by remember(sport) { mutableStateOf(false) }
    var activeSystemsTab by remember(sport) { mutableStateOf<SystemsHubTab?>(null) }
    var showSaveSystemSheet by remember(sport) { mutableStateOf(false) }
    // Post-save confirmation. It rides INSIDE the systems sheet, not a snackbar:
    // a snackbar on this screen would render behind the sheet we open next.
    var savedNotice by remember(sport) { mutableStateOf<String?>(null) }
    // Filter-chat result banner + the measured dock height, so the list can
    // scroll clear of the floating dock instead of ending underneath it.
    var chatResult by remember(sport) { mutableStateOf<HistoricalAnalysisCopy.NLResult?>(null) }
    var chatDockHeight by remember(sport) { mutableStateOf(0.dp) }
    val density = LocalDensity.current

    LaunchedEffect(sport, userId) { store.onAppear(userId) }
    DisposableEffect(store) { onDispose(store::close) }
    LaunchedEffect(store.snapshot.selectedConferences) {
        if (store.snapshot.selectedConferences.isNotEmpty() && breakdownTab == "conf") breakdownTab = "team"
    }

    // Results dim during a refetch; the title bar and the filter bar you are
    // editing must not (iOS applies the 0.55 to `scrollableContent` only).
    val contentAlpha = if (store.isRefetching) .55f else 1f

    Column(modifier.fillMaxSize().background(AppColors.appSurface)) {
        // Pinned like iOS's navigation bar — its toolbar actions (share, refresh,
        // leaderboard, systems) stay reachable no matter how far the list scrolls.
        TitleBar(
            title = "${sport.shortTitle} Trends",
            store = store,
            userId = userId,
            refresh = { scope.launch { store.refreshSaved(userId); store.fetchNow() } },
            onShare = { showShareSheet = true },
            onSaveSystem = { showSaveSystemSheet = true },
            onOpenSystems = { activeSystemsTab = it },
        )
        Box(Modifier.weight(1f).fillMaxWidth()) {
            LazyColumn(
                Modifier.fillMaxSize(),
                contentPadding = PaddingValues(bottom = 28.dp + chatDockHeight),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                // ONLY the filter bar pins. iOS pins exactly this one header
                // (`pinnedViews: [.sectionHeaders]`) and lets the summary scroll
                // with the results; pinning the summary too left the hero
                // occupying most of the screen with nothing scrollable under it.
                stickyHeader(key = "filters") {
                    Column(Modifier.background(AppColors.appSurface)) {
                        HistoricalAnalysisFilterBar(store)
                        Spacer(Modifier.height(8.dp))
                        Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder))
                    }
                }
                if (store.fetchErrorMessage != null || store.savedFiltersError != null) {
                    item("notices") { StoreNotices(store) }
                }
                store.viewingSystemBanner?.let { banner ->
                    item("system-banner") {
                        ViewingSystemBanner(banner) { store.viewingSystemBanner = null }
                    }
                }
                item("hero") { HeroSection(store, Modifier.alpha(contentAlpha)) }
                store.analysis?.takeIf { store.hasLoadedOnce }?.let { data ->
                    // The symmetric-split hero already prints the home/away + fav/dog
                    // bars — repeating them under BREAKDOWN is the same numbers twice.
                    val bars = if (store.shouldShowSymmetricSplit) emptyList()
                    else HistoricalAnalysisFilterBuilder.shownBars(data.bars, store.snapshot)
                    if (bars.isNotEmpty()) item("bars") {
                        BreakdownBars(
                            data, bars,
                            showsROI = HistoricalAnalysisBetType.showsROI(store.betType, sport),
                            modifier = Modifier.padding(horizontal = 16.dp).alpha(contentAlpha),
                        )
                    }
                    item("table") {
                        BreakdownTable(
                            sport, store, data, breakdownTab, breakdownSort, teamSearch,
                            onTab = { breakdownTab = it }, onSort = { breakdownSort = it }, onSearch = { teamSearch = it },
                            modifier = Modifier.padding(horizontal = 16.dp).alpha(contentAlpha),
                        )
                    }
                }
                if (store.upcoming.isNotEmpty()) item("upcoming") {
                    UpcomingSection(store, Modifier.padding(horizontal = 16.dp).alpha(contentAlpha))
                }
            }
            if (store.isRefetching) CircularProgressIndicator(Modifier.align(Alignment.TopCenter).padding(top = 6.dp).size(22.dp), strokeWidth = 2.dp)

            // Natural-language filter chat. Docked (not a list row) because it is
            // the discovery path for the ~120 filter dims behind the pill sheets —
            // it has to be reachable without scrolling, exactly as on iOS.
            TrendsFilterChatDock(
                store = store,
                sport = sport,
                userId = userId,
                scope = scope,
                onResult = { chatResult = HistoricalAnalysisCopy.nlResultMessage(it) },
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .imePadding()
                    .onSizeChanged { chatDockHeight = with(density) { it.height.toDp() } },
            )

            TrendsChatResultBanner(
                result = chatResult,
                onDismiss = { chatResult = null },
                modifier = Modifier.align(Alignment.TopCenter).padding(top = 8.dp),
            )
        }
    }

    if (showShareSheet) {
        TrendsShareSheet(
            sport = sport,
            snapshot = store.snapshot,
            analysis = store.analysis,
            cfbLogos = store.cfbLogos,
            onDismiss = { showShareSheet = false },
        )
    }

    if (showSaveSystemSheet && userId != null) {
        SaveSystemSheet(
            store = store,
            userId = userId,
            onDismiss = { showSaveSystemSheet = false },
            onSaved = { shared ->
                showSaveSystemSheet = false
                graph.reviewPrompts.recordSystemSaved()
                // Land the user in My Systems so the row they just named is visible —
                // a shared system won't reach the leaderboard until it's graded.
                savedNotice = systemSavedMessage(shared, store.savedFilters.size)
                activeSystemsTab = SystemsHubTab.MY_SYSTEMS
            },
        )
    }

    activeSystemsTab?.let { tab ->
        SystemsHubSheet(
            store = store,
            userId = userId,
            initialTab = tab,
            notice = savedNotice,
            onDismiss = { activeSystemsTab = null; savedNotice = null },
        )
    }
}

/**
 * Post-save confirmation, shown at the top of My Systems. Shared systems get the
 * expectation-setting line: the leaderboard only lists a system once the grader has
 * scored it AND it has 10 matching games, so "I shared it and it's not there" is the
 * predictable support question.
 */
internal fun systemSavedMessage(shared: Boolean, count: Int): String = if (shared) {
    "Saved and shared. It joins the leaderboard once graded — that needs 10 matching games."
} else {
    "Saved — $count system${if (count == 1) "" else "s"} in My Systems."
}

@Composable
private fun TitleBar(
    title: String,
    store: HistoricalAnalysisStore,
    userId: String?,
    refresh: () -> Unit,
    onShare: () -> Unit,
    onSaveSystem: () -> Unit,
    onOpenSystems: (SystemsHubTab) -> Unit,
) {
    Row(Modifier.fillMaxWidth().height(52.dp).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, color = AppColors.appTextPrimary, fontSize = 17.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        // Sharing an empty search would export a card with no number on it.
        val canShare = (store.analysis?.overall?.n ?: 0) > 0
        IconButton(onClick = onShare, enabled = canShare) {
            Icon(Icons.Rounded.IosShare, "Share this search", tint = if (canShare) AppColors.appTextSecondary else AppColors.appTextMuted.copy(alpha = .5f))
        }
        IconButton(onClick = refresh) { Icon(Icons.Rounded.Refresh, "Refresh", tint = AppColors.appTextSecondary) }
        // The leaderboard is anon-callable, so guests get the trophy too.
        IconButton(onClick = { onOpenSystems(SystemsHubTab.LEADERBOARD) }) {
            Icon(Icons.Rounded.EmojiEvents, "Systems Leaderboard", tint = AppColors.appTextSecondary)
        }
        SystemsMenu(store, userId, onSaveSystem, onOpenSystems)
    }
}

@Composable
private fun SystemsMenu(
    store: HistoricalAnalysisStore,
    userId: String?,
    onSaveSystem: () -> Unit,
    onOpenSystems: (SystemsHubTab) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    val atLimit = store.savedFilters.size >= HistoricalAnalysisSavedFiltersService.MAX_PER_USER
    Box {
        IconButton(onClick = { expanded = true }) {
            Icon(Icons.Rounded.BookmarkBorder, "Saved systems", tint = AppColors.appTextSecondary)
        }
        DropdownMenu(expanded, { expanded = false }) {
            if (userId == null) {
                DropdownMenuItem(
                    text = { Text("Sign in to save systems", color = AppColors.appTextSecondary) },
                    enabled = false,
                    onClick = {},
                )
            } else {
                DropdownMenuItem(
                    text = { Text(if (atLimit) "System limit reached" else "Save System…") },
                    enabled = !atLimit,
                    onClick = { expanded = false; onSaveSystem() },
                )
                DropdownMenuItem(
                    text = {
                        Text(
                            if (store.savedFilters.isEmpty()) "My Systems" else "My Systems (${store.savedFilters.size})",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    },
                    onClick = { expanded = false; onOpenSystems(SystemsHubTab.MY_SYSTEMS) },
                )
            }
            DropdownMenuItem(
                text = { Text("Systems Leaderboard") },
                onClick = { expanded = false; onOpenSystems(SystemsHubTab.LEADERBOARD) },
            )
        }
    }
}

/**
 * "You're looking at someone's rule, not a fresh search" — shown after applying a
 * saved or leaderboard system so the numbers on screen have an owner.
 */
@Composable
private fun ViewingSystemBanner(
    banner: HistoricalAnalysisStore.ViewingSystemBanner,
    onDismiss: () -> Unit,
) {
    val text = if (banner.username == "you") {
        "Viewing your system ${banner.name} — bets ${AnalysisSystemCopy.sideWord(banner.verdict)}."
    } else {
        "Viewing ${banner.name} by ${banner.username} — bets ${AnalysisSystemCopy.sideWord(banner.verdict)}. " +
            "Save your own copy to track it."
    }
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appPrimary.copy(alpha = .08f))
            .border(1.dp, AppColors.appPrimary.copy(alpha = .2f), RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(Icons.Rounded.Visibility, null, Modifier.size(16.dp), tint = AppColors.appPrimary)
        Text(text, color = AppColors.appTextPrimary, fontSize = 13.sp, lineHeight = 17.sp, modifier = Modifier.weight(1f))
        IconButton(onClick = onDismiss, modifier = Modifier.size(20.dp)) {
            Icon(Icons.Rounded.Close, "Dismiss system banner", Modifier.size(14.dp), tint = AppColors.appTextSecondary)
        }
    }
}

/**
 * Warnings that must sit ABOVE the numbers: a failed refetch leaves stale results
 * on screen, which otherwise reads as "the filter did nothing".
 */
@Composable
private fun StoreNotices(store: HistoricalAnalysisStore) {
    val notices = listOfNotNull(store.fetchErrorMessage, store.savedFiltersError)
    if (notices.isEmpty()) return
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        notices.forEach { message ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.ErrorOutline, null, tint = AppColors.appAccentAmber, modifier = Modifier.size(15.dp))
                Text(message, color = AppColors.appAccentAmber, fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
private fun HeroSection(store: HistoricalAnalysisStore, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)) {
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
        // A stale empty analysis sitting under freshly restored chips is not an empty
        // result yet — don't flash "No games match" while the refetch is in flight.
        if (store.isRefetching) {
            Row(Modifier.fillMaxWidth().height(72.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
            }
        } else {
            Text("No games match these filters — try widening them.", color = AppColors.appTextSecondary,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(AppColors.appSurfaceElevated).padding(16.dp))
        }
        return
    }
    // Two-sided markets with only game-level filters force a ~50% overall, which
    // is a tautology and not a finding — headline the real splits instead.
    val split = if (store.shouldShowSymmetricSplit) store.getSymmetricSplitData() else null
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(AppColors.appSurfaceElevated).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (split != null) SymmetricSplitHero(store, split) else HeroHeadline(store, data)
        Text(HistoricalAnalysisCopy.scopeNote(store.sport, store.snapshot), color = AppColors.appTextSecondary.copy(alpha = .85f), fontSize = 11.sp, lineHeight = 15.sp)
        Text("${data.coverage.nGames} games · ${HistoricalAnalysisCopy.yearRange(data.coverage.seasonMin, data.coverage.seasonMax)}" + if (store.isLimitedHistory) " · Limited history" else "", color = if (store.isLimitedHistory) AppColors.appAccentAmber else AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun HeroHeadline(store: HistoricalAnalysisStore, data: HistoricalAnalysisResponse) {
    // Over/under markets headline the side that actually hit — a 58.7% under must
    // never read as "went over 41.3%" (iOS heroSlice).
    val hero = HistoricalAnalysisCopy.heroSlice(store.snapshot, data)
    val metrics = hero.metrics
    val subject = HistoricalAnalysisCopy.headlineSubject(store.sport, store.snapshot)
    val delta = metrics.hitPct - hero.baseline
    val significance = HistoricalAnalysisCopy.significance(metrics.n, metrics.hitPct).first
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        TrendsHeroGauge(hitPct = metrics.hitPct, baseline = hero.baseline, outcomeWord = hero.outcome)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                buildAnnotatedString {
                    append("$subject ${hero.verb} ")
                    withStyle(SpanStyle(color = HistoricalAnalysisCopy.hitPctColor(metrics.hitPct))) {
                        append("${HistoricalAnalysisCopy.trimmed(metrics.hitPct)}%")
                    }
                    append(" (${metrics.wins} of ${metrics.n} ${HistoricalAnalysisCopy.noun(store.snapshot)})")
                    // MLB F5 ML's roi comes back non-null but is computed over a
                    // different population than hit% — the table hides it, so the
                    // headline sentence must too (iOS: HistoricalAnalysisView 363).
                    val roi = metrics.roi?.takeIf { HistoricalAnalysisBetType.showsROI(store.betType, store.sport) }
                    if (roi != null) append(" · ${HistoricalAnalysisCopy.signedPct(roi)} ROI")
                },
                color = AppColors.appTextPrimary, fontSize = 17.sp, lineHeight = 23.sp, fontWeight = FontWeight.SemiBold,
            )
            Text(
                "${if (delta >= 0) "+" else ""}${HistoricalAnalysisCopy.trimmed(delta)} pts vs " +
                    "${HistoricalAnalysisCopy.trimmed(hero.baseline)}% baseline · $significance",
                color = AppColors.appTextSecondary, fontSize = 13.sp, lineHeight = 17.sp,
            )
        }
    }
}

/**
 * Hollow hit-rate ring with the league baseline as a tick on the same circle —
 * port of iOS `TrendsHeroGauge` (itself a port of web `HeroGauge`). Drawn with a
 * Compose Canvas: 0% sits at 12 o'clock and the arc sweeps clockwise.
 */
@Composable
private fun TrendsHeroGauge(hitPct: Double, baseline: Double, outcomeWord: String, diameter: Dp = 112.dp) {
    val animated by animateFloatAsState(
        targetValue = hitPct.toFloat().coerceIn(0f, 100f),
        animationSpec = tween(durationMillis = 550),
        label = "trendsHeroGauge",
    )
    // Same three-stop ramp as web: at/above the baseline is green, within 3 pts
    // below is amber, anything further below is red.
    val ramp = when {
        hitPct >= maxOf(baseline, 50.0) -> listOf(Color(0xFF34D399), Color(0xFF059669))
        hitPct >= baseline - 3 -> listOf(Color(0xFFFBBF24), Color(0xFFD97706))
        else -> listOf(Color(0xFFF87171), Color(0xFFDC2626))
    }
    val trackColor = AppColors.appBorder.copy(alpha = .35f)
    val tickColor = AppColors.appTextPrimary.copy(alpha = .7f)
    Box(Modifier.size(diameter), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = this.size.minDimension * 10f / 118f
            val radius = this.size.minDimension / 2f - stroke
            val topLeft = Offset(this.size.width / 2f - radius, this.size.height / 2f - radius)
            val arcSize = Size(radius * 2, radius * 2)
            drawArc(
                color = trackColor,
                startAngle = 0f, sweepAngle = 360f, useCenter = false,
                topLeft = topLeft, size = arcSize,
                style = Stroke(width = stroke),
            )
            // rotate() moves the sweep gradient with the arc, so the ramp starts
            // at 12 o'clock alongside the fill instead of at 3 o'clock.
            rotate(-90f) {
                drawArc(
                    brush = Brush.sweepGradient(
                        listOf(ramp[0], ramp[1], ramp[1]),
                        center = this.center,
                    ),
                    startAngle = 0f,
                    sweepAngle = 360f * animated / 100f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }
            val tickRad = (baseline.toFloat().coerceIn(0f, 100f) / 100f * 2f * PI - PI / 2).toFloat()
            val inner = radius - stroke / 2f - 2f
            val outer = radius + stroke / 2f + 2f
            drawLine(
                color = tickColor,
                start = this.center + Offset(inner * cos(tickRad), inner * sin(tickRad)),
                end = this.center + Offset(outer * cos(tickRad), outer * sin(tickRad)),
                strokeWidth = 2.dp.toPx(),
                cap = StrokeCap.Round,
            )
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(HistoricalAnalysisCopy.trimmed(animated.toDouble()) + "%", color = AppColors.appTextPrimary, fontSize = 23.sp, fontWeight = FontWeight.Bold)
            Text("${outcomeWord.uppercase()} RATE", color = AppColors.appTextSecondary, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, letterSpacing = .6.sp)
        }
    }
}

/**
 * Hero for the forced-~50% state: the strongest real split as the headline, then
 * tappable Home/Away and Favorite/Underdog rows that apply that side as a filter.
 * Port of iOS `HistoricalAnalysisView.symmetricSplitHero`.
 */
@Composable
private fun SymmetricSplitHero(store: HistoricalAnalysisStore, split: HistoricalAnalysisStore.SymmetricSplit) {
    val extreme = split.extremeSide
    val showsROI = HistoricalAnalysisBetType.showsROI(store.betType, store.sport)
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Bottom) {
                Text("${HistoricalAnalysisCopy.trimmed(extreme.hitPct)}%", color = HistoricalAnalysisCopy.hitPctColor(extreme.hitPct), fontSize = 34.sp, fontWeight = FontWeight.Bold)
                if (showsROI) extreme.roi?.let {
                    Text(HistoricalAnalysisCopy.signedPct(it), color = if (it >= 0) AppColors.appWin else AppColors.appLoss, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 3.dp))
                }
            }
            Text("Best split: ${HistoricalAnalysisCopy.sideLabel(store.betType, extreme.side)}", color = AppColors.appTextSecondary, fontSize = 15.sp, fontWeight = FontWeight.Medium)
        }
        if (split.homeAway.isNotEmpty()) VersusRow(store, "Home vs Away", split.homeAway, "home_away")
        if (split.favDog.isNotEmpty()) VersusRow(store, "Favorite vs Dog", split.favDog, "fav_dog")
        Text(
            "Every game here has one side that covers and one that doesn't, so \"all teams\" is always ~50% on this market — these are the real splits.",
            color = AppColors.appTextSecondary.copy(alpha = .85f), fontSize = 11.sp, lineHeight = 15.sp,
        )
    }
}

@Composable
private fun VersusRow(
    store: HistoricalAnalysisStore,
    title: String,
    options: List<HistoricalAnalysisBarOption>,
    dimension: String,
) {
    val sorted = options.sortedByDescending { it.hitPct }
    val strong = sorted.firstOrNull() ?: return
    val weak = sorted.getOrNull(1)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium)
        if (weak != null) {
            // Web VersusRow: weaker left / stronger right, higher side emphasized.
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "${HistoricalAnalysisCopy.sideLabel(store.betType, weak.side)} ${HistoricalAnalysisCopy.trimmed(weak.hitPct)}%",
                    color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable { focusSide(store, dimension, weak.side) }.padding(horizontal = 4.dp, vertical = 3.dp),
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "${HistoricalAnalysisCopy.sideLabel(store.betType, strong.side)} ${HistoricalAnalysisCopy.trimmed(strong.hitPct)}%",
                    color = AppColors.appTextPrimary, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp)).clickable { focusSide(store, dimension, strong.side) }.padding(horizontal = 4.dp, vertical = 3.dp),
                )
            }
            SplitBar(weakPct = weak.hitPct, strongPct = strong.hitPct)
        } else {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).clickable { focusSide(store, dimension, strong.side) }.padding(vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(HistoricalAnalysisCopy.sideLabel(store.betType, strong.side), color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text("${HistoricalAnalysisCopy.trimmed(strong.hitPct)}%", color = AppColors.appWin, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

/** Mirror bars: weaker side grows from the left, stronger from the right, 50% tick in the middle. */
@Composable
private fun SplitBar(weakPct: Double, strongPct: Double) {
    val track = AppColors.appSurfaceMuted
    val weakFill = AppColors.appTextSecondary.copy(alpha = .35f)
    val strongFill = AppColors.appWin
    val tick = AppColors.appTextPrimary.copy(alpha = .45f)
    Canvas(Modifier.fillMaxWidth().height(10.dp)) {
        val h = size.height
        drawRoundRect(track, size = size, cornerRadius = CornerRadius(h / 2))
        val weakWidth = size.width * (weakPct.coerceIn(0.0, 100.0) / 100.0).toFloat()
        drawRoundRect(weakFill, size = Size(weakWidth, h), cornerRadius = CornerRadius(h / 2))
        val strongWidth = size.width * (strongPct.coerceIn(0.0, 100.0) / 100.0).toFloat()
        drawRoundRect(
            Brush.horizontalGradient(listOf(strongFill.copy(alpha = .75f), strongFill), startX = size.width - strongWidth, endX = size.width),
            topLeft = Offset(size.width - strongWidth, 0f),
            size = Size(strongWidth, h),
            cornerRadius = CornerRadius(h / 2),
        )
        drawLine(tick, Offset(size.width / 2f, 0f), Offset(size.width / 2f, h), strokeWidth = 2f)
    }
}

/** Tapping a split side applies it as the matching filter and refetches (iOS `focusSide`). */
private fun focusSide(store: HistoricalAnalysisStore, dimension: String, side: String) {
    store.updateSnapshot { snapshot ->
        when {
            dimension == "home_away" -> snapshot.side = side
            snapshot.betType in setOf("fg_spread", "h1_spread") -> snapshot.spreadSide = side
            else -> snapshot.favDog = side
        }
    }
    store.scheduleFetch()
}

@Composable
private fun BreakdownBars(
    data: HistoricalAnalysisResponse,
    bars: List<HistoricalAnalysisBar>,
    showsROI: Boolean,
    modifier: Modifier = Modifier,
) {
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
                            // Same gate as the hero and the table: MLB F5 ML's ROI
                            // spans only priced rows, so the codebase treats it as
                            // invalid and no surface may print it (iOS: 861).
                            if (showsROI) option.roi?.let { Text("${HistoricalAnalysisCopy.signedPct(it)} ROI", color = if (it >= 0) AppColors.appWin else AppColors.appLoss, fontSize = 10.sp) }
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
    val tabs = when (sport) {
        HistoricalAnalysisSport.NFL -> listOf("team" to "By Team", "coach" to "By Coach", "ref" to "By Referee")
        HistoricalAnalysisSport.MLB -> listOf("team" to "By Team", "venue" to "By Venue")
        HistoricalAnalysisSport.CFB ->
            if (HistoricalAnalysisCopy.activeConferences(store.snapshot).isEmpty()) {
                listOf("team" to "By Team", "conf" to "By Conference")
            } else listOf("team" to "By Team")
    }
    val rows = when (tab) {
        "coach" -> data.byCoach.orEmpty()
        "ref" -> data.byReferee.orEmpty()
        "conf" -> data.byConference.orEmpty()
        "venue" -> data.byVenue.orEmpty()
        else -> data.byTeam
    }
    // The RPC now returns real moneyline ROI; only MLB F5 ML lacks it. Sorting by a
    // hidden column would silently reorder the table, so fall back to game count.
    val showsROI = HistoricalAnalysisBetType.showsROI(store.betType, sport)
    val effectiveSort = if (!showsROI && sort == "roi") "n" else sort
    val sorted = when (effectiveSort) {
        "hit" -> rows.sortedByDescending { it.hitPct }
        "roi" -> rows.sortedByDescending { it.roi ?: -999.0 }
        else -> rows.sortedByDescending { it.n }
    }
    val matching = if (tab == "team" && search.isNotBlank()) sorted.filter { it.label.contains(search, ignoreCase = true) } else sorted
    // A 130-school CFB by_team list buries the upcoming-games section, so cap it
    // at the same 15 rows iOS does and expose the rest behind an expander
    // (iOS `rowCap`). Reset whenever the tab or the search text changes —
    // "Show fewer" must not silently carry over to a different list.
    var showAllRows by remember(tab, search) { mutableStateOf(false) }
    val visible = if (showAllRows) matching else matching.take(ROW_CAP)
    CardColumn(modifier) {
        Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            tabs.forEach { (key, label) -> FilterChip(tab == key, { onTab(key) }, label = { Text(label) }) }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("n" to "Games", "hit" to "${HistoricalAnalysisCopy.outcomeLabel(store.betType)} %")
                .plus(if (showsROI) listOf("roi" to "ROI") else emptyList())
                .forEach { (key, label) -> FilterChip(effectiveSort == key, { onSort(key) }, label = { Text(label) }) }
        }
        if (tab == "team" && rows.size > 12) OutlinedTextField(search, onSearch, leadingIcon = { Icon(Icons.Rounded.Search, null) }, trailingIcon = { if (search.isNotEmpty()) IconButton({ onSearch("") }) { Icon(Icons.Rounded.Close, "Clear search") } }, placeholder = { Text("Search teams…") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        if (visible.isEmpty()) Text(if (rows.isEmpty()) "No results with enough games (min 3)." else "No teams match \"$search\".", color = AppColors.appTextSecondary, modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp))
        visible.forEachIndexed { index, row ->
            // Venue rows carry the park's resident team so users can tell whose park it is.
            val avatarTeam = when (tab) { "team" -> row.label; "venue" -> row.homeTeam; else -> null }
            BreakdownRow(sport, row, avatarTeam, showsROI, store.cfbLogos)
            if (index != visible.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(AppColors.appBorder))
        }
        if (matching.size > ROW_CAP) {
            TextButton(onClick = { showAllRows = !showAllRows }, modifier = Modifier.fillMaxWidth()) {
                Text(
                    if (showAllRows) "Show fewer" else "Show all ${matching.size}",
                    color = AppColors.appPrimary, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

/** Breakdown rows shown before the "Show all N" expander (iOS `rowCap`). */
private const val ROW_CAP = 15

@Composable
private fun BreakdownRow(
    sport: HistoricalAnalysisSport,
    row: HistoricalAnalysisBreakdownRow,
    avatarTeam: String?,
    showsROI: Boolean,
    cfbLogos: Map<String, String>,
) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        if (avatarTeam != null) TeamAvatar(sport, avatarTeam, cfbLogos)
        Text(row.label, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        Text("${row.n}g", fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(CircleShape).background(AppColors.appSurfaceMuted).padding(horizontal = 6.dp, vertical = 2.dp))
        Text("${HistoricalAnalysisCopy.trimmed(row.hitPct)}%", color = when { row.hitPct > 50 -> AppColors.appWin; row.hitPct < 50 -> AppColors.appLoss; else -> AppColors.appTextPrimary }, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(50.dp))
        if (showsROI) Text(row.roi?.let(HistoricalAnalysisCopy::signedPct) ?: "—", color = if ((row.roi ?: 0.0) >= 0) AppColors.appWin else AppColors.appLoss, fontSize = 12.sp, modifier = Modifier.width(54.dp))
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
            Text(HistoricalAnalysisCopy.upcomingTimeLabel(game), color = AppColors.appTextSecondary, fontSize = 11.sp)
            if (store.sport == HistoricalAnalysisSport.MLB) {
                val chips = HistoricalAnalysisCopy.mlbUpcomingChips(game)
                if (chips.isNotEmpty()) {
                    Text(
                        chips.joinToString(" · "),
                        color = AppColors.appTextSecondary.copy(alpha = .9f),
                        fontSize = 11.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun TeamAvatar(sport: HistoricalAnalysisSport, team: String, cfbLogos: Map<String, String>) {
    val url = when (sport) {
        HistoricalAnalysisSport.NFL -> NFLTeamAssets.logo(team)
        HistoricalAnalysisSport.CFB -> cfbLogos[team]
        HistoricalAnalysisSport.MLB -> MLBTeams.logoUrl(team)
    }
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

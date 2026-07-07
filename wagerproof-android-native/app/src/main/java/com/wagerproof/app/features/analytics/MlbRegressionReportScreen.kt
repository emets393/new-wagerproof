package com.wagerproof.app.features.analytics

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.core.design.components.SkeletonBlock
import com.wagerproof.core.design.components.liquidGlassBackground
import com.wagerproof.core.design.components.shimmering
import com.wagerproof.core.design.components.staggeredAppear
import com.wagerproof.core.design.icons.AppIcon
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.design.tokens.Spacing
import com.wagerproof.core.models.MLBRegressionReport
import com.wagerproof.core.stores.MLBBucketAccuracyStore
import com.wagerproof.core.stores.MLBModelBreakdownStore
import com.wagerproof.core.stores.MLBPerfectStormRecordsStore
import com.wagerproof.core.stores.MLBRegressionReportStore
import com.wagerproof.core.stores.MLBSeriesSignalsStore
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * MLB Daily Regression Report — Compose port of iOS `MlbRegressionReportView`.
 * Five independent stores hydrate in parallel on entry; the feed renders 11
 * data-gated sections under pinned liquid-glass capsule pills, with a
 * jump-to-section menu + pull-to-refresh. See docs/inventory/08 §4.8.
 *
 * Not yet wired into nav (MainScaffold/AppRoute) — delivered standalone.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun MlbRegressionReportScreen(modifier: Modifier = Modifier) {
    // iOS instantiates these per-view (@State); mirror with remember{}. Two of
    // them own a coroutine scope — closed on dispose below.
    val reportStore = remember { MLBRegressionReportStore() }
    val bucketStore = remember { MLBBucketAccuracyStore() }
    val breakdownStore = remember { MLBModelBreakdownStore() }
    val psRecordsStore = remember { MLBPerfectStormRecordsStore() }
    val seriesStore = remember { MLBSeriesSignalsStore() }

    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var refreshing by remember { mutableStateOf(false) }

    DisposableEffect(Unit) {
        onDispose {
            reportStore.close()
            bucketStore.close()
        }
    }

    // Cold start: all five stores are independent — hydrate in parallel.
    LaunchedEffect(Unit) {
        coroutineScope {
            launch { reportStore.refreshIfStale() }
            launch { bucketStore.refreshIfStale() }
            launch { breakdownStore.refreshIfStale() }
            launch { psRecordsStore.refreshIfStale() }
            launch { seriesStore.refreshIfStale() }
        }
    }

    suspend fun refreshAll() {
        coroutineScope {
            launch { reportStore.refresh() }
            launch { bucketStore.refresh() }
            launch { breakdownStore.refresh() }
            launch { psRecordsStore.refresh() }
            launch { seriesStore.refresh() }
        }
    }

    val report = reportStore.report
    val sections = report?.let {
        buildSections(it, bucketStore, breakdownStore, psRecordsStore, seriesStore)
    } ?: emptyList()

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = AppColors.appSurface,
        topBar = {
            TopAppBar(
                title = { Text("MLB Regression Report", fontSize = 17.sp, fontWeight = FontWeight.SemiBold) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.appSurface,
                    titleContentColor = AppColors.appTextPrimary,
                    actionIconContentColor = AppColors.appPrimary,
                ),
                actions = {
                    JumpMenu(
                        sections = sections,
                        onJump = { headerIndex ->
                            scope.launch { listState.animateScrollToItem(headerIndex) }
                        },
                    )
                    IconButton(onClick = {
                        scope.launch {
                            refreshing = true
                            refreshAll()
                            refreshing = false
                        }
                    }) {
                        Icon(AppIcon.ARROW_CLOCKWISE.imageVector, contentDescription = "Refresh")
                    }
                },
            )
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = {
                scope.launch {
                    refreshing = true
                    refreshAll()
                    refreshing = false
                }
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (report != null) {
                Feed(report, sections, listState)
            } else {
                // Non-feed states still need a scroll container for pull-to-refresh.
                LazyColumn(state = listState, modifier = Modifier.fillMaxSize()) {
                    item {
                        when {
                            reportStore.loading || reportStore.lastFetchedKey == null -> LoadingState()
                            reportStore.errorMessage != null -> ErrorState(reportStore.errorMessage)
                            else -> NoReportState()
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Feed --------------------------------------------------------------

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Feed(
    report: MLBRegressionReport,
    sections: List<Section>,
    listState: androidx.compose.foundation.lazy.LazyListState,
) {
    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = Spacing.xxl),
    ) {
        item(key = "date-row") { DateRow(report) }

        sections.forEachIndexed { i, section ->
            stickyHeader(key = "header-${section.title}") { SectionHeaderPill(section) }
            item(key = "body-${section.title}") {
                Box(
                    Modifier
                        .staggeredAppear(i)
                        .padding(horizontal = Spacing.lg),
                ) { section.content() }
            }
        }
    }
}

@Composable
private fun DateRow(report: MLBRegressionReport) {
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.lg)
            .padding(top = Spacing.md),
    ) {
        formattedReportDate(report.reportDate)?.let {
            Text(
                text = it.uppercase(),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp,
                color = AppColors.appTextSecondary,
            )
        }
        Regression.timeAgo(report.generatedAt)?.let {
            Text("Updated $it", fontSize = 11.sp, color = AppColors.appTextSecondary)
        }
    }
}

/**
 * Pinned section header — a content-hugging liquid-glass pill (24pt tinted icon
 * chip + 15pt title + optional count capsule) that floats over the scrolling
 * content, matching iOS's `sectionHeader`.
 */
@Composable
private fun SectionHeaderPill(section: Section) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.lg, vertical = 8.dp),
    ) {
        Row(
            Modifier
                .height(40.dp)
                .liquidGlassBackground(CircleShape)
                .border(1.dp, AppColors.appBorder.copy(alpha = 0.35f), CircleShape)
                .padding(horizontal = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Box(
                Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(7.dp))
                    .background(section.tint.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = section.icon,
                    contentDescription = null,
                    tint = section.tint,
                    modifier = Modifier.size(13.dp),
                )
            }
            Text(
                text = section.title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.appTextPrimary,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            section.count?.let { count ->
                Text(
                    text = count.toString(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = section.tint,
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(section.tint.copy(alpha = 0.18f))
                        .padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
        }
    }
}

@Composable
private fun JumpMenu(sections: List<Section>, onJump: (Int) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    IconButton(onClick = { expanded = true }, enabled = sections.isNotEmpty()) {
        Icon(AppIcon.LIST_BULLET.imageVector, contentDescription = "Jump to section")
    }
    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        sections.forEachIndexed { i, section ->
            DropdownMenuItem(
                text = { Text(section.title) },
                leadingIcon = { Icon(section.icon, contentDescription = null) },
                onClick = {
                    expanded = false
                    // date row = item 0; each section contributes a header + body,
                    // so section i's pinned header sits at LazyColumn index 1 + 2*i.
                    onJump(1 + 2 * i)
                },
            )
        }
    }
}

// MARK: - Section model + builder -------------------------------------------

private data class Section(
    val title: String,
    val icon: ImageVector,
    val tint: Color,
    val count: Int? = null,
    val content: @Composable () -> Unit,
)

@Composable
private fun buildSections(
    report: MLBRegressionReport,
    bucketStore: MLBBucketAccuracyStore,
    breakdownStore: MLBModelBreakdownStore,
    psRecordsStore: MLBPerfectStormRecordsStore,
    seriesStore: MLBSeriesSignalsStore,
): List<Section> {
    val sections = mutableListOf<Section>()

    val narrative = report.narrativeText
    if (!narrative.isNullOrEmpty()) {
        sections += Section("AI Analysis Summary", AppIcon.BOLT_FILL.imageVector, Regression.accentPurple) {
            RegressionNarrativeCard(narrative)
        }
    }

    sections += Section("Model Accuracy", AppIcon.CHART_BAR_FILL.imageVector, Regression.accentBlue) {
        RegressionAccuracySection(bucketStore.data, bucketStore.loading)
    }

    if (breakdownStore.rows.isNotEmpty() || breakdownStore.loading) {
        sections += Section(
            "Day-of-Week & Team Breakdown",
            Regression.icon("chart.bar.doc.horizontal.fill", AppIcon.CHART_BAR_XAXIS),
            Regression.accentPurple,
        ) { RegressionModelBreakdownSection(breakdownStore) }
    }

    val recap = report.yesterdayRecap
    if (recap != null) {
        sections += Section("Yesterday's Results", AppIcon.TROPHY_FILL.imageVector, Regression.accentYellow) {
            RegressionRecapSection(recap, psRecordsStore.records)
        }
    }

    val picks = report.suggestedPicks ?: emptyList()
    sections += Section(
        "Regression Report Suggested Picks",
        AppIcon.BOLT_FILL.imageVector,
        Regression.hammerPurple,
        count = if (picks.isEmpty()) null else picks.size,
    ) { PicksBody(picks, report.reportDate, psRecordsStore, breakdownStore) }

    val negative = report.pitcherNegativeRegression ?: emptyList()
    val positive = report.pitcherPositiveRegression ?: emptyList()
    if (negative.isNotEmpty() || positive.isNotEmpty()) {
        sections += Section("Starting Pitcher Regression", AppIcon.FLAME_FILL.imageVector, Regression.accentOrange) {
            PitcherBody(negative, positive)
        }
    }

    val heatUp = report.battingHeatUp ?: emptyList()
    val coolDown = report.battingCoolDown ?: emptyList()
    if (heatUp.isNotEmpty() || coolDown.isNotEmpty()) {
        sections += Section("Team Batting Regression", AppIcon.CHART_LINE_UPTREND.imageVector, Regression.accentBlue) {
            BattingBody(heatUp, coolDown)
        }
    }

    val bullpens = report.bullpenFatigue ?: emptyList()
    if (bullpens.isNotEmpty()) {
        sections += Section(
            "Bullpen Fatigue & Trends",
            Regression.icon("shield.lefthalf.filled", AppIcon.SHIELD_FILL),
            Regression.accentPurple,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                bullpens.forEach { BullpenFatigueCard(it) }
            }
        }
    }

    val splits = report.lrSplitsToday ?: emptyList()
    if (splits.isNotEmpty()) {
        sections += Section("L/R Pitcher Splits", AppIcon.SCOPE.imageVector, Regression.accentIndigo) {
            LRSplitsSection(splits)
        }
    }

    val signals = seriesStore.signals
    if (signals.isNotEmpty()) {
        // Positives (BACK) before negatives (FADE) — RN parity.
        val ordered = signals.filter { it.isPositive } + signals.filter { !it.isPositive }
        sections += Section("Series-Position Signals", AppIcon.TARGET.imageVector, Regression.accentPurple) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                ordered.forEach { SeriesSignalCard(it) }
            }
        }
    }

    val weather = report.weatherParkFlags ?: emptyList()
    if (weather.isNotEmpty()) {
        sections += Section("Weather & Park Impact", AppIcon.WIND.imageVector, Regression.accentCyan) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                weather.forEach { WeatherParkFlagCard(it) }
            }
        }
    }

    return sections
}

// MARK: - Composite bodies --------------------------------------------------

@Composable
private fun PicksBody(
    picks: List<com.wagerproof.core.models.MLBSuggestedPick>,
    reportDate: String,
    psRecordsStore: MLBPerfectStormRecordsStore,
    breakdownStore: MLBModelBreakdownStore,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val records = psRecordsStore.records
        if (records != null) {
            PerfectStormTierRecordsGrid(records)
        } else if (psRecordsStore.loading) {
            TierRecordsSkeleton()
        }

        if (picks.isEmpty()) {
            Text(
                text = "No Perfect Storm picks today — the model didn't find any games meeting the criteria.",
                fontSize = 12.sp,
                fontStyle = FontStyle.Italic,
                color = AppColors.appTextSecondary,
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                picks.forEach { PerfectStormPickCard(it, reportDate, breakdownStore.rows) }
            }
        }
    }
}

@Composable
private fun PitcherBody(
    negative: List<com.wagerproof.core.models.MLBPitcherRegression>,
    positive: List<com.wagerproof.core.models.MLBPitcherRegression>,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (negative.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                RegressionGroupLabel("DUE FOR NEGATIVE REGRESSION", negative.size, color = Regression.lossRed, note = "ERA too low vs xFIP — been lucky")
                negative.forEach { PitcherRegressionCard(it) }
            }
        }
        if (positive.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                RegressionGroupLabel("DUE FOR POSITIVE REGRESSION", positive.size, color = Regression.winGreen, note = "ERA too high vs xFIP — been unlucky")
                positive.forEach { PitcherRegressionCard(it) }
            }
        }
    }
}

@Composable
private fun BattingBody(
    heatUp: List<com.wagerproof.core.models.MLBBattingRegression>,
    coolDown: List<com.wagerproof.core.models.MLBBattingRegression>,
) {
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        if (heatUp.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                RegressionGroupLabel("DUE TO HEAT UP", heatUp.size, color = Regression.winGreen, note = "Low BABIP + strong contact quality")
                heatUp.forEach { BattingRegressionCard(it) }
            }
        }
        if (coolDown.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                RegressionGroupLabel("DUE TO COOL DOWN", coolDown.size, color = Regression.lossRed, note = "High BABIP + weak contact quality")
                coolDown.forEach { BattingRegressionCard(it) }
            }
        }
    }
}

// MARK: - States ------------------------------------------------------------

@Composable
private fun TierRecordsSkeleton() {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        repeat(2) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(2) {
                    Column(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f))
                            .padding(horizontal = 10.dp, vertical = 6.dp)
                            .shimmering(),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        SkeletonBlock(width = 90.dp, height = 9.dp)
                        SkeletonBlock(width = 70.dp, height = 14.dp)
                        SkeletonBlock(width = 60.dp, height = 10.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun LoadingState() {
    Column(
        Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(
            Modifier
                .padding(horizontal = Spacing.lg)
                .padding(top = Spacing.md)
                .shimmering(),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            SkeletonBlock(width = 200.dp, height = 11.dp)
            SkeletonBlock(width = 110.dp, height = 10.dp)
        }
        Column(Modifier.padding(horizontal = Spacing.lg), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HeroTilePlaceholder(Modifier.weight(1f))
                HeroTilePlaceholder(Modifier.weight(1f))
            }
            repeat(2) { AccentRowPlaceholder(lines = 2) }
        }
        Column(Modifier.padding(horizontal = Spacing.lg), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            TierRecordsSkeleton()
            repeat(2) { AccentRowPlaceholder(lines = 3) }
        }
    }
}

@Composable
private fun HeroTilePlaceholder(modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceMuted.copy(alpha = 0.4f))
            .padding(14.dp)
            .shimmering(),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        SkeletonBlock(width = 70.dp, height = 9.dp)
        SkeletonBlock(width = 90.dp, height = 22.dp)
        SkeletonBlock(width = 80.dp, height = 11.dp)
    }
}

@Composable
private fun AccentRowPlaceholder(lines: Int) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(AppColors.appSurfaceElevated)
            .border(1.dp, AppColors.appBorder, RoundedCornerShape(14.dp))
            .padding(12.dp)
            .shimmering(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                SkeletonBlock(width = 120.dp, height = 13.dp)
                SkeletonBlock(width = 80.dp, height = 10.dp)
            }
            SkeletonBlock(width = 56.dp, height = 16.dp, cornerRadius = 8.dp)
        }
        repeat(maxOf(0, lines - 1)) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                repeat(4) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        SkeletonBlock(width = 34.dp, height = 9.dp)
                        SkeletonBlock(width = 44.dp, height = 13.dp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ErrorState(message: String?) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.lg)
            .padding(top = 40.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Regression.lossRed.copy(alpha = 0.08f))
            .border(1.dp, Regression.lossRed.copy(alpha = 0.2f), RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(AppIcon.EXCLAMATION_TRIANGLE_FILL.imageVector, contentDescription = null, tint = Regression.lossRed)
        Text(
            text = message ?: "Failed to load regression report.",
            fontSize = 13.sp,
            color = AppColors.appTextPrimary,
        )
    }
}

@Composable
private fun NoReportState() {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = Spacing.lg)
            .padding(top = 40.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(AppColors.appSurfaceMuted)
            .border(1.dp, AppColors.appBorder, RoundedCornerShape(12.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Icon(AppIcon.INFO_CIRCLE_FILL.imageVector, contentDescription = null, tint = AppColors.appTextSecondary)
        Text(
            text = "No regression report available yet. Reports generate at 9 AM, 11 AM, and 4 PM ET.",
            fontSize = 13.sp,
            color = AppColors.appTextPrimary,
        )
    }
}

// MARK: - Formatting --------------------------------------------------------

private val REPORT_DATE_OUT = DateTimeFormatter.ofPattern("EEEE, MMMM d, yyyy", Locale.US)

private fun formattedReportDate(reportDate: String): String? =
    runCatching { LocalDate.parse(reportDate).format(REPORT_DATE_OUT) }.getOrNull()

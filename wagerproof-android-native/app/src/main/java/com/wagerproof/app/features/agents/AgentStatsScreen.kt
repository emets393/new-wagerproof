package com.wagerproof.app.features.agents

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.wagerproof.app.features.agents.components.AgentStatsSkeleton
import com.wagerproof.app.features.agents.components.DistributionHistogramChart
import com.wagerproof.app.features.agents.components.FittedCurveOverlayChart
import com.wagerproof.app.features.agents.components.FittedCurveSeries
import com.wagerproof.app.features.agents.sheets.BinAgentsSheet
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.AgentSport
import com.wagerproof.core.models.DistributionBucket
import com.wagerproof.core.models.DistributionStatistics
import com.wagerproof.core.models.NormalFit
import com.wagerproof.core.models.StatMetric
import com.wagerproof.core.stores.LoadState
import com.wagerproof.core.stores.PlatformStatsStore
import kotlinx.coroutines.launch
import kotlin.math.ceil
import kotlin.math.floor

private enum class StatsSportOption(val label: String, val key: String?, val agentSport: AgentSport?) {
    All("All", null, null),
    Mlb("MLB", "mlb", AgentSport.MLB),
    Nba("NBA", "nba", AgentSport.NBA),
    Ncaab("NCAAB", "ncaab", AgentSport.NCAAB),
    Nfl("NFL", "nfl", AgentSport.NFL),
}

private enum class BinGranularity(val label: String) { Fine("Fine"), Medium("Medium"), Coarse("Coarse") }

private fun BinGranularity.width(metric: StatMetric): Double = when (metric) {
    StatMetric.WIN_RATE -> when (this) { BinGranularity.Fine -> 0.02; BinGranularity.Medium -> 0.05; BinGranularity.Coarse -> 0.10 }
    StatMetric.NET_UNITS -> when (this) { BinGranularity.Fine -> 1.0; BinGranularity.Medium -> 2.0; BinGranularity.Coarse -> 5.0 }
}

private data class DrillContext(val title: String, val metric: StatMetric, val sport: AgentSport?, val lower: Double, val upper: Double)

private data class SportSpec(val key: String, val label: String, val color: Color)

private val realSports = listOf(
    SportSpec("mlb", "MLB", AppColors.appAccentBlue),
    SportSpec("nba", "NBA", AppColors.appWin),
    SportSpec("ncaab", "NCAAB", Color(0xFFF97316)),
)
private const val SPORT_FLOOR = 15
private val SPORT_DOMAIN = 0.2..0.85
private const val SPORT_BIN_WIDTH = 0.05
private const val BREAK_EVEN = 0.5238
private val nflPurple = Color(0xFF9B59B6)

/**
 * Admin/secret "Platform Statistics" — whole-population agent performance
 * distributions. iOS `AgentStatsView`. Parent-owned [PlatformStatsStore]; not
 * wired to a route.
 */
@Composable
fun AgentStatsScreen(store: PlatformStatsStore, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    var metric by remember { mutableStateOf(StatMetric.WIN_RATE) }
    var sport by remember { mutableStateOf(StatsSportOption.All) }
    var minDecided by remember { mutableStateOf(20f) }
    var granularity by remember { mutableStateOf(BinGranularity.Medium) }
    var drill by remember { mutableStateOf<DrillContext?>(null) }

    LaunchedEffect(Unit) { if (store.data.isEmpty()) store.refresh() }

    Box(modifier.fillMaxSize().background(AppColors.appSurface)) {
        when (val state = store.loadState) {
            is LoadState.Idle, is LoadState.Loading -> AgentStatsSkeleton()
            is LoadState.Failed -> ErrorView(state.message) { scope.launch { store.refresh() } }
            else -> LoadedBody(
                store = store,
                metric = metric,
                sport = sport,
                minDecided = minDecided,
                granularity = granularity,
                onMetric = { metric = it },
                onSport = { sport = it },
                onThreshold = { minDecided = it },
                onGranularity = { granularity = it },
                onDrill = { drill = it },
            )
        }
    }

    drill?.let { ctx ->
        BinAgentsSheet(
            title = ctx.title,
            metric = ctx.metric,
            sport = ctx.sport,
            lower = ctx.lower,
            upper = ctx.upper,
            minDecided = minDecided.toInt(),
            onDismiss = { drill = null },
        )
    }
}

@Composable
private fun LoadedBody(
    store: PlatformStatsStore,
    metric: StatMetric,
    sport: StatsSportOption,
    minDecided: Float,
    granularity: BinGranularity,
    onMetric: (StatMetric) -> Unit,
    onSport: (StatsSportOption) -> Unit,
    onThreshold: (Float) -> Unit,
    onGranularity: (BinGranularity) -> Unit,
    onDrill: (DrillContext) -> Unit,
) {
    val n = minDecided.toInt()
    val values = heroValues(store, metric, sport, n)
    val domain = heroDomain(metric, values)
    val binWidth = granularity.width(metric)
    val buckets = DistributionStatistics.histogram(values, domain, binWidth)
    val fit = DistributionStatistics.fit(values)
    val curve = fit?.let { DistributionStatistics.curvePoints(it, domain, binWidth) } ?: emptyList()

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        // Intro
        StatCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(agentSymbol("chart.bar.xaxis"), contentDescription = null, tint = AppColors.appPrimary, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Platform Statistics", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            }
            Spacer(Modifier.height(6.dp))
            Text(
                "Win-rate distribution across every agent on the platform. Drag the threshold to filter out tiny-sample agents, or tap a bar to see who's in it.",
                color = AppColors.appTextSecondary, fontSize = 13.sp,
            )
        }

        // Summary cards
        SummaryCards(metric, values, fit)

        // Control bar
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                StatMetric.entries.forEach { m ->
                    Pill(m.label, active = metric == m) { onMetric(m) }
                    Spacer(Modifier.width(8.dp))
                }
                Spacer(Modifier.weight(1f))
                GranularityMenu(granularity, onGranularity)
            }
            if (metric == StatMetric.WIN_RATE) {
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StatsSportOption.entries.forEach { opt ->
                        Pill(opt.label, active = sport == opt) { onSport(opt) }
                    }
                }
            }
        }

        // Threshold
        StatCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Minimum settled picks", color = AppColors.appTextPrimary, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.weight(1f))
                Text("≥ $n", color = AppColors.appPrimary, fontSize = 13.sp, fontWeight = FontWeight.Black)
            }
            Slider(
                value = minDecided, onValueChange = onThreshold, valueRange = 0f..100f, steps = 99,
                colors = SliderDefaults.colors(thumbColor = AppColors.appPrimary, activeTrackColor = AppColors.appPrimary, inactiveTrackColor = AppColors.appBorder),
            )
            Text(
                "Raising this filters out tiny-sample agents — the 0% / 100% spikes collapse and the curve tightens toward true skill.",
                color = AppColors.appTextSecondary, fontSize = 11.sp,
            )
        }

        // Hero
        StatCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(heroTitle(metric, sport), color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.weight(1f))
                fit?.let {
                    Text(
                        if (metric == StatMetric.WIN_RATE) "μ ${pct(it.mean)} · σ ${pct(it.sd)}" else "μ ${units(it.mean)} · σ ${sdUnits(it.sd)}",
                        color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            if (values.size < 2) {
                LowDataPlaceholder(220.dp)
            } else {
                DistributionHistogramChart(
                    buckets = buckets, curve = curve, fit = fit, domain = domain, metric = metric,
                    accent = AppColors.appAccentBlue, height = 220.dp,
                    onSelectBin = { bucket ->
                        onDrill(DrillContext(binTitle(metric, bucket), metric, if (metric == StatMetric.WIN_RATE) sport.agentSport else null, bucket.lower, bucket.upper))
                    },
                )
                Spacer(Modifier.height(4.dp))
                Text("Tap a bar to see the top agents in it", color = AppColors.appTextSecondary, fontSize = 11.sp)
            }
        }

        // Per-sport small multiples
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("By Sport", color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Text("Win rate only — net units isn't tracked per sport.", color = AppColors.appTextSecondary, fontSize = 11.sp)
            realSports.forEach { spec -> SportCard(store, spec, n, onDrill) }
            NflEstimateCard(store, n)
        }

        // Overlay
        StatCard {
            Text("Sports Compared", color = AppColors.appTextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(8.dp))
            val series = buildOverlaySeries(store, n)
            if (series.size > 1) {
                FittedCurveOverlayChart(series = series, domain = SPORT_DOMAIN, height = 220.dp)
            } else {
                LowDataPlaceholder(120.dp)
            }
        }

        // Freshness
        store.lastCalculatedAt?.let {
            Text("Updated ${relativeLabel(it)}", color = AppColors.appTextMuted, fontSize = 11.sp, modifier = Modifier.fillMaxWidth().padding(top = 4.dp))
        }
    }
}

@Composable
private fun SummaryCards(metric: StatMetric, values: List<Double>, fit: NormalFit?) {
    val cards = summaryMetrics(metric, values, fit)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatValueCard(cards[0], Modifier.weight(1f)); StatValueCard(cards[1], Modifier.weight(1f))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatValueCard(cards[2], Modifier.weight(1f)); StatValueCard(cards[3], Modifier.weight(1f))
        }
    }
}

private data class StatCardData(val label: String, val value: String, val color: Color)

private fun summaryMetrics(metric: StatMetric, values: List<Double>, fit: NormalFit?): List<StatCardData> {
    if (fit == null || values.isEmpty()) return List(4) { StatCardData("—", "—", AppColors.appTextPrimary) }
    val median = medianOf(values)
    return if (metric == StatMetric.WIN_RATE) {
        val aboveBE = values.count { it >= BREAK_EVEN }.toDouble() / values.size
        listOf(
            StatCardData("Mean Win %", pct(fit.mean), AppColors.appTextPrimary),
            StatCardData("Std Dev", pct(fit.sd), AppColors.appTextPrimary),
            StatCardData("Above 52.4%", pct(aboveBE), if (aboveBE >= 0.5) AppColors.appWin else AppColors.appTextPrimary),
            StatCardData("Median", pct(median), AppColors.appTextPrimary),
        )
    } else {
        val profitable = values.count { it > 0 }.toDouble() / values.size
        listOf(
            StatCardData("Avg Units", units(fit.mean), if (fit.mean >= 0) AppColors.appWin else AppColors.appLoss),
            StatCardData("Std Dev", sdUnits(fit.sd), AppColors.appTextPrimary),
            StatCardData("Profitable", pct(profitable), if (profitable >= 0.5) AppColors.appWin else AppColors.appTextPrimary),
            StatCardData("Median", units(median), if (median >= 0) AppColors.appWin else AppColors.appLoss),
        )
    }
}

@Composable
private fun StatValueCard(data: StatCardData, modifier: Modifier = Modifier) {
    Column(
        modifier.background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp)).padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(data.label.uppercase(), color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(4.dp))
        Text(data.value, color = data.color, fontSize = 24.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun SportCard(store: PlatformStatsStore, spec: SportSpec, n: Int, onDrill: (DrillContext) -> Unit) {
    val values = store.data.mapNotNull { d -> if (d.decided(spec.key) >= n) d.winRate(spec.key) else null }
    val fit = DistributionStatistics.fit(values)
    StatCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(spec.label, color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.weight(1f))
            if (fit != null && values.size >= SPORT_FLOOR) {
                Text("μ ${pct(fit.mean)} · σ ${pct(fit.sd)}", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        Spacer(Modifier.height(8.dp))
        if (fit != null && values.size >= SPORT_FLOOR) {
            val buckets = DistributionStatistics.histogram(values, SPORT_DOMAIN, SPORT_BIN_WIDTH)
            val curve = DistributionStatistics.curvePoints(fit, SPORT_DOMAIN, SPORT_BIN_WIDTH)
            DistributionHistogramChart(
                buckets = buckets, curve = curve, fit = fit, domain = SPORT_DOMAIN, metric = StatMetric.WIN_RATE,
                accent = spec.color, height = 150.dp,
                onSelectBin = { bucket -> onDrill(DrillContext("${spec.label} · ${binTitle(StatMetric.WIN_RATE, bucket)}", StatMetric.WIN_RATE, agentSportForKey(spec.key), bucket.lower, bucket.upper)) },
            )
        } else {
            LowDataPlaceholder(100.dp)
        }
    }
}

@Composable
private fun NflEstimateCard(store: PlatformStatsStore, n: Int) {
    val fit = estimatedNflFit(store, n)
    val curve = DistributionStatistics.curvePoints(fit, SPORT_DOMAIN, SPORT_BIN_WIDTH)
    StatCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("NFL", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.width(8.dp))
            Text("EST.", color = nflPurple, fontSize = 9.sp, fontWeight = FontWeight.Black, modifier = Modifier.background(nflPurple.copy(alpha = 0.18f), RoundedCornerShape(50)).padding(horizontal = 7.dp, vertical = 3.dp))
            Spacer(Modifier.weight(1f))
            Text("μ ${pct(fit.mean)} · projected", color = AppColors.appTextSecondary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(8.dp))
        DistributionHistogramChart(
            buckets = emptyList(), curve = curve, fit = fit, domain = SPORT_DOMAIN, metric = StatMetric.WIN_RATE,
            accent = nflPurple, height = 150.dp, showReferenceLines = true,
        )
        Spacer(Modifier.height(4.dp))
        Text("NFL picks aren't graded yet — this is a projection (strongest sport + 5 pts), not observed data.", color = AppColors.appTextSecondary, fontSize = 11.sp)
    }
}

@Composable
private fun Pill(title: String, active: Boolean, onClick: () -> Unit) {
    Text(
        title,
        color = if (active) AppColors.appPrimary else AppColors.appTextSecondary,
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .background(if (active) AppColors.appPrimary.copy(alpha = 0.18f) else Color.Transparent, RoundedCornerShape(50))
            .border(1.dp, if (active) AppColors.appPrimary else AppColors.appBorder.copy(alpha = 0.5f), RoundedCornerShape(50))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

@Composable
private fun GranularityMenu(current: BinGranularity, onSelect: (BinGranularity) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.clickable { open = true }.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(agentSymbol("slider.horizontal.3"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(12.dp))
            Spacer(Modifier.width(5.dp))
            Text("Bins: ${current.label}", color = AppColors.appTextSecondary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
        androidx.compose.material3.DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            BinGranularity.entries.forEach { g ->
                androidx.compose.material3.DropdownMenuItem(
                    text = { Text(g.label) },
                    trailingIcon = { if (g == current) Icon(agentSymbol("checkmark"), contentDescription = null, modifier = Modifier.size(16.dp)) },
                    onClick = { onSelect(g); open = false },
                )
            }
        }
    }
}

@Composable
private fun StatCard(content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().background(AppColors.appSurfaceElevated, RoundedCornerShape(16.dp)).padding(16.dp), content = content)
}

@Composable
private fun LowDataPlaceholder(height: Dp) {
    Column(Modifier.fillMaxWidth().heightIn(min = height), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(agentSymbol("chart.bar.xaxis"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(26.dp))
        Spacer(Modifier.height(8.dp))
        Text("Not enough data at this threshold", color = AppColors.appTextSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun ErrorView(message: String, onRetry: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Icon(agentSymbol("chart.bar.xaxis"), contentDescription = null, tint = AppColors.appTextSecondary, modifier = Modifier.size(32.dp))
        Spacer(Modifier.height(8.dp))
        Text("Couldn't load stats", color = AppColors.appTextPrimary, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(message, color = AppColors.appTextSecondary, fontSize = 13.sp)
        Spacer(Modifier.height(8.dp))
        Box(
            Modifier.clip(CircleShape).background(AppColors.appPrimary).clickable(onClick = onRetry).padding(horizontal = 20.dp, vertical = 10.dp),
        ) { Text("Retry", color = Color.White, fontWeight = FontWeight.SemiBold) }
    }
}

// --- computation ------------------------------------------------------------

private fun heroValues(store: PlatformStatsStore, metric: StatMetric, sport: StatsSportOption, n: Int): List<Double> =
    when (metric) {
        StatMetric.NET_UNITS -> store.data.filter { it.decided >= n }.map { it.netUnits }
        StatMetric.WIN_RATE -> {
            val key = sport.key
            if (key != null) store.data.mapNotNull { d -> if (d.decided(key) >= n) d.winRate(key) else null }
            else store.data.filter { it.decided >= n }.mapNotNull { it.winRate }
        }
    }

private fun heroDomain(metric: StatMetric, values: List<Double>): ClosedFloatingPointRange<Double> {
    if (metric == StatMetric.WIN_RATE) return 0.0..1.0
    val mn = values.minOrNull() ?: return -10.0..10.0
    val mx = values.maxOrNull() ?: return -10.0..10.0
    val lo = maxOf(-25.0, floor(mn / 5) * 5)
    val hi = minOf(25.0, ceil(mx / 5) * 5)
    return if (lo < hi) lo..hi else (lo - 5)..(hi + 5)
}

private fun buildOverlaySeries(store: PlatformStatsStore, n: Int): List<FittedCurveSeries> {
    val series = mutableListOf<FittedCurveSeries>()
    for (spec in realSports) {
        val values = store.data.mapNotNull { d -> if (d.decided(spec.key) >= n) d.winRate(spec.key) else null }
        val fit = DistributionStatistics.fit(values)
        if (fit != null && values.size >= SPORT_FLOOR) {
            series.add(FittedCurveSeries(spec.label, spec.color, false, DistributionStatistics.normalizedCurvePoints(fit, SPORT_DOMAIN)))
        }
    }
    val nfl = estimatedNflFit(store, n)
    series.add(FittedCurveSeries("NFL (Est.)", nflPurple, true, DistributionStatistics.normalizedCurvePoints(nfl, SPORT_DOMAIN)))
    return series
}

private fun estimatedNflFit(store: PlatformStatsStore, n: Int): NormalFit {
    val means = mutableListOf<Double>()
    val sds = mutableListOf<Double>()
    for (spec in realSports) {
        val values = store.data.mapNotNull { d -> if (d.decided(spec.key) >= n) d.winRate(spec.key) else null }
        val fit = DistributionStatistics.fit(values)
        if (fit != null && values.size >= SPORT_FLOOR) { means.add(fit.mean); sds.add(fit.sd) }
    }
    val baseMean = means.maxOrNull() ?: 0.555
    val sd = if (sds.isEmpty()) 0.07 else sds.sum() / sds.size
    return NormalFit(mean = minOf(0.9, baseMean + 0.05), sd = sd, count = 0, isEstimated = true)
}

private fun agentSportForKey(key: String): AgentSport? = AgentSport.entries.firstOrNull { it.raw == key }

private fun heroTitle(metric: StatMetric, sport: StatsSportOption): String = when {
    metric == StatMetric.NET_UNITS -> "Net Units · All Sports"
    sport == StatsSportOption.All -> "Win Rate · All Sports"
    else -> "Win Rate · ${sport.label}"
}

private fun binTitle(metric: StatMetric, bucket: DistributionBucket): String =
    if (metric == StatMetric.WIN_RATE) "${(bucket.lower * 100).toInt()}–${(bucket.upper * 100).toInt()}% Win Rate"
    else "${signed(bucket.lower)} to ${signed(bucket.upper)}u"

private fun pct(v: Double): String = "${"%.1f".format(v * 100)}%"
private fun units(v: Double): String = "${if (v >= 0) "+" else ""}${"%.2f".format(v)}u"
private fun sdUnits(v: Double): String = "${"%.1f".format(v)}u"
private fun signed(v: Double): String = "%+.0f".format(v)
private fun medianOf(values: List<Double>): Double {
    if (values.isEmpty()) return 0.0
    val sorted = values.sorted()
    val mid = sorted.size / 2
    return if (sorted.size % 2 == 0) (sorted[mid - 1] + sorted[mid]) / 2 else sorted[mid]
}

private fun relativeLabel(instant: java.time.Instant): String {
    val secs = java.time.Duration.between(instant, java.time.Instant.now()).seconds
    return when {
        secs < 60 -> "just now"
        secs < 3600 -> "${secs / 60} min ago"
        secs < 86400 -> "${secs / 3600} hr ago"
        else -> "${secs / 86400} days ago"
    }
}

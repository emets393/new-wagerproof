package com.wagerproof.app.features.cfb

import androidx.compose.ui.graphics.Color
import com.wagerproof.app.features.gamecards.GameCardFormatting
import com.wagerproof.core.design.tokens.AppColors
import com.wagerproof.core.models.CFBDryRunFlag
import com.wagerproof.core.models.CFBFlagConviction
import com.wagerproof.core.models.CFBPrediction
import com.wagerproof.core.models.CFBSignalDefinition
import com.wagerproof.core.models.CFBTeamAssets
import com.wagerproof.core.models.SignalPerformance
import com.wagerproof.core.services.CFBSignalDefinitionsService
import com.wagerproof.core.services.SupabaseClients
import io.github.jan.supabase.postgrest.from
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt

// ============================================================================
// Bet-board model
// ============================================================================

/** One of the seven CFB market rows. Strings are pre-formatted for display. */
data class CFBMarketRow(
    val id: String,
    val sectionTitle: String,
    val iconName: String,
    val tint: Color,
    val vegasLabel: String,
    val vegas: String,
    val modelLabel: String,
    val model: String,
    /** Direction/side token — drives coloring + support/contradict matching. */
    val pick: String,
    val pickTeamName: String?,
    val pickTitle: String,
    val pickSubtitle: String,
    val isNoPlay: Boolean,
    val isDisplayOnly: Boolean,
    val showComparison: Boolean,
)

fun buildMarketRows(game: CFBPrediction): List<CFBMarketRow> = listOf(
    spreadRow(game),
    totalRow(game),
    teamTotalRow(game, home = true),
    teamTotalRow(game, home = false),
    h1SpreadRow(game),
    h1TotalRow(game),
    moneylineRow(game),
)

private fun spreadRow(game: CFBPrediction): CFBMarketRow {
    val capped = game.fgSpreadCapped == true
    val pickSide = game.fgSpreadPick
    return CFBMarketRow(
        id = "spread",
        sectionTitle = "Spread Prediction",
        iconName = "target",
        tint = AppColors.appPrimary,
        vegasLabel = if (pickSide.isNullOrEmpty()) "Vegas line" else "Vegas ${teamAbbrForSide(game, pickSide)}",
        vegas = if (pickSide.isNullOrEmpty()) GameCardFormatting.formatSpread(game.fgSpreadClose) else spreadLineForSide(game, pickSide, model = false),
        modelLabel = "Model line",
        model = if (pickSide.isNullOrEmpty()) GameCardFormatting.formatSpread(game.fgPredSpread) else spreadLineForSide(game, pickSide, model = true),
        pick = if (capped) "No Play" else spreadPickText(game),
        pickTeamName = teamName(game, pickSide),
        pickTitle = spreadPickTitle(game),
        pickSubtitle = spreadPickSubtitle(game),
        isNoPlay = capped,
        isDisplayOnly = false,
        showComparison = true,
    )
}

private fun totalRow(game: CFBPrediction): CFBMarketRow {
    val dir = pickDirection(game.fgTotalPick)
    return CFBMarketRow(
        id = "total",
        sectionTitle = "Over/Under Prediction",
        iconName = if (dir == "UNDER") "arrow.down.circle.fill" else "arrow.up.circle.fill",
        tint = totalTint(game.fgTotalPick),
        vegasLabel = "Vegas total",
        vegas = num(game.fgTotalClose),
        modelLabel = "Model total",
        model = num(game.fgPredTotal),
        pick = pickText(game.fgTotalPick),
        pickTeamName = null,
        pickTitle = dir?.let { "$it ${num(game.fgTotalClose)}" } ?: "No total play",
        pickSubtitle = "Projected total: ${num(game.fgPredTotal)} points.",
        isNoPlay = false,
        isDisplayOnly = false,
        showComparison = true,
    )
}

private fun teamTotalRow(game: CFBPrediction, home: Boolean): CFBMarketRow {
    val team = if (home) game.homeTeam else game.awayTeam
    val pick = if (home) game.ttHomePick else game.ttAwayPick
    val pred = if (home) game.ttHomePred else game.ttAwayPred
    val close = if (home) game.ttHomeClose else game.ttAwayClose
    val over = if (home) game.ttHomeBestOver else game.ttAwayBestOver
    val under = if (home) game.ttHomeBestUnder else game.ttAwayBestUnder
    val line = bestTeamTotalLine(pick, close, over, under)
    val dir = pickDirection(pick)
    return CFBMarketRow(
        id = if (home) "tt-home" else "tt-away",
        sectionTitle = "${CFBTeamAssets.abbr(team)} Team Total",
        iconName = "sum",
        tint = totalTint(pick),
        vegasLabel = "Best Vegas TT",
        vegas = num(line),
        modelLabel = "Predicted pts",
        model = num(pred),
        pick = pickOrNoBet(pick),
        pickTeamName = team,
        pickTitle = dir?.let { "$team $it ${num(line)}" } ?: "$team team total",
        pickSubtitle = "$team predicted team total: ${num(pred)} pts · Difference vs best line: ${derivativeEdge(pred, line)}.",
        isNoPlay = false,
        isDisplayOnly = false,
        showComparison = true,
    )
}

private fun h1SpreadRow(game: CFBPrediction): CFBMarketRow {
    val pickSide = game.h1SpreadPick
    return CFBMarketRow(
        id = "h1-spread",
        sectionTitle = "1H Spread Prediction",
        iconName = "clock.badge",
        tint = AppColors.appPrimary,
        vegasLabel = if (pickSide.isNullOrEmpty()) "Vegas 1H" else "Vegas ${teamAbbrForSide(game, pickSide)}",
        vegas = h1SpreadVegasLine(game),
        modelLabel = "Model margin",
        model = signedNum(game.h1PredMargin),
        pick = pickText(pickSide),
        pickTeamName = teamName(game, pickSide),
        pickTitle = teamName(game, pickSide)?.let { "$it ${h1SpreadVegasLine(game)}" } ?: "No 1H spread play",
        pickSubtitle = teamName(game, pickSide)?.let { "$it is the first-half side." } ?: "Model 1H margin: ${signedNum(game.h1PredMargin)}.",
        isNoPlay = false,
        isDisplayOnly = false,
        showComparison = true,
    )
}

private fun h1TotalRow(game: CFBPrediction): CFBMarketRow {
    val dir = pickDirection(game.h1TotalPick)
    return CFBMarketRow(
        id = "h1-total",
        sectionTitle = "1H Total Prediction",
        iconName = if (dir == "UNDER") "arrow.down.circle.fill" else "arrow.up.circle.fill",
        tint = totalTint(game.h1TotalPick),
        vegasLabel = "Vegas 1H",
        vegas = num(game.h1TotalClose),
        modelLabel = "Model 1H",
        model = num(game.h1PredTotal),
        pick = pickText(game.h1TotalPick),
        pickTeamName = null,
        pickTitle = dir?.let { "$it ${num(game.h1TotalClose)}" } ?: "No 1H total play",
        pickSubtitle = "Projected first-half total: ${num(game.h1PredTotal)} points.",
        isNoPlay = false,
        isDisplayOnly = false,
        showComparison = true,
    )
}

private fun moneylineRow(game: CFBPrediction): CFBMarketRow {
    val score = game.predictedScore
    val winner = when {
        score == null -> null
        score.home > score.away -> game.homeTeam
        score.away > score.home -> game.awayTeam
        else -> null
    }
    return CFBMarketRow(
        id = "moneyline",
        sectionTitle = "Moneyline Prediction",
        iconName = "dollarsign.circle.fill",
        tint = AppColors.appTextSecondary,
        vegasLabel = "Vegas ML",
        vegas = "${CFBTeamAssets.abbr(game.awayTeam)} ${GameCardFormatting.formatMoneyline(game.awayMl)} / ${CFBTeamAssets.abbr(game.homeTeam)} ${GameCardFormatting.formatMoneyline(game.homeMl)}",
        modelLabel = "Projected winner",
        model = moneylineLean(game),
        pick = "ML",
        pickTeamName = winner,
        pickTitle = winner?.let { "$it projected winner" } ?: "Moneyline context",
        pickSubtitle = "Best available moneyline for the projected winner.",
        isNoPlay = false,
        isDisplayOnly = true,
        showComparison = false,
    )
}

// ============================================================================
// Signals
// ============================================================================

data class SignalBuckets(
    val supporting: List<CFBDryRunFlag>,
    val contradicting: List<CFBDryRunFlag>,
) {
    val isEmpty: Boolean get() = supporting.isEmpty() && contradicting.isEmpty()
}

fun signalBuckets(
    game: CFBPrediction,
    row: CFBMarketRow,
    defs: Map<String, CFBSignalDefinition>,
): SignalBuckets {
    val signals = relevantGameFlags(game, row).map { flag ->
        if (flag.signalDefinition != null) flag
        else flag.withSignalDefinition(CFBSignalDefinitionsService.definition(flag.source, defs))
    }
    return SignalBuckets(
        supporting = signals.filter { signalSupportsPick(it, row, game) },
        contradicting = signals.filterNot { signalSupportsPick(it, row, game) },
    )
}

private fun relevantGameFlags(game: CFBPrediction, row: CFBMarketRow): List<CFBDryRunFlag> {
    val market = marketKey(row.id)
    return game.activeFlags
        .filter { it.market.lowercase(Locale.US) == market }
        .filter { flag ->
            if (row.id != "tt-home" && row.id != "tt-away") return@filter true
            val team = if (row.id == "tt-home") game.homeTeam else game.awayTeam
            val abbr = CFBTeamAssets.abbr(team)
            val hay = "${flag.side} ${flag.source} ${flag.signalDefinition?.displayName ?: ""}".uppercase(Locale.US)
            hay.contains(team.uppercase(Locale.US)) || hay.contains(abbr.uppercase(Locale.US)) ||
                hay.contains(if (row.id == "tt-home") "HOME" else "AWAY")
        }
        .sortedWith(
            compareBy<CFBDryRunFlag> { it.convictionTier.sortRank }
                .thenByDescending { it.stakeUnits ?: 0.0 },
        )
}

private fun marketKey(rowId: String): String = when (rowId) {
    "tt-home", "tt-away" -> "team_total"
    "h1-spread" -> "h1_spread"
    "h1-total" -> "h1_total"
    "moneyline" -> "moneyline"
    else -> rowId
}

private fun signalSupportsPick(flag: CFBDryRunFlag, row: CFBMarketRow, game: CFBPrediction): Boolean {
    val pick = row.pick.uppercase(Locale.US)
    if (pick == "OVER" || pick == "UNDER") {
        normalizedOverUnder(flag.side)?.let { return it == pick }
        val hay = "${flag.side} ${flag.source} ${flag.signalDefinition?.displayName ?: ""}".uppercase(Locale.US)
        return hay.contains(pick)
    }
    val pickSide = pickSide(game, row)
    val flagSide = normalizedHomeAway(flag.side)
    if (pickSide != null && flagSide != null) return flagSide == pickSide

    if (row.id == "tt-home" || row.id == "tt-away") {
        val expected = if (row.id == "tt-home") "HOME" else "AWAY"
        normalizedHomeAway(flag.side)?.let { if (it != expected) return false }
        if (pick.contains("OVER") || pick.contains("UNDER")) {
            normalizedOverUnder(flag.side)?.let { return it == (if (pick.contains("OVER")) "OVER" else "UNDER") }
        }
        row.pickTeamName?.let { team ->
            val hay = "${flag.side} ${flag.source}".uppercase(Locale.US)
            return hay.contains(team.uppercase(Locale.US)) || hay.contains(CFBTeamAssets.abbr(team).uppercase(Locale.US))
        }
    }
    return true
}

private fun pickSide(game: CFBPrediction, row: CFBMarketRow): String? {
    if (row.pick == "HOME" || row.pick == "AWAY") return row.pick
    row.pickTeamName?.let {
        if (it == game.homeTeam) return "HOME"
        if (it == game.awayTeam) return "AWAY"
    }
    teamSideMentioned(game, row.pick)?.let { return it }
    return teamSideMentioned(game, row.pickTitle)
}

private fun teamSideMentioned(game: CFBPrediction, value: String): String? {
    val upper = value.uppercase(Locale.US)
    if (upper.contains(game.homeTeam.uppercase(Locale.US)) || upper.contains(CFBTeamAssets.abbr(game.homeTeam).uppercase(Locale.US))) return "HOME"
    if (upper.contains(game.awayTeam.uppercase(Locale.US)) || upper.contains(CFBTeamAssets.abbr(game.awayTeam).uppercase(Locale.US))) return "AWAY"
    return null
}

private fun normalizedHomeAway(value: String): String? {
    val u = value.uppercase(Locale.US)
    return when { u.contains("HOME") -> "HOME"; u.contains("AWAY") -> "AWAY"; else -> null }
}

private fun normalizedOverUnder(value: String): String? {
    val u = value.uppercase(Locale.US)
    return when { u.contains("UNDER") -> "UNDER"; u.contains("OVER") -> "OVER"; else -> null }
}

fun signalPerformanceFor(
    flag: CFBDryRunFlag,
    defs: Map<String, CFBSignalDefinition>,
    perfByKey: Map<String, SignalPerformance>,
): SignalPerformance? {
    val def = flag.signalDefinition ?: CFBSignalDefinitionsService.definition(flag.source, defs)
    def?.signalKey?.let { perfByKey[it]?.let { row -> return row } }
    def?.sourceKey?.let { perfByKey[it]?.let { row -> return row } }
    return perfByKey[flag.source]
}

fun tierColor(tier: CFBFlagConviction): Color = when (tier) {
    CFBFlagConviction.MAMMOTH -> Color(0xFFF97316)
    CFBFlagConviction.T1 -> Color(0xFFFACC15)
    CFBFlagConviction.T2 -> Color(0xFF94A3B8)
    CFBFlagConviction.T3 -> Color(0xFFCD7F32)
    CFBFlagConviction.TRACK -> AppColors.appTextSecondary
}

fun marketLabel(raw: String): String = when (raw.lowercase(Locale.US)) {
    "spread" -> "Spread"
    "total" -> "Total"
    "team_total" -> "Team Total"
    "h1_spread" -> "1H Spread"
    "h1_total" -> "1H Total"
    "h1_ml" -> "1H ML"
    else -> raw.replace("_", " ").replaceFirstChar { it.uppercase() }
}

// ============================================================================
// Team trends
// ============================================================================

data class TrendMetric(val label: String, val value: String, val chips: List<String>, val tint: Color)

fun trendMetric(rowId: String, trend: CFBTeamTrendRow?): TrendMetric {
    if (trend == null) return TrendMetric(trendMetricLabel(rowId), "—", emptyList(), AppColors.appTextMuted)
    return when (rowId) {
        "spread" -> TrendMetric("ATS", recordPct(trend.atsW, trend.atsL, trend.atsP, trend.atsPct), trend.last5Ats, trendTint(trend.atsPct))
        "total" -> TrendMetric("O/U", ouPct(trend.ouO, trend.ouU, trend.ouP, trend.overPct), trend.last5Ou, trendTint(trend.overPct))
        "tt-home", "tt-away" -> TrendMetric("TT Over", "${trend.ttO}-${trend.ttU} ${pctText(trend.ttOverPct)}", trend.last5Logs.mapNotNull { it.tt }, trendTint(trend.ttOverPct))
        "h1-spread" -> TrendMetric("1H ATS", recordPct(trend.h1AtsW, trend.h1AtsL, trend.h1AtsP, trend.h1AtsPct), trend.last5Logs.mapNotNull { it.h1Ats }, trendTint(trend.h1AtsPct))
        "h1-total" -> TrendMetric("1H O/U", "${trend.h1OuO}-${trend.h1OuU} ${pctText(trend.h1OverPct)}", trend.last5Logs.mapNotNull { it.h1Ou }, trendTint(trend.h1OverPct))
        else -> TrendMetric("SU", trend.suRecord, trend.last5Su, AppColors.appTextPrimary)
    }
}

private fun trendMetricLabel(rowId: String): String = when (rowId) {
    "spread" -> "ATS"; "total" -> "O/U"; "tt-home", "tt-away" -> "TT Over"
    "h1-spread" -> "1H ATS"; "h1-total" -> "1H O/U"; else -> "SU"
}

private fun recordPct(w: Int, l: Int, p: Int, pct: Double?): String {
    val record = if (p > 0) "$w-$l-$p" else "$w-$l"
    return "$record ${pctText(pct)}"
}

private fun ouPct(o: Int, u: Int, p: Int, pct: Double?): String {
    val record = if (p > 0) "$o-$u-$p" else "$o-$u"
    return "$record ${pctText(pct)}"
}

private fun pctText(pct: Double?): String = pct?.let { "${it.roundToInt()}%" } ?: "—"

private fun trendTint(pct: Double?): Color = when {
    pct == null -> AppColors.appTextSecondary
    pct >= 55 -> Color(0xFF22C55E)
    pct <= 45 -> Color(0xFFEF4444)
    else -> AppColors.appTextSecondary
}

fun trendChipColor(value: String): Color = when (value.uppercase(Locale.US)) {
    "W", "O" -> Color(0xFF22C55E)
    "L", "U" -> Color(0xFFEF4444)
    else -> AppColors.appTextMuted
}

fun marginColor(value: Double?): Color = when {
    value == null -> AppColors.appTextMuted
    value > 0 -> Color(0xFF22C55E)
    value < 0 -> Color(0xFFEF4444)
    else -> AppColors.appTextMuted
}

// ============================================================================
// Trend detail
// ============================================================================

data class TrendDetailSelection(val team: String, val rowId: String, val trend: CFBTeamTrendRow) {
    val id: String get() = "$team-$rowId"
}

data class TrendDetailGameRow(
    val date: String,
    val opponent: String,
    val locationMarker: String,
    val line: String,
    val result: String,
    val margin: Double? = null,
    val extra: String? = null,
) {
    val id: String get() = "$date-$opponent-$line"
}

fun trendDetailTitle(rowId: String): String = when (rowId) {
    "spread" -> "ATS this season"
    "total" -> "O/U this season"
    "tt-home", "tt-away" -> "Team Total this season"
    "h1-spread" -> "1H ATS this season"
    "h1-total" -> "1H O/U this season"
    else -> "Moneyline this season"
}

fun trendDetailRows(sel: TrendDetailSelection): List<TrendDetailGameRow> = sel.trend.gameLog.mapNotNull { log ->
    val opp = log.opp ?: return@mapNotNull null
    val date = trendDateText(log.date, log.week)
    val marker = trendLocationMarker(log)
    when (sel.rowId) {
        "spread" -> {
            val spread = log.spread ?: return@mapNotNull null
            val result = log.ats ?: return@mapNotNull null
            TrendDetailGameRow(date, opp, marker, GameCardFormatting.formatSpread(spread), result, log.coverMargin)
        }
        "total" -> {
            val total = log.total ?: return@mapNotNull null
            val result = log.ou ?: return@mapNotNull null
            TrendDetailGameRow(date, opp, marker, num(total), result, log.ouMargin, log.totalPoints?.toString())
        }
        "tt-home", "tt-away" -> {
            val line = log.ttLine ?: return@mapNotNull null
            val result = log.tt ?: return@mapNotNull null
            TrendDetailGameRow(date, opp, marker, num(line), result, log.ttMargin, log.teamPts?.toString())
        }
        "h1-spread" -> {
            val spread = log.h1Spread ?: return@mapNotNull null
            val result = log.h1Ats ?: return@mapNotNull null
            TrendDetailGameRow(date, opp, marker, GameCardFormatting.formatSpread(spread), result, log.h1CoverMargin)
        }
        "h1-total" -> {
            val total = log.h1Total ?: return@mapNotNull null
            val result = log.h1Ou ?: return@mapNotNull null
            TrendDetailGameRow(date, opp, marker, num(total), result, log.h1OuMargin)
        }
        else -> {
            val result = log.su ?: return@mapNotNull null
            val score = "${log.ptsFor?.toString() ?: "—"}-${log.ptsAgainst?.toString() ?: "—"}"
            TrendDetailGameRow(date, opp, marker, score, result)
        }
    }
}

private fun trendLocationMarker(log: CFBTeamTrendGameLog): String = when {
    log.neutralSite == true -> "(n)"
    log.isHome == false -> "@"
    else -> ""
}

private fun trendDateText(raw: String?, week: Int?): String {
    if (!raw.isNullOrEmpty()) {
        val n = raw.take(10)
        if (n.length == 10) return "${n.substring(5, 7)}/${n.substring(8)}"
        return raw
    }
    return week?.let { "W$it" } ?: "—"
}

// ============================================================================
// Data loading
// ============================================================================

/** `cfb_team_trends` for both teams, season 2025 hardcoded (see doc §4.6). */
suspend fun loadTeamTrends(game: CFBPrediction): Map<String, CFBTeamTrendRow> = runCatching {
    SupabaseClients.cfb
        .from("cfb_team_trends")
        .select {
            filter {
                eq("season", 2025)
                isIn("team_name", listOf(game.awayTeam, game.homeTeam))
            }
        }
        .decodeList<CFBTeamTrendRow>()
        .associateBy { it.teamName }
}.getOrDefault(emptyMap())

// ============================================================================
// Formatting helpers
// ============================================================================

fun num(value: Double?): String = value?.let { String.format(Locale.US, "%.1f", it) } ?: "—"
fun fmt1(value: Double): String = String.format(Locale.US, "%.1f", value)
fun signedNum(value: Double?): String = value?.let { if (it >= 0) "+${num(it)}" else num(it) } ?: "—"
fun signed(value: Double): String = if (value >= 0) "+${num(value)}" else num(value)

fun fmtHalf(value: Double?): String {
    val rounded = GameCardFormatting.roundToNearestHalf(value) ?: return "—"
    return if (floor(rounded) == rounded) rounded.toInt().toString() else String.format(Locale.US, "%.1f", rounded)
}

fun pickDirection(raw: String?): String? {
    val u = (raw ?: "").uppercase(Locale.US)
    return when { u.contains("UNDER") -> "UNDER"; u.contains("OVER") -> "OVER"; else -> null }
}

private fun pickText(pick: String?): String {
    if (pick.isNullOrEmpty()) return "—"
    return pickDirection(pick) ?: pick.uppercase(Locale.US)
}

private fun pickOrNoBet(pick: String?): String {
    if (pick.isNullOrEmpty()) return "No bet"
    return pickDirection(pick) ?: pick.uppercase(Locale.US)
}

fun directionTint(direction: String?, fallback: Color): Color = when (direction) {
    "UNDER" -> AppColors.appAccentRed
    "OVER" -> AppColors.appPrimary
    else -> fallback
}

private fun totalTint(pick: String?): Color =
    if ((pick ?: "").uppercase(Locale.US).contains("UNDER")) AppColors.appAccentRed else AppColors.appPrimary

private fun derivativeEdge(pred: Double?, line: Double?): String {
    if (pred == null || line == null) return "—"
    return signed(pred - line)
}

private fun teamName(game: CFBPrediction, side: String?): String? {
    val u = (side ?: "").uppercase(Locale.US)
    return when { u.contains("HOME") -> game.homeTeam; u.contains("AWAY") -> game.awayTeam; else -> null }
}

private fun teamAbbrForSide(game: CFBPrediction, side: String): String =
    if (side.uppercase(Locale.US) == "HOME") CFBTeamAssets.abbr(game.homeTeam) else CFBTeamAssets.abbr(game.awayTeam)

private fun spreadLineForSide(game: CFBPrediction, side: String, model: Boolean): String {
    val v = (if (model) game.fgPredSpread else game.fgSpreadClose) ?: return "—"
    return GameCardFormatting.formatSpread(if (side.uppercase(Locale.US) == "HOME") v else -v)
}

private fun spreadPickText(game: CFBPrediction): String {
    val pick = game.fgSpreadPick
    if (pick.isNullOrEmpty()) return "—"
    return "${teamAbbrForSide(game, pick)} ${spreadLineForSide(game, pick, model = false)}"
}

private fun spreadPickTitle(game: CFBPrediction): String {
    val side = game.fgSpreadPick
    if (game.fgSpreadCapped == true || side.isNullOrEmpty()) return "No spread play"
    val team = teamName(game, side) ?: return "No spread play"
    return "$team ${spreadLineForSide(game, side, model = false)}"
}

private fun spreadPickSubtitle(game: CFBPrediction): String {
    val side = game.fgSpreadPick
    if (game.fgSpreadCapped == true || side.isNullOrEmpty()) return "Model is off-market here, so this is not a bet."
    val team = teamName(game, side) ?: return "Model is off-market here, so this is not a bet."
    return "$team is the side we think covers."
}

private fun h1SpreadVegasLine(game: CFBPrediction): String {
    val pick = game.h1SpreadPick
    val close = game.h1SpreadClose ?: return GameCardFormatting.formatSpread(game.h1SpreadClose)
    if (pick.isNullOrEmpty()) return GameCardFormatting.formatSpread(game.h1SpreadClose)
    return GameCardFormatting.formatSpread(if (pick.uppercase(Locale.US) == "HOME") close else -close)
}

private fun bestTeamTotalLine(pick: String?, close: Double?, over: Double?, under: Double?): Double? =
    when ((pick ?: "").uppercase(Locale.US)) {
        "OVER" -> over ?: close
        "UNDER" -> under ?: close
        else -> close
    }

private fun moneylineLean(game: CFBPrediction): String {
    val score = game.predictedScore ?: return "—"
    val margin = score.home - score.away
    return when {
        margin > 0 -> "${CFBTeamAssets.abbr(game.homeTeam)} by ${num(margin)}"
        margin < 0 -> "${CFBTeamAssets.abbr(game.awayTeam)} by ${num(abs(margin))}"
        else -> "Pick'em"
    }
}

// ============================================================================
// Weather / hero helpers
// ============================================================================

/** Returns (text, systemImage, tint) for the weather condition chip. */
fun weatherCondition(game: CFBPrediction): Triple<String, String, Color>? {
    val key = (game.wxIcon ?: game.icon ?: "").lowercase(Locale.US)
    fun t(text: String, icon: String, hex: Long) = Triple(text, icon, Color(hex))
    return when {
        key.contains("indoor") || key.contains("dome") -> t("Indoor", "building.2.fill", 0xFFA78BFA)
        key.contains("thunder") || key.contains("storm") -> t("Storms", "cloud.bolt.rain.fill", 0xFFFACC15)
        key.contains("rain") || key.contains("shower") -> t("Rain", "cloud.rain.fill", 0xFF38BDF8)
        key.contains("snow") || key.contains("sleet") -> t("Snow", "cloud.snow.fill", 0xFFBAE6FD)
        key.contains("fog") || key.contains("mist") -> t("Fog", "cloud.fog.fill", 0xFF94A3B8)
        key.contains("wind") -> t("Windy", "wind", 0xFF60A5FA)
        key.contains("cold") -> t("Cold", "thermometer.snowflake", 0xFF93C5FD)
        key.contains("hot") -> t("Hot", "thermometer.sun.fill", 0xFFFB923C)
        key.contains("partly") -> t("Partly", "cloud.sun.fill", 0xFFFBBF24)
        key.contains("cloud") || key.contains("overcast") -> t("Cloudy", "cloud.fill", 0xFFCBD5E1)
        key.contains("clear") || key.contains("sun") -> t("Clear", "sun.max.fill", 0xFFFACC15)
        else -> {
            val summary = game.wxSummary?.trim().takeUnless { it.isNullOrEmpty() } ?: return null
            val short = summary.replace("°F", "°").split("·").first().trim()
            t(short, "cloud.sun.fill", 0xFFFBBF24)
        }
    }
}

fun tempTint(temp: Double): Color = when {
    temp <= 38 -> Color(0xFF60A5FA)
    temp >= 82 -> Color(0xFFF97316)
    else -> Color(0xFF22C55E)
}

fun heroNameFont(team: String): Int = when (team.length) {
    in 0..11 -> 14
    in 12..17 -> 13
    in 18..24 -> 12
    else -> 11
}

fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t.coerceIn(0f, 1f)
